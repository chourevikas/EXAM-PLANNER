"""Study plan built from the student's data (weekly and monthly), instead of the fixed UPSC template."""
from datetime import date, datetime, time, timedelta, timezone

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.fastapi_server import app
from app.cache import get_cache
from app.db.session import get_async_session
from app.db.models.user import User, UserRole, StudentProfile, SubscriptionTier
from app.db.models.hierarchy import Exam, Subject, Topic, Subtopic, SyllabusVersion
from app.db.models.question import Question
from app.db.models.analytics import PracticeAnswer, UserMemoryState
from app.db.models.study_plan import StudyTask
from app.db.models.enums import QuestionStatus, QuestionSourceType
from app.core.security import create_access_token, get_password_hash
from app.services import study_plan_generator as gen
from app.services.free_plan import IST

test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
_state: dict = {}
MONDAY = date(2026, 10, 19)


async def _override_session():
    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    async with AsyncSession(test_engine, expire_on_commit=False) as session:
        if not _state:
            await _seed(session)
        yield session


async def _add(session, obj):
    session.add(obj)
    await session.commit()
    await session.refresh(obj)
    return obj


async def _seed(session: AsyncSession):
    exam = await _add(session, Exam(code="SP-1", name="UPSC 2024", source_year=2024, exam_type=QuestionSourceType.PYQ, is_active=True))
    version = await _add(session, SyllabusVersion(exam_id=exam.id, version_code="v1"))
    history = await _add(session, Subject(name="History", code="HIS", version_id=version.id))
    economy = await _add(session, Subject(name="Economy", code="ECO", version_id=version.id))
    ancient = await _add(session, Topic(name="Ancient", code="ANC", subject_id=history.id))
    banking = await _add(session, Topic(name="Banking", code="BNK", subject_id=economy.id))
    subs = {}
    for name, topic, n_questions in (("Indus Valley", ancient, 4), ("Vedic Age", ancient, 3),
                                     ("RBI", banking, 6), ("NPA", banking, 2), ("Empty", banking, 0)):
        sub = await _add(session, Subtopic(name=name, code=name[:3].upper(), topic_id=topic.id))
        subs[name] = (sub.id, [])
        for i in range(n_questions):
            q = await _add(session, Question(exam_id=exam.id, question_number_in_paper=len(_state) * 10 + i + 1 + sub.id * 100,
                                             status=QuestionStatus.PUBLISHED, subtopic_id=sub.id))
            subs[name][1].append(q.id)
    me = await _add(session, User(full_name="Me", email="me@sp.test", role=UserRole.STUDENT, password_hash=get_password_hash("x")))
    fresh = await _add(session, User(full_name="New", email="new@sp.test", role=UserRole.STUDENT, password_hash=get_password_hash("x")))
    session.add_all([StudentProfile(user_id=me.id, subscription_tier=SubscriptionTier.PREMIUM, weekly_hours="14"),
                     StudentProfile(user_id=fresh.id, subscription_tier=SubscriptionTier.FREE)])
    # Indus Valley: 1 of 4 right (weak). Vedic Age: 3 of 3 (strong). RBI and NPA never tried.
    for i, qid in enumerate(subs["Indus Valley"][1]):
        session.add(PracticeAnswer(user_id=me.id, question_id=qid, is_correct=i == 0))
    for qid in subs["Vedic Age"][1]:
        session.add(PracticeAnswer(user_id=me.id, question_id=qid, is_correct=True))
    # Two Vedic Age questions due for revision on Wednesday (IST)
    wednesday_noon = datetime.combine(MONDAY + timedelta(days=2), time(12), tzinfo=IST).astimezone(timezone.utc)
    for qid in subs["Vedic Age"][1][:2]:
        session.add(UserMemoryState(user_id=me.id, question_id=qid, next_scheduled_review=wednesday_noon))
    await session.commit()
    _state.update(me=me.id, fresh=fresh.id, subs={k: v[0] for k, v in subs.items()})


@pytest.fixture
async def client():
    app.dependency_overrides[get_async_session] = _override_session
    await get_cache().delete_pattern("*")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.get("/api/v1/exam-types")
        yield c
    app.dependency_overrides.pop(get_async_session, None)


def _h(user="me") -> dict:
    return {"Authorization": f"Bearer {create_access_token(subject=_state[user], role='STUDENT')}"}


def test_daily_minutes_from_weekly_hours():
    assert gen.daily_minutes("14") == 120
    assert gen.daily_minutes("35") == 300
    assert gen.daily_minutes(None) == gen.daily_minutes("abc") == gen.daily_minutes("0") == 120
    assert gen.daily_minutes("1") == 30 and gen.daily_minutes("100") == 480


@pytest.mark.anyio
async def test_week_comes_from_the_students_results(client):
    async with AsyncSession(test_engine, expire_on_commit=False) as s:
        plan = await gen.build_plan(s, _state["me"], MONDAY, MONDAY + timedelta(days=6), today=MONDAY)
    by_day = {}
    for t in plan:
        by_day.setdefault(t["scheduled_date"], []).append(t)
    assert set(by_day) == {MONDAY + timedelta(days=i) for i in range(7)}
    for tasks in by_day.values():  # within the 2-hour daily budget, each subtopic once a day
        assert sum(t["allocated_time_minutes"] for t in tasks) <= 120
        subtopics = [t["subtopic"] for t in tasks if t["activity_type"] in ("PRACTICE_MCQS", "NEW_TOPIC")]
        assert len(subtopics) == len(set(subtopics))

    monday = by_day[MONDAY]
    assert monday[0]["title"] == "Strengthen Indus Valley" and "1 of 4 right" in monday[0]["description"]
    # New subtopics, most questions first; a subtopic without questions is never planned
    assert [t["title"] for t in monday[1:3]] == ["Learn RBI (Banking)", "Solve PYQs: RBI"]
    assert not any("Empty" in t["title"] for t in plan)
    assert not any(t["subtopic"] == "Vedic Age" and t["activity_type"] == "PRACTICE_MCQS" for t in plan)  # strong

    wednesday = by_day[MONDAY + timedelta(days=2)]
    assert wednesday[0]["title"] == "Revise 2 questions due today" and wednesday[0]["activity_type"] == "CONCEPT_REVISION"
    sunday = by_day[MONDAY + timedelta(days=6)]
    assert sunday[0]["activity_type"] == "MOCK_TEST" and sunday[0]["title"] == "Subject-wise test: History"


