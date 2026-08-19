import uuid
import jwt
from datetime import datetime, timedelta
from typing import Tuple, Optional
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models.user import User, UserRole, UserStatus
from app.schemas.auth import UserRegister, UserLogin, TokenResponse, UserOut
from app.repositories.user_repository import UserRepository
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
)
from app.core.exceptions import (
    UserAlreadyExistsException,
    InvalidCredentialsException,
    RoleMismatchException,
    InactiveUserException,
    AdminPendingApprovalException,
    AdminRejectedException,
)
from app.config.settings import settings
from app.services.email_service import email_service

from app.config.logger import setup_logger

logger = setup_logger("AuthService")


class AuthService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepository(session)

    def get_role_redirect(self, role: UserRole) -> str:
        if role == UserRole.SUPER_ADMIN:
            return "/superadmin"
        elif role == UserRole.ADMIN:
            return "/admin"
        return "/dashboard"

    async def register_user(
        self, user_in: UserRegister
    ) -> Tuple[TokenResponse, Optional[str]]:
        existing_user = await self.user_repo.get_by_email(user_in.email)
        if existing_user:
            raise UserAlreadyExistsException(user_in.email)

        hashed_pw = get_password_hash(user_in.password)
        user_role = user_in.role or UserRole.STUDENT

        user = await self.user_repo.create_user(
            email=user_in.email,
            full_name=user_in.full_name,
            password_hash=hashed_pw,
            role=user_role,
            organization_name=user_in.organization_name,
            department=user_in.department,
        )

        if user.role == UserRole.ADMIN and user.status == UserStatus.PENDING:
            token_response = TokenResponse(
                access_token="",
                token_type="bearer",
                user=None,
                redirect_url="/signin",
                is_pending_approval=True,
                message="Successfully registered! Please wait for Super Admin approval before logging in.",
            )
            return token_response, None

        u_id = user.id
        u_role = user.role

        user_out = UserOut(
            id=str(user.id),
            full_name=user.full_name,
            email=user.email,
            role=user.role,
            status=user.status,
            subscription_tier=user.subscription_tier,
            free_questions_attempted=user.free_questions_attempted,
            current_streak=user.current_streak,
            total_xp=user.total_xp,
            level=user.level,
            created_at=user.created_at,
        )

        access_token = create_access_token(subject=u_id, role=u_role.value)
        refresh_token = create_refresh_token(subject=u_id, role=u_role.value)

        expires_at = datetime.utcnow() + timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )
        await self.user_repo.save_refresh_token(
            user_id=u_id,
            token_hash=get_password_hash(refresh_token),
            expires_at=expires_at,
        )

        redirect_url = self.get_role_redirect(u_role)

        token_response = TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=user_out,
            redirect_url=redirect_url,
            is_pending_approval=False,
            message="Registration successful!",
        )

        verification_token = jwt.encode(
            {
                "sub": str(u_id),
                "action": "verify_email",
                "exp": datetime.utcnow() + timedelta(days=1),
            },
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )
        try:
            email_service.send_verification_email(user_out.email, verification_token)
        except Exception as e:
            logger.error(f"Failed to send verification email: {e}")

        return token_response, refresh_token

    async def authenticate_user(self, user_in: UserLogin) -> Tuple[TokenResponse, str]:
        user = await self.user_repo.get_by_email(user_in.email)
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
            raise RoleMismatchException(
                actual_role=user.role.value, requested_role=user_in.role.value
            )

        await self.user_repo.update_last_login(user.id)

        access_token = create_access_token(subject=user.id, role=user.role.value)
        refresh_token = create_refresh_token(subject=user.id, role=user.role.value)

        expires_at = datetime.utcnow() + timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )
        await self.user_repo.save_refresh_token(
            user_id=user.id,
            token_hash=get_password_hash(refresh_token),
            expires_at=expires_at,
        )

        redirect_url = self.get_role_redirect(user.role)

        token_response = TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=user,
            redirect_url=redirect_url,
            is_pending_approval=False,
            message="Login successful!",
        )

        return token_response, refresh_token

    async def logout_user(self, user_id: uuid.UUID | str) -> None:
        await self.user_repo.revoke_user_refresh_tokens(user_id)

    async def verify_email(self, token: str) -> bool:
        try:
            payload = jwt.decode(
                token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
            )
            if payload.get("action") != "verify_email":
                return False
            user_id_str = payload.get("sub")
            user = await self.user_repo.get_by_id(user_id_str)
            if user:
                user.is_verified = True
                self.session.add(user)
                await self.session.commit()
                return True
        except jwt.PyJWTError:
            return False
        return False

    async def forgot_password(self, email: str) -> bool:
        user = await self.user_repo.get_by_email(email)
        if not user:
            return True

        reset_token = jwt.encode(
            {
                "sub": str(user.id),
                "action": "reset_password",
                "exp": datetime.utcnow() + timedelta(hours=1),
            },
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )
        try:
            email_service.send_password_reset_email(user.email, reset_token)
        except Exception as e:
            logger.error(f"Failed to send password reset email: {e}")
        return True

    async def reset_password(self, token: str, new_password: str) -> bool:
        try:
            payload = jwt.decode(
                token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
            )
            if payload.get("action") != "reset_password":
                return False
            user_id_str = payload.get("sub")
            user = await self.user_repo.get_by_id(user_id_str)
            if user:
                user.password_hash = get_password_hash(new_password)
                self.session.add(user)
                await self.session.commit()
                return True
        except jwt.PyJWTError:
            return False
        return False
