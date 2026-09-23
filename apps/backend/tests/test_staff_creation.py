import uuid
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.cache import get_cache
from app.core.security import create_access_token, get_password_hash
from app.db.models.user import User, UserRole, UserStatus
from app.db.session import get_async_session
from app.fastapi_server import app
from app.services.email_service import email_service
from app.services.role_service import RoleService

PASSWORD = "Password123!"


@pytest.fixture
async def env(monkeypatch):
    """Isolated in-memory DB plus a captured (not sent) staff welcome email."""
    # Each test's DB reuses ids 1, 2, ...; a cached user from an earlier test would otherwise leak in.
    await get_cache().delete_pattern("ep:user:id:*")
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def override_session():
        async with factory() as session:
            yield session

    previous = app.dependency_overrides.get(get_async_session)
    app.dependency_overrides[get_async_session] = override_session
    mail = AsyncMock(return_value=True)
    monkeypatch.setattr(email_service, "send_staff_welcome_email", mail)

    yield factory, mail

    await get_cache().delete_pattern("ep:user:id:*")
    if previous is not None:
        app.dependency_overrides[get_async_session] = previous
    else:
        app.dependency_overrides.pop(get_async_session, None)
    await engine.dispose()


async def _seed(factory, role):
    async with factory() as session:
        user = User(
            full_name=f"{role.value} seed",
            email=f"seed_{role.value.lower()}_{uuid.uuid4().hex[:6]}@example.com",
            role=role,
            status=UserStatus.ACTIVE,
            password_hash=get_password_hash(PASSWORD),
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user.id, create_access_token(subject=user.id, role=role.value)


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def _staff_payload(role="ADMIN", **extra):
    return {"email": f"staff_{uuid.uuid4().hex[:8]}@example.com", "full_name": "New Staff", "role": role, **extra}


async def _user_by_email(factory, email):
    async with factory() as session:
        return (await session.exec(select(User).where(User.email == email.lower()))).one()


@pytest.mark.anyio
async def test_public_register_is_student_only(env):
    factory, _ = env
    async with _client() as client:
        for role in ("SUPER_ADMIN", "ADMIN", "TEACHER"):
            res = await client.post(
                "/api/v1/auth/register",
                json={"email": f"x_{uuid.uuid4().hex[:6]}@example.com", "password": PASSWORD, "full_name": "X", "role": role},
            )
            assert res.status_code == 403, role
        res = await client.post(
            "/api/v1/auth/register",
            json={"email": f"s_{uuid.uuid4().hex[:6]}@example.com", "password": PASSWORD, "full_name": "S"},
        )
        assert res.status_code == 201
        assert res.json()["user"]["role"] == "STUDENT"


@pytest.mark.anyio
async def test_only_super_admin_can_create_staff(env):
    factory, mail = env
    _, admin_token = await _seed(factory, UserRole.ADMIN)
    _, student_token = await _seed(factory, UserRole.STUDENT)
    async with _client() as client:
        for token in (admin_token, student_token):
            res = await client.post("/api/v1/users", json=_staff_payload(), headers=_auth(token))
            assert res.status_code == 403
        res = await client.post("/api/v1/users", json=_staff_payload())
        assert res.status_code == 401
    mail.assert_not_awaited()


@pytest.mark.anyio
async def test_super_admin_creates_admin_and_teacher_with_emailed_temp_password(env):
    factory, mail = env
    _, sa_token = await _seed(factory, UserRole.SUPER_ADMIN)
    async with _client() as client:
        for role in ("ADMIN", "TEACHER"):
            mail.reset_mock()
            payload = _staff_payload(role)
            res = await client.post("/api/v1/users", json=payload, headers=_auth(sa_token))
            assert res.status_code == 201, res.text
            body = res.json()
            assert body["email_sent"] is True
            assert body["user"]["role"] == role
            assert body["user"]["status"] == "ACTIVE"

            # The password reaches the user by email only, never through the API response.
            mail.assert_awaited_once()
            _, _, _, temp_password = mail.await_args.args
            assert temp_password not in res.text
            assert len(temp_password) >= 12

            stored = await _user_by_email(factory, payload["email"])
            assert stored.must_change_password is True
            assert stored.password_hash != temp_password

            login = await client.post("/api/v1/auth/login", json={"email": payload["email"], "password": temp_password})
            assert login.status_code == 200, login.text
            assert login.json()["user"]["must_change_password"] is True


@pytest.mark.anyio
async def test_cannot_create_super_admin_or_student_or_duplicate(env):
    factory, mail = env
    _, sa_token = await _seed(factory, UserRole.SUPER_ADMIN)
    async with _client() as client:
        for role in ("SUPER_ADMIN", "STUDENT"):
            res = await client.post("/api/v1/users", json=_staff_payload(role), headers=_auth(sa_token))
            assert res.status_code == 403, role
        payload = _staff_payload("ADMIN")
        assert (await client.post("/api/v1/users", json=payload, headers=_auth(sa_token))).status_code == 201
        assert (await client.post("/api/v1/users", json=payload, headers=_auth(sa_token))).status_code == 400
    assert mail.await_count == 1


@pytest.mark.anyio
async def test_temp_password_gate_and_change_password(env):
    factory, mail = env
    _, sa_token = await _seed(factory, UserRole.SUPER_ADMIN)
    async with _client() as client:
        payload = _staff_payload("ADMIN")
        await client.post("/api/v1/users", json=payload, headers=_auth(sa_token))
        temp_password = mail.await_args.args[3]
        token = (await client.post("/api/v1/auth/login", json={"email": payload["email"], "password": temp_password})).json()["access_token"]

        # Blocked everywhere except /auth/me, /auth/change-password and /auth/logout.
        blocked = await client.get("/api/v1/auth/admin-only", headers=_auth(token))
        assert blocked.status_code == 403
        assert blocked.json()["detail"] == "PASSWORD_CHANGE_REQUIRED"
        assert (await client.get("/api/v1/auth/me", headers=_auth(token))).status_code == 200

        # Bad current password, weak new password and reuse are all rejected.
        bad = {"current_password": "wrong-password", "new_password": "BrandNewPass9!"}
        assert (await client.post("/api/v1/auth/change-password", json=bad, headers=_auth(token))).status_code == 400
        short = {"current_password": temp_password, "new_password": "short"}
        assert (await client.post("/api/v1/auth/change-password", json=short, headers=_auth(token))).status_code == 422
        same = {"current_password": temp_password, "new_password": temp_password}
        assert (await client.post("/api/v1/auth/change-password", json=same, headers=_auth(token))).status_code == 400

        ok = await client.post(
            "/api/v1/auth/change-password",
            json={"current_password": temp_password, "new_password": "BrandNewPass9!"},
            headers=_auth(token),
        )
        assert ok.status_code == 200, ok.text
        assert ok.json()["user"]["must_change_password"] is False

        assert (await client.get("/api/v1/auth/admin-only", headers=_auth(ok.json()["access_token"]))).status_code == 200
        old_login = await client.post("/api/v1/auth/login", json={"email": payload["email"], "password": temp_password})
        assert old_login.status_code == 401
        new_login = await client.post("/api/v1/auth/login", json={"email": payload["email"], "password": "BrandNewPass9!"})
        assert new_login.status_code == 200
        assert new_login.json()["user"]["must_change_password"] is False


@pytest.mark.anyio
async def test_sub_admin_gets_custom_role_and_base_type_must_match(env):
    factory, mail = env
    _, sa_token = await _seed(factory, UserRole.SUPER_ADMIN)
    async with factory() as session:
        role = await RoleService(session).create_role(
            name="Content Reviewer", base_role_type=UserRole.ADMIN, description=None, permission_keys=[], created_by_id=None
        )
    async with _client() as client:
        payload = _staff_payload("ADMIN", custom_role_id=role["id"])
        res = await client.post("/api/v1/users", json=payload, headers=_auth(sa_token))
        assert res.status_code == 201, res.text
        stored = await _user_by_email(factory, payload["email"])
        assert stored.custom_role_id == role["id"]
        assert stored.role == UserRole.ADMIN

        mismatch = _staff_payload("TEACHER", custom_role_id=role["id"])
        assert (await client.post("/api/v1/users", json=mismatch, headers=_auth(sa_token))).status_code == 400
        missing = _staff_payload("ADMIN", custom_role_id=99999)
        assert (await client.post("/api/v1/users", json=missing, headers=_auth(sa_token))).status_code == 404


@pytest.mark.anyio
async def test_email_failure_still_creates_user_and_reports_it(env):
    factory, mail = env
    mail.return_value = False
    _, sa_token = await _seed(factory, UserRole.SUPER_ADMIN)
    async with _client() as client:
        payload = _staff_payload("TEACHER")
        res = await client.post("/api/v1/users", json=payload, headers=_auth(sa_token))
        assert res.status_code == 201
        assert res.json()["email_sent"] is False
        assert (await _user_by_email(factory, payload["email"])).must_change_password is True


@pytest.mark.anyio
async def test_resend_credentials_replaces_the_temporary_password(env):
    factory, mail = env
    _, sa_token = await _seed(factory, UserRole.SUPER_ADMIN)
    student_id, _ = await _seed(factory, UserRole.STUDENT)
    async with _client() as client:
        payload = _staff_payload("ADMIN")
        created = (await client.post("/api/v1/users", json=payload, headers=_auth(sa_token))).json()
        first = mail.await_args.args[3]

        res = await client.post(f"/api/v1/users/{created['user']['id']}/resend-credentials", headers=_auth(sa_token))
        assert res.status_code == 200
        second = mail.await_args.args[3]
        assert second != first

        old = await client.post("/api/v1/auth/login", json={"email": payload["email"], "password": first})
        assert old.status_code == 401
        new = await client.post("/api/v1/auth/login", json={"email": payload["email"], "password": second})
        assert new.status_code == 200
        assert new.json()["user"]["must_change_password"] is True

        assert (await client.post(f"/api/v1/users/{student_id}/resend-credentials", headers=_auth(sa_token))).status_code == 403
        assert (await client.post("/api/v1/users/999999/resend-credentials", headers=_auth(sa_token))).status_code == 404


@pytest.mark.anyio
async def test_reset_password_link_clears_must_change_flag(env):
    factory, mail = env
    _, sa_token = await _seed(factory, UserRole.SUPER_ADMIN)
    async with _client() as client:
        payload = _staff_payload("TEACHER")
        created = (await client.post("/api/v1/users", json=payload, headers=_auth(sa_token))).json()
        import jwt
        from datetime import datetime, timedelta, timezone
        from app.config.settings import settings

        token = jwt.encode(
            {"sub": str(created["user"]["id"]), "action": "reset_password", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )
        res = await client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": "ResetViaLink9!"})
        assert res.status_code == 200
        assert (await _user_by_email(factory, payload["email"])).must_change_password is False
