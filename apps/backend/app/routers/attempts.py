from typing import Optional, Any
from fastapi import APIRouter, Depends, status, BackgroundTasks, Body
from fastapi.responses import JSONResponse
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.session import get_async_session
from app.core.deps import get_current_user
from app.db.models.user import User
from app.db.models.enums import AttemptStatus
from app.services.exam_session_service import ExamSessionService
from app.schemas.exam_attempt import (
    StartExamRequest,
    StartExamResponse,
    SaveResponseRequest,
    SaveResponseResponse,
    RevealAnswerResponse,
    SubmitExamRequest,
    SubmitExamResponse,
    HeartbeatRequest,
    HeartbeatResponse,
    ExamStatusResponse,
    QuestionNavResponse,
    BatchSaveResponseRequest,
    BatchSaveResponseAck,
    BatchStatusResponse,
)

router = APIRouter(prefix="/attempts", tags=["Student Exam-Taking Sessions"])


@router.get("", summary="List Candidate's Exam Attempts History")
async def list_candidate_attempts(
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    skip: int = 0,
    limit: int = 50,
    exam_id: Optional[int | str] = None,
    status_filter: Optional[AttemptStatus] = None,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Lists candidate's exam attempts history with optional pagination and filtering by exam_id or status.
    """
    parsed_exam_id = int(exam_id) if exam_id and str(exam_id).isdigit() else None
    effective_limit = min(page_size if page_size and page_size > 0 else limit, 100)
    effective_skip = ((page - 1) * effective_limit) if (page and page >= 1) else skip

    from app.cache import get_cache, build_cache_key
    cache = get_cache()
    cache_key = build_cache_key(
        "attempts:user",
        str(current_user.id),
        skip=effective_skip,
        limit=effective_limit,
        exam_id=str(parsed_exam_id) if parsed_exam_id else None,
        status=str(status_filter.value if hasattr(status_filter, "value") else status_filter) if status_filter else None,
    )
    cached_data = await cache.get(cache_key)
    if cached_data is not None:
        return JSONResponse(content=cached_data)

    from fastapi.encoders import jsonable_encoder
    service = ExamSessionService(session)
    res = await service.list_user_attempts(
        user_id=current_user.id,
        skip=effective_skip,
        limit=effective_limit,
        exam_id=parsed_exam_id,
        status_filter=status_filter,
    )
    if res is not None:
        if page and page_size:
            res["page"] = page
            res["page_size"] = effective_limit
            import math
            res["total_pages"] = max(1, math.ceil((res.get("total", 0)) / effective_limit))
        serialized = jsonable_encoder(res)
        await cache.set(cache_key, serialized, ttl_seconds=5)
        return JSONResponse(content=serialized)
    return JSONResponse(content={"items": [], "total": 0})


@router.post("/start", response_model=StartExamResponse, status_code=status.HTTP_201_CREATED)
async def start_exam_attempt(
    req: StartExamRequest,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Creates an active exam session, pre-seeds all question response rows,
    and returns the first question with the full question palette.
    """
    service = ExamSessionService(session)
    return await service.start_exam(user_id=current_user.id, req=req)


@router.get("/{attempt_id}/questions/bulk", summary="Fetch All Exam Questions in Bulk")
async def get_all_attempt_questions_bulk(
    attempt_id: int | str,
    language: Optional[str] = "ENGLISH",
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieves all exam questions in 1 single bulk response for seamless zero-lag client-side preloading.
    """
    service = ExamSessionService(session)
    return await service.get_all_questions_bulk(
        attempt_id=attempt_id, user_id=current_user.id, language=language
    )


@router.get("/{attempt_id}/questions/{question_number}", response_model=QuestionNavResponse)
async def get_question_by_number(
    attempt_id: int | str,
    question_number: int,
    language: Optional[str] = "ENGLISH",
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Fetches a specific question by its 1-indexed number within the exam paper.
    Supports optional `?language=` parameter (e.g., ENGLISH, HINDI).
    """
    service = ExamSessionService(session)
    return await service.get_question(
        attempt_id=attempt_id,
        user_id=current_user.id,
        question_number=question_number,
        language=language,
    )


@router.post("/{attempt_id}/responses", response_model=SaveResponseResponse)
async def save_question_response(
    attempt_id: int | str,
    req: SaveResponseRequest,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Saves or updates the student's response for a specific question (Save & Next, option switch, review flag toggle).
    """
    service = ExamSessionService(session)
    return await service.save_response(attempt_id=attempt_id, user_id=current_user.id, req=req)


@router.post("/{attempt_id}/responses/batch", response_model=BatchSaveResponseAck)
async def save_question_responses_batch(
    attempt_id: int | str,
    req: BatchSaveResponseRequest,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Persists a batch of student question responses with batch ID tracking and zero data loss.
    """
    service = ExamSessionService(session)
    return await service.save_responses_batch(
        attempt_id=attempt_id, user_id=current_user.id, req=req
    )


@router.get("/{attempt_id}/responses/batch/{batch_id}", response_model=BatchStatusResponse)
async def get_response_batch_status(
    attempt_id: int | str,
    batch_id: str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Checks the persistence and verification status of a submitted response batch.
    """
    service = ExamSessionService(session)
    return service.get_batch_status(batch_id=batch_id)


@router.post("/{attempt_id}/reveal/{question_id}", response_model=RevealAnswerResponse)
async def reveal_question_answer(
    attempt_id: int | str,
    question_id: int | str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Reveals the correct answer, detailed solution explanation, and distractor analysis for a question.
    **Blocked in EXAM mode with HTTP 403**. Allowed in PRACTICE and REVISION modes after option selection.
    """
    service = ExamSessionService(session)
    return await service.reveal_answer(
        attempt_id=attempt_id, user_id=current_user.id, question_id=question_id
    )


@router.post("/{attempt_id}/heartbeat", response_model=HeartbeatResponse)
async def sync_exam_heartbeat(
    attempt_id: int | str,
    req: HeartbeatRequest,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Periodic heartbeat to sync exam timer. Auto-submits the exam if server-side time has expired.
    """
    service = ExamSessionService(session)
    return await service.heartbeat(attempt_id=attempt_id, user_id=current_user.id, req=req)


@router.get("/{attempt_id}/status", response_model=ExamStatusResponse)
async def get_exam_attempt_status(
    attempt_id: int | str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Returns full exam session state including question palette.
    Used for resuming an in-progress session after refresh or connection loss.
    """
    service = ExamSessionService(session)
    return await service.get_exam_status(attempt_id=attempt_id, user_id=current_user.id)


@router.post("/{attempt_id}/submit", response_model=SubmitExamResponse)
async def submit_exam_attempt(
    attempt_id: int | str,
    req: SubmitExamRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Finalizes the exam attempt with idempotency check and server-side timer validation.
    Synchronously calculates raw scores and enqueues the async post-submission psychometric analysis pipeline.
    """
    service = ExamSessionService(session)
    res = await service.submit_exam(
        attempt_id=attempt_id,
        user_id=current_user.id,
        req=req,
        background_tasks=background_tasks,
    )
    from app.cache import invalidate_user_cache
    await invalidate_user_cache(str(current_user.id))
    return res


@router.get("/{attempt_id}/result", summary="Dedicated Result View for Submitted/Evaluated Attempt")
async def get_attempt_result(
    attempt_id: int | str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Dedicated result view for a submitted/evaluated attempt once status is SUBMITTED or EVALUATED.
    """
    service = ExamSessionService(session)
    return await service.get_attempt_result(attempt_id=attempt_id, user_id=current_user.id)


@router.post("/sync-guest-sessions", summary="Sync guest exam attempts to candidate user account")
async def sync_guest_sessions(
    sessions_payload: Any = Body(default=[]),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Migrates guest test sessions from browser localStorage into candidate's user account database.
    """
    service = ExamSessionService(session)
    return await service.sync_guest_sessions(user_id=current_user.id, sessions_list=sessions_payload)


@router.get("/student-dashboard-stats", summary="Get merged student dashboard statistics")
async def get_student_dashboard_stats(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Returns aggregated stats and recent test attempt history for the student dashboard.
    """
    service = ExamSessionService(session)
    return await service.get_student_dashboard_stats(user_id=current_user.id)
