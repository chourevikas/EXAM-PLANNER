import uuid
import enum
from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from app.db.models.enums import UserRole, UserStatus
from app.db.models.types import DateTimeTZ

if TYPE_CHECKING:
    from app.db.models.subscription import UserSubscription


class SubscriptionTier(str, enum.Enum):
    GUEST = "GUEST"
    FREE = "FREE"
    PREMIUM = "PREMIUM"


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    full_name: str = Field(max_length=255)
    email: str = Field(unique=True, index=True, max_length=255)
    clerk_id: Optional[str] = Field(default=None, unique=True, index=True, max_length=255)
    password_hash: Optional[str] = Field(default=None)
    role: UserRole = Field(default=UserRole.STUDENT)
    status: UserStatus = Field(default=UserStatus.ACTIVE)
    is_verified: bool = Field(default=False)
    profile_image: Optional[str] = Field(default=None)
    timezone: str = Field(default="Asia/Kolkata", max_length=100)
    last_login: Optional[datetime] = Field(default=None, sa_type=DateTimeTZ)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
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
        return SubscriptionTier.PREMIUM

    @property
    def free_questions_attempted(self) -> int:
        prof = self._get_student_profile_safe()
        return prof.free_questions_attempted if prof else 0

    @property
    def current_streak(self) -> int:
        prof = self._get_student_profile_safe()
        return prof.current_streak if prof else 0

    @property
    def total_xp(self) -> int:
        prof = self._get_student_profile_safe()
        return prof.total_xp if prof else 0


class StudentProfile(SQLModel, table=True):
    __tablename__ = "student_profiles"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="users.id", ondelete="CASCADE", unique=True, index=True
    )
    subscription_tier: SubscriptionTier = Field(default=SubscriptionTier.FREE)
    free_questions_attempted: int = Field(default=0)
    current_streak: int = Field(default=0)
    highest_streak: int = Field(default=0)
    total_xp: int = Field(default=0)
    level: int = Field(default=1)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    user: Optional[User] = Relationship(back_populates="student_profile")


class AdminProfile(SQLModel, table=True):
    __tablename__ = "admin_profiles"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="users.id", ondelete="CASCADE", unique=True, index=True
    )
    organization_name: Optional[str] = Field(default=None, max_length=255)
    department: Optional[str] = Field(default=None, max_length=255)

    approved_by_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="users.id", ondelete="SET NULL"
    )
    approved_at: Optional[datetime] = Field(default=None)
    rejected_by_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="users.id", ondelete="SET NULL"
    )
    rejected_at: Optional[datetime] = Field(default=None)
    rejection_reason: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)

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

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    admin_user_id: uuid.UUID = Field(
        foreign_key="users.id", ondelete="CASCADE", index=True
    )
    reviewed_by_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="users.id", ondelete="SET NULL"
    )
    action: str = Field(max_length=50)
    reason: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class RefreshToken(SQLModel, table=True):
    __tablename__ = "refresh_tokens"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    token_hash: str
    device_name: Optional[str] = Field(default=None, max_length=255)
    ip_address: Optional[str] = Field(default=None, max_length=45)
    expires_at: datetime
    revoked_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    user: Optional[User] = Relationship(back_populates="refresh_tokens")
