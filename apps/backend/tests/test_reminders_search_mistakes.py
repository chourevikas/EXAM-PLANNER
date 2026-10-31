"""Reminder settings and reminders, full-text question search, and the mistake notebook."""
from datetime import datetime, timedelta, timezone

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
from app.db.models.question import Question, QuestionOption, QuestionTranslation
from app.db.models.analytics import ExamAttempt, ExamQuestionResponse, PracticeAnswer, UserMemoryState
from app.db.models.current_affairs import CurrentAffair
from app.db.models.notification import UserNotification
from app.db.models.enums import AttemptStatus, ExamStatus, QuestionStatus, QuestionSourceType, LanguageCode
from app.core.security import create_access_token, get_password_hash
from app.services import reminder_service, revision_service
from app.services.free_plan import IST

test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
_state: dict = {}
NOW = datetime.now(timezone.utc)
TODAY_IST = NOW.astimezone(IST).weekday()


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
    pyq = dict(exam_type=QuestionSourceType.PYQ, status=ExamStatus.PUBLISHED, is_active=True)
    exam = await _add(session, Exam(code="RS-1", name="UPSC 2024", source_year=2024, **pyq))
    other = await _add(session, Exam(code="RS-2", name="MPSC 2023", source_year=2023, **pyq))
    version = await _add(session, SyllabusVersion(exam_id=exam.id, version_code="v1"))
    subject = await _add(session, Subject(name="History", code="HIS", version_id=version.id))
    topic = await _add(session, Topic(name="Ancient", code="ANC", subject_id=subject.id))
    sub = await _add(session, Subtopic(name="Indus Valley", code="IVC", topic_id=topic.id))
    qs = {}
    for n in range(1, 7):
        q = await _add(session, Question(exam_id=exam.id, question_number_in_paper=n, status=QuestionStatus.PUBLISHED,
                                         subtopic_id=sub.id, source_year=2024))
        text = "संविधान की प्रस्तावना" if n == 6 else f"Indus Valley seal number {n} found at Harappa"
        session.add(QuestionTranslation(question_id=q.id, language=LanguageCode.HINDI if n == 6 else LanguageCode.ENGLISH,
                                        question_text=text))
        right = await _add(session, QuestionOption(question_id=q.id, option_label="A", display_order=1, is_correct=True))
        wrong = await _add(session, QuestionOption(question_id=q.id, option_label="B", display_order=2, is_correct=False))
        qs[n] = (q.id, right.id, wrong.id)

    def student(name):
        return User(full_name=name, email=f"{name.lower()}@rs.test", role=UserRole.STUDENT, password_hash=get_password_hash("x"))

    me, free, idle = (await _add(session, student("Me")), await _add(session, student("Free")), await _add(session, student("Idle")))
    admin = await _add(session, User(full_name="Admin", email="admin@rs.test", role=UserRole.ADMIN, password_hash=get_password_hash("x")))
    session.add_all([
        StudentProfile(user_id=me.id, subscription_tier=SubscriptionTier.PREMIUM, notify_full_paper_day=TODAY_IST),
        StudentProfile(user_id=free.id, subscription_tier=SubscriptionTier.FREE, notify_full_paper_day=TODAY_IST,
                       notify_current_affairs=False),
        StudentProfile(user_id=idle.id, subscription_tier=SubscriptionTier.PREMIUM, notify_full_paper_day=(TODAY_IST + 1) % 7),
    ])

    # A submitted test: Q1 wrong, Q2 wrong, Q3 right, Q4 left blank
    done = await _add(session, ExamAttempt(user_id=me.id, exam_id=exam.id, status=AttemptStatus.SUBMITTED,
                                           started_at=NOW - timedelta(days=3), submitted_at=NOW - timedelta(days=3)))
    at = NOW - timedelta(days=3)
    session.add_all([
        ExamQuestionResponse(attempt_id=done.id, question_id=qs[1][0], selected_option_id=qs[1][2], is_correct=False, answered_at=at),
        ExamQuestionResponse(attempt_id=done.id, question_id=qs[2][0], selected_option_id=qs[2][2], is_correct=False, answered_at=at),
        ExamQuestionResponse(attempt_id=done.id, question_id=qs[3][0], selected_option_id=qs[3][1], is_correct=True, answered_at=at),
        ExamQuestionResponse(attempt_id=done.id, question_id=qs[4][0], selected_option_id=None, is_correct=False),
    ])
    # A test still in progress: its wrong answer doesn't count yet
    open_attempt = await _add(session, ExamAttempt(user_id=me.id, exam_id=exam.id, status=AttemptStatus.IN_PROGRESS))
    session.add(ExamQuestionResponse(attempt_id=open_attempt.id, question_id=qs[5][0], selected_option_id=qs[5][2],
                                     is_correct=False, answered_at=NOW))
    # Practice: Q1 wrong again, Q2 now right (fixed), Q3 now wrong
    session.add_all([
        PracticeAnswer(user_id=me.id, question_id=qs[1][0], selected_option_id=qs[1][2], is_correct=False, answered_at=NOW - timedelta(days=1)),
        PracticeAnswer(user_id=me.id, question_id=qs[2][0], selected_option_id=qs[2][1], is_correct=True, answered_at=NOW - timedelta(days=1)),
        PracticeAnswer(user_id=me.id, question_id=qs[3][0], selected_option_id=qs[3][2], is_correct=False, answered_at=NOW - timedelta(days=1)),
    ])
    session.add_all([
        CurrentAffair(title="New dam inaugurated", content="...", is_published=True, created_at=NOW - timedelta(hours=2), updated_at=NOW - timedelta(hours=2)),
        CurrentAffair(title="Draft item", content="...", is_published=False, created_at=NOW - timedelta(hours=1), updated_at=NOW - timedelta(hours=1)),
        CurrentAffair(title="Old news", content="...", is_published=True, created_at=NOW - timedelta(days=3), updated_at=NOW - timedelta(days=3)),
    ])
    session.add(UserMemoryState(user_id=me.id, question_id=qs[1][0], subtopic_id=sub.id, next_scheduled_review=NOW - timedelta(days=1)))
    await session.commit()
    _state.update(qs=qs, me=me.id, free=free.id, idle=idle.id, admin=admin.id, exam=exam.id, other=other.id)


