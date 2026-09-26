"""
Admin Grants Router — Manual subscription grant/revoke and history.

Endpoints:
  POST   /admin/users/{user_id}/subscription/grant
  POST   /admin/users/{user_id}/subscription/revoke
  GET    /admin/users/{user_id}/subscription/history
  GET    /admin/subscription/audit-logs
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel, Field as PydanticField
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.deps import get_async_session, require_roles
from app.db.models.enums import UserRole
from app.db.models.subscription_audit import SubscriptionAuditAction, SubscriptionAuditLog
from app.db.models.user import User
from app.services.admin_grant_service import AdminGrantService, ConflictStrategy

router = APIRouter(tags=["Admin — Subscription Grants"])

_superadmin_only = require_roles([UserRole.SUPER_ADMIN])


# ── Schemas ───────────────────────────────────────────────────────────────────

class GrantRequest(BaseModel):
    plan_id: int
    reason: str = PydanticField(..., min_length=5, max_length=500)
    duration_days: int = PydanticField(default=30, ge=1, le=3650)
    conflict_strategy: ConflictStrategy = ConflictStrategy.REJECT
    discount_offer_id: Optional[int] = None


class RevokeRequest(BaseModel):
    subscription_id: Optional[int] = None
    reason: str = PydanticField(..., min_length=5, max_length=500)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post(
    "/admin/users/{user_identifier}/subscription/grant",
    summary="Manually grant a subscription plan to a user (by ID or email)",
    status_code=201,
)
async def grant_subscription(
    user_identifier: str,
    body: GrantRequest,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(_superadmin_only),
):
    """
    Grant a user Premium access without requiring payment.
    - `user_identifier` can be the user's ID or exact email address.
    - `reason` is mandatory and will be shown to the user in-app.
    - `conflict_strategy` controls what happens if the user already has an active subscription.
    - `duration_days` defaults to 30; can be set up to 3650 (10 years).
    """
    target_user_id = None
    if user_identifier.isdigit():
        target_user_id = int(user_identifier)
    else:
        # Lookup by email
        user_result = await session.exec(select(User).where(User.email == user_identifier))
        user_by_email = user_result.first()
        if not user_by_email:
            raise HTTPException(status_code=404, detail=f"User with email {user_identifier} not found")
        target_user_id = user_by_email.id

    svc = AdminGrantService(session)
    sub = await svc.grant(
        actor=current_user,
        target_user_id=target_user_id,
        plan_id=body.plan_id,
        reason=body.reason,
        duration_days=body.duration_days,
        conflict_strategy=body.conflict_strategy,
        discount_offer_id=body.discount_offer_id,
    )
    return _sub_dict(sub)


@router.post(
    "/admin/users/{user_identifier}/subscription/revoke",
    summary="Revoke a user's subscription immediately (by ID or email)",
)
async def revoke_subscription(
    user_identifier: str,
    body: RevokeRequest,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(_superadmin_only),
):
    """
    Revoke any subscription (paid or granted) early.
    - `user_identifier` can be the user's ID or exact email address.
    - `reason` is mandatory.
    - Immediately flips the user's tier to FREE.
    - The user receives an email notification.
    """
    target_user_id = None
    if user_identifier.isdigit():
        target_user_id = int(user_identifier)
    else:
        user_result = await session.exec(select(User).where(User.email == user_identifier))
        user_by_email = user_result.first()
        if not user_by_email:
            raise HTTPException(status_code=404, detail=f"User with email {user_identifier} not found")
        target_user_id = user_by_email.id

    svc = AdminGrantService(session)
    sub = await svc.revoke(
        actor=current_user,
        target_user_id=target_user_id,
        subscription_id=body.subscription_id,
        reason=body.reason,
    )
    return {"success": True, "subscription_id": sub.id, "status": sub.status.value if hasattr(sub.status, "value") else str(sub.status)}


@router.get(
    "/admin/users/{user_id}/subscription/history",
    summary="View a user's full subscription history",
)
async def get_subscription_history(
    user_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(_superadmin_only),
):
    svc = AdminGrantService(session)
    history = await svc.get_user_subscription_history(user_id)
    return {
        "user_id": user_id,
        "subscriptions": [_sub_dict(s) for s in history],
    }


@router.get(
    "/admin/subscription/audit-logs",
    summary="View subscription audit trail (filterable)",
)
async def get_subscription_audit_logs(
    action_type: Optional[SubscriptionAuditAction] = Query(default=None),
    user_id: Optional[int] = Query(default=None),
    plan_id: Optional[int] = Query(default=None),
    offer_id: Optional[int] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(_superadmin_only),
):
    stmt = select(SubscriptionAuditLog).order_by(SubscriptionAuditLog.created_at.desc())
    if action_type:
        stmt = stmt.where(SubscriptionAuditLog.action_type == action_type.value)
    if user_id:
        stmt = stmt.where(SubscriptionAuditLog.target_user_id == user_id)
    if plan_id:
        stmt = stmt.where(SubscriptionAuditLog.target_plan_id == plan_id)
    if offer_id:
        stmt = stmt.where(SubscriptionAuditLog.target_offer_id == offer_id)

    logs = (await session.exec(stmt.limit(limit).offset(offset))).all()
    return {
        "total": len(logs),
        "logs": [_log_dict(log) for log in logs],
    }


def _sub_dict(s) -> dict:
    from decimal import Decimal
    return {
        "id": s.id, "user_id": s.user_id, "plan_id": s.plan_id,
        "status": s.status.value if hasattr(s.status, 'value') else str(s.status),
        "source": s.source.value if hasattr(s.source, 'value') else str(s.source),
        "granted_by_admin_id": s.granted_by_admin_id,
        "grant_reason": s.grant_reason,
        "discount_offer_id": s.discount_offer_id,
        "original_price": str(s.original_price) if s.original_price is not None else None,
        "discounted_price": str(s.discounted_price) if s.discounted_price is not None else None,
        "current_period_start": s.current_period_start.isoformat() if s.current_period_start else None,
        "current_period_end": s.current_period_end.isoformat() if s.current_period_end else None,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }

def _log_dict(l) -> dict:
    return {
        "id": l.id, "actor_admin_id": l.actor_admin_id,
        "action_type": l.action_type.value if hasattr(l.action_type, 'value') else str(l.action_type),
        "target_user_id": l.target_user_id, "target_plan_id": l.target_plan_id,
        "target_offer_id": l.target_offer_id, "target_subscription_id": l.target_subscription_id,
        "action_metadata": l.action_metadata,
        "created_at": l.created_at.isoformat() if l.created_at else None,
    }
