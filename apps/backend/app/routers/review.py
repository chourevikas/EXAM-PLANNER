import uuid
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel.ext.asyncio.session import AsyncSession
from app.db.session import get_async_session
from app.hitl.review_service import HumanReviewService


from app.db.models import LanguageCode, QuestionStatus
from app.schemas.question import ExamReviewQuestionsResponse
from app.services.question_service import QuestionService


router = APIRouter(prefix="/admin/review", tags=["Admin QA Review"])


class OptionEditRequest(BaseModel):
    option_label: str
    option_text: Optional[str] = None
    is_correct: bool = False


class ApproveQuestionRequest(BaseModel):
    updated_passage_text: Optional[str] = None
    updated_question_text: Optional[str] = None
    updated_options: Optional[List[OptionEditRequest]] = None
    correct_option_label: Optional[str] = None
    reviewer_notes: Optional[str] = None


@router.get(
    "/exams/{exam_id}/questions",
    response_model=ExamReviewQuestionsResponse,
    summary="Get Exam Questions with Full Solution Knowledge Base for Review",
)
async def get_exam_questions_review(
    exam_id: uuid.UUID,
    language: LanguageCode = Query(default=LanguageCode.ENGLISH, description="Target Language"),
    status: Optional[QuestionStatus] = Query(default=None, description="Filter by Question status"),
    page: int = Query(default=1, ge=1, description="Page number"),
    limit: int = Query(default=10, ge=1, le=100, description="Items per page"),
    session: AsyncSession = Depends(get_async_session),
):
    """Admin review endpoint returning all questions with full solutions, option explanations, and review counters."""
    q_service = QuestionService(session)
    return await q_service.get_exam_questions_for_review(
        exam_id=exam_id,
        page=page,
        limit=limit,
        language=language,
        status=status,
    )


@router.get("/tasks")
async def get_pending_tasks(
    exam_id: Optional[uuid.UUID] = Query(default=None),
    only_flagged: bool = Query(default=False),
    session: AsyncSession = Depends(get_async_session),
):
    service = HumanReviewService(session)
    return await service.get_pending_review_tasks(
        exam_id=exam_id, only_flagged=only_flagged
    )


@router.get("/tasks/{question_id}")
async def get_question_detail(
    question_id: uuid.UUID, session: AsyncSession = Depends(get_async_session)
):
    service = HumanReviewService(session)
    try:
        return await service.get_question_review_detail(question_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/tasks/{question_id}/approve")
async def approve_question(
    question_id: uuid.UUID,
    req: ApproveQuestionRequest,
    session: AsyncSession = Depends(get_async_session),
):
    service = HumanReviewService(session)
    try:
        options_dicts = (
            [opt.model_dump() for opt in req.updated_options]
            if req.updated_options
            else None
        )
        question = await service.update_and_approve_question(
            question_id=question_id,
            updated_passage_text=req.updated_passage_text,
            updated_question_text=req.updated_question_text,
            updated_options=options_dicts,
            correct_option_label=req.correct_option_label,
            reviewer_notes=req.reviewer_notes,
        )
        return {
            "message": f"Question {question.question_number_in_paper} approved and published.",
            "question_id": str(question.id),
            "status": question.status.value,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


class RejectQuestionRequest(BaseModel):
    rejection_reason: str
    reviewer_notes: Optional[str] = None


class UpdateExplanationRequest(BaseModel):
    core_concept: Optional[str] = None
    detailed_solution: Optional[str] = None
    common_traps: Optional[List[str]] = None
    key_takeaways: Optional[List[str]] = None
    language: str = "ENGLISH"


@router.post("/tasks/{question_id}/reextract")
async def trigger_reextraction(
    question_id: uuid.UUID, session: AsyncSession = Depends(get_async_session)
):
    """Triggers sequential LLM re-extraction retry targeting the specific pages of the flawed question/passage."""
    service = HumanReviewService(session)
    try:
        return await service.trigger_llm_reextraction_for_question(question_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/tasks/{question_id}/reject")
async def reject_question(
    question_id: uuid.UUID,
    req: RejectQuestionRequest,
    session: AsyncSession = Depends(get_async_session),
):
    """Rejects/flags a question during QA review with a specific rejection reason."""
    service = HumanReviewService(session)
    try:
        q = await service.reject_question(
            question_id=question_id,
            rejection_reason=req.rejection_reason,
            reviewer_notes=req.reviewer_notes,
        )
        return {
            "message": f"Question #{q.question_number_in_paper} rejected.",
            "question_id": str(q.id),
            "status": q.status.value,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/tasks/{question_id}/update-explanation")
async def update_explanation(
    question_id: uuid.UUID,
    req: UpdateExplanationRequest,
    session: AsyncSession = Depends(get_async_session),
):
    """Allows QA reviewers to manually edit and save question explanations."""
    service = HumanReviewService(session)
    try:
        expl = await service.update_question_explanation(
            question_id=question_id,
            core_concept=req.core_concept,
            detailed_solution=req.detailed_solution,
            common_traps=req.common_traps,
            key_takeaways=req.key_takeaways,
            language=req.language,
        )
        return {
            "message": "Question explanation updated successfully by QA reviewer.",
            "question_id": str(question_id),
            "explanation_id": str(expl.id),
            "language": expl.language.value if hasattr(expl.language, "value") else str(expl.language),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
