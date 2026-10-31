"""Free plan: 20 answered questions a day across tests and practice, and score-only reports (no analysis)."""
from datetime import timedelta

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
from app.db.models.analytics import ExamQuestionResponse, PracticeAnswer
from app.db.models.enums import QuestionStatus, QuestionSourceType
from app.core.security import create_access_token, get_password_hash
from app.services import free_plan

N_QUESTIONS = 25

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
    exam = Exam(code="FREE-PLAN-2024", name="UPSC (2024) - Set A", source_year=2024, exam_type=QuestionSourceType.PYQ,
                total_questions=N_QUESTIONS, is_active=True)
    session.add(exam)
    await session.commit()
    await session.refresh(exam)

    questions = []
    for n in range(1, N_QUESTIONS + 1):
        q = Question(exam_id=exam.id, question_number_in_paper=n, status=QuestionStatus.PUBLISHED)
        session.add(q)
        await session.commit()
        await session.refresh(q)
        right = QuestionOption(question_id=q.id, option_label="A", display_order=1, is_correct=True, closeness_score=1.0)
        wrong = QuestionOption(question_id=q.id, option_label="B", display_order=2, closeness_score=0.2)
        session.add(right)
        session.add(wrong)
        await session.commit()
        await session.refresh(right)
        await session.refresh(wrong)
        questions.append((q.id, right.id, wrong.id))

    names = ["single", "batch", "submit", "practice", "mixed", "report", "pro", "admin"]
    users = {}
    for name in names:
        role = UserRole.ADMIN if name == "admin" else UserRole.STUDENT
        u = User(full_name=name.title(), email=f"{name}@free.test", role=role, password_hash=get_password_hash("x"))
        session.add(u)
        await session.commit()
        await session.refresh(u)
        users[name] = (u.id, role.value)
    session.add(StudentProfile(user_id=users["pro"][0], subscription_tier=SubscriptionTier.PREMIUM))
    await session.commit()
    _state.update(exam=exam.id, questions=questions, users=users)


def _h(who: str) -> dict:
    uid, role = _state["users"][who]
    return {"Authorization": f"Bearer {create_access_token(subject=uid, role=role)}"}


@pytest.fixture
async def client():
    app.dependency_overrides[get_async_session] = _override_session
    await get_cache().delete_pattern("*")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.get("/api/v1/exam-types")  # any DB-backed call triggers the seed
        yield c
    app.dependency_overrides.pop(get_async_session, None)
    await get_cache().delete_pattern("*")


async def _start(client, who: str) -> int:
    res = await client.post("/api/v1/attempts/start", json={"exam_id": _state["exam"]}, headers=_h(who))
    assert res.status_code == 201, res.text
    return int(res.json()["attempt_id"])


async def _answer(client, who: str, attempt_id: int, idx: int, wrong: bool = False):
    qid, right, bad = _state["questions"][idx]
    return await client.post(
        f"/api/v1/attempts/{attempt_id}/responses",
        json={"question_id": qid, "selected_option_id": bad if wrong else right, "time_spent_seconds": 20},
        headers=_h(who),
    )


async def _usage(client, who: str) -> dict:
    return (await client.get("/api/v1/users/me/daily-usage", headers=_h(who))).json()


@pytest.mark.anyio
async def test_single_answers_stop_at_the_daily_limit(client):
    attempt = await _start(client, "single")
    for i in range(free_plan.FREE_DAILY_QUESTION_LIMIT):
        assert (await _answer(client, "single", attempt, i)).status_code == 200
    over = await _answer(client, "single", attempt, 20)
    assert over.status_code == 403
    assert over.json()["detail"]["code"] == free_plan.DAILY_LIMIT_CODE
    # changing an answer already counted is still allowed
    assert (await _answer(client, "single", attempt, 0, wrong=True)).status_code == 200
    usage = await _usage(client, "single")
    assert (usage["limited"], usage["used"], usage["remaining"]) == (True, 20, 0)


