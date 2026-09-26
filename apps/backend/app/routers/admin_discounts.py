"""
Admin Discounts Router — Super Admin management of DiscountOffers and Redemptions.
Also includes the public /discounts/validate endpoint used at checkout.

Admin endpoints (SUPER_ADMIN only):
  GET    /admin/discounts
  POST   /admin/discounts
  PUT    /admin/discounts/{offer_id}
  POST   /admin/discounts/{offer_id}/deactivate
  GET    /admin/discounts/{offer_id}/redemptions

Public endpoint (authenticated user):
  POST   /discounts/validate
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field as PydanticField
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.deps import get_async_session, require_roles, get_current_user
from app.db.models.enums import UserRole
from app.db.models.discount import DiscountType
from app.db.models.user import User
from app.services.discount_service import DiscountService, DiscountValidationError

admin_router = APIRouter(prefix="/admin/discounts", tags=["Admin — Discounts"])
public_router = APIRouter(prefix="/discounts", tags=["Discounts"])

_superadmin_only = require_roles([UserRole.SUPER_ADMIN])


# ── Schemas ───────────────────────────────────────────────────────────────────

class DiscountCreateRequest(BaseModel):
    name: str = PydanticField(..., max_length=200)
    discount_type: DiscountType
    value: Decimal = PydanticField(..., ge=0)
    valid_from: datetime
    description: Optional[str] = None
    code: Optional[str] = PydanticField(default=None, max_length=100)
    max_redemptions: Optional[int] = PydanticField(default=None, ge=1)
    max_redemptions_per_user: int = PydanticField(default=1, ge=1)
    valid_until: Optional[datetime] = None
    is_public: bool = True
    applicable_plan_ids: Optional[list[int]] = None


class DiscountUpdateRequest(BaseModel):
    name: Optional[str] = PydanticField(default=None, max_length=200)
    description: Optional[str] = None
    value: Optional[Decimal] = PydanticField(default=None, ge=0)
    max_redemptions: Optional[int] = PydanticField(default=None, ge=1)
    max_redemptions_per_user: Optional[int] = PydanticField(default=None, ge=1)
    valid_until: Optional[datetime] = None
    is_public: Optional[bool] = None
    applicable_plan_ids: Optional[list[int]] = None


class ValidateDiscountRequest(BaseModel):
    code: str
    plan_id: int


# ── Admin Routes ──────────────────────────────────────────────────────────────

@admin_router.get("", summary="List all discount offers")
async def list_offers(
    include_inactive: bool = False,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(_superadmin_only),
):
    svc = DiscountService(session)
    offers = await svc.list_offers(include_inactive=include_inactive)
    return {"offers": [_offer_dict(o) for o in offers]}


@admin_router.post("", summary="Create a new discount offer", status_code=201)
async def create_offer(
    body: DiscountCreateRequest,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(_superadmin_only),
):
    svc = DiscountService(session)
    offer = await svc.create_offer(
        actor=current_user,
        name=body.name,
        discount_type=body.discount_type,
        value=body.value,
        valid_from=body.valid_from,
        description=body.description,
        code=body.code,
        max_redemptions=body.max_redemptions,
        max_redemptions_per_user=body.max_redemptions_per_user,
        valid_until=body.valid_until,
        is_public=body.is_public,
        applicable_plan_ids=body.applicable_plan_ids,
    )
    return _offer_dict(offer)


@admin_router.put("/{offer_id}", summary="Update an existing discount offer")
async def update_offer(
    offer_id: int,
    body: DiscountUpdateRequest,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(_superadmin_only),
):
    svc = DiscountService(session)
    offer = await svc.update_offer(
        offer_id,
        actor=current_user,
        name=body.name,
        description=body.description,
        value=body.value,
        max_redemptions=body.max_redemptions,
        max_redemptions_per_user=body.max_redemptions_per_user,
        valid_until=body.valid_until,
        is_public=body.is_public,
        applicable_plan_ids=body.applicable_plan_ids,
    )
    return _offer_dict(offer)


@admin_router.post("/{offer_id}/deactivate", summary="Deactivate a discount offer")
async def deactivate_offer(
    offer_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(_superadmin_only),
):
    svc = DiscountService(session)
    offer = await svc.deactivate_offer(offer_id, actor=current_user)
    return {"success": True, "offer_id": offer.id, "is_active": offer.is_active}


@admin_router.get("/{offer_id}/redemptions", summary="View redemptions for a discount")
async def list_redemptions(
    offer_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(_superadmin_only),
):
    svc = DiscountService(session)
    redemptions = await svc.list_redemptions(offer_id)
    return {"offer_id": offer_id, "redemptions": [_redemption_dict(r) for r in redemptions]}


# ── Public Route ──────────────────────────────────────────────────────────────

@public_router.post("/validate", summary="Validate a discount code before checkout")
async def validate_discount(
    body: ValidateDiscountRequest,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Pre-checkout validation (spec FR-8 first check).
    Returns the computed discounted price. The server ALWAYS re-validates
    at the point of payment — this response is informational only and must
    never be trusted as the final price by the client.
    """
    svc = DiscountService(session)
    try:
        offer, discounted_price = await svc.validate(
            code=body.code,
            user=current_user,
            plan_id=body.plan_id,
        )
    except DiscountValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": exc.code, "message": exc.message},
        )

    return {
        "valid": True,
        "offer_id": offer.id,
        "discount_type": offer.discount_type.value if hasattr(offer.discount_type, "value") else str(offer.discount_type),
        "value": str(offer.value),
        "discounted_price": str(discounted_price),
        "message": f"Code '{body.code}' applied successfully.",
    }


def _offer_dict(o) -> dict:
    return {
        "id": o.id, "name": o.name, "description": o.description, "code": o.code,
        "discount_type": o.discount_type.value if hasattr(o.discount_type, 'value') else str(o.discount_type),
        "value": str(o.value), "max_redemptions": o.max_redemptions,
        "redemptions_used": o.redemptions_used,
        "max_redemptions_per_user": o.max_redemptions_per_user,
        "valid_from": o.valid_from.isoformat() if o.valid_from else None,
        "valid_until": o.valid_until.isoformat() if o.valid_until else None,
        "is_active": o.is_active, "is_public": o.is_public,
        "created_by_admin_id": o.created_by_admin_id,
        "created_at": o.created_at.isoformat() if o.created_at else None,
    }

def _redemption_dict(r) -> dict:
    return {
        "id": r.id, "offer_id": r.offer_id, "user_id": r.user_id,
        "user_subscription_id": r.user_subscription_id,
        "status": r.status.value if hasattr(r.status, 'value') else str(r.status),
        "amount_deducted": str(r.amount_deducted) if r.amount_deducted is not None else None,
        "redeemed_at": r.redeemed_at.isoformat() if r.redeemed_at else None,
    }
