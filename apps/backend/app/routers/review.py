import uuid
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_async_session
from app.hitl.review_service import HumanReviewService


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
