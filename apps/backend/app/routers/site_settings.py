from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_session
from app.db.models.user import User, UserRole
from app.core.deps import require_roles, require_admin_section
from app.schemas.site_settings import ThemeOut, ThemeUpdatePayload
from app.services.site_settings_service import SiteSettingsService

router = APIRouter(prefix="/site-settings", tags=["Site Settings"])


@router.get("/theme", response_model=ThemeOut)
async def get_active_theme(session: AsyncSession = Depends(get_async_session)):
    return await SiteSettingsService(session).get_theme()


@router.put("/theme", response_model=ThemeOut)
async def update_active_theme(
    payload: ThemeUpdatePayload,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_admin_section("admin.theme")),
):
    try:
        return await SiteSettingsService(session).set_theme(payload.theme_name, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
