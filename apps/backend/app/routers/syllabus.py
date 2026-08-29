import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.session import get_async_session
from app.schemas.syllabus import (
    CompleteSyllabusResponse,
    SyllabusVerifyRequest,
    SyllabusVerifyResponse,
)
from app.schemas.syllabus_literals import verify_syllabus_node
from app.services.syllabus_service import SyllabusService
from app.cache import get_cache, build_cache_key

router = APIRouter(prefix="/syllabus", tags=["Syllabus & Taxonomy"])


@router.get(
    "",
    response_model=CompleteSyllabusResponse,
    summary="Get Complete Syllabus Hierarchy (Master 3-Level Tree)",
)
@router.get(
    "/hierarchy",
    response_model=CompleteSyllabusResponse,
    summary="Get Complete Syllabus Hierarchy (Alias)",
)
async def get_complete_syllabus(
    exam_id: Optional[int | str] = Query(
        default=None,
        description="Optional Exam ID to enrich with exam-specific database IDs and metrics",
    ),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Returns the complete 3-level Syllabus hierarchy (Subjects -> Topics -> Subtopics)
    with total counts, clean dictionary mappings, and flat hierarchy for frontend consumers.
    """
    parsed_exam_id = None
    if exam_id is not None:
        try:
            parsed_exam_id = int(exam_id)
        except (ValueError, TypeError):
            parsed_exam_id = None

    cache = get_cache()
    cache_key = build_cache_key("syllabus:complete", str(parsed_exam_id) if parsed_exam_id else "master")
    cached_data = await cache.get(cache_key)
    if cached_data is not None:
        return JSONResponse(content=cached_data)

    service = SyllabusService(session)
    response = await service.get_complete_syllabus(exam_id=parsed_exam_id)
    serialized = jsonable_encoder(response)
    await cache.set(cache_key, serialized, ttl_seconds=3600)
    return JSONResponse(content=serialized)


@router.post(
    "/verify",
    response_model=SyllabusVerifyResponse,
    summary="Verify Syllabus Hierarchy Node Conformance",
)
async def verify_syllabus(payload: SyllabusVerifyRequest):
    """
    Validates Subject -> Topic -> Subtopic against the canonical UPSC master syllabus.
    Returns whether the node strictly conforms, along with canonical auto-repaired parents and diagnostic issue reason.
    """
    c_subj, c_top, c_subtop, is_exact, issue_reason = verify_syllabus_node(
        subject=payload.subject,
        topic=payload.topic,
        subtopic=payload.subtopic,
    )
    return SyllabusVerifyResponse(
        is_valid=True,
        canonical_subject=c_subj,
        canonical_topic=c_top,
        canonical_subtopic=c_subtop,
        is_canonical_exact_match=is_exact,
        issue_reason=issue_reason,
    )
