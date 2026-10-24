"""Internal-release ops: 'Report a problem' feedback, the health check, the 500 handler and the LLM daily budget."""
import io
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient, ASGITransport
from PIL import Image
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import StaticPool

import app.fastapi_server as server
from app.fastapi_server import app
from app.cache import get_cache
from app.config.settings import settings
from app.db import session as db_session
from app.db.session import get_async_session
from app.db.models.llm_usage import LlmUsageEvent
from app.db.models.user import User, UserRole
from app.db.models.roles import Role, Permission, RolePermission
from app.core.security import create_access_token, get_password_hash
from app.routers import feedback as feedback_router
from app.services import llm_budget, ops_alerts
from app.storage.local import LocalStorageProvider

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


@asynccontextmanager
async def _test_managed_session(max_retries: int = 5):
    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    async with AsyncSession(test_engine, expire_on_commit=False) as session:
        yield session


async def _seed(session: AsyncSession):
    perms = {}
    for key in ("admin.feedback", "admin.testimonials"):
        p = Permission(key=key, label=key)
        session.add(p)
        await session.commit()
        await session.refresh(p)
        perms[key] = p

    roles = {}
    for name, key in (("Feedback Triage", "admin.feedback"), ("Testimonial Mod", "admin.testimonials")):
        r = Role(name=name, slug=name.lower().replace(" ", "-"), base_role_type=UserRole.ADMIN)
        session.add(r)
        await session.commit()
        await session.refresh(r)
        session.add(RolePermission(role_id=r.id, permission_id=perms[key].id))
        await session.commit()
        roles[key] = r

    def user(name, role, custom_role_id=None):
        return User(
            full_name=name,
            email=f"{name.lower().replace(' ', '_')}@feedback.test",
            role=role,
            custom_role_id=custom_role_id,
            password_hash=get_password_hash("x"),
        )

    users = {
        "student": user("Feedback Student", UserRole.STUDENT),
        "student2": user("Busy Student", UserRole.STUDENT),
        "admin_open": user("Feedback Admin", UserRole.ADMIN),
        "admin_feedback": user("Feedback Triage Admin", UserRole.ADMIN, roles["admin.feedback"].id),
        "admin_other": user("Testimonial Admin", UserRole.ADMIN, roles["admin.testimonials"].id),
    }
    for u in users.values():
        session.add(u)
    await session.commit()
    for u in users.values():
        await session.refresh(u)
    _state.update(users={k: (u.id, u.role.value) for k, u in users.items()})


def _h(who: str) -> dict:
    uid, role = _state["users"][who]
    return {"Authorization": f"Bearer {create_access_token(subject=uid, role=role)}"}


def _png(color=(200, 30, 30)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (40, 30), color).save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def alerts(monkeypatch):
    sent = []

    async def fake_alert(title, description="", fields=None, color=ops_alerts.INFO_COLOR):
        sent.append({"title": title, "description": description, "fields": fields or {}})
        return True

    monkeypatch.setattr(ops_alerts, "send_discord_alert", fake_alert)
    return sent


