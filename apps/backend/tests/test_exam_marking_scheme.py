"""An exam's marking scheme: asked on upload, editable later, used for new tests only."""
from types import SimpleNamespace

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
from app.db.models.hierarchy import Exam
from app.db.models.question import Question, QuestionOption
from app.db.models.analytics import ExamAttempt
from app.db.models.enums import QuestionStatus, QuestionSourceType
from app.core.security import create_access_token, get_password_hash
from app.services.scoring import exam_marking_scheme, validate_marking_scheme

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


async def _add(session, obj):
    session.add(obj)
    await session.commit()
    await session.refresh(obj)
    return obj


async def _seed(session: AsyncSession):
    exam = await _add(session, Exam(code="MPSC-2024", name="MPSC 2024", source_year=2024, exam_type=QuestionSourceType.PYQ,
                                    total_questions=2, total_marks=4.0, is_active=True,
                                    marks_per_question=2.0, negative_marks_per_question=0.67))
    qs = []
    for n in (1, 2):
        q = await _add(session, Question(exam_id=exam.id, question_number_in_paper=n, status=QuestionStatus.PUBLISHED,
                                         marks=2.0, negative_marks=0.67))
        right = await _add(session, QuestionOption(question_id=q.id, option_label="A", display_order=1, is_correct=True))
        wrong = await _add(session, QuestionOption(question_id=q.id, option_label="B", display_order=2))
        qs.append((q.id, right.id, wrong.id))
    users = {}
    for name, role in (("student", UserRole.STUDENT), ("admin", UserRole.ADMIN)):
        u = await _add(session, User(full_name=name, email=f"{name}@scheme.test", role=role, password_hash=get_password_hash("x")))
        users[name] = (u.id, role.value)
    session.add(StudentProfile(user_id=users["student"][0], subscription_tier=SubscriptionTier.PREMIUM))
    await session.commit()
    _state.update(exam=exam.id, qs=qs, users=users)


def _h(who: str) -> dict:
    uid, role = _state["users"][who]
    return {"Authorization": f"Bearer {create_access_token(subject=uid, role=role)}"}


@pytest.fixture
async def client(monkeypatch):
    app.dependency_overrides[get_async_session] = _override_session
    monkeypatch.setattr("app.engine.post_submission_pipeline.run_post_submission_pipeline", lambda *a, **k: None, raising=False)
    monkeypatch.setattr("app.engine.post_submission_pipeline.EXAM_SOLUTIONS_SLIDING_CACHE", {})
    await get_cache().delete_pattern("*")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.get("/api/v1/exam-types")  # any DB-backed call triggers the seed
        yield c
    app.dependency_overrides.pop(get_async_session, None)
    await get_cache().delete_pattern("*")


def test_scheme_order_and_validation():
    exam = SimpleNamespace(marks_per_question=1.0, negative_marks_per_question=0.25)
    exam_type = SimpleNamespace(positive_marks=2.0, negative_marks=0.66)
    assert exam_marking_scheme(exam, exam_type) == (1.0, 0.25)  # the exam's own scheme wins
    assert exam_marking_scheme(SimpleNamespace(marks_per_question=None), exam_type) == (2.0, 0.66)
    assert exam_marking_scheme(None, None) == (2.0, 0.67)
    assert validate_marking_scheme(2, 0) is None
    assert validate_marking_scheme(0, 0) and validate_marking_scheme(2, -1) and validate_marking_scheme(1, 2)


async def _take_and_submit(client) -> ExamAttempt:
    res = await client.post("/api/v1/attempts/start", json={"exam_id": _state["exam"], "force_new": True}, headers=_h("student"))
    assert res.status_code == 201, res.text
    attempt_id = int(res.json()["attempt_id"])
    (q1, r1, _), (q2, _, w2) = _state["qs"]
    for qid, opt in ((q1, r1), (q2, w2)):  # one right, one wrong
        assert (await client.post(f"/api/v1/attempts/{attempt_id}/responses", headers=_h("student"),
                                  json={"question_id": qid, "selected_option_id": opt, "time_spent_seconds": 5})).status_code == 200
    assert (await client.post(f"/api/v1/attempts/{attempt_id}/submit", json={}, headers=_h("student"))).status_code == 200
    async with AsyncSession(test_engine) as s:
        return await s.get(ExamAttempt, attempt_id)


@pytest.mark.anyio
async def test_changing_the_scheme_applies_to_new_tests_only(client):
    url = f"/api/v1/admin/exams/{_state['exam']}/marking-scheme"
    assert (await client.get(url, headers=_h("student"))).status_code == 403
    got = (await client.get(url, headers=_h("admin"))).json()
    assert (got["marks_per_question"], got["negative_marks_per_question"], got["questions"]) == (2.0, 0.67, 2)

    before = await _take_and_submit(client)
    assert (before.total_score, before.max_possible_score) == (1.33, 4.0)  # 2 - 2/3

    bad = await client.put(url, json={"marks_per_question": 1, "negative_marks_per_question": 2}, headers=_h("admin"))
    assert bad.status_code == 422
    res = await client.put(url, json={"marks_per_question": 1, "negative_marks_per_question": 0.25}, headers=_h("admin"))
    assert res.status_code == 200, res.text
    assert (res.json()["marks_per_question"], res.json()["total_marks"]) == (1.0, 2.0)
    async with AsyncSession(test_engine) as s:
        marks = {(q.marks, q.negative_marks) for q in (await s.exec(select(Question))).all()}
    assert marks == {(1.0, 0.25)}

    after = await _take_and_submit(client)
    assert (after.total_score, after.max_possible_score) == (0.75, 2.0)
    async with AsyncSession(test_engine) as s:
        assert (await s.get(ExamAttempt, before.id)).total_score == 1.33  # the earlier test keeps its score


@pytest.mark.anyio
async def test_upload_refuses_a_nonsense_scheme(client):
    res = await client.post(
        "/api/v1/exams/upload",
        headers=_h("admin"),
        data={"exam_name": "MPSC", "year": "2024", "set_code": "SET_A", "marks_per_question": "1", "negative_marks_per_question": "3"},
        files={"file": ("mpsc_2024.pdf", b"%PDF-1.4 test", "application/pdf")},
    )
    assert res.status_code == 422, res.text
    assert "can't be more than" in res.json()["detail"]
