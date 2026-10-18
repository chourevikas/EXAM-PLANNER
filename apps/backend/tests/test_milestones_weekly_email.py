"""Admin-managed milestones (badge + XP + notification once) and the student-scheduled weekly email."""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, select, func
from sqlmodel.ext.asyncio.session import AsyncSession

from app.fastapi_server import app
from app.cache import get_cache
from app.db.session import get_async_session
from app.db.models.user import User, UserRole, StudentProfile
from app.db.models.hierarchy import Exam
from app.db.models.analytics import ExamAttempt
from app.db.models.gamification import UserBadge, XPLog
from app.db.models.notification import UserNotification
from app.db.models.enums import AttemptStatus
from app.core.security import create_access_token, get_password_hash
from app.services import milestone_service, weekly_email_service

test_engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=False,
)
_session_factory = sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
_state: dict = {}


async def _override_session():
    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    async with AsyncSession(test_engine, expire_on_commit=False) as session:
        if not _state:
            await _seed(session)
        yield session


async def _seed(session: AsyncSession):
    exam = Exam(code="MS-2024", name="UPSC (2024) - Set A", source_year=2024)
    session.add(exam)
    await session.commit()
    await session.refresh(exam)
    ids = {}
    for name, role in (("tester", UserRole.STUDENT), ("newbie", UserRole.STUDENT), ("admin", UserRole.ADMIN)):
        u = User(full_name=name.title(), email=f"{name}@ms.test", role=role, password_hash=get_password_hash("x"))
        session.add(u)
        await session.commit()
        await session.refresh(u)
        ids[name] = (u.id, role.value)
        if role == UserRole.STUDENT:
            session.add(StudentProfile(user_id=u.id, target_exam="UPSC"))
    # "tester" has completed two tests
    for _ in range(2):
        session.add(ExamAttempt(user_id=ids["tester"][0], exam_id=exam.id, status=AttemptStatus.EVALUATED,
                                total_correct=3, submitted_at=datetime.now(timezone.utc)))
    await session.commit()
    _state.update(ids=ids)


def _h(who: str) -> dict:
    uid, role = _state["ids"][who]
    return {"Authorization": f"Bearer {create_access_token(subject=uid, role=role)}"}


@pytest.fixture
async def client(monkeypatch):
    app.dependency_overrides[get_async_session] = _override_session
    # background jobs open their own sessions
    monkeypatch.setattr("app.db.session.async_session_factory", _session_factory)
    await get_cache().delete_pattern("*")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.get("/api/v1/exam-types")  # any DB-backed call triggers the seed
        yield c
    app.dependency_overrides.pop(get_async_session, None)
    await get_cache().delete_pattern("*")


async def _count(model, **where) -> int:
    async with AsyncSession(test_engine) as s:
        stmt = select(func.count(model.id))
        for k, v in where.items():
            stmt = stmt.where(getattr(model, k) == v)
        return (await s.exec(stmt)).one()


