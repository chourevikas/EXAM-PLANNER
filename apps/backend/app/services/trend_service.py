"""Speed and negative-marking trends across a student's completed tests (Analytics page)."""
from typing import Any, Dict, List

from sqlalchemy import case, func
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models.analytics import ExamAttempt, ExamQuestionResponse
from app.db.models.enums import AttemptStatus
from app.db.models.hierarchy import Exam

_DONE = [AttemptStatus.SUBMITTED, AttemptStatus.EVALUATED]


def _mean(values: List[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _avg(values: List[float]) -> float:
    return round(_mean(values), 1)


async def speed_and_negative_marking(session: AsyncSession, user_id: int, limit: int = 20) -> Dict[str, Any]:
    """Per completed test (oldest first, the last `limit`): seconds per answered question, marks lost to
    wrong answers (each paper's own penalty, from the stored scores), wrong answers and accuracy."""
    attempts = list((await session.exec(
        select(ExamAttempt, Exam.name)
        .join(Exam, col(Exam.id) == col(ExamAttempt.exam_id))
        .where(ExamAttempt.user_id == user_id, col(ExamAttempt.status).in_(_DONE), col(ExamAttempt.submitted_at).is_not(None))
        .order_by(col(ExamAttempt.submitted_at).desc())
        .limit(limit)
    )).all())
    attempts.reverse()
    if not attempts:
        return {"tests": [], "summary": None}

    ids = [a.id for a, _ in attempts]
    per_attempt = {
        attempt_id: (int(answered or 0), float(seconds or 0.0), float(lost or 0.0))
        for attempt_id, answered, seconds, lost in (await session.exec(
            select(
                ExamQuestionResponse.attempt_id,
                func.count(ExamQuestionResponse.id),
                func.coalesce(func.sum(ExamQuestionResponse.time_taken_seconds), 0.0),
                func.coalesce(func.sum(case((col(ExamQuestionResponse.final_score) < 0, -col(ExamQuestionResponse.final_score)), else_=0.0)), 0.0),
            )
            .where(col(ExamQuestionResponse.attempt_id).in_(ids), col(ExamQuestionResponse.selected_option_id).is_not(None))
            .group_by(ExamQuestionResponse.attempt_id)
        )).all()
    }

    tests: List[Dict[str, Any]] = []
    for attempt, exam_name in attempts:
        answered, seconds, lost = per_attempt.get(attempt.id, (0, 0.0, 0.0))
        attempted = int(attempt.total_correct or 0) + int(attempt.total_incorrect or 0)
        if not answered and attempted:
            # Older attempts without per-answer rows: fall back to the attempt totals
            answered, seconds = attempted, float(attempt.time_spent_seconds or 0.0)
            lost = round(float(attempt.total_incorrect or 0) * 2.0 / 3.0, 2)
        tests.append({
            "attempt_id": attempt.id,
            "exam": exam_name,
            "date": attempt.submitted_at.isoformat(),
            "answered": answered,
            "seconds_per_question": round(seconds / answered, 1) if answered else None,
            "negative_marks": round(lost, 2),
            "wrong": int(attempt.total_incorrect or 0),
            "accuracy": round(int(attempt.total_correct or 0) * 100 / attempted) if attempted else None,
        })

    speeds = [t["seconds_per_question"] for t in tests if t["seconds_per_question"] is not None]
    negatives = [t["negative_marks"] for t in tests]
    half = len(tests) // 2
    summary = {
        "tests": len(tests),
        "average_seconds_per_question": _avg(speeds),
        "average_negative_marks": round(_mean(negatives), 2),
        "total_negative_marks": round(sum(negatives), 2),
    }
    # Earlier half vs recent half, once there are enough tests to compare
    if half >= 2:
        early, recent = tests[:half], tests[-half:]
        summary["speed_change"] = round(
            _avg([t["seconds_per_question"] for t in recent if t["seconds_per_question"] is not None])
            - _avg([t["seconds_per_question"] for t in early if t["seconds_per_question"] is not None]), 1)
        summary["negative_marks_change"] = round(_mean([t["negative_marks"] for t in recent]) - _mean([t["negative_marks"] for t in early]), 2)
    return {"tests": tests, "summary": summary}
