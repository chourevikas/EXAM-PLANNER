import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.session import get_async_session
from app.services.analytics_service import AnalyticsService
from app.core.deps import get_current_user
from app.db.models.user import User, UserRole

router = APIRouter(prefix="/analytics", tags=["Psychometric & Cognitive Analytics"])


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
