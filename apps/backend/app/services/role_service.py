from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models.user import User, UserRole
from app.db.models.roles import Permission, Role, RolePermission, RoleAssignmentLog


def _slugify(name: str) -> str:
    return "-".join(name.strip().lower().split())


class RoleService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_permissions(self) -> List[Permission]:
        result = await self.session.exec(select(Permission).order_by(col(Permission.key)))
        return list(result.all())

    async def list_roles(self) -> List[dict]:
        result = await self.session.exec(select(Role).order_by(col(Role.name)))
        roles = result.all()
        return [await self._to_dict(role) for role in roles]

    async def get_role(self, role_id: int) -> Role:
        role = await self.session.get(Role, role_id)
        if not role:
            raise HTTPException(status_code=404, detail="Role not found.")
        return role

    async def _to_dict(self, role: Role) -> dict:
        links_res = await self.session.exec(
            select(Permission.key)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .where(RolePermission.role_id == role.id)
        )
        permission_keys = list(links_res.all())
        return {
            "id": role.id,
            "name": role.name,
            "slug": role.slug,
            "base_role_type": role.base_role_type,
            "is_system": role.is_system,
            "description": role.description,
            "permission_keys": permission_keys,
            "created_at": role.created_at,
            "updated_at": role.updated_at,
        }

    async def create_role(
        self,
        name: str,
        base_role_type: UserRole,
        description: Optional[str],
        permission_keys: List[str],
        created_by_id: Optional[int],
    ) -> dict:
        slug = _slugify(name)
        existing = await self.session.exec(
            select(Role).where((Role.name == name) | (Role.slug == slug))
        )
        if existing.first():
            raise HTTPException(status_code=409, detail="A role with this name already exists.")

        role = Role(
            name=name,
            slug=slug,
            base_role_type=base_role_type,
            is_system=False,
            description=description,
            created_by_id=created_by_id,
        )
        self.session.add(role)
        await self.session.flush()
        await self._set_permissions(role.id, permission_keys)
        await self.session.commit()
        await self.session.refresh(role)
        return await self._to_dict(role)

    async def update_role(
        self,
        role_id: int,
        name: Optional[str],
        description: Optional[str],
        permission_keys: Optional[List[str]],
    ) -> dict:
        role = await self.get_role(role_id)
        if role.is_system:
            raise HTTPException(
                status_code=400, detail="System roles cannot be renamed or have their base access changed."
            )
        if name:
            role.name = name
            role.slug = _slugify(name)
        if description is not None:
            role.description = description
        role.updated_at = datetime.now(timezone.utc)
        self.session.add(role)

        if permission_keys is not None:
            await self._set_permissions(role_id, permission_keys)

        await self.session.commit()
        await self.session.refresh(role)
        return await self._to_dict(role)

    async def _set_permissions(self, role_id: int, permission_keys: List[str]) -> None:
        existing_res = await self.session.exec(
            select(RolePermission).where(RolePermission.role_id == role_id)
        )
        for link in existing_res.all():
            await self.session.delete(link)
        await self.session.flush()

        if not permission_keys:
            return

        perms_res = await self.session.exec(
            select(Permission).where(col(Permission.key).in_(permission_keys))
        )
        for perm in perms_res.all():
            self.session.add(RolePermission(role_id=role_id, permission_id=perm.id))

    async def delete_role(self, role_id: int) -> None:
        role = await self.get_role(role_id)
        if role.is_system:
            raise HTTPException(status_code=400, detail="System roles cannot be deleted.")

        in_use = await self.session.exec(
            select(User.id).where(User.custom_role_id == role_id)
        )
        if in_use.first() is not None:
            raise HTTPException(
                status_code=409,
                detail="This role is currently assigned to one or more users. Reassign them before deleting it.",
            )

        await self.session.delete(role)
        await self.session.commit()

    async def assign_role_to_user(
        self, user_id: int, role_id: int, changed_by_admin_id: Optional[int]
    ) -> User:
        user = await self.session.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
        role = await self.get_role(role_id)

        log = RoleAssignmentLog(
            target_user_id=user.id,
            changed_by_admin_id=changed_by_admin_id,
            previous_role=user.role,
            previous_custom_role_id=user.custom_role_id,
            new_role=role.base_role_type,
            new_custom_role_id=role.id,
        )
        self.session.add(log)

        user.role = role.base_role_type
        user.custom_role_id = role.id
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user
