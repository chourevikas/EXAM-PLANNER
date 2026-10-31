"""Dashboard, monthly benchmark, weekly insights and report fallbacks report real data (or say there is none)."""
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.fastapi_server import app
from app.cache import get_cache
from app.db.session import get_async_session
from app.db.models.user import User, UserRole
from app.db.models.hierarchy import Exam
from app.db.models.question import Question, QuestionOption
from app.db.models.analytics import ExamAttempt, ExamQuestionResponse
from app.db.models.enums import AttemptStatus
from app.core.security import create_access_token, get_password_hash
from app.engine.report_ai_synthesizer import ReportAISynthesizer
from app.schemas.report_llm_schemas import CognitiveDiagnosticInsight
from app.services.analytics_service import _readiness_index, _upsc_percentile

test_engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=False,
)
_session_factory = sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

_state: dict = {}


async def _override_session():
    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    async with AsyncSession(test_engine, expire_on_commit=False) as session:
        if not _state:
            await _seed(session)
        yield session


async def _seed(session: AsyncSession):
    exam = Exam(code="NFD-2024", name="UPSC (2024) - Set A", source_year=2024)
    other = Exam(code="NFD-2023", name="UPSC (2023) - Set A", source_year=2023)
    session.add(exam)
    session.add(other)
    await session.commit()
    await session.refresh(exam)
    await session.refresh(other)

    # 4 questions, each with a correct option A, a near-correct distractor B and a weak distractor C
    options = {}
    for n in range(1, 5):
        q = Question(exam_id=exam.id, question_number_in_paper=n)
        session.add(q)
        await session.commit()
        await session.refresh(q)
        opts = [
            QuestionOption(question_id=q.id, option_label="A", display_order=1, is_correct=True, closeness_score=1.0),
            QuestionOption(question_id=q.id, option_label="B", display_order=2, closeness_score=0.8),
            QuestionOption(question_id=q.id, option_label="C", display_order=3, closeness_score=0.1),
        ]
        for o in opts:
            session.add(o)
        await session.commit()
        for o in opts:
            await session.refresh(o)
        options[n] = (q.id, {o.option_label: o.id for o in opts})

    active = User(full_name="Active", email="active@nfd.test", role=UserRole.STUDENT, password_hash=get_password_hash("x"))
    fresh = User(full_name="Fresh", email="fresh@nfd.test", role=UserRole.STUDENT, password_hash=get_password_hash("x"))
    session.add(active)
    session.add(fresh)
    await session.commit()
    await session.refresh(active)
    await session.refresh(fresh)

    now = datetime.now(timezone.utc)
    submitted = ExamAttempt(
        user_id=active.id, exam_id=exam.id, status=AttemptStatus.SUBMITTED, started_at=now, submitted_at=now,
        total_score=120.0, max_possible_score=200.0, total_questions=4, total_questions_attempted=4,
        total_correct=2, total_incorrect=2,
    )
    in_progress = ExamAttempt(user_id=active.id, exam_id=other.id, status=AttemptStatus.IN_PROGRESS, started_at=now, total_questions=4)
    session.add(submitted)
    session.add(in_progress)
    await session.commit()
    await session.refresh(submitted)
    await session.refresh(in_progress)

    # (question, chosen option, correct?, answer changes, visits, seconds)
    answers = [
        (1, "A", True, 0, 1, 30.0),   # correct first time
        (2, "A", True, 1, 3, 50.0),   # correct after a change, revisited twice
        (3, "B", False, 0, 2, 40.0),  # near miss
        (4, "C", False, 2, 1, 80.0),  # plain wrong
    ]
    for n, label, correct, switches, visits, secs in answers:
        qid, opt_ids = options[n]
        session.add(ExamQuestionResponse(
            attempt_id=submitted.id, question_id=qid, selected_option_id=opt_ids[label], is_correct=correct,
            option_switch_count=switches, visited_count=visits, time_taken_seconds=secs,
        ))
    # In-progress attempt: 4 seeded rows, 1 answered
    for n in range(1, 5):
        qid, opt_ids = options[n]
        session.add(ExamQuestionResponse(
            attempt_id=in_progress.id, question_id=qid, selected_option_id=opt_ids["A"] if n == 1 else None,
        ))
    await session.commit()

    _state.update(
        users={"active": active.id, "fresh": fresh.id},
        other_exam=other.id,
        in_progress=in_progress.id,
    )


def _h(who: str) -> dict:
    return {"Authorization": f"Bearer {create_access_token(subject=_state['users'][who], role='STUDENT')}"}


@pytest.fixture
async def client(monkeypatch):
    app.dependency_overrides[get_async_session] = _override_session
    # weekly-insights opens its own sessions for parallel queries
    monkeypatch.setattr("app.routers.study_plan.async_session_factory", _session_factory)
    await get_cache().delete_pattern("*")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.get("/api/v1/exam-types")  # any DB-backed call triggers the seed
        await get_cache().delete_pattern("*")
        yield c
    app.dependency_overrides.pop(get_async_session, None)
    await get_cache().delete_pattern("*")


