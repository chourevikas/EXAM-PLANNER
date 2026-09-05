from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship, Index
from app.db.models.types import DateTimeTZ, BigIntPK

if TYPE_CHECKING:
    from app.db.models.hierarchy import Exam


class ExamType(SQLModel, table=True):
    __tablename__ = "exam_types"
    __table_args__ = (
        Index("ix_exam_types_type", "type"),
        Index("ix_exam_types_active", "is_active"),
    )

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    type: str = Field(
        unique=True,
        index=True,
        max_length=50,
        description="Canonical exam type code e.g. upse, mpse, upsc",
    )
    name: str = Field(
        max_length=200,
        description="Human readable name e.g. UPSE Civil Services Examination",
    )
    total_duration: int = Field(
        default=120,
        description="Total duration in minutes e.g. 120",
    )
    number_of_questions: int = Field(
        default=100,
        description="Total number of questions in paper e.g. 100",
    )
    total_marks: float = Field(
        default=200.0,
        description="Total marks for the exam e.g. 200.0",
    )
    negative_marks: float = Field(
        default=0.66,
        description="Marks deducted for incorrect answer e.g. 0.66",
    )
    positive_marks: float = Field(
        default=2.0,
        description="Marks awarded for correct answer e.g. 2.0",
    )
    description: Optional[str] = Field(
        default=None,
        description="Detailed description or instructions for the exam type",
    )
    is_active: bool = Field(default=True, index=True)

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    # Relationships
    exams: List["Exam"] = Relationship(back_populates="exam_type_entity")
