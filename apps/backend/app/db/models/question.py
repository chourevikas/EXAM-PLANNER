import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

from sqlmodel import Column, Field, Index, Relationship, SQLModel

from app.db.models.enums import (
    AssetType,
    DifficultyLevel,
    LanguageCode,
    QuestionSourceType,
    QuestionStatus,
)
from app.db.models.types import PortableJSON, DateTimeTZ

if TYPE_CHECKING:
    from app.db.models.metadata import QuestionMetadata
    from app.db.models.explanation import QuestionExplanation
    from app.db.models.hierarchy_link import QuestionHierarchyLink
    from app.db.models.hierarchy import Exam, Subtopic
    from app.db.models.passage import Passage
    from app.db.models.analytics import ExamQuestionResponse, ExamQuestionReport
    from app.db.models.answer_key import AnswerKeyMapping
    from app.db.models.review import HumanReviewTask


class Question(SQLModel, table=True):
    __tablename__ = "questions"
    __table_args__ = (
        Index(
            "ix_questions_exam_number",
            "exam_id",
            "question_number_in_paper",
            unique=True,
        ),
        Index("ix_questions_status_exam", "status", "exam_id"),
        Index("ix_questions_subtopic", "subtopic_id"),
        Index("ix_questions_passage", "passage_id"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    exam_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="exams.id", ondelete="CASCADE", index=True
    )
    subtopic_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="subtopics.id", ondelete="SET NULL", index=True
    )
    passage_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="passages.id", ondelete="SET NULL", index=True
    )
    canonical_question_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="questions.id", ondelete="SET NULL", index=True
    )

    section_code: str = Field(default="DEFAULT", index=True, max_length=50)
    paper_set_code: str = Field(
        default="SET_A",
        index=True,
        max_length=20,
        description="Question paper set code e.g. SET_A, SET_B",
    )
    question_number_in_paper: int = Field(index=True)
    question_type: str = Field(default="SINGLE_CHOICE", max_length=50)
    difficulty: DifficultyLevel = Field(default=DifficultyLevel.MEDIUM, index=True)
    marks: float = Field(default=2.00)
    negative_marks: float = Field(default=0.66)
    expected_time_seconds: int = Field(default=60)
    source_type: QuestionSourceType = Field(default=QuestionSourceType.PYQ, index=True)
    source_year: Optional[int] = Field(default=None, index=True)
    status: QuestionStatus = Field(
        default=QuestionStatus.PENDING_HUMAN_REVIEW, index=True
    )
    version: int = Field(default=1)

    # Extraction Metadata using PortableJSON (Native JSONB on PostgreSQL, JSON on SQLite)
    is_mcq: bool = Field(default=True)
    is_complete: bool = Field(
        default=True,
        index=True,
        description="True if stem and all options are fully extracted without seam cuts",
    )
    has_image: bool = Field(default=False, index=True)
    page_numbers_json: Optional[list] = Field(
        default=[], sa_column=Column(PortableJSON)
    )
    passage_page_numbers_json: Optional[list] = Field(
        default=[], sa_column=Column(PortableJSON)
    )
    accuracy_percentage: Optional[float] = Field(
        default=None,
        description="Historical or mock candidate accuracy percentage (0.0 to 100.0)",
    )
    missing_fields_json: Optional[list] = Field(
        default=[],
        sa_column=Column(PortableJSON),
        description="JSON array of missing field names e.g. ['options', 'hindi_text']",
    )
    requires_human_review: bool = Field(
        default=False,
        index=True,
        description="True if confidence is low or text truncation detected",
    )
    validation_status: Optional[str] = Field(
        default="PENDING",
        index=True,
        description="PENDING, VALID, REJECTED, AUTO_FIXED",
    )
    validation_issues_json: Optional[list] = Field(
        default=[],
        sa_column=Column(PortableJSON),
        description="JSON array of validation error codes or issue descriptions",
    )
    page_number_in_pdf: Optional[int] = Field(default=None)

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    exam: Optional["Exam"] = Relationship(back_populates="questions")
    subtopic: Optional["Subtopic"] = Relationship(back_populates="questions")
    passage: Optional["Passage"] = Relationship(back_populates="questions")
    translations: list["QuestionTranslation"] = Relationship(
        back_populates="question", cascade_delete=True
    )
    options: list["QuestionOption"] = Relationship(
        back_populates="question", cascade_delete=True
    )
    assets: list["QuestionAsset"] = Relationship(
        back_populates="question", cascade_delete=True
    )
    metadata_record: Optional["QuestionMetadata"] = Relationship(
        back_populates="question", cascade_delete=True
    )
    explanation_records: list["QuestionExplanation"] = Relationship(
        back_populates="question", cascade_delete=True
    )
    hierarchy_links: list["QuestionHierarchyLink"] = Relationship(
        back_populates="question", cascade_delete=True
    )
    canonical_question: Optional["Question"] = Relationship(
        sa_relationship_kwargs={"remote_side": "Question.id"}
    )
    exam_responses: list["ExamQuestionResponse"] = Relationship(
        back_populates="question", cascade_delete=True
    )
    question_reports: list["ExamQuestionReport"] = Relationship(
        back_populates="question", cascade_delete=True
    )
    answer_key_mappings: list["AnswerKeyMapping"] = Relationship(
        back_populates="question"
    )
    review_tasks: list["HumanReviewTask"] = Relationship(
        back_populates="question", cascade_delete=True
    )


