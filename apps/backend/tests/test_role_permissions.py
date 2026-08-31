import unittest
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import SQLModel

from app.db.models.user import User, UserRole, UserStatus
from app.db.models.roles import Permission, Role, RolePermission
from app.services.role_service import RoleService
from app.core.deps import require_permission, require_roles_or_permission
from fastapi import HTTPException


class TestRolePermissions(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with self.engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        self.session_factory = async_sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def _seed_permission(self, session, key="questions.review.manage"):
        perm = Permission(key=key, label=key)
        session.add(perm)
        await session.commit()
        await session.refresh(perm)
        return perm

    async def test_create_role_rejects_super_admin_base_type_at_schema_level(self):
        from app.schemas.roles import RoleCreatePayload

        with self.assertRaises(Exception):
            RoleCreatePayload(name="Rogue Role", base_role_type=UserRole.SUPER_ADMIN)

    async def test_create_and_assign_custom_role_grants_permission(self):
        async with self.session_factory() as session:
            perm = await self._seed_permission(session)
            service = RoleService(session)

            role = await service.create_role(
                name="Sub Admin",
                base_role_type=UserRole.ADMIN,
                description="Restricted admin",
                permission_keys=[perm.key],
                created_by_id=None,
            )
            self.assertEqual(role["permission_keys"], [perm.key])
            self.assertFalse(role["is_system"])

            user = User(full_name="Sub Admin User", email="subadmin@example.com", role=UserRole.STUDENT)
            session.add(user)
            await session.commit()
            await session.refresh(user)

            updated_user = await service.assign_role_to_user(
                user_id=user.id, role_id=role["id"], changed_by_admin_id=None
            )
            self.assertEqual(updated_user.role, UserRole.ADMIN)
            self.assertEqual(updated_user.custom_role_id, role["id"])

            checker = require_permission(perm.key)
            result = await checker(current_user=updated_user, session=session)
            self.assertEqual(result.id, updated_user.id)

    async def test_teacher_role_without_custom_role_id_falls_back_to_system_role(self):
        async with self.session_factory() as session:
            perm_review = await self._seed_permission(session, "questions.review")
            perm_manage = await self._seed_permission(session, "questions.review.manage")

            teacher_role = Role(
                name="Teacher", slug="teacher", base_role_type=UserRole.TEACHER, is_system=True
            )
            session.add(teacher_role)
            await session.commit()
            await session.refresh(teacher_role)
            session.add(RolePermission(role_id=teacher_role.id, permission_id=perm_review.id))
            session.add(RolePermission(role_id=teacher_role.id, permission_id=perm_manage.id))
            await session.commit()

            teacher_user = User(
                full_name="Teacher User", email="teacher@example.com", role=UserRole.TEACHER
            )
            session.add(teacher_user)
            await session.commit()
            await session.refresh(teacher_user)

            self.assertIsNone(teacher_user.custom_role_id)

            checker = require_permission("questions.review.manage")
            result = await checker(current_user=teacher_user, session=session)
            self.assertEqual(result.id, teacher_user.id)

    async def test_student_without_permission_is_rejected(self):
        async with self.session_factory() as session:
            await self._seed_permission(session, "questions.review.manage")
            student = User(full_name="Student", email="student@example.com", role=UserRole.STUDENT)
            session.add(student)
            await session.commit()
            await session.refresh(student)

            checker = require_permission("questions.review.manage")
            with self.assertRaises(HTTPException) as ctx:
                await checker(current_user=student, session=session)
            self.assertEqual(ctx.exception.status_code, 403)

    async def test_admin_always_passes_require_roles_or_permission(self):
        async with self.session_factory() as session:
            admin = User(full_name="Admin", email="admin_rp@example.com", role=UserRole.ADMIN)
            session.add(admin)
            await session.commit()
            await session.refresh(admin)

            checker = require_roles_or_permission([UserRole.ADMIN, UserRole.SUPER_ADMIN], "questions.review.manage")
            result = await checker(current_user=admin, session=session)
            self.assertEqual(result.id, admin.id)

    async def test_is_system_role_cannot_be_renamed_or_deleted(self):
        async with self.session_factory() as session:
            teacher_role = Role(name="Teacher", slug="teacher", base_role_type=UserRole.TEACHER, is_system=True)
            session.add(teacher_role)
            await session.commit()
            await session.refresh(teacher_role)

            service = RoleService(session)
            with self.assertRaises(HTTPException):
                await service.update_role(teacher_role.id, name="Renamed", description=None, permission_keys=None)
            with self.assertRaises(HTTPException):
                await service.delete_role(teacher_role.id)

    async def test_deleting_assigned_custom_role_is_blocked(self):
        async with self.session_factory() as session:
            service = RoleService(session)
            role = await service.create_role(
                name="Sub Admin 2",
                base_role_type=UserRole.ADMIN,
                description=None,
                permission_keys=[],
                created_by_id=None,
            )
            user = User(full_name="Assigned User", email="assigned@example.com", role=UserRole.ADMIN, custom_role_id=role["id"])
            session.add(user)
            await session.commit()

            with self.assertRaises(HTTPException) as ctx:
                await service.delete_role(role["id"])
            self.assertEqual(ctx.exception.status_code, 409)


if __name__ == "__main__":
    unittest.main()
