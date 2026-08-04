import uuid
from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship, Column, Index
from app.db.models.types import PortableJSON



class ExamAttempt(SQLModel, table=True):
    __tablename__ = "exam_attempts"
    __table_args__ = (
        Index("ix_exam_attempts_user_exam", "user_id", "exam_id"),
        Index("ix_exam_attempts_user_created", "user_id", "created_at"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    exam_id: uuid.UUID = Field(foreign_key="exams.id", ondelete="CASCADE", index=True)
    
    total_score: float = Field(default=0.0)
    max_possible_score: float = Field(default=200.0)
    time_spent_seconds: float = Field(default=0.0)
    total_questions_attempted: int = Field(default=0)
    
    pacing_status: str = Field(default="BALANCED_PACING", max_length=100)
    gti_score: float = Field(default=0.0)
    irt_theta: float = Field(default=0.0)
    percentile_rank: float = Field(default=50.0)
    oeei_score: float = Field(default=0.0)
    satoi_score: float = Field(default=100.0)
    icrs_score: float = Field(default=50.0)

    report_metadata_json: Optional[dict] = Field(default=None, sa_column=Column(PortableJSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)

    responses: List["ExamQuestionResponse"] = Relationship(back_populates="attempt", cascade_delete=True)


class ExamQuestionResponse(SQLModel, table=True):
    __tablename__ = "exam_question_responses"
    __table_args__ = (
        Index("ix_eq_responses_attempt_q", "attempt_id", "question_id"),
        Index("ix_eq_responses_question", "question_id"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    attempt_id: uuid.UUID = Field(foreign_key="exam_attempts.id", ondelete="CASCADE", index=True)
    question_id: uuid.UUID = Field(foreign_key="questions.id", ondelete="CASCADE", index=True)
    
    selected_option_id: Optional[uuid.UUID] = Field(default=None, foreign_key="question_options.id", ondelete="SET NULL")
    initial_option_id: Optional[uuid.UUID] = Field(default=None, foreign_key="question_options.id", ondelete="SET NULL")
    
    is_correct: bool = Field(default=False, index=True)
    time_taken_seconds: float = Field(default=60.0)
    expected_time_seconds: float = Field(default=60.0)
    closeness_score_awarded: float = Field(default=0.0)
    final_score: float = Field(default=0.0)
    is_switched: bool = Field(default=False, index=True)
    gti_item_score: float = Field(default=0.0)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    attempt: Optional[ExamAttempt] = Relationship(back_populates="responses")


class UserMemoryState(SQLModel, table=True):
    __tablename__ = "user_memory_states"
    __table_args__ = (
        Index("ix_memory_user_question", "user_id", "question_id", unique=True),
        Index("ix_memory_user_subtopic", "user_id", "subtopic_id"),
        Index("ix_memory_next_review", "user_id", "next_scheduled_review"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    question_id: Optional[uuid.UUID] = Field(default=None, foreign_key="questions.id", ondelete="CASCADE", index=True)
    subtopic_id: Optional[uuid.UUID] = Field(default=None, foreign_key="subtopics.id", ondelete="CASCADE", index=True)
    
    fsrs_difficulty: float = Field(default=5.0)
    fsrs_stability: float = Field(default=2.0)
    retrievability: float = Field(default=1.0)
    last_reviewed_at: datetime = Field(default_factory=datetime.utcnow)
    next_scheduled_review: datetime = Field(default_factory=datetime.utcnow)


class UserSkillProfile(SQLModel, table=True):
    __tablename__ = "user_skill_profiles"

    user_id: uuid.UUID = Field(foreign_key="users.id", primary_key=True, ondelete="CASCADE")
    cumulative_irt_theta: float = Field(default=0.0)
    cumulative_gti: float = Field(default=0.20)
    cumulative_oeei: float = Field(default=0.70)
    cumulative_icrs: float = Field(default=65.0)
    cumulative_satoi: float = Field(default=85.0)
    total_tests_given: int = Field(default=0)
    total_questions_answered: int = Field(default=0)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class UserTaxonomyMastery(SQLModel, table=True):
    __tablename__ = "user_taxonomy_mastery"
    __table_args__ = (
        Index("ix_tax_mastery_user_code", "user_id", "taxonomy_type", "taxonomy_id_code", unique=True),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    taxonomy_type: str = Field(index=True, max_length=50, description="'SUBJECT', 'TOPIC', 'SUBTOPIC', 'BLOOMS'")
    taxonomy_id_code: str = Field(index=True, max_length=100, description="e.g. POLITY, POLITY_T1, ANALYZE")
    taxonomy_name: str = Field(max_length=200)
    total_attempts: int = Field(default=0)
    correct_attempts: int = Field(default=0)
    mastery_percentage: float = Field(default=0.0)
    strength_status: str = Field(default="MODERATE", max_length=50, description="'STRONG', 'MODERATE', 'WEAK_REVISION_REQUIRED'")
    updated_at: datetime = Field(default_factory=datetime.utcnow)