@pytest.fixture
async def client():
    app.dependency_overrides[get_async_session] = _override_session
    await get_cache().delete_pattern("*")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.get("/api/v1/exam-types")
        yield c
    app.dependency_overrides.pop(get_async_session, None)


def _h(who: str = "me", role: str = "STUDENT") -> dict:
    return {"Authorization": f"Bearer {create_access_token(subject=_state[who], role=role)}"}


# ── Settings ────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_notification_settings_read_and_update(client):
    res = await client.get("/api/v1/notifications/settings", headers=_h())
    assert res.status_code == 200, res.text
    assert res.json()["notify_weak_topic"] is True and res.json()["notify_full_paper_day"] == TODAY_IST

    res = await client.put("/api/v1/notifications/settings", json={"notify_revision": False, "weekly_email_enabled": True, "weekly_email_hour": 7}, headers=_h())
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["notify_revision"] is False and body["weekly_email_enabled"] is True and body["weekly_email_hour"] == 7
    assert body["notify_weak_topic"] is True  # untouched

    assert (await client.put("/api/v1/notifications/settings", json={"notify_full_paper_day": 7}, headers=_h())).status_code == 422
    assert (await client.put("/api/v1/notifications/settings", json={"notify_revision": True}, headers=_h("admin", "ADMIN"))).status_code == 403
    # /settings isn't mistaken for a notification id
    assert (await client.get("/api/v1/notifications", headers=_h())).status_code == 200


