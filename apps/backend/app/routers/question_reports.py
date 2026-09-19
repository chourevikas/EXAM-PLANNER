from datetime import datetime, timezone
from typing import Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.deps import get_current_user, require_admin_section
from app.db.models.enums import LanguageCode, QuestionStatus
from app.db.models.hierarchy import Exam
from app.db.models.question import Question, QuestionTranslation
from app.db.models.question_report import QuestionReport
from app.db.models.user import User
from app.db.session import get_async_session

router = APIRouter(tags=["Question Reports"])

ReportReason = Literal[
    "WRONG_ANSWER",
    "WRONG_QUESTION",
    "OPTIONS_ISSUE",
    "WRONG_EXPLANATION",
    "TYPO",
    "DUPLICATE",
    "OTHER",
]

reports_admin = require_admin_section("admin.reported_questions")


class ReportCreate(BaseModel):
    reason: ReportReason
    description: Optional[str] = Field(default=None, max_length=2000)


class ActionPayload(BaseModel):
    note: Optional[str] = Field(default=None, max_length=2000)


def _clean(text: Optional[str]) -> Optional[str]:
    text = (text or "").strip()
    return text or None


# ── Student ──────────────────────────────────────────────────────────────────

@router.post("/questions/{question_id}/report", status_code=status.HTTP_201_CREATED)
async def report_question(
    question_id: int,
    payload: ReportCreate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    if payload.reason == "OTHER" and not _clean(payload.description):
        raise HTTPException(status_code=422, detail="Please describe the problem when choosing 'Other'.")

    question = await session.get(Question, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found.")

    already = (
        await session.exec(
            select(QuestionReport.id).where(
                QuestionReport.question_id == question_id,
                QuestionReport.reporter_id == current_user.id,
                QuestionReport.status == "OPEN",
            )
        )
    ).first()
    if already:
        raise HTTPException(status_code=409, detail="You have already reported this question. We'll review it soon.")

    report = QuestionReport(
        question_id=question_id,
        reporter_id=current_user.id,
        reason=payload.reason,
        description=_clean(payload.description),
    )
    session.add(report)
    await session.commit()
    await session.refresh(report)

    from app.cache import get_cache
    await get_cache().delete_pattern("ep:admin:overview_stats*")
    return {"id": report.id, "status": report.status}


# ── Admin ────────────────────────────────────────────────────────────────────

@router.get("/admin/reported-questions/summary")
async def reported_questions_summary(
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(reports_admin),
):
    open_reports = (
        await session.exec(select(func.count(QuestionReport.id)).where(QuestionReport.status == "OPEN"))
    ).one() or 0
    open_questions = (
        await session.exec(
            select(func.count(func.distinct(QuestionReport.question_id))).where(QuestionReport.status == "OPEN")
        )
    ).one() or 0
    return {"open_reports": open_reports, "open_questions": open_questions}


@router.get("/admin/reported-questions")
async def list_reported_questions(
    report_status: Literal["OPEN", "RESOLVED", "REJECTED", "ALL"] = Query(default="OPEN", alias="status"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(reports_admin),
):
    stmt = select(QuestionReport, User.full_name).join(User, User.id == QuestionReport.reporter_id)
    if report_status != "ALL":
        stmt = stmt.where(QuestionReport.status == report_status)
    rows = (await session.exec(stmt.order_by(QuestionReport.created_at.desc()).limit(2000))).all()

    grouped: Dict[int, dict] = {}
    for report, reporter_name in rows:
        g = grouped.setdefault(
            report.question_id,
            {"question_id": report.question_id, "latest_report_at": report.created_at, "reports": [], "reasons": {}},
        )
        g["reports"].append(
            {
                "id": report.id,
                "reporter_name": reporter_name,
                "reason": report.reason,
                "description": report.description,
                "status": report.status,
                "admin_note": report.admin_note,
                "created_at": report.created_at,
                "resolved_at": report.resolved_at,
            }
        )
        g["reasons"][report.reason] = g["reasons"].get(report.reason, 0) + 1

    items = list(grouped.values())  # already newest-first
    total = len(items)
    page_items = items[(page - 1) * limit : page * limit]

    ids = [g["question_id"] for g in page_items]
    info: Dict[int, dict] = {}
    if ids:
        q_rows = (
            await session.exec(
                select(Question.id, Question.status, Question.question_number_in_paper, Question.exam_id, Exam.name)
                .join(Exam, Exam.id == Question.exam_id, isouter=True)
                .where(Question.id.in_(ids))
            )
        ).all()
        for qid, qstatus, qnum, exam_id, exam_name in q_rows:
            info[qid] = {
                "question_status": qstatus.value if hasattr(qstatus, "value") else str(qstatus),
                "question_number": qnum,
                "exam_id": exam_id,
                "exam_name": exam_name,
            }
        texts = (
            await session.exec(
                select(QuestionTranslation.question_id, QuestionTranslation.question_text).where(
                    QuestionTranslation.question_id.in_(ids), QuestionTranslation.language == LanguageCode.ENGLISH
                )
            )
        ).all()
        for qid, text in texts:
            info.setdefault(qid, {})["question_text"] = text

    for g in page_items:
        g.update(info.get(g["question_id"], {}))
        g["report_count"] = len(g["reports"])

    return {"items": page_items, "total": total, "page": page, "limit": limit}


async def _close_reports(
    session: AsyncSession, question_id: int, new_status: str, note: Optional[str], admin: User
) -> int:
    reports = (
        await session.exec(
            select(QuestionReport).where(QuestionReport.question_id == question_id, QuestionReport.status == "OPEN")
        )
    ).all()
    if not reports:
        raise HTTPException(status_code=404, detail="No open reports for this question.")
    now = datetime.now(timezone.utc)
    for r in reports:
        r.status = new_status
        r.admin_note = _clean(note)
        r.resolved_by_id = admin.id
        r.resolved_at = now
        session.add(r)
    return len(reports)


@router.post("/admin/reported-questions/{question_id}/reject")
async def reject_reports(
    question_id: int,
    payload: ActionPayload,
    session: AsyncSession = Depends(get_async_session),
    admin: User = Depends(reports_admin),
):
    """Dismiss the reports: the question is fine as it is and stays published."""
    count = await _close_reports(session, question_id, "REJECTED", payload.note, admin)
    await session.commit()
    return {"closed": count, "status": "REJECTED"}


@router.post("/admin/reported-questions/{question_id}/resolve")
async def resolve_reports(
    question_id: int,
    payload: ActionPayload,
    session: AsyncSession = Depends(get_async_session),
    admin: User = Depends(reports_admin),
):
    """Mark the reports as fixed (typically after editing the question)."""
    count = await _close_reports(session, question_id, "RESOLVED", payload.note, admin)
    await session.commit()
    return {"closed": count, "status": "RESOLVED"}


@router.post("/admin/reported-questions/{question_id}/unpublish")
async def unpublish_reported_question(
    question_id: int,
    payload: ActionPayload,
    session: AsyncSession = Depends(get_async_session),
    admin: User = Depends(reports_admin),
):
    """Pull the question from students and close its open reports.

    Uses the existing REJECTED state: it is hidden from every student-facing query, and stays visible
    in Question & Solution QA, where saving an edit re-verifies and republishes it.
    """
    question = await session.get(Question, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found.")
    question.status = QuestionStatus.REJECTED
    session.add(question)
    note = _clean(payload.note) or "Question unpublished pending correction."
    closed = await _close_reports(session, question_id, "RESOLVED", note, admin)
    await session.commit()

    from app.cache import invalidate_question_cache, invalidate_exam_cache
    from app.services.question_service import QuestionService

    await QuestionService(session)._recalculate_exam_metrics(question.exam_id)
    await invalidate_question_cache(str(question_id), str(question.exam_id) if question.exam_id else None)
    if question.exam_id:
        await invalidate_exam_cache(str(question.exam_id))
    return {"closed": closed, "question_status": QuestionStatus.REJECTED.value}
