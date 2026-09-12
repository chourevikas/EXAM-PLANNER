from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.session import get_async_session
from app.db.models.user import User, UserRole
from app.core.deps import require_roles
from app.schemas.exam_type import (
    ExamTypeCreate,
    ExamTypeUpdate,
    ExamTypeResponse,
)
from app.services.exam_type_service import ExamTypeService
from app.cache import get_cache

router = APIRouter(tags=["Exam Types"])

admin_or_super = require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])


# =========================================================================
# Public / Student Endpoint (Source of truth for exam types across the UI)
# =========================================================================

@router.get(
    "/exam-types",
    response_model=List[ExamTypeResponse],
    summary="List Active Exam Types",
)
async def list_active_exam_types():
    """
    Returns all active exam types for UI dropdowns, exam selection, and ingestion metadata.
    Acts as the single source of truth across the frontend.
    """
    cache = get_cache()
    cache_key = "ep:exam_types:list:active"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    from app.db.session import async_session_factory
    async with async_session_factory() as session:
        service = ExamTypeService(session)
        items = await service.list_exam_types(include_inactive=False)
        serialized = [item.model_dump(mode="json") for item in items]
        await cache.set(cache_key, serialized, ttl_seconds=3600)
        return items


# =========================================================================
# Admin CRUD Endpoints
# =========================================================================

@router.get(
    "/admin/exam-types",
    response_model=List[ExamTypeResponse],
    summary="Admin: List All Exam Types with Stats",
)
async def admin_list_exam_types(
    include_inactive: bool = Query(default=True, description="Include inactive exam types"),
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(admin_or_super),
):
    service = ExamTypeService(session)
    return await service.list_exam_types(include_inactive=include_inactive)


@router.get(
    "/admin/exam-types/{exam_type_id}",
    response_model=ExamTypeResponse,
    summary="Admin: Get Exam Type Details",
)
async def admin_get_exam_type(
    exam_type_id: int,
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(admin_or_super),
):
    service = ExamTypeService(session)
    return await service.get_exam_type(exam_type_id)


@router.post(
    "/admin/exam-types",
    response_model=ExamTypeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Admin: Create New Exam Type",
)
async def admin_create_exam_type(
    payload: ExamTypeCreate,
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(admin_or_super),
):
    service = ExamTypeService(session)
    return await service.create_exam_type(payload)


@router.put(
    "/admin/exam-types/{exam_type_id}",
    response_model=ExamTypeResponse,
    summary="Admin: Update Exam Type",
)
async def admin_update_exam_type(
    exam_type_id: int,
    payload: ExamTypeUpdate,
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(admin_or_super),
):
    service = ExamTypeService(session)
    return await service.update_exam_type(exam_type_id, payload)


@router.delete(
    "/admin/exam-types/{exam_type_id}",
    summary="Admin: Delete Exam Type",
)
async def admin_delete_exam_type(
    exam_type_id: int,
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(admin_or_super),
):
    service = ExamTypeService(session)
    return await service.delete_exam_type(exam_type_id)
