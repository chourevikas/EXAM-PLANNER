from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship, Index
from app.db.models.types import DateTimeTZ, BigIntPK

if TYPE_CHECKING:
    from app.db.models.hierarchy import Exam


class PipelineRun(SQLModel, table=True):
    __tablename__ = "pipeline_runs"
    __table_args__ = (
        Index("ix_pipeline_runs_exam_type", "exam_id", "pipeline_type"),
    )

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    exam_id: int = Field(foreign_key="exams.id", ondelete="CASCADE", index=True)
    
    pipeline_type: str = Field(
        description="'DOCUMENT_EXTRACTION', 'QUESTION_EXTRACTION', 'ANSWER_KEY', 'EXPLANATION_INDEXING'",
        max_length=50,
    )
    extraction_method: Optional[str] = Field(
        default="DOCLING_REGEX",
        max_length=20,
    )
    status: str = Field(
        default="PENDING",
        description="'PENDING', 'RUNNING', 'WAITING_FOR_ANSWER_KEY', 'WAITING_FOR_HITL', 'COMPLETED', 'FAILED'",
        max_length=50,
        index=True,
    )
    current_step: str = Field(default="INITIALIZING", max_length=100)
    progress_percent: float = Field(default=0.0)
    error_log: Optional[str] = Field(default=None)

    started_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
    completed_at: Optional[datetime] = Field(default=None, sa_type=DateTimeTZ)

    exam: Optional["Exam"] = Relationship(back_populates="pipeline_runs")