@pytest.mark.anyio
async def test_batch_save_drops_answers_beyond_the_limit(client):
    attempt = await _start(client, "batch")
    items = [{"question_id": q, "selected_option_id": right, "time_spent_seconds": 10} for q, right, _ in _state["questions"]]
    ack = await client.post(f"/api/v1/attempts/{attempt}/responses/batch", json={"batch_id": "b1", "responses": items}, headers=_h("batch"))
    assert ack.status_code == 200, ack.text
    assert ack.json()["daily_limit_skipped"] == N_QUESTIONS - 20
    assert (await _usage(client, "batch"))["used"] == 20


@pytest.mark.anyio
async def test_submit_counts_new_answers_against_the_limit(client):
    attempt = await _start(client, "submit")
    for i in range(18):
        assert (await _answer(client, "submit", attempt, i)).status_code == 200
    final = [{"question_id": q, "selected_option_id": right} for q, right, _ in _state["questions"][18:23]]
    res = await client.post(f"/api/v1/attempts/{attempt}/submit", json={"responses": final}, headers=_h("submit"))
    assert res.status_code == 200, res.text
    assert (await _usage(client, "submit"))["used"] == 20
    async with AsyncSession(test_engine) as s:
        answered = (await s.exec(select(ExamQuestionResponse).where(
            ExamQuestionResponse.attempt_id == attempt, ExamQuestionResponse.selected_option_id.is_not(None)))).all()
    assert len(answered) == 20


@pytest.mark.anyio
async def test_practice_answers_count_once_per_question_per_day(client):
    qs = _state["questions"]
    first = await client.post("/api/v1/practice/answers", json={"question_id": qs[0][0], "selected_option_id": qs[0][1]}, headers=_h("practice"))
    assert first.status_code == 200 and first.json()["counted"] is True
    again = await client.post("/api/v1/practice/answers", json={"question_id": qs[0][0], "selected_option_id": qs[0][2]}, headers=_h("practice"))
    assert again.json()["counted"] is False and again.json()["usage"]["used"] == 1
    for q, right, _ in qs[1:20]:
        assert (await client.post("/api/v1/practice/answers", json={"question_id": q, "selected_option_id": right}, headers=_h("practice"))).status_code == 200
    blocked = await client.post("/api/v1/practice/answers", json={"question_id": qs[20][0], "selected_option_id": qs[20][1]}, headers=_h("practice"))
    assert blocked.status_code == 403 and blocked.json()["detail"]["code"] == free_plan.DAILY_LIMIT_CODE
    # an option from another question is rejected
    bad = await client.post("/api/v1/practice/answers", json={"question_id": qs[0][0], "selected_option_id": qs[1][1]}, headers=_h("practice"))
    assert bad.status_code == 422


@pytest.mark.anyio
async def test_tests_and_practice_share_one_daily_limit_and_yesterday_is_free(client):
    uid = _state["users"]["mixed"][0]
    # answers from yesterday (IST) don't count
    start, _ = free_plan.ist_day_bounds()
    async with AsyncSession(test_engine) as s:
        s.add(PracticeAnswer(user_id=uid, question_id=_state["questions"][24][0], answered_at=start - timedelta(minutes=5)))
        await s.commit()
    assert (await _usage(client, "mixed"))["used"] == 0

    attempt = await _start(client, "mixed")
    for i in range(15):
        assert (await _answer(client, "mixed", attempt, i)).status_code == 200
    for q, right, _ in _state["questions"][15:20]:
        assert (await client.post("/api/v1/practice/answers", json={"question_id": q, "selected_option_id": right}, headers=_h("mixed"))).status_code == 200
    assert (await _usage(client, "mixed"))["remaining"] == 0
    assert (await _answer(client, "mixed", attempt, 20)).status_code == 403


@pytest.mark.anyio
async def test_premium_and_staff_are_unlimited(client):
    attempt = await _start(client, "pro")
    for i in range(N_QUESTIONS):
        assert (await _answer(client, "pro", attempt, i)).status_code == 200
    usage = await _usage(client, "pro")
    assert usage["limited"] is False and usage["remaining"] is None
    assert (await _usage(client, "admin"))["limited"] is False


