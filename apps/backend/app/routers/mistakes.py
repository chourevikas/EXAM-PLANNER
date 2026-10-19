"""The student's mistake notebook (Pro): questions answered wrong in tests and practice, and practice from them."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.deps import get_current_user
from app.core.languages import parse_language
from app.db.models.enums import LanguageCode
from app.db.models.hierarchy import Exam
from app.db.models.question import QuestionTranslation
from app.db.models.user import User
from app.db.session import get_async_session
from app.services import free_plan, mistake_service

router = APIRouter(prefix="/users/me/mistakes", tags=["Mistake notebook"])

MISTAKES_LOCKED_CODE = "PRO_MISTAKE_NOTEBOOK"


async def _require_pro(session: AsyncSession, user: User) -> None:
    if await free_plan.is_limited(session, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": MISTAKES_LOCKED_CODE, "message": "The mistake notebook is part of Pro."},
        )


@router.get("", summary="Questions the student answered wrong, most-missed first")
async def list_mistakes(
    view: str = Query(default="all", pattern="^(all|frequent)$", description="all, or frequent (missed 2+ times)"),
    subject: Optional[str] = Query(default=None, max_length=255),
    include_fixed: bool = Query(default=False, description="Also list questions whose latest answer is right"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    await _require_pro(session, current_user)
    page = await mistake_service.list_mistakes(
        session, current_user.id, frequent_only=view == "frequent", include_fixed=include_fixed,
        subject=subject or None, skip=skip, limit=limit,
    )
    questions = [r[0] for r in page["rows"]]
    q_ids = [q.id for q in questions]

    # English text where there is one, else the first language stored
    texts: dict = {}
    for qid, lang, text in (await session.exec(
        select(QuestionTranslation.question_id, QuestionTranslation.language, QuestionTranslation.question_text)
        .where(col(QuestionTranslation.question_id).in_(q_ids))
    )).all() if q_ids else []:
        if qid not in texts or lang == LanguageCode.ENGLISH:
            texts[qid] = text

    exam_ids = {q.exam_id for q in questions if q.exam_id}
    exams = {e.id: e for e in (await session.exec(select(Exam).where(col(Exam.id).in_(exam_ids)))).all()} if exam_ids else {}
    from app.services.exam_session_service import exam_badge_label, load_exam_type_codes
    type_codes = await load_exam_type_codes(session) if exams else set()

    items = []
    for q, wrong_count, answer_count, last_wrong_at, fixed, subject_name in page["rows"]:
        exam = exams.get(q.exam_id)
        year = q.source_year or (None if (exam is None or exam.is_mixed_bank) else exam.source_year)
        items.append({
            "question_id": str(q.id),
            "question_text": texts.get(q.id, ""),
            "subject": subject_name,
            "difficulty": q.difficulty.value if hasattr(q.difficulty, "value") else q.difficulty,
            "exam_name": exam_badge_label(exam.name or exam.code, type_codes) if exam else None,
            "source_year": year,
            "wrong_count": int(wrong_count or 0),
            "answer_count": int(answer_count or 0),
            "last_wrong_at": last_wrong_at.isoformat() if hasattr(last_wrong_at, "isoformat") else last_wrong_at,
            "fixed": bool(fixed),
        })
    return {
        "items": items,
        "total": page["total"],
        "counts": page["counts"],
        "subjects": page["subjects"],
        "frequent_min_wrong": mistake_service.FREQUENT_MIN_WRONG,
    }


@router.get("/practice", summary="Open mistakes with solutions, for a practice session")
async def mistakes_practice(
    language: str = Query(default="en", description="Session language: en, hi or mr"),
    view: str = Query(default="all", pattern="^(all|frequent)$"),
    subject: Optional[str] = Query(default=None, max_length=255),
    limit: int = Query(default=100, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Same item shape as GET /questions, most-missed first. Questions fixed since (latest answer right) are left out."""
    await _require_pro(session, current_user)
    from app.services.question_service import QuestionService

    questions = await mistake_service.mistake_questions(
        session, current_user.id, frequent_only=view == "frequent", subject=subject or None, limit=limit
    )
    items = await QuestionService(session)._build_batch_question_detail_responses(
        questions, target_lang=parse_language(language), include_solutions=True
    )
    return JSONResponse(content=jsonable_encoder({"items": items, "total": len(items)}))
