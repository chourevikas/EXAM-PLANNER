from datetime import datetime, timedelta
from typing import Tuple, Optional
from sqlalchemy.orm import Session
from app.models.user import User, UserRole, UserStatus
from app.schemas.auth import UserRegister, UserLogin, TokenResponse
from app.repositories.user_repository import UserRepository
from app.core.security import get_password_hash, verify_password, create_access_token, create_refresh_token
from app.core.exceptions import (
  UserAlreadyExistsException,
  InvalidCredentialsException,
  RoleMismatchException,
  InactiveUserException,
  AdminPendingApprovalException,
  AdminRejectedException
)
from app.config import settings
from app.services.email_service import email_service
import jwt
import logging

logger = logging.getLogger(__name__)
class AuthService:
  def __init__(self, db: Session):
    self.db = db
    self.user_repo = UserRepository(db)

  def get_role_redirect(self, role: UserRole) -> str:
    if role == UserRole.SUPER_ADMIN:
      return "/superadmin"
    elif role == UserRole.ADMIN:
      return "/admin"
    return "/dashboard"

  def register_user(self, user_in: UserRegister) -> Tuple[TokenResponse, Optional[str]]:
    existing_user = self.user_repo.get_by_email(user_in.email)
    if existing_user:
      raise UserAlreadyExistsException(user_in.email)

    hashed_pw = get_password_hash(user_in.password)
    user_role = user_in.role or UserRole.STUDENT

    user = self.user_repo.create_user(
      email=user_in.email,
      full_name=user_in.full_name,
      password_hash=hashed_pw,
      role=user_role,
      organization_name=user_in.organization_name,
      department=user_in.department
    )

    # If registering as ADMIN, require Super Admin approval before issuing tokens
    if user.role == UserRole.ADMIN and user.status == UserStatus.PENDING:
      token_response = TokenResponse(
        access_token="",
        token_type="bearer",
        user=None,
        redirect_url="/signin",
        is_pending_approval=True,
        message="Successfully registered! Please wait for Super Admin approval before logging in."
      )
      return token_response, None

    # For STUDENT or ACTIVE accounts, issue tokens immediately
    access_token = create_access_token(subject=user.id, role=user.role.value)
    refresh_token = create_refresh_token(subject=user.id, role=user.role.value)

    expires_at = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    self.user_repo.save_refresh_token(
      user_id=user.id,
      token_hash=get_password_hash(refresh_token),
      expires_at=expires_at
    )

    redirect_url = self.get_role_redirect(user.role)

    token_response = TokenResponse(
      access_token=access_token,
      token_type="bearer",
      user=user,
      redirect_url=redirect_url,
      is_pending_approval=False,
      message="Registration successful!"
    )

    # Send verification email asynchronously-like
    verification_token = jwt.encode(
      {"sub": user.id, "action": "verify_email", "exp": datetime.utcnow() + timedelta(days=1)},
      settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )
    try:
      email_service.send_verification_email(user.email, verification_token)
    except Exception as e:
      logger.error(f"Failed to send verification email: {e}")

    return token_response, refresh_token

  def authenticate_user(self, user_in: UserLogin) -> Tuple[TokenResponse, str]:
    user = self.user_repo.get_by_email(user_in.email)
    if not user or not verify_password(user_in.password, user.password_hash):
      raise InvalidCredentialsException()

    if user.status == UserStatus.PENDING:
      raise AdminPendingApprovalException()

    if user.status == UserStatus.REJECTED:
      reason = user.admin_profile.rejection_reason if user.admin_profile else None
      raise AdminRejectedException(reason=reason)

    if user.status != UserStatus.ACTIVE:
      raise InactiveUserException()

    if user_in.role and user.role != user_in.role:
      raise RoleMismatchException(actual_role=user.role.value, requested_role=user_in.role.value)

    self.user_repo.update_last_login(user.id)

    access_token = create_access_token(subject=user.id, role=user.role.value)
    refresh_token = create_refresh_token(subject=user.id, role=user.role.value)

    expires_at = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    self.user_repo.save_refresh_token(
      user_id=user.id,
      token_hash=get_password_hash(refresh_token),
      expires_at=expires_at
    )

    redirect_url = self.get_role_redirect(user.role)

    token_response = TokenResponse(
      access_token=access_token,
      token_type="bearer",
      user=user,
      redirect_url=redirect_url,
      is_pending_approval=False,
      message="Login successful!"
    )

    return token_response, refresh_token

  def logout_user(self, user_id: str) -> None:
    self.user_repo.revoke_user_refresh_tokens(user_id)

  def verify_email(self, token: str) -> bool:
    try:
      payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
      if payload.get("action") != "verify_email":
        return False
      user_id = payload.get("sub")
      user = self.user_repo.db.query(User).filter(User.id == user_id).first()
      if user:
        user.is_verified = True
        self.user_repo.db.commit()
        return True
    except jwt.PyJWTError:
      return False
    return False

  def forgot_password(self, email: str) -> bool:
    user = self.user_repo.get_by_email(email)
    if not user:
      return True  # Silently return true to prevent email enumeration
    
    reset_token = jwt.encode(
      {"sub": user.id, "action": "reset_password", "exp": datetime.utcnow() + timedelta(hours=1)},
      settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )
    try:
      email_service.send_password_reset_email(user.email, reset_token)
    except Exception as e:
      logger.error(f"Failed to send password reset email: {e}")
    return True

  def reset_password(self, token: str, new_password: str) -> bool:
    try:
      payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
      if payload.get("action") != "reset_password":
        return False
      user_id = payload.get("sub")
      user = self.user_repo.db.query(User).filter(User.id == user_id).first()
      if user:
        user.password_hash = get_password_hash(new_password)
        self.user_repo.db.commit()
        return True
    except jwt.PyJWTError:
      return False
    return False