# ── Reminders ───────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_reminders_respect_settings_and_send_once(client):
    await client.get("/api/v1/notifications/settings", headers=_h())  # seeds the database
    async with AsyncSession(test_engine, expire_on_commit=False) as s:
        # Revision: 'me' turned it off in the settings test above
        seven_am = datetime.combine(NOW.astimezone(IST).date(), datetime.min.time(), tzinfo=IST).replace(hour=7, minute=5).astimezone(timezone.utc)
        assert await revision_service.send_daily_reminders(s, seven_am) == 0

        # Weak topic: 'me' got 2 of 6 right in Indus Valley over the last 30 days
        assert await reminder_service.send_weak_topic_reminders(s, NOW) == 1
        assert await reminder_service.send_weak_topic_reminders(s, NOW) == 0
        weak = (await s.exec(select(UserNotification).where(UserNotification.notification_type == "WEAK_TOPIC"))).one()
        assert weak.user_id == _state["me"] and "Indus Valley" in weak.title and "33%" in weak.message
        assert weak.action_url == "/practice-exam?subject=History&topic=Ancient&subtopic=Indus+Valley"

        # Current affairs: only the item published in the last day; 'free' turned it off
        assert await reminder_service.send_current_affairs_reminders(s, NOW) == 2  # me + idle
        assert await reminder_service.send_current_affairs_reminders(s, NOW) == 0
        ca = (await s.exec(select(UserNotification).where(UserNotification.notification_type == "CURRENT_AFFAIRS"))).all()
        assert {n.user_id for n in ca} == {_state["me"], _state["idle"]}
        assert ca[0].title == "1 new current affairs update" and ca[0].action_url.startswith("/learn/current-affairs/")

        # Full paper: on the chosen day only; 'me' already attempted the 2024 paper so gets the 2023 one
        assert await reminder_service.send_full_paper_reminders(s, NOW) == 2  # me + free; idle's day is tomorrow
        assert await reminder_service.send_full_paper_reminders(s, NOW) == 0
        papers = {n.user_id: n.action_url for n in (await s.exec(
            select(UserNotification).where(UserNotification.notification_type == "FULL_PAPER"))).all()}
        assert papers == {_state["me"]: f"/exam/{_state['other']}?type=PYQ", _state["free"]: f"/exam/{_state['exam']}?type=PYQ"}


# ── Search ──────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_question_search_and_search_practice(client):
    res = await client.get("/api/v1/search", params={"q": "seal number"})
    assert res.status_code == 200, res.text
    found = res.json()["questions"]
    assert len(found) == 6 - 1 and all(r["type"] == "UPSC 2024" for r in found)  # Q6 is Hindi only
    assert found[0]["url"].startswith("/practice-exam?source=search&q=seal+number&start=")

    hindi = (await client.get("/api/v1/search", params={"q": "संविधान"})).json()["questions"]
    assert [int(r["id"]) for r in hindi] == [_state["qs"][6][0]]
    assert (await client.get("/api/v1/search", params={"q": "ab"})).json()["questions"] == []  # too short

    q3 = _state["qs"][3][0]
    res = await client.get("/api/v1/search/questions/practice", params={"q": "seal number", "start": q3}, headers=_h())
    assert res.status_code == 200, res.text
    ids = [int(i["question_id"]) for i in res.json()["items"]]
    assert ids[0] == q3 and len(ids) == 5
    assert (await client.get("/api/v1/search/questions/practice", params={"q": "seal"})).status_code == 401


# ── Mistake notebook ────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_mistake_notebook(client):
    qs = _state["qs"]
    res = await client.get("/api/v1/users/me/mistakes", headers=_h())
    assert res.status_code == 200, res.text
    body = res.json()
    # Q1 wrong twice; Q3 wrong last; Q2 fixed (latest answer right); Q4 blank and Q5 in an open test don't count
    assert [(int(i["question_id"]), i["wrong_count"]) for i in body["items"]] == [(qs[1][0], 2), (qs[3][0], 1)]
    assert body["counts"] == {"open": 2, "frequent": 1} and body["subjects"] == ["History"]
    first = body["items"][0]
    assert first["exam_name"] == "UPSC" and first["source_year"] == 2024 and first["answer_count"] == 2 and first["fixed"] is False

    frequent = (await client.get("/api/v1/users/me/mistakes", params={"view": "frequent"}, headers=_h())).json()
    assert [int(i["question_id"]) for i in frequent["items"]] == [qs[1][0]]
    with_fixed = (await client.get("/api/v1/users/me/mistakes", params={"include_fixed": True}, headers=_h())).json()
    assert {int(i["question_id"]): i["fixed"] for i in with_fixed["items"]} == {qs[1][0]: False, qs[2][0]: True, qs[3][0]: False}
    assert (await client.get("/api/v1/users/me/mistakes", params={"subject": "Polity"}, headers=_h())).json()["total"] == 0

    practice = (await client.get("/api/v1/users/me/mistakes/practice", headers=_h())).json()
    assert [int(i["question_id"]) for i in practice["items"]] == [qs[1][0], qs[3][0]]

    # Pro only
    for path in ("/api/v1/users/me/mistakes", "/api/v1/users/me/mistakes/practice"):
        locked = await client.get(path, headers=_h("free"))
        assert locked.status_code == 403 and locked.json()["detail"]["code"] == "PRO_MISTAKE_NOTEBOOK"
