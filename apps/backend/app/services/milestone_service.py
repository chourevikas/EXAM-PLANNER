"""Milestones: admin-managed badges unlocked when a student's count for a criterion reaches a threshold.

Admins create, edit, switch off or delete them (badges rows with criteria_type set). A student who
qualifies gets the badge once, the milestone's XP (keyed "milestone:<id>", so never twice) and an in-app
notification. Checked after each evaluated test and practice answer, and for everyone when an admin
saves a milestone.
"""
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List

from sqlmodel import case, col, func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config.logger import setup_logger
from app.db.models.analytics import ExamAttempt, ExamQuestionResponse, PracticeAnswer
from app.db.models.enums import AttemptStatus
from app.db.models.gamification import Badge, UserBadge
from app.db.models.notification import UserNotification
from app.db.models.user import StudentProfile, User, UserRole

logger = setup_logger("MilestoneService")

CRITERIA = {
    "QUESTIONS_SOLVED": "Questions solved",
    "CORRECT_ANSWERS": "Correct answers",
    "TESTS_COMPLETED": "Tests completed",
    "STREAK_DAYS": "Days in a row",
    "XP_EARNED": "XP earned",
}
_DONE = [AttemptStatus.SUBMITTED, AttemptStatus.EVALUATED]


def _ist_day(dt: datetime) -> date:
    from app.services.free_plan import IST

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(IST).date()


async def _streak(session: AsyncSession, user_id: int) -> int:
    """Consecutive IST days, ending today or yesterday, with a completed test or a practice answer."""
    days = {
        _ist_day(d) for d in (await session.exec(
            select(ExamAttempt.submitted_at).where(ExamAttempt.user_id == user_id, col(ExamAttempt.status).in_(_DONE))
        )).all() if d
    }
    days |= {
        _ist_day(d) for d in (await session.exec(
            select(PracticeAnswer.answered_at).where(PracticeAnswer.user_id == user_id)
        )).all() if d
    }
    today = _ist_day(datetime.now(timezone.utc))
    day = today if today in days else today - timedelta(days=1)
    streak = 0
    while day in days:
        streak += 1
        day -= timedelta(days=1)
    return streak


async def progress(session: AsyncSession, user_id: int) -> Dict[str, int]:
    """The student's current count for every criterion."""
    tests_answered, tests_correct, tests_done = (await session.exec(
        select(
            func.count(ExamQuestionResponse.id),
            func.coalesce(func.sum(case((col(ExamQuestionResponse.is_correct).is_(True), 1), else_=0)), 0),
            func.count(func.distinct(ExamAttempt.id)),
        )
        .join(ExamAttempt, col(ExamQuestionResponse.attempt_id) == col(ExamAttempt.id))
        .where(
            ExamAttempt.user_id == user_id,
            col(ExamAttempt.status).in_(_DONE),
            col(ExamQuestionResponse.selected_option_id).is_not(None),
        )
    )).one()
    completed = (await session.exec(
        select(func.count(ExamAttempt.id)).where(ExamAttempt.user_id == user_id, col(ExamAttempt.status).in_(_DONE))
    )).one()
    practice_answered, practice_correct = (await session.exec(
        select(func.count(PracticeAnswer.id), func.coalesce(func.sum(case((col(PracticeAnswer.is_correct).is_(True), 1), else_=0)), 0))
        .where(PracticeAnswer.user_id == user_id)
    )).one()
    xp = (await session.exec(select(StudentProfile.total_xp).where(StudentProfile.user_id == user_id))).first() or 0
    return {
        "QUESTIONS_SOLVED": int(tests_answered or 0) + int(practice_answered or 0),
        "CORRECT_ANSWERS": int(tests_correct or 0) + int(practice_correct or 0),
        "TESTS_COMPLETED": int(completed or 0),
        "STREAK_DAYS": await _streak(session, user_id),
        "XP_EARNED": int(xp),
    }


async def check(session: AsyncSession, user_id: int, commit: bool = True) -> List[str]:
    """Awards every active milestone the student has reached and not yet unlocked. Returns their names."""
    user = await session.get(User, user_id)
    if not user or user.role != UserRole.STUDENT:
        return []
    milestones = (await session.exec(
        select(Badge).where(col(Badge.criteria_type).is_not(None), col(Badge.is_active).is_(True))
    )).all()
    if not milestones:
        return []
    unlocked = set((await session.exec(select(UserBadge.badge_id).where(UserBadge.user_id == user_id))).all())
    pending = [m for m in milestones if m.id not in unlocked]
    if not pending:
        return []

    counts = await progress(session, user_id)
    from app.services import xp_service

    earned = []
    # Lowest thresholds first, so XP from one milestone can count toward an XP milestone in the same pass
    for m in sorted(pending, key=lambda b: (b.criteria_type != "XP_EARNED", b.threshold or 0)):
        if counts.get(m.criteria_type, 0) < (m.threshold or 0):
            continue
        session.add(UserBadge(user_id=user_id, badge_id=m.id))
        if m.xp_reward:
            await xp_service.award(
                session, user_id, m.xp_reward, "MILESTONE", f"milestone:{m.id}", f"Milestone: {m.name}", commit=False,
            )
            counts["XP_EARNED"] = counts.get("XP_EARNED", 0) + m.xp_reward
        session.add(UserNotification(
            user_id=user_id,
            title=f"Milestone unlocked: {m.name}",
            message=f"{m.description} +{m.xp_reward} XP." if m.xp_reward else m.description,
            notification_type="MILESTONE",
            action_url="/dashboard",
        ))
        earned.append(m.name)

    if earned:
        if commit:
            await session.commit()
            await xp_service.forget_cached_stats(user_id)
        from app.cache import get_cache, build_cache_key
        await get_cache().delete(build_cache_key("users:badges", str(user_id)))
        logger.info(f"Milestones unlocked for user {user_id}: {earned}")
    return earned


async def check_all_students(session: AsyncSession) -> int:
    """Runs check() for every student (after an admin saves a milestone). Returns how many unlocked something."""
    ids = (await session.exec(select(User.id).where(User.role == UserRole.STUDENT))).all()
    awarded = 0
    for uid in ids:
        try:
            if await check(session, uid):
                awarded += 1
        except Exception as err:  # one student's failure shouldn't stop the rest
            logger.warning(f"Milestone check failed for user {uid}: {err}")
            await session.rollback()
    return awarded