@pytest.fixture
async def client(monkeypatch, tmp_path, alerts):
    app.dependency_overrides[get_async_session] = _override_session
    monkeypatch.setattr(db_session, "managed_async_session", _test_managed_session)
    storage = LocalStorageProvider(tmp_path / "storage")
    monkeypatch.setattr("app.storage.factory.get_storage_provider", lambda: storage)
    await get_cache().delete_pattern("*")
    async with AsyncClient(transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test") as c:
        await c.get("/api/v1/auth/languages")
        await c.get("/api/v1/admin/feedback/summary")
        await get_cache().delete_pattern("*")
        yield c
    app.dependency_overrides.pop(get_async_session, None)
    await get_cache().delete_pattern("*")


# ── Feedback ─────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_student_sends_feedback_and_admin_alerted(client, alerts):
    res = await client.post(
        "/api/v1/feedback",
        data={"category": "BUG", "message": "The timer froze on question 12.", "page_url": "/exam/42", "user_agent": "UA/1"},
        headers=_h("student"),
    )
    assert res.status_code == 201, res.text
    assert res.json()["status"] == "OPEN"
    assert alerts and alerts[-1]["title"].startswith(f"Feedback #{res.json()['id']}")
    assert alerts[-1]["fields"]["Page"] == "/exam/42"
    assert alerts[-1]["fields"]["Screenshot"] == "no"


@pytest.mark.anyio
async def test_feedback_validation(client):
    too_short = await client.post("/api/v1/feedback", data={"category": "BUG", "message": "  hi "}, headers=_h("student"))
    assert too_short.status_code == 422
    bad_category = await client.post("/api/v1/feedback", data={"category": "SPAM", "message": "Long enough text"}, headers=_h("student"))
    assert bad_category.status_code == 422
    anonymous = await client.post("/api/v1/feedback", data={"category": "BUG", "message": "Long enough text"})
    assert anonymous.status_code == 401
    not_image = await client.post(
        "/api/v1/feedback",
        data={"category": "BUG", "message": "Screenshot attached"},
        files={"screenshot": ("shot.png", b"<script>alert(1)</script>", "image/png")},
        headers=_h("student"),
    )
    assert not_image.status_code == 422
    assert "PNG, JPEG or WebP" in not_image.json()["detail"]


@pytest.mark.anyio
async def test_screenshot_is_reencoded_and_served_to_admins_only(client):
    res = await client.post(
        "/api/v1/feedback",
        data={"category": "CONTENT", "message": "Option C is cut off on my phone"},
        files={"screenshot": ("shot.png", _png(), "image/png")},
        headers=_h("student"),
    )
    assert res.status_code == 201, res.text
    fid = res.json()["id"]

    listing = (await client.get("/api/v1/admin/feedback?status=ALL", headers=_h("admin_open"))).json()
    item = next(i for i in listing["items"] if i["id"] == fid)
    assert item["has_screenshot"] is True
    assert item["user"]["name"] == "Feedback Student"

    shot = await client.get(f"/api/v1/admin/feedback/{fid}/screenshot", headers=_h("admin_feedback"))
    assert shot.status_code == 200
    assert shot.headers["content-type"] == "image/jpeg"
    assert Image.open(io.BytesIO(shot.content)).format == "JPEG"

    assert (await client.get(f"/api/v1/admin/feedback/{fid}/screenshot", headers=_h("student"))).status_code == 403


@pytest.mark.anyio
async def test_admin_section_permission(client):
    url = "/api/v1/admin/feedback"
    assert (await client.get(url, headers=_h("admin_open"))).status_code == 200
    assert (await client.get(url, headers=_h("admin_feedback"))).status_code == 200
    assert (await client.get(url, headers=_h("admin_other"))).status_code == 403
    assert (await client.get(url, headers=_h("student"))).status_code == 403


@pytest.mark.anyio
async def test_resolve_dismiss_reopen_and_summary(client):
    fid = (
        await client.post("/api/v1/feedback", data={"category": "IDEA", "message": "Dark mode please"}, headers=_h("student"))
    ).json()["id"]
    before = (await client.get("/api/v1/admin/feedback/summary", headers=_h("admin_open"))).json()["open"]

    res = await client.post(f"/api/v1/admin/feedback/{fid}/resolve", json={"note": "On the roadmap"}, headers=_h("admin_feedback"))
    assert res.json()["status"] == "RESOLVED"
    after = (await client.get("/api/v1/admin/feedback/summary", headers=_h("admin_open"))).json()["open"]
    assert after == before - 1

    resolved = (await client.get("/api/v1/admin/feedback?status=RESOLVED", headers=_h("admin_open"))).json()["items"]
    assert any(i["id"] == fid and i["admin_note"] == "On the roadmap" for i in resolved)

    assert (await client.post(f"/api/v1/admin/feedback/{fid}/reopen", headers=_h("admin_open"))).json()["status"] == "OPEN"
    assert (await client.post(f"/api/v1/admin/feedback/{fid}/dismiss", json={}, headers=_h("admin_open"))).json()["status"] == "DISMISSED"
    assert (await client.post("/api/v1/admin/feedback/999999/resolve", json={}, headers=_h("admin_open"))).status_code == 404


@pytest.mark.anyio
async def test_daily_limit_per_student(client):
    for n in range(feedback_router.DAILY_LIMIT):
        res = await client.post("/api/v1/feedback", data={"category": "OTHER", "message": f"Report number {n}"}, headers=_h("student2"))
        assert res.status_code == 201, res.text
    over = await client.post("/api/v1/feedback", data={"category": "OTHER", "message": "One too many"}, headers=_h("student2"))
    assert over.status_code == 429
    # Another student is not affected
    ok = await client.post("/api/v1/feedback", data={"category": "OTHER", "message": "Mine still works"}, headers=_h("student"))
    assert ok.status_code == 201


# ── Health and the 500 handler ───────────────────────────────────────────────

@pytest.mark.anyio
async def test_health_ok_and_db_down(client, monkeypatch):
    res = await client.get("/api/v1/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "database": "ok"}

    @asynccontextmanager
    async def broken(max_retries: int = 5):
        raise ConnectionError("db down")
        yield

    monkeypatch.setattr(db_session, "managed_async_session", broken)
    down = await client.get("/api/v1/health")
    assert down.status_code == 503
    assert down.json()["database"] == "unreachable"


async def _boom():
    raise RuntimeError("SELECT secret FROM internals")


if not any(getattr(r, "path", None) == "/api/v1/__test_boom" for r in app.routes):
    app.add_api_route("/api/v1/__test_boom", _boom)


@pytest.mark.anyio
async def test_500_hides_exception_text_in_production(client, monkeypatch):
    monkeypatch.setattr(server, "_IS_PRODUCTION", False)
    dev = await client.get("/api/v1/__test_boom")
    assert dev.status_code == 500
    assert "SELECT secret" in dev.json()["error"]

    monkeypatch.setattr(server, "_IS_PRODUCTION", True)
    prod = await client.get("/api/v1/__test_boom")
    assert prod.status_code == 500
    assert prod.json() == {"detail": "An internal server error occurred."}


# ── LLM daily budget ─────────────────────────────────────────────────────────

@pytest.fixture
def budget(monkeypatch, alerts):
    llm_budget._reset_for_tests()
    monkeypatch.setattr(db_session, "managed_async_session", _test_managed_session)
    yield
    llm_budget._reset_for_tests()


@pytest.mark.anyio
async def test_spend_counts_today_ist_only(budget, monkeypatch):
    async with _test_managed_session() as session:
        now = datetime.now(timezone.utc)
        session.add(LlmUsageEvent(feature="attempt_report", model="m", cost_inr=12.5, created_at=now))
        session.add(LlmUsageEvent(feature="translation", model="m", cost_inr=7.5, created_at=now))
        session.add(LlmUsageEvent(feature="attempt_report", model="m", cost_inr=500.0, created_at=now - timedelta(days=2)))
        await session.commit()
    assert await llm_budget.spent_today_inr() == pytest.approx(20.0, abs=0.01)


@pytest.mark.anyio
async def test_budget_off_by_default(budget, monkeypatch):
    monkeypatch.setattr(settings, "LLM_DAILY_BUDGET_INR", 0.0)

    async def huge():
        return 1_000_000.0

    monkeypatch.setattr(llm_budget, "spent_today_inr", huge)
    assert await llm_budget.report_llm_allowed() is True


@pytest.mark.anyio
async def test_budget_warns_at_80_and_stops_at_100_alerting_once(budget, monkeypatch, alerts):
    monkeypatch.setattr(settings, "LLM_DAILY_BUDGET_INR", 100.0)
    spend = {"v": 50.0}

    async def fake_spend():
        return spend["v"]

    monkeypatch.setattr(llm_budget, "spent_today_inr", fake_spend)

    assert await llm_budget.report_llm_allowed() is True
    assert alerts == []

    spend["v"] = 85.0
    assert await llm_budget.report_llm_allowed() is True
    assert await llm_budget.report_llm_allowed() is True
    assert [a["title"] for a in alerts] == ["LLM spend past 80% of today's budget"]

    spend["v"] = 100.0
    assert await llm_budget.report_llm_allowed() is False
    assert await llm_budget.report_llm_allowed() is False
    assert [a["title"] for a in alerts][-1] == "LLM daily budget used up"
    assert len(alerts) == 2


@pytest.mark.anyio
async def test_over_budget_report_uses_rule_based_insight_without_llm(budget, monkeypatch):
    from app.engine.report_ai_synthesizer import ReportAISynthesizer
    import app.llm.factory as factory

    monkeypatch.setattr(settings, "LLM_DAILY_BUDGET_INR", 10.0)

    async def over():
        return 25.0

    monkeypatch.setattr(llm_budget, "spent_today_inr", over)

    def no_llm(*args, **kwargs):
        raise AssertionError("LLM must not be called when the budget is used up")

    monkeypatch.setattr(factory, "get_vision_llm", no_llm)
    insight = await ReportAISynthesizer.generate_diagnostic_insight(
        {"user_id": 1, "name": "A"}, {"exam_id": 1, "attempt_id": 7}, {}
    )
    assert isinstance(insight, dict) and insight
