"""Admin Translations view: coverage per exam and language, and starting the translation jobs."""
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
from app.db.models.pipeline_run import PipelineRun
from app.db.models.enums import QuestionStatus, QuestionSourceType, LanguageCode as L
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


async def _add(session, obj):
    session.add(obj)
    await session.commit()
    await session.refresh(obj)
    return obj


async def _seed(session: AsyncSession):
    exam = await _add(session, Exam(code="COV-2024", name="UPSC 2024", source_year=2024,
                                    exam_type=QuestionSourceType.PYQ, total_questions=2, is_active=True))
    done = await _add(session, Exam(code="COV-DONE", name="MPSC 2023", source_year=2023,
                                    exam_type=QuestionSourceType.PYQ, total_questions=1, is_active=True))
    dyn = await _add(session, Exam(code="DYN_1_123_abc", name="Subject-wise", is_active=True))

    q1 = await _add(session, Question(exam_id=exam.id, question_number_in_paper=1, status=QuestionStatus.PUBLISHED))
    q2 = await _add(session, Question(exam_id=exam.id, question_number_in_paper=2, status=QuestionStatus.PUBLISHED))
    rejected = await _add(session, Question(exam_id=exam.id, question_number_in_paper=3, status=QuestionStatus.REJECTED))
    qd = await _add(session, Question(exam_id=done.id, question_number_in_paper=1, status=QuestionStatus.PUBLISHED))
    await _add(session, Question(exam_id=dyn.id, question_number_in_paper=1, status=QuestionStatus.PUBLISHED))

    o1 = await _add(session, QuestionOption(question_id=q1.id, option_label="A", display_order=1, is_correct=True))
    o2 = await _add(session, QuestionOption(question_id=q1.id, option_label="B", display_order=2))
    o3 = await _add(session, QuestionOption(question_id=q1.id, option_label="C", display_order=3))
    od = await _add(session, QuestionOption(question_id=qd.id, option_label="A", display_order=1, is_correct=True))
    session.add_all([
        QuestionTranslation(question_id=q1.id, language=L.ENGLISH, question_text="River?"),
        QuestionTranslation(question_id=q2.id, language=L.ENGLISH, question_text="Mountain?"),
        QuestionTranslation(question_id=rejected.id, language=L.ENGLISH, question_text="Rejected?"),
        QuestionTranslation(question_id=q1.id, language=L.HINDI, question_text="नदी?"),
        # A Hindi row identical to the English is a failed translation: not counted
        QuestionTranslation(question_id=q2.id, language=L.HINDI, question_text="Mountain?"),
        QuestionTranslation(question_id=q1.id, language=L.MARATHI, question_text="नदी?"),
        OptionTranslation(option_id=o1.id, language=L.ENGLISH, option_text="Ganga"),
        OptionTranslation(option_id=o2.id, language=L.ENGLISH, option_text="Yamuna", distractor_analysis="Tempting."),
        OptionTranslation(option_id=o1.id, language=L.HINDI, option_text="गंगा"),
        OptionTranslation(option_id=o2.id, language=L.HINDI, option_text="यमुना", distractor_analysis="आकर्षक।"),
        # A year stays the same in Hindi: identical, but translated
        OptionTranslation(option_id=o3.id, language=L.ENGLISH, option_text="1950"),
        OptionTranslation(option_id=o3.id, language=L.HINDI, option_text="1950"),
        QuestionExplanation(question_id=q1.id, language=L.ENGLISH, detailed_solution="Ganga."),
        QuestionExplanation(question_id=q2.id, language=L.ENGLISH, detailed_solution="Everest."),
        QuestionExplanation(question_id=q1.id, language=L.HINDI, detailed_solution="गंगा।"),
        # A fully translated exam
        QuestionTranslation(question_id=qd.id, language=L.ENGLISH, question_text="Capital?"),
        QuestionTranslation(question_id=qd.id, language=L.HINDI, question_text="राजधानी?"),
        QuestionTranslation(question_id=qd.id, language=L.MARATHI, question_text="राजधानी?"),
        OptionTranslation(option_id=od.id, language=L.ENGLISH, option_text="Mumbai"),
        OptionTranslation(option_id=od.id, language=L.HINDI, option_text="मुंबई"),
        OptionTranslation(option_id=od.id, language=L.MARATHI, option_text="मुंबई"),
        PipelineRun(exam_id=done.id, pipeline_type="QUESTION_TRANSLATION", status="COMPLETED",
                    current_step="ALL_22_LANGUAGES_TRANSLATED", progress_percent=100.0),
    ])
    await session.commit()
    users = {}
    for name, role in (("admin", UserRole.ADMIN), ("student", UserRole.STUDENT)):
        u = await _add(session, User(full_name=name.title(), email=f"{name}@cov.test", role=role,
                                     password_hash=get_password_hash("x")))
        users[name] = (u.id, role.value)
    _state.update(exam=exam.id, done=done.id, users=users)


