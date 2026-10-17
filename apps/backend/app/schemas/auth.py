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
    # Authenticator code (or a one-time recovery code) for accounts with MFA enabled.
    otp: Optional[str] = None


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
    state: Optional[str] = None
    username: Optional[str] = None
    leaderboard_display: Optional[str] = None
    weekly_email_enabled: Optional[bool] = None
    weekly_email_day: Optional[int] = None
    weekly_email_hour: Optional[int] = None
    # False until a student finishes first-login onboarding; always True for staff.
    onboarding_completed: bool = True
    # True while the account still uses an emailed temporary password.
    must_change_password: bool = False
    # Super Admin authenticator app: enrolled / must be enrolled before anything else is usable.
    mfa_enabled: bool = False
    mfa_setup_required: bool = False
    preferred_language: str = "en"
    free_questions_attempted: Optional[int] = 0
    total_questions_attempted: Optional[int] = 0
    today_questions_attempted: Optional[int] = 0
    current_streak: Optional[int] = 0
    total_xp: Optional[int] = 0
    level: Optional[int] = 1
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


def clean_subject_proficiency(v: dict[str, int]) -> dict[str, int]:
    """Validate self-rated subject proficiency: at most 60 subjects, ratings 1 (weak) to 5 (strong)."""
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
    # Leaderboards: state, public username (3-20 of a-z, 0-9, _), and USERNAME | NAME to display
    state: Optional[str] = None
    username: Optional[str] = None
    leaderboard_display: Optional[str] = None
    # Weekly summary email: on/off, day (0 = Monday ... 6 = Sunday) and hour (0-23, the user's timezone)
    weekly_email_enabled: Optional[bool] = None
    weekly_email_day: Optional[int] = Field(default=None, ge=0, le=6)
    weekly_email_hour: Optional[int] = Field(default=None, ge=0, le=23)
    # Full replacement of the student's subject ratings; {} clears them.
    subject_proficiency: Optional[dict[str, int]] = None

    @field_validator("subject_proficiency")
    @classmethod
    def _validate_proficiency(cls, v: Optional[dict[str, int]]) -> Optional[dict[str, int]]:
        return None if v is None else clean_subject_proficiency(v)


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
    # Accepted for compatibility with older clients but ignored: identity comes from Clerk's API.
    email: Optional[str] = None
    full_name: Optional[str] = None
    profile_image: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


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
    # Upload time as an ISO-8601 UTC timestamp, so the browser can show it in the viewer's timezone.
    created_at: Optional[str] = None
    stage: Optional[str] = None
    source_year: Optional[int] = None
    paper_set_code: Optional[str] = None
    is_mixed_bank: bool = False


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
        return clean_subject_proficiency(v)


class MfaSetupOut(BaseModel):
    secret: str
    otpauth_uri: str


class MfaVerifyRequest(BaseModel):
    code: str = Field(min_length=6, max_length=12)


class MfaVerifyOut(BaseModel):
    # Shown once; only their hashes are stored.
    recovery_codes: list[str]


class AdminActionLogOut(BaseModel):
    id: int
    actor_email: Optional[str] = None
    action: str
    target_email: Optional[str] = None
    details: Optional[dict] = None
    ip_address: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
