import uuid
from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship, Column, Index
from app.db.models.types import PortableJSON, DateTimeTZ

if TYPE_CHECKING:
    from app.db.models.question import Question
    from app.db.models.hierarchy import Exam
    from app.db.models.user import User


class HumanReviewTask(SQLModel, table=True):
    __tablename__ = "human_review_tasks"
    __table_args__ = (
        Index("ix_review_tasks_status_exam", "review_status", "exam_id"),
        Index("ix_review_tasks_flagged", "is_flagged_by_validator", "review_status"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    int_id: Optional[int] = Field(default=None)
    question_id: uuid.UUID = Field(
        foreign_key="questions.id", ondelete="CASCADE", index=True
    )
    question_int_id: Optional[int] = Field(default=None, index=True)
    exam_id: uuid.UUID = Field(foreign_key="exams.id", ondelete="CASCADE", index=True)
    exam_int_id: Optional[int] = Field(default=None, index=True)
    assigned_admin_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="users.id", ondelete="SET NULL", index=True
    )
    assigned_admin_int_id: Optional[int] = Field(default=None, index=True)

    review_status: str = Field(
        default="PENDING_REVIEW",
        index=True,
        description="PENDING_REVIEW, VERIFIED, REJECTED, EDITED_AND_VERIFIED",
    )
    is_flagged_by_validator: bool = Field(default=False, index=True)
    failure_reasons_json: Optional[list] = Field(
        default=[],
        sa_column=Column(PortableJSON),
        description="JSON list of automated audit warnings",
    )
    reviewer_notes: Optional[str] = Field(default=None)

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
    reviewed_at: Optional[datetime] = Field(default=None, sa_type=DateTimeTZ)

    question: Optional["Question"] = Relationship(back_populates="review_tasks")
    exam: Optional["Exam"] = Relationship(back_populates="review_tasks")
    assigned_admin: Optional["User"] = Relationship()
