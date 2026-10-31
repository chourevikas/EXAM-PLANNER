import datetime as dt
from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship, Index
from app.db.models.types import DateTimeTZ, BigIntPK
from app.db.models.enums import StudyActivityType, ActivitySource

if TYPE_CHECKING:
    from app.db.models.user import User

class StudyTask(SQLModel, table=True):
    __tablename__ = "study_tasks"
    __table_args__ = (
        Index("ix_study_tasks_user_scheduled", "user_id", "scheduled_date"),
        Index("ix_study_tasks_user_completed", "user_id", "is_completed"),
    )

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    user_id: int = Field(foreign_key="users.id", index=True, ondelete="CASCADE")
    title: str = Field(max_length=255)
    description: Optional[str] = Field(default=None)
    
    subject: Optional[str] = Field(default=None, index=True)
    topic: Optional[str] = Field(default=None)
    subtopic: Optional[str] = Field(default=None)
    
    priority: str = Field(default="MEDIUM")  # HIGH, MEDIUM, LOW
    allocated_time_minutes: int = Field(default=30)
    activity_type: str = Field(default="CONCEPT_REVISION")  # CONCEPT_REVISION, PRACTICE_MCQS, PYQ_SOLVING, MOCK_TEST, NOTES_REVIEW
    
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
    
    is_ai_recommended: bool = Field(default=False)
    source_attempt_id: Optional[int] = Field(default=None, index=True)

    # Study Planner v2: the plan that made this task, the syllabus subtopic it covers, and its daily block
    # (ca | pyq | custom | aw | mock | rev | auto_rev). All empty on the student's own tasks.
    plan_id: Optional[int] = Field(default=None, foreign_key="study_plans.id", ondelete="SET NULL", index=True)
    planner_subtopic_id: Optional[int] = Field(default=None, foreign_key="planner_subtopics.id", ondelete="SET NULL")
    block: Optional[str] = Field(default=None, max_length=20)

    user: Optional["User"] = Relationship(back_populates="study_tasks")

class StudyActivity(SQLModel, table=True):
    __tablename__ = "study_activities"
    __table_args__ = (
        Index("ix_study_activities_user_date", "user_id", "date"),
    )

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    user_id: int = Field(foreign_key="users.id", index=True, ondelete="CASCADE")
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
