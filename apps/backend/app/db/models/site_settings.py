from datetime import datetime, timezone
from typing import Optional

from sqlmodel import SQLModel, Field

from app.db.models.types import DateTimeTZ, BigIntPK

SINGLETON_ID = 1
DEFAULT_THEME = "crimson"


class SiteSettings(SQLModel, table=True):
    __tablename__ = "site_settings"

    id: int = Field(default=SINGLETON_ID, primary_key=True, sa_type=BigIntPK)
    theme_name: str = Field(default=DEFAULT_THEME, max_length=50)
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
    updated_by_id: Optional[int] = Field(
        default=None, foreign_key="users.id", ondelete="SET NULL"
    )
