"""
Discount / Promotional Offer models.

DiscountOffer  – admin-created percentage or flat-amount discount codes.
DiscountRedemption – records each time a user applies an offer (reservation
                     → applied or expired_unused).
"""
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING, List, Optional

from sqlmodel import Column, Field, Index, Relationship, SQLModel
from sqlalchemy import String

from app.db.models.types import BigIntPK, DateTimeTZ, PortableJSON

if TYPE_CHECKING:
    from app.db.models.user import User
    from app.db.models.subscription import UserSubscription, SubscriptionPlan


class DiscountType(str, Enum):
    PERCENTAGE = "PERCENTAGE"      # e.g. 20 → 20% off
    FLAT_AMOUNT = "FLAT_AMOUNT"    # e.g. 500 → ₹500 off


class RedemptionStatus(str, Enum):
    RESERVED = "RESERVED"          # code entered at checkout, not yet paid
    APPLIED = "APPLIED"            # payment succeeded, discount locked in
    EXPIRED_UNUSED = "EXPIRED_UNUSED"  # reservation abandoned


# ---------------------------------------------------------------------------
# M2M helper: which plans a discount applies to (empty = all plans)
# ---------------------------------------------------------------------------
class DiscountPlanLink(SQLModel, table=True):
    __tablename__ = "discount_plan_links"
    __table_args__ = (
        Index("ix_discount_plan_unique", "offer_id", "plan_id", unique=True),
    )

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    offer_id: int = Field(foreign_key="discount_offers.id", index=True)
    plan_id: int = Field(foreign_key="subscription_plans.id", index=True)


class DiscountOffer(SQLModel, table=True):
    """Admin-created promotional/discount code or targeted offer."""
    __tablename__ = "discount_offers"
    __table_args__ = (
        Index("ix_discount_offers_code", "code", unique=True),
        Index("ix_discount_offers_active", "is_active"),
    )

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)

    # --- identity ---
    name: str = Field(max_length=200)
    description: Optional[str] = Field(default=None)

    # Nullable = private/targeted offer (no public code entry required)
    code: Optional[str] = Field(default=None, index=True, max_length=100)

    # --- discount rules ---
    discount_type: str = Field(
        sa_column=Column(String(50), nullable=False, index=True)
    )
    # For PERCENTAGE: 0–100 (stored as full number, e.g. 20.00 = 20%)
    # For FLAT_AMOUNT: amount in smallest currency unit (paise for INR)
    value: Decimal = Field(max_digits=10, decimal_places=2, ge=0)

    # --- usage caps ---
    max_redemptions: Optional[int] = Field(default=None)   # None = unlimited
    redemptions_used: int = Field(default=0)
    max_redemptions_per_user: int = Field(default=1)

    # --- validity ---
    valid_from: datetime = Field(sa_type=DateTimeTZ)
    valid_until: Optional[datetime] = Field(default=None, sa_type=DateTimeTZ)  # None = no expiry

    # --- visibility ---
    is_active: bool = Field(default=True, index=True)
    is_public: bool = Field(default=True)  # False = targeted/private

    # --- audit ---
    created_by_admin_id: int = Field(foreign_key="users.id", index=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    # --- relationships ---
    created_by: Optional["User"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[DiscountOffer.created_by_admin_id]"}
    )
    redemptions: List["DiscountRedemption"] = Relationship(back_populates="offer")


class DiscountRedemption(SQLModel, table=True):
    """Tracks each use (reserved or applied) of a DiscountOffer by a user."""
    __tablename__ = "discount_redemptions"
    __table_args__ = (
        Index("ix_discount_redemptions_offer_user", "offer_id", "user_id"),
    )

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)

    offer_id: int = Field(foreign_key="discount_offers.id", index=True)
    user_id: int = Field(foreign_key="users.id", index=True)

    # Linked once payment/grant is confirmed
    user_subscription_id: Optional[int] = Field(
        default=None, foreign_key="user_subscriptions.id", index=True
    )

    status: str = Field(
        default=RedemptionStatus.RESERVED.value,
        sa_column=Column(String(50), nullable=False, index=True)
    )

    # Snapshot of the exact amount saved at the time of redemption
    amount_deducted: Optional[Decimal] = Field(
        default=None, max_digits=10, decimal_places=2
    )

    redeemed_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    # --- relationships ---
    offer: Optional[DiscountOffer] = Relationship(back_populates="redemptions")
    user: Optional["User"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[DiscountRedemption.user_id]"}
    )
