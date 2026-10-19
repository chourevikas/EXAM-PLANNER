"""Reminder preferences and the newer in-app reminders (weak topic, current affairs, weekly full paper).

Preferences live on StudentProfile (notify_*) and default to on; a student with no profile row gets every
reminder. Each reminder runs from the hourly scheduler tick, sends only in its own IST hour, and checks the
bell for one already sent in its window, so calling it again in the same hour sends nothing twice.
"""
from datetime import datetime, time, timedelta, timezone
from typing import Any, Dict, List, Optional, Set

from sqlalchemy import or_
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config.logger import setup_logger
from app.db.models.analytics import ExamAttempt
from app.db.models.current_affairs import CurrentAffair
from app.db.models.enums import ExamStatus, QuestionSourceType
from app.db.models.hierarchy import Exam, Subject, Subtopic, Topic
from app.db.models.notification import UserNotification
from app.db.models.user import StudentProfile, User, UserRole, UserStatus
from app.services.free_plan import IST

logger = setup_logger("ReminderService")

WEAK_TOPIC_TYPE = "WEAK_TOPIC"
CURRENT_AFFAIRS_TYPE = "CURRENT_AFFAIRS"
FULL_PAPER_TYPE = "FULL_PAPER"

WEAK_TOPIC_WEEKDAY, WEAK_TOPIC_HOUR = 0, 8  # Monday 8 AM IST
CURRENT_AFFAIRS_HOUR = 18  # 6 PM IST, daily
FULL_PAPER_HOUR = 9  # 9 AM IST on the student's chosen day

# Settings a student can change (GET/PUT /notifications/settings), with their defaults
SETTING_DEFAULTS: Dict[str, Any] = {
    "notify_revision": True,
    "notify_pending_tasks": True,
    "notify_task_email": True,
    "notify_weak_topic": True,
    "notify_current_affairs": True,
    "notify_full_paper": True,
    "notify_full_paper_day": 6,
    "weekly_email_enabled": False,
    "weekly_email_day": 6,
    "weekly_email_hour": 18,
}


async def opted_out(session: AsyncSession, field: str) -> Set[int]:
    """Ids of students who turned this reminder off."""
    column = getattr(StudentProfile, field)
    return set((await session.exec(select(StudentProfile.user_id).where(col(column).is_(False)))).all())


async def get_settings(session: AsyncSession, user_id: int) -> Dict[str, Any]:
    profile = await session.get(StudentProfile, user_id)
    return {k: (getattr(profile, k) if profile is not None else v) for k, v in SETTING_DEFAULTS.items()}


async def update_settings(session: AsyncSession, user_id: int, changes: Dict[str, Any]) -> Dict[str, Any]:
    profile = await session.get(StudentProfile, user_id)
    if profile is None:
        profile = StudentProfile(user_id=user_id)
    for key, value in changes.items():
        if key in SETTING_DEFAULTS and value is not None:
            setattr(profile, key, value)
    session.add(profile)
    await session.commit()
    return await get_settings(session, user_id)


def _ist_day_start(now: datetime) -> datetime:
    return datetime.combine(now.astimezone(IST).date(), time.min, tzinfo=IST).astimezone(timezone.utc)


async def _students(session: AsyncSession, field: str) -> List[int]:
    """Active students who haven't turned this reminder off."""
    off = await opted_out(session, field)
    ids = (await session.exec(
        select(User.id).where(User.role == UserRole.STUDENT, User.status == UserStatus.ACTIVE)
    )).all()
    return [i for i in ids if i not in off]


async def _already_sent(session: AsyncSession, notification_type: str, since: datetime) -> Set[int]:
    return set((await session.exec(
        select(UserNotification.user_id).where(
            UserNotification.notification_type == notification_type, col(UserNotification.created_at) >= since
        )
    )).all())


async def send_weak_topic_reminders(session: AsyncSession, now: Optional[datetime] = None) -> int:
    """Weekly: each student's lowest-accuracy subtopic over the last 30 days (below 60%, 5+ answers)."""
    from app.services.mistake_service import weakest_subtopics

    now = now or datetime.now(timezone.utc)
    weakest = await weakest_subtopics(session, since=now - timedelta(days=30))
    if not weakest:
        return 0
    allowed = set(await _students(session, "notify_weak_topic"))
    already = await _already_sent(session, WEAK_TOPIC_TYPE, now - timedelta(days=6))
    targets = {uid: w for uid, w in weakest.items() if uid in allowed and uid not in already}
    if not targets:
        return 0

    names = {
        st_id: (st_name, t_name, s_name)
        for st_id, st_name, t_name, s_name in (await session.exec(
            select(Subtopic.id, Subtopic.name, Topic.name, Subject.name)
            .join(Topic, col(Topic.id) == col(Subtopic.topic_id))
            .join(Subject, col(Subject.id) == col(Topic.subject_id))
            .where(col(Subtopic.id).in_({w["subtopic_id"] for w in targets.values()}))
        )).all()
    }
    from urllib.parse import urlencode

    sent = 0
    for user_id, w in targets.items():
        if w["subtopic_id"] not in names:
            continue
        subtopic, topic, subject = names[w["subtopic_id"]]
        pct = round(w["accuracy"] * 100)
        session.add(UserNotification(
            user_id=user_id,
            title=f"Your weakest topic this week: {subtopic}",
            message=f"You got {pct}% right in {subtopic} ({subject}) over your last {w['answers']} answers. A short practice round will help.",
            notification_type=WEAK_TOPIC_TYPE,
            action_url="/practice-exam?" + urlencode({"subject": subject, "topic": topic, "subtopic": subtopic}),
        ))
        sent += 1
    if sent:
        await session.commit()
        logger.info(f"Weak-topic reminders sent: {sent}")
    return sent


