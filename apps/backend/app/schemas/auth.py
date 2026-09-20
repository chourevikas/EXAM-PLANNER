from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict, Field, field_validator
from app.db.models.user import UserRole, UserStatus, SubscriptionTier


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: Optional[UserRole] = UserRole.STUDENT
    organization_name: Optional[str] = None
    department: Optional[str] = None
    preferred_language: Optional[str] = "en"


class UserLogin(BaseModel):
    email: EmailStr
    password: str
    role: Optional[UserRole] = None


class StudentProfileOut(BaseModel):
    subscription_tier: SubscriptionTier
    free_questions_attempted: int
    current_streak: int
    highest_streak: int
    total_xp: int
    level: int

    model_config = ConfigDict(from_attributes=True)


class AdminProfileOut(BaseModel):
    organization_name: Optional[str] = None
    department: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class UserOut(BaseModel):
    id: int
    full_name: str
    email: str
    role: UserRole
    status: UserStatus
    subscription_tier: SubscriptionTier
    profile_image: Optional[str] = None
    phone: Optional[str] = None
    subscription_ends_at: Optional[datetime] = None
    subscription_days_remaining: Optional[int] = None
    # Admin panel sections this admin may use; None means unrestricted.
    admin_permissions: Optional[list[str]] = None
    # Exam-preparation details the student saved on their profile.
    target_exam: Optional[str] = None
    target_year: Optional[str] = None
    optional_subject: Optional[str] = None
    weekly_hours: Optional[str] = None
    subject_proficiency: Optional[dict[str, int]] = None
    # False until a student finishes first-login onboarding; always True for staff.
    onboarding_completed: bool = True
    preferred_language: str = "en"
    free_questions_attempted: Optional[int] = 0
    total_questions_attempted: Optional[int] = 0
    today_questions_attempted: Optional[int] = 0
    current_streak: Optional[int] = 0
    total_xp: Optional[int] = 0
    level: Optional[int] = 1
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    profile_image: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    target_exam: Optional[str] = None
    target_year: Optional[str] = None
    optional_subject: Optional[str] = None
    weekly_hours: Optional[str] = None
    preferred_language: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: Optional[str] = None
    token_type: str = "bearer"
    user: Optional[UserOut] = None
    redirect_url: str
    is_pending_approval: bool = False
    message: Optional[str] = None


class RefreshTokenRequest(BaseModel):
    refresh_token: Optional[str] = None


class ClerkExchangeRequest(BaseModel):
    clerk_token: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    profile_image: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class VerifyEmailRequest(BaseModel):
    token: str


class AdminApprovalRequestOut(BaseModel):
    id: int
    full_name: str
    email: str
    role: UserRole
    status: UserStatus
    organization_name: Optional[str] = None
    department: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminActionPayload(BaseModel):
    reason: Optional[str] = None


class AdminApprovalLogOut(BaseModel):
    id: int
    admin_user_name: str
    admin_user_email: str
    action: str
    reviewed_by_name: str
    reason: Optional[str] = None
    created_at: datetime


class SystemStatsOut(BaseModel):
    pending_admins_count: int
    active_admins_count: int
    active_students_count: int
    rejected_admins_count: int
    aws_rds_status: str
    database_name: str
    db_host: str


class OverviewMetricOut(BaseModel):
    title: str
    value: str
    badge: str
    color: str
    bg: str
    icon_name: str


class RecentUploadItemOut(BaseModel):
    id: int | str
    title: str
    questions: int
    date: str
    status: str
    confidence: float
    is_extracting: bool = False
    raw_status: Optional[str] = None
    total_questions: Optional[int] = 100
    extracted_questions_count: Optional[int] = 0


class SubjectBreakdownItemOut(BaseModel):
    subject: str
    count: int
    percent: float
    color: str


class AdminOverviewStatsOut(BaseModel):
    metrics: list[OverviewMetricOut]
    recent_uploads: list[RecentUploadItemOut]
    subject_breakdown: list[SubjectBreakdownItemOut]


class UserDirectoryItemOut(BaseModel):
    id: int
    full_name: str
    email: str
    role: UserRole
    status: UserStatus
    organization_name: Optional[str] = None
    department: Optional[str] = None
    target_exam: Optional[str] = None
    target_year: Optional[str] = None
    created_at: datetime
    suspended_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    custom_role_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class UpdateRolePayload(BaseModel):
    new_role: UserRole


class OnboardingRequest(BaseModel):
    """First-login questionnaire. Locks the student's primary target once saved."""
    target_exam: str = Field(min_length=1, max_length=100)
    target_year: str = Field(min_length=1, max_length=10)
    optional_subject: Optional[str] = Field(default=None, max_length=150)
    weekly_hours: str = Field(min_length=1, max_length=10)
    preferred_language: str = "en"
    # Self-rated proficiency per subject: 1 (weak) to 5 (strong).
    subject_proficiency: dict[str, int] = Field(default_factory=dict)

    @field_validator("subject_proficiency")
    @classmethod
    def _validate_proficiency(cls, v: dict[str, int]) -> dict[str, int]:
        if len(v) > 60:
            raise ValueError("Too many subjects")
        cleaned = {}
        for subject, rating in v.items():
            name = subject.strip()
            if not name or len(name) > 150:
                raise ValueError("Invalid subject name")
            if not 1 <= rating <= 5:
                raise ValueError(f"Proficiency for '{name}' must be between 1 and 5")
            cleaned[name] = rating
        return cleaned
