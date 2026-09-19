from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Column, Text, Index
from sqlmodel import SQLModel, Field
from app.db.models.types import BigIntPK, DateTimeTZ


class QuestionReport(SQLModel, table=True):
    """A student-submitted problem report about a published question."""

    __tablename__ = "question_reports"
    __table_args__ = (Index("ix_question_reports_question_status", "question_id", "status"),)

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    question_id: int = Field(foreign_key="questions.id", ondelete="CASCADE", index=True)
    reporter_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    reason: str = Field(max_length=50)
    description: Optional[str] = Field(default=None, sa_column=Column(Text))
    status: str = Field(default="OPEN", max_length=20, index=True)  # OPEN | RESOLVED | REJECTED
    admin_note: Optional[str] = Field(default=None, sa_column=Column(Text))
    resolved_by_id: Optional[int] = Field(default=None, foreign_key="users.id", ondelete="SET NULL")
    resolved_at: Optional[datetime] = Field(default=None, sa_type=DateTimeTZ)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
