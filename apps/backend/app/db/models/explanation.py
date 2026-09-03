from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional
from sqlmodel import SQLModel, Field, Relationship, Index, Column
from app.db.models.enums import LanguageCode
from app.db.models.types import PortableJSON, DateTimeTZ, BigIntPK

if TYPE_CHECKING:
    from app.db.models.question import Question


class QuestionExplanation(SQLModel, table=True):
    """Static question-level knowledge base and detailed solution explanation cached per language."""

    __tablename__ = "question_explanations"
    __table_args__ = (
        Index("ix_q_expl_question_lang", "question_id", "language", unique=True),
    )

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    question_id: int = Field(
        foreign_key="questions.id", ondelete="CASCADE", index=True
    )
    language: LanguageCode = Field(default=LanguageCode.ENGLISH, index=True)

    core_concept: Optional[str] = Field(
        default=None,
        description="Primary formula, theorem, or rule being tested in 1 sentence",
    )
    detailed_solution: str = Field(
        description="Step-by-step proof, calculation, or logical derivation"
    )
    common_mistake: Optional[str] = Field(
        default=None,
        description="Common mistake or pitfall identified in the solution",
    )
    common_traps_json: Optional[list] = Field(
        default=[],
        sa_column=Column(PortableJSON),
        description="List of common misconceptions or calculation pitfalls",
    )
    key_takeaways_json: Optional[list] = Field(
        default=[],
        sa_column=Column(PortableJSON),
        description="High-yield bullet points for revision",
    )

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    question: Optional["Question"] = Relationship(back_populates="explanation_records")
