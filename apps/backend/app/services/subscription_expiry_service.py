"""Ends subscriptions whose period is over and moves the student back to the Free plan.

Runs every night (and once at startup). A subscription that is ACTIVE with its period end in the past
becomes EXPIRED; a student left with no active subscription goes back to FREE and gets an in-app
notice. Covers paid plans, admin grants and promos (e.g. the launch offer for existing students).
"""
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config.logger import setup_logger
from app.db.models.notification import UserNotification
from app.db.models.subscription import SubscriptionStatus, UserSubscription
from app.db.models.user import StudentProfile, SubscriptionTier, User, UserRole

logger = setup_logger("SubscriptionExpiry")


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


async def expire_due(session: AsyncSession, now: Optional[datetime] = None) -> int:
    """Expires ended subscriptions; returns how many students went back to Free."""
    now = now or datetime.now(timezone.utc)
    active = list((await session.exec(
        select(UserSubscription).where(UserSubscription.status == SubscriptionStatus.ACTIVE)
    )).all())
    ended = [s for s in active if _aware(s.current_period_end) <= now]
    if not ended:
        return 0
    still_active = {s.user_id for s in active if _aware(s.current_period_end) > now}
    for s in ended:
        s.status = SubscriptionStatus.EXPIRED
        s.updated_at = now
        session.add(s)

    downgraded = 0
    for user_id in {s.user_id for s in ended} - still_active:
        user = await session.get(User, user_id)
        if not user or user.role != UserRole.STUDENT:
            continue
        profile = (await session.exec(select(StudentProfile).where(StudentProfile.user_id == user_id))).first()
        if not profile or profile.subscription_tier != SubscriptionTier.PREMIUM:
            continue
        profile.subscription_tier = SubscriptionTier.FREE
        session.add(profile)
        session.add(UserNotification(
            user_id=user_id,
            title="Your Pro access has ended",
            message="You're back on the free plan: 20 questions a day with score, answers and explanations. "
                    "Upgrade to Pro to get full analysis and unlimited practice again.",
            notification_type="SUBSCRIPTION",
            action_url="/billing",
        ))
        downgraded += 1
    await session.commit()

    if downgraded:
        from app.cache import invalidate_user_cache
        for user_id in {s.user_id for s in ended} - still_active:
            try:
                await invalidate_user_cache(str(user_id))
            except Exception:
                pass
    logger.info(f"Subscriptions expired: {len(ended)}; students back on Free: {downgraded}")
    return downgraded


async def run_expiry_job() -> int:
    from app.db.session import async_session_factory

    async with async_session_factory() as session:
        return await expire_due(session)
