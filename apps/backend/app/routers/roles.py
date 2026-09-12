from typing import List
from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.session import get_async_session
from app.db.models.user import User, UserRole
from app.core.deps import require_roles
from app.schemas.roles import (
    PermissionOut,
    RoleOut,
    RoleCreatePayload,
    RoleUpdatePayload,
    UserRoleAssignmentPayload,
)
from app.schemas.auth import UserOut
from app.services.role_service import RoleService

router = APIRouter(prefix="/admin", tags=["Roles & Permissions"])

super_admin_only = require_roles([UserRole.SUPER_ADMIN])


@router.get("/permissions", response_model=List[PermissionOut])
async def list_permissions(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(super_admin_only),
):
    return await RoleService(session).list_permissions()


@router.get("/roles", response_model=List[RoleOut])
async def list_roles(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(super_admin_only),
):
    return await RoleService(session).list_roles()


@router.post("/roles", response_model=RoleOut)
async def create_role(
    payload: RoleCreatePayload,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(super_admin_only),
):
    return await RoleService(session).create_role(
        name=payload.name,
        base_role_type=payload.base_role_type,
        description=payload.description,
        permission_keys=payload.permission_keys,
        created_by_id=current_user.id,
    )


@router.put("/roles/{role_id}", response_model=RoleOut)
async def update_role(
    role_id: int,
    payload: RoleUpdatePayload,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(super_admin_only),
):
    return await RoleService(session).update_role(
        role_id=role_id,
        name=payload.name,
        description=payload.description,
        permission_keys=payload.permission_keys,
    )


@router.delete("/roles/{role_id}")
async def delete_role(
    role_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(super_admin_only),
):
    await RoleService(session).delete_role(role_id)
    return {"message": "Role deleted."}


@router.put("/users/{user_id}/role-assignment", response_model=UserOut)
async def update_user_role_assignment(
    user_id: int,
    payload: UserRoleAssignmentPayload,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(super_admin_only),
):
    from app.cache import invalidate_user_cache

    user = await RoleService(session).assign_role_to_user(
        user_id=user_id, role_id=payload.role_id, changed_by_admin_id=current_user.id
    )
    await invalidate_user_cache(str(user_id), user.clerk_id)
    return user