class QuestionTranslation(SQLModel, table=True):
    __tablename__ = "question_translations"
    __table_args__ = (
        Index("ix_q_trans_unique", "question_id", "language", unique=True),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    question_id: uuid.UUID = Field(
        foreign_key="questions.id", ondelete="CASCADE", index=True
    )
    language: LanguageCode = Field(index=True)
    question_text: str
    parent_context_override: Optional[str] = Field(default=None)

    question: Optional[Question] = Relationship(back_populates="translations")


class QuestionOption(SQLModel, table=True):
    __tablename__ = "question_options"
    __table_args__ = (
        Index("ix_options_question_label", "question_id", "option_label", unique=True),
        Index("ix_options_question_order", "question_id", "display_order"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    question_id: uuid.UUID = Field(
        foreign_key="questions.id", ondelete="CASCADE", index=True
    )
    option_label: str = Field(description="'A', 'B', 'C', 'D'", max_length=10)
    display_order: int
    is_correct: bool = Field(default=False, index=True)
    is_complete: bool = Field(
        default=True,
        index=True,
        description="True if option text is complete and not truncated across page break",
    )
    closeness_score: float = Field(default=0.00)

    question: Optional[Question] = Relationship(back_populates="options")
    translations: list["OptionTranslation"] = Relationship(
        back_populates="option", cascade_delete=True
    )


class OptionTranslation(SQLModel, table=True):
    __tablename__ = "option_translations"
    __table_args__ = (
        Index("ix_opt_trans_unique", "option_id", "language", unique=True),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    option_id: uuid.UUID = Field(
        foreign_key="question_options.id", ondelete="CASCADE", index=True
    )
    language: LanguageCode = Field(index=True)
    option_text: str
    distractor_analysis: Optional[str] = Field(default=None)

    option: Optional[QuestionOption] = Relationship(back_populates="translations")


class QuestionAsset(SQLModel, table=True):
    __tablename__ = "question_assets"
    __table_args__ = (
        Index("ix_assets_question_order", "question_id", "display_order"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    question_id: uuid.UUID = Field(
        foreign_key="questions.id", ondelete="CASCADE", index=True
    )
    asset_path: str
    asset_type: AssetType = Field(default=AssetType.DIAGRAM, index=True)
    caption: Optional[str] = Field(default=None)
    bounding_box_json: Optional[list] = Field(
        default=None, sa_column=Column(PortableJSON)
    )
    display_order: int = Field(default=1)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    question: Optional[Question] = Relationship(back_populates="assets")
