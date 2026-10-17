"""XP awards (client-approved values) on the xp_logs ledger; StudentProfile.total_xp mirrors its total.

Every award has a ref_key, unique per user, so retries and re-evaluations never pay twice.
Leaderboards rank on this XP, which already includes 10 per correct answer.
"""
from datetime import date, datetime, timezone
from typing import Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models.gamification import XPLog
from app.db.models.user import StudentProfile, User, UserRole

XP_CORRECT_ANSWER = 10
XP_TEST_COMPLETED = 50
XP_STREAK_DAY = 20
XP_MILESTONE = 100
XP_PER_LEVEL = 500


async def award(
    session: AsyncSession,
    user_id: int,
    amount: int,
    source: str,
    ref_key: str,
    description: Optional[str] = None,
    commit: bool = True,
) -> bool:
    """Adds amount XP once per (user, ref_key). Returns False when it was already awarded or isn't due."""
    if amount <= 0:
        return False
    user = await session.get(User, user_id)
    if not user or user.role != UserRole.STUDENT:
        return False
    exists = (await session.exec(
        select(XPLog.id).where(XPLog.user_id == user_id, XPLog.ref_key == ref_key)
    )).first()
    if exists:
        return False

    session.add(XPLog(user_id=user_id, amount=amount, source=source, ref_key=ref_key, description=description))
    profile = (await session.exec(select(StudentProfile).where(StudentProfile.user_id == user_id))).first()
    if profile is None:
        profile = StudentProfile(user_id=user_id)
    profile.total_xp = (profile.total_xp or 0) + amount
    profile.level = profile.total_xp // XP_PER_LEVEL + 1
    session.add(profile)
    if commit:
        await session.commit()
    return True


async def award_active_day(session: AsyncSession, user_id: int, day: Optional[date] = None, commit: bool = True) -> bool:
    """+20 the first time the student is active on a given IST day."""
    from app.services.free_plan import IST

    day = day or datetime.now(timezone.utc).astimezone(IST).date()
    return await award(session, user_id, XP_STREAK_DAY, "STREAK_DAY", f"day:{day.isoformat()}", "Active day", commit=commit)


async def award_test_completion(
    session: AsyncSession, user_id: int, attempt_id: int, correct: int, submitted_at: Optional[datetime], commit: bool = True
) -> None:
    """+50 for completing a test and +10 per correct answer in it, plus the day's activity bonus."""
    from app.services.free_plan import IST

    await award(session, user_id, XP_TEST_COMPLETED, "TEST_COMPLETED", f"attempt:{attempt_id}", "Test completed", commit=False)
    if correct > 0:
        await award(
            session, user_id, XP_CORRECT_ANSWER * correct, "CORRECT_ANSWERS", f"attempt-correct:{attempt_id}",
            f"{correct} correct answers", commit=False,
        )
    when = submitted_at or datetime.now(timezone.utc)
    if when.tzinfo is None:  # stored as UTC
        when = when.replace(tzinfo=timezone.utc)
    day = when.astimezone(IST).date()
    await award_active_day(session, user_id, day, commit=False)
    if commit:
        await session.commit()
