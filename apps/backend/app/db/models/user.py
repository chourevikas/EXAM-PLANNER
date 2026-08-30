import enum
from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from app.db.models.enums import UserRole, UserStatus
from app.db.models.types import DateTimeTZ

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

    id: Optional[int] = Field(default=None, primary_key=True)
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
    profile_image: Optional[str] = Field(default=None)
    timezone: str = Field(default="Asia/Kolkata", max_length=100)
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
    subscriptions: List["UserSubscription"] = Relationship(back_populates="user")
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

    id: Optional[int] = Field(default=None, primary_key=True)
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


class RefreshToken(SQLModel, table=True):
    __tablename__ = "refresh_tokens"

    id: Optional[int] = Field(default=None, primary_key=True)
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

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    question_id: int = Field(foreign_key="questions.id", ondelete="CASCADE", index=True)
    notes: Optional[str] = Field(default=None)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
