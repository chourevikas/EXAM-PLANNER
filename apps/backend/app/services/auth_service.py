import uuid
import jwt
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Tuple, Optional
from fastapi import HTTPException, Request
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models.user import User, UserRole, UserStatus
from app.schemas.auth import UserRegister, UserLogin, TokenResponse, UserOut
from app.repositories.user_repository import UserRepository
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    get_token_hash,
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
from app.services import audit_service
from app.core import rate_limit, totp
from app.core.session_policy import superadmin_app_allowed

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
        elif role == UserRole.TEACHER:
            return "/teacher"
        return "/dashboard"

    async def register_user(
        self, user_in: UserRegister
    ) -> Tuple[TokenResponse, Optional[str]]:
        # Public sign-up only ever creates students. Staff accounts are created by a Super Admin
        # (UserService.create_staff_user). Checked first so a rejected request has no side effects
        # (e.g. archiving a suspended account's email).
        if user_in.role not in (None, UserRole.STUDENT):
            raise HTTPException(
                status_code=403,
                detail="Only student accounts can be self-registered.",
            )

        existing_user = await self.user_repo.get_by_email(user_in.email)
        if existing_user:
            if existing_user.status == UserStatus.SUSPENDED:
                if existing_user.is_in_cooling_period:
                    ends_at_str = (
                        existing_user.cooling_period_ends_at.strftime("%b %d, %Y %H:%M UTC")
                        if existing_user.cooling_period_ends_at
                        else "7 days"
                    )
                    raise HTTPException(
                        status_code=400,
                        detail=f"This email ({user_in.email}) is under a mandatory 7-day cooling period following account suspension. You can re-register with this email after {ends_at_str}.",
                    )
                else:
                    # Cooling period expired (> 7 days). Release email for new account registration.
                    existing_user.email = f"archived_{existing_user.id}_{existing_user.email}"
                    self.session.add(existing_user)
                    await self.session.commit()
            else:
                raise UserAlreadyExistsException(user_in.email)

        hashed_pw = get_password_hash(user_in.password)
        user_role = UserRole.STUDENT

        user = await self.user_repo.create_user(
            email=user_in.email,
            full_name=user_in.full_name,
            password_hash=hashed_pw,
            role=user_role,
            organization_name=user_in.organization_name,
            department=user_in.department,
            preferred_language=user_in.preferred_language or "en",
        )

        if user.status == UserStatus.PENDING:
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
            preferred_language=getattr(user, "preferred_language", "en") or "en",
            free_questions_attempted=user.free_questions_attempted,
            current_streak=user.current_streak,
            total_xp=user.total_xp,
            level=user.level,
            created_at=user.created_at,
        )

        access_token = create_access_token(subject=u_id, role=u_role.value)
        refresh_token = create_refresh_token(subject=u_id, role=u_role.value)

        expires_at = datetime.now(timezone.utc) + timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )
        await self.user_repo.save_refresh_token(
            user_id=u_id,
            token_hash=get_token_hash(refresh_token),
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
                "exp": datetime.now(timezone.utc) + timedelta(days=1),
            },
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )
        try:
            asyncio.create_task(email_service.send_verification_email(user_out.email, verification_token))
        except Exception as e:
            logger.error(f"Failed to dispatch verification email: {e}")

        return token_response, refresh_token

    async def authenticate_user(
        self, user_in: UserLogin, request: Optional[Request] = None
    ) -> Tuple[TokenResponse, str]:
        await rate_limit.ensure_not_locked(user_in.email)

        user = await self.user_repo.get_by_email_for_auth(user_in.email)
        # Always run bcrypt (even for missing users) to prevent timing-based user enumeration
        _DUMMY_HASH = "$2b$12$placeholderHashToPreventTimingLeakOnMissingUser000000000"
        hash_to_check = user.password_hash if (user and user.password_hash) else _DUMMY_HASH
        loop = asyncio.get_event_loop()
        password_ok = await loop.run_in_executor(None, verify_password, user_in.password, hash_to_check)
        if not user or not password_ok:
            await self._register_failed_login(user_in.email, user, request, reason="bad_password")
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

        if user.role == UserRole.SUPER_ADMIN:
            if not superadmin_app_allowed(request):
                # Same answer as a wrong password: do not reveal that the account exists or its role.
                await self._register_failed_login(user_in.email, user, request, reason="wrong_app")
                raise InvalidCredentialsException()
            if user.totp_enabled:
                await self._verify_second_factor(user, user_in, request)

        await rate_limit.reset(user_in.email)
        if user.role == UserRole.SUPER_ADMIN:
            await audit_service.record_admin_action(
                self.session, audit_service.SUPERADMIN_LOGIN, actor=user, request=request
            )

        access_token = create_access_token(subject=user.id, role=user.role.value)
        refresh_token = create_refresh_token(subject=user.id, role=user.role.value)

        expires_at = datetime.now(timezone.utc) + timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )
        await self.user_repo.perform_login_housekeeping_and_save_token(
            user_id=user.id,
            token_hash=get_token_hash(refresh_token),
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

    async def _register_failed_login(
        self, email: str, user: Optional[User], request: Optional[Request], reason: str
    ) -> None:
        locked = await rate_limit.record_failure(email)
        if user is not None and user.role == UserRole.SUPER_ADMIN:
            await audit_service.record_admin_action(
                self.session,
                audit_service.SUPERADMIN_LOGIN_FAILED,
                target=user,
                details={"reason": reason, "locked": locked},
                request=request,
            )
        elif locked:
            await audit_service.record_admin_action(
                self.session, audit_service.LOGIN_LOCKED, target_email=email, request=request
            )

    async def _verify_second_factor(
        self, user: User, user_in: UserLogin, request: Optional[Request]
    ) -> None:
        """Check the authenticator code (or a one-time recovery code) for an MFA-enabled account."""
        code = (user_in.otp or "").strip()
        if not code:
            raise HTTPException(status_code=401, detail="MFA_REQUIRED")

        if totp.looks_like_recovery_code(code):
            hashes = list(user.totp_recovery_hashes or [])
            digest = totp.hash_recovery_code(code)
            if digest in hashes:
                hashes.remove(digest)
                user.totp_recovery_hashes = hashes
                self.session.add(user)
                await self.session.commit()
                await audit_service.record_admin_action(
                    self.session,
                    audit_service.MFA_RECOVERY_CODE_USED,
                    actor=user,
                    details={"remaining": len(hashes)},
                    request=request,
                )
                return
        else:
            secret = totp.decrypt_secret(user.totp_secret) if user.totp_secret else None
            step = totp.verify(secret, code, user.totp_last_step) if secret else None
            if step is not None:
                user.totp_last_step = step
                self.session.add(user)
                await self.session.commit()
                return

        await self._register_failed_login(user.email, user, request, reason="bad_otp")
        raise HTTPException(status_code=401, detail="Invalid authentication code.")

    async def exchange_clerk_token(self, user: User) -> Tuple[TokenResponse, str]:
        """Issues our own access/refresh token pair for a User already resolved
        and verified from a Clerk OAuth login (see deps.get_or_create_user_from_clerk).
        Mirrors the token-issuance tail of authenticate_user, minus the password
        check — this is the sole way a Clerk login turns into a first-party session."""
        access_token = create_access_token(subject=user.id, role=user.role.value)
        refresh_token = create_refresh_token(subject=user.id, role=user.role.value)

        expires_at = datetime.now(timezone.utc) + timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )
        await self.user_repo.perform_login_housekeeping_and_save_token(
            user_id=user.id,
            token_hash=get_token_hash(refresh_token),
            expires_at=expires_at,
        )

        token_response = TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=user,
            redirect_url=self.get_role_redirect(user.role),
            is_pending_approval=False,
            message="Login successful!",
        )

        return token_response, refresh_token

    async def logout_user(self, user_id: int | str) -> None:
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
                "exp": datetime.now(timezone.utc) + timedelta(hours=1),
            },
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )
        try:
            await email_service.send_password_reset_email(user.email, reset_token)
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
                user.must_change_password = False
                self.session.add(user)
                await self.session.commit()
                from app.cache import invalidate_user_cache
                await invalidate_user_cache(str(user.id), user.clerk_id)
                return True
        except jwt.PyJWTError:
            return False
        return False

    async def change_password(
        self, user_id: int | str, current_password: str, new_password: str
    ) -> Tuple[TokenResponse, str]:
        """Change a signed-in user's password and start a fresh session (all older sessions are revoked)."""
        user = await self.user_repo.get_by_id(user_id)
        if not user or not user.password_hash:
            raise HTTPException(status_code=400, detail="This account has no password to change.")

        await rate_limit.ensure_not_locked(user.email)
        loop = asyncio.get_event_loop()
        if not await loop.run_in_executor(None, verify_password, current_password, user.password_hash):
            await rate_limit.record_failure(user.email)
            raise HTTPException(status_code=400, detail="Current password is incorrect.")
        if new_password == current_password:
            raise HTTPException(status_code=400, detail="New password must be different from the current one.")

        user.password_hash = get_password_hash(new_password)
        user.must_change_password = False
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)

        from app.cache import invalidate_user_cache
        await invalidate_user_cache(str(user.id), user.clerk_id)

        access_token = create_access_token(subject=user.id, role=user.role.value)
        refresh_token = create_refresh_token(subject=user.id, role=user.role.value)
        await self.user_repo.perform_login_housekeeping_and_save_token(
            user_id=user.id,
            token_hash=get_token_hash(refresh_token),
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )
        return (
            TokenResponse(
                access_token=access_token,
                token_type="bearer",
                user=user,
                redirect_url=self.get_role_redirect(user.role),
                is_pending_approval=False,
                message="Password changed successfully.",
            ),
            refresh_token,
        )

    async def refresh_access_token(
        self, plain_refresh_token: str, request: Optional[Request] = None
    ) -> Tuple[TokenResponse, str]:
        """Validate an active refresh token, rotate it, and issue a fresh access token."""
        try:
            payload = jwt.decode(
                plain_refresh_token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM],
            )
        except jwt.PyJWTError as e:
            logger.warning(f"Invalid refresh token decode failure: {e}")
            raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

        token_type = payload.get("type")
        if token_type != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type for refresh")

        user_id_str = payload.get("sub")
        if not user_id_str:
            raise HTTPException(status_code=401, detail="Invalid refresh token payload")

        token_hash = get_token_hash(plain_refresh_token)
        token_record = await self.user_repo.get_valid_refresh_token(user_id_str, token_hash)
        if not token_record:
            logger.warning(f"Refresh token not found or already revoked for user {user_id_str}")
            raise HTTPException(status_code=401, detail="Refresh token has been revoked or expired")

        user = await self.user_repo.get_by_id(user_id_str)
        if not user or user.status != UserStatus.ACTIVE:
            raise HTTPException(status_code=401, detail="User is inactive or no longer exists")

        if user.role == UserRole.SUPER_ADMIN and not superadmin_app_allowed(request):
            raise HTTPException(status_code=401, detail="Refresh token has been revoked or expired")

        user_role = user.role
        user_id = user.id
        redirect_url = self.get_role_redirect(user_role)

        # Create new access token
        access_token = create_access_token(subject=user_id, role=user_role.value)

        # Rotate refresh token
        new_refresh_token = create_refresh_token(subject=user_id, role=user_role.value)
        new_expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        await self.user_repo.rotate_refresh_token(
            token_record=token_record,
            new_token_hash=get_token_hash(new_refresh_token),
            new_expires_at=new_expires_at,
        )
        await self.session.refresh(user)

        token_response = TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=user,
            redirect_url=redirect_url,
            is_pending_approval=False,
            message="Token refreshed successfully",
        )
        return token_response, new_refresh_token

