from typing import List
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
    AdminApprovalRequestOut,
    AdminActionPayload,
    UserOut,
    AdminApprovalLogOut,
    SystemStatsOut,
)


class AdminService:
    """Service encapsulating admin management operations, approvals, and audit logging."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = UserRepository(session)

    async def list_pending_admin_requests(self) -> List[AdminApprovalRequestOut]:
        pending_users = await self.repo.get_pending_admins()
        result = []
        for u in pending_users:
            org_name = u.admin_profile.organization_name if u.admin_profile else None
            dept = u.admin_profile.department if u.admin_profile else None
            result.append(
                AdminApprovalRequestOut(
                    id=str(u.id),
                    full_name=u.full_name,
                    email=u.email,
                    role=u.role,
                    status=u.status,
                    organization_name=org_name,
                    department=dept,
                    created_at=u.created_at,
                )
            )
        return result

    async def list_active_admins(self) -> List[AdminApprovalRequestOut]:
        active_users = await self.repo.get_active_admins()
        result = []
        for u in active_users:
            org_name = u.admin_profile.organization_name if u.admin_profile else None
            dept = u.admin_profile.department if u.admin_profile else None
            result.append(
                AdminApprovalRequestOut(
                    id=str(u.id),
                    full_name=u.full_name,
                    email=u.email,
                    role=u.role,
                    status=u.status,
                    organization_name=org_name,
                    department=dept,
                    created_at=u.created_at,
                )
            )
        return result

    async def approve_admin_request(
        self, user_id: str, current_super_admin: User
    ) -> UserOut:
        approved_user = await self.repo.approve_admin(
            admin_id=user_id, super_admin_id=current_super_admin.id
        )
        if not approved_user:
            raise HTTPException(status_code=404, detail="Pending admin user not found.")
        return approved_user

    async def reject_admin_request(
        self, user_id: str, payload: AdminActionPayload, current_super_admin: User
    ) -> UserOut:
        rejected_user = await self.repo.reject_admin(
            admin_id=user_id,
            super_admin_id=current_super_admin.id,
            reason=payload.reason,
        )
        if not rejected_user:
            raise HTTPException(status_code=404, detail="Pending admin user not found.")
        return rejected_user

    async def suspend_admin_user(self, user_id: str) -> UserOut:
        user = await self.repo.suspend_admin(admin_id=user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Admin user not found.")
        return user

    async def reactivate_admin_user(self, user_id: str) -> UserOut:
        user = await self.repo.reactivate_admin(admin_id=user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Admin user not found.")
        return user

    async def get_approval_audit_logs(self) -> List[AdminApprovalLogOut]:
        logs = await self.repo.get_approval_logs()
        result = []
        for log in logs:
            admin_user = await self.repo.get_by_id(log.admin_user_id)
            reviewer_user = (
                await self.repo.get_by_id(log.reviewed_by_id)
                if log.reviewed_by_id
                else None
            )
            result.append(
                AdminApprovalLogOut(
                    id=str(log.id),
                    admin_user_name=admin_user.full_name
                    if admin_user
                    else "Unknown User",
                    admin_user_email=admin_user.email if admin_user else "N/A",
                    action=log.action,
                    reviewed_by_name=reviewer_user.full_name
                    if reviewer_user
                    else "System SuperAdmin",
                    reason=log.reason,
                    created_at=log.created_at,
                )
            )
        return result

    async def get_system_diagnostics(self) -> SystemStatsOut:
        return await self.repo.get_system_stats()
