"""Difficulty analysis on reports, difficulty filter for subject-wise tests, explanations in the requested language."""
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.fastapi_server import app
from app.cache import get_cache
from app.db.session import get_async_session
from app.db.models.user import User, UserRole
from app.db.models.hierarchy import Exam
from app.db.models.question import Question, QuestionOption
from app.db.models.explanation import QuestionExplanation
from app.db.models.enums import QuestionStatus, DifficultyLevel, LanguageCode
from app.core.security import create_access_token, get_password_hash
from app.engine.matrix_orchestrator import difficulty_breakdown

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
    exam = Exam(code="P1-2024", name="UPSC (2024) - Set A", source_year=2024)
    session.add(exam)
    await session.commit()
    await session.refresh(exam)

    levels = [DifficultyLevel.EASY, DifficultyLevel.EASY, DifficultyLevel.MEDIUM, DifficultyLevel.HARD]
    qids = []
    for n, level in enumerate(levels, start=1):
        q = Question(exam_id=exam.id, question_number_in_paper=n, difficulty=level, status=QuestionStatus.PUBLISHED)
        session.add(q)
        await session.commit()
        await session.refresh(q)
        session.add(QuestionOption(question_id=q.id, option_label="A", display_order=1, is_correct=True, closeness_score=1.0))
        session.add(QuestionOption(question_id=q.id, option_label="B", display_order=2, closeness_score=0.2))
        qids.append(q.id)
    # Question 1 has English and Hindi explanations; question 2 only English
    session.add(QuestionExplanation(question_id=qids[0], language=LanguageCode.ENGLISH, detailed_solution="English explanation"))
    session.add(QuestionExplanation(question_id=qids[0], language=LanguageCode.HINDI, detailed_solution="हिंदी व्याख्या"))
    session.add(QuestionExplanation(question_id=qids[1], language=LanguageCode.ENGLISH, detailed_solution="Only English"))

    student = User(full_name="Student", email="student@p1.test", role=UserRole.STUDENT, password_hash=get_password_hash("x"))
    session.add(student)
    await session.commit()
    await session.refresh(student)
    _state.update(qids=qids, student=student.id)


def _h() -> dict:
    return {"Authorization": f"Bearer {create_access_token(subject=_state['student'], role='STUDENT')}"}


@pytest.fixture
async def client():
    app.dependency_overrides[get_async_session] = _override_session
    await get_cache().delete_pattern("*")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.get("/api/v1/exam-types")  # any DB-backed call triggers the seed
        await get_cache().delete_pattern("*")
        yield c
    app.dependency_overrides.pop(get_async_session, None)
    await get_cache().delete_pattern("*")


def test_difficulty_breakdown_counts_each_level():
    rows = difficulty_breakdown([
        {"difficulty": "EASY", "is_attempted": True, "is_correct": True, "time_taken_seconds": 30},
        {"difficulty": "easy", "is_attempted": True, "is_correct": False, "time_taken_seconds": 50},
        {"difficulty": "EASY", "is_attempted": False, "time_taken_seconds": 4},
        {"difficulty": "HARD", "is_attempted": False},
        {"difficulty": None, "is_attempted": True, "is_correct": True, "time_taken_seconds": 20},  # counts as MEDIUM
    ])
    assert rows == [
        {"difficulty": "EASY", "total": 3, "attempted": 2, "correct": 1, "incorrect": 1, "unattempted": 1,
         "accuracy_pct": 50.0, "avg_time_seconds": 40.0},
        {"difficulty": "MEDIUM", "total": 1, "attempted": 1, "correct": 1, "incorrect": 0, "unattempted": 0,
         "accuracy_pct": 100.0, "avg_time_seconds": 20.0},
        {"difficulty": "HARD", "total": 1, "attempted": 0, "correct": 0, "incorrect": 0, "unattempted": 1,
         "accuracy_pct": None, "avg_time_seconds": None},
    ]
    assert difficulty_breakdown([]) == []


@pytest.mark.anyio
async def test_subject_wise_count_filters_by_difficulty(client):
    url = "/api/v1/attempts/dynamic-question-count"
    assert (await client.get(url, headers=_h())).json()["count"] == 4
    assert (await client.get(url, params={"dynamic_difficulty": "EASY"}, headers=_h())).json()["count"] == 2
    assert (await client.get(url, params={"dynamic_difficulty": "medium,HARD"}, headers=_h())).json()["count"] == 2
    assert (await client.get(url, params={"dynamic_difficulty": "all"}, headers=_h())).json()["count"] == 4
    bad = await client.get(url, params={"dynamic_difficulty": "EXTREME"}, headers=_h())
    assert bad.status_code == 422


@pytest.mark.anyio
async def test_solution_explanation_follows_requested_language(client):
    q1, q2 = _state["qids"][0], _state["qids"][1]

    async def solution_text(qid: int, lang: str) -> str:
        res = await client.get(f"/api/v1/questions/{qid}/solution", params={"language": lang})
        assert res.status_code == 200, res.text
        return res.json()["explanation"]["detailed_solution"]

    assert await solution_text(q1, "en") == "English explanation"
    assert await solution_text(q1, "hi") == "हिंदी व्याख्या"
    assert await solution_text(q1, "mr") == "English explanation"  # no Marathi: English fallback
    assert await solution_text(q2, "hi") == "Only English"
