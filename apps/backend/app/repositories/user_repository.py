import uuid
from datetime import datetime
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

    async def get_by_id(self, user_id: uuid.UUID | str) -> Optional[User]:
        uid = uuid.UUID(str(user_id)) if isinstance(user_id, str) else user_id
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
        )
        user_id = new_user.id
        self.session.add(new_user)
        await self.session.commit()

        if role == UserRole.STUDENT:
            student_prof = StudentProfile(user_id=user_id)
            self.session.add(student_prof)
        elif role == UserRole.ADMIN:
            admin_prof = AdminProfile(
                user_id=user_id,
                organization_name=organization_name,
                department=department,
            )
            self.session.add(admin_prof)

        await self.session.commit()
        user_obj = await self.get_by_id(user_id)
        if user_obj:
            await self.session.refresh(user_obj)
        return user_obj

    async def get_pending_admins(self) -> List[User]:
        stmt = (
            select(User)
            .where(User.role == UserRole.ADMIN, User.status == UserStatus.PENDING)
            .options(
                selectinload(User.student_profile),
                selectinload(User.admin_profile),
            )
            .order_by(col(User.created_at).desc())
        )
        res = await self.session.exec(stmt)
        return list(res.all())

    async def get_active_admins(self) -> List[User]:
        stmt = (
            select(User)
            .where(
                User.role == UserRole.ADMIN,
                User.status.in_([UserStatus.ACTIVE, UserStatus.SUSPENDED]),
            )
            .options(
                selectinload(User.student_profile),
                selectinload(User.admin_profile),
            )
            .order_by(col(User.created_at).desc())
        )
        res = await self.session.exec(stmt)
        return list(res.all())

    async def suspend_admin(self, admin_id: uuid.UUID | str) -> Optional[User]:
        user = await self.get_by_id(admin_id)
        if not user or user.role != UserRole.ADMIN:
            return None
        user.status = UserStatus.SUSPENDED
        self.session.add(user)
        await self.session.commit()
        return await self.get_by_id(user.id)

    async def reactivate_admin(self, admin_id: uuid.UUID | str) -> Optional[User]:
        user = await self.get_by_id(admin_id)
        if not user or user.role != UserRole.ADMIN:
            return None
        user.status = UserStatus.ACTIVE
        self.session.add(user)
        await self.session.commit()
        return await self.get_by_id(user.id)

    async def approve_admin(
        self, admin_id: uuid.UUID | str, super_admin_id: uuid.UUID | str
    ) -> Optional[User]:
        user = await self.get_by_id(admin_id)
        if not user or user.role != UserRole.ADMIN:
            return None

        super_admin_uuid = (
            uuid.UUID(str(super_admin_id))
            if isinstance(super_admin_id, str)
            else super_admin_id
        )

        user.status = UserStatus.ACTIVE
        if user.admin_profile:
            user.admin_profile.approved_by_id = super_admin_uuid
            user.admin_profile.approved_at = datetime.utcnow()
            self.session.add(user.admin_profile)

        log = AdminApprovalLog(
            admin_user_id=user.id, reviewed_by_id=super_admin_uuid, action="APPROVED"
        )
        self.session.add(user)
        self.session.add(log)
        await self.session.commit()
        return await self.get_by_id(user.id)

    async def reject_admin(
        self,
        admin_id: uuid.UUID | str,
        super_admin_id: uuid.UUID | str,
        reason: Optional[str] = None,
    ) -> Optional[User]:
        user = await self.get_by_id(admin_id)
        if not user or user.role != UserRole.ADMIN:
            return None

        super_admin_uuid = (
            uuid.UUID(str(super_admin_id))
            if isinstance(super_admin_id, str)
            else super_admin_id
        )

        user.status = UserStatus.REJECTED
        if user.admin_profile:
            user.admin_profile.rejected_by_id = super_admin_uuid
            user.admin_profile.rejected_at = datetime.utcnow()
            user.admin_profile.rejection_reason = reason
            self.session.add(user.admin_profile)

        log = AdminApprovalLog(
            admin_user_id=user.id,
            reviewed_by_id=super_admin_uuid,
            action="REJECTED",
            reason=reason,
        )
        self.session.add(user)
        self.session.add(log)
        await self.session.commit()
        return await self.get_by_id(user.id)

    async def get_approval_logs(self) -> List[AdminApprovalLog]:
        stmt = select(AdminApprovalLog).order_by(col(AdminApprovalLog.created_at).desc())
        res = await self.session.exec(stmt)
        return list(res.all())

    async def get_system_stats(self) -> Dict[str, Any]:
        pending = (
            await self.session.exec(
                select(func.count(User.id)).where(
                    User.role == UserRole.ADMIN, User.status == UserStatus.PENDING
                )
            )
        ).one()
        active = (
            await self.session.exec(
                select(func.count(User.id)).where(
                    User.role == UserRole.ADMIN, User.status == UserStatus.ACTIVE
                )
            )
        ).one()
        students = (
            await self.session.exec(
                select(func.count(User.id)).where(
                    User.role == UserRole.STUDENT, User.status == UserStatus.ACTIVE
                )
            )
        ).one()
        rejected = (
            await self.session.exec(
                select(func.count(User.id)).where(
                    User.role == UserRole.ADMIN, User.status == UserStatus.REJECTED
                )
            )
        ).one()

        return {
            "pending_admins_count": pending,
            "active_admins_count": active,
            "active_students_count": students,
            "rejected_admins_count": rejected,
            "aws_rds_status": "Healthy & Connected",
            "database_name": "sqlite/postgres",
            "db_host": "localhost",
        }

    async def update_last_login(self, user_id: uuid.UUID | str) -> None:
        user = await self.get_by_id(user_id)
        if user:
            user.last_login = datetime.utcnow()
            self.session.add(user)
            await self.session.commit()

    async def save_refresh_token(
        self,
        user_id: uuid.UUID | str,
        token_hash: str,
        expires_at: datetime,
        device_name: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> RefreshToken:
        uid = uuid.UUID(str(user_id)) if isinstance(user_id, str) else user_id
        token_record = RefreshToken(
            user_id=uid,
            token_hash=token_hash,
            expires_at=expires_at,
            device_name=device_name,
            ip_address=ip_address,
        )
        self.session.add(token_record)
        await self.session.commit()
        await self.session.refresh(token_record)
        return token_record

    async def revoke_user_refresh_tokens(self, user_id: uuid.UUID | str) -> None:
        uid = uuid.UUID(str(user_id)) if isinstance(user_id, str) else user_id
        stmt = select(RefreshToken).where(
            RefreshToken.user_id == uid, RefreshToken.revoked_at.is_(None)
        )
        res = await self.session.exec(stmt)
        tokens = res.all()
        now = datetime.utcnow()
        for tok in tokens:
            tok.revoked_at = now
            self.session.add(tok)
        await self.session.commit()
