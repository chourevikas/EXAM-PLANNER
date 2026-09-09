from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, ConfigDict
from app.db.models.user import UserRole, UserStatus, SubscriptionTier


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: Optional[UserRole] = UserRole.STUDENT
    timezone: Optional[str] = "Asia/Kolkata"
    preferred_language: Optional[str] = "en"


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    status: Optional[UserStatus] = None
    subscription_tier: Optional[SubscriptionTier] = None
    preferred_language: Optional[str] = None


class UserRead(UserBase):
    id: int
    status: UserStatus
    subscription_tier: SubscriptionTier
    preferred_language: str = "en"
    free_questions_attempted: int
    current_streak: int
    total_xp: int
    level: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
