from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlmodel import select, func, col
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.user import (
    User,
    UserRole,
    UserStatus,
    StudentProfile,
    AdminProfile,
    AdminApprovalLog,
    RefreshToken,
)


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_email(self, email: str) -> Optional[User]:
        stmt = (
            select(User)
            .where(User.email == email.lower())
            .options(
                selectinload(User.student_profile),
                selectinload(User.admin_profile),
            )
        )
        res = await self.session.exec(stmt)
        return res.first()

    async def get_by_email_for_auth(self, email: str) -> Optional[User]:
        """Lean login-path lookup: fetches only the User row, no eager relationship loading.
        Saves 2 extra SELECT round-trips to RDS (student_profile + admin_profile)."""
        stmt = select(User).where(User.email == email.lower())
        res = await self.session.exec(stmt)
        return res.first()

    async def get_by_id(self, user_id: int | str) -> Optional[User]:
        try:
            uid = int(user_id)
        except (ValueError, TypeError):
            return None
        stmt = (
            select(User)
            .where(User.id == uid)
            .options(
                selectinload(User.student_profile),
                selectinload(User.admin_profile),
            )
        )
        res = await self.session.exec(stmt)
        return res.first()

    async def create_user(
        self,
        email: str,
        full_name: str,
        password_hash: str,
        role: UserRole = UserRole.STUDENT,
        organization_name: Optional[str] = None,
        department: Optional[str] = None,
    ) -> User:
        status = UserStatus.PENDING if role == UserRole.ADMIN else UserStatus.ACTIVE

        new_user = User(
            email=email.lower(),
            full_name=full_name,
            password_hash=password_hash,
            role=role,
            status=status,
            is_active=True,
            is_verified=False,
            email_verified=False,
        )
        self.session.add(new_user)
        await self.session.commit()
        await self.session.refresh(new_user)
        new_uid = new_user.id

        if role == UserRole.STUDENT:
            profile = StudentProfile(user_id=new_uid)
            self.session.add(profile)
            await self.session.commit()
        elif role == UserRole.ADMIN:
            admin_profile = AdminProfile(
                user_id=new_uid,
                organization_name=organization_name,
                department=department,
            )
            self.session.add(admin_profile)
            await self.session.commit()

        return await self.get_by_id(new_uid)

    async def get_user_count(self) -> int:
        res = await self.session.exec(select(func.count(User.id)))
        return res.one()

    async def get_pending_admins(self) -> List[User]:
        stmt = (
            select(User)
            .where(User.role == UserRole.ADMIN, User.status == UserStatus.PENDING)
            .options(selectinload(User.admin_profile))
            .order_by(col(User.created_at).desc())
        )
        res = await self.session.exec(stmt)
        return list(res.all())

    async def get_active_admins(self) -> List[User]:
        stmt = (
            select(User)
            .where(User.role == UserRole.ADMIN, User.status == UserStatus.ACTIVE)
            .options(selectinload(User.admin_profile))
            .order_by(col(User.created_at).desc())
        )
        res = await self.session.exec(stmt)
        return list(res.all())

    async def get_all_users(self) -> List[User]:
        return await self.get_all_users_for_superadmin(limit=1000)

    async def get_all_users_for_superadmin(
        self,
        role: Optional[UserRole] = None,
        status: Optional[UserStatus] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[User]:
        stmt = select(User)
        if role:
            stmt = stmt.where(User.role == role)
        if status:
            stmt = stmt.where(User.status == status)
        if search:
            search_filter = f"%{search.lower()}%"
            stmt = stmt.where(
                (func.lower(User.email).like(search_filter))
                | (func.lower(User.full_name).like(search_filter))
            )

        stmt = (
            stmt.limit(limit)
            .offset(offset)
            .options(
                selectinload(User.student_profile),
                selectinload(User.admin_profile),
                selectinload(User.skill_profile),
            )
            .order_by(col(User.created_at).desc())
        )
        res = await self.session.exec(stmt)
        return list(res.all())

    async def update_user_role(self, user_id: int | str, new_role: UserRole) -> Optional[User]:
        user = await self.get_by_id(user_id)
        if not user:
            return None
        user.role = new_role
        user.custom_role_id = None
        if new_role == UserRole.ADMIN and user.status == UserStatus.PENDING:
            user.status = UserStatus.ACTIVE
        self.session.add(user)
        await self.session.commit()
        return await self.get_by_id(user.id)

    async def suspend_admin(self, admin_id: int | str) -> Optional[User]:
        user = await self.get_by_id(admin_id)
        if not user or user.role == UserRole.SUPER_ADMIN:
            return None
        now = datetime.now(timezone.utc)
        user.status = UserStatus.SUSPENDED
        user.suspended_at = now
        user.updated_at = now
        self.session.add(user)
        await self.session.commit()
        return await self.get_by_id(user.id)

    async def reactivate_admin(self, admin_id: int | str) -> Optional[User]:
        user = await self.get_by_id(admin_id)
        if not user:
            return None
        if user.cooling_period_expired:
            raise ValueError("Cooling period (7 days) has expired for this suspended account. It can no longer be reactivated.")
        user.status = UserStatus.ACTIVE
        user.suspended_at = None
        user.updated_at = datetime.now(timezone.utc)
        self.session.add(user)
        await self.session.commit()
        return await self.get_by_id(user.id)

    async def approve_admin(
        self, admin_id: int | str, super_admin_id: int | str
    ) -> Optional[User]:
        user = await self.get_by_id(admin_id)
        if not user:
            return None

        try:
            super_admin_id_int = int(super_admin_id)
        except (ValueError, TypeError):
            super_admin_id_int = None

        user.status = UserStatus.ACTIVE
        if user.admin_profile:
            user.admin_profile.approved_by_id = super_admin_id_int
            user.admin_profile.approved_at = datetime.now(timezone.utc)
            self.session.add(user.admin_profile)

        log = AdminApprovalLog(
            admin_user_id=user.id, reviewed_by_id=super_admin_id_int, action="APPROVED"
        )
        self.session.add(user)
        self.session.add(log)
        await self.session.commit()
        return await self.get_by_id(user.id)

    async def reject_admin(
        self,
        admin_id: int | str,
        super_admin_id: int | str,
        reason: Optional[str] = None,
    ) -> Optional[User]:
        user = await self.get_by_id(admin_id)
        if not user:
            return None

        try:
            super_admin_id_int = int(super_admin_id)
        except (ValueError, TypeError):
            super_admin_id_int = None

        user.status = UserStatus.REJECTED
        if user.admin_profile:
            user.admin_profile.rejected_by_id = super_admin_id_int
            user.admin_profile.rejected_at = datetime.now(timezone.utc)
            user.admin_profile.rejection_reason = reason
            self.session.add(user.admin_profile)

        log = AdminApprovalLog(
            admin_user_id=user.id,
            reviewed_by_id=super_admin_id_int,
            action="REJECTED",
            rejection_reason=reason,
        )
        self.session.add(user)
        self.session.add(log)
        await self.session.commit()
        return await self.get_by_id(user.id)

    async def get_approval_logs(self, limit: int = 50) -> List[AdminApprovalLog]:
        stmt = (
            select(AdminApprovalLog)
            .order_by(col(AdminApprovalLog.created_at).desc())
            .limit(limit)
        )
        res = await self.session.exec(stmt)
        return list(res.all())

    async def get_system_stats(self) -> Dict[str, Any]:
        total_users = (await self.session.exec(select(func.count(User.id)))).one()
        active_users = (
            await self.session.exec(
                select(func.count(User.id)).where(User.status == UserStatus.ACTIVE)
            )
        ).one()
        suspended_users = (
            await self.session.exec(
                select(func.count(User.id)).where(User.status == UserStatus.SUSPENDED)
            )
        ).one()
        pending_admins = (
            await self.session.exec(
                select(func.count(User.id)).where(
                    User.role == UserRole.ADMIN, User.status == UserStatus.PENDING
                )
            )
        ).one()

        return {
            "total_users": total_users,
            "active_users": active_users,
            "suspended_users": suspended_users,
            "pending_admins": pending_admins,
            "db_status": "ONLINE",
            "db_host": "localhost",
        }

    async def update_last_login(self, user_id: int | str) -> None:
        from sqlalchemy import update as sa_update
        uid = int(user_id)
        await self.session.exec(
            sa_update(User)
            .where(User.id == uid)
            .values(last_login=datetime.now(timezone.utc))
        )
        await self.session.commit()

    async def perform_login_housekeeping_and_save_token(
        self,
        user_id: int | str,
        token_hash: str,
        expires_at: datetime,
        device_name: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> None:
        from sqlalchemy import update as sa_update
        uid = int(user_id)
        now = datetime.now(timezone.utc)
        
        # Fire both UPDATEs without intermediate commits
        await self.session.exec(
            sa_update(RefreshToken)
            .where(RefreshToken.user_id == uid)
            .where(RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        await self.session.exec(
            sa_update(User)
            .where(User.id == uid)
            .values(last_login=now)
        )
        
        # Insert new token
        token_record = RefreshToken(
            user_id=uid,
            token_hash=token_hash,
            expires_at=expires_at,
            device_name=device_name,
            ip_address=ip_address,
        )
        self.session.add(token_record)
        await self.session.commit()

    async def cleanup_old_refresh_tokens(self, user_id: int | str) -> None:
        """Revoke all existing tokens for user before issuing a new one.
        Keeps the refresh_tokens table from growing unboundedly and avoids
        slow queries caused by thousands of stale rows per user."""
        from sqlalchemy import update as sa_update
        uid = int(user_id)
        await self.session.exec(
            sa_update(RefreshToken)
            .where(RefreshToken.user_id == uid)
            .where(RefreshToken.revoked_at.is_(None))
            .values(revoked_at=datetime.now(timezone.utc))
        )
        await self.session.commit()

    async def revoke_user_refresh_tokens(self, user_id: int | str) -> None:
        from sqlalchemy import update as sa_update
        uid = int(user_id)
        await self.session.exec(
            sa_update(RefreshToken)
            .where(RefreshToken.user_id == uid)
            .where(RefreshToken.revoked_at.is_(None))
            .values(revoked_at=datetime.now(timezone.utc))
        )
        await self.session.commit()
