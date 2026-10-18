"""Practice from bookmarks: the student's bookmarked questions, newest first, with solutions."""
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
from app.db.models.user import User, UserRole, QuestionBookmark
from app.db.models.hierarchy import Exam
from app.db.models.question import Question, QuestionOption, QuestionTranslation
from app.db.models.enums import QuestionStatus, QuestionSourceType, DifficultyLevel, LanguageCode
from app.core.security import create_access_token, get_password_hash

test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
_state: dict = {}


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
    exam = await _add(session, Exam(code="BM-2024", name="UPSC 2024", source_year=2024, exam_type=QuestionSourceType.PYQ, is_active=True))
    qs = {}
    for n, (status, diff) in enumerate((
        (QuestionStatus.PUBLISHED, DifficultyLevel.EASY),
        (QuestionStatus.PUBLISHED, DifficultyLevel.HARD),
        (QuestionStatus.REJECTED, DifficultyLevel.EASY),
        (QuestionStatus.PUBLISHED, DifficultyLevel.MEDIUM),
    ), 1):
        q = await _add(session, Question(exam_id=exam.id, question_number_in_paper=n, status=status, difficulty=diff))
        session.add(QuestionTranslation(question_id=q.id, language=LanguageCode.ENGLISH, question_text=f"Question {n}?"))
        session.add(QuestionOption(question_id=q.id, option_label="A", display_order=1, is_correct=True))
        await session.commit()
        qs[n] = q.id
    me = await _add(session, User(full_name="Me", email="me@bm.test", role=UserRole.STUDENT, password_hash=get_password_hash("x")))
    other = await _add(session, User(full_name="Other", email="o@bm.test", role=UserRole.STUDENT, password_hash=get_password_hash("x")))
    now = datetime.now(timezone.utc)
    session.add_all([
        QuestionBookmark(user_id=me.id, question_id=qs[1], created_at=now - timedelta(days=3)),
        QuestionBookmark(user_id=me.id, question_id=qs[2], created_at=now - timedelta(days=1)),
        QuestionBookmark(user_id=me.id, question_id=qs[3], created_at=now),  # rejected since: not served
        QuestionBookmark(user_id=other.id, question_id=qs[4], created_at=now),
    ])
    await session.commit()
    _state.update(qs=qs, me=me.id)


@pytest.fixture
async def client():
    app.dependency_overrides[get_async_session] = _override_session
    await get_cache().delete_pattern("*")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.get("/api/v1/exam-types")
        yield c
    app.dependency_overrides.pop(get_async_session, None)


@pytest.mark.anyio
async def test_bookmarked_questions_for_practice(client):
    url = "/api/v1/users/me/bookmarks/practice"
    assert (await client.get(url)).status_code == 401
    h = {"Authorization": f"Bearer {create_access_token(subject=_state['me'], role='STUDENT')}"}
    body = (await client.get(url, headers=h)).json()
    qs = _state["qs"]
    assert [int(i["question_id"]) for i in body["items"]] == [qs[2], qs[1]]  # newest bookmark first; rejected and others' left out
    assert body["total"] == 2
    first = body["items"][0]
    assert first["options"] and "explanation" in first  # solutions are included for practice
    hard = (await client.get(url, params={"difficulty": "HARD"}, headers=h)).json()
    assert [int(i["question_id"]) for i in hard["items"]] == [qs[2]]
