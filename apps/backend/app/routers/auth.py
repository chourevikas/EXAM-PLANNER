import asyncio
from typing import Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Response, Request, status, HTTPException, BackgroundTasks
from sqlmodel import select, func, case
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.session import get_async_session, async_session_factory
from app.db.models.user import User, UserRole, StudentProfile
from app.db.models.analytics import ExamAttempt, ExamQuestionResponse, AttemptStatus
from app.db.models.telemetry import UserTestAttempt, UserQuestionResponse
from app.db.models.study_plan import StudyActivity
from app.schemas.auth import (
    UserRegister,
    UserLogin,
    TokenResponse,
    RefreshTokenRequest,
    ClerkExchangeRequest,
    UserOut,
    UserUpdate,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    VerifyEmailRequest,
)
import jwt
from app.config.settings import settings
from app.services.auth_service import AuthService
from app.core.deps import get_current_user, require_roles, verify_clerk_token, get_or_create_user_from_clerk
from app.cache import get_cache, build_cache_key

router = APIRouter(prefix="/auth", tags=["Authentication"])


async def _get_user_question_stats(session: AsyncSession, user_id: int | str) -> dict:
    try:
        u_id = int(user_id)
    except (ValueError, TypeError):
        return {"total_questions_solved": 0, "streak_days": 0, "today_questions_solved": 0}

    cache_key = build_cache_key("auth:user_stats", str(u_id))
    cache = get_cache()
    cached_val = await cache.get(cache_key)
    if cached_val is not None:
        return cached_val

    now_utc = datetime.now(timezone.utc)
    today_start = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    today_date = today_start.date()

    # 1. Aggregate totals + today count from completed exams
    res = (await session.exec(
        select(
            func.sum(func.coalesce(ExamAttempt.total_correct, 0) + func.coalesce(ExamAttempt.total_incorrect, 0)).label("q_sum"),
            func.sum(case((ExamAttempt.submitted_at >= today_start,
                           func.coalesce(ExamAttempt.total_correct, 0) + func.coalesce(ExamAttempt.total_incorrect, 0)), else_=0)).label("today_q_sum"),
        ).where(ExamAttempt.user_id == u_id, ExamAttempt.status.in_([AttemptStatus.SUBMITTED, AttemptStatus.EVALUATED]))
    )).first()
    completed_q = int(getattr(res, "q_sum", 0) or 0)
    today_completed_q = int(getattr(res, "today_q_sum", 0) or 0)

    exam_dates = {dt for dt in (await session.exec(
        select(func.date(ExamAttempt.submitted_at))
        .where(ExamAttempt.user_id == u_id, ExamAttempt.submitted_at.is_not(None)).distinct()
    )).all() if dt}

    # 2. Telemetry queries
    in_prog_sum = int((await session.exec(
        select(func.count(ExamQuestionResponse.id))
        .join(ExamAttempt, ExamQuestionResponse.attempt_id == ExamAttempt.id)
        .where(ExamAttempt.user_id == u_id, ExamAttempt.status == AttemptStatus.IN_PROGRESS,
               ExamQuestionResponse.selected_option_id.is_not(None))
    )).first() or 0)

    u_test_sum = int((await session.exec(
        select(func.count(UserQuestionResponse.id))
        .join(UserTestAttempt, UserQuestionResponse.attempt_id == UserTestAttempt.id)
        .where(UserTestAttempt.user_id == u_id, UserQuestionResponse.selected_option_id.is_not(None))
    )).first() or 0)

    telemetry_dates = {dt for dt in (await session.exec(
        select(func.coalesce(func.date(UserTestAttempt.submitted_at), func.date(UserTestAttempt.started_at)))
        .where(UserTestAttempt.user_id == u_id).distinct()
    )).all() if dt}

    # 3. Study activity queries
    act_res = (await session.exec(
        select(
            func.sum(StudyActivity.questions_attempted).label("act_sum"),
            func.sum(case((StudyActivity.date == today_date, StudyActivity.questions_attempted), else_=0)).label("today_act_sum"),
        ).where(StudyActivity.user_id == u_id)
    )).first()
    act_sum = int(getattr(act_res, "act_sum", 0) or 0)
    today_act_sum = int(getattr(act_res, "today_act_sum", 0) or 0)

    activity_dates = {dt for dt in (await session.exec(
        select(StudyActivity.date).where(StudyActivity.user_id == u_id).distinct()
    )).all() if dt}

    all_activity_dates = exam_dates | telemetry_dates | activity_dates
    total_q = completed_q + in_prog_sum + u_test_sum + act_sum
    today_q = today_completed_q + today_act_sum

    # Streak calculation (pure Python — no extra DB call)
    current_streak = 0
    if all_activity_dates:
        curr_check = today_date
        if curr_check not in all_activity_dates:
            curr_check = today_date - timedelta(days=1)
        while curr_check in all_activity_dates:
            current_streak += 1
            curr_check -= timedelta(days=1)

    calculated_xp = total_q * 10
    calculated_level = (calculated_xp // 500) + 1

    # Read StudentProfile from the original session (1 read, not a write)
    prof = (await session.exec(select(StudentProfile).where(StudentProfile.user_id == u_id))).first()

    result = {
        "free_questions_attempted": total_q,
        "total_questions_attempted": total_q,
        "today_questions_attempted": today_q,
        "current_streak": max(current_streak, prof.current_streak if prof else 0),
        "total_xp": max(calculated_xp, prof.total_xp if prof else 0),
        "level": max(calculated_level, prof.level if prof else 1),
        # Pass through for background sync
        "_sync": {"u_id": u_id, "streak": current_streak, "xp": calculated_xp,
                  "level": calculated_level, "q": total_q, "has_prof": prof is not None},
    }
    await cache.set(cache_key, result, ttl_seconds=300)
    return result


from app.config.logger import setup_logger

logger = setup_logger("AuthRouter")


async def _sync_student_profile_bg(sync_data: dict):
    """Background task: write updated stats to StudentProfile without blocking the HTTP response."""
    u_id = sync_data["u_id"]
    try:
        async with async_session_factory() as s:
            prof = (await s.exec(select(StudentProfile).where(StudentProfile.user_id == u_id))).first()
            if prof:
                updated = False
                if sync_data["streak"] != prof.current_streak:
                    prof.current_streak = sync_data["streak"]
                    if sync_data["streak"] > prof.highest_streak:
                        prof.highest_streak = sync_data["streak"]
                    updated = True
                if sync_data["xp"] > prof.total_xp:
                    prof.total_xp = sync_data["xp"]
                    updated = True
                if sync_data["level"] > prof.level:
                    prof.level = sync_data["level"]
                    updated = True
                if sync_data["q"] > prof.free_questions_attempted:
                    prof.free_questions_attempted = sync_data["q"]
                    updated = True
                if updated:
                    s.add(prof)
                    await s.commit()
            elif not sync_data["has_prof"]:
                s.add(StudentProfile(
                    user_id=u_id, current_streak=sync_data["streak"],
                    highest_streak=sync_data["streak"], total_xp=sync_data["xp"],
                    level=sync_data["level"], free_questions_attempted=sync_data["q"],
                ))
                await s.commit()
    except Exception as e:
        logger.warning(f"Error syncing student profile in background: {e}")



@router.post(
    "/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED
)
async def register(
    user_in: UserRegister,
    response: Response,
    session: AsyncSession = Depends(get_async_session),
):
    auth_service = AuthService(session)
    token_response, refresh_token = await auth_service.register_user(user_in)

    if refresh_token:
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            httponly=True,
            samesite="lax",
            secure=False,
        )
    return token_response


