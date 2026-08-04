import uuid
from enum import Enum
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship, Column, Index
from app.db.models.types import PortableJSON

if TYPE_CHECKING:
    from app.db.models.user import User



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
    __table_args__ = (
        Index("ix_platform_features_code", "feature_code", unique=True),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    feature_code: str = Field(index=True, max_length=100, description="Unique code e.g. MOCK_GENERATOR, AI_TUTOR")
    name: str = Field(max_length=200)
    description: Optional[str] = Field(default=None)
    is_active: bool = Field(default=True, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    plan_links: List["PlanFeatureLink"] = Relationship(back_populates="feature")


class SubscriptionPlan(SQLModel, table=True):
    __tablename__ = "subscription_plans"
    __table_args__ = (
        Index("ix_subscription_plans_code", "plan_code", unique=True),
        Index("ix_subscription_plans_active_display", "is_active", "display_order"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    plan_code: str = Field(index=True, max_length=100, description="e.g. FREE_TIER, PRO_MENTORSHIP, PREMIUM_SERIES")
    name: str = Field(max_length=200)
    description: Optional[str] = Field(default=None)
    price_cents: int = Field(default=0, description="Price in cents (e.g. 2999 = $29.99)")
    currency: str = Field(default="INR", max_length=10)
    billing_interval: BillingInterval = Field(default=BillingInterval.MONTHLY, index=True)
    display_order: int = Field(default=0)
    is_active: bool = Field(default=True, index=True)
    metadata_json: Optional[dict] = Field(default=None, sa_column=Column(PortableJSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    feature_links: List["PlanFeatureLink"] = Relationship(back_populates="plan")
    user_subscriptions: List["UserSubscription"] = Relationship(back_populates="plan")


class PlanFeatureLink(SQLModel, table=True):
    __tablename__ = "plan_feature_links"
    __table_args__ = (
        Index("ix_plan_feature_unique", "plan_id", "feature_id", unique=True),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    plan_id: uuid.UUID = Field(foreign_key="subscription_plans.id", index=True)
    feature_id: uuid.UUID = Field(foreign_key="platform_features.id", index=True)
    usage_limit: Optional[int] = Field(default=None, description="Null means unlimited usage")
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

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    plan_id: uuid.UUID = Field(foreign_key="subscription_plans.id", index=True)
    status: SubscriptionStatus = Field(default=SubscriptionStatus.ACTIVE, index=True)
    current_period_start: datetime = Field(default_factory=datetime.utcnow)
    current_period_end: datetime = Field(index=True)
    cancel_at_period_end: bool = Field(default=False)
    payment_gateway: Optional[str] = Field(default="RAZORPAY", max_length=50)
    gateway_subscription_id: Optional[str] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    user: Optional["User"] = Relationship(back_populates="subscriptions")
    plan: Optional[SubscriptionPlan] = Relationship(back_populates="user_subscriptions")
