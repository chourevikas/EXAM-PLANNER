import uuid
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship, Index
from app.db.models.enums import BloomsLevel

if TYPE_CHECKING:
    from app.db.models.question import Question


class QuestionMetadata(SQLModel, table=True):
    __tablename__ = "question_metadata"
    __table_args__ = (
        Index("ix_q_meta_blooms", "blooms_level"),
        Index("ix_q_meta_concept", "primary_concept_tag"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    question_id: uuid.UUID = Field(
        foreign_key="questions.id", ondelete="CASCADE", unique=True, index=True
    )
    blooms_level: BloomsLevel = Field(default=BloomsLevel.ANALYZE, index=True)
    cognitive_skill: Optional[str] = Field(default=None)
    primary_concept_tag: str = Field(default="GENERAL", index=True)
    irt_discrimination_a: float = Field(default=1.50)
    irt_difficulty_b: float = Field(default=0.00)
    irt_pseudo_guessing_c: float = Field(default=0.25)

    question: Optional["Question"] = Relationship(back_populates="metadata_record")
