import enum
from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship, Index, Column
from app.db.models.enums import UserRole, UserStatus
from app.db.models.types import DateTimeTZ, BigIntPK, PortableJSON

if TYPE_CHECKING:
    from app.db.models.subscription import UserSubscription
    from app.db.models.analytics import (
        ExamAttempt,
        UserSkillProfile,
        UserTaxonomyMastery,
        UserMemoryState,
    )
    from app.db.models.study_plan import StudyTask, StudyActivity
    from app.db.models.gamification import UserBadge, XPLog


class SubscriptionTier(str, enum.Enum):
    GUEST = "GUEST"
    FREE = "FREE"
    PREMIUM = "PREMIUM"


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    full_name: str = Field(max_length=255)
    email: str = Field(unique=True, index=True, max_length=255)
    clerk_id: Optional[str] = Field(default=None, unique=True, index=True, max_length=255)
    password_hash: Optional[str] = Field(default=None)
    role: UserRole = Field(default=UserRole.STUDENT)
    custom_role_id: Optional[int] = Field(
        default=None, foreign_key="roles.id", ondelete="SET NULL"
    )
    status: UserStatus = Field(default=UserStatus.ACTIVE)
    is_verified: bool = Field(default=False)
    # True while the account still uses a temporary password emailed by a Super Admin.
    must_change_password: bool = Field(default=False)
    # Super Admin TOTP authenticator (secret is encrypted at rest; see app/core/totp.py).
    totp_secret: Optional[str] = Field(default=None)
    totp_enabled: bool = Field(default=False)
    totp_last_step: Optional[int] = Field(default=None, sa_type=BigIntPK)
    totp_recovery_hashes: Optional[List[str]] = Field(default=None, sa_column=Column(PortableJSON))
    profile_image: Optional[str] = Field(default=None)
    phone: Optional[str] = Field(default=None, max_length=32)
    timezone: str = Field(default="Asia/Kolkata", max_length=100)
    preferred_language: str = Field(default="en", max_length=20, index=True)
    last_login: Optional[datetime] = Field(default=None, sa_type=DateTimeTZ)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
    suspended_at: Optional[datetime] = Field(default=None, sa_type=DateTimeTZ)
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    @property
    def mfa_enabled(self) -> bool:
        return bool(self.totp_enabled)

    @property
    def mfa_setup_required(self) -> bool:
        from app.core.session_policy import mfa_setup_required

        return mfa_setup_required(self)

    # Relationships
    student_profile: Optional["StudentProfile"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"uselist": False, "cascade": "all, delete-orphan"},
    )
    admin_profile: Optional["AdminProfile"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={
            "uselist": False,
            "cascade": "all, delete-orphan",
            "primaryjoin": "User.id==AdminProfile.user_id",
        },
    )
    refresh_tokens: List["RefreshToken"] = Relationship(
        back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    subscriptions: List["UserSubscription"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"foreign_keys": "[UserSubscription.user_id]"},
    )
    exam_attempts: List["ExamAttempt"] = Relationship(
        back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    skill_profile: Optional["UserSkillProfile"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"uselist": False, "cascade": "all, delete-orphan"},
    )
    taxonomy_masteries: List["UserTaxonomyMastery"] = Relationship(
        back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    memory_states: List["UserMemoryState"] = Relationship(
        back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    study_tasks: List["StudyTask"] = Relationship(
        back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    study_activities: List["StudyActivity"] = Relationship(
        back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    user_badges: List["UserBadge"] = Relationship(
        back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    xp_logs: List["XPLog"] = Relationship(
        back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )

    def _get_student_profile_safe(self) -> Optional["StudentProfile"]:
        from sqlalchemy import inspect
        state = inspect(self)
        if state is not None and "student_profile" in state.unloaded:
            return None
        return self.student_profile

    @property
    def subscription_tier(self) -> SubscriptionTier:
        prof = self._get_student_profile_safe()
        if prof:
            return prof.subscription_tier
        return SubscriptionTier.FREE

    @property
    def free_questions_attempted(self) -> int:
        prof = self._get_student_profile_safe()
        return prof.free_questions_attempted if prof else 0

    @property
    def effective_suspended_at(self) -> Optional[datetime]:
        if self.status != UserStatus.SUSPENDED:
            return None
        return self.suspended_at or self.updated_at

    @property
    def cooling_period_ends_at(self) -> Optional[datetime]:
        susp_time = self.effective_suspended_at
        if not susp_time:
            return None
        from datetime import timedelta
        return susp_time + timedelta(days=7)

    @property
    def is_in_cooling_period(self) -> bool:
        ends = self.cooling_period_ends_at
        if not ends:
            return False
        return datetime.now(timezone.utc) < ends

    @property
    def cooling_period_expired(self) -> bool:
        if self.status != UserStatus.SUSPENDED:
            return False
        return not self.is_in_cooling_period

    @property
    def current_streak(self) -> int:
        prof = self._get_student_profile_safe()
        return prof.current_streak if prof else 0

    @property
    def total_xp(self) -> int:
        prof = self._get_student_profile_safe()
        return prof.total_xp if prof else 0

    @property
    def level(self) -> int:
        prof = self._get_student_profile_safe()
        return prof.level if prof else 1


class StudentProfile(SQLModel, table=True):
    __tablename__ = "student_profiles"

    user_id: int = Field(
        foreign_key="users.id", ondelete="CASCADE", primary_key=True, index=True
    )
    subscription_tier: SubscriptionTier = Field(default=SubscriptionTier.FREE)
    free_questions_attempted: int = Field(default=0)
    current_streak: int = Field(default=0)
    highest_streak: int = Field(default=0)
    total_xp: int = Field(default=0)
    level: int = Field(default=1)
    last_study_date: Optional[datetime] = Field(default=None, sa_type=DateTimeTZ)
    # Exam-preparation details the student sets on their profile page.
    target_exam: Optional[str] = Field(default=None, max_length=100)
    target_year: Optional[str] = Field(default=None, max_length=10)
    optional_subject: Optional[str] = Field(default=None, max_length=150)
    weekly_hours: Optional[str] = Field(default=None, max_length=10)
    # Set when the student finishes the first-login onboarding; the optional subject is locked from then on.
    onboarding_completed_at: Optional[datetime] = Field(default=None, sa_type=DateTimeTZ)
    # Leaderboards: state for the state ranking, a unique public handle, and which name to show
    state: Optional[str] = Field(default=None, max_length=64)
    username: Optional[str] = Field(default=None, max_length=20, unique=True, index=True)
    leaderboard_display: str = Field(default="USERNAME", max_length=10)  # USERNAME | NAME
    # Weekly summary email, scheduled by the student (day 0 = Monday, hour 0-23 in their timezone)
    weekly_email_enabled: bool = Field(default=False)
    weekly_email_day: int = Field(default=6)
    weekly_email_hour: int = Field(default=18)
    weekly_email_last_sent_at: Optional[datetime] = Field(default=None, sa_type=DateTimeTZ)
    # Reminder preferences (in-app bell unless noted); all on by default, set on the Notifications tab
    notify_revision: bool = Field(default=True)  # 7 AM IST: questions due for revision
    notify_pending_tasks: bool = Field(default=True)  # daily: study-plan tasks still open
    notify_task_email: bool = Field(default=True)  # the daily pending-task email digest
    notify_weak_topic: bool = Field(default=True)  # Monday: the weakest subtopic to practise
    notify_current_affairs: bool = Field(default=True)  # evening: new current affairs published today
    notify_full_paper: bool = Field(default=True)  # weekly: a full PYQ paper not yet attempted
    notify_full_paper_day: int = Field(default=6)  # 0 = Monday ... 6 = Sunday
    # Self-rated proficiency per subject, 1 (weak) to 5 (strong): {"History": 2, ...}
    subject_proficiency: Optional[dict] = Field(default=None, sa_column=Column(PortableJSON))
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    user: Optional[User] = Relationship(back_populates="student_profile")


class AdminProfile(SQLModel, table=True):
    __tablename__ = "admin_profiles"

    user_id: int = Field(
        foreign_key="users.id", ondelete="CASCADE", primary_key=True, index=True
    )
    organization_name: Optional[str] = Field(default=None, max_length=255)
    department: Optional[str] = Field(default=None, max_length=255)

    approved_by_id: Optional[int] = Field(
        default=None, foreign_key="users.id", ondelete="SET NULL"
    )
    approved_at: Optional[datetime] = Field(default=None, sa_type=DateTimeTZ)
    rejected_by_id: Optional[int] = Field(
        default=None, foreign_key="users.id", ondelete="SET NULL"
    )
    rejected_at: Optional[datetime] = Field(default=None, sa_type=DateTimeTZ)
    rejection_reason: Optional[str] = Field(default=None)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    user: Optional[User] = Relationship(
        back_populates="admin_profile",
        sa_relationship_kwargs={"primaryjoin": "AdminProfile.user_id==User.id"},
    )
    approved_by: Optional[User] = Relationship(
        sa_relationship_kwargs={"primaryjoin": "AdminProfile.approved_by_id==User.id"}
    )
    rejected_by: Optional[User] = Relationship(
        sa_relationship_kwargs={"primaryjoin": "AdminProfile.rejected_by_id==User.id"}
    )


class AdminApprovalLog(SQLModel, table=True):
    __tablename__ = "admin_approval_logs"

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    admin_user_id: int = Field(
        foreign_key="users.id", ondelete="CASCADE", index=True
    )
    reviewed_by_id: Optional[int] = Field(
        default=None, foreign_key="users.id", ondelete="SET NULL", index=True
    )
    action: str = Field(max_length=50)
    reason: Optional[str] = Field(default=None)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )


class AdminActionLog(SQLModel, table=True):
    """Security-relevant staff actions (who did what to whom). Append-only."""

    __tablename__ = "admin_action_logs"

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    actor_id: Optional[int] = Field(
        default=None, foreign_key="users.id", ondelete="SET NULL", index=True
    )
    actor_email: Optional[str] = Field(default=None, max_length=255)
    action: str = Field(max_length=64, index=True)
    target_user_id: Optional[int] = Field(
        default=None, foreign_key="users.id", ondelete="SET NULL", index=True
    )
    target_email: Optional[str] = Field(default=None, max_length=255)
    details: Optional[dict] = Field(default=None, sa_column=Column(PortableJSON))
    ip_address: Optional[str] = Field(default=None, max_length=64)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
        index=True,
    )


class RefreshToken(SQLModel, table=True):
    __tablename__ = "refresh_tokens"

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    token_hash: str
    device_name: Optional[str] = Field(default=None, max_length=255)
    ip_address: Optional[str] = Field(default=None, max_length=45)
    expires_at: datetime = Field(sa_type=DateTimeTZ)
    revoked_at: Optional[datetime] = Field(default=None, sa_type=DateTimeTZ)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    user: Optional[User] = Relationship(back_populates="refresh_tokens")


class QuestionBookmark(SQLModel, table=True):
    __tablename__ = "question_bookmarks"
    __table_args__ = (
        Index("ix_question_bookmarks_user_created", "user_id", "created_at"),
    )

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    question_id: int = Field(foreign_key="questions.id", ondelete="CASCADE", index=True)
    notes: Optional[str] = Field(default=None)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
