import asyncio
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Response, status, HTTPException, BackgroundTasks
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
    UserOut,
    UserUpdate,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    VerifyEmailRequest,
)
from app.services.auth_service import AuthService
from app.core.deps import get_current_user, require_roles
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

    # --- Fire 3 concurrent query groups instead of 7 sequential awaits ---
    # Each uses its own session since AsyncSession is not safe for concurrent use.
    async def query_exam_attempts():
        async with async_session_factory() as s:
            # Aggregate totals + today count in one pass
            res = (await s.exec(
                select(
                    func.sum(func.coalesce(ExamAttempt.total_correct, 0) + func.coalesce(ExamAttempt.total_incorrect, 0)).label("q_sum"),
                    func.sum(case((ExamAttempt.submitted_at >= today_start,
                                   func.coalesce(ExamAttempt.total_correct, 0) + func.coalesce(ExamAttempt.total_incorrect, 0)), else_=0)).label("today_q_sum"),
                ).where(ExamAttempt.user_id == u_id, ExamAttempt.status.in_([AttemptStatus.SUBMITTED, AttemptStatus.EVALUATED]))
            )).first()
            completed = int(getattr(res, "q_sum", 0) or 0)
            today_completed = int(getattr(res, "today_q_sum", 0) or 0)

            # Activity dates from completed exams
            dates = {dt for dt in (await s.exec(
                select(func.date(ExamAttempt.submitted_at))
                .where(ExamAttempt.user_id == u_id, ExamAttempt.submitted_at.is_not(None)).distinct()
            )).all() if dt}
            return completed, today_completed, dates

    async def query_telemetry():
        async with async_session_factory() as s:
            in_prog = (await s.exec(
                select(func.count(ExamQuestionResponse.id))
                .join(ExamAttempt, ExamQuestionResponse.attempt_id == ExamAttempt.id)
                .where(ExamAttempt.user_id == u_id, ExamAttempt.status == AttemptStatus.IN_PROGRESS,
                       ExamQuestionResponse.selected_option_id.is_not(None))
            )).first() or 0

            u_test = (await s.exec(
                select(func.count(UserQuestionResponse.id))
                .join(UserTestAttempt, UserQuestionResponse.attempt_id == UserTestAttempt.id)
                .where(UserTestAttempt.user_id == u_id, UserQuestionResponse.selected_option_id.is_not(None))
            )).first() or 0

            dates = {dt for dt in (await s.exec(
                select(func.coalesce(func.date(UserTestAttempt.submitted_at), func.date(UserTestAttempt.started_at)))
                .where(UserTestAttempt.user_id == u_id).distinct()
            )).all() if dt}
            return int(in_prog), int(u_test), dates

    async def query_study_activity():
        async with async_session_factory() as s:
            res = (await s.exec(
                select(
                    func.sum(StudyActivity.questions_attempted).label("act_sum"),
                    func.sum(case((StudyActivity.date == today_date, StudyActivity.questions_attempted), else_=0)).label("today_act_sum"),
                ).where(StudyActivity.user_id == u_id)
            )).first()
            act_sum = int(getattr(res, "act_sum", 0) or 0)
            today_act_sum = int(getattr(res, "today_act_sum", 0) or 0)

            dates = {dt for dt in (await s.exec(
                select(StudyActivity.date).where(StudyActivity.user_id == u_id).distinct()
            )).all() if dt}
            return act_sum, today_act_sum, dates

    # Run all 3 groups concurrently
    (completed_q, today_completed_q, exam_dates), \
    (in_prog_sum, u_test_sum, telemetry_dates), \
    (act_sum, today_act_sum, activity_dates) = await asyncio.gather(
        query_exam_attempts(), query_telemetry(), query_study_activity()
    )

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


async def _sync_student_profile_bg(sync_data: dict):
    """Background task: write updated stats to StudentProfile without blocking the HTTP response."""
    u_id = sync_data["u_id"]
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


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    response: Response,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    auth_service = AuthService(session)
    await auth_service.logout_user(current_user.id)
    response.delete_cookie("refresh_token")
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


@router.get("/me", response_model=UserOut)
async def read_current_user(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
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
            if sync_data:
                background_tasks.add_task(_sync_student_profile_bg, sync_data)
    
    return UserOut(
        id=current_user.id,
        full_name=current_user.full_name,
        email=current_user.email,
        role=current_user.role,
        status=current_user.status,
        subscription_tier=current_user.subscription_tier,
        profile_image=current_user.profile_image,
        preferred_language=getattr(current_user, "preferred_language", "en") or "en",
        free_questions_attempted=stats.get("free_questions_attempted", 0),
        total_questions_attempted=stats.get("total_questions_attempted", 0),
        today_questions_attempted=stats.get("today_questions_attempted", 0),
        current_streak=stats.get("current_streak", current_user.current_streak),
        total_xp=stats.get("total_xp", current_user.total_xp),
        level=stats.get("level", current_user.level),
        created_at=current_user.created_at,
    )


@router.patch("/me", response_model=UserOut)
async def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    if user_update.full_name is not None:
        current_user.full_name = user_update.full_name
    if user_update.profile_image is not None:
        current_user.profile_image = user_update.profile_image
    if user_update.preferred_language is not None:
        from app.core.languages import normalize_language
        iso_code, _ = normalize_language(user_update.preferred_language)
        current_user.preferred_language = iso_code
    
    session.add(current_user)
    await session.commit()
    await session.refresh(current_user)
    return await read_current_user(current_user=current_user, session=session)


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