@router.post("/login", response_model=TokenResponse)
async def login(
    user_in: UserLogin,
    response: Response,
    session: AsyncSession = Depends(get_async_session),
):
    auth_service = AuthService(session)
    token_response, refresh_token = await auth_service.authenticate_user(user_in)

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        secure=False,
    )
    return token_response


@router.post("/clerk-exchange", response_model=TokenResponse)
async def clerk_exchange(
    body: ClerkExchangeRequest,
    response: Response,
    session: AsyncSession = Depends(get_async_session),
):
    """Exchanges a verified Clerk OAuth login for our own session tokens.

    This is the only point where a Clerk-issued token is ever accepted —
    afterward the frontend uses the returned access/refresh tokens exactly
    like a normal email/password login. get_current_user no longer accepts
    Clerk tokens directly.
    """
    payload = await verify_clerk_token(body.clerk_token)
    clerk_id = payload["sub"]
    clerk_email = (
        payload.get("email")
        or payload.get("email_address")
        or payload.get("primary_email_address")
        or body.email
    )
    clerk_name = (
        payload.get("name")
        or payload.get("full_name")
        or body.full_name
    )
    clerk_image = (
        body.profile_image
        or payload.get("picture")
        or payload.get("image_url")
    )

    # Server-side fallback via Clerk REST API if email/name missing and CLERK_SECRET_KEY configured
    if (not clerk_email or not clerk_name) and getattr(settings, "CLERK_SECRET_KEY", None):
        try:
            import httpx
            async with httpx.AsyncClient(timeout=5.0) as client:
                c_res = await client.get(
                    f"https://api.clerk.com/v1/users/{clerk_id}",
                    headers={"Authorization": f"Bearer {settings.CLERK_SECRET_KEY}"},
                )
                if c_res.status_code == 200:
                    c_data = c_res.json()
                    first = c_data.get("first_name") or ""
                    last = c_data.get("last_name") or ""
                    c_full = f"{first} {last}".strip()
                    if c_full and not clerk_name:
                        clerk_name = c_full
                    
                    emails = c_data.get("email_addresses", [])
                    primary_id = c_data.get("primary_email_address_id")
                    for em in emails:
                        if em.get("id") == primary_id:
                            clerk_email = em.get("email_address")
                            break
                    if not clerk_email and emails:
                        clerk_email = emails[0].get("email_address")
                    
                    if not clerk_image:
                        clerk_image = c_data.get("image_url") or c_data.get("profile_image_url")
        except Exception as e:
            logger.warning(f"Could not fetch user details directly from Clerk API: {e}")

    user = await get_or_create_user_from_clerk(
        session, clerk_id, clerk_email, clerk_name, clerk_image
    )

    auth_service = AuthService(session)
    token_response, refresh_token = await auth_service.exchange_clerk_token(user)

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        secure=False,
    )
    return token_response