@pytest.mark.anyio
async def test_dashboard_behaviour_is_computed_from_answers(client):
    res = await client.get("/api/v1/attempts/student-dashboard-stats", headers=_h("active"))
    assert res.status_code == 200
    behaviour = res.json()["behaviour"]
    # Only the submitted test counts; the in-progress answer isn't final yet
    assert behaviour == {
        "answered": 4,
        "first_try_correct_pct": 25.0,  # q1
        "near_miss_pct": 25.0,  # q3 picked the 0.8-closeness distractor
        "revisits_per_10": 7.5,  # (0 + 2 + 1 + 0) * 10 / 4
        "answer_changes_per_10": 7.5,  # (0 + 1 + 0 + 2) * 10 / 4
        "avg_seconds_per_question": 50.0,  # (30 + 50 + 40 + 80) / 4
    }

    res = await client.get("/api/v1/attempts/student-dashboard-stats", headers=_h("fresh"))
    assert res.json()["behaviour"] == {"answered": 0}


@pytest.mark.anyio
async def test_in_progress_attempt_reports_real_progress(client):
    res = await client.get("/api/v1/attempts/status-by-exam", headers=_h("active"))
    entry = res.json()[str(_state["other_exam"])]
    assert entry["in_progress_attempt_id"] == _state["in_progress"]
    assert (entry["in_progress_answered"], entry["in_progress_total"]) == (1, 4)


@pytest.mark.anyio
async def test_monthly_benchmark_without_tests_invents_nothing(client):
    res = await client.get("/api/v1/analytics/monthly-benchmark", headers=_h("fresh"))
    assert res.status_code == 200
    data = res.json()
    assert data["period"] == datetime.now(timezone.utc).strftime("%B %Y")
    assert data["predicted_rank"] is None and data["overall_percentile"] is None
    assert data["readiness_index"] is None and data["overall_accuracy"] is None
    assert data["percentile_delta"] is None and data["previous_month_percentile"] is None
    assert data["subject_benchmark"] == []
    assert all(pt["percentile"] is None and pt["tests"] == 0 for pt in data["monthly_growth_curve"])

    res = await client.get("/api/v1/analytics/predicted-rank", headers=_h("fresh"))
    assert res.json()["confidence_level"] == "INSUFFICIENT_DATA"
    assert res.json()["predicted_rank"] is None


@pytest.mark.anyio
async def test_monthly_benchmark_uses_this_months_tests(client):
    data = (await client.get("/api/v1/analytics/monthly-benchmark", headers=_h("active"))).json()
    current = data["monthly_growth_curve"][-1]
    assert current["tests"] == 1
    assert current["percentile"] == _upsc_percentile(120.0)
    assert data["active_aspirants"] == 1  # only "active" started a test in the last 30 days
    assert data["readiness_index"] is not None


@pytest.mark.anyio
async def test_weekly_insights_without_activity_invents_nothing(client):
    data = (await client.get("/api/v1/study-plan/weekly-insights", headers=_h("fresh"))).json()
    assert data["avg_accuracy"] is None
    assert data["top_subject"] is None
    assert data["highlights"] == ["No study activity recorded this week yet."]
    text = " ".join(data["highlights"] + data["focus_next_week"])
    assert "Polity" not in text and "Monetary" not in text and "streak" not in text


def test_readiness_and_percentile_helpers():
    assert _readiness_index(None, 0, 0, None) is None
    # without ICRS the other parts are re-weighted: (0.35*60 + 0.25*40 + 0.20*20) / 0.8 = 43.75
    assert _readiness_index(60.0, 40, 1, None) == 44
    assert _readiness_index(100.0, 500, 10, 100.0) == 100
    assert _upsc_percentile(0) == 0.0
    assert _upsc_percentile(80) == 75.0
    assert _upsc_percentile(250) == 99.99


def _fallback(payload: dict) -> dict:
    out = ReportAISynthesizer._generate_deterministic_fallback(payload)
    CognitiveDiagnosticInsight(**out)  # still schema-valid
    return out


def test_fallback_summary_with_missing_metrics_says_not_measured():
    out = _fallback({})
    text = " ".join(str(v) for v in out.values())
    assert "not measured" in text
    for invented in ("minimal blind impulsive", "prevented severe end-of-test", "minimal late-stage fatigue",
                     "Minor accuracy drop on multi-statement", "60.0s/question"):
        assert invented not in text


def test_fallback_summary_follows_weak_metrics():
    out = _fallback({
        "precalculated_metrics": {
            "scoring": {"net_score": 40.0, "max_score": 200.0, "accuracy_percentage": 35.0, "attempted_count": 50},
            "psychometrics": {
                "gti_aggregate": 0.6, "oeei_score_pct": 20.0, "satoi_score": 30.0, "percentile_rank": 15.0,
                "avg_seconds_per_question": 95.0, "pacing_status": "EARLY_BOTTLENECK_OVERTHINK",
            },
        }
    })
    text = " ".join(str(v) for v in out.values())
    assert "High guessing" in text
    assert "Elimination needs work" in text
    assert "Focus faded" in text
    assert "Core concepts need reinforcement" in text
    assert "Too much time went on some questions" in text
    assert "95.0s/question" in text
