from datetime import datetime, timezone

from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models.site_settings import SiteSettings, SINGLETON_ID, DEFAULT_THEME
from app.schemas.site_settings import ALLOWED_THEMES


class SiteSettingsService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_theme(self) -> SiteSettings:
        settings = await self.session.get(SiteSettings, SINGLETON_ID)
        if settings is None:
            settings = SiteSettings(id=SINGLETON_ID, theme_name=DEFAULT_THEME)
            self.session.add(settings)
            await self.session.commit()
            await self.session.refresh(settings)
        return settings

    async def set_theme(self, theme_name: str, updated_by_id: int) -> SiteSettings:
        if theme_name not in ALLOWED_THEMES:
            raise ValueError(f"theme_name must be one of {sorted(ALLOWED_THEMES)}")

        settings = await self.get_theme()
        settings.theme_name = theme_name
        settings.updated_at = datetime.now(timezone.utc)
        settings.updated_by_id = updated_by_id
        self.session.add(settings)
        await self.session.commit()
        await self.session.refresh(settings)
        return settings
