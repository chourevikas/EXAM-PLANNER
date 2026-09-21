import unittest
import uuid

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.exceptions import BaseAppException
from app.db.models.user import User, UserRole, UserStatus
from app.schemas.auth import UserRegister
from app.schemas.user import UserUpdate
from app.services.auth_service import AuthService
from app.services.user_service import UserService


def _register_payload(role):
    return UserRegister(
        email=f"esc_{uuid.uuid4().hex[:8]}@example.com",
        password="Password123!",
        full_name="Escalation Probe",
        role=role,
    )


class TestRoleEscalation(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine(
            "sqlite+aiosqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        async with self.engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        self.session_factory = async_sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def _make_user(self, session, role, email):
        user = User(full_name=email, email=email, role=role, status=UserStatus.ACTIVE)
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user

    async def _role_of(self, user_id):
        # Fresh session: reads what was actually persisted, without expiring objects the test still holds.
        async with self.session_factory() as fresh:
            return (await fresh.exec(select(User).where(User.id == user_id))).one().role

    # --- public register: students only ---

    async def test_register_rejects_every_non_student_role(self):
        for role in (UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER):
            async with self.session_factory() as session:
                payload = _register_payload(role)
                with self.assertRaises(HTTPException) as ctx:
                    await AuthService(session).register_user(payload)
                self.assertEqual(ctx.exception.status_code, 403)
                created = (await session.exec(select(User).where(User.email == payload.email.lower()))).first()
                self.assertIsNone(created)

    async def test_register_student_and_default_are_active_students(self):
        for role in (UserRole.STUDENT, None):
            async with self.session_factory() as session:
                payload = _register_payload(role)
                await AuthService(session).register_user(payload)
                created = (await session.exec(select(User).where(User.email == payload.email.lower()))).one()
                self.assertEqual(created.role, UserRole.STUDENT)
                self.assertEqual(created.status, UserStatus.ACTIVE)

    # --- PUT /users/{id} (UserService.update_user) ---

    async def test_admin_cannot_change_student_role(self):
        async with self.session_factory() as session:
            admin = await self._make_user(session, UserRole.ADMIN, "admin@example.com")
            student_id = (await self._make_user(session, UserRole.STUDENT, "student@example.com")).id
            for target in (UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER):
                with self.assertRaises(BaseAppException) as ctx:
                    await UserService(session).update_user(
                        student_id, UserUpdate(role=target), current_user=admin
                    )
                self.assertEqual(ctx.exception.status_code, 403)
                self.assertEqual(await self._role_of(student_id), UserRole.STUDENT)

    async def test_admin_can_still_edit_student_name_and_status(self):
        async with self.session_factory() as session:
            admin = await self._make_user(session, UserRole.ADMIN, "admin@example.com")
            student = await self._make_user(session, UserRole.STUDENT, "student@example.com")
            updated = await UserService(session).update_user(
                student.id,
                UserUpdate(full_name="Renamed", status=UserStatus.SUSPENDED, role=UserRole.STUDENT),
                current_user=admin,
            )
            self.assertEqual(updated.full_name, "Renamed")
            self.assertEqual(updated.status, UserStatus.SUSPENDED)
            self.assertEqual(updated.role, UserRole.STUDENT)

    async def test_super_admin_can_change_role_but_not_grant_super_admin(self):
        async with self.session_factory() as session:
            boss = await self._make_user(session, UserRole.SUPER_ADMIN, "boss@example.com")
            student = await self._make_user(session, UserRole.STUDENT, "student@example.com")
            service = UserService(session)

            updated = await service.update_user(student.id, UserUpdate(role=UserRole.ADMIN), current_user=boss)
            self.assertEqual(updated.role, UserRole.ADMIN)

            with self.assertRaises(BaseAppException) as ctx:
                await service.update_user(student.id, UserUpdate(role=UserRole.SUPER_ADMIN), current_user=boss)
            self.assertEqual(ctx.exception.status_code, 403)
            self.assertEqual(await self._role_of(student.id), UserRole.ADMIN)


if __name__ == "__main__":
    unittest.main()
