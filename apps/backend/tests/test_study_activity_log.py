"""Logging a study session used to crash on a non-existent StudyActivityType member."""
import pytest
from httpx import AsyncClient, ASGITransport
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import StaticPool

from app.fastapi_server import app
from app.cache import get_cache
from app.db.session import get_async_session
from app.db.models.user import User, UserRole, StudentProfile
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
            u = User(full_name="Logger", email="logger@study.test", role=UserRole.STUDENT, password_hash=get_password_hash("x"))
            session.add(u)
            await session.commit()
            await session.refresh(u)
            _state["uid"] = u.id
            session.add(StudentProfile(user_id=u.id))
            await session.commit()
        yield session


def _h() -> dict:
    return {"Authorization": f"Bearer {create_access_token(subject=_state['uid'], role='STUDENT')}"}


@pytest.fixture
async def client():
    app.dependency_overrides[get_async_session] = _override_session
    await get_cache().delete_pattern("*")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.get("/api/v1/exam-types")  # any DB-backed call triggers the seed
        await get_cache().delete_pattern("*")
        yield c
    await get_cache().delete_pattern("*")


@pytest.mark.anyio
@pytest.mark.parametrize(
    "sent, stored",
    [
        ("REVISION", "REVISION"),
        ("NEW_TOPIC", "NEW_TOPIC"),
        ("ANSWER_WRITING", "ANSWER_WRITING"),
        ("PYQ", "PYQ"),
        ("MOCK_TEST", "MOCK_TEST"),
        ("CURRENT_AFFAIRS", "CURRENT_AFFAIRS"),
        # names the planner / older clients send
        ("CONCEPT_REVISION", "REVISION"),
        ("NOTES_REVIEW", "REVISION"),
        ("PRACTICE_MCQS", "PYQ"),
        ("PYQ_SOLVING", "PYQ"),
        ("revision", "REVISION"),
        ("something unknown", "OTHER"),
        (None, "REVISION"),
    ],
)
async def test_log_study_session_accepts_every_activity_type(client, sent, stored):
    payload = {"subject": "Polity", "duration_minutes": 30, "confidence_rating": 4}
    if sent is not None:
        payload["activity_type"] = sent
    resp = await client.post("/api/v1/study-plan/activities", json=payload, headers=_h())
    assert resp.status_code == 200, resp.text
    assert resp.json()["duration_minutes"] == 30

    listed = (await client.get("/api/v1/study-plan/activities", headers=_h())).json()
    assert listed[0]["activity_type"] == stored


@pytest.mark.anyio
async def test_log_study_session_without_activity_type_defaults_to_revision(client):
    resp = await client.post("/api/v1/study-plan/activities", json={"subject": "History", "duration_minutes": 45}, headers=_h())
    assert resp.status_code == 200, resp.text


@pytest.mark.anyio
async def test_gamification_failure_does_not_fail_a_saved_log(client, monkeypatch):
    from app.services.gamification_service import GamificationService

    async def boom(self, user_id):
        raise RuntimeError("gamification down")

    monkeypatch.setattr(GamificationService, "check_and_update_daily_goal", boom)
    resp = await client.post("/api/v1/study-plan/activities", json={"subject": "Polity", "duration_minutes": 20}, headers=_h())
    assert resp.status_code == 200, resp.text
    assert resp.json()["gamification"]["daily_goal_met"] is False
    listed = (await client.get("/api/v1/study-plan/activities", headers=_h())).json()
    assert len(listed) >= 1  # the session was saved


@pytest.mark.anyio
async def test_logged_sessions_show_up_in_todays_log_immediately(client):
    """The dashboard's "Today's Study Log": it 500'd once any session existed (response fields were
    missing) and, once fixed, kept serving a stale cached list after logging."""
    today = lambda: client.get("/api/v1/analytics/activity/today", headers=_h())

    first_read = await today()  # primes the cache while the log is empty
    assert first_read.status_code == 200
    base = len(first_read.json())

    for minutes, subject in ((30, "Polity"), (45, "History")):
        logged = await client.post(
            "/api/v1/study-plan/activities",
            json={"subject": subject, "duration_minutes": minutes, "activity_type": "REVISION", "questions_attempted": 10},
            headers=_h(),
        )
        assert logged.status_code == 200, logged.text
        after = await today()
        assert after.status_code == 200, after.text
        rows = after.json()
        assert len(rows) == base + (1 if minutes == 30 else 2)
        assert rows[0]["subject"] == subject and rows[0]["duration_minutes"] == minutes  # newest first
        assert rows[0]["activity_type"] == "REVISION" and rows[0]["questions_attempted"] == 10

    # the other logging endpoint refreshes it too
    other = await client.post(
        "/api/v1/analytics/activity",
        json={"activity_type": "PYQ", "subject": "Economy", "duration_minutes": 15},
        headers=_h(),
    )
    assert other.status_code == 200, other.text
    assert (await today()).json()[0]["subject"] == "Economy"


@pytest.mark.anyio
async def test_weekly_schedule_shows_generated_and_deleted_tasks_immediately(client, monkeypatch):
    """The planner reads the (empty) weekly schedule, then generates the plan and reads it again.
    The second read used to serve the cached empty week, so the new plan didn't show for 5 minutes."""
    from sqlalchemy.orm import sessionmaker
    import app.routers.study_plan as study_plan

    monkeypatch.setattr(
        study_plan, "async_session_factory",
        sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False),
    )
    count = lambda sch: sum(len(d["tasks"]) for d in sch["days"])
    schedule = lambda: client.get("/api/v1/study-plan/weekly-schedule", headers=_h())

    assert count((await schedule()).json()) == 0  # primes the cache with an empty week

    generated = await client.post("/api/v1/study-plan/generate-weekly-plan", json={}, headers=_h())
    assert generated.status_code == 200, generated.text
    after = (await schedule()).json()
    assert count(after) == generated.json()["task_count"] > 0

    task_id = next(t["id"] for d in after["days"] for t in d["tasks"])
    assert (await client.delete(f"/api/v1/study-plan/tasks/{task_id}", headers=_h())).status_code == 200
    assert count((await schedule()).json()) == count(after) - 1

    # creating, editing and completing tasks show up straight away too
    tasks = lambda sch: [t for d in sch["days"] for t in d["tasks"]]
    before = count((await schedule()).json())
    created = await client.post(
        "/api/v1/study-plan/tasks", json={"title": "QA cache check task", "due_in_days": 0}, headers=_h()
    )
    assert created.status_code == 200, created.text
    new_id = created.json()["task_id"]
    assert count((await schedule()).json()) == before + 1

    edited = await client.put(f"/api/v1/study-plan/tasks/{new_id}", json={"title": "QA cache check renamed"}, headers=_h())
    assert edited.status_code == 200, edited.text
    assert any(t["title"] == "QA cache check renamed" for t in tasks((await schedule()).json()))

    done = await client.post(f"/api/v1/study-plan/tasks/{new_id}/complete", headers=_h())
    assert done.status_code == 200, done.text
    mine = next(t for t in tasks((await schedule()).json()) if str(t["id"]) == str(new_id))
    assert mine["is_completed"] is True
