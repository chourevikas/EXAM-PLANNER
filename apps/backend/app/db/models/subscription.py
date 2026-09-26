from decimal import Decimal
from enum import Enum
from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship, Column, Index
from sqlalchemy import String
from app.db.models.types import PortableJSON, DateTimeTZ, BigIntPK

if TYPE_CHECKING:
    from app.db.models.user import User
    from app.db.models.discount import DiscountOffer


class SubscriptionSource(str, Enum):
    PAYMENT = "PAYMENT"        # user paid via Razorpay
    ADMIN_GRANT = "ADMIN_GRANT"  # manually granted by a Super Admin
    PROMO = "PROMO"            # promotional / campaign grant


class BillingInterval(str, Enum):
    MONTHLY = "MONTHLY"
    YEARLY = "YEARLY"
    LIFETIME = "LIFETIME"


class SubscriptionStatus(str, Enum):
    ACTIVE = "ACTIVE"
    PAST_DUE = "PAST_DUE"
    CANCELED = "CANCELED"
    EXPIRED = "EXPIRED"


class PlatformFeature(SQLModel, table=True):
    __tablename__ = "platform_features"
    __table_args__ = (Index("ix_platform_features_code", "feature_code", unique=True),)

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    feature_code: str = Field(
        index=True,
        max_length=100,
        description="Unique code e.g. MOCK_GENERATOR, AI_TUTOR",
    )
    name: str = Field(max_length=200)
    description: Optional[str] = Field(default=None)
    is_active: bool = Field(default=True, index=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    # Relationships
    plan_links: List["PlanFeatureLink"] = Relationship(back_populates="feature")


class SubscriptionPlan(SQLModel, table=True):
    __tablename__ = "subscription_plans"
    __table_args__ = (
        Index("ix_subscription_plans_code", "plan_code", unique=True),
        Index("ix_subscription_plans_active_display", "is_active", "display_order"),
    )

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    plan_code: str = Field(
        index=True,
        max_length=100,
        description="e.g. FREE_TIER, PRO_MENTORSHIP, PREMIUM_SERIES",
    )
    name: str = Field(max_length=200)
    description: Optional[str] = Field(default=None)
    price_cents: int = Field(
        default=0, description="Price in cents (e.g. 2999 = $29.99)"
    )
    currency: str = Field(default="INR", max_length=10)
    billing_interval: BillingInterval = Field(
        default=BillingInterval.MONTHLY, index=True
    )
    display_order: int = Field(default=0)
    is_active: bool = Field(default=True, index=True)
    metadata_json: Optional[dict] = Field(default=None, sa_column=Column(PortableJSON))
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    # Relationships
    feature_links: List["PlanFeatureLink"] = Relationship(back_populates="plan")
    user_subscriptions: List["UserSubscription"] = Relationship(back_populates="plan")


class PlanFeatureLink(SQLModel, table=True):
    __tablename__ = "plan_feature_links"
    __table_args__ = (
        Index("ix_plan_feature_unique", "plan_id", "feature_id", unique=True),
    )

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    plan_id: int = Field(foreign_key="subscription_plans.id", index=True)
    feature_id: int = Field(foreign_key="platform_features.id", index=True)
    usage_limit: Optional[int] = Field(
        default=None, description="Null means unlimited usage"
    )
    config_json: Optional[dict] = Field(default=None, sa_column=Column(PortableJSON))

    # Relationships
    plan: Optional[SubscriptionPlan] = Relationship(back_populates="feature_links")
    feature: Optional[PlatformFeature] = Relationship(back_populates="plan_links")


class UserSubscription(SQLModel, table=True):
    __tablename__ = "user_subscriptions"
    __table_args__ = (
        Index("ix_user_subs_user_status", "user_id", "status"),
        Index("ix_user_subs_period_end", "current_period_end"),
    )

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    user_id: int = Field(foreign_key="users.id", index=True)
    plan_id: int = Field(foreign_key="subscription_plans.id", index=True)
    status: SubscriptionStatus = Field(default=SubscriptionStatus.ACTIVE, index=True)
    current_period_start: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
    current_period_end: datetime = Field(index=True, sa_type=DateTimeTZ)
    cancel_at_period_end: bool = Field(default=False)
    payment_gateway: Optional[str] = Field(default="RAZORPAY", max_length=50)
    gateway_subscription_id: Optional[str] = Field(default=None, index=True)

    # --- Source tracking (spec: Section A.3) ---
    source: str = Field(
        default=SubscriptionSource.PAYMENT.value,
        sa_column=Column(String(50), nullable=False, index=True)
    )
    # Set when source == ADMIN_GRANT
    granted_by_admin_id: Optional[int] = Field(
        default=None, foreign_key="users.id", index=True
    )
    grant_reason: Optional[str] = Field(default=None)  # mandatory for admin grants

    # Discount applied at checkout / grant time
    discount_offer_id: Optional[int] = Field(
        default=None, foreign_key="discount_offers.id", nullable=True
    )

    # Price snapshots — locked in at creation, never updated (spec: rule 1)
    original_price: Optional[Decimal] = Field(
        default=None, max_digits=10, decimal_places=2,
        description="Snapshot of plan price at time of purchase/grant"
    )
    discounted_price: Optional[Decimal] = Field(
        default=None, max_digits=10, decimal_places=2,
        description="Final price paid after discount; None if no discount"
    )

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    # Relationships
    user: Optional["User"] = Relationship(
        back_populates="subscriptions",
        sa_relationship_kwargs={"foreign_keys": "[UserSubscription.user_id]"},
    )
    plan: Optional[SubscriptionPlan] = Relationship(back_populates="user_subscriptions")
    granted_by: Optional["User"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[UserSubscription.granted_by_admin_id]"}
    )
    discount_offer: Optional["DiscountOffer"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[UserSubscription.discount_offer_id]"}
    )
