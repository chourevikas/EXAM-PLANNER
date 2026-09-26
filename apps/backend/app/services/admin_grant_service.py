"""
AdminGrantService — Manual grant and revoke of subscriptions by Super Admins.

Core rules enforced (spec Section C):
  2. Conflict check: never silently overwrite an active subscription.
     Caller must pass explicit conflict_strategy: REJECT | EXTEND | REPLACE.
  5. Tier sync: always calls _sync_tier() so StudentProfile.subscription_tier stays consistent.
  6. Revenue exclusion: all grants use source=ADMIN_GRANT.
  7. Audit: every action logs to SubscriptionAuditLog.
"""
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from enum import Enum
from typing import Optional

from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models.subscription import (
    UserSubscription,
    SubscriptionPlan,
    SubscriptionStatus,
    SubscriptionSource,
)
from app.db.models.subscription_audit import SubscriptionAuditAction
from app.db.models.user import User, SubscriptionTier, StudentProfile


class ConflictStrategy(str, Enum):
    REJECT = "REJECT"    # Return 409, do nothing
    EXTEND = "EXTEND"    # Extend the existing subscription's period end date
    REPLACE = "REPLACE"  # Cancel the existing and create a new one


class AdminGrantService:
    def __init__(self, session: AsyncSession):
        self.session = session

    # ------------------------------------------------------------------
    # Grant
    # ------------------------------------------------------------------

    async def grant(
        self,
        *,
        actor: User,
        target_user_id: int,
        plan_id: int,
        reason: str,  # mandatory (spec FR-11)
        duration_days: int = 30,
        conflict_strategy: ConflictStrategy = ConflictStrategy.REJECT,
        discount_offer_id: Optional[int] = None,
    ) -> UserSubscription:
        if not reason or not reason.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="A reason is required for admin subscription grants."
            )

        # Validate plan
        plan = (await self.session.exec(
            select(SubscriptionPlan).where(
                SubscriptionPlan.id == plan_id,
                SubscriptionPlan.is_active == True,
            )
        )).first()
        if not plan:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found or inactive.")

        # Validate target user exists
        target_user = (await self.session.exec(
            select(User).where(User.id == target_user_id)
        )).first()
        if not target_user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target user not found.")

        # Check for active subscription conflict
        existing_sub = (await self.session.exec(
            select(UserSubscription).where(
                UserSubscription.user_id == target_user_id,
                UserSubscription.status == SubscriptionStatus.ACTIVE,
            )
        )).first()

        if existing_sub:
            if conflict_strategy == ConflictStrategy.REJECT:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "User already has an active subscription. "
                        "Pass conflict_strategy=EXTEND or REPLACE to proceed."
                    )
                )
            elif conflict_strategy == ConflictStrategy.EXTEND:
                return await self._extend(
                    existing_sub=existing_sub,
                    actor=actor,
                    duration_days=duration_days,
                    reason=reason,
                )
            elif conflict_strategy == ConflictStrategy.REPLACE:
                await self._cancel_subscription(existing_sub, actor=actor, reason=f"Replaced by grant: {reason}")

        # Create new ADMIN_GRANT subscription
        now = datetime.now(timezone.utc)
        new_sub = UserSubscription(
            user_id=target_user_id,
            plan_id=plan_id,
            status=SubscriptionStatus.ACTIVE,
            source=SubscriptionSource.ADMIN_GRANT,
            granted_by_admin_id=actor.id,
            grant_reason=reason,
            current_period_start=now,
            current_period_end=now + timedelta(days=duration_days),
            discount_offer_id=discount_offer_id,
            # Price snapshot (spec rule 1): lock in the plan's current price
            original_price=Decimal(plan.price_cents),
            discounted_price=Decimal("0"),  # admin grants cost nothing
        )
        self.session.add(new_sub)
        await self.session.flush()

        # Sync tier (spec rule 5)
        await self._sync_tier(target_user_id, SubscriptionTier.PREMIUM)

        await self.session.commit()

        # Audit (spec rule 7)
        from app.services.subscription_audit_service import log_subscription_action
        await log_subscription_action(
            self.session,
            action=SubscriptionAuditAction.SUBSCRIPTION_GRANTED,
            actor=actor,
            target_user_id=target_user_id,
            target_plan_id=plan_id,
            target_offer_id=discount_offer_id,
            target_subscription_id=new_sub.id,
            metadata={
                "reason": reason,
                "duration_days": duration_days,
                "conflict_strategy": conflict_strategy.value,
            },
        )

        # Notify user (async, non-blocking)
        try:
            from app.services.email_service import email_service
            import asyncio
            asyncio.create_task(email_service.send_admin_grant_notification(
                email=target_user.email,
                user_name=target_user.full_name,
                plan_name=plan.name,
                expires_at=new_sub.current_period_end,
                reason=reason,
                granted_by=actor.full_name,
            ))
        except Exception:
            pass  # email failure must never block the grant

        return new_sub

    async def _extend(
        self,
        *,
        existing_sub: UserSubscription,
        actor: User,
        duration_days: int,
        reason: str,
    ) -> UserSubscription:
        """Extend an existing subscription's period end date."""
        old_end = existing_sub.current_period_end
        if old_end.tzinfo is None:
            old_end = old_end.replace(tzinfo=timezone.utc)
        existing_sub.current_period_end = old_end + timedelta(days=duration_days)
        existing_sub.updated_at = datetime.now(timezone.utc)
        self.session.add(existing_sub)
        await self.session.flush()

        from app.services.subscription_audit_service import log_subscription_action
        await log_subscription_action(
            self.session,
            action=SubscriptionAuditAction.SUBSCRIPTION_EXTENDED,
            actor=actor,
            target_user_id=existing_sub.user_id,
            target_subscription_id=existing_sub.id,
            metadata={
                "reason": reason,
                "added_days": duration_days,
                "new_end": existing_sub.current_period_end.isoformat(),
            },
        )
        await self.session.commit()
        return existing_sub

    # ------------------------------------------------------------------
    # Revoke
    # ------------------------------------------------------------------

    async def revoke(
        self,
        *,
        actor: User,
        target_user_id: int,
        subscription_id: Optional[int] = None,
        reason: str,  # mandatory (spec FR-14)
    ) -> UserSubscription:
        if not reason or not reason.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="A reason is required for revoking a subscription."
            )

        if subscription_id is not None:
            sub = (await self.session.exec(
                select(UserSubscription).where(
                    UserSubscription.id == subscription_id,
                    UserSubscription.user_id == target_user_id,
                )
            )).first()
        else:
            sub = (await self.session.exec(
                select(UserSubscription).where(
                    UserSubscription.user_id == target_user_id,
                    UserSubscription.status == SubscriptionStatus.ACTIVE,
                )
            )).first()

        if not sub:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found.")
        if sub.status != SubscriptionStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Only ACTIVE subscriptions can be revoked."
            )

        await self._cancel_subscription(sub, actor=actor, reason=reason)

        # Sync tier back to FREE (spec rule 5 + FR-14)
        # Only revert if there's no other active subscription
        other_active = (await self.session.exec(
            select(UserSubscription).where(
                UserSubscription.user_id == target_user_id,
                UserSubscription.status == SubscriptionStatus.ACTIVE,
                UserSubscription.id != subscription_id,
            )
        )).first()
        if not other_active:
            await self._sync_tier(target_user_id, SubscriptionTier.FREE)

        await self.session.commit()

        # Audit
        from app.services.subscription_audit_service import log_subscription_action
        await log_subscription_action(
            self.session,
            action=SubscriptionAuditAction.SUBSCRIPTION_REVOKED,
            actor=actor,
            target_user_id=target_user_id,
            target_subscription_id=sub.id,
            metadata={"reason": reason, "source": getattr(sub.source, "value", str(sub.source))},
        )

        # Notify user
        target_user = (await self.session.exec(
            select(User).where(User.id == target_user_id)
        )).first()
        if target_user:
            try:
                from app.services.email_service import email_service
                import asyncio
                asyncio.create_task(email_service.send_admin_revoke_notification(
                    email=target_user.email,
                    user_name=target_user.full_name,
                    reason=reason,
                    revoked_by=actor.full_name,
                ))
            except Exception:
                pass

        return sub

    # ------------------------------------------------------------------
    # Subscription history
    # ------------------------------------------------------------------

    async def get_user_subscription_history(self, user_id: int) -> list[UserSubscription]:
        return list((await self.session.exec(
            select(UserSubscription)
            .where(UserSubscription.user_id == user_id)
            .order_by(UserSubscription.created_at.desc())
        )).all())

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _cancel_subscription(
        self, sub: UserSubscription, *, actor: User, reason: str
    ) -> None:
        sub.status = SubscriptionStatus.CANCELED
        sub.cancel_at_period_end = False
        sub.updated_at = datetime.now(timezone.utc)
        self.session.add(sub)
        await self.session.flush()

    async def _sync_tier(self, user_id: int, tier: SubscriptionTier) -> None:
        """Keep StudentProfile.subscription_tier in sync — single authoritative function."""
        prof = (await self.session.exec(
            select(StudentProfile).where(StudentProfile.user_id == user_id)
        )).first()
        if prof:
            prof.subscription_tier = tier
            self.session.add(prof)
        else:
            self.session.add(StudentProfile(user_id=user_id, subscription_tier=tier))
        await self.session.flush()
