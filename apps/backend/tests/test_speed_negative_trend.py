"""Speed and negative-marking trend across completed tests."""
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.fastapi_server import app
from app.cache import get_cache
from app.db.session import get_async_session
from app.db.models.user import User, UserRole, StudentProfile, SubscriptionTier
from app.db.models.hierarchy import Exam
from app.db.models.question import Question
from app.db.models.analytics import ExamAttempt, ExamQuestionResponse
from app.db.models.enums import AttemptStatus, QuestionStatus, QuestionSourceType
from app.core.security import create_access_token, get_password_hash

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
    exam = await _add(session, Exam(code="TR-1", name="MPSC 2024", source_year=2024, exam_type=QuestionSourceType.PYQ, is_active=True))
    qs = [await _add(session, Question(exam_id=exam.id, question_number_in_paper=n, status=QuestionStatus.PUBLISHED)) for n in (1, 2, 3)]
    pro = await _add(session, User(full_name="Pro", email="pro@tr.test", role=UserRole.STUDENT, password_hash=get_password_hash("x")))
    free = await _add(session, User(full_name="Free", email="free@tr.test", role=UserRole.STUDENT, password_hash=get_password_hash("x")))
    session.add_all([StudentProfile(user_id=pro.id, subscription_tier=SubscriptionTier.PREMIUM),
                     StudentProfile(user_id=free.id, subscription_tier=SubscriptionTier.FREE)])
    await session.commit()
    # Four tests, oldest first: getting faster, and losing fewer marks (MPSC -0.25 per wrong answer)
    plans = [(60, 2), (50, 2), (40, 1), (30, 0)]  # (seconds per answer, wrong answers)
    for i, (secs, wrong) in enumerate(plans):
        a = await _add(session, ExamAttempt(user_id=pro.id, exam_id=exam.id, status=AttemptStatus.EVALUATED,
                                            total_correct=3 - wrong, total_incorrect=wrong,
                                            submitted_at=NOW - timedelta(days=10 - i)))
        for j, q in enumerate(qs):
            is_wrong = j < wrong
            session.add(ExamQuestionResponse(attempt_id=a.id, question_id=q.id, selected_option_id=1,
                                             time_taken_seconds=secs, is_correct=not is_wrong,
                                             final_score=-0.25 if is_wrong else 1.0))
        await session.commit()
    _state.update(pro=pro.id, free=free.id)


@pytest.fixture
async def client():
    app.dependency_overrides[get_async_session] = _override_session
    await get_cache().delete_pattern("*")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.get("/api/v1/exam-types")
        yield c
    app.dependency_overrides.pop(get_async_session, None)


def _h(uid: int) -> dict:
    return {"Authorization": f"Bearer {create_access_token(subject=uid, role='STUDENT')}"}


@pytest.mark.anyio
async def test_speed_and_negative_trend(client):
    url = "/api/v1/analytics/trends/speed-negative"
    free = await client.get(url, headers=_h(_state["free"]))
    assert free.status_code == 403 and free.json()["detail"]["code"] == "FREE_PLAN_ANALYSIS_LOCKED"

    body = (await client.get(url, headers=_h(_state["pro"]))).json()
    assert [t["seconds_per_question"] for t in body["tests"]] == [60.0, 50.0, 40.0, 30.0]  # oldest first
    assert [t["negative_marks"] for t in body["tests"]] == [0.5, 0.5, 0.25, 0.0]  # MPSC's own penalty
    s = body["summary"]
    assert (s["average_seconds_per_question"], s["total_negative_marks"], s["average_negative_marks"]) == (45.0, 1.25, 0.31)
    assert s["speed_change"] == -20.0 and s["negative_marks_change"] == -0.38  # recent half vs earlier half
