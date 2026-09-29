from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Index
from sqlmodel import Field, SQLModel

from app.db.models.types import BigIntPK, DateTimeTZ


class LlmUsageEvent(SQLModel, table=True):
    """One LLM request: which feature made it, what it was for, the tokens it used and what it cost.

    exam_id / attempt_id / user_id are plain ids, not foreign keys: usage history must survive the
    deletion of the exam or attempt it was spent on.
    """

    __tablename__ = "llm_usage_events"
    __table_args__ = (
        Index("ix_llm_usage_feature_created", "feature", "created_at"),
        Index("ix_llm_usage_exam", "exam_id"),
    )

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
        index=True,
    )
    feature: str = Field(max_length=64)
    model: str = Field(max_length=64)
    status: str = Field(default="ok", max_length=16)  # ok | error
    error: Optional[str] = Field(default=None, max_length=500)

    exam_id: Optional[int] = Field(default=None)
    attempt_id: Optional[int] = Field(default=None)
    user_id: Optional[int] = Field(default=None)
    detail: Optional[str] = Field(default=None, max_length=128)  # e.g. target language

    input_tokens: int = Field(default=0)
    output_tokens: int = Field(default=0)  # visible output, thinking excluded
    thinking_tokens: int = Field(default=0)
    cached_tokens: int = Field(default=0)  # part of input_tokens read from the context cache
    cost_usd: float = Field(default=0.0)
    cost_inr: float = Field(default=0.0)
    latency_ms: Optional[int] = Field(default=None)
