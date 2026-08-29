import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Response, status, HTTPException
from sqlmodel import select, func
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.session import get_async_session
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

router = APIRouter(prefix="/auth", tags=["Authentication"])


async def _get_user_question_stats(session: AsyncSession, user_id: int | str) -> dict:
    u_id = int(user_id)
    now_utc = datetime.now(timezone.utc)
    today_start = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    today_date = today_start.date()

    activity_dates = set()

    # 1. Answered questions from completed/evaluated ExamAttempts
    attempts_res = await session.exec(
        select(ExamAttempt)
        .where(ExamAttempt.user_id == u_id)
        .where(ExamAttempt.status.in_([AttemptStatus.SUBMITTED, AttemptStatus.EVALUATED]))
    )
    attempts = attempts_res.all()
    completed_q_count = 0
    today_completed_q_count = 0

    for att in attempts:
        q_count = 0
        if att.total_correct is not None and att.total_incorrect is not None and (att.total_correct + att.total_incorrect) > 0:
            q_count = att.total_correct + att.total_incorrect
        elif att.total_unattempted is not None:
            q_count = max(0, att.total_questions - att.total_unattempted)
        
        completed_q_count += q_count
        if att.submitted_at:
            att_dt = att.submitted_at
            if hasattr(att_dt, "date"):
                activity_dates.add(att_dt.date())
            if att.submitted_at >= today_start:
                today_completed_q_count += q_count

    # 2. Answered questions in active IN_PROGRESS ExamAttempts
    in_prog_res = await session.exec(
        select(func.count(ExamQuestionResponse.id))
        .join(ExamAttempt, ExamQuestionResponse.attempt_id == ExamAttempt.id)
        .where(ExamAttempt.user_id == u_id)
        .where(ExamAttempt.status == AttemptStatus.IN_PROGRESS)
        .where(ExamQuestionResponse.selected_option_id.is_not(None))
    )
    in_prog_sum = in_prog_res.first() or 0

    # 3. Answered questions in UserQuestionResponses (UserTestAttempts)
    u_test_res = await session.exec(
        select(func.count(UserQuestionResponse.id))
        .join(UserTestAttempt, UserQuestionResponse.attempt_id == UserTestAttempt.id)
        .where(UserTestAttempt.user_id == u_id)
        .where(UserQuestionResponse.selected_option_id.is_not(None))
    )
    u_test_sum = u_test_res.first() or 0

    # Collect telemetry activity dates
    u_att_res = await session.exec(
        select(UserTestAttempt).where(UserTestAttempt.user_id == u_id)
    )
    for ua in u_att_res.all():
        sub_at = getattr(ua, "submitted_at", None) or getattr(ua, "started_at", None)
        if sub_at and hasattr(sub_at, "date"):
            activity_dates.add(sub_at.date())

    # 4. Questions logged via StudyActivity
    act_res = await session.exec(
        select(StudyActivity).where(StudyActivity.user_id == u_id)
    )
    activities = act_res.all()
    act_sum = sum(a.questions_attempted or 0 for a in activities)
    today_act_sum = sum(a.questions_attempted or 0 for a in activities if a.date == today_date)
    for a in activities:
        if a.date:
            activity_dates.add(a.date)

    total_q = int(completed_q_count + in_prog_sum + u_test_sum + act_sum)
    today_q = int(today_completed_q_count + today_act_sum)

    # Dynamic streak calculation
    current_streak = 0
    if activity_dates:
        curr_check = today_date
        if curr_check not in activity_dates:
            curr_check = today_date - timedelta(days=1)
        
        while curr_check in activity_dates:
            current_streak += 1
            curr_check -= timedelta(days=1)

    # Dynamic XP and Level
    calculated_xp = total_q * 10
    calculated_level = (calculated_xp // 500) + 1

    # Sync into StudentProfile
    prof_res = await session.exec(
        select(StudentProfile).where(StudentProfile.user_id == u_id)
    )
    prof = prof_res.first()
    if prof:
        updated = False
        if current_streak != prof.current_streak:
            prof.current_streak = current_streak
            if current_streak > prof.highest_streak:
                prof.highest_streak = current_streak
            updated = True
        
        if calculated_xp > prof.total_xp:
            prof.total_xp = calculated_xp
            updated = True

        if calculated_level > prof.level:
            prof.level = calculated_level
            updated = True

        if total_q > prof.free_questions_attempted:
            prof.free_questions_attempted = total_q
            updated = True
        
        if updated:
            session.add(prof)
            await session.commit()
    else:
        new_prof = StudentProfile(
            user_id=u_id,
            current_streak=current_streak,
            highest_streak=current_streak,
            total_xp=calculated_xp,
            level=calculated_level,
            free_questions_attempted=total_q
        )
        session.add(new_prof)
        await session.commit()

    return {
        "free_questions_attempted": total_q,
        "total_questions_attempted": total_q,
        "today_questions_attempted": today_q,
        "current_streak": max(current_streak, prof.current_streak if prof else 0),
        "total_xp": max(calculated_xp, prof.total_xp if prof else 0),
        "level": max(calculated_level, prof.level if prof else 1),
    }


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
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    stats = await _get_user_question_stats(session, current_user.id)
    return UserOut(
        id=current_user.id,
        full_name=current_user.full_name,
        email=current_user.email,
        role=current_user.role,
        status=current_user.status,
        subscription_tier=current_user.subscription_tier,
        profile_image=current_user.profile_image,
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