@router.post("/refresh", response_model=TokenResponse, status_code=status.HTTP_200_OK)
async def refresh_token(
    request: Request,
    response: Response,
    body: Optional[RefreshTokenRequest] = None,
    session: AsyncSession = Depends(get_async_session),
):
    token = None
    if request.cookies.get("refresh_token"):
        token = request.cookies.get("refresh_token")
    elif body and body.refresh_token:
        token = body.refresh_token

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token required in cookie or body",
        )

    auth_service = AuthService(session)
    token_response, new_refresh_token = await auth_service.refresh_access_token(token)

    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        samesite="lax",
        secure=False,
    )
    return token_response


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_async_session),
):
    response.delete_cookie("refresh_token")
    auth_service = AuthService(session)

    token = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
    elif request.cookies.get("access_token"):
        token = request.cookies.get("access_token")

    if token:
        try:
            payload = jwt.decode(
                token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
            )
            user_id = payload.get("sub")
            if user_id:
                await auth_service.logout_user(user_id)
        except Exception:
            pass

    return {"message": "Successfully logged out"}


@router.post("/verify-email", status_code=status.HTTP_200_OK)
async def verify_email(
    req: VerifyEmailRequest, session: AsyncSession = Depends(get_async_session)
):
    auth_service = AuthService(session)
    success = await auth_service.verify_email(req.token)
    if not success:
        raise HTTPException(
            status_code=400, detail="Invalid or expired verification token"
        )
    return {"message": "Email verified successfully"}


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(
    req: ForgotPasswordRequest, session: AsyncSession = Depends(get_async_session)
):
    auth_service = AuthService(session)
    await auth_service.forgot_password(req.email)
    return {
        "message": "If that email is registered, a password reset link has been sent."
    }


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(
    req: ResetPasswordRequest, session: AsyncSession = Depends(get_async_session)
):
    auth_service = AuthService(session)
    success = await auth_service.reset_password(req.token, req.new_password)
    if not success:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    return {"message": "Password reset successfully"}


