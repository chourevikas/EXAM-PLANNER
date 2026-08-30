from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship, Column, Index
from app.db.models.types import PortableJSON, DateTimeTZ
from app.db.models.enums import AttemptStatus, AttemptMode, QuestionResponseStatus

if TYPE_CHECKING:
    from app.db.models.user import User
    from app.db.models.hierarchy import Exam, Subtopic
    from app.db.models.question import Question, QuestionOption
    from app.db.models.telemetry import (
        UserTestAttempt,
        UserQuestionResponse,
        QuestionSwitchLog,
    )


class ExamAttempt(SQLModel, table=True):
    __tablename__ = "exam_attempts"
    __table_args__ = (
        Index("ix_exam_attempts_user_exam", "user_id", "exam_id"),
        Index("ix_exam_attempts_user_created", "user_id", "created_at"),
        Index("ix_exam_attempts_user_status", "user_id", "status"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    exam_id: int = Field(foreign_key="exams.id", ondelete="CASCADE", index=True)

    status: AttemptStatus = Field(default=AttemptStatus.IN_PROGRESS, index=True)
    mode: AttemptMode = Field(default=AttemptMode.EXAM, index=True)

    total_score: float = Field(default=0.0)
    max_possible_score: float = Field(default=200.0)
    time_spent_seconds: float = Field(default=0.0)
    total_questions_attempted: int = Field(default=0)

    total_questions: int = Field(default=0)
    total_correct: int = Field(default=0)
    total_incorrect: int = Field(default=0)
    total_unattempted: int = Field(default=0)
    current_question_index: int = Field(default=1)

    max_duration_seconds: int = Field(default=7200)
    started_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
    submitted_at: Optional[datetime] = Field(default=None, sa_type=DateTimeTZ)
    submission_reason: Optional[str] = Field(default=None, max_length=100)

    pacing_status: str = Field(default="BALANCED_PACING", max_length=100)
    gti_score: float = Field(default=0.0)
    irt_theta: float = Field(default=0.0)
    percentile_rank: float = Field(default=50.0)
    oeei_score: float = Field(default=0.0)
    satoi_score: float = Field(default=100.0)
    icrs_score: float = Field(default=50.0)

    report_metadata_json: Optional[dict] = Field(
        default=None, sa_column=Column(PortableJSON)
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    user: Optional["User"] = Relationship(back_populates="exam_attempts")
    exam: Optional["Exam"] = Relationship(back_populates="attempts")
    responses: List["ExamQuestionResponse"] = Relationship(
        back_populates="attempt", cascade_delete=True
    )
    question_reports: List["ExamQuestionReport"] = Relationship(
        back_populates="attempt", cascade_delete=True
    )
    report: Optional["ExamAttemptReport"] = Relationship(
        back_populates="attempt",
        sa_relationship_kwargs={"uselist": False, "cascade": "all, delete-orphan"},
    )
    progression_reports: List["UserSkillProgressionReport"] = Relationship(
        back_populates="attempt", cascade_delete=True
    )
    user_test_attempts: List["UserTestAttempt"] = Relationship(
        back_populates="exam_attempt", cascade_delete=True
    )


class ExamQuestionResponse(SQLModel, table=True):
    __tablename__ = "exam_question_responses"
    __table_args__ = (
        Index("ix_eq_responses_attempt_q", "attempt_id", "question_id", unique=True),
        Index("ix_eq_responses_question", "question_id"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    attempt_id: int = Field(
        foreign_key="exam_attempts.id", ondelete="CASCADE", index=True
    )
    question_id: int = Field(
        foreign_key="questions.id", ondelete="CASCADE", index=True
    )

    selected_option_id: Optional[int] = Field(
        default=None, foreign_key="question_options.id", ondelete="SET NULL"
    )
    initial_option_id: Optional[int] = Field(
        default=None, foreign_key="question_options.id", ondelete="SET NULL"
    )

    question_status: QuestionResponseStatus = Field(
        default=QuestionResponseStatus.UNVISITED, index=True
    )
    is_marked_for_review: bool = Field(default=False, index=True)
    option_switch_count: int = Field(default=0)
    visited_count: int = Field(default=0)
    answer_revealed: bool = Field(default=False)

    is_correct: bool = Field(default=False, index=True)
    time_taken_seconds: float = Field(default=60.0)
    expected_time_seconds: float = Field(default=60.0)
    closeness_score_awarded: float = Field(default=0.0)
    final_score: float = Field(default=0.0)
    candidate_accuracy_pct: Optional[float] = Field(
        default=None, description="Actual student/candidate percentage accuracy on this question across test attempts"
    )
    is_switched: bool = Field(default=False, index=True)
    gti_item_score: float = Field(default=0.0)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    attempt: Optional[ExamAttempt] = Relationship(back_populates="responses")
    question: Optional["Question"] = Relationship(back_populates="exam_responses")
    selected_option: Optional["QuestionOption"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[ExamQuestionResponse.selected_option_id]"}
    )
    initial_option: Optional["QuestionOption"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[ExamQuestionResponse.initial_option_id]"}
    )
    user_question_responses: List["UserQuestionResponse"] = Relationship(
        back_populates="exam_response"
    )
    question_switch_logs: List["QuestionSwitchLog"] = Relationship(
        back_populates="exam_response"
    )


class UserMemoryState(SQLModel, table=True):
    __tablename__ = "user_memory_states"
    __table_args__ = (
        Index("ix_memory_user_question", "user_id", "question_id", unique=True),
        Index("ix_memory_user_subtopic", "user_id", "subtopic_id"),
        Index("ix_memory_next_review", "user_id", "next_scheduled_review"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    question_id: Optional[int] = Field(
        default=None, foreign_key="questions.id", ondelete="CASCADE", index=True
    )
    subtopic_id: Optional[int] = Field(
        default=None, foreign_key="subtopics.id", ondelete="CASCADE", index=True
    )

    fsrs_difficulty: float = Field(default=5.0)
    fsrs_stability: float = Field(default=2.0)
    retrievability: float = Field(default=1.0)
    last_reviewed_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
    next_scheduled_review: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    user: Optional["User"] = Relationship(back_populates="memory_states")
    question: Optional["Question"] = Relationship()
    subtopic: Optional["Subtopic"] = Relationship()


class UserSkillProfile(SQLModel, table=True):
    __tablename__ = "user_skill_profiles"

    user_id: int = Field(
        foreign_key="users.id", primary_key=True, ondelete="CASCADE"
    )
    cumulative_irt_theta: float = Field(default=0.0)
    cumulative_gti: float = Field(default=0.20)
    cumulative_oeei: float = Field(default=0.70)
    cumulative_icrs: float = Field(default=65.0)
    cumulative_satoi: float = Field(default=85.0)
    total_tests_given: int = Field(default=0)
    total_questions_answered: int = Field(default=0)
    aggregate_report_json: Optional[dict] = Field(
        default=None, sa_column=Column(PortableJSON)
    )
    aggregate_markdown_audit: Optional[str] = Field(default=None)
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    user: Optional["User"] = Relationship(back_populates="skill_profile")


class UserTaxonomyMastery(SQLModel, table=True):
    __tablename__ = "user_taxonomy_mastery"
    __table_args__ = (
        Index(
            "ix_tax_mastery_user_code",
            "user_id",
            "taxonomy_type",
            "taxonomy_id_code",
            unique=True,
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    taxonomy_type: str = Field(
        index=True,
        max_length=50,
        description="'SUBJECT', 'TOPIC', 'SUBTOPIC', 'BLOOMS'",
    )
    taxonomy_id_code: str = Field(
        index=True, max_length=100, description="e.g. POLITY, POLITY_T1, ANALYZE"
    )
    taxonomy_name: str = Field(max_length=200)
    total_attempts: int = Field(default=0)
    correct_attempts: int = Field(default=0)
    mastery_percentage: float = Field(default=0.0)
    strength_status: str = Field(
        default="MODERATE",
        max_length=50,
        description="'STRONG', 'MODERATE', 'WEAK_REVISION_REQUIRED'",
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    user: Optional["User"] = Relationship(back_populates="taxonomy_masteries")


class ExamQuestionReport(SQLModel, table=True):
    __tablename__ = "exam_question_reports"
    __table_args__ = (
        Index("ix_eq_reports_attempt_q", "attempt_id", "question_id", unique=True),
        Index("ix_eq_reports_attempt_num", "attempt_id", "question_number"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    attempt_id: int = Field(
        foreign_key="exam_attempts.id", ondelete="CASCADE", index=True
    )
    question_id: int = Field(
        foreign_key="questions.id", ondelete="CASCADE", index=True
    )
    question_number: int = Field(index=True)
    is_correct: bool = Field(default=False, index=True)
    final_score: float = Field(default=0.0)
    time_taken_seconds: float = Field(default=60.0)
    expected_time_seconds: float = Field(default=60.0)
    time_window: str = Field(default="OPTIMAL", max_length=50)
    closeness_score: float = Field(default=0.0)
    closeness_classification: str = Field(
        default="Neutral Distractor", max_length=100
    )
    gti_item_score: float = Field(default=0.0)
    is_option_switched: bool = Field(default=False)
    blooms_level: str = Field(default="ANALYZE", max_length=50)
    explanation_json: Optional[dict] = Field(
        default=None, sa_column=Column(PortableJSON)
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    attempt: Optional[ExamAttempt] = Relationship(back_populates="question_reports")
    question: Optional["Question"] = Relationship(back_populates="question_reports")


class ExamAttemptReport(SQLModel, table=True):
    __tablename__ = "exam_attempt_reports"

    id: Optional[int] = Field(default=None, primary_key=True)
    attempt_id: int = Field(
        foreign_key="exam_attempts.id", unique=True, index=True, ondelete="CASCADE"
    )
    user_id: int = Field(foreign_key="users.id", index=True, ondelete="CASCADE")
    exam_id: int = Field(foreign_key="exams.id", index=True, ondelete="CASCADE")

    matrices_summary_json: dict = Field(
        default_factory=dict, sa_column=Column(PortableJSON)
    )
    taxonomy_breakdown_json: dict = Field(
        default_factory=dict, sa_column=Column(PortableJSON)
    )
    llm_insight_json: Optional[dict] = Field(
        default=None, sa_column=Column(PortableJSON)
    )
    full_report_json: Optional[dict] = Field(
        default=None, sa_column=Column(PortableJSON)
    )
    s3_report_url: Optional[str] = Field(default=None, max_length=500)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    attempt: Optional[ExamAttempt] = Relationship(back_populates="report")
    user: Optional["User"] = Relationship()
    exam: Optional["Exam"] = Relationship()


class UserSkillProgressionReport(SQLModel, table=True):
    __tablename__ = "user_skill_progression_reports"
    __table_args__ = (
        Index("ix_skill_prog_user_created", "user_id", "created_at"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    attempt_id: int = Field(
        foreign_key="exam_attempts.id", index=True, ondelete="CASCADE"
    )
    user_id: int = Field(foreign_key="users.id", index=True, ondelete="CASCADE")

    previous_metrics_json: dict = Field(
        default_factory=dict, sa_column=Column(PortableJSON)
    )
    updated_metrics_json: dict = Field(
        default_factory=dict, sa_column=Column(PortableJSON)
    )
    deltas_json: dict = Field(
        default_factory=dict, sa_column=Column(PortableJSON)
    )
    taxonomy_promotions_json: dict = Field(
        default_factory=dict, sa_column=Column(PortableJSON)
    )
    spaced_repetition_schedule_json: dict = Field(
        default_factory=dict, sa_column=Column(PortableJSON)
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    attempt: Optional[ExamAttempt] = Relationship(back_populates="progression_reports")
    user: Optional["User"] = Relationship()