async def send_current_affairs_reminders(session: AsyncSession, now: Optional[datetime] = None) -> int:
    """Daily: one notification when current affairs were published (or newly made public) in the last 24 hours."""
    now = now or datetime.now(timezone.utc)
    since = now - timedelta(hours=24)
    items = (await session.exec(
        select(CurrentAffair.id, CurrentAffair.title)
        .where(col(CurrentAffair.is_published).is_(True),
               or_(col(CurrentAffair.created_at) >= since, col(CurrentAffair.updated_at) >= since))
        .order_by(col(CurrentAffair.created_at).desc())
    )).all()
    if not items:
        return 0
    already = await _already_sent(session, CURRENT_AFFAIRS_TYPE, _ist_day_start(now))
    n = len(items)
    first_title = items[0][1]
    title = f"{n} new current affairs update{'s' if n != 1 else ''}"
    message = f"Latest: {first_title}" + (f" and {n - 1} more." if n > 1 else ".")
    action_url = f"/learn/current-affairs/{items[0][0]}" if n == 1 else "/learn/current-affairs"
    sent = 0
    for user_id in await _students(session, "notify_current_affairs"):
        if user_id in already:
            continue
        session.add(UserNotification(
            user_id=user_id, title=title, message=message,
            notification_type=CURRENT_AFFAIRS_TYPE, action_url=action_url,
        ))
        sent += 1
    if sent:
        await session.commit()
        logger.info(f"Current-affairs reminders sent: {sent}")
    return sent


async def send_full_paper_reminders(session: AsyncSession, now: Optional[datetime] = None) -> int:
    """Weekly, on each student's chosen day: a published full PYQ paper they haven't attempted yet."""
    now = now or datetime.now(timezone.utc)
    weekday = now.astimezone(IST).weekday()
    day_of = {
        uid: day for uid, day in (await session.exec(
            select(StudentProfile.user_id, StudentProfile.notify_full_paper_day)
        )).all()
    }
    candidates = [
        uid for uid in await _students(session, "notify_full_paper")
        if day_of.get(uid, SETTING_DEFAULTS["notify_full_paper_day"]) == weekday
    ]
    already = await _already_sent(session, FULL_PAPER_TYPE, now - timedelta(days=6))
    candidates = [uid for uid in candidates if uid not in already]
    if not candidates:
        return 0

    papers = (await session.exec(
        select(Exam.id, Exam.name, Exam.source_year)
        .where(
            col(Exam.is_active).is_(True),
            col(Exam.status) == ExamStatus.PUBLISHED,
            col(Exam.exam_type) == QuestionSourceType.PYQ,
            col(Exam.is_mixed_bank).is_(False),
            or_(col(Exam.code).is_(None), ~col(Exam.code).startswith("DYN_")),
        )
        .order_by(col(Exam.source_year).desc().nullslast(), col(Exam.id).desc())
    )).all()
    if not papers:
        return 0
    attempted: Dict[int, Set[int]] = {}
    for uid, exam_id in (await session.exec(
        select(ExamAttempt.user_id, ExamAttempt.exam_id).where(col(ExamAttempt.user_id).in_(candidates)).distinct()
    )).all():
        attempted.setdefault(uid, set()).add(exam_id)

    sent = 0
    for user_id in candidates:
        paper = next((p for p in papers if p[0] not in attempted.get(user_id, set())), None)
        if paper is None:
            continue  # every paper attempted already
        exam_id, name, year = paper
        label = f"{name} ({year})" if year and str(year) not in (name or "") else name
        session.add(UserNotification(
            user_id=user_id,
            title="Time for this week's full paper",
            message=f"Take {label} under exam conditions to see where you stand.",
            notification_type=FULL_PAPER_TYPE,
            action_url=f"/exam/{exam_id}?type=PYQ",
        ))
        sent += 1
    if sent:
        await session.commit()
        logger.info(f"Full-paper reminders sent: {sent}")
    return sent


async def run_reminders(now: Optional[datetime] = None) -> Dict[str, int]:
    """Called hourly; each reminder sends only in its own IST hour (and day)."""
    now = now or datetime.now(timezone.utc)
    local = now.astimezone(IST)
    from app.db.session import async_session_factory

    sent: Dict[str, int] = {}
    async with async_session_factory() as session:
        if local.weekday() == WEAK_TOPIC_WEEKDAY and local.hour == WEAK_TOPIC_HOUR:
            sent["weak_topic"] = await send_weak_topic_reminders(session, now)
        if local.hour == CURRENT_AFFAIRS_HOUR:
            sent["current_affairs"] = await send_current_affairs_reminders(session, now)
        if local.hour == FULL_PAPER_HOUR:
            sent["full_paper"] = await send_full_paper_reminders(session, now)
    return sent
