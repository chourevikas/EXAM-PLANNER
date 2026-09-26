"""
Subscription Audit Log — immutable append-only record of every plan/discount/grant/revoke
action performed by a Super Admin or system.
"""
from datetime import datetime, timezone
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlmodel import Column, Field, Index, Relationship, SQLModel
from sqlalchemy import String

from app.db.models.types import BigIntPK, DateTimeTZ, PortableJSON

if TYPE_CHECKING:
    from app.db.models.user import User
    from app.db.models.subscription import SubscriptionPlan, UserSubscription
    from app.db.models.discount import DiscountOffer


class SubscriptionAuditAction(str, Enum):
    # Plan lifecycle
    PLAN_CREATED = "PLAN_CREATED"
    PLAN_UPDATED = "PLAN_UPDATED"
    PLAN_DEACTIVATED = "PLAN_DEACTIVATED"
    PLAN_REACTIVATED = "PLAN_REACTIVATED"

    # Discount lifecycle
    DISCOUNT_CREATED = "DISCOUNT_CREATED"
    DISCOUNT_UPDATED = "DISCOUNT_UPDATED"
    DISCOUNT_DEACTIVATED = "DISCOUNT_DEACTIVATED"
    DISCOUNT_REACTIVATED = "DISCOUNT_REACTIVATED"

    # Manual grant / revoke
    SUBSCRIPTION_GRANTED = "SUBSCRIPTION_GRANTED"
    SUBSCRIPTION_REVOKED = "SUBSCRIPTION_REVOKED"
    SUBSCRIPTION_EXTENDED = "SUBSCRIPTION_EXTENDED"
    SUBSCRIPTION_REPLACED = "SUBSCRIPTION_REPLACED"

    # Payment-originated (recorded for completeness)
    SUBSCRIPTION_PAYMENT_CREATED = "SUBSCRIPTION_PAYMENT_CREATED"
    SUBSCRIPTION_EXPIRED = "SUBSCRIPTION_EXPIRED"
    SUBSCRIPTION_CANCELLED = "SUBSCRIPTION_CANCELLED"


class SubscriptionAuditLog(SQLModel, table=True):
    """
    Immutable audit trail for every subscription-related admin action.
    Must never be deleted. One row per atomic action.
    """
    __tablename__ = "subscription_audit_logs"
    __table_args__ = (
        Index("ix_sub_audit_actor", "actor_admin_id"),
        Index("ix_sub_audit_target_user", "target_user_id"),
        Index("ix_sub_audit_action", "action_type"),
        Index("ix_sub_audit_created", "created_at"),
    )

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)

    # Who performed the action (null = system/automated)
    actor_admin_id: Optional[int] = Field(
        default=None, foreign_key="users.id", index=True
    )

    action_type: str = Field(
        sa_column=Column(String(100), nullable=False, index=True)
    )

    # What was affected (all nullable — not every action has all three)
    target_user_id: Optional[int] = Field(
        default=None, foreign_key="users.id", index=True
    )
    target_plan_id: Optional[int] = Field(
        default=None, foreign_key="subscription_plans.id"
    )
    target_offer_id: Optional[int] = Field(
        default=None, foreign_key="discount_offers.id", nullable=True
    )
    target_subscription_id: Optional[int] = Field(
        default=None, foreign_key="user_subscriptions.id", nullable=True
    )

    # Free-form context: old/new price, reason text, duration_days, conflict strategy, etc.
    action_metadata: Optional[dict] = Field(default=None, sa_column=Column(PortableJSON))

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
        index=True,
    )

    # --- relationships (read-only, do not modify through these) ---
    actor: Optional["User"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[SubscriptionAuditLog.actor_admin_id]"}
    )
    target_user: Optional["User"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[SubscriptionAuditLog.target_user_id]"}
    )
