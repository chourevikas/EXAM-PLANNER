import unittest
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import SQLModel

from app.db.models.user import User, UserRole
from app.db.models.roles import Role
from app.services.auth_service import AuthService


class TestRoleRedirect(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with self.engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        self.session_factory = async_sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def test_teacher_redirects_to_teacher_dashboard(self):
        async with self.session_factory() as session:
            service = AuthService(session)
            self.assertEqual(service.get_role_redirect(UserRole.TEACHER), "/teacher")

    async def test_existing_redirects_unchanged(self):
        async with self.session_factory() as session:
            service = AuthService(session)
            self.assertEqual(service.get_role_redirect(UserRole.SUPER_ADMIN), "/superadmin")
            self.assertEqual(service.get_role_redirect(UserRole.ADMIN), "/admin")
            self.assertEqual(service.get_role_redirect(UserRole.STUDENT), "/dashboard")

    async def test_custom_role_user_redirects_via_base_role_type_without_special_casing(self):
        async with self.session_factory() as session:
            role = Role(name="Sub Admin", slug="sub-admin", base_role_type=UserRole.ADMIN, is_system=False)
            session.add(role)
            await session.commit()
            await session.refresh(role)

            user = User(
                full_name="Sub Admin User",
                email="subadmin_redirect@example.com",
                role=UserRole.ADMIN,
                custom_role_id=role.id,
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)

            service = AuthService(session)
            # Redirect logic keys off User.role (== base_role_type), not custom_role_id.
            self.assertEqual(service.get_role_redirect(user.role), "/admin")


if __name__ == "__main__":
    unittest.main()
