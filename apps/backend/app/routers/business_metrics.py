"""Super admin: revenue and engagement (Admin → Revenue & Engagement)."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.deps import require_roles
from app.db.models.user import User, UserRole
from app.db.session import get_async_session
from app.services import business_metrics_service as metrics

router = APIRouter(prefix="/admin/business-metrics", tags=["Super Admin: Revenue & Engagement"])
super_admin_only = require_roles([UserRole.SUPER_ADMIN])


@router.get("", summary="Revenue and engagement for a period")
async def get_business_metrics(
    range: str = Query(default="30d", pattern="^(7d|30d|90d|365d)$", description="7d, 30d, 90d or 365d"),
    _admin: User = Depends(super_admin_only),
    session: AsyncSession = Depends(get_async_session),
):
    days = metrics.range_days(range)
    now = datetime.now(timezone.utc)
    return {
        "range": range,
        "generated_at": now.isoformat(),
        "revenue": await metrics.revenue(session, days, now),
        "engagement": await metrics.engagement(session, days, now),
    }
