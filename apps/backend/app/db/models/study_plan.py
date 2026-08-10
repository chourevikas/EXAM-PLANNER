import uuid
from datetime import date, datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field
from app.db.models.types import DateTimeTZ

class StudyTask(SQLModel, table=True):
    __tablename__ = "study_tasks"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True, ondelete="CASCADE")
    title: str = Field(max_length=255)
    description: Optional[str] = Field(default=None)
    scheduled_date: date = Field(index=True)
    is_completed: bool = Field(default=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
    completed_at: Optional[datetime] = Field(default=None, sa_type=DateTimeTZ)
