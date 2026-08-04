import uuid
from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_async_session
from app.services.analytics_service import AnalyticsService


router = APIRouter(prefix="/analytics", tags=["Psychometric & Cognitive Analytics"])


@router.get("/reports/user/{user_id}/exam/{exam_id}/json")
async def get_exam_psychometric_report_json(
    user_id: uuid.UUID,
    exam_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session)
):
    """Generates a full question-wise & candidate skill aggregated Psychometric Diagnostic Report in JSON format."""
    service = AnalyticsService(session)
    return await service.get_psychometric_report_json(user_id=user_id, exam_id=exam_id)


@router.get("/reports/user/{user_id}/exam/{exam_id}/yaml")
async def get_exam_psychometric_report_yaml(
    user_id: uuid.UUID,
    exam_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session)
):
    """Generates a full question-wise & candidate skill aggregated Psychometric Diagnostic Report in YAML format."""
    service = AnalyticsService(session)
    return await service.get_psychometric_report_yaml(user_id=user_id, exam_id=exam_id)


@router.get("/reports/user/{user_id}/exam/{exam_id}/markdown")
async def get_exam_psychometric_report_markdown(
    user_id: uuid.UUID,
    exam_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session)
):
    """Generates a full question-wise & candidate skill aggregated Psychometric Diagnostic Report in Markdown format."""
    service = AnalyticsService(session)
    return await service.get_psychometric_report_markdown(user_id=user_id, exam_id=exam_id)
