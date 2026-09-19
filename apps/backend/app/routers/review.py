from typing import Optional, List, Union
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlmodel.ext.asyncio.session import AsyncSession
from app.db.session import get_async_session
from app.hitl.review_service import HumanReviewService

from app.db.models import LanguageCode, QuestionStatus
from app.core.languages import parse_language
from app.db.models.user import User, UserRole
from app.core.deps import require_admin_section_or_permission
from app.schemas.question import ExamReviewQuestionsResponse
from app.services.question_service import QuestionService


router = APIRouter(prefix="/admin/review", tags=["Admin QA Review"])

view_review = require_admin_section_or_permission("admin.review", "questions.review")
manage_review = require_admin_section_or_permission("admin.review", "questions.review.manage")


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
    exam_id: int | str,
    language: str = Query(default="en", description="Target Language"),
    status: Optional[QuestionStatus] = Query(default=None, description="Filter by Question status"),
    page: int = Query(default=1, ge=1, description="Page number"),
    limit: int = Query(default=10, ge=1, le=100, description="Items per page"),
    target_question_number: Optional[int] = Query(default=None, description="Jump to question number"),
    target_question_id: Optional[Union[str, int]] = Query(default=None, description="Jump to question ID"),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(view_review),
):
    """Admin review endpoint returning all questions with full solutions, option explanations, and review counters."""
    try:
        eid = int(exam_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Exam not found.")

    lang_code = parse_language(language)
    from app.cache import get_cache, build_cache_key
    cache = get_cache()
    is_targeted = bool(target_question_number or target_question_id)
    cache_key = None
    if not is_targeted:
        cache_key = build_cache_key(
            "admin:review",
            str(eid),
            page=page,
            limit=limit,
            lang=lang_code.value,
            status=str(status.value if hasattr(status, "value") else status) if status else None,
        )
        cached_data = await cache.get(cache_key)
        if cached_data is not None:
            return JSONResponse(content=cached_data)

    q_service = QuestionService(session)
    review_res = await q_service.get_exam_questions_for_review(
        exam_id=eid,
        page=page,
        limit=limit,
        language=lang_code,
        status=status,
        target_question_number=target_question_number,
        target_question_id=target_question_id,
    )
    if review_res is not None:
        serialized = review_res.model_dump(mode="json") if hasattr(review_res, "model_dump") else (review_res.dict() if hasattr(review_res, "dict") else review_res)
        if not is_targeted and cache_key:
            await cache.set(cache_key, serialized, ttl_seconds=1800)
        return JSONResponse(content=serialized)
    return JSONResponse(content={})


@router.get("/tasks")
async def get_pending_tasks(
    exam_id: Optional[int | str] = Query(default=None),
    only_flagged: bool = Query(default=False),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(view_review),
):
    parsed_exam_id = None
    if exam_id is not None:
        try:
            parsed_exam_id = int(exam_id)
        except (ValueError, TypeError):
            return JSONResponse(content=[])

    from app.cache import get_cache, build_cache_key
    cache = get_cache()
    cache_key = build_cache_key("hitl:tasks", exam_id=str(parsed_exam_id) if parsed_exam_id else None, flagged=only_flagged)
    cached_data = await cache.get(cache_key)
    if cached_data is not None:
        return JSONResponse(content=cached_data)

    from fastapi.encoders import jsonable_encoder
    service = HumanReviewService(session)
    tasks = await service.get_pending_review_tasks(
        exam_id=parsed_exam_id, only_flagged=only_flagged
    )
    if tasks is not None:
        serialized = jsonable_encoder(tasks)
        await cache.set(cache_key, serialized, ttl_seconds=1800)
        return JSONResponse(content=serialized)
    return JSONResponse(content=[])


@router.get("/tasks/{question_id}")
async def get_question_detail(
    question_id: int | str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(view_review),
):
    try:
        qid = int(question_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Question not found.")

    from app.cache import get_cache, build_cache_key
    cache = get_cache()
    cache_key = build_cache_key("hitl:task_detail", str(qid))
    cached_data = await cache.get(cache_key)
    if cached_data is not None:
        return JSONResponse(content=cached_data)

    service = HumanReviewService(session)
    try:
        detail = await service.get_question_review_detail(qid)
        if detail is not None:
            await cache.set(cache_key, detail, ttl_seconds=1800)
            return JSONResponse(content=detail)
        return JSONResponse(content={})
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/tasks/{question_id}/approve")
async def approve_question(
    question_id: int | str,
    req: ApproveQuestionRequest,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(manage_review),
):
    try:
        qid = int(question_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Question not found.")

    from app.cache import invalidate_question_cache, invalidate_exam_cache
    service = HumanReviewService(session)
    try:
        options_dicts = (
            [opt.model_dump() for opt in req.updated_options]
            if req.updated_options
            else None
        )
        question = await service.update_and_approve_question(
            question_id=qid,
            admin_id=current_user.id,
            updated_passage_text=req.updated_passage_text,
            updated_question_text=req.updated_question_text,
            updated_options=options_dicts,
            correct_option_label=req.correct_option_label,
            reviewer_notes=req.reviewer_notes,
        )
        await invalidate_question_cache(str(qid), str(question.exam_id) if question.exam_id else None)
        if question.exam_id:
            await invalidate_exam_cache(str(question.exam_id))
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
    question_id: int | str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(manage_review),
):
    """Triggers sequential LLM re-extraction retry targeting the specific pages of the flawed question/passage."""
    try:
        qid = int(question_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Question not found.")

    from app.cache import invalidate_question_cache
    service = HumanReviewService(session)
    try:
        res = await service.trigger_llm_reextraction_for_question(qid)
        await invalidate_question_cache(str(qid))
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/tasks/{question_id}/reject")
async def reject_question(
    question_id: int | str,
    req: RejectQuestionRequest,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(manage_review),
):
    """Rejects/flags a question during QA review with a specific rejection reason."""
    try:
        qid = int(question_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Question not found.")

    from app.cache import invalidate_question_cache
    service = HumanReviewService(session)
    try:
        q = await service.reject_question(
            question_id=qid,
            rejection_reason=req.rejection_reason,
            reviewer_notes=req.reviewer_notes,
            admin_id=current_user.id,
        )
        from app.cache import invalidate_question_cache, invalidate_exam_cache
        await invalidate_question_cache(str(qid), str(q.exam_id) if q.exam_id else None)
        if q.exam_id:
            await invalidate_exam_cache(str(q.exam_id))
        return {
            "message": f"Question #{q.question_number_in_paper} rejected.",
            "question_id": str(q.id),
            "status": q.status.value,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/tasks/{question_id}/update-explanation")
async def update_explanation(
    question_id: int | str,
    req: UpdateExplanationRequest,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(manage_review),
):
    """Allows QA reviewers to manually edit and save question explanations."""
    try:
        qid = int(question_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Question not found.")

    from app.cache import invalidate_question_cache
    service = HumanReviewService(session)
    try:
        expl = await service.update_question_explanation(
            question_id=qid,
            core_concept=req.core_concept,
            detailed_solution=req.detailed_solution,
            common_traps=req.common_traps,
            key_takeaways=req.key_takeaways,
            language=req.language,
        )
        await invalidate_question_cache(str(qid))
        return {
            "message": "Question explanation updated successfully by QA reviewer.",
            "question_id": str(qid),
            "explanation_id": str(expl.id),
            "language": expl.language.value if hasattr(expl.language, "value") else str(expl.language),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
