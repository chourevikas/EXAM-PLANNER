from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from app.models.user import User, UserRole, UserStatus, StudentProfile, AdminProfile, AdminApprovalLog, RefreshToken

class UserRepository:
  def __init__(self, db: Session):
    self.db = db

  def get_by_email(self, email: str) -> Optional[User]:
    return self.db.query(User).filter(User.email == email.lower()).first()

  def get_by_id(self, user_id: str) -> Optional[User]:
    return self.db.query(User).filter(User.id == user_id).first()

  def create_user(
    self,
    email: str,
    full_name: str,
    password_hash: str,
    role: UserRole = UserRole.STUDENT,
    organization_name: Optional[str] = None,
    department: Optional[str] = None
  ) -> User:
    status = UserStatus.PENDING if role == UserRole.ADMIN else UserStatus.ACTIVE

    new_user = User(
      email=email.lower(),
      full_name=full_name,
      password_hash=password_hash,
      role=role,
      status=status,
    )
    self.db.add(new_user)
    self.db.commit()
    self.db.refresh(new_user)

    if role == UserRole.STUDENT:
      student_prof = StudentProfile(user_id=new_user.id)
      self.db.add(student_prof)
    elif role == UserRole.ADMIN:
      admin_prof = AdminProfile(
        user_id=new_user.id,
        organization_name=organization_name,
        department=department
      )
      self.db.add(admin_prof)

    self.db.commit()
    self.db.refresh(new_user)
    return new_user

  def get_pending_admins(self) -> List[User]:
    return self.db.query(User).filter(
      User.role == UserRole.ADMIN,
      User.status == UserStatus.PENDING
    ).order_by(User.created_at.desc()).all()

  def get_active_admins(self) -> List[User]:
    return self.db.query(User).filter(
      User.role == UserRole.ADMIN,
      User.status.in_([UserStatus.ACTIVE, UserStatus.SUSPENDED])
    ).order_by(User.created_at.desc()).all()

  def suspend_admin(self, admin_id: str) -> Optional[User]:
    user = self.get_by_id(admin_id)
    if not user or user.role != UserRole.ADMIN:
      return None
    user.status = UserStatus.SUSPENDED
    self.db.commit()
    self.db.refresh(user)
    return user

  def reactivate_admin(self, admin_id: str) -> Optional[User]:
    user = self.get_by_id(admin_id)
    if not user or user.role != UserRole.ADMIN:
      return None
    user.status = UserStatus.ACTIVE
    self.db.commit()
    self.db.refresh(user)
    return user

  def approve_admin(self, admin_id: str, super_admin_id: str) -> Optional[User]:
    user = self.get_by_id(admin_id)
    if not user or user.role != UserRole.ADMIN:
      return None

    user.status = UserStatus.ACTIVE
    if user.admin_profile:
      user.admin_profile.approved_by_id = super_admin_id
      user.admin_profile.approved_at = datetime.utcnow()

    log = AdminApprovalLog(
      admin_user_id=admin_id,
      reviewed_by_id=super_admin_id,
      action="APPROVED"
    )
    self.db.add(log)
    self.db.commit()
    self.db.refresh(user)
    return user

  def reject_admin(self, admin_id: str, super_admin_id: str, reason: Optional[str] = None) -> Optional[User]:
    user = self.get_by_id(admin_id)
    if not user or user.role != UserRole.ADMIN:
      return None

    user.status = UserStatus.REJECTED
    if user.admin_profile:
      user.admin_profile.rejected_by_id = super_admin_id
      user.admin_profile.rejected_at = datetime.utcnow()
      user.admin_profile.rejection_reason = reason

    log = AdminApprovalLog(
      admin_user_id=admin_id,
      reviewed_by_id=super_admin_id,
      action="REJECTED",
      reason=reason
    )
    self.db.add(log)
    self.db.commit()
    self.db.refresh(user)
    return user

  def get_approval_logs(self) -> List[AdminApprovalLog]:
    return self.db.query(AdminApprovalLog).order_by(AdminApprovalLog.created_at.desc()).all()

  def get_system_stats(self) -> Dict[str, Any]:
    pending_admins = self.db.query(User).filter(User.role == UserRole.ADMIN, User.status == UserStatus.PENDING).count()
    active_admins = self.db.query(User).filter(User.role == UserRole.ADMIN, User.status == UserStatus.ACTIVE).count()
    active_students = self.db.query(User).filter(User.role == UserRole.STUDENT, User.status == UserStatus.ACTIVE).count()
    rejected_admins = self.db.query(User).filter(User.role == UserRole.ADMIN, User.status == UserStatus.REJECTED).count()

    return {
      "pending_admins_count": pending_admins,
      "active_admins_count": active_admins,
      "active_students_count": active_students,
      "rejected_admins_count": rejected_admins,
      "aws_rds_status": "Healthy & Connected",
      "database_name": "postgres",
      "db_host": "examplanner.cbwe2uwqetyt.ap-southeast-2.rds.amazonaws.com"
    }

  def update_last_login(self, user_id: str) -> None:
    user = self.get_by_id(user_id)
    if user:
      user.last_login = datetime.utcnow()
      self.db.commit()

  def save_refresh_token(
    self,
    user_id: str,
    token_hash: str,
    expires_at: datetime,
    device_name: Optional[str] = None,
    ip_address: Optional[str] = None
  ) -> RefreshToken:
    token_record = RefreshToken(
      user_id=user_id,
      token_hash=token_hash,
      expires_at=expires_at,
      device_name=device_name,
      ip_address=ip_address
    )
    self.db.add(token_record)
    self.db.commit()
    self.db.refresh(token_record)
    return token_record

  def revoke_user_refresh_tokens(self, user_id: str) -> None:
    self.db.query(RefreshToken).filter(
      RefreshToken.user_id == user_id,
      RefreshToken.revoked_at.is_(None)
    ).update({"revoked_at": datetime.utcnow()})
    self.db.commit()
