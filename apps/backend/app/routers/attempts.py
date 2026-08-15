import uuid
from typing import Optional
from fastapi import APIRouter, Depends, status, BackgroundTasks
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
    skip: int = 0,
    limit: int = 20,
    exam_id: Optional[uuid.UUID] = None,
    status_filter: Optional[AttemptStatus] = None,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Parameter 13: Lists candidate's exam attempts history with optional filtering by exam_id or status.
    """
    service = ExamSessionService(session)
    return await service.list_user_attempts(
        user_id=current_user.id,
        skip=skip,
        limit=limit,
        exam_id=exam_id,
        status_filter=status_filter,
    )


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


@router.get("/{attempt_id}/questions/{question_number}", response_model=QuestionNavResponse)
async def get_question_by_number(
    attempt_id: uuid.UUID,
    question_number: int,
    language: Optional[str] = "ENGLISH",
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Parameter 8: Fetches a specific question by its 1-indexed number within the exam paper.
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
    attempt_id: uuid.UUID,
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
    attempt_id: uuid.UUID,
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
    attempt_id: uuid.UUID,
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
    attempt_id: uuid.UUID,
    question_id: uuid.UUID,
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
    attempt_id: uuid.UUID,
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
    attempt_id: uuid.UUID,
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
    attempt_id: uuid.UUID,
    req: SubmitExamRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Parameter 7 & 12: Finalizes the exam attempt with idempotency check and server-side timer validation.
    Synchronously calculates raw scores and enqueues the async post-submission psychometric analysis pipeline.
    """
    service = ExamSessionService(session)
    return await service.submit_exam(
        attempt_id=attempt_id,
        user_id=current_user.id,
        req=req,
        background_tasks=background_tasks,
    )


@router.get("/{attempt_id}/result", summary="Dedicated Result View for Submitted/Evaluated Attempt")
async def get_attempt_result(
    attempt_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Parameter 14: Dedicated result view for a submitted/evaluated attempt once status is SUBMITTED or EVALUATED.
    """
    service = ExamSessionService(session)
    return await service.get_attempt_result(attempt_id=attempt_id, user_id=current_user.id)