def _h(who: str) -> dict:
    uid, role = _state["users"][who]
    return {"Authorization": f"Bearer {create_access_token(subject=uid, role=role)}"}


@pytest.fixture
async def client(monkeypatch):
    app.dependency_overrides[get_async_session] = _override_session
    await get_cache().delete_pattern("*")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.get("/api/v1/exam-types")  # any DB-backed call triggers the seed
        yield c
    app.dependency_overrides.pop(get_async_session, None)
    await get_cache().delete_pattern("*")


@pytest.mark.anyio
async def test_coverage_per_exam_and_language(client):
    assert (await client.get("/api/v1/admin/translations", headers=_h("student"))).status_code == 403
    res = await client.get("/api/v1/admin/translations", headers=_h("admin"))
    assert res.status_code == 200, res.text
    body = res.json()
    assert [l["code"] for l in body["languages"]] == ["en", "hi", "mr"]
    # Subject-wise (DYN_) tests aren't papers; rejected questions don't count
    assert [e["exam_id"] for e in body["exams"]] == [_state["exam"], _state["done"]]  # most missing first

    exam = body["exams"][0]
    assert (exam["questions"], exam["options"]) == (2, 3)
    assert exam["by_language"] == {
        "en": {"questions": 2, "options": 3, "explanations": 2, "analyses": 1},
        # q2's Hindi row is an English copy (not counted); "1950" is the same in Hindi (counted)
        "hi": {"questions": 1, "options": 3, "explanations": 1, "analyses": 1},
        "mr": {"questions": 1, "options": 0, "explanations": 0, "analyses": 0},
    }
    # hi: 1 question + 1 explanation; mr: 1 question + 3 options + 2 explanations + 1 analysis
    assert exam["missing"] == 9
    assert exam["translation_run"] is None

    done = body["exams"][1]
    assert done["missing"] == 0
    assert done["translation_run"]["status"] == "COMPLETED"
    assert body["totals"]["questions"] == 3 and body["totals"]["missing"] == 9
    assert body["totals"]["by_language"]["hi"]["questions"] == 2


@pytest.mark.anyio
async def test_starting_translation(client, monkeypatch):
    started = []

    async def fake_exam(exam_id):
        started.append(("exam", exam_id))

    async def fake_all():
        started.append(("all", None))

    monkeypatch.setattr("app.routers.translations._translate_exam", fake_exam)
    monkeypatch.setattr("app.routers.translations._translate_all", fake_all)
    import importlib
    # app.tasks exposes a Celery object named celery_app, so patch the module itself
    monkeypatch.setattr(importlib.import_module("app.tasks.celery_app"), "has_active_celery_workers", lambda *a, **k: False)

    base = "/api/v1/admin/translations"
    assert (await client.post(f"{base}/exams/{_state['exam']}", headers=_h("student"))).status_code == 403
    assert (await client.post(f"{base}/exams/999999", headers=_h("admin"))).status_code == 404
    res = await client.post(f"{base}/exams/{_state['exam']}", headers=_h("admin"))
    assert res.status_code == 202 and started == [("exam", _state["exam"])]
    assert (await client.post(f"{base}/run-all", headers=_h("admin"))).status_code == 202
    assert started[-1] == ("all", None)

    # Not twice at once
    async with AsyncSession(test_engine) as s:
        s.add(PipelineRun(exam_id=_state["exam"], pipeline_type="QUESTION_TRANSLATION", status="RUNNING",
                          current_step="TRANSLATING_HINDI", progress_percent=40.0))
        await s.commit()
    assert (await client.post(f"{base}/exams/{_state['exam']}", headers=_h("admin"))).status_code == 409
    assert (await client.post(f"{base}/run-all", headers=_h("admin"))).status_code == 409
    listing = (await client.get(base, headers=_h("admin"))).json()
    run = next(e for e in listing["exams"] if e["exam_id"] == _state["exam"])["translation_run"]
    assert (run["status"], run["progress_percent"]) == ("RUNNING", 40.0)
