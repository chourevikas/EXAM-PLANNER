"""Mistake notebook: the questions a student got wrong, in tests and on the practice page.

Every answer the student gave (submitted tests and practice) is merged per question: how many times it was
answered wrong, when last, and whether their latest answer is now right ("fixed"). Unanswered questions
are not mistakes. Answers in a test that is still in progress don't count until it is submitted.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import Integer, and_, case, cast, func, union_all
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models.analytics import ExamAttempt, ExamQuestionResponse, PracticeAnswer
from app.db.models.enums import AttemptStatus, QuestionStatus
from app.db.models.hierarchy import Subject, Subtopic, Topic
from app.db.models.question import Question

FREQUENT_MIN_WRONG = 2  # "frequently wrong": missed this many times or more


def answers_subquery(user_id: Optional[int] = None, since: Optional[datetime] = None):
    """One row per answer: user_id, question_id, is_correct (0/1), answered_at. Tests and practice combined."""
    exam_at = func.coalesce(
        col(ExamQuestionResponse.answered_at), col(ExamAttempt.submitted_at), col(ExamAttempt.started_at)
    )
    exam_q = (
        select(
            col(ExamAttempt.user_id).label("user_id"),
            col(ExamQuestionResponse.question_id).label("question_id"),
            cast(col(ExamQuestionResponse.is_correct), Integer).label("is_correct"),
            exam_at.label("answered_at"),
        )
        .join(ExamAttempt, col(ExamAttempt.id) == col(ExamQuestionResponse.attempt_id))
        .where(
            col(ExamQuestionResponse.selected_option_id).is_not(None),
            col(ExamAttempt.status).in_([AttemptStatus.SUBMITTED, AttemptStatus.EVALUATED]),
        )
    )
    practice_q = select(
        col(PracticeAnswer.user_id).label("user_id"),
        col(PracticeAnswer.question_id).label("question_id"),
        cast(col(PracticeAnswer.is_correct), Integer).label("is_correct"),
        col(PracticeAnswer.answered_at).label("answered_at"),
    ).where(col(PracticeAnswer.selected_option_id).is_not(None))
    if user_id is not None:
        exam_q = exam_q.where(col(ExamAttempt.user_id) == user_id)
        practice_q = practice_q.where(col(PracticeAnswer.user_id) == user_id)
    if since is not None:
        exam_q = exam_q.where(exam_at >= since)
        practice_q = practice_q.where(col(PracticeAnswer.answered_at) >= since)
    return union_all(exam_q, practice_q).subquery("answers")


def _mistakes_query(user_id: int, frequent_only: bool, include_fixed: bool, subject: Optional[str]):
    """Per wrongly-answered question: wrong count, answer count, last wrong time and whether the latest answer is right."""
    a = answers_subquery(user_id)
    per_q = (
        select(
            a.c.question_id,
            func.sum(1 - a.c.is_correct).label("wrong_count"),
            func.count().label("answer_count"),
            func.max(case((a.c.is_correct == 0, a.c.answered_at))).label("last_wrong_at"),
            func.max(a.c.answered_at).label("last_answered_at"),
        )
        .group_by(a.c.question_id)
        .having(func.sum(1 - a.c.is_correct) >= (FREQUENT_MIN_WRONG if frequent_only else 1))
        .subquery("per_q")
    )
    # The latest answer is right when the last wrong answer is older than the last answer of any kind
    fixed = per_q.c.last_answered_at > per_q.c.last_wrong_at
    stmt = (
        select(Question, per_q.c.wrong_count, per_q.c.answer_count, per_q.c.last_wrong_at, fixed.label("fixed"),
               Subject.name.label("subject_name"))
        .join(per_q, per_q.c.question_id == col(Question.id))
        .outerjoin(Subtopic, col(Subtopic.id) == col(Question.subtopic_id))
        .outerjoin(Topic, col(Topic.id) == col(Subtopic.topic_id))
        .outerjoin(Subject, col(Subject.id) == col(Topic.subject_id))
        .where(col(Question.status) == QuestionStatus.PUBLISHED)
    )
    if not include_fixed:
        stmt = stmt.where(~fixed)
    if subject:
        stmt = stmt.where(col(Subject.name) == subject)
    return stmt, per_q, fixed


async def list_mistakes(
    session: AsyncSession,
    user_id: int,
    frequent_only: bool = False,
    include_fixed: bool = False,
    subject: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
) -> Dict[str, Any]:
    """A page of the student's mistakes, most-missed first (then most recent), plus counts for the tabs."""
    stmt, per_q, _ = _mistakes_query(user_id, frequent_only, include_fixed, subject)
    total = (await session.exec(select(func.count()).select_from(stmt.subquery()))).one()
    rows = (await session.exec(
        stmt.order_by(per_q.c.wrong_count.desc(), per_q.c.last_wrong_at.desc(), col(Question.id).desc())
        .offset(skip).limit(limit)
    )).all()

    # Tab counts and the subject filter list are over open mistakes (not fixed), whatever the current filter
    open_sub = _mistakes_query(user_id, False, False, None)[0].subquery()
    open_rows = (await session.exec(select(open_sub.c.wrong_count, open_sub.c.subject_name))).all()
    counts = {
        "open": len(open_rows),
        "frequent": sum(1 for w, _ in open_rows if (w or 0) >= FREQUENT_MIN_WRONG),
    }
    subjects = sorted({s for _, s in open_rows if s})

    return {"rows": rows, "total": int(total or 0), "counts": counts, "subjects": subjects}


async def mistake_questions(session: AsyncSession, user_id: int, frequent_only: bool = False,
                            subject: Optional[str] = None, limit: int = 100) -> List[Question]:
    """Open mistakes as questions for a practice session, most-missed first."""
    stmt, per_q, _ = _mistakes_query(user_id, frequent_only, False, subject)
    rows = (await session.exec(
        stmt.order_by(per_q.c.wrong_count.desc(), per_q.c.last_wrong_at.desc(), col(Question.id).desc()).limit(limit)
    )).all()
    return [r[0] for r in rows]


async def weakest_subtopics(session: AsyncSession, since: datetime, min_answers: int = 5,
                            max_accuracy: float = 0.6) -> Dict[int, Dict[str, Any]]:
    """Each student's lowest-accuracy subtopic (below max_accuracy, at least min_answers answers) since a date."""
    a = answers_subquery(since=since)
    acc = (func.sum(a.c.is_correct) * 1.0 / func.count())
    rows = (await session.exec(
        select(a.c.user_id, col(Question.subtopic_id), acc.label("accuracy"), func.count().label("answers"))
        .join(Question, col(Question.id) == a.c.question_id)
        .where(col(Question.subtopic_id).is_not(None))
        .group_by(a.c.user_id, col(Question.subtopic_id))
        .having(and_(func.count() >= min_answers, acc < max_accuracy))
    )).all()
    weakest: Dict[int, Dict[str, Any]] = {}
    for user_id, subtopic_id, accuracy, answers in rows:
        best = weakest.get(user_id)
        if best is None or (accuracy, -answers) < (best["accuracy"], -best["answers"]):
            weakest[user_id] = {"subtopic_id": subtopic_id, "accuracy": float(accuracy), "answers": int(answers)}
    return weakest
