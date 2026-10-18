"""Scores use each paper's own marking scheme (stored per question), not UPSC's +2 / -2/3 for every exam."""
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
from app.db.models.analytics import ExamAttempt, ExamQuestionResponse
from app.db.models.enums import AttemptMode, QuestionStatus, QuestionSourceType
from app.core.security import create_access_token, get_password_hash
from app.engine.matrix_orchestrator import MatrixOrchestrator
from app.services.scoring import question_marks

test_engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=False,
)
_state: dict = {}

# (exam code, marks, stored negative marks)
SCHEMES = {"upsc": ("MARK-UPSC", 2.0, 0.66), "mpsc": ("MARK-MPSC", 1.0, 0.25), "nonegative": ("MARK-NONEG", 1.0, 0.0)}


async def _override_session():
    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    async with AsyncSession(test_engine, expire_on_commit=False) as session:
        if not _state:
            await _seed(session)
        yield session


async def _seed(session: AsyncSession):
    exams = {}
    for key, (code, marks, neg) in SCHEMES.items():
        exam = Exam(code=code, name=f"{key.upper()} 2024", source_year=2024, exam_type=QuestionSourceType.PYQ,
                    total_questions=4, total_marks=200.0, is_active=True)
        session.add(exam)
        await session.commit()
        await session.refresh(exam)
        qs = []
        for n in range(1, 5):
            q = Question(exam_id=exam.id, question_number_in_paper=n, status=QuestionStatus.PUBLISHED,
                         marks=marks, negative_marks=neg)
            session.add(q)
            await session.commit()
            await session.refresh(q)
            right = QuestionOption(question_id=q.id, option_label="A", display_order=1, is_correct=True, closeness_score=1.0)
            wrong = QuestionOption(question_id=q.id, option_label="B", display_order=2, closeness_score=0.2)
            session.add_all([right, wrong])
            await session.commit()
            await session.refresh(right)
            await session.refresh(wrong)
            qs.append((q.id, right.id, wrong.id))
        exams[key] = (exam.id, qs)
    u = User(full_name="Marker", email="marker@marks.test", role=UserRole.STUDENT, password_hash=get_password_hash("x"))
    session.add(u)
    await session.commit()
    await session.refresh(u)
    session.add(StudentProfile(user_id=u.id, subscription_tier=SubscriptionTier.PREMIUM))
    await session.commit()
    _state.update(exams=exams, user=u.id)


def _h() -> dict:
    return {"Authorization": f"Bearer {create_access_token(subject=_state['user'], role='STUDENT')}"}


@pytest.fixture
async def client(monkeypatch):
    app.dependency_overrides[get_async_session] = _override_session
    # The analysis pipeline runs after submit; it isn't what these tests check
    monkeypatch.setattr("app.engine.post_submission_pipeline.run_post_submission_pipeline", lambda *a, **k: None, raising=False)
    # Answer keys are cached per exam id in a module-level dict; other test files reuse the same ids
    monkeypatch.setattr("app.engine.post_submission_pipeline.EXAM_SOLUTIONS_SLIDING_CACHE", {})
    await get_cache().delete_pattern("*")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.get("/api/v1/exam-types")  # any DB-backed call triggers the seed
        yield c
    app.dependency_overrides.pop(get_async_session, None)
    await get_cache().delete_pattern("*")


def test_stored_negative_marks_are_read_exactly():
    assert question_marks(2.0, 0.66) == (2.0, 2.0 / 3.0)  # UPSC's -2/3, stored rounded
    assert question_marks(2.0, 0.67) == (2.0, 2.0 / 3.0)
    assert question_marks(1.0, 0.25) == (1.0, 0.25)
    assert question_marks(1.0, 0.0) == (1.0, 0.0)
    assert question_marks(None, None) == (2.0, 2.0 / 3.0)


async def _take(client, key: str):
    """Two right, one wrong, one skipped; returns the submitted attempt."""
    exam_id, qs = _state["exams"][key]
    res = await client.post("/api/v1/attempts/start", json={"exam_id": exam_id, "force_new": True}, headers=_h())
    assert res.status_code == 201, res.text
    attempt_id = int(res.json()["attempt_id"])
    for i, wrong in ((0, False), (1, False), (2, True)):
        qid, right, bad = qs[i]
        r = await client.post(f"/api/v1/attempts/{attempt_id}/responses", headers=_h(), json={
            "question_id": qid, "selected_option_id": bad if wrong else right, "time_spent_seconds": 20})
        assert r.status_code == 200, r.text
    assert (await client.post(f"/api/v1/attempts/{attempt_id}/submit", json={}, headers=_h())).status_code == 200
    async with AsyncSession(test_engine) as s:
        attempt = await s.get(ExamAttempt, attempt_id)
        scores = sorted(r.final_score for r in (await s.exec(
            select(ExamQuestionResponse).where(ExamQuestionResponse.attempt_id == attempt_id))).all())
    return attempt, scores


