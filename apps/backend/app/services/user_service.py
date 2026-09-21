import secrets
from typing import List, Optional
from fastapi import Request
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from fastapi import status

from app.db.models.user import User, UserRole, UserStatus
from app.schemas.user import StaffCreate, UserUpdate
from app.repositories.user_repository import UserRepository
from app.core.security import get_password_hash
from app.core.exceptions import UserAlreadyExistsException, BaseAppException


# Roles a Super Admin may create; SUPER_ADMIN accounts are never created through the API.
STAFF_CREATABLE_ROLES = (UserRole.ADMIN, UserRole.TEACHER)

# No look-alike characters (0/O, 1/l/I) so the emailed password is easy to type.
_TEMP_PASSWORD_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generate_temporary_password(length: int = 12) -> str:
    return "".join(secrets.choice(_TEMP_PASSWORD_ALPHABET) for _ in range(length))


PROFILE_EXTRA_FIELDS = ("target_exam", "target_year", "optional_subject", "weekly_hours", "subject_proficiency")


async def get_profile_extras(session: AsyncSession, user_ids: List[int]) -> dict:
    """Student-profile data the raw user row lacks: subscription tier + exam-preparation details.

    Returns {user_id: {...}}; users without a student profile are simply absent.
    """
    if not user_ids:
        return {}
    from app.db.models.user import StudentProfile

    rows = (await session.exec(select(StudentProfile).where(StudentProfile.user_id.in_(user_ids)))).all()
    out = {}
    for prof in rows:
        tier = prof.subscription_tier
        out[prof.user_id] = {
            "subscription_tier": tier.value if hasattr(tier, "value") else str(tier),
            "onboarding_completed": prof.onboarding_completed_at is not None,
            **{f: getattr(prof, f) for f in PROFILE_EXTRA_FIELDS},
        }
    return out


async def get_subscription_tier(session: AsyncSession, user_id: int) -> str:
    """Current plan straight from the DB.

    The auth-cached User has no student_profile loaded, so its
    `subscription_tier` property always reads FREE on a cache hit.
    """
    from app.db.models.user import StudentProfile

    prof = (
        await session.exec(select(StudentProfile).where(StudentProfile.user_id == user_id))
    ).first()
    if not prof:
        return "FREE"
    tier = prof.subscription_tier
    return tier.value if hasattr(tier, "value") else str(tier)


