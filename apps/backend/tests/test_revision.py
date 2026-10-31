"""Revision from spaced-repetition due dates: what's due, practice, reminders, rescheduling."""
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
from app.db.models.analytics import UserMemoryState
from app.db.models.notification import UserNotification
from app.db.models.enums import QuestionStatus, QuestionSourceType, LanguageCode
from app.core.security import create_access_token, get_password_hash
from app.services import revision_service
from app.services.free_plan import IST

test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
_state: dict = {}
NOW = datetime.now(timezone.utc)


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
    exam = await _add(session, Exam(code="RV-1", name="UPSC 2024", source_year=2024, exam_type=QuestionSourceType.PYQ, is_active=True))
    version = await _add(session, SyllabusVersion(exam_id=exam.id, version_code="v1"))
    subject = await _add(session, Subject(name="History", code="HIS", version_id=version.id))
    topic = await _add(session, Topic(name="Ancient", code="ANC", subject_id=subject.id))
    sub = await _add(session, Subtopic(name="Indus Valley", code="IVC", topic_id=topic.id))
    qs = {}
    for n, status in ((1, QuestionStatus.PUBLISHED), (2, QuestionStatus.PUBLISHED), (3, QuestionStatus.REJECTED), (4, QuestionStatus.PUBLISHED)):
        q = await _add(session, Question(exam_id=exam.id, question_number_in_paper=n, status=status, subtopic_id=sub.id))
        session.add(QuestionTranslation(question_id=q.id, language=LanguageCode.ENGLISH, question_text=f"Q{n}?"))
        right = await _add(session, QuestionOption(question_id=q.id, option_label="A", display_order=1, is_correct=True))
        qs[n] = (q.id, right.id)
    me = await _add(session, User(full_name="Me", email="me@rv.test", role=UserRole.STUDENT, password_hash=get_password_hash("x")))
    idle = await _add(session, User(full_name="Idle", email="idle@rv.test", role=UserRole.STUDENT, password_hash=get_password_hash("x")))
    session.add_all([StudentProfile(user_id=me.id, subscription_tier=SubscriptionTier.PREMIUM),
                     StudentProfile(user_id=idle.id, subscription_tier=SubscriptionTier.PREMIUM)])
    session.add_all([
        UserMemoryState(user_id=me.id, question_id=qs[1][0], subtopic_id=sub.id, next_scheduled_review=NOW - timedelta(days=3)),  # overdue
        UserMemoryState(user_id=me.id, question_id=qs[2][0], subtopic_id=sub.id, next_scheduled_review=NOW - timedelta(hours=1)),  # due
        UserMemoryState(user_id=me.id, question_id=qs[3][0], subtopic_id=sub.id, next_scheduled_review=NOW - timedelta(days=1)),  # rejected
        UserMemoryState(user_id=me.id, question_id=qs[4][0], subtopic_id=sub.id, next_scheduled_review=NOW + timedelta(days=5)),  # later
        UserMemoryState(user_id=idle.id, question_id=qs[1][0], subtopic_id=sub.id, next_scheduled_review=NOW + timedelta(days=2)),
    ])
    await session.commit()
    _state.update(qs=qs, me=me.id, idle=idle.id)


@pytest.fixture
async def client():
    app.dependency_overrides[get_async_session] = _override_session
    await get_cache().delete_pattern("*")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.get("/api/v1/exam-types")
        yield c
    app.dependency_overrides.pop(get_async_session, None)


def _h() -> dict:
    return {"Authorization": f"Bearer {create_access_token(subject=_state['me'], role='STUDENT')}"}


def test_schedule_rule_matches_the_pipeline():
    assert revision_service.next_schedule(None, True) == (3.5, 3.0, 1.0, 3)
    assert revision_service.next_schedule(None, False) == (5.0, 1.0, 0.4, 1)
    assert revision_service.next_schedule((3.5, 3.0), True) == (3.3, 4.5, 1.0, 4)
    assert revision_service.next_schedule((3.5, 3.0), False) == (4.0, 1.8, 0.4, 1)


@pytest.mark.anyio
async def test_due_revision_reminders_and_rescheduling(client):
    qs = _state["qs"]
    summary = (await client.get("/api/v1/users/me/revision", headers=_h())).json()
    assert summary["due_today"] == 2 and summary["topics"] == [{"subtopic": "Indus Valley", "questions": 2}]
    practice = (await client.get("/api/v1/users/me/revision/practice", headers=_h())).json()
    assert [int(i["question_id"]) for i in practice["items"]] == [qs[1][0], qs[2][0]]  # most overdue first; rejected left out

    # The morning reminder: once per student per day, only when something is due, only in the 7 AM hour
    seven_am = datetime.combine(NOW.astimezone(IST).date(), datetime.min.time(), tzinfo=IST).replace(hour=7, minute=5).astimezone(timezone.utc)
    async with AsyncSession(test_engine, expire_on_commit=False) as s:
        assert await revision_service.send_daily_reminders(s, seven_am) == 1
        assert await revision_service.send_daily_reminders(s, seven_am + timedelta(minutes=30)) == 0
        notes = (await s.exec(select(UserNotification).where(UserNotification.notification_type == "REVISION_DUE"))).all()
    assert [(n.user_id, n.title, n.action_url) for n in notes] == [(_state["me"], "2 questions due for revision today", "/practice-exam?source=revision")]
    assert await revision_service.run_daily_reminders(seven_am.replace(hour=(seven_am.hour + 3) % 24)) == 0  # not the reminder hour

    # Answering a due question right in practice moves it out of today's list
    res = await client.post("/api/v1/practice/answers", json={"question_id": qs[2][0], "selected_option_id": qs[2][1]}, headers=_h())
    assert res.status_code == 200, res.text
    async with AsyncSession(test_engine) as s:
        mem = (await s.exec(select(UserMemoryState).where(UserMemoryState.user_id == _state["me"], UserMemoryState.question_id == qs[2][0]))).one()
    assert mem.fsrs_stability == 3.0 and mem.next_scheduled_review.replace(tzinfo=timezone.utc) > NOW + timedelta(days=2)
    assert (await client.get("/api/v1/users/me/revision", headers=_h())).json()["due_today"] == 1
