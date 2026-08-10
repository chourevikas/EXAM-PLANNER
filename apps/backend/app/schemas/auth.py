import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict
from app.db.models.user import UserRole, UserStatus, SubscriptionTier


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: Optional[UserRole] = UserRole.STUDENT
    organization_name: Optional[str] = None
    department: Optional[str] = None


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
    id: uuid.UUID | str
    full_name: str
    email: EmailStr
    role: UserRole
    status: UserStatus
    subscription_tier: SubscriptionTier
    free_questions_attempted: Optional[int] = 0
    current_streak: Optional[int] = 0
    total_xp: Optional[int] = 0
    level: Optional[int] = 1
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: Optional[str] = None
    token_type: str = "bearer"
    user: Optional[UserOut] = None
    redirect_url: str
    is_pending_approval: bool = False
    message: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class VerifyEmailRequest(BaseModel):
    token: str


class AdminApprovalRequestOut(BaseModel):
    id: uuid.UUID | str
    full_name: str
    email: EmailStr
    role: UserRole
    status: UserStatus
    organization_name: Optional[str] = None
    department: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminActionPayload(BaseModel):
    reason: Optional[str] = None


class AdminApprovalLogOut(BaseModel):
    id: uuid.UUID | str
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
