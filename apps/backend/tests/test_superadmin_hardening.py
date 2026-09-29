import uuid
from datetime import datetime, timezone

import jwt
import pytest
from fastapi import HTTPException
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.cache import get_cache
from app.config.settings import assert_production_secrets, settings
from app.core import totp
from app.core.deps import get_or_create_user_from_clerk
from app.core.security import create_access_token, get_password_hash
from app.db.models.user import AdminActionLog, User, UserRole, UserStatus
from app.db.session import get_async_session
from app.fastapi_server import app, build_cors_origins

PASSWORD = "Password123!"
SA_APP = {"X-Client-App": "superadmin"}


@pytest.fixture
async def env():
    await get_cache().delete_pattern("ep:*")
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def override_session():
        async with factory() as session:
            yield session

    previous = app.dependency_overrides.get(get_async_session)
    app.dependency_overrides[get_async_session] = override_session
    yield factory
    await get_cache().delete_pattern("ep:*")
    if previous is not None:
        app.dependency_overrides[get_async_session] = previous
    else:
        app.dependency_overrides.pop(get_async_session, None)
    await engine.dispose()


async def _seed(factory, role, **extra):
    async with factory() as session:
        user = User(
            full_name=f"{role.value} seed",
            email=f"seed_{role.value.lower()}_{uuid.uuid4().hex[:6]}@example.com",
            role=role,
            status=UserStatus.ACTIVE,
            password_hash=get_password_hash(PASSWORD),
            **extra,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user.id, user.email, create_access_token(subject=user.id, role=role.value)


def _auth(token, **extra):
    return {"Authorization": f"Bearer {token}", **extra}


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _login(client, email, password=PASSWORD, otp=None, headers=None):
    body = {"email": email, "password": password}
    if otp is not None:
        body["otp"] = otp
    return await client.post("/api/v1/auth/login", json=body, headers=headers or {})


def _code_for(secret, step_offset=0):
    return totp._hotp(secret, totp.current_step() + step_offset)


# ───────────────────────── lockout ─────────────────────────

@pytest.mark.anyio
async def test_repeated_failed_logins_lock_the_address_and_success_resets_the_count(env, monkeypatch):
    monkeypatch.setattr(settings, "LOGIN_MAX_FAILED_ATTEMPTS", 3)
    _, email, _ = await _seed(env, UserRole.STUDENT)
    async with _client() as client:
        assert (await _login(client, email, "wrong")).status_code == 401
        assert (await _login(client, email, "wrong")).status_code == 401
        # A success before the limit clears the counter.
        assert (await _login(client, email)).status_code == 200
        for _ in range(3):
            assert (await _login(client, email, "wrong")).status_code == 401
        locked = await _login(client, email)  # even the right password is refused while locked
        assert locked.status_code == 429
        assert int(locked.headers["Retry-After"]) > 0

        # Another address is unaffected.
        _, other, _ = await _seed(env, UserRole.STUDENT)
        assert (await _login(client, other)).status_code == 200


# ───────────────────────── MFA ─────────────────────────

@pytest.mark.anyio
async def test_super_admin_must_enrol_then_needs_a_code_at_every_login(env, monkeypatch):
    monkeypatch.setattr(settings, "SUPERADMIN_MFA_REQUIRED", True)
    _, email, _ = await _seed(env, UserRole.SUPER_ADMIN)
    async with _client() as client:
        first = await _login(client, email)
        assert first.status_code == 200
        assert first.json()["user"]["mfa_setup_required"] is True
        token = first.json()["access_token"]

        # Until enrolled, only the enrolment endpoints (and /me) work.
        blocked = await client.get("/api/v1/auth/super-admin-only", headers=_auth(token))
        assert blocked.status_code == 403 and blocked.json()["detail"] == "MFA_SETUP_REQUIRED"
        assert (await client.get("/api/v1/auth/me", headers=_auth(token))).status_code == 200

        setup = await client.post("/api/v1/auth/mfa/setup", headers=_auth(token))
        assert setup.status_code == 200
        secret = setup.json()["secret"]
        assert setup.json()["otpauth_uri"].startswith("otpauth://totp/")
        # A reload must not rotate the secret the user may already have scanned.
        again = await client.post("/api/v1/auth/mfa/setup", headers=_auth(token))
        assert again.json()["secret"] == secret

        bad = await client.post("/api/v1/auth/mfa/verify", json={"code": "000000"}, headers=_auth(token))
        assert bad.status_code == 400
        ok = await client.post("/api/v1/auth/mfa/verify", json={"code": _code_for(secret)}, headers=_auth(token))
        assert ok.status_code == 200, ok.text
        recovery = ok.json()["recovery_codes"]
        assert len(recovery) == totp.RECOVERY_CODE_COUNT

        assert (await client.get("/api/v1/auth/super-admin-only", headers=_auth(token))).status_code == 200
        assert (await client.post("/api/v1/auth/mfa/setup", headers=_auth(token))).status_code == 400  # already enrolled

        # The stored secret is encrypted, never the plaintext.
        async with env() as session:
            stored = (await session.exec(select(User).where(User.email == email))).one()
            assert stored.totp_enabled and stored.totp_secret != secret
            assert all(h != c for h, c in zip(stored.totp_recovery_hashes, recovery))

        # From now on a code is mandatory.
        missing = await _login(client, email)
        assert missing.status_code == 401 and missing.json()["detail"] == "MFA_REQUIRED"
        assert (await _login(client, email, otp="123456")).status_code == 401
        # Enrolment already consumed this 30 s step, so the next one is the first usable code.
        assert (await _login(client, email, otp=_code_for(secret))).status_code == 401
        good_code = _code_for(secret, step_offset=1)
        good = await _login(client, email, otp=good_code)
        assert good.status_code == 200
        assert good.json()["user"]["mfa_enabled"] is True and good.json()["user"]["mfa_setup_required"] is False

        # The same code cannot be used twice.
        replay = await _login(client, email, otp=good_code)
        assert replay.status_code == 401

        # A recovery code works exactly once.
        assert (await _login(client, email, otp=recovery[0])).status_code == 200
        assert (await _login(client, email, otp=recovery[0])).status_code == 401


@pytest.mark.anyio
async def test_concurrent_mfa_setup_calls_are_handed_the_same_stored_secret(env, monkeypatch):
    import asyncio

    monkeypatch.setattr(settings, "SUPERADMIN_MFA_REQUIRED", True)
    _, _, token = await _seed(env, UserRole.SUPER_ADMIN)
    async with _client() as client:
        responses = await asyncio.gather(*[client.post("/api/v1/auth/mfa/setup", headers=_auth(token)) for _ in range(4)])
        secrets_seen = {r.json()["secret"] for r in responses}
        assert len(secrets_seen) == 1
        # ...and it is the one that was actually stored.
        secret = secrets_seen.pop()
        verified = await client.post("/api/v1/auth/mfa/verify", json={"code": _code_for(secret)}, headers=_auth(token))
        assert verified.status_code == 200


@pytest.mark.anyio
async def test_super_admin_cannot_use_google_sign_in(env, monkeypatch):
    _, email, _ = await _seed(env, UserRole.SUPER_ADMIN, clerk_id="user_clerk_sa")

    async def fake_verify(_token):
        return {"sub": "user_clerk_sa", "email": email}

    import app.routers.auth as auth_router

    monkeypatch.setattr(auth_router, "verify_clerk_token", fake_verify)
    async with _client() as client:
        res = await client.post("/api/v1/auth/clerk-exchange", json={"clerk_token": "x"})
    assert res.status_code == 403


# ───────────────────────── app separation ─────────────────────────

@pytest.mark.anyio
async def test_super_admin_is_confined_to_the_super_admin_app_when_enforced(env, monkeypatch):
    monkeypatch.setattr(settings, "SUPERADMIN_APP_ENFORCED", True)
    _, sa_email, sa_token = await _seed(env, UserRole.SUPER_ADMIN)
    _, admin_email, _ = await _seed(env, UserRole.ADMIN)
    async with _client() as client:
        # Sign-in from the main app looks exactly like a wrong password.
        refused = await _login(client, sa_email)
        assert refused.status_code == 401
        assert refused.json() == (await _login(client, "nobody@example.com")).json()

        allowed = await _login(client, sa_email, headers=SA_APP)
        assert allowed.status_code == 200
        token = allowed.json()["access_token"]
        assert (await client.get("/api/v1/auth/super-admin-only", headers=_auth(token, **SA_APP))).status_code == 200

        # The same valid token is useless outside the Super Admin app.
        outside = await client.get("/api/v1/auth/super-admin-only", headers=_auth(token))
        assert outside.status_code == 403 and outside.json()["detail"] == "SUPERADMIN_APP_REQUIRED"

        # Refresh is also confined.
        refresh_cookie = allowed.cookies.get("refresh_token")
        assert refresh_cookie
        client.cookies.set("refresh_token", refresh_cookie)
        assert (await client.post("/api/v1/auth/refresh")).status_code == 401
        assert (await client.post("/api/v1/auth/refresh", headers=SA_APP)).status_code == 200

        # Everyone else is unaffected.
        assert (await _login(client, admin_email)).status_code == 200


@pytest.mark.anyio
async def test_refresh_cookie_flags(env, monkeypatch):
    monkeypatch.setattr(settings, "COOKIE_SECURE", True)
    _, email, _ = await _seed(env, UserRole.STUDENT)
    _, sa_email, _ = await _seed(env, UserRole.SUPER_ADMIN)
    async with _client() as client:
        student = (await _login(client, email)).headers["set-cookie"].lower()
        assert "httponly" in student and "secure" in student and "samesite=lax" in student
        sa = (await _login(client, sa_email, headers=SA_APP)).headers["set-cookie"].lower()
        assert "samesite=strict" in sa and "secure" in sa


def test_super_admin_access_tokens_are_short_lived():
    sa = jwt.decode(create_access_token(subject=1, role="SUPER_ADMIN"), settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    student = jwt.decode(create_access_token(subject=1, role="STUDENT"), settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    now = datetime.now(timezone.utc).timestamp()
    assert now + 25 * 60 < sa["exp"] < now + 35 * 60
    assert student["exp"] > now + 24 * 3600


# ───────────────────────── Clerk linking ─────────────────────────

@pytest.mark.anyio
async def test_clerk_cannot_be_linked_to_an_existing_staff_account_by_email(env):
    _, admin_email, _ = await _seed(env, UserRole.ADMIN)
    _, student_email, _ = await _seed(env, UserRole.STUDENT)
    async with env() as session:
        with pytest.raises(HTTPException) as ctx:
            await get_or_create_user_from_clerk(session, "clerk_new_1", admin_email, "Mallory", None)
        assert ctx.value.status_code == 403
        staff = (await session.exec(select(User).where(User.email == admin_email))).one()
        assert staff.clerk_id is None

        # Students still link by email as before.
        linked = await get_or_create_user_from_clerk(session, "clerk_new_2", student_email, "Student", None)
        assert linked.clerk_id == "clerk_new_2" and linked.role == UserRole.STUDENT


@pytest.mark.anyio
async def test_google_sign_in_links_student_email_case_insensitively(env):
    student_id, student_email, _ = await _seed(env, UserRole.STUDENT)
    async with env() as session:
        linked = await get_or_create_user_from_clerk(
            session, "clerk_case_1", student_email.upper(), "Student", None
        )
        assert linked.id == student_id and linked.clerk_id == "clerk_case_1"
        count = len((await session.exec(select(User).where(User.role == UserRole.STUDENT))).all())
        assert count == 1


@pytest.mark.anyio
async def test_google_sign_in_of_inactive_account_is_a_final_readable_refusal(env, monkeypatch):
    user_id, email, _ = await _seed(env, UserRole.STUDENT, clerk_id="user_clerk_gone")
    async with env() as session:
        user = await session.get(User, user_id)
        user.status = UserStatus.DELETED
        session.add(user)
        await session.commit()

    async def fake_verify(_token):
        return {"sub": "user_clerk_gone", "email": email}

    import app.routers.auth as auth_router

    monkeypatch.setattr(auth_router, "verify_clerk_token", fake_verify)
    async with _client() as client:
        res = await client.post("/api/v1/auth/clerk-exchange", json={"clerk_token": "x"})
    # The frontend treats 403 as final (no retry loop) and shows this detail on the sign-in page.
    assert res.status_code == 403
    assert "no longer active" in res.json()["detail"]


# ───────────────────────── audit log ─────────────────────────

@pytest.mark.anyio
async def test_staff_actions_are_written_to_the_action_log(env):
    _, sa_email, sa_token = await _seed(env, UserRole.SUPER_ADMIN)
    student_id, student_email, _ = await _seed(env, UserRole.STUDENT)
    _, _, admin_token = await _seed(env, UserRole.ADMIN)
    from unittest.mock import AsyncMock
    from app.services.email_service import email_service

    email_service.send_staff_welcome_email = AsyncMock(return_value=True)
    async with _client() as client:
        created = await client.post(
            "/api/v1/users",
            json={"email": f"aud_{uuid.uuid4().hex[:6]}@example.com", "full_name": "Audited", "role": "TEACHER"},
            headers=_auth(sa_token),
        )
        assert created.status_code == 201
        staff_id = created.json()["user"]["id"]
        assert (await client.post(f"/api/v1/users/{staff_id}/resend-credentials", headers=_auth(sa_token))).status_code == 200
        assert (await client.put(f"/api/v1/users/{student_id}", json={"role": "ADMIN"}, headers=_auth(sa_token))).status_code == 200
        assert (await client.post(f"/api/v1/admin/suspend/{student_id}", headers=_auth(sa_token))).status_code == 200
        assert (await client.delete(f"/api/v1/users/{staff_id}", headers=_auth(sa_token))).status_code == 204

        logs = await client.get("/api/v1/admin/action-logs", headers=_auth(sa_token))
        assert logs.status_code == 200
        actions = [row["action"] for row in logs.json()]
        for expected in ("STAFF_CREATED", "STAFF_CREDENTIALS_RESENT", "ROLE_CHANGED", "USER_SUSPENDED", "USER_DELETED"):
            assert expected in actions, actions
        deleted = next(r for r in logs.json() if r["action"] == "USER_DELETED")
        assert deleted["actor_email"] == sa_email and deleted["target_email"]

        filtered = await client.get("/api/v1/admin/action-logs?action=ROLE_CHANGED", headers=_auth(sa_token))
        assert {r["action"] for r in filtered.json()} == {"ROLE_CHANGED"}

        assert (await client.get("/api/v1/admin/action-logs", headers=_auth(admin_token))).status_code == 403


@pytest.mark.anyio
async def test_super_admin_role_cannot_be_granted_through_the_api(env):
    _, _, sa_token = await _seed(env, UserRole.SUPER_ADMIN)
    student_id, _, _ = await _seed(env, UserRole.STUDENT)
    async with _client() as client:
        res = await client.post(f"/api/v1/admin/users/{student_id}/role", json={"new_role": "SUPER_ADMIN"}, headers=_auth(sa_token))
        assert res.status_code == 403
        ok = await client.post(f"/api/v1/admin/users/{student_id}/role", json={"new_role": "ADMIN"}, headers=_auth(sa_token))
        assert ok.status_code == 200


@pytest.mark.anyio
async def test_super_admin_login_and_failures_are_logged(env, monkeypatch):
    _, sa_email, sa_token = await _seed(env, UserRole.SUPER_ADMIN)
    async with _client() as client:
        assert (await _login(client, sa_email, "wrong")).status_code == 401
        assert (await _login(client, sa_email)).status_code == 200
    async with env() as session:
        actions = [row.action for row in (await session.exec(select(AdminActionLog))).all()]
    assert "SUPERADMIN_LOGIN_FAILED" in actions and "SUPERADMIN_LOGIN" in actions


# ───────────────────────── startup / config ─────────────────────────

def test_cors_allowlist_has_no_wildcard_and_includes_configured_origins(monkeypatch):
    monkeypatch.setattr(settings, "CORS_ALLOWED_ORIGINS", "https://a.example.com, https://b.example.com/")
    origins = build_cors_origins()
    assert "*" not in origins
    assert "https://a.example.com" in origins and "https://b.example.com" in origins
    assert settings.FRONTEND_URL.rstrip("/") in origins


def test_production_refuses_to_start_with_the_default_secret_key():
    class Cfg:
        ENVIRONMENT = "production"
        SECRET_KEY = "secret-key-change-in-production-1234567890"
        SUPERADMIN_PASSWORD = "x"

    with pytest.raises(RuntimeError):
        assert_production_secrets(Cfg)
    Cfg.SECRET_KEY = "a-long-random-value"
    assert_production_secrets(Cfg)  # fine
    Cfg.ENVIRONMENT = "development"
    Cfg.SECRET_KEY = "secret-key-change-in-production-1234567890"
    assert_production_secrets(Cfg)  # only warns outside production
