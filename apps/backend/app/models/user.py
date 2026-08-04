import enum
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, Integer, DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class UserRole(str, enum.Enum):
  STUDENT = "STUDENT"
  ADMIN = "ADMIN"
  SUPER_ADMIN = "SUPER_ADMIN"

class UserStatus(str, enum.Enum):
  PENDING = "PENDING"
  ACTIVE = "ACTIVE"
  SUSPENDED = "SUSPENDED"
  REJECTED = "REJECTED"

class SubscriptionTier(str, enum.Enum):
  GUEST = "GUEST"
  FREE = "FREE"
  PREMIUM = "PREMIUM"

class User(Base):
  __tablename__ = "users"

  id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
  full_name = Column(String(255), nullable=False)
  email = Column(String(255), unique=True, index=True, nullable=False)
  password_hash = Column(Text, nullable=False)
  role = Column(Enum(UserRole), default=UserRole.STUDENT, nullable=False)
  status = Column(Enum(UserStatus), default=UserStatus.ACTIVE, nullable=False)
  is_verified = Column(Boolean, default=False)
  profile_image = Column(Text, nullable=True)
  timezone = Column(String(100), default="Asia/Kolkata")
  last_login = Column(DateTime, nullable=True)
  created_at = Column(DateTime, default=datetime.utcnow)
  updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

  # Relationships
  student_profile = relationship("StudentProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
  admin_profile = relationship("AdminProfile", back_populates="user", foreign_keys="[AdminProfile.user_id]", uselist=False, cascade="all, delete-orphan")
  refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")

  @property
  def subscription_tier(self):
    if self.student_profile:
      return self.student_profile.subscription_tier
    return SubscriptionTier.PREMIUM

  @property
  def free_questions_attempted(self):
    return self.student_profile.free_questions_attempted if self.student_profile else 0

  @property
  def current_streak(self):
    return self.student_profile.current_streak if self.student_profile else 0

  @property
  def total_xp(self):
    return self.student_profile.total_xp if self.student_profile else 0


class StudentProfile(Base):
  __tablename__ = "student_profiles"

  id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
  user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
  subscription_tier = Column(Enum(SubscriptionTier), default=SubscriptionTier.FREE, nullable=False)
  free_questions_attempted = Column(Integer, default=0)
  current_streak = Column(Integer, default=0)
  highest_streak = Column(Integer, default=0)
  total_xp = Column(Integer, default=0)
  level = Column(Integer, default=1)
  created_at = Column(DateTime, default=datetime.utcnow)

  user = relationship("User", back_populates="student_profile")


class AdminProfile(Base):
  __tablename__ = "admin_profiles"

  id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
  user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
  organization_name = Column(String(255), nullable=True)
  department = Column(String(255), nullable=True)
  
  # Approval Metadata
  approved_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
  approved_at = Column(DateTime, nullable=True)
  rejected_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
  rejected_at = Column(DateTime, nullable=True)
  rejection_reason = Column(Text, nullable=True)
  created_at = Column(DateTime, default=datetime.utcnow)

  user = relationship("User", back_populates="admin_profile", foreign_keys=[user_id])
  approved_by = relationship("User", foreign_keys=[approved_by_id])
  rejected_by = relationship("User", foreign_keys=[rejected_by_id])


class AdminApprovalLog(Base):
  __tablename__ = "admin_approval_logs"

  id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
  admin_user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
  reviewed_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
  action = Column(String(50), nullable=False) # APPROVED | REJECTED
  reason = Column(Text, nullable=True)
  created_at = Column(DateTime, default=datetime.utcnow)


class RefreshToken(Base):
  __tablename__ = "refresh_tokens"

  id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
  user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
  token_hash = Column(Text, nullable=False)
  device_name = Column(String(255), nullable=True)
  ip_address = Column(String(45), nullable=True)
  expires_at = Column(DateTime, nullable=False)
  revoked_at = Column(DateTime, nullable=True)
  created_at = Column(DateTime, default=datetime.utcnow)

  user = relationship("User", back_populates="refresh_tokens")
