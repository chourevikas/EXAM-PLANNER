from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship, Index, Column
from app.db.models.enums import QuestionSourceType, ExamStatus
from app.db.models.types import DateTimeTZ, PortableJSON, BigIntPK

if TYPE_CHECKING:
    from app.db.models.exam_type import ExamType
    from app.db.models.question import Question
    from app.db.models.analytics import ExamAttempt
    from app.db.models.pipeline_run import PipelineRun
    from app.db.models.passage import Passage
    from app.db.models.answer_key import AnswerKeyBatch
    from app.db.models.review import HumanReviewTask


class Exam(SQLModel, table=True):
    __tablename__ = "exams"
    __table_args__ = (
        Index("ix_exams_active_order", "is_active", "display_order"),
        Index("ix_exams_status", "status"),
        Index(
            "ix_exams_canonical_match",
            "stage",
            "subject_code",
            "source_year",
            "paper_set_code",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    code: str = Field(
        unique=True,
        index=True,
        max_length=100,
        description="Canonical code e.g. upsc_cse-prelims-gs1-2023-A",
    )
    name: str = Field(max_length=200)

    exam_type_id: Optional[int] = Field(
        default=None,
        foreign_key="exam_types.id",
        index=True,
        description="Foreign key to exam_types table",
    )

    exam_type: QuestionSourceType = Field(
        default=QuestionSourceType.PYQ,
        index=True,
        description="Exam category: PYQ or STATIC_MOCK",
    )
    status: ExamStatus = Field(
        default=ExamStatus.PENDING_HUMAN_REVIEW,
        description="Exam review & publishing status",
    )

    # Standardized Filename Tokens
    stage: str = Field(
        default="prelims",
        index=True,
        max_length=50,
        description="Stage e.g. prelims, mains",
    )
    subject_code: str = Field(
        default="gs1", index=True, max_length=50, description="Subject e.g. gs1, csat"
    )
    source_year: int = Field(default=2023, index=True, description="Year e.g. 2023")
    is_mixed_bank: bool = Field(
        default=False,
        description="Question bank mixing exams and years (e.g. an MPSC topic-wise bank): each question carries "
        "its own source and year, so source_year here is not the questions' year",
    )
    paper_set_code: str = Field(
        default="SET_A",
        index=True,
        max_length=20,
        description="Paper Set e.g. SET_A, SET_B",
    )

    total_duration_minutes: Optional[int] = Field(
        default=120, description="Total allocated paper duration in minutes e.g. 120"
    )
    total_marks: Optional[float] = Field(
        default=200.0, description="Total paper maximum marks e.g. 200.0"
    )

    description: Optional[str] = Field(default=None)
    pdf_path: Optional[str] = Field(default=None, description="S3 or local relative path to Question Paper PDF")
    answer_key_pdf_path: Optional[str] = Field(default=None, description="S3 or local relative path to Answer Key PDF")

    total_questions: Optional[int] = Field(
        default=100, description="Total expected question count"
    )
    extracted_questions_count: int = Field(
        default=0, description="Count of questions extracted by pipeline"
    )
    missing_questions_count: int = Field(
        default=0, description="Count of missing questions"
    )
    missing_question_numbers_json: Optional[list] = Field(
        default=[], sa_column=Column(PortableJSON)
    )

    questions_json_path: Optional[str] = Field(
        default=None, description="S3 or local relative path to exam_questions.json"
    )
    solutions_json_path: Optional[str] = Field(
        default=None, description="S3 or local relative path to exam_solutions.json"
    )
    questions_json_folder_path: Optional[str] = Field(
        default=None, description="S3 or local folder path to questions json folder"
    )
    solutions_json_folder_path: Optional[str] = Field(
        default=None, description="S3 or local folder path to solutions json folder"
    )

    total_pages: Optional[int] = Field(default=None)
    display_order: int = Field(default=1)
    is_active: bool = Field(default=False, index=True)

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
    last_synced_at: Optional[datetime] = Field(
        default=None,
        sa_type=DateTimeTZ,
        description="Timestamp when exam questions & solutions were last synced to S3",
    )

    # Relationships
    syllabus_versions: List["SyllabusVersion"] = Relationship(
        back_populates="exam", cascade_delete=True
    )
    questions: List["Question"] = Relationship(
        back_populates="exam", cascade_delete=True
    )
    attempts: List["ExamAttempt"] = Relationship(
        back_populates="exam", cascade_delete=True
    )
    pipeline_runs: List["PipelineRun"] = Relationship(
        back_populates="exam", cascade_delete=True
    )
    passages: List["Passage"] = Relationship(
        back_populates="exam", cascade_delete=True
    )
    answer_key_batches: List["AnswerKeyBatch"] = Relationship(
        back_populates="exam", cascade_delete=True
    )
    review_tasks: List["HumanReviewTask"] = Relationship(
        back_populates="exam", cascade_delete=True
    )
    exam_type_entity: Optional["ExamType"] = Relationship(
        back_populates="exams"
    )


class SyllabusVersion(SQLModel, table=True):
    __tablename__ = "syllabus_versions"
    __table_args__ = (
        Index("ix_syllabus_exam_version", "exam_id", "version_code", unique=True),
    )

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    exam_id: int = Field(foreign_key="exams.id", ondelete="CASCADE", index=True)
    version_code: str = Field(max_length=50)
    title: Optional[str] = Field(default=None)
    effective_from: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
    is_active: bool = Field(default=True, index=True)

    exam: Optional[Exam] = Relationship(back_populates="syllabus_versions")
    subjects: List["Subject"] = Relationship(
        back_populates="syllabus_version", cascade_delete=True
    )


class Subject(SQLModel, table=True):
    __tablename__ = "subjects"
    __table_args__ = (
        Index("ix_subjects_syllabus_order", "version_id", "display_order"),
    )

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    version_id: int = Field(
        foreign_key="syllabus_versions.id", ondelete="CASCADE", index=True
    )
    code: str = Field(default="DEFAULT", max_length=50)
    name: str = Field(max_length=200)
    display_order: int = Field(default=1)

    syllabus_version: Optional[SyllabusVersion] = Relationship(
        back_populates="subjects"
    )
    topics: List["Topic"] = Relationship(back_populates="subject", cascade_delete=True)


class Topic(SQLModel, table=True):
    __tablename__ = "topics"
    __table_args__ = (Index("ix_topics_subject_order", "subject_id", "display_order"),)

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    subject_id: int = Field(
        foreign_key="subjects.id", ondelete="CASCADE", index=True
    )
    code: str = Field(default="DEFAULT", max_length=50)
    name: str = Field(max_length=200)
    display_order: int = Field(default=1)

    subject: Optional[Subject] = Relationship(back_populates="topics")
    subtopics: List["Subtopic"] = Relationship(
        back_populates="topic", cascade_delete=True
    )


class Subtopic(SQLModel, table=True):
    __tablename__ = "subtopics"
    __table_args__ = (Index("ix_subtopics_topic_order", "topic_id", "display_order"),)

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    topic_id: int = Field(foreign_key="topics.id", ondelete="CASCADE", index=True)
    code: str = Field(default="DEFAULT", max_length=50)
    name: str = Field(max_length=200)
    display_order: int = Field(default=1)
    pyq_frequency: int = Field(
        default=0,
        index=True,
        description="Recurrence count of this concept/subtopic across past year papers",
    )

    topic: Optional[Topic] = Relationship(back_populates="subtopics")
    questions: List["Question"] = Relationship(back_populates="subtopic")
    passages: List["Passage"] = Relationship(back_populates="subtopic")