async def _build_user_out_response(
    current_user: User,
    session: AsyncSession,
    background_tasks: Optional[BackgroundTasks] = None,
) -> UserOut:
    stats = {}
    if current_user.role == UserRole.STUDENT:
        cache = get_cache()
        cache_key = build_cache_key("auth:me:stats", str(current_user.id))
        stats = await cache.get(cache_key)
        if stats is None:
            stats = await _get_user_question_stats(session, current_user.id)
            sync_data = stats.pop("_sync", None)
            await cache.set(cache_key, stats, ttl_seconds=300)
            # Write updated streak/xp/level AFTER response is sent — doesn't block the user
            if sync_data and background_tasks:
                background_tasks.add_task(_sync_student_profile_bg, sync_data)
    
    sub_info = {}
    if current_user.role == UserRole.STUDENT:
        from app.services.user_service import get_subscription_info
        sub_info = await get_subscription_info(session, current_user.id)

    prep = {}
    if current_user.role == UserRole.STUDENT:
        from app.services.user_service import get_profile_extras
        prep = (await get_profile_extras(session, [current_user.id])).get(current_user.id, {})

    admin_permissions = None
    if current_user.role == UserRole.ADMIN:
        from app.core.deps import effective_admin_permissions
        admin_permissions = await effective_admin_permissions(session, current_user)

    return UserOut(
        id=current_user.id,
        full_name=current_user.full_name,
        email=current_user.email,
        role=current_user.role,
        status=current_user.status,
        subscription_tier=current_user.subscription_tier,
        profile_image=current_user.profile_image,
        phone=current_user.phone,
        subscription_ends_at=sub_info.get("subscription_ends_at"),
        subscription_days_remaining=sub_info.get("subscription_days_remaining"),
        admin_permissions=admin_permissions,
        target_exam=prep.get("target_exam"),
        target_year=prep.get("target_year"),
        optional_subject=prep.get("optional_subject"),
        weekly_hours=prep.get("weekly_hours"),
        preferred_language=getattr(current_user, "preferred_language", "en") or "en",
        free_questions_attempted=stats.get("free_questions_attempted", 0),
        total_questions_attempted=stats.get("total_questions_attempted", 0),
        today_questions_attempted=stats.get("today_questions_attempted", 0),
        current_streak=stats.get("current_streak", current_user.current_streak),
        total_xp=stats.get("total_xp", current_user.total_xp),
        level=stats.get("level", current_user.level),
        created_at=current_user.created_at,
    )


@router.get("/me", response_model=UserOut)
async def read_current_user(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    return await _build_user_out_response(current_user=current_user, session=session, background_tasks=background_tasks)


@router.patch("/me", response_model=UserOut)
async def update_current_user(
    user_update: UserUpdate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    db_user = await session.get(User, current_user.id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    if user_update.full_name is not None:
        db_user.full_name = user_update.full_name
    if user_update.email is not None:
        # Check if email is already taken by another user
        existing_with_email = (await session.exec(select(User).where(User.email == user_update.email, User.id != db_user.id))).first()
        if not existing_with_email:
            db_user.email = user_update.email
    if user_update.profile_image is not None:
        db_user.profile_image = user_update.profile_image
    if user_update.phone is not None:
        db_user.phone = user_update.phone.strip()[:32] or None

    # Exam-preparation details live on the student profile.
    prep = {
        "target_exam": (user_update.target_exam, 100),
        "target_year": (user_update.target_year, 10),
        "optional_subject": (user_update.optional_subject, 150),
        "weekly_hours": (user_update.weekly_hours, 10),
    }
    if db_user.role == UserRole.STUDENT and any(v is not None for v, _ in prep.values()):
        profile = (await session.exec(select(StudentProfile).where(StudentProfile.user_id == db_user.id))).first()
        if profile is None:
            profile = StudentProfile(user_id=db_user.id)
        for field, (value, max_len) in prep.items():
            if value is not None:
                setattr(profile, field, value.strip()[:max_len] or None)
        session.add(profile)
    if user_update.preferred_language is not None:
        from app.core.languages import normalize_language, is_supported_language
        if not is_supported_language(user_update.preferred_language):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported language '{user_update.preferred_language}'",
            )
        iso_code, _ = normalize_language(user_update.preferred_language)
        db_user.preferred_language = iso_code
    
    session.add(db_user)
    await session.commit()
    await session.refresh(db_user)
    from app.cache.helpers import invalidate_user_cache
    await invalidate_user_cache(str(db_user.id), db_user.clerk_id)
    cache = get_cache()
    await cache.delete_pattern("ep:users:list*")
    await cache.delete_pattern("users:list*")
    await cache.delete_pattern("ep:admin:*")
    return await _build_user_out_response(current_user=db_user, session=session, background_tasks=background_tasks)


@router.get("/admin-only", response_model=dict)
async def admin_dashboard_access(
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    return {
        "message": f"Welcome Admin {current_user.full_name}",
        "role": current_user.role,
    }


@router.get("/super-admin-only", response_model=dict)
async def super_admin_access(
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    return {
        "message": f"Welcome Super Admin {current_user.full_name}",
        "role": current_user.role,
    }


@router.get("/languages", summary="List all 22 official Indian languages + English")
async def get_supported_languages():
    from app.core.languages import get_all_supported_languages
    return get_all_supported_languages()

