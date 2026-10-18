"""Admin: an exam's marking scheme (marks for a correct answer, marks deducted for a wrong one)."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import update
from sqlmodel import col, func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.deps import require_admin_section
from app.db.models.hierarchy import Exam
from app.db.models.question import Question
from app.db.models.exam_type import ExamType
from app.db.models.user import User
from app.db.session import get_async_session
from app.services.scoring import exam_marking_scheme, validate_marking_scheme

router = APIRouter(prefix="/admin/exams/{exam_id}/marking-scheme", tags=["Admin: Marking scheme"])
# The upload and question-review screens both show it
admin_only = require_admin_section("admin.upload", "admin.review")


class MarkingSchemeIn(BaseModel):
    marks_per_question: float
    negative_marks_per_question: float


async def _scheme(session: AsyncSession, exam: Exam) -> dict:
    exam_type = await session.get(ExamType, exam.exam_type_id) if exam.exam_type_id else None
    marks, negative = exam_marking_scheme(exam, exam_type)
    questions = (await session.exec(select(func.count(Question.id)).where(Question.exam_id == exam.id))).one()
    return {
        "exam_id": exam.id,
        "marks_per_question": marks,
        "negative_marks_per_question": negative,
        "total_marks": exam.total_marks,
        "questions": int(questions or 0),
        "is_set": exam.marks_per_question is not None,
    }


@router.get("", summary="An exam's marking scheme")
async def get_marking_scheme(
    exam_id: int,
    _admin: User = Depends(admin_only),
    session: AsyncSession = Depends(get_async_session),
):
    exam = await session.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    return await _scheme(session, exam)


@router.put("", summary="Change an exam's marking scheme (applies to tests taken from now on)")
async def set_marking_scheme(
    exam_id: int,
    body: MarkingSchemeIn,
    _admin: User = Depends(admin_only),
    session: AsyncSession = Depends(get_async_session),
):
    """Updates the exam and all its questions. Tests already taken keep the scores they got."""
    error = validate_marking_scheme(body.marks_per_question, body.negative_marks_per_question)
    if error:
        raise HTTPException(status_code=422, detail=error)
    exam = await session.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    exam.marks_per_question = float(body.marks_per_question)
    exam.negative_marks_per_question = float(body.negative_marks_per_question)
    if exam.total_questions:
        exam.total_marks = round(exam.total_questions * exam.marks_per_question, 2)
    session.add(exam)
    await session.exec(
        update(Question)
        .where(col(Question.exam_id) == exam.id)
        .values(marks=exam.marks_per_question, negative_marks=exam.negative_marks_per_question)
        .execution_options(synchronize_session=False)
    )
    await session.commit()
    await session.refresh(exam)

    # Cached papers and answer keys carry the old marks
    from app.cache import invalidate_exam_cache
    from app.engine.post_submission_pipeline import EXAM_SOLUTIONS_SLIDING_CACHE

    await invalidate_exam_cache(str(exam.id))
    for key in (str(exam.id), exam.code):
        EXAM_SOLUTIONS_SLIDING_CACHE.pop(key, None)
    return await _scheme(session, exam)
