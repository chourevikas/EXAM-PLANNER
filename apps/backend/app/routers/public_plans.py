from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.db.session import get_async_session
from app.db.models.subscription import SubscriptionPlan

router = APIRouter(prefix="/plans", tags=["Public — Plans"])

@router.get("")
async def list_public_plans(session: AsyncSession = Depends(get_async_session)):
    stmt = (
        select(SubscriptionPlan)
        .where(SubscriptionPlan.is_active == True)
        .order_by(SubscriptionPlan.display_order.asc())
    )
    result = await session.exec(stmt)
    plans = result.all()
    return {"plans": [p.model_dump() for p in plans]}
