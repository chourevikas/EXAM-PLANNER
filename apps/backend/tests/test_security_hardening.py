"""Security review fixes: attempt-report ownership, admin-only job triggers, Google-only Clerk exchange."""
import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from httpx import AsyncClient, ASGITransport
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import StaticPool

from app.fastapi_server import app
from app.cache import get_cache
from app.db.session import get_async_session
from app.db.models.user import User, UserRole
from app.db.models.hierarchy import Exam
from app.db.models.analytics import ExamAttempt
from app.db.models.enums import AttemptStatus
from app.core import deps
from app.core.security import create_access_token, get_password_hash

test_engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=False,
)

_state: dict = {}


async def _override_session():
    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    async with AsyncSession(test_engine, expire_on_commit=False) as session:
        if not _state:
            await _seed(session)
        yield session


async def _seed(session: AsyncSession):
    exam = Exam(code="SEC-HARD-2026", name="Hardening Exam")
    session.add(exam)
    users = {
        "owner": User(full_name="Owner", email="owner@hardening.test", role=UserRole.STUDENT, password_hash=get_password_hash("x")),
        "other": User(full_name="Other", email="other@hardening.test", role=UserRole.STUDENT, password_hash=get_password_hash("x")),
        "victim": User(full_name="Victim", email="victim@hardening.test", role=UserRole.STUDENT, password_hash=get_password_hash("x")),
        "admin": User(full_name="Admin", email="admin@hardening.test", role=UserRole.ADMIN, password_hash=get_password_hash("x")),
    }
    for u in users.values():
        session.add(u)
    await session.commit()
    await session.refresh(exam)
    for u in users.values():
        await session.refresh(u)

    attempt = ExamAttempt(
        user_id=users["owner"].id,
        exam_id=exam.id,
        status=AttemptStatus.EVALUATED,
        report_metadata_json={"kept": True},
    )
    session.add(attempt)
    await session.commit()
    await session.refresh(attempt)
    _state.update(users={k: (u.id, u.role.value) for k, u in users.items()}, attempt_id=attempt.id)


def _h(who: str) -> dict:
    uid, role = _state["users"][who]
    return {"Authorization": f"Bearer {create_access_token(subject=uid, role=role)}"}


@pytest.fixture
async def client():
    previous = app.dependency_overrides.get(get_async_session)
    app.dependency_overrides[get_async_session] = _override_session
    # get_current_user caches users by id; ids collide with other test modules' in-memory DBs.
    await get_cache().delete_pattern("*")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        # Seed once before the tests read _state.
        await c.get("/api/v1/exam-types")
        await get_cache().delete_pattern("*")
        yield c
    await get_cache().delete_pattern("*")
    if previous is not None:
        app.dependency_overrides[get_async_session] = previous


# ───────────────────────── attempt reports (IDOR) ─────────────────────────
REPORT_PATHS = ("status", "questions", "exam", "user-delta", "json", "yaml", "markdown")


@pytest.mark.anyio
async def test_attempt_reports_are_hidden_from_other_students(client):
    aid = _state["attempt_id"]
    for path in REPORT_PATHS:
        res = await client.get(f"/api/v1/analytics/reports/attempts/{aid}/{path}", headers=_h("other"))
        assert res.status_code == 404, (path, res.status_code)
    # Same answer as a non-existent attempt, so ids can't be probed.
    missing = await client.get("/api/v1/analytics/reports/attempts/999999/status", headers=_h("owner"))
    assert missing.status_code == 404


@pytest.mark.anyio
async def test_attempt_report_status_works_for_owner_and_admin(client):
    aid = _state["attempt_id"]
    assert (await client.get(f"/api/v1/analytics/reports/attempts/{aid}/status", headers=_h("owner"))).status_code == 200
    assert (await client.get(f"/api/v1/analytics/reports/attempts/{aid}/status", headers=_h("admin"))).status_code == 200


@pytest.mark.anyio
async def test_other_student_cannot_retry_and_wipe_an_attempt(client):
    aid = _state["attempt_id"]
    res = await client.post(f"/api/v1/analytics/reports/attempts/{aid}/retry", headers=_h("other"))
    assert res.status_code == 404
    async with AsyncSession(test_engine, expire_on_commit=False) as session:
        attempt = await session.get(ExamAttempt, aid)
        assert attempt.status == AttemptStatus.EVALUATED
        assert attempt.report_metadata_json == {"kept": True}


# ───────────────────────── background job triggers ─────────────────────────
@pytest.mark.anyio
@pytest.mark.parametrize("path", ["trigger-daily-digests", "trigger-midnight-translation"])
async def test_job_triggers_require_admin(client, path):
    assert (await client.post(f"/api/v1/study-plan/{path}")).status_code == 401
    assert (await client.post(f"/api/v1/study-plan/{path}", headers=_h("owner"))).status_code == 403


