"""
Admin Plans Router — Super Admin CRUD for SubscriptionPlan and PlatformFeature.

Endpoints:
  GET    /admin/plans
  POST   /admin/plans
  PUT    /admin/plans/{plan_id}
  POST   /admin/plans/{plan_id}/deactivate
  POST   /admin/plans/{plan_id}/reactivate
  GET    /admin/plans/features
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.deps import get_async_session, require_roles
from app.db.models.enums import UserRole
from app.db.models.subscription import BillingInterval, SubscriptionPlan
from app.db.models.user import User
from app.services.plan_service import PlanService

router = APIRouter(prefix="/admin/plans", tags=["Admin — Plans"])

_superadmin_only = require_roles([UserRole.SUPER_ADMIN])


# ── Schemas (inline Pydantic for simplicity) ──────────────────────────────────
from pydantic import BaseModel, Field as PydanticField


class PlanCreateRequest(BaseModel):
    plan_code: str = PydanticField(..., max_length=100)
    name: str = PydanticField(..., max_length=200)
    description: Optional[str] = None
    price_cents: int = PydanticField(default=0, ge=0)
    currency: str = PydanticField(default="INR", max_length=10)
    billing_interval: BillingInterval = BillingInterval.MONTHLY
    display_order: int = 0
    feature_ids: Optional[list[int]] = None
    metadata_json: Optional[dict] = None


class PlanUpdateRequest(BaseModel):
    name: Optional[str] = PydanticField(default=None, max_length=200)
    description: Optional[str] = None
    price_cents: Optional[int] = PydanticField(default=None, ge=0)
    currency: Optional[str] = PydanticField(default=None, max_length=10)
    billing_interval: Optional[BillingInterval] = None
    display_order: Optional[int] = None
    feature_ids: Optional[list[int]] = None
    metadata_json: Optional[dict] = None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", summary="List all subscription plans")
async def list_plans(
    include_inactive: bool = Query(default=False),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(_superadmin_only),
):
    svc = PlanService(session)
    plans = await svc.list_plans(include_inactive=include_inactive)
    return {"plans": [p.model_dump() for p in plans]}


@router.post("", summary="Create a new subscription plan", status_code=201)
async def create_plan(
    body: PlanCreateRequest,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(_superadmin_only),
):
    svc = PlanService(session)
    plan = await svc.create_plan(
        actor=current_user,
        plan_code=body.plan_code,
        name=body.name,
        description=body.description,
        price_cents=body.price_cents,
        currency=body.currency,
        billing_interval=body.billing_interval,
        display_order=body.display_order,
        feature_ids=body.feature_ids,
        metadata_json=body.metadata_json,
    )
    return _plan_dict(plan)


def _plan_dict(plan: SubscriptionPlan) -> dict:
    return {
        "id": plan.id,
        "plan_code": plan.plan_code,
        "name": plan.name,
        "description": plan.description,
        "price_cents": plan.price_cents,
        "currency": plan.currency,
        "billing_interval": plan.billing_interval.value if hasattr(plan.billing_interval, 'value') else str(plan.billing_interval),
        "display_order": plan.display_order,
        "is_active": plan.is_active,
        "metadata_json": plan.metadata_json,
        "created_at": plan.created_at.isoformat() if plan.created_at else None,
    }


@router.put("/{plan_id}", summary="Update an existing plan (future subscriptions only)")
async def update_plan(
    plan_id: int,
    body: PlanUpdateRequest,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(_superadmin_only),
):
    svc = PlanService(session)
    plan = await svc.update_plan(
        plan_id,
        actor=current_user,
        name=body.name,
        description=body.description,
        price_cents=body.price_cents,
        currency=body.currency,
        billing_interval=body.billing_interval,
        display_order=body.display_order,
        feature_ids=body.feature_ids,
        metadata_json=body.metadata_json,
    )
    return _plan_dict(plan)


@router.post("/{plan_id}/deactivate", summary="Soft-deactivate a plan")
async def deactivate_plan(
    plan_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(_superadmin_only),
):
    svc = PlanService(session)
    plan = await svc.deactivate_plan(plan_id, actor=current_user)
    return {"success": True, "plan_id": plan.id, "is_active": plan.is_active}


@router.post("/{plan_id}/reactivate", summary="Reactivate a deactivated plan")
async def reactivate_plan(
    plan_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(_superadmin_only),
):
    svc = PlanService(session)
    plan = await svc.reactivate_plan(plan_id, actor=current_user)
    return {"success": True, "plan_id": plan.id, "is_active": plan.is_active}


@router.get("/features", summary="List all platform features")
async def list_features(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(_superadmin_only),
):
    svc = PlanService(session)
    features = await svc.list_features()
    return {"features": [f.model_dump() for f in features]}
