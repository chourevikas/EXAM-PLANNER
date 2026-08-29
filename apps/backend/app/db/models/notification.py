import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field
from app.db.models.types import DateTimeTZ

class Notification(SQLModel, table=True):
    __tablename__ = "notifications"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    title: str = Field(..., max_length=255)
    message: str = Field(...)
    notification_type: str = Field(default="GENERAL", max_length=50) # PENDING_TASKS, TEST_REPORT_READY, REMEDIAL_TASKS_ADDED, STREAK_MILESTONE
    action_url: Optional[str] = Field(default=None, max_length=255)
    is_read: bool = Field(default=False, index=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