@pytest.mark.anyio
async def test_admin_manages_milestones_and_qualifying_students_get_them(client):
    tester = _state["ids"]["tester"][0]
    base = "/api/v1/admin/milestones"
    assert (await client.get(base, headers=_h("tester"))).status_code == 403
    bad = await client.post(base, json={"name": "X", "description": "x", "criteria_type": "NOPE", "threshold": 1}, headers=_h("admin"))
    assert bad.status_code == 422

    created = await client.post(base, json={
        "name": "First Test", "description": "Completed your first test.", "criteria_type": "tests_completed",
        "threshold": 1, "xp_reward": 100,
    }, headers=_h("admin"))
    assert created.status_code == 201, created.text
    first_test = created.json()["id"]
    # saved -> students who already qualify get it (badge, +100 XP, notification), exactly once
    assert await _count(UserBadge, user_id=tester, badge_id=first_test) == 1
    assert await _count(XPLog, user_id=tester, ref_key=f"milestone:{first_test}") == 1
    assert await _count(UserNotification, user_id=tester, notification_type="MILESTONE") == 1
    async with _session_factory() as s:
        assert await milestone_service.check(s, tester) == []  # already unlocked
    assert await _count(UserBadge, user_id=_state["ids"]["newbie"][0]) == 0  # hasn't completed a test

    listing = (await client.get(base, headers=_h("admin"))).json()
    row = next(m for m in listing["milestones"] if m["id"] == first_test)
    assert (row["unlocked_count"], row["criteria_label"]) == (1, "Tests completed")

    # a milestone someone unlocked can't be deleted, only switched off
    assert (await client.delete(f"{base}/{first_test}", headers=_h("admin"))).status_code == 409

    # an inactive milestone is never awarded and hidden from students until switched on
    later = (await client.post(base, json={
        "name": "Five Tests", "description": "Completed five tests.", "criteria_type": "TESTS_COMPLETED",
        "threshold": 5, "is_active": False,
    }, headers=_h("admin"))).json()
    badges = (await client.get("/api/v1/study-plan/badges", headers=_h("tester"))).json()
    assert [b["name"] for b in badges["unlocked"]] == ["First Test"]
    assert all(b["name"] != "Five Tests" for b in badges["locked"])
    # switched on with a lower threshold: shows progress, and the tester (2 tests) now qualifies
    upd = await client.put(f"{base}/{later['id']}", json={
        "name": "Two Tests", "description": "Completed two tests.", "criteria_type": "TESTS_COMPLETED",
        "threshold": 2, "xp_reward": 50, "is_active": True,
    }, headers=_h("admin"))
    assert upd.status_code == 200
    assert await _count(UserBadge, user_id=tester, badge_id=later["id"]) == 1
    newbie_badges = (await client.get("/api/v1/study-plan/badges", headers=_h("newbie"))).json()
    two = next(b for b in newbie_badges["locked"] if b["name"] == "Two Tests")
    assert two["milestone"] == {"criteria_type": "TESTS_COMPLETED", "criteria_label": "Tests completed",
                                "threshold": 2, "progress": 0, "xp_reward": 50}

    unused = (await client.post(base, json={"name": "Big", "description": "b", "criteria_type": "XP_EARNED", "threshold": 99999}, headers=_h("admin"))).json()
    assert (await client.delete(f"{base}/{unused['id']}", headers=_h("admin"))).status_code == 204


@pytest.mark.anyio
async def test_weekly_email_goes_out_on_the_chosen_slot_once(client, monkeypatch):
    sent = []

    async def fake_send(email, name, summary, link):
        sent.append((email, summary, link))
        return True

    monkeypatch.setattr("app.services.email_service.send_weekly_summary_email", fake_send)

    assert (await client.patch("/api/v1/auth/me", json={"weekly_email_day": 7}, headers=_h("tester"))).status_code == 422
    ok = await client.patch("/api/v1/auth/me", json={"weekly_email_enabled": True, "weekly_email_day": 0, "weekly_email_hour": 9}, headers=_h("tester"))
    assert ok.status_code == 200
    assert (ok.json()["weekly_email_enabled"], ok.json()["weekly_email_day"], ok.json()["weekly_email_hour"]) == (True, 0, 9)

    monday_9_ist = datetime(2026, 10, 19, 9, 15, tzinfo=ZoneInfo("Asia/Kolkata")).astimezone(timezone.utc)
    monday_10_ist = datetime(2026, 10, 19, 10, 15, tzinfo=ZoneInfo("Asia/Kolkata")).astimezone(timezone.utc)
    assert await weekly_email_service.run_weekly_email_dispatch(monday_10_ist) == 0  # not their hour
    assert await weekly_email_service.run_weekly_email_dispatch(monday_9_ist) == 1
    assert await weekly_email_service.run_weekly_email_dispatch(monday_9_ist) == 0  # never twice
    email, summary, link = sent[0]
    assert email == "tester@ms.test" and {"questions", "accuracy", "tests", "xp", "streak", "milestones"} <= summary.keys()

    # the link unsubscribes without signing in; a forged token doesn't
    token = link.split("token=")[1]
    assert (await client.get("/api/v1/notifications/weekly-email/unsubscribe", params={"token": "x" * 40})).status_code == 400
    res = await client.get("/api/v1/notifications/weekly-email/unsubscribe", params={"token": token})
    assert res.status_code == 200 and "get the weekly summary email any more" in res.text
    me = (await client.get("/api/v1/auth/me", headers=_h("tester"))).json()
    assert me["weekly_email_enabled"] is False
