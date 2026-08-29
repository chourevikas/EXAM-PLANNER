import uuid
from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship, Column, Index
from app.db.models.enums import MemoryType, LanguageCode
from app.db.models.types import PortableJSON, DateTimeTZ

if TYPE_CHECKING:
    from app.db.models.hierarchy import Exam, Subtopic
    from app.db.models.question import Question


class Passage(SQLModel, table=True):
    __tablename__ = "passages"
    __table_args__ = (
        Index("ix_passages_exam_section", "exam_id", "section_code"),
        Index("ix_passages_subtopic", "subtopic_id"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    int_id: Optional[int] = Field(default=None)
    subtopic_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="subtopics.id", ondelete="SET NULL", index=True
    )
    subtopic_int_id: Optional[int] = Field(default=None, index=True)
    exam_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="exams.id", ondelete="CASCADE", index=True
    )
    exam_int_id: Optional[int] = Field(default=None, index=True)
    section_code: str = Field(default="DEFAULT", index=True, max_length=50)
    memory_type: MemoryType = Field(default=MemoryType.PASSAGE, index=True)
    is_complete: bool = Field(default=True, index=True)
    page_numbers_json: Optional[list] = Field(
        default=[],
        sa_column=Column(PortableJSON),
        description="JSON array of page numbers e.g. [1, 2]",
    )
    question_ids_json: Optional[list] = Field(
        default=[],
        sa_column=Column(PortableJSON),
        description="JSON array of linked question UUID strings",
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    exam: Optional["Exam"] = Relationship(back_populates="passages")
    subtopic: Optional["Subtopic"] = Relationship(back_populates="passages")
    questions: List["Question"] = Relationship(back_populates="passage")
    translations: List["PassageTranslation"] = Relationship(
        back_populates="passage", cascade_delete=True
    )


class PassageTranslation(SQLModel, table=True):
    __tablename__ = "passage_translations"
    __table_args__ = (
        Index("ix_passage_trans_unique", "passage_id", "language", unique=True),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    int_id: Optional[int] = Field(default=None)
    passage_id: uuid.UUID = Field(
        foreign_key="passages.id", ondelete="CASCADE", index=True
    )
    passage_int_id: Optional[int] = Field(default=None, index=True)
    language: LanguageCode = Field(index=True)
    passage_text: str

    passage: Optional[Passage] = Relationship(back_populates="translations")
