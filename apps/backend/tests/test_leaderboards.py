"""Real XP ledger, leaderboard profile fields, and daily national/state leaderboards."""
from datetime import date, datetime, timedelta, timezone

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, select, func
from sqlmodel.ext.asyncio.session import AsyncSession

from app.fastapi_server import app
from app.cache import get_cache
from app.db.session import get_async_session
from app.db.models.user import User, UserRole, StudentProfile
from app.db.models.hierarchy import Exam
from app.db.models.question import Question, QuestionOption
from app.db.models.analytics import ExamAttempt
from app.db.models.gamification import XPLog, LeaderboardSnapshot
from app.db.models.enums import AttemptStatus, QuestionStatus
from app.core.security import create_access_token, get_password_hash
from app.services import xp_service, leaderboard_service

UPSC, MPSC = "UPSC Civil Services Examination", "MPSC Rajyaseva"

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
    exam = Exam(code="LB-2024", name="UPSC (2024) - Set A", source_year=2024)
    session.add(exam)
    await session.commit()
    await session.refresh(exam)
    q = Question(exam_id=exam.id, question_number_in_paper=1, status=QuestionStatus.PUBLISHED)
    session.add(q)
    await session.commit()
    await session.refresh(q)
    right = QuestionOption(question_id=q.id, option_label="A", display_order=1, is_correct=True)
    wrong = QuestionOption(question_id=q.id, option_label="B", display_order=2)
    session.add(right)
    session.add(wrong)
    await session.commit()
    await session.refresh(right)
    await session.refresh(wrong)

    # name, target exam, state, xp, correct answers (in one submitted test)
    people = [
        ("Asha Rao", UPSC, "Maharashtra", 900, 30),
        ("Bala Iyer", UPSC, "Tamil Nadu", 900, 40),      # same XP as Asha, more correct -> ahead
        ("Chitra Das", UPSC, "Maharashtra", 500, 20),
        ("Dev Patel", UPSC, None, 300, 5),               # no state: national only
        ("Esha Khan", UPSC, "Maharashtra", 1000, 0),     # no correct answers: not ranked
        ("Farid Ali", MPSC, "Maharashtra", 2000, 50),    # other exam
        ("Gita Sen", UPSC, "Delhi", 0, 0),               # the viewer used for XP/profile tests
    ]
    ids = {}
    for name, target, st, xp, correct in people:
        u = User(full_name=name, email=f"{name.split()[0].lower()}@lb.test", role=UserRole.STUDENT, password_hash=get_password_hash("x"))
        session.add(u)
        await session.commit()
        await session.refresh(u)
        session.add(StudentProfile(user_id=u.id, target_exam=target, state=st, total_xp=xp))
        if correct:
            session.add(ExamAttempt(user_id=u.id, exam_id=exam.id, status=AttemptStatus.EVALUATED, total_correct=correct,
                                    submitted_at=datetime.now(timezone.utc)))
        await session.commit()
        ids[name.split()[0].lower()] = u.id
    _state.update(ids=ids, exam=exam.id, question=q.id, right=right.id, wrong=wrong.id)


def _h(who: str) -> dict:
    return {"Authorization": f"Bearer {create_access_token(subject=_state['ids'][who], role='STUDENT')}"}


@pytest.fixture
async def client():
    app.dependency_overrides[get_async_session] = _override_session
    await get_cache().delete_pattern("*")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.get("/api/v1/exam-types")  # any DB-backed call triggers the seed
        yield c
    app.dependency_overrides.pop(get_async_session, None)
    await get_cache().delete_pattern("*")


async def _xp(user: str) -> int:
    async with AsyncSession(test_engine) as s:
        return (await s.exec(select(StudentProfile.total_xp).where(StudentProfile.user_id == _state["ids"][user]))).one()


@pytest.mark.anyio
async def test_xp_awards_are_paid_once(client):
    uid = _state["ids"]["gita"]
    async with AsyncSession(test_engine, expire_on_commit=False) as s:
        await xp_service.award_test_completion(s, uid, attempt_id=9001, correct=3, submitted_at=datetime.now(timezone.utc))
    assert await _xp("gita") == 50 + 3 * 10 + 20
    async with AsyncSession(test_engine, expire_on_commit=False) as s:
        await xp_service.award_test_completion(s, uid, attempt_id=9001, correct=3, submitted_at=datetime.now(timezone.utc))
    assert await _xp("gita") == 100  # same attempt again: nothing added

    # a correct practice answer: +10, and today's active-day bonus was already paid
    res = await client.post("/api/v1/practice/answers", json={"question_id": _state["question"], "selected_option_id": _state["right"]}, headers=_h("gita"))
    assert res.status_code == 200 and res.json()["counted"] is True
    assert await _xp("gita") == 110

    async with AsyncSession(test_engine) as s:
        ledger = (await s.exec(select(func.sum(XPLog.amount)).where(XPLog.user_id == uid))).one()
    assert ledger == 110
    # /auth/me shows the ledger, not "questions attempted x 10"
    me = (await client.get("/api/v1/auth/me", headers=_h("gita"))).json()
    assert (me["total_xp"], me["level"]) == (110, 1)