@pytest.mark.anyio
async def test_month_ends_with_consolidation(client):
    first, last = date(2026, 11, 1), date(2026, 11, 30)
    async with AsyncSession(test_engine, expire_on_commit=False) as s:
        plan = await gen.build_plan(s, _state["me"], first, last, today=first, monthly=True)
    last_week = [t for t in plan if t["scheduled_date"] >= last - timedelta(days=6)]
    assert not any(t["activity_type"] == "NEW_TOPIC" or t["title"].startswith("Solve PYQs") for t in last_week)
    # After the weak subtopic: revise what's already practised (Vedic Age), then mixed PYQs
    monday = [t["title"] for t in last_week if t["scheduled_date"] == date(2026, 11, 24)]
    assert monday == ["Strengthen Indus Valley", "Revise Vedic Age", "Mixed PYQs from all subjects"]
    tests = {t["scheduled_date"] for t in last_week if t["activity_type"] == "MOCK_TEST"}
    assert tests == {date(2026, 11, 25), date(2026, 11, 29)}  # Wednesday and Sunday: full papers
    assert all(t["title"] == "Full paper under exam conditions" for t in last_week if t["activity_type"] == "MOCK_TEST")
    # Past days are never planned
    assert {t["scheduled_date"] for t in await _plan_from(date(2026, 11, 20), first, last)} >= {date(2026, 11, 20)}
    assert min(t["scheduled_date"] for t in await _plan_from(date(2026, 11, 20), first, last)) == date(2026, 11, 20)


async def _plan_from(today, first, last):
    async with AsyncSession(test_engine, expire_on_commit=False) as s:
        return await gen.build_plan(s, _state["me"], first, last, today=today, monthly=True)


@pytest.mark.anyio
async def test_generate_keeps_own_and_completed_tasks_and_month_view(client, monkeypatch):
    import app.routers.study_plan as study_plan

    today = datetime.now(timezone.utc).astimezone(IST).date()
    month = today.strftime("%Y-%m")
    async with AsyncSession(test_engine, expire_on_commit=False) as s:
        mine = await _add(s, StudyTask(user_id=_state["me"], title="My own notes", scheduled_date=today, is_ai_recommended=False))
        done = await _add(s, StudyTask(user_id=_state["me"], title="Old generated, done", scheduled_date=today,
                                       is_ai_recommended=True, is_completed=True))
        stale = await _add(s, StudyTask(user_id=_state["me"], title="Polity: Preamble", scheduled_date=today, is_ai_recommended=True))

    res = await client.post("/api/v1/study-plan/generate-monthly-plan", json={"month": month}, headers=_h())
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["task_count"] > 0 and body["start_date"].startswith(month)

    async with AsyncSession(test_engine) as s:
        titles = set((await s.exec(select(StudyTask.title).where(StudyTask.user_id == _state["me"]))).all())
    assert {mine.title, done.title} <= titles and stale.title not in titles

    view = (await client.get("/api/v1/study-plan/monthly-schedule", params={"month": month}, headers=_h())).json()
    assert view["month"] == month and view["days"][0]["date"] == f"{month}-01"
    assert sum(d["total_tasks_count"] for d in view["days"]) == body["task_count"] + 2
    assert next(d for d in view["days"] if d["is_today"])["date"] == str(today)

    # Regenerating replaces the open generated tasks rather than adding a second copy
    again = await client.post("/api/v1/study-plan/generate-monthly-plan", json={"month": month}, headers=_h())
    view2 = (await client.get("/api/v1/study-plan/monthly-schedule", params={"month": month}, headers=_h())).json()
    assert sum(d["total_tasks_count"] for d in view2["days"]) == again.json()["task_count"] + 2

    assert (await client.post("/api/v1/study-plan/generate-monthly-plan", json={"month": "2020-01"}, headers=_h())).status_code == 422
    assert (await client.get("/api/v1/study-plan/monthly-schedule", params={"month": "Nov"}, headers=_h())).status_code == 422


@pytest.mark.anyio
async def test_new_student_still_gets_a_plan(client):
    today = datetime.now(timezone.utc).date()
    next_monday = today + timedelta(days=7 - today.weekday())
    res = await client.post("/api/v1/study-plan/generate-weekly-plan", json={"start_date": str(next_monday)}, headers=_h("fresh"))
    assert res.status_code == 200 and res.json()["task_count"] > 0
    async with AsyncSession(test_engine) as s:
        titles = set((await s.exec(select(StudyTask.title).where(StudyTask.user_id == _state["fresh"]))).all())
    # Nothing tried yet: new subtopics from the bank; no UPSC template titles
    assert "Learn RBI (Banking)" in titles and not any(t.startswith("Polity:") for t in titles)
