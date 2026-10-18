"""Revision from spaced-repetition due dates.

After each test the analysis pipeline schedules every answered question (user_memory_states) and its
subtopic (user_concept_retention) for review. This turns those dates into something the student sees:
what is due, a practice session of the due questions, and a once-a-day in-app reminder. Answering a
question on the practice page reschedules it with the same rule the pipeline uses.
"""
from datetime import datetime, time, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlmodel import col, func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config.logger import setup_logger
from app.db.models.analytics import UserMemoryState
from app.db.models.enums import QuestionStatus
from app.db.models.hierarchy import Subtopic
from app.db.models.notification import UserNotification
from app.db.models.question import Question
from app.db.models.telemetry import UserConceptRetention
from app.db.models.user import User, UserRole, UserStatus
from app.services.free_plan import IST

logger = setup_logger("Revision")

REMINDER_TYPE = "REVISION_DUE"
REMINDER_HOUR_IST = 7  # morning reminder


def end_of_today(now: datetime) -> datetime:
    """Midnight at the end of today (IST), as UTC: anything scheduled before it is due today."""
    day = now.astimezone(IST).date() + timedelta(days=1)
    return datetime.combine(day, time.min, tzinfo=IST).astimezone(timezone.utc)


def next_schedule(previous: Optional[Tuple[float, float]], is_correct: bool) -> Tuple[float, float, float, int]:
    """(difficulty, stability, retrievability, days until the next review) after an answer.

    Same rule as the post-test pipeline: a right answer stretches the interval, a wrong one shrinks it.
    `previous` is (difficulty, stability) of the question's current state, or None for a first answer.
    """
    if previous is None:
        diff, stab, ret = (3.5, 3.0, 1.0) if is_correct else (5.0, 1.0, 0.4)
    else:
        diff0, stab0 = previous
        if is_correct:
            diff, stab, ret = max(1.0, round(diff0 - 0.2, 2)), round(stab0 * 1.5, 2), 1.0
        else:
            diff, stab, ret = min(10.0, round(diff0 + 0.5, 2)), max(0.5, round(stab0 * 0.6, 2)), 0.4
    return diff, stab, ret, max(1, int(stab))


async def record_answer(session: AsyncSession, user_id: int, question: Question, is_correct: bool,
                        now: Optional[datetime] = None) -> None:
    """Reschedules the question (and its subtopic) after a practice answer. The caller commits."""
    now = now or datetime.now(timezone.utc)
    mem = (await session.exec(
        select(UserMemoryState).where(UserMemoryState.user_id == user_id, UserMemoryState.question_id == question.id)
    )).first()
    diff, stab, ret, days = next_schedule((mem.fsrs_difficulty, mem.fsrs_stability) if mem else None, is_correct)
    due = now + timedelta(days=days)
    if mem is None:
        mem = UserMemoryState(user_id=user_id, question_id=question.id, subtopic_id=question.subtopic_id)
    mem.fsrs_difficulty, mem.fsrs_stability, mem.retrievability = diff, stab, ret
    mem.last_reviewed_at, mem.next_scheduled_review = now, due
    session.add(mem)

    if question.subtopic_id:
        ret_row = (await session.exec(
            select(UserConceptRetention).where(
                UserConceptRetention.user_id == user_id, UserConceptRetention.subtopic_id == question.subtopic_id
            )
        )).first()
        if ret_row is None:
            ret_row = UserConceptRetention(user_id=user_id, subtopic_id=question.subtopic_id, total_reviews=0, lapses=0)
        ret_row.fsrs_difficulty, ret_row.fsrs_stability, ret_row.fsrs_retrievability = diff, stab, ret
        ret_row.total_reviews = (ret_row.total_reviews or 0) + 1
        if not is_correct:
            ret_row.lapses = (ret_row.lapses or 0) + 1
        ret_row.last_reviewed_at, ret_row.next_scheduled_review = now, due
        session.add(ret_row)


