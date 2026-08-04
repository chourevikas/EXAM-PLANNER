from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_session
from app.db.models.user import User, UserRole
from app.schemas.auth import (
    AdminApprovalRequestOut,
    AdminActionPayload,
    UserOut,
    AdminApprovalLogOut,
    SystemStatsOut,
)
from app.services.admin_service import AdminService
from app.core.deps import require_roles

router = APIRouter(prefix="/admin", tags=["Admin Management"])


@router.get("/pending-requests", response_model=List[AdminApprovalRequestOut])
async def list_pending_admin_requests(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    service = AdminService(session)
    return await service.list_pending_admin_requests()


@router.get("/active-admins", response_model=List[AdminApprovalRequestOut])
async def list_active_admins(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    service = AdminService(session)
    return await service.list_active_admins()


@router.post("/approve/{user_id}", response_model=UserOut)
async def approve_admin_request(
    user_id: str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    service = AdminService(session)
    return await service.approve_admin_request(
        user_id=user_id, current_super_admin=current_user
    )


@router.post("/reject/{user_id}", response_model=UserOut)
async def reject_admin_request(
    user_id: str,
    payload: AdminActionPayload = AdminActionPayload(),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    service = AdminService(session)
    return await service.reject_admin_request(
        user_id=user_id, payload=payload, current_super_admin=current_user
    )


@router.post("/suspend/{user_id}", response_model=UserOut)
async def suspend_admin_user(
    user_id: str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    service = AdminService(session)
    return await service.suspend_admin_user(user_id=user_id)


@router.post("/reactivate/{user_id}", response_model=UserOut)
async def reactivate_admin_user(
    user_id: str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    service = AdminService(session)
    return await service.reactivate_admin_user(user_id=user_id)


@router.get("/audit-logs", response_model=List[AdminApprovalLogOut])
async def get_approval_audit_logs(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    service = AdminService(session)
    return await service.get_approval_audit_logs()


@router.get("/system-stats", response_model=SystemStatsOut)
async def get_system_diagnostics(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    service = AdminService(session)
    return await service.get_system_diagnostics()
