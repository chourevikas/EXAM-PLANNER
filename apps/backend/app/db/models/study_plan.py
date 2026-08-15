import uuid
import datetime as dt
from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from app.db.models.types import DateTimeTZ
from app.db.models.enums import StudyActivityType, ActivitySource

if TYPE_CHECKING:
    from app.db.models.user import User

class StudyTask(SQLModel, table=True):
    __tablename__ = "study_tasks"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True, ondelete="CASCADE")
    title: str = Field(max_length=255)
    description: Optional[str] = Field(default=None)
    scheduled_date: dt.date = Field(
        default_factory=lambda: datetime.now(timezone.utc).date(),
        index=True
    )
    is_completed: bool = Field(default=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
    completed_at: Optional[datetime] = Field(default=None, sa_type=DateTimeTZ)

    user: Optional["User"] = Relationship(back_populates="study_tasks")

class StudyActivity(SQLModel, table=True):
    __tablename__ = "study_activities"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True, ondelete="CASCADE")
    date: dt.date = Field(default_factory=lambda: datetime.now(timezone.utc).date(), index=True)
    
    activity_type: StudyActivityType
    activity_source: ActivitySource = Field(default=ActivitySource.UNPLANNED)
    subject: Optional[str] = Field(default=None)
    topic: Optional[str] = Field(default=None)
    duration_minutes: int = Field(default=0)
    
    questions_attempted: Optional[int] = Field(default=None)
    questions_correct: Optional[int] = Field(default=None)
    score: Optional[float] = Field(default=None)
    confidence_rating: Optional[int] = Field(default=None)
    
    notes: Optional[str] = Field(default=None)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    user: Optional["User"] = Relationship(back_populates="study_activities")