def _due_filter(user_id: int, until: datetime):
    return (
        UserMemoryState.user_id == user_id,
        col(UserMemoryState.question_id).is_not(None),
        col(UserMemoryState.next_scheduled_review) < until,
        col(Question.status) == QuestionStatus.PUBLISHED,
    )


async def due_summary(session: AsyncSession, user_id: int, now: Optional[datetime] = None) -> Dict[str, Any]:
    """How many questions are due today, which topics they're in, and when the next one falls due."""
    now = now or datetime.now(timezone.utc)
    until = end_of_today(now)
    due_count = (await session.exec(
        select(func.count(UserMemoryState.id))
        .join(Question, col(Question.id) == col(UserMemoryState.question_id))
        .where(*_due_filter(user_id, until))
    )).one()
    topics = [
        {"subtopic": name, "questions": int(n)}
        for name, n in (await session.exec(
            select(Subtopic.name, func.count(UserMemoryState.id))
            .join(Question, col(Question.id) == col(UserMemoryState.question_id))
            .join(Subtopic, col(Subtopic.id) == col(Question.subtopic_id))
            .where(*_due_filter(user_id, until))
            .group_by(Subtopic.name)
            .order_by(func.count(UserMemoryState.id).desc())
            .limit(5)
        )).all()
    ]
    upcoming = (await session.exec(
        select(func.min(UserMemoryState.next_scheduled_review))
        .where(UserMemoryState.user_id == user_id, col(UserMemoryState.next_scheduled_review) >= until)
    )).one()
    return {
        "due_today": int(due_count or 0),
        "topics": topics,
        "next_due_at": upcoming.isoformat() if upcoming else None,
    }


async def due_questions(session: AsyncSession, user_id: int, limit: int = 50, now: Optional[datetime] = None) -> List[Question]:
    """Questions due for revision today, most overdue first."""
    now = now or datetime.now(timezone.utc)
    return list((await session.exec(
        select(Question)
        .join(UserMemoryState, col(UserMemoryState.question_id) == col(Question.id))
        .where(*_due_filter(user_id, end_of_today(now)))
        .order_by(col(UserMemoryState.next_scheduled_review).asc())
        .limit(limit)
    )).all())


async def send_daily_reminders(session: AsyncSession, now: Optional[datetime] = None) -> int:
    """One in-app reminder per student per day when questions are due. Returns how many were sent."""
    now = now or datetime.now(timezone.utc)
    today_start = end_of_today(now) - timedelta(days=1)
    already = set((await session.exec(
        select(UserNotification.user_id).where(
            UserNotification.notification_type == REMINDER_TYPE, col(UserNotification.created_at) >= today_start
        )
    )).all())
    students = (await session.exec(
        select(User.id).where(User.role == UserRole.STUDENT, User.status == UserStatus.ACTIVE)
    )).all()
    sent = 0
    for user_id in students:
        if user_id in already:
            continue
        summary = await due_summary(session, user_id, now)
        n = summary["due_today"]
        if not n:
            continue
        names = [t["subtopic"] for t in summary["topics"][:3]]
        topics = f" in {', '.join(names)}" if names else ""
        session.add(UserNotification(
            user_id=user_id,
            title=f"{n} question{'s' if n != 1 else ''} due for revision today",
            message=f"Revise them now{topics} to keep them in memory.",
            notification_type=REMINDER_TYPE,
            action_url="/practice-exam?source=revision",
        ))
        sent += 1
    if sent:
        await session.commit()
        logger.info(f"Revision reminders sent: {sent}")
    return sent


async def run_daily_reminders(now: Optional[datetime] = None) -> int:
    """Called hourly; sends in the morning hour (IST). Safe to call repeatedly: once per student per day."""
    now = now or datetime.now(timezone.utc)
    if now.astimezone(IST).hour != REMINDER_HOUR_IST:
        return 0
    from app.db.session import async_session_factory

    async with async_session_factory() as session:
        return await send_daily_reminders(session, now)
