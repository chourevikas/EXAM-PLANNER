import uuid
from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from app.db.models.types import DateTimeTZ

if TYPE_CHECKING:
    from app.db.models.user import User

class Badge(SQLModel, table=True):
    __tablename__ = "badges"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(max_length=255)
    description: str
    icon_url: Optional[str] = Field(default=None)
    required_xp: Optional[int] = Field(default=None)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    user_badges: List["UserBadge"] = Relationship(back_populates="badge", cascade_delete=True)

class UserBadge(SQLModel, table=True):
    __tablename__ = "user_badges"
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True, ondelete="CASCADE")
    badge_id: uuid.UUID = Field(foreign_key="badges.id", index=True, ondelete="CASCADE")
    unlocked_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    user: Optional["User"] = Relationship(back_populates="user_badges")
    badge: Optional[Badge] = Relationship(back_populates="user_badges")

class XPLog(SQLModel, table=True):
    __tablename__ = "xp_logs"
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True, ondelete="CASCADE")
    amount: int
    source: str = Field(max_length=100)
    description: Optional[str] = Field(default=None)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    user: Optional["User"] = Relationship(back_populates="xp_logs")
