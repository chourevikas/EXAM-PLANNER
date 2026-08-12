import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field, Index
from app.db.models.enums import TestType, AttemptStatus, AttemptMode
from app.db.models.types import DateTimeTZ


class Test(SQLModel, table=True):
    __tablename__ = "tests"
    __table_args__ = (Index("ix_tests_type_created", "test_type", "created_at"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    title: str = Field(max_length=200)
    test_type: TestType = Field(index=True)
    total_questions: int = Field(default=0)
    duration_minutes: int = Field(default=60)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )


class TestQuestion(SQLModel, table=True):
    __tablename__ = "test_questions"
    __table_args__ = (Index("ix_test_q_order", "test_id", "question_order"),)

    test_id: uuid.UUID = Field(
        foreign_key="tests.id", ondelete="CASCADE", primary_key=True, index=True
    )
    question_id: uuid.UUID = Field(
        foreign_key="questions.id", primary_key=True, index=True
    )
    question_order: int = Field(default=1)


class UserTestAttempt(SQLModel, table=True):
    __tablename__ = "user_test_attempts"
    __table_args__ = (
        Index("ix_attempts_user_status", "user_id", "status"),
        Index("ix_attempts_test", "test_id"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    test_id: uuid.UUID = Field(foreign_key="tests.id", index=True)
    exam_attempt_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="exam_attempts.id", ondelete="CASCADE", index=True
    )
    status: AttemptStatus = Field(default=AttemptStatus.IN_PROGRESS, index=True)
    mode: AttemptMode = Field(default=AttemptMode.EXAM, index=True)
    score_raw: Optional[float] = Field(default=None)
    score_time_adjusted: Optional[float] = Field(default=None)
    guessing_tendency_index: Optional[float] = Field(default=None)
    total_time_spent_sec: int = Field(default=0)
    started_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
    submitted_at: Optional[datetime] = Field(default=None, sa_type=DateTimeTZ)


class UserQuestionResponse(SQLModel, table=True):
    __tablename__ = "user_question_responses"
    __table_args__ = (
        Index("ix_responses_attempt_q", "attempt_id", "question_id", unique=True),
        Index("ix_responses_question", "question_id"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    attempt_id: uuid.UUID = Field(
        foreign_key="user_test_attempts.id", ondelete="CASCADE", index=True
    )
    exam_response_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="exam_question_responses.id", ondelete="CASCADE", index=True
    )
    question_id: uuid.UUID = Field(foreign_key="questions.id", index=True)
    selected_option_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="question_options.id", index=True
    )
    initial_selected_option_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="question_options.id"
    )
    option_switch_count: int = Field(default=0)
    time_taken_seconds: int = Field(default=0)
    closeness_score_awarded: Optional[float] = Field(default=None)
    final_score: Optional[float] = Field(default=None)
    is_flagged_for_review: bool = Field(default=False)


class QuestionSwitchLog(SQLModel, table=True):
    __tablename__ = "question_switch_logs"
    __table_args__ = (Index("ix_switch_logs_response", "response_id"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    response_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="user_question_responses.id", ondelete="CASCADE", index=True
    )
    exam_response_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="exam_question_responses.id", ondelete="CASCADE", index=True
    )
    from_option_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="question_options.id"
    )
    to_option_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="question_options.id"
    )
    timestamp_offset_sec: int = Field(default=0)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )



class UserConceptRetention(SQLModel, table=True):
    __tablename__ = "user_concept_retention"
    __table_args__ = (
        Index("ix_retention_user_subtopic", "user_id", "subtopic_id", unique=True),
        Index("ix_retention_next_review", "user_id", "next_scheduled_review"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    subtopic_id: uuid.UUID = Field(
        foreign_key="subtopics.id", ondelete="CASCADE", index=True
    )
    fsrs_difficulty: float = Field(default=5.00)
    fsrs_stability: float = Field(default=1.00)
    fsrs_retrievability: float = Field(default=1.00)
    total_reviews: int = Field(default=1)
    lapses: int = Field(default=0)
    last_reviewed_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
    next_scheduled_review: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        index=True,
        sa_type=DateTimeTZ,
    )