@pytest.mark.anyio
async def test_free_report_is_score_only_and_skips_the_ai_call(client, monkeypatch):
    from app.engine import report_ai_synthesizer
    from app.engine.post_submission_pipeline import run_post_submission_pipeline

    calls = []

    async def fake_insight(**kwargs):
        calls.append(kwargs)
        raise RuntimeError("LLM unavailable in tests")

    monkeypatch.setattr(report_ai_synthesizer.ReportAISynthesizer, "generate_diagnostic_insight", staticmethod(fake_insight))

    attempt = await _start(client, "report")
    for i in range(3):
        assert (await _answer(client, "report", attempt, i, wrong=(i == 2))).status_code == 200
    assert (await client.post(f"/api/v1/attempts/{attempt}/submit", json={}, headers=_h("report"))).status_code == 200
    async with AsyncSession(test_engine, expire_on_commit=False) as s:
        await run_post_submission_pipeline(attempt, session=s)
    assert calls == []  # free plan: no LLM call
    # nor for the all-exams summary rebuilt after each submission
    from app.engine.cumulative_analytics_aggregator import CumulativeAnalyticsAggregator
    async with AsyncSession(test_engine, expire_on_commit=False) as s:
        await CumulativeAnalyticsAggregator.compute_user_cumulative_report(s, _state["users"]["report"][0], force_recompute=True)
    assert calls == []

    own = await client.get(f"/api/v1/analytics/reports/attempts/{attempt}/json", headers=_h("report"))
    assert own.status_code == 200, own.text
    body = own.json()
    assert body["analysis_locked"] is True
    assert set(body) == {"analysis_locked", "metadata", "part_1_per_question_analysis", "part_2_exam_macro_scorecard"}
    assert len(body["part_1_per_question_analysis"]) == N_QUESTIONS
    assert set(body["part_2_exam_macro_scorecard"]) == {"score_summary"}

    locked = await client.get(f"/api/v1/analytics/reports/attempts/{attempt}/exam", headers=_h("report"))
    assert locked.status_code == 403 and locked.json()["detail"]["code"] == free_plan.ANALYSIS_LOCKED_CODE
    cumulative = await client.get("/api/v1/analytics/users/me/aggregate-report", headers=_h("report"))
    assert cumulative.status_code == 403
    # the per-question review stays available
    assert (await client.get(f"/api/v1/analytics/reports/attempts/{attempt}/questions", headers=_h("report"))).status_code == 200

    # staff see the full report of a free student
    admin_view = (await client.get(f"/api/v1/analytics/reports/attempts/{attempt}/json", headers=_h("admin"))).json()
    assert "analysis_locked" not in admin_view and "part_3_taxonomy_hierarchy_retention" in admin_view


@pytest.mark.anyio
async def test_premium_report_still_calls_the_ai(client, monkeypatch):
    from app.engine import report_ai_synthesizer
    from app.engine.post_submission_pipeline import run_post_submission_pipeline

    calls = []

    async def fake_insight(**kwargs):
        calls.append(kwargs)
        # like the real method when the LLM is unavailable: return the rule-based insight
        return report_ai_synthesizer.ReportAISynthesizer.rule_based_insight(
            kwargs["candidate_info"], kwargs["exam_info"], kwargs["precalculated_metrics"]
        )

    monkeypatch.setattr(report_ai_synthesizer.ReportAISynthesizer, "generate_diagnostic_insight", staticmethod(fake_insight))
    attempts = (await client.get("/api/v1/attempts/status-by-exam", headers=_h("pro"))).json()
    attempt = int(attempts[str(_state["exam"])]["in_progress_attempt_id"])
    assert (await client.post(f"/api/v1/attempts/{attempt}/submit", json={}, headers=_h("pro"))).status_code == 200
    async with AsyncSession(test_engine, expire_on_commit=False) as s:
        await run_post_submission_pipeline(attempt, session=s)
    assert len(calls) == 1
    # the all-exams summary is AI-written for Premium (proves the free-plan check above isn't vacuous)
    from app.engine.cumulative_analytics_aggregator import CumulativeAnalyticsAggregator
    async with AsyncSession(test_engine, expire_on_commit=False) as s:
        await CumulativeAnalyticsAggregator.compute_user_cumulative_report(s, _state["users"]["pro"][0], force_recompute=True)
    assert len(calls) == 2
    full = (await client.get(f"/api/v1/analytics/reports/attempts/{attempt}/json", headers=_h("pro"))).json()
    assert "analysis_locked" not in full
