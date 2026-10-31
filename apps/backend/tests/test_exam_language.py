"""Exam language: chosen before a test starts (English by default), fixed for the whole attempt."""
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
from app.db.models.question import Question, QuestionOption, OptionTranslation, QuestionTranslation
from app.db.models.explanation import QuestionExplanation
from app.db.models.analytics import ExamAttempt
from app.db.models.enums import QuestionStatus, QuestionSourceType, LanguageCode
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
            await _seed(session)
        yield session


async def _seed(session: AsyncSession):
    exams = []
    for code in ("LANG-A", "LANG-B"):
        exam = Exam(code=code, name=f"UPSC (2024) - {code}", source_year=2024, exam_type=QuestionSourceType.PYQ,
                    total_questions=1, is_active=True)
        session.add(exam)
        await session.commit()
        await session.refresh(exam)
        exams.append(exam.id)

    q = Question(exam_id=exams[0], question_number_in_paper=1, status=QuestionStatus.PUBLISHED)
    session.add(q)
    await session.commit()
    await session.refresh(q)
    q2 = Question(exam_id=exams[1], question_number_in_paper=1, status=QuestionStatus.PUBLISHED)
    session.add(q2)
    await session.commit()
    await session.refresh(q2)
    right = QuestionOption(question_id=q.id, option_label="A", display_order=1, is_correct=True, closeness_score=1.0)
    wrong = QuestionOption(question_id=q.id, option_label="B", display_order=2, closeness_score=0.2)
    session.add_all([right, wrong, QuestionOption(question_id=q2.id, option_label="A", display_order=1, is_correct=True)])
    await session.commit()
    await session.refresh(right)
    await session.refresh(wrong)

    session.add_all([
        QuestionTranslation(question_id=q.id, language=LanguageCode.ENGLISH, question_text="Which river?"),
        QuestionTranslation(question_id=q.id, language=LanguageCode.HINDI, question_text="कौन सी नदी?"),
        OptionTranslation(option_id=wrong.id, language=LanguageCode.ENGLISH, option_text="Ganga",
                          distractor_analysis="EN: tempting because it is the longest."),
        OptionTranslation(option_id=wrong.id, language=LanguageCode.HINDI, option_text="गंगा",
                          distractor_analysis="HI: सबसे लंबी होने के कारण आकर्षक।"),
        QuestionExplanation(question_id=q.id, language=LanguageCode.ENGLISH, detailed_solution="EN solution"),
        QuestionExplanation(question_id=q.id, language=LanguageCode.HINDI, detailed_solution="HI समाधान"),
    ])
    student = User(full_name="Asha", email="asha@lang.test", role=UserRole.STUDENT,
                   password_hash=get_password_hash("x"), preferred_language="hi")
    session.add(student)
    await session.commit()
    await session.refresh(student)
    _state.update(exams=exams, question=q.id, right=right.id, wrong=wrong.id, student=student.id)


def _h() -> dict:
    return {"Authorization": f"Bearer {create_access_token(subject=_state['student'], role='STUDENT')}"}


@pytest.fixture
async def client():
    app.dependency_overrides[get_async_session] = _override_session
    await get_cache().delete_pattern("*")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.get("/api/v1/exam-types")  # any DB-backed call triggers the seed
        yield c
    app.dependency_overrides.pop(get_async_session, None)
    await get_cache().delete_pattern("*")


async def _attempt_language(attempt_id) -> str:
    async with AsyncSession(test_engine) as s:
        return (await s.get(ExamAttempt, int(attempt_id))).language


@pytest.mark.anyio
async def test_language_defaults_to_english_and_is_fixed_for_the_attempt(client):
    exam_a, exam_b = _state["exams"]
    start = "/api/v1/attempts/start"

    # Only English, Hindi and Marathi
    bad = await client.post(start, json={"exam_id": exam_a, "language": "ta"}, headers=_h())
    assert bad.status_code == 422

    # Nothing in progress yet: the exam screen will ask for a language
    assert (await client.get("/api/v1/attempts/in-progress", params={"exam_id": exam_a}, headers=_h())).json() == {
        "attempt_id": None, "language": None}

    # No language sent -> English, even though the profile prefers Hindi
    res = await client.post(start, json={"exam_id": exam_b}, headers=_h())
    assert res.status_code == 201 and res.json()["language"] == "en"
    assert await _attempt_language(res.json()["attempt_id"]) == "en"

    # Any spelling of a supported language is stored as its code
    res = await client.post(start, json={"exam_id": exam_a, "language": "HINDI"}, headers=_h())
    assert res.status_code == 201, res.text
    attempt_id = res.json()["attempt_id"]
    assert res.json()["language"] == "hi"

    # Reopening resumes in Hindi, whatever language is asked for now
    again = await client.post(start, json={"exam_id": exam_a, "language": "mr"}, headers=_h())
    assert (again.json()["attempt_id"], again.json()["language"]) == (attempt_id, "hi")
    assert await _attempt_language(attempt_id) == "hi"
    status = await client.get(f"/api/v1/attempts/{attempt_id}/status", headers=_h())
    assert status.json()["language"] == "hi"
    lookup = await client.get("/api/v1/attempts/in-progress", params={"exam_id": "LANG-A"}, headers=_h())
    assert lookup.json() == {"attempt_id": attempt_id, "language": "hi"}

    # A retake (force_new) is a new attempt in the newly chosen language
    retake = await client.post(start, json={"exam_id": exam_a, "language": "mr", "force_new": True}, headers=_h())
    assert retake.json()["attempt_id"] != attempt_id and retake.json()["language"] == "mr"


@pytest.mark.anyio
async def test_revealed_explanation_follows_the_attempt_language_with_english_fallback(client):
    exam_a = _state["exams"][0]
    for lang, expected_solution, expected_analysis in (
        ("hi", "HI समाधान", "HI:"),
        ("mr", "EN solution", "EN:"),  # no Marathi explanation yet -> English
    ):
        res = await client.post("/api/v1/attempts/start", json={
            "exam_id": exam_a, "mode": "PRACTICE", "language": lang, "force_new": True}, headers=_h())
        assert res.status_code == 201, res.text
        attempt_id = res.json()["attempt_id"]
        saved = await client.post(f"/api/v1/attempts/{attempt_id}/responses", json={
            "question_id": _state["question"], "selected_option_id": _state["wrong"], "time_spent_seconds": 10}, headers=_h())
        assert saved.status_code == 200, saved.text
        reveal = await client.post(f"/api/v1/attempts/{attempt_id}/reveal/{_state['question']}", headers=_h())
        assert reveal.status_code == 200, reveal.text
        body = reveal.text
        assert expected_solution in body, (lang, body[:400])
        assert expected_analysis in body, (lang, body[:400])
