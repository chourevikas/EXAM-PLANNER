"""
DiscountService — Admin management and user-facing validation of DiscountOffers.

Core rules enforced (spec Section C):
  - Validation is atomic (redemptions_used incremented in same tx as UserSubscription).
  - Single discount per checkout (no stacking, v1).
  - Server-side price is always authoritative — never trust client-computed price.
  - Discount deactivation does not affect already-applied redemptions.
"""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models.discount import DiscountOffer, DiscountRedemption, DiscountType, RedemptionStatus
from app.db.models.subscription import SubscriptionPlan
from app.db.models.subscription_audit import SubscriptionAuditAction
from app.db.models.user import User


class DiscountValidationError(Exception):
    """Typed exception for each distinct failure reason during discount validation."""
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


class DiscountService:
    def __init__(self, session: AsyncSession):
        self.session = session

    # ------------------------------------------------------------------
    # Admin CRUD
    # ------------------------------------------------------------------

    async def list_offers(self, include_inactive: bool = False) -> list[DiscountOffer]:
        stmt = select(DiscountOffer)
        if not include_inactive:
            stmt = stmt.where(DiscountOffer.is_active == True)
        return list((await self.session.exec(stmt)).all())

    async def get_offer(self, offer_id: int) -> DiscountOffer:
        offer = (await self.session.exec(
            select(DiscountOffer).where(DiscountOffer.id == offer_id)
        )).first()
        if not offer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discount offer not found")
        return offer

    async def create_offer(
        self,
        *,
        actor: User,
        name: str,
        discount_type: DiscountType,
        value: Decimal,
        valid_from: datetime,
        description: Optional[str] = None,
        code: Optional[str] = None,
        max_redemptions: Optional[int] = None,
        max_redemptions_per_user: int = 1,
        valid_until: Optional[datetime] = None,
        is_public: bool = True,
        applicable_plan_ids: Optional[list[int]] = None,
    ) -> DiscountOffer:
        # Guard: unique code
        if code:
            existing = (await self.session.exec(
                select(DiscountOffer).where(DiscountOffer.code == code)
            )).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"A discount with code '{code}' already exists."
                )

        offer = DiscountOffer(
            name=name,
            description=description,
            code=code,
            discount_type=discount_type,
            value=value,
            max_redemptions=max_redemptions,
            max_redemptions_per_user=max_redemptions_per_user,
            valid_from=valid_from,
            valid_until=valid_until,
            is_public=is_public,
            created_by_admin_id=actor.id,
        )
        self.session.add(offer)
        await self.session.commit()
        await self.session.refresh(offer)

        # Link to specific plans after commit
        if applicable_plan_ids:
            from app.db.models.discount import DiscountPlanLink
            for plan_id in applicable_plan_ids:
                self.session.add(DiscountPlanLink(offer_id=offer.id, plan_id=plan_id))
            await self.session.commit()

        from app.services.subscription_audit_service import log_subscription_action
        await log_subscription_action(
            self.session,
            action=SubscriptionAuditAction.DISCOUNT_CREATED,
            actor=actor,
            target_offer_id=offer.id,
            metadata={"code": code, "type": discount_type.value, "value": str(value)},
        )
        return offer

    async def update_offer(
        self,
        offer_id: int,
        *,
        actor: User,
        name: Optional[str] = None,
        description: Optional[str] = None,
        value: Optional[Decimal] = None,
        max_redemptions: Optional[int] = None,
        max_redemptions_per_user: Optional[int] = None,
        valid_until: Optional[datetime] = None,
        is_public: Optional[bool] = None,
        applicable_plan_ids: Optional[list[int]] = None,
    ) -> DiscountOffer:
        offer = await self.get_offer(offer_id)
        changes: dict = {}

        if name is not None:
            offer.name = name
            changes["name"] = name
        if description is not None:
            offer.description = description
        if value is not None:
            changes["old_value"] = str(offer.value)
            changes["new_value"] = str(value)
            offer.value = value
        if max_redemptions is not None:
            offer.max_redemptions = max_redemptions
        if max_redemptions_per_user is not None:
            offer.max_redemptions_per_user = max_redemptions_per_user
        if valid_until is not None:
            offer.valid_until = valid_until
        if is_public is not None:
            offer.is_public = is_public

        if applicable_plan_ids is not None:
            from app.db.models.discount import DiscountPlanLink
            existing = (await self.session.exec(
                select(DiscountPlanLink).where(DiscountPlanLink.offer_id == offer_id)
            )).all()
            for link in existing:
                await self.session.delete(link)
            for plan_id in applicable_plan_ids:
                self.session.add(DiscountPlanLink(offer_id=offer_id, plan_id=plan_id))

        offer.updated_at = datetime.now(timezone.utc)
        self.session.add(offer)
        await self.session.commit()
        await self.session.refresh(offer)

        from app.services.subscription_audit_service import log_subscription_action
        await log_subscription_action(
            self.session,
            action=SubscriptionAuditAction.DISCOUNT_UPDATED,
            actor=actor,
            target_offer_id=offer.id,
            metadata=changes,
        )
        return offer

    async def deactivate_offer(self, offer_id: int, *, actor: User) -> DiscountOffer:
        offer = await self.get_offer(offer_id)
        offer.is_active = False
        offer.updated_at = datetime.now(timezone.utc)
        self.session.add(offer)
        await self.session.commit()

        from app.services.subscription_audit_service import log_subscription_action
        await log_subscription_action(
            self.session,
            action=SubscriptionAuditAction.DISCOUNT_DEACTIVATED,
            actor=actor,
            target_offer_id=offer.id,
        )
        return offer

    async def list_redemptions(self, offer_id: int) -> list[DiscountRedemption]:
        return list((await self.session.exec(
            select(DiscountRedemption)
            .where(DiscountRedemption.offer_id == offer_id)
            .order_by(DiscountRedemption.redeemed_at.desc())
        )).all())

    # ------------------------------------------------------------------
    # Core validation (called at pre-check AND server-side at payment)
    # ------------------------------------------------------------------

    async def validate(
        self,
        code: str,
        user: User,
        plan_id: int,
    ) -> tuple[DiscountOffer, Decimal]:
        """
        Validate a discount code for a given user and plan.

        Returns: (offer, computed_discounted_price_cents_as_decimal)
        Raises: DiscountValidationError with typed code on any failure.
        """
        # 1. Find offer
        offer = (await self.session.exec(
            select(DiscountOffer).where(DiscountOffer.code == code)
        )).first()
        if not offer:
            raise DiscountValidationError("INVALID_CODE", "Discount code not found.")

        # 2. Active?
        if not offer.is_active:
            raise DiscountValidationError("INACTIVE", "This discount code is no longer active.")

        # 3. Validity window
        now = datetime.now(timezone.utc)
        valid_from = offer.valid_from
        if valid_from.tzinfo is None:
            valid_from = valid_from.replace(tzinfo=timezone.utc)
        if now < valid_from:
            raise DiscountValidationError("NOT_YET_VALID", "This code is not valid yet.")
        if offer.valid_until:
            valid_until = offer.valid_until
            if valid_until.tzinfo is None:
                valid_until = valid_until.replace(tzinfo=timezone.utc)
            if now > valid_until:
                raise DiscountValidationError("EXPIRED", "This discount code has expired.")

        # 4. Total redemption cap
        if offer.max_redemptions is not None and offer.redemptions_used >= offer.max_redemptions:
            raise DiscountValidationError("CAP_REACHED", "This discount code has reached its usage limit.")

        # 5. Per-user cap
        user_redemption_count = (await self.session.exec(
            select(func.count()).select_from(DiscountRedemption).where(
                DiscountRedemption.offer_id == offer.id,
                DiscountRedemption.user_id == user.id,
                DiscountRedemption.status == RedemptionStatus.APPLIED,
            )
        )).one()
        if user_redemption_count >= offer.max_redemptions_per_user:
            raise DiscountValidationError(
                "USER_CAP_REACHED",
                f"You have already used this code the maximum allowed times ({offer.max_redemptions_per_user})."
            )

        # 6. Plan applicability
        from app.db.models.discount import DiscountPlanLink
        plan_links = (await self.session.exec(
            select(DiscountPlanLink).where(DiscountPlanLink.offer_id == offer.id)
        )).all()
        if plan_links:  # empty = applies to all plans
            applicable_ids = {link.plan_id for link in plan_links}
            if plan_id not in applicable_ids:
                raise DiscountValidationError(
                    "PLAN_NOT_ELIGIBLE",
                    "This discount is not applicable to the selected plan."
                )

        # 7. Compute discounted price
        plan = (await self.session.exec(
            select(SubscriptionPlan).where(SubscriptionPlan.id == plan_id)
        )).first()
        if not plan:
            raise DiscountValidationError("PLAN_NOT_FOUND", "Plan not found.")

        original_price = Decimal(plan.price_cents)
        if offer.discount_type == DiscountType.PERCENTAGE:
            discount_amount = (original_price * offer.value / Decimal("100")).quantize(Decimal("1"))
        else:  # FLAT_AMOUNT
            discount_amount = min(offer.value, original_price)

        discounted_price = max(Decimal("0"), original_price - discount_amount)
        return offer, discounted_price

    async def reserve_redemption(self, offer: DiscountOffer, user: User) -> DiscountRedemption:
        """Create a RESERVED redemption row (atomically increments counter)."""
        offer.redemptions_used += 1
        self.session.add(offer)
        redemption = DiscountRedemption(
            offer_id=offer.id,
            user_id=user.id,
            status=RedemptionStatus.RESERVED,
        )
        self.session.add(redemption)
        await self.session.flush()
        return redemption

    async def apply_redemption(
        self,
        redemption: DiscountRedemption,
        *,
        subscription_id: int,
        amount_deducted: Decimal,
    ) -> None:
        """Confirm a RESERVED redemption after payment succeeds."""
        redemption.status = RedemptionStatus.APPLIED
        redemption.user_subscription_id = subscription_id
        redemption.amount_deducted = amount_deducted
        self.session.add(redemption)
        await self.session.flush()

    async def expire_redemption(self, redemption: DiscountRedemption) -> None:
        """Mark a reservation as unused (e.g., user abandoned checkout)."""
        redemption.status = RedemptionStatus.EXPIRED_UNUSED
        # Roll back the counter
        offer = await self.get_offer(redemption.offer_id)
        offer.redemptions_used = max(0, offer.redemptions_used - 1)
        self.session.add(offer)
        self.session.add(redemption)
        await self.session.flush()
