import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.session import get_async_session
from app.services.analytics_service import AnalyticsService
from app.core.deps import get_current_user
from app.db.models.user import User, UserRole
from app.schemas.analytics import StudyActivityCreate, StudyActivityOut
from app.db.models.study_plan import StudyActivity
from app.core.deps import get_current_user
from app.db.models.user import User
from sqlmodel import select, col
from datetime import datetime, timezone


router = APIRouter(prefix="/analytics", tags=["Psychometric & Cognitive Analytics"])


@router.get("/reports/attempts/{attempt_id}/questions", summary="Report 1: Question-Level Detailed Diagnostic & Explanation Report")
async def get_attempt_question_report(
    attempt_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Report 1: Detailed question cards with explanations, core concepts, step-by-step solutions,
    distractor traps, time window, and question-level scores.
    """
    service = AnalyticsService(session)
    return await service.get_attempt_question_report(attempt_id=attempt_id)


@router.get("/reports/attempts/{attempt_id}/exam", summary="Report 2: Exam-Level 12-Matrix Aggregated Report")
async def get_attempt_exam_report(
    attempt_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Report 2: Comprehensive 12-matrix aggregated exam diagnostic summary, taxonomy mastery grid, and AI insights.
    """
    service = AnalyticsService(session)
    return await service.get_attempt_exam_report(attempt_id=attempt_id)


@router.get("/reports/attempts/{attempt_id}/user-delta", summary="Report 3: Cumulative User Skill Progression Delta Report")
async def get_attempt_user_progression_report(
    attempt_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Report 3: Longitudinal user skill progression, tracking exact matrix score deltas (ICRS, IRT, GTI, OEEI, SATOI),
    taxonomy promotions, and spaced repetition review schedules.
    """
    service = AnalyticsService(session)
    return await service.get_attempt_user_progression_report(attempt_id=attempt_id)


@router.get("/reports/user/{user_id}/skill-profile", summary="User Cumulative Psychometric Skill Profile")
async def get_user_cumulative_skill_profile(
    user_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieves the user's cumulative long-term skill profile and active taxonomy mastery grid.
    """
    if current_user.id != user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="FORBIDDEN: You cannot view another user's skill profile.")
    service = AnalyticsService(session)
    return await service.get_user_skill_profile(user_id=user_id)


@router.get("/reports/attempts/{attempt_id}/json")
async def get_attempt_report_json(
    attempt_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Generates/fetches full psychometric report in JSON format directly by attempt_id."""
    service = AnalyticsService(session)
    return await service.get_psychometric_report_json(attempt_id=attempt_id)


@router.get("/reports/attempts/{attempt_id}/yaml")
async def get_attempt_report_yaml(
    attempt_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Generates/fetches full psychometric report in YAML format directly by attempt_id."""
    service = AnalyticsService(session)
    return await service.get_psychometric_report_yaml(attempt_id=attempt_id)


@router.get("/reports/attempts/{attempt_id}/markdown")
async def get_attempt_report_markdown(
    attempt_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Generates/fetches full psychometric report in Markdown format directly by attempt_id."""
    service = AnalyticsService(session)
    return await service.get_psychometric_report_markdown(attempt_id=attempt_id)

@router.post("/activity", response_model=StudyActivityOut)
async def create_study_activity(
    activity_in: StudyActivityCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """Log a new study activity."""
    db_activity = StudyActivity(
        user_id=current_user.id,
        **activity_in.model_dump()
    )
    session.add(db_activity)
    await session.commit()
    await session.refresh(db_activity)
    return db_activity

@router.get("/activity/today", response_model=list[StudyActivityOut])
async def get_todays_activities(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """Get all study activities logged today for the current user."""
    today = datetime.now(timezone.utc).date()
    statement = select(StudyActivity).where(
        StudyActivity.user_id == current_user.id,
        StudyActivity.date == today
    ).order_by(col(StudyActivity.created_at).desc())
    
    result = await session.exec(statement)
    return result.all()

@router.get("/reports/user/{user_id}/exam/{exam_id}/json")
async def get_exam_psychometric_report_json(
    user_id: uuid.UUID,
    exam_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Generates latest attempt Psychometric Report for a specific user and exam in JSON format."""
    _validate_user_ownership(current_user, user_id)
    service = AnalyticsService(session)
    return await service.get_psychometric_report_json(user_id=user_id, exam_id=exam_id)


@router.get("/reports/user/{user_id}/exam/{exam_id}/yaml")
async def get_exam_psychometric_report_yaml(
    user_id: uuid.UUID,
    exam_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Generates latest attempt Psychometric Report for a specific user and exam in YAML format."""
    _validate_user_ownership(current_user, user_id)
    service = AnalyticsService(session)
    return await service.get_psychometric_report_yaml(user_id=user_id, exam_id=exam_id)


@router.get("/reports/user/{user_id}/exam/{exam_id}/markdown")
async def get_exam_psychometric_report_markdown(
    user_id: uuid.UUID,
    exam_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Generates latest attempt Psychometric Report for a specific user and exam in Markdown format."""
    _validate_user_ownership(current_user, user_id)
    service = AnalyticsService(session)
    return await service.get_psychometric_report_markdown(user_id=user_id, exam_id=exam_id)


def _validate_user_ownership(current_user: User, target_user_id: uuid.UUID):
    if current_user.id != target_user_id and current_user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="UNAUTHORIZED_ACCESS: You can only access your own analytics reports.",
        )
