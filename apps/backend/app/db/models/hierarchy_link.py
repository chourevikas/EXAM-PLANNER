import uuid
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship, Index

if TYPE_CHECKING:
    from app.db.models.question import Question
    from app.db.models.hierarchy import Subtopic, Topic, Subject


class QuestionHierarchyLink(SQLModel, table=True):
    """Junction table enabling a single Question to map to multiple Subjects, Topics, and Subtopics."""

    __tablename__ = "question_hierarchy_links"
    __table_args__ = (
        Index("ix_qhl_question_subtopic", "question_id", "subtopic_id", unique=True),
        Index("ix_qhl_topic", "topic_id"),
        Index("ix_qhl_subject", "subject_id"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    int_id: Optional[int] = Field(default=None)
    question_id: uuid.UUID = Field(
        foreign_key="questions.id", ondelete="CASCADE", index=True
    )
    question_int_id: Optional[int] = Field(default=None, index=True)
    subtopic_id: uuid.UUID = Field(
        foreign_key="subtopics.id", ondelete="CASCADE", index=True
    )
    subtopic_int_id: Optional[int] = Field(default=None, index=True)
    topic_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="topics.id", ondelete="CASCADE", index=True
    )
    topic_int_id: Optional[int] = Field(default=None, index=True)
    subject_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="subjects.id", ondelete="CASCADE", index=True
    )
    subject_int_id: Optional[int] = Field(default=None, index=True)

    is_primary: bool = Field(
        default=False,
        index=True,
        description="True if this is the primary subtopic/topic/subject for the question",
    )
    relevance_weight: float = Field(
        default=1.0,
        description="Relevance score (0.0 to 1.0) of this concept in the question",
    )
    concept_name: Optional[str] = Field(
        default=None, max_length=200, description="Optional descriptive concept label"
    )

    question: Optional["Question"] = Relationship(back_populates="hierarchy_links")
    subtopic: Optional["Subtopic"] = Relationship()
    topic: Optional["Topic"] = Relationship()
    subject: Optional["Subject"] = Relationship()
