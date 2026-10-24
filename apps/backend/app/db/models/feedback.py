from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Column, Text, Index
from sqlmodel import SQLModel, Field
from app.db.models.types import BigIntPK, DateTimeTZ


class UserFeedback(SQLModel, table=True):
    """A problem report or suggestion a student sent from the app ("Report a problem")."""

    __tablename__ = "user_feedback"
    __table_args__ = (Index("ix_user_feedback_status_created", "status", "created_at"),)

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    category: str = Field(max_length=20)  # BUG | CONTENT | IDEA | OTHER
    message: str = Field(sa_column=Column(Text, nullable=False))
    page_url: Optional[str] = Field(default=None, max_length=500)
    user_agent: Optional[str] = Field(default=None, max_length=300)
    screenshot_path: Optional[str] = Field(default=None, max_length=255)
    status: str = Field(default="OPEN", max_length=20)  # OPEN | RESOLVED | DISMISSED
    admin_note: Optional[str] = Field(default=None, sa_column=Column(Text))
    resolved_by_id: Optional[int] = Field(default=None, foreign_key="users.id", ondelete="SET NULL")
    resolved_at: Optional[datetime] = Field(default=None, sa_type=DateTimeTZ)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
