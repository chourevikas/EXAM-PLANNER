"""
SubscriptionAuditService — thin helper to append SubscriptionAuditLog rows.

Must NEVER raise: audit failures must not block the action itself.
"""
from typing import Any, Optional

from sqlmodel.ext.asyncio.session import AsyncSession

from app.config.logger import setup_logger
from app.db.models.subscription_audit import SubscriptionAuditAction, SubscriptionAuditLog
from app.db.models.user import User

logger = setup_logger("SubscriptionAuditService")


async def log_subscription_action(
    session: AsyncSession,
    action: SubscriptionAuditAction,
    *,
    actor: Optional[User] = None,
    actor_id: Optional[int] = None,
    target_user_id: Optional[int] = None,
    target_plan_id: Optional[int] = None,
    target_offer_id: Optional[int] = None,
    target_subscription_id: Optional[int] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    """Append one immutable audit row. Never raises."""
    try:
        session.add(
            SubscriptionAuditLog(
                actor_admin_id=actor.id if actor else actor_id,
                action_type=action,
                target_user_id=target_user_id,
                target_plan_id=target_plan_id,
                target_offer_id=target_offer_id,
                target_subscription_id=target_subscription_id,
                action_metadata=metadata,
            )
        )
        await session.commit()
    except Exception as err:
        logger.warning(f"Could not record subscription audit action {action}: {err}")
        await session.rollback()
