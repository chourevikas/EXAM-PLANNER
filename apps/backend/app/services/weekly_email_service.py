"""Weekly summary email, sent on the day and hour each student chose (their timezone).

An hourly loop finds students whose slot is now, claims each one with an atomic update of
weekly_email_last_sent_at (so several workers never send twice), builds a 7-day summary and emails it.
Every email has a signed one-click unsubscribe link.
"""
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

import jwt
from sqlalchemy import update
from sqlmodel import case, col, func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config.logger import setup_logger
from app.config.settings import settings
from app.db.models.analytics import ExamAttempt, ExamQuestionResponse, PracticeAnswer
from app.db.models.enums import AttemptStatus
from app.db.models.gamification import Badge, LeaderboardSnapshot, UserBadge, XPLog
from app.db.models.user import StudentProfile, User, UserRole, UserStatus

logger = setup_logger("WeeklyEmail")

UNSUBSCRIBE_PURPOSE = "weekly_email_unsubscribe"
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
_DONE = [AttemptStatus.SUBMITTED, AttemptStatus.EVALUATED]


def unsubscribe_token(user_id: int) -> str:
    return jwt.encode({"sub": str(user_id), "purpose": UNSUBSCRIBE_PURPOSE}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def user_id_from_unsubscribe_token(token: str) -> Optional[int]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.PyJWTError:
        return None
    if payload.get("purpose") != UNSUBSCRIBE_PURPOSE:
        return None
    try:
        return int(payload.get("sub"))
    except (TypeError, ValueError):
        return None


def _local_now(user: User, now: datetime) -> datetime:
    try:
        tz = ZoneInfo(user.timezone or "Asia/Kolkata")
    except Exception:
        tz = ZoneInfo("Asia/Kolkata")
    return now.astimezone(tz)


async def weekly_summary(session: AsyncSession, user_id: int, now: Optional[datetime] = None) -> Dict[str, Any]:
    """The student's last 7 days: questions, accuracy, tests, XP, streak, new milestones and rank."""
    now = now or datetime.now(timezone.utc)
    since = now - timedelta(days=7)

    t_answered, t_correct = (await session.exec(
        select(
            func.count(ExamQuestionResponse.id),
            func.coalesce(func.sum(case((col(ExamQuestionResponse.is_correct).is_(True), 1), else_=0)), 0),
        )
        .join(ExamAttempt, col(ExamQuestionResponse.attempt_id) == col(ExamAttempt.id))
        .where(ExamAttempt.user_id == user_id, col(ExamQuestionResponse.answered_at) >= since)
    )).one()
    p_answered, p_correct = (await session.exec(
        select(
            func.count(PracticeAnswer.id),
            func.coalesce(func.sum(case((col(PracticeAnswer.is_correct).is_(True), 1), else_=0)), 0),
        ).where(PracticeAnswer.user_id == user_id, col(PracticeAnswer.answered_at) >= since)
    )).one()
    tests = (await session.exec(
        select(func.count(ExamAttempt.id)).where(
            ExamAttempt.user_id == user_id, col(ExamAttempt.status).in_(_DONE), col(ExamAttempt.submitted_at) >= since
        )
    )).one()
    xp = (await session.exec(
        select(func.coalesce(func.sum(XPLog.amount), 0)).where(XPLog.user_id == user_id, col(XPLog.created_at) >= since)
    )).one()
    milestones = list((await session.exec(
        select(Badge.name).join(UserBadge, col(UserBadge.badge_id) == col(Badge.id))
        .where(UserBadge.user_id == user_id, col(UserBadge.unlocked_at) >= since)
    )).all())
    rank = (await session.exec(
        select(LeaderboardSnapshot.rank_national).where(LeaderboardSnapshot.user_id == user_id)
        .order_by(col(LeaderboardSnapshot.snapshot_date).desc()).limit(1)
    )).first()

    from app.services.milestone_service import _streak

    answered = int(t_answered or 0) + int(p_answered or 0)
    correct = int(t_correct or 0) + int(p_correct or 0)
    return {
        "questions": answered,
        "correct": correct,
        "accuracy": round(correct * 100 / answered) if answered else None,
        "tests": int(tests or 0),
        "xp": int(xp or 0),
        "streak": await _streak(session, user_id),
        "milestones": milestones,
        "national_rank": rank,
    }


async def run_weekly_email_dispatch(now: Optional[datetime] = None) -> int:
    """Sends the weekly email to every student whose chosen day and hour is now. Returns how many were sent."""
    from app.db.session import async_session_factory
    from app.services.email_service import send_weekly_summary_email

    now = now or datetime.now(timezone.utc)
    sent = 0
    async with async_session_factory() as session:
        candidates = (await session.exec(
            select(User, StudentProfile)
            .join(StudentProfile, col(StudentProfile.user_id) == col(User.id))
            .where(
                User.role == UserRole.STUDENT,
                User.status == UserStatus.ACTIVE,
                col(StudentProfile.weekly_email_enabled).is_(True),
            )
        )).all()
        due: List[User] = []
        for user, profile in candidates:
            local = _local_now(user, now)
            if local.weekday() == profile.weekly_email_day and local.hour == profile.weekly_email_hour:
                due.append(user)

        for user in due:
            # Claim the send: only one worker wins, and never twice within 6 days
            claimed = await session.exec(
                update(StudentProfile)
                .where(
                    StudentProfile.user_id == user.id,
                    (col(StudentProfile.weekly_email_last_sent_at).is_(None))
                    | (col(StudentProfile.weekly_email_last_sent_at) < now - timedelta(days=6)),
                )
                .values(weekly_email_last_sent_at=now)
                # the claim is decided by the database; don't re-evaluate it against loaded objects
                .execution_options(synchronize_session=False)
            )
            await session.commit()
            if not claimed.rowcount:
                continue
            try:
                summary = await weekly_summary(session, user.id, now)
                link = f"{settings.FRONTEND_URL}/api/v1/notifications/weekly-email/unsubscribe?token={unsubscribe_token(user.id)}"
                if await send_weekly_summary_email(user.email, user.full_name, summary, link):
                    sent += 1
            except Exception as err:
                logger.error(f"Weekly email failed for user {user.id}: {err}", exc_info=True)
    if sent:
        logger.info(f"📧 Weekly summary emails sent: {sent}")
    return sent


_task: Optional[asyncio.Task] = None


async def _hourly_loop() -> None:
    while True:
        try:
            now = datetime.now(timezone.utc)
            next_hour = (now + timedelta(hours=1)).replace(minute=1, second=0, microsecond=0)
            await asyncio.sleep(max(5.0, (next_hour - now).total_seconds()))
            await run_weekly_email_dispatch()
            # Morning revision reminders share this hourly tick (they send only in the 7 AM IST hour)
            from app.services.revision_service import run_daily_reminders
            await run_daily_reminders()
        except asyncio.CancelledError:
            break
        except Exception as err:
            logger.error(f"Weekly email loop error: {err}", exc_info=True)
            await asyncio.sleep(60)


def start_weekly_email_scheduler() -> None:
    global _task
    if _task is None or _task.done():
        _task = asyncio.create_task(_hourly_loop())


def stop_weekly_email_scheduler() -> None:
    global _task
    if _task and not _task.done():
        _task.cancel()
    _task = None
