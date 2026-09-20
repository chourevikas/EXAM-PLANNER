import enum
from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship, Index, AutoString, Column
from app.db.models.enums import DifficultyLevel
from app.db.models.types import DateTimeTZ, BigIntPK, PortableJSON

if TYPE_CHECKING:
    from app.db.models.user import User
    from app.db.models.question import Question


class ChallengeVisibility(str, enum.Enum):
    INVITE_ONLY = "INVITE_ONLY"
    PUBLIC = "PUBLIC"


class ChallengeStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"


class ChallengeAttemptStatus(str, enum.Enum):
    IN_PROGRESS = "IN_PROGRESS"
    SUBMITTED = "SUBMITTED"


class ChallengeInviteStatus(str, enum.Enum):
    PENDING = "PENDING"
    VIEWED = "VIEWED"


class Challenge(SQLModel, table=True):
    __tablename__ = "challenges"
    __table_args__ = (
        Index("ix_challenges_creator_status", "creator_id", "status"),
        Index("ix_challenges_share_token", "share_token", unique=True),
    )

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    creator_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    title: str = Field(max_length=255)
    description: Optional[str] = Field(default=None)
    question_count: int = Field(default=10)
    difficulty: Optional[DifficultyLevel] = Field(default=None)
    subject_name: Optional[str] = Field(default=None, max_length=200)  # display text / legacy single subject
    subject_names: Optional[list] = Field(default=None, sa_column=Column(PortableJSON))
    exam_type_id: Optional[int] = Field(default=None, foreign_key="exam_types.id", ondelete="SET NULL")
    exam_name: Optional[str] = Field(default=None, max_length=200)
    years: Optional[list] = Field(default=None, sa_column=Column(PortableJSON))
    time_limit_minutes: int = Field(default=15)
    visibility: ChallengeVisibility = Field(default=ChallengeVisibility.INVITE_ONLY, index=True, sa_type=AutoString)
    share_token: str = Field(max_length=64)
    status: ChallengeStatus = Field(default=ChallengeStatus.ACTIVE, index=True, sa_type=AutoString)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
    expires_at: Optional[datetime] = Field(default=None, index=True, sa_type=DateTimeTZ)

    @property
    def subjects_list(self) -> list:
        """Selected subjects; older challenges only stored a single subject_name."""
        if self.subject_names:
            return list(self.subject_names)
        return [self.subject_name] if self.subject_name else []

    creator: Optional["User"] = Relationship(
        sa_relationship_kwargs={"primaryjoin": "Challenge.creator_id==User.id"}
    )
    questions: List["ChallengeQuestion"] = Relationship(
        back_populates="challenge", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    invites: List["ChallengeInvite"] = Relationship(
        back_populates="challenge", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    attempts: List["ChallengeAttempt"] = Relationship(
        back_populates="challenge", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class ChallengeQuestion(SQLModel, table=True):
    __tablename__ = "challenge_questions"
    __table_args__ = (
        Index("ix_challenge_questions_challenge_order", "challenge_id", "order_index", unique=True),
    )

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    challenge_id: int = Field(foreign_key="challenges.id", ondelete="CASCADE", index=True)
    question_id: int = Field(foreign_key="questions.id", ondelete="CASCADE", index=True)
    order_index: int = Field(default=0)

    challenge: Optional[Challenge] = Relationship(back_populates="questions")
    question: Optional["Question"] = Relationship(
        sa_relationship_kwargs={"primaryjoin": "ChallengeQuestion.question_id==Question.id"}
    )


class ChallengeInvite(SQLModel, table=True):
    __tablename__ = "challenge_invites"
    __table_args__ = (
        Index("ix_challenge_invites_challenge_user", "challenge_id", "invited_user_id", unique=True),
        Index("ix_challenge_invites_user", "invited_user_id"),
    )

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    challenge_id: int = Field(foreign_key="challenges.id", ondelete="CASCADE", index=True)
    invited_user_id: int = Field(foreign_key="users.id", ondelete="CASCADE")
    invited_by_id: int = Field(foreign_key="users.id", ondelete="CASCADE")
    status: ChallengeInviteStatus = Field(default=ChallengeInviteStatus.PENDING, sa_type=AutoString)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    challenge: Optional[Challenge] = Relationship(back_populates="invites")
    invited_user: Optional["User"] = Relationship(
        sa_relationship_kwargs={"primaryjoin": "ChallengeInvite.invited_user_id==User.id"}
    )


class ChallengeAttempt(SQLModel, table=True):
    __tablename__ = "challenge_attempts"
    __table_args__ = (
        Index("ix_challenge_attempts_challenge_user", "challenge_id", "user_id"),
        Index("ix_challenge_attempts_user", "user_id"),
    )

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    challenge_id: int = Field(foreign_key="challenges.id", ondelete="CASCADE", index=True)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE")
    status: ChallengeAttemptStatus = Field(default=ChallengeAttemptStatus.IN_PROGRESS, index=True, sa_type=AutoString)

    total_score: float = Field(default=0.0)
    total_correct: int = Field(default=0)
    total_incorrect: int = Field(default=0)
    total_unattempted: int = Field(default=0)
    time_spent_seconds: float = Field(default=0.0)

    started_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
    submitted_at: Optional[datetime] = Field(default=None, sa_type=DateTimeTZ)

    challenge: Optional[Challenge] = Relationship(back_populates="attempts")
    user: Optional["User"] = Relationship(
        sa_relationship_kwargs={"primaryjoin": "ChallengeAttempt.user_id==User.id"}
    )
    responses: List["ChallengeResponse"] = Relationship(
        back_populates="attempt", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class ChallengeResponse(SQLModel, table=True):
    __tablename__ = "challenge_responses"
    __table_args__ = (
        Index("ix_challenge_responses_attempt_q", "attempt_id", "question_id", unique=True),
    )

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    attempt_id: int = Field(foreign_key="challenge_attempts.id", ondelete="CASCADE", index=True)
    question_id: int = Field(foreign_key="questions.id", ondelete="CASCADE", index=True)
    selected_option_id: Optional[int] = Field(default=None, foreign_key="question_options.id", ondelete="CASCADE")
    is_correct: bool = Field(default=False)
    time_spent_seconds: float = Field(default=0.0)
    answered_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    attempt: Optional[ChallengeAttempt] = Relationship(back_populates="responses")
