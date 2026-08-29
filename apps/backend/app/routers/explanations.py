from typing import Optional, List
from fastapi import APIRouter, Depends, Query, BackgroundTasks
from sqlmodel.ext.asyncio.session import AsyncSession
from pydantic import BaseModel, Field

from app.db.session import get_async_session
from app.services.explanation_service import ExplanationService

router = APIRouter(prefix="/explanations", tags=["Question Explanations & Knowledge Base"])


class GenerateExplanationsRequest(BaseModel):
    question_ids: Optional[List[int | str]] = Field(
        default=None, description="Optional list of specific Question IDs to process"
    )
    language: str = Field(
        default="ENGLISH", description="Language code e.g. ENGLISH, HINDI"
    )
    run_mode: str = Field(
        default="auto", description="Execution mode: auto, celery, or background"
    )


class SetCanonicalLinkRequest(BaseModel):
    canonical_question_id: int | str = Field(
        description="Target primary canonical question ID"
    )


@router.post("/exams/{exam_id}/generate-explanations")
async def generate_explanations_for_exam(
    exam_id: int,
    req: GenerateExplanationsRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_async_session),
):
    """Triggers Phase 3 Explanation & Knowledge Base pipeline for an exam."""
    service = ExplanationService(session)
    return await service.generate_explanations_for_exam(
        exam_id,
        question_ids=req.question_ids,
        language=req.language,
        run_mode=req.run_mode,
        background_tasks=background_tasks,
    )


@router.get("/questions/{question_id}")
async def get_question_explanation(
    question_id: int,
    language: str = Query("ENGLISH", description="Language code e.g. ENGLISH"),
    session: AsyncSession = Depends(get_async_session),
):
    """Retrieves static question knowledge base and per-option distractor analysis for user reports."""
    service = ExplanationService(session)
    return await service.get_question_explanation_report(question_id, language=language)


@router.put("/questions/{question_id}/canonical-link")
async def set_canonical_question_link(
    question_id: int,
    req: SetCanonicalLinkRequest,
    session: AsyncSession = Depends(get_async_session),
):
    """Links a question row to a primary canonical question row across languages or paper sets."""
    service = ExplanationService(session)
    canonical_id = int(req.canonical_question_id)
    return await service.set_canonical_question_link(question_id, canonical_id)


@router.get("/status/{task_id}")
async def get_explanation_task_status(task_id: str):
    """Task queue monitoring endpoint for checking Celery/BackgroundTask progress."""
    from celery.result import AsyncResult
    res = AsyncResult(task_id)
    return {
        "task_id": task_id,
        "status": res.status,
        "ready": res.ready(),
        "successful": res.successful() if res.ready() else False,
        "result": res.result if res.ready() else None,
    }