@pytest.mark.anyio
async def test_submit_scores_each_paper_by_its_own_scheme(client):
    upsc, upsc_scores = await _take(client, "upsc")
    # Unchanged for UPSC: +2 each, -0.6667 for the wrong one, out of 4 x 2
    assert (upsc.total_score, upsc.max_possible_score) == (3.33, 8.0)
    assert upsc_scores == [-0.6667, 0.0, 2.0, 2.0]

    mpsc, mpsc_scores = await _take(client, "mpsc")
    assert (mpsc.total_score, mpsc.max_possible_score) == (1.75, 4.0)
    assert mpsc_scores == [-0.25, 0.0, 1.0, 1.0]

    noneg, noneg_scores = await _take(client, "nonegative")
    assert (noneg.total_score, noneg.max_possible_score) == (2.0, 4.0)
    assert noneg_scores == [0.0, 0.0, 1.0, 1.0]


def _report(marks=None, negative=None):
    responses = []
    for n, (selected, correct) in enumerate((("A", True), ("A", True), ("B", False), (None, False)), 1):
        pos, neg = question_marks(marks, negative)
        item = {
            "question_id": str(n), "question_number": n, "selected_option_id": selected,
            "user_selected_label": selected or "Unattempted", "is_correct": correct,
            "final_score": (pos if correct else -neg) if selected else 0.0,
            "time_taken_seconds": 30.0, "expected_time_seconds": 60.0, "difficulty": "EASY",
            "subject": "Polity", "topic": "Constitution", "subtopic": "Rights",
        }
        if marks is not None:
            item.update(marks=marks, negative_marks=negative)
        responses.append(item)
    return MatrixOrchestrator.compute_full_report(
        attempt_id=1, mode=AttemptMode.EXAM, responses=responses, solutions_data={"questions": []},
    )


def test_report_uses_the_question_marks():
    mpsc = _report(1.0, 0.25)
    assert [q["marks_awarded"] for q in mpsc["part_1_per_question_analysis"]] == [1.0, 1.0, -0.25, 0.0]
    bench = mpsc["part_2_exam_macro_scorecard"]["upsc_prelims_benchmark"]
    assert (bench["positive_marks_earned"], bench["negative_marks_lost"], bench["total_marks_possible"]) == (2.0, 0.25, 4.0)
    # The skipped easy question could have scored 1 mark
    assert mpsc["part_2_exam_macro_scorecard"]["unattempted_summary"]["potential_marks_left_on_table"] == 1.0

    # A report input without marks (older data) is UPSC, exactly as before
    old = _report()
    assert [q["marks_awarded"] for q in old["part_1_per_question_analysis"]] == [2.0, 2.0, -0.67, 0.0]
    bench = old["part_2_exam_macro_scorecard"]["upsc_prelims_benchmark"]
    assert (bench["positive_marks_earned"], bench["negative_marks_lost"], bench["total_marks_possible"]) == (4.0, 0.67, 8.0)


@pytest.mark.anyio
async def test_all_tests_report_adds_up_real_marks(client, monkeypatch):
    """Runs after the submit test: the student has one UPSC, one MPSC and one no-negative attempt."""
    from app.engine.cumulative_analytics_aggregator import CumulativeAnalyticsAggregator
    from app.engine.report_ai_synthesizer import ReportAISynthesizer

    async def no_llm(**kwargs):
        return ReportAISynthesizer.rule_based_insight(**kwargs)

    monkeypatch.setattr(ReportAISynthesizer, "generate_diagnostic_insight", staticmethod(no_llm))
    async with AsyncSession(test_engine, expire_on_commit=False) as s:
        report = await CumulativeAnalyticsAggregator.compute_user_cumulative_report(s, _state["user"], force_recompute=True)
    bench = report["part_2_exam_macro_scorecard"]["upsc_prelims_benchmark"]
    # Gained: UPSC 4 + MPSC 2 + no-negative 2; lost: UPSC 0.6667 + MPSC 0.25 + 0 (UPSC marking for all three would say 12 and 2.0)
    assert (bench["positive_marks_earned"], bench["negative_marks_lost"]) == (8.0, 0.92)