async def get_subscription_info(session: AsyncSession, user_id: int) -> dict:
    """Remaining time on the user's active paid subscription (display only)."""
    from datetime import datetime, timezone
    from app.db.models.subscription import UserSubscription, SubscriptionStatus

    sub = (
        await session.exec(
            select(UserSubscription)
            .where(
                UserSubscription.user_id == user_id,
                UserSubscription.status == SubscriptionStatus.ACTIVE,
            )
            .order_by(UserSubscription.current_period_end.desc())
        )
    ).first()
    if not sub:
        return {"subscription_ends_at": None, "subscription_days_remaining": None}
    end = sub.current_period_end
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    seconds = (end - datetime.now(timezone.utc)).total_seconds()
    days = max(0, -(-int(seconds) // 86400)) if seconds > 0 else 0
    return {"subscription_ends_at": end.isoformat(), "subscription_days_remaining": days}


class UserService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepository(session)

    async def get_user_by_id(self, user_id: int | str) -> Optional[User]:
        from app.cache import get_cache, build_cache_key
        cache = get_cache()
        cache_key = build_cache_key("users:detail", str(user_id))
        cached_data = await cache.get(cache_key)
        if cached_data is not None:
            return User(**cached_data)

        user = await self.user_repo.get_by_id(user_id)
        if user is not None:
            user_dict = user.dict() if hasattr(user, "dict") else user.model_dump(mode="json")
            await cache.set(cache_key, user_dict, ttl_seconds=1800)
        return user

    async def list_users(self, current_user: Optional[User] = None, skip: int = 0, limit: int = 100) -> List[User]:
        from app.cache import get_cache, build_cache_key
        cache = get_cache()
        cache_key = build_cache_key(
            "users:list",
            role=str(current_user.role.value if hasattr(current_user.role, "value") else current_user.role) if current_user else "anon",
            skip=skip,
            limit=limit,
        )
        cached_data = await cache.get(cache_key)
        if cached_data is not None:
            return [User(**u) for u in cached_data]

        stmt = select(User)

        # Super Admin accounts are hidden at all cost from backend user listing
        stmt = stmt.where(User.role != UserRole.SUPER_ADMIN)

        # One admin should not see other admins; an admin ONLY sees student accounts
        if current_user and current_user.role == UserRole.ADMIN:
            stmt = stmt.where(User.role == UserRole.STUDENT)

        stmt = stmt.offset(skip).limit(limit)
        res = await self.session.exec(stmt)
        users = list(res.all())
        if users:
            serialized = [u.dict() if hasattr(u, "dict") else u.model_dump(mode="json") for u in users]
            await cache.set(cache_key, serialized, ttl_seconds=600)
        return users

    async def create_staff_user(self, payload: StaffCreate, created_by: User) -> tuple[User, bool]:
        """Create an ADMIN/TEACHER (or sub-admin) account with an emailed temporary password.

        Returns (user, email_sent). The plaintext password only exists here and in the email.
        """
        if payload.role not in STAFF_CREATABLE_ROLES:
            raise BaseAppException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Admin and Teacher accounts can be created here",
            )

        custom_role = None
        if payload.custom_role_id is not None:
            from app.services.role_service import RoleService

            custom_role = await RoleService(self.session).get_role(payload.custom_role_id)
            if custom_role.base_role_type != payload.role:
                raise BaseAppException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Custom role '{custom_role.name}' is a {custom_role.base_role_type.value} role, not {payload.role.value}",
                )

        if await self.user_repo.get_by_email(payload.email):
            raise UserAlreadyExistsException(payload.email)

        temp_password = generate_temporary_password()
        user = await self.user_repo.create_user(
            email=payload.email,
            full_name=payload.full_name,
            password_hash=get_password_hash(temp_password),
            role=payload.role,
            preferred_language=payload.preferred_language or "en",
            status=UserStatus.ACTIVE,
            is_verified=True,
            must_change_password=True,
        )
        if custom_role is not None:
            from app.services.role_service import RoleService

            user = await RoleService(self.session).assign_role_to_user(
                user_id=user.id, role_id=custom_role.id, changed_by_admin_id=created_by.id
            )

        email_sent = await self._email_temporary_password(user, temp_password)
        from app.cache import get_cache
        cache = get_cache()
        await cache.delete_pattern("ep:users:list*")
        await cache.delete_pattern("users:list*")
        # Super Admin directory, stats and active-admin lists are cached under ep:admin:*.
        await cache.delete_pattern("ep:admin:*")
        return user, email_sent

    async def reset_staff_credentials(self, user_id: int | str) -> tuple[User, bool]:
        """Issue a new temporary password to an existing staff account and email it."""
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise BaseAppException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        if user.role not in STAFF_CREATABLE_ROLES:
            raise BaseAppException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Credentials can only be reissued for Admin and Teacher accounts",
            )

        temp_password = generate_temporary_password()
        user.password_hash = get_password_hash(temp_password)
        user.must_change_password = True
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        # Sessions opened with the old password must not survive the reissue.
        await self.user_repo.revoke_user_refresh_tokens(user.id)

        from app.cache import invalidate_user_cache
        await invalidate_user_cache(str(user.id), user.clerk_id)
        return user, await self._email_temporary_password(user, temp_password)

    async def _email_temporary_password(self, user: User, temp_password: str) -> bool:
        from app.services.email_service import email_service

        role_label = "Teacher" if user.role == UserRole.TEACHER else "Admin"
        try:
            return bool(
                await email_service.send_staff_welcome_email(
                    user.email, user.full_name, role_label, temp_password
                )
            )
        except Exception:
            return False

    async def update_user(
        self, user_id: int | str, user_in: UserUpdate, current_user: Optional[User] = None, request: Optional[Request] = None
    ) -> User:
        # Must be a live, session-attached row: the cached copy returned by get_user_by_id is a
        # detached User(**dict) with string timestamps, and session.add() on it emits an INSERT.
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise BaseAppException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        # Super Admin accounts cannot be altered via standard user API
        if user.role == UserRole.SUPER_ADMIN:
            raise BaseAppException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Super Admin account cannot be modified"
            )

        # Admin users can ONLY update STUDENT accounts
        if current_user and current_user.role == UserRole.ADMIN and user.role != UserRole.STUDENT:
            raise BaseAppException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Admins can only manage student accounts"
            )

        update_data = user_in.model_dump(exclude_unset=True)
        tier = update_data.pop("subscription_tier", None)

        old_role = user.role
        # Role changes are Super Admin only, and SUPER_ADMIN itself is never grantable here.
        new_role = update_data.get("role")
        if new_role is not None and new_role != user.role:
            if not current_user or current_user.role != UserRole.SUPER_ADMIN:
                raise BaseAppException(
                    status_code=status.HTTP_403_FORBIDDEN, detail="Only a Super Admin can change user roles"
                )
            if new_role == UserRole.SUPER_ADMIN:
                raise BaseAppException(
                    status_code=status.HTTP_403_FORBIDDEN, detail="Super Admin role cannot be assigned"
                )
            # Custom-role permissions belong to the previous role (same as AdminRepository.update_user_role).
            update_data["custom_role_id"] = None

        if "email" in update_data and update_data["email"] != user.email:
            new_email = update_data["email"]
            collision = (
                await self.session.exec(
                    select(User).where(User.email == new_email, User.id != user.id)
                )
            ).first()
            if collision:
                raise BaseAppException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Email '{new_email}' is already in use by another account.",
                )

        for field, value in update_data.items():
            if hasattr(user, field):
                setattr(user, field, value)

        if tier and user.role == UserRole.STUDENT:
            from app.db.models.user import StudentProfile
            prof = (
                await self.session.exec(
                    select(StudentProfile).where(StudentProfile.user_id == user.id)
                )
            ).first()
            if prof:
                prof.subscription_tier = tier
                self.session.add(prof)
            else:
                new_prof = StudentProfile(user_id=user.id, subscription_tier=tier)
                self.session.add(new_prof)

        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)

        if user.role != old_role:
            from app.services import audit_service

            await audit_service.record_admin_action(
                self.session,
                audit_service.ROLE_CHANGED,
                actor=current_user,
                target=user,
                details={"from": old_role.value, "to": user.role.value},
                request=request,
            )

        from app.cache import invalidate_user_cache, get_cache
        await invalidate_user_cache(str(user_id))
        cache = get_cache()
        await cache.delete_pattern("ep:users:list*")
        await cache.delete_pattern("users:list*")
        await cache.delete_pattern("ep:admin:*")
        return user

    async def delete_user(
        self, user_id: int | str, actor: Optional[User] = None, request: Optional[Request] = None
    ) -> None:
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise BaseAppException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        target_id, target_email, target_role = user.id, user.email, user.role.value
        await self.session.delete(user)
        await self.session.commit()

        from app.services import audit_service

        await audit_service.record_admin_action(
            self.session,
            audit_service.USER_DELETED,
            actor=actor,
            target_id=None,  # the row is gone; keep the address in the log instead
            target_email=target_email,
            details={"user_id": target_id, "role": target_role},
            request=request,
        )

        from app.cache import invalidate_user_cache
        await invalidate_user_cache(str(user_id))