@pytest.mark.anyio
async def test_username_state_and_display_rules(client):
    assert (await client.patch("/api/v1/auth/me", json={"username": "Bad Name!"}, headers=_h("asha"))).status_code == 400
    ok = await client.patch("/api/v1/auth/me", json={"username": "Asha_R", "leaderboard_display": "name"}, headers=_h("asha"))
    assert ok.status_code == 200, ok.text
    assert (ok.json()["username"], ok.json()["leaderboard_display"]) == ("asha_r", "NAME")
    # taken by someone else -> 409; availability endpoint agrees
    assert (await client.patch("/api/v1/auth/me", json={"username": "asha_r"}, headers=_h("bala"))).status_code == 409
    avail = (await client.get("/api/v1/users/username-available", params={"u": "ASHA_R"}, headers=_h("bala"))).json()
    assert avail["available"] is False
    assert (await client.get("/api/v1/users/username-available", params={"u": "asha_r"}, headers=_h("asha"))).json()["available"] is True
    # usernames can change when the new one is free
    assert (await client.patch("/api/v1/auth/me", json={"username": "bala_i"}, headers=_h("bala"))).status_code == 200
    assert (await client.patch("/api/v1/auth/me", json={"state": "Atlantis"}, headers=_h("bala"))).status_code == 400
    assert (await client.patch("/api/v1/auth/me", json={"leaderboard_display": "NICK"}, headers=_h("bala"))).status_code == 400


@pytest.mark.anyio
async def test_daily_leaderboards_national_state_and_change(client):
    ids = _state["ids"]
    yesterday = date.today() - timedelta(days=1)
    async with AsyncSession(test_engine, expire_on_commit=False) as s:
        # yesterday: Chitra was first nationally
        await s.exec(select(LeaderboardSnapshot))  # warm
        s.add(LeaderboardSnapshot(snapshot_date=yesterday, user_id=ids["chitra"], exam=UPSC, state="Maharashtra",
                                  xp=500, correct_answers=20, rank_national=1, rank_state=1))
        s.add(LeaderboardSnapshot(snapshot_date=yesterday, user_id=ids["bala"], exam=UPSC, state="Tamil Nadu",
                                  xp=400, correct_answers=10, rank_national=2, rank_state=1))
        await s.commit()
        ranked = await leaderboard_service.refresh(s, date.today())
    assert ranked == 6  # everyone with a correct answer and a target exam (Esha has none)

    national = (await client.get("/api/v1/leaderboard", headers=_h("chitra"))).json()
    assert national["exam"] == UPSC and national["total"] == 5
    order = [(r["rank"], r["xp"], r["correct_answers"]) for r in national["rows"]]
    assert order == [(1, 900, 40), (2, 900, 30), (3, 500, 20), (4, 300, 5), (5, 110, 1)]  # Gita: 1 correct practice answer
    # names follow each student's choice; Asha chose NAME, Bala has a username, Dev has neither
    names = [r["name"] for r in national["rows"]]
    assert names[:4] == ["bala_i", "Asha Rao", "Chitra D.", "Dev P."]
    assert national["me"]["rank"] == 3 and national["me"]["is_me"] is True
    assert national["me"]["rank_change"] == -2  # 1st yesterday, 3rd today
    assert national["rows"][0]["rank_change"] == 1  # Bala: 2nd -> 1st
    assert national["exams"] == [MPSC, UPSC]

    state = (await client.get("/api/v1/leaderboard", params={"scope": "state"}, headers=_h("chitra"))).json()
    assert state["state"] == "Maharashtra"
    assert [(r["rank"], r["name"]) for r in state["rows"]] == [(1, "Asha Rao"), (2, "Chitra D.")]

    other = (await client.get("/api/v1/leaderboard", params={"exam": MPSC}, headers=_h("chitra"))).json()
    assert [r["name"] for r in other["rows"]] == ["Farid A."] and other["me"] is None

    # no state set: the state view is empty and the page is told why
    dev = (await client.get("/api/v1/leaderboard", params={"scope": "state"}, headers=_h("dev"))).json()
    assert dev["rows"] == [] and dev["profile_incomplete"] == {"state": True, "username": True}

    # refreshing the same day replaces, never duplicates
    async with AsyncSession(test_engine, expire_on_commit=False) as s:
        await leaderboard_service.refresh(s, date.today())
        count = (await s.exec(select(func.count(LeaderboardSnapshot.id)).where(LeaderboardSnapshot.snapshot_date == date.today()))).one()
    assert count == 6


@pytest.mark.anyio
async def test_setting_a_state_joins_that_ranking_straight_away(client):
    async with AsyncSession(test_engine, expire_on_commit=False) as s:
        await leaderboard_service.refresh(s, date.today())
    # Dev had no state at snapshot time; he sets it now
    assert (await client.patch("/api/v1/auth/me", json={"state": "Maharashtra"}, headers=_h("dev"))).status_code == 200
    board = (await client.get("/api/v1/leaderboard", params={"scope": "state"}, headers=_h("dev"))).json()
    # same day's order (national ranks 2, 3, 4), renumbered within the state
    assert [(r["rank"], r["xp"]) for r in board["rows"]] == [(1, 900), (2, 500), (3, 300)]
    assert board["total"] == 3 and board["me"]["rank"] == 3
