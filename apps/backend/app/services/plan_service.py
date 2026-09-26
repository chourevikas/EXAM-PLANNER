"""
PlanService — Super Admin CRUD for SubscriptionPlan and PlatformFeature.

Rules enforced:
  - Price/feature changes never touch existing UserSubscription rows
    (those have price snapshots, spec rule 1).
  - Deactivation is a soft flag, not a delete.
  - Every mutating action calls subscription_audit_service.log().
"""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models.subscription import SubscriptionPlan, PlatformFeature, PlanFeatureLink, BillingInterval
from app.db.models.subscription_audit import SubscriptionAuditAction
from app.db.models.user import User


class PlanService:
    def __init__(self, session: AsyncSession):
        self.session = session

    # ------------------------------------------------------------------
    # Plan CRUD
    # ------------------------------------------------------------------

    async def list_plans(self, include_inactive: bool = False) -> list[SubscriptionPlan]:
        stmt = select(SubscriptionPlan)
        if not include_inactive:
            stmt = stmt.where(SubscriptionPlan.is_active == True)
        stmt = stmt.order_by(SubscriptionPlan.display_order)
        return list((await self.session.exec(stmt)).all())

    async def get_plan(self, plan_id: int) -> SubscriptionPlan:
        plan = (await self.session.exec(
            select(SubscriptionPlan).where(SubscriptionPlan.id == plan_id)
        )).first()
        if not plan:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
        return plan

    async def create_plan(
        self,
        *,
        actor: User,
        plan_code: str,
        name: str,
        description: Optional[str] = None,
        price_cents: int = 0,
        currency: str = "INR",
        billing_interval: BillingInterval = BillingInterval.MONTHLY,
        display_order: int = 0,
        feature_ids: Optional[list[int]] = None,
        metadata_json: Optional[dict] = None,
    ) -> SubscriptionPlan:
        # Guard: plan_code must be unique
        existing = (await self.session.exec(
            select(SubscriptionPlan).where(SubscriptionPlan.plan_code == plan_code)
        )).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A plan with code '{plan_code}' already exists."
            )

        plan = SubscriptionPlan(
            plan_code=plan_code,
            name=name,
            description=description,
            price_cents=price_cents,
            currency=currency,
            billing_interval=billing_interval,
            display_order=display_order,
            metadata_json=metadata_json,
        )
        self.session.add(plan)
        await self.session.commit()
        await self.session.refresh(plan)

        # Attach features after commit so plan.id is stable
        if feature_ids:
            for fid in feature_ids:
                self.session.add(PlanFeatureLink(plan_id=plan.id, feature_id=fid))
            await self.session.commit()

        # Audit
        from app.services.subscription_audit_service import log_subscription_action
        await log_subscription_action(
            self.session,
            action=SubscriptionAuditAction.PLAN_CREATED,
            actor=actor,
            target_plan_id=plan.id,
            metadata={"plan_code": plan_code, "price_cents": price_cents},
        )
        return plan

    async def update_plan(
        self,
        plan_id: int,
        *,
        actor: User,
        name: Optional[str] = None,
        description: Optional[str] = None,
        price_cents: Optional[int] = None,
        currency: Optional[str] = None,
        billing_interval: Optional[BillingInterval] = None,
        display_order: Optional[int] = None,
        feature_ids: Optional[list[int]] = None,
        metadata_json: Optional[dict] = None,
    ) -> SubscriptionPlan:
        plan = await self.get_plan(plan_id)
        old_price = plan.price_cents

        changes: dict = {}
        if name is not None:
            changes["name"] = name
            plan.name = name
        if description is not None:
            changes["description"] = description
            plan.description = description
        if price_cents is not None:
            changes["old_price_cents"] = old_price
            changes["new_price_cents"] = price_cents
            plan.price_cents = price_cents  # Only affects FUTURE subscriptions
        if currency is not None:
            plan.currency = currency
        if billing_interval is not None:
            plan.billing_interval = billing_interval
        if display_order is not None:
            plan.display_order = display_order
        if metadata_json is not None:
            plan.metadata_json = metadata_json

        if feature_ids is not None:
            await self._sync_plan_features(plan_id, feature_ids)

        self.session.add(plan)
        await self.session.commit()
        await self.session.refresh(plan)

        from app.services.subscription_audit_service import log_subscription_action
        await log_subscription_action(
            self.session,
            action=SubscriptionAuditAction.PLAN_UPDATED,
            actor=actor,
            target_plan_id=plan.id,
            metadata=changes,
        )
        return plan

    async def deactivate_plan(self, plan_id: int, *, actor: User) -> SubscriptionPlan:
        plan = await self.get_plan(plan_id)
        plan.is_active = False
        self.session.add(plan)
        await self.session.commit()

        from app.services.subscription_audit_service import log_subscription_action
        await log_subscription_action(
            self.session,
            action=SubscriptionAuditAction.PLAN_DEACTIVATED,
            actor=actor,
            target_plan_id=plan.id,
        )
        return plan

    async def reactivate_plan(self, plan_id: int, *, actor: User) -> SubscriptionPlan:
        plan = await self.get_plan(plan_id)
        plan.is_active = True
        self.session.add(plan)
        await self.session.commit()

        from app.services.subscription_audit_service import log_subscription_action
        await log_subscription_action(
            self.session,
            action=SubscriptionAuditAction.PLAN_REACTIVATED,
            actor=actor,
            target_plan_id=plan.id,
        )
        return plan

    # ------------------------------------------------------------------
    # Feature helpers
    # ------------------------------------------------------------------

    async def _sync_plan_features(self, plan_id: int, feature_ids: list[int]) -> None:
        """Replace the feature links for a plan atomically."""
        # Delete existing links
        existing_links = (await self.session.exec(
            select(PlanFeatureLink).where(PlanFeatureLink.plan_id == plan_id)
        )).all()
        for link in existing_links:
            await self.session.delete(link)

        # Create new links
        for fid in feature_ids:
            self.session.add(PlanFeatureLink(plan_id=plan_id, feature_id=fid))

        await self.session.flush()

    async def list_features(self) -> list[PlatformFeature]:
        return list((await self.session.exec(select(PlatformFeature))).all())