# ───────────────────────── Clerk (Google-only) exchange ─────────────────────────
@pytest.mark.anyio
async def test_clerk_exchange_ignores_email_sent_by_the_browser(client, monkeypatch):
    import app.routers.auth as auth_router

    async def fake_verify(_token):
        return {"sub": "user_attacker"}

    async def fake_identity(_clerk_id):
        return {"email": "attacker@gmail.test", "full_name": "Attacker", "profile_image": None}

    monkeypatch.setattr(auth_router, "verify_clerk_token", fake_verify)
    monkeypatch.setattr(auth_router, "fetch_clerk_google_identity", fake_identity)
    res = await client.post(
        "/api/v1/auth/clerk-exchange",
        json={"clerk_token": "x", "email": "victim@hardening.test", "full_name": "Victim"},
    )
    assert res.status_code == 200
    me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {res.json()['access_token']}"})
    assert me.json()["email"] == "attacker@gmail.test"
    assert me.json()["id"] != _state["users"]["victim"][0]


class _FakeClerkAPI:
    """Stands in for httpx.AsyncClient when fetch_clerk_google_identity calls Clerk's Backend API."""

    payload: dict = {}
    status_code = 200

    def __init__(self, *a, **kw):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def get(self, url, headers=None):
        assert headers["Authorization"] == "Bearer sk_test_hardening"
        test = self

        class _Res:
            status_code = test.status_code

            @staticmethod
            def json():
                return test.payload

        return _Res()


@pytest.fixture
def clerk_api(monkeypatch):
    import httpx

    monkeypatch.setattr(deps.settings, "CLERK_SECRET_KEY", "sk_test_hardening")
    monkeypatch.setattr(httpx, "AsyncClient", _FakeClerkAPI)
    return _FakeClerkAPI


@pytest.mark.anyio
async def test_google_identity_uses_the_verified_google_account_email(clerk_api):
    clerk_api.payload = {
        "first_name": "Asha",
        "last_name": "K",
        "image_url": "https://img.clerk.com/a.png",
        "email_addresses": [{"email_address": "other@example.test", "verification": {"status": "verified", "strategy": "email_code"}}],
        "external_accounts": [
            {"provider": "oauth_google", "email_address": "Asha@Gmail.test", "verification": {"status": "verified", "strategy": "oauth_google"}}
        ],
    }
    identity = await deps.fetch_clerk_google_identity("user_1")
    assert identity == {"email": "asha@gmail.test", "full_name": "Asha K", "profile_image": "https://img.clerk.com/a.png"}


@pytest.mark.anyio
async def test_clerk_user_without_google_account_is_refused(clerk_api):
    clerk_api.payload = {
        "email_addresses": [{"email_address": "x@example.test", "verification": {"status": "verified", "strategy": "email_code"}}],
        "external_accounts": [
            {"provider": "oauth_github", "email_address": "x@example.test", "verification": {"status": "verified"}}
        ],
    }
    with pytest.raises(HTTPException) as exc:
        await deps.fetch_clerk_google_identity("user_2")
    assert exc.value.status_code == 403


def _rsa():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


class _StubJWKS:
    """Our instance's JWKS: always hands back OUR public key, whatever the token claims."""

    def __init__(self, public_key):
        self.public_key = public_key

    def get_signing_key_from_jwt(self, _token):
        return type("K", (), {"key": self.public_key})()


def _token(private_key, **claims):
    now = int(time.time())
    body = {"sub": "user_x", "iat": now, "exp": now + 300, **claims}
    return jwt.encode(body, private_key, algorithm="RS256")


@pytest.mark.anyio
async def test_clerk_token_signed_by_another_key_is_rejected(monkeypatch):
    ours, attackers = _rsa(), _rsa()
    monkeypatch.setattr(deps.settings, "CLERK_SECRET_KEY", "sk_test_hardening")
    monkeypatch.setattr(deps, "_get_jwks_client", lambda: _StubJWKS(ours.public_key()))
    monkeypatch.setattr(deps.settings, "CLERK_AUTHORIZED_PARTIES", None)

    forged = _token(attackers, iss="https://attacker.example")
    with pytest.raises(HTTPException) as exc:
        await deps.verify_clerk_token(forged)
    assert exc.value.status_code == 401

    assert (await deps.verify_clerk_token(_token(ours)))["sub"] == "user_x"


@pytest.mark.anyio
async def test_clerk_token_for_another_origin_is_rejected(monkeypatch):
    ours = _rsa()
    monkeypatch.setattr(deps.settings, "CLERK_SECRET_KEY", "sk_test_hardening")
    monkeypatch.setattr(deps, "_get_jwks_client", lambda: _StubJWKS(ours.public_key()))
    monkeypatch.setattr(deps.settings, "CLERK_AUTHORIZED_PARTIES", "https://examplanner.in")

    with pytest.raises(HTTPException):
        await deps.verify_clerk_token(_token(ours, azp="https://evil.example"))
    assert (await deps.verify_clerk_token(_token(ours, azp="https://examplanner.in")))["sub"] == "user_x"


@pytest.mark.anyio
async def test_google_sign_in_is_unavailable_without_clerk_secret(monkeypatch):
    monkeypatch.setattr(deps.settings, "CLERK_SECRET_KEY", None)
    with pytest.raises(HTTPException) as exc:
        await deps.verify_clerk_token("anything")
    assert exc.value.status_code == 503
