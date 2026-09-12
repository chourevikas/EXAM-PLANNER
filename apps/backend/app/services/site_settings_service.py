import logging
from datetime import datetime, timezone
from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models.site_settings import SiteSettings, SINGLETON_ID, DEFAULT_THEME
from app.schemas.site_settings import ALLOWED_THEMES

logger = logging.getLogger(__name__)


class SiteSettingsService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def _ensure_table_exists(self):
        try:
            await self.session.execute(
                text("""
                    CREATE TABLE IF NOT EXISTS site_settings (
                        id BIGINT PRIMARY KEY,
                        theme_name VARCHAR(50) NOT NULL DEFAULT 'crimson',
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_by_id BIGINT REFERENCES users(id) ON DELETE SET NULL
                    );
                """)
            )
            await self.session.execute(
                text("""
                    INSERT INTO site_settings (id, theme_name)
                    VALUES (1, 'crimson')
                    ON CONFLICT (id) DO NOTHING;
                """)
            )
            await self.session.commit()
        except Exception as e:
            logger.warning(f"Could not auto-create site_settings table: {e}")
            await self.session.rollback()

    async def get_theme(self) -> SiteSettings:
        try:
            settings = await self.session.get(SiteSettings, SINGLETON_ID)
        except Exception as e:
            logger.warning(f"site_settings query failed (table may not exist yet): {e}. Running self-healing table setup...")
            await self.session.rollback()
            await self._ensure_table_exists()
            settings = await self.session.get(SiteSettings, SINGLETON_ID)

        if settings is None:
            await self._ensure_table_exists()
            try:
                settings = await self.session.get(SiteSettings, SINGLETON_ID)
            except Exception:
                await self.session.rollback()
                settings = None

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

