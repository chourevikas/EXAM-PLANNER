from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional
from sqlmodel import SQLModel, Field, Relationship, Index, Column
import sqlalchemy as sa
from app.db.models.types import DateTimeTZ, BigIntPK

if TYPE_CHECKING:
    from app.db.models.question import QuestionOption


class QuestionOptionReasoning(SQLModel, table=True):
    """Stores per-option distractor analysis and reverse logic (Why it seems tempting / What's actually true)."""

    __tablename__ = "question_option_reasoning"
    __table_args__ = (
        Index("ux_option_reasoning_option", "question_option_id", unique=True),
    )

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    question_option_id: int = Field(
        foreign_key="question_options.id", ondelete="CASCADE", index=True, unique=True
    )
    why_tempting: str = Field(sa_column=Column(sa.Text, nullable=False))
    whats_actually_true: str = Field(sa_column=Column(sa.Text, nullable=False))
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    option: Optional["QuestionOption"] = Relationship(back_populates="reasoning")
