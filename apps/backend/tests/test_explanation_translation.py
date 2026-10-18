"""Explanations and option analyses are translated from English into Hindi and Marathi.

Only missing rows are added (a reviewer's translation is never overwritten), a failed translation
saves nothing (so the English fallback stays and the next run retries), and each language's
solution shows its own explanation and analysis.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.fastapi_server import app
from app.cache import get_cache
from app.db.session import get_async_session
from app.db.models.hierarchy import Exam
from app.db.models.question import Question, QuestionOption, OptionTranslation, QuestionTranslation
from app.db.models.explanation import QuestionExplanation
from app.db.models.enums import QuestionStatus, QuestionSourceType, LanguageCode
from app.services.explanation_translation_service import translate_explanations
from app.services.google_translation_service import GoogleTranslationService

test_engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=False,
)
_state: dict = {}


class FakeTranslator:
    """Prefixes the language code; text containing FAIL comes back unchanged, like a failed call."""

    def __init__(self):
        self.calls = 0

    async def translate_batch(self, texts, target_language, source_language="en"):
        self.calls += 1
        return [t if "FAIL" in t else f"[{target_language}] {t}" for t in texts]


async def _override_session():
    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    async with AsyncSession(test_engine, expire_on_commit=False) as session:
        if not _state:
            await _seed(session)
        yield session


async def _seed(session: AsyncSession):
    exam = Exam(code="EXPL-2024", name="UPSC (2024) - Set A", source_year=2024, exam_type=QuestionSourceType.PYQ,
                total_questions=3, is_active=True)
    session.add(exam)
    await session.commit()
    await session.refresh(exam)
    qs = []
    for n in (1, 2, 3):
        q = Question(exam_id=exam.id, question_number_in_paper=n, status=QuestionStatus.PUBLISHED)
        session.add(q)
        await session.commit()
        await session.refresh(q)
        qs.append(q.id)
    q1, q2, q3 = qs

    right = QuestionOption(question_id=q1, option_label="A", display_order=1, is_correct=True, closeness_score=1.0)
    wrong = QuestionOption(question_id=q1, option_label="B", display_order=2, closeness_score=0.3)
    session.add_all([right, wrong])
    await session.commit()
    await session.refresh(right)
    await session.refresh(wrong)
    session.add_all([
        QuestionTranslation(question_id=q1, language=LanguageCode.ENGLISH, question_text="Which river is longest?"),
        OptionTranslation(option_id=right.id, language=LanguageCode.ENGLISH, option_text="Ganga"),
        OptionTranslation(option_id=wrong.id, language=LanguageCode.ENGLISH, option_text="Yamuna",
                          distractor_analysis="Tempting because it is a major tributary."),
        # The option text is already in Hindi, its analysis isn't; there is no Marathi option row yet
        OptionTranslation(option_id=right.id, language=LanguageCode.HINDI, option_text="गंगा"),
        OptionTranslation(option_id=wrong.id, language=LanguageCode.HINDI, option_text="यमुना"),
        QuestionExplanation(
            question_id=q1, language=LanguageCode.ENGLISH, detailed_solution="The Ganga is the longest.",
            core_concept="Rivers of India", reverse_logic="Option B is a tributary.",
            common_traps_json=["Confusing length with volume"], key_takeaways_json=["Ganga: 2,525 km"],
        ),
        QuestionExplanation(question_id=q2, language=LanguageCode.ENGLISH, detailed_solution="English solution two."),
        QuestionExplanation(question_id=q2, language=LanguageCode.HINDI, detailed_solution="Reviewer HI समाधान"),
        QuestionExplanation(question_id=q3, language=LanguageCode.ENGLISH, detailed_solution="FAIL this one."),
    ])
    await session.commit()
    _state.update(exam=exam.id, q1=q1, q2=q2, q3=q3, right=right.id, wrong=wrong.id)


@pytest.fixture
async def client():
    app.dependency_overrides[get_async_session] = _override_session
    await get_cache().delete_pattern("*")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.get("/api/v1/exam-types")  # any DB-backed call triggers the seed
        yield c
    app.dependency_overrides.pop(get_async_session, None)
    await get_cache().delete_pattern("*")


async def _explanations(qid) -> dict:
    async with AsyncSession(test_engine) as s:
        rows = (await s.exec(select(QuestionExplanation).where(QuestionExplanation.question_id == qid))).all()
        return {r.language: r for r in rows}


@pytest.mark.anyio
async def test_backfill_adds_missing_translations_only(client):
    q1, q2, q3 = _state["q1"], _state["q2"], _state["q3"]
    # A solution looked at before the backfill is cached; the backfill must not leave it stale
    before = (await client.get(f"/api/v1/questions/{q1}/solution", params={"language": "hi"})).json()
    assert before["explanation"]["detailed_solution"] == "The Ganga is the longest."  # English fallback
    # The Hindi option row has no analysis yet: the English analysis is shown, not nothing
    b_before = before["distractor_scores"][str(_state["wrong"])]
    assert (b_before["text"], b_before["analysis"]) == ("यमुना", "Tempting because it is a major tributary.")

    translator = FakeTranslator()
    async with AsyncSession(test_engine, expire_on_commit=False) as s:
        counts = await translate_explanations(s, translator)
    # q1: hi + mr, q2: mr only (its Hindi came from a reviewer); q3 failed in both languages
    assert counts == {"explanations_added": 3, "analyses_added": 1, "failed": 2}, counts

    e1 = await _explanations(q1)
    hi = e1[LanguageCode.HINDI]
    assert hi.detailed_solution == "[hi] The Ganga is the longest."
    assert (hi.core_concept, hi.reverse_logic) == ("[hi] Rivers of India", "[hi] Option B is a tributary.")
    assert (hi.common_traps_json, hi.key_takeaways_json) == (["[hi] Confusing length with volume"], ["[hi] Ganga: 2,525 km"])
    assert e1[LanguageCode.MARATHI].detailed_solution == "[mr] The Ganga is the longest."
    assert e1[LanguageCode.ENGLISH].detailed_solution == "The Ganga is the longest."  # source untouched

    e2 = await _explanations(q2)
    assert e2[LanguageCode.HINDI].detailed_solution == "Reviewer HI समाधान"  # never overwritten
    assert e2[LanguageCode.MARATHI].detailed_solution == "[mr] English solution two."
    assert set(await _explanations(q3)) == {LanguageCode.ENGLISH}  # nothing saved for a failed translation

    async with AsyncSession(test_engine) as s:
        wrong_rows = {r.language: r for r in (await s.exec(
            select(OptionTranslation).where(OptionTranslation.option_id == _state["wrong"]))).all()}
    assert wrong_rows[LanguageCode.HINDI].distractor_analysis == "[hi] Tempting because it is a major tributary."
    assert wrong_rows[LanguageCode.HINDI].option_text == "यमुना"
    assert LanguageCode.MARATHI not in wrong_rows  # no Marathi option row: nothing invented

    # Running again adds nothing new; the failed one is retried
    async with AsyncSession(test_engine, expire_on_commit=False) as s:
        again = await translate_explanations(s, translator)
    assert again == {"explanations_added": 0, "analyses_added": 0, "failed": 2}

    # Each language's solution shows its own explanation and option analysis (cache was cleared)
    sol = lambda lang: client.get(f"/api/v1/questions/{q1}/solution", params={"language": lang})
    hi_sol = (await sol("hi")).json()
    assert hi_sol["explanation"]["detailed_solution"] == "[hi] The Ganga is the longest."
    b_hi = hi_sol["distractor_scores"][str(_state["wrong"])]
    assert (b_hi["text"], b_hi["analysis"]) == ("यमुना", "[hi] Tempting because it is a major tributary.")
    mr_sol = (await sol("mr")).json()
    assert mr_sol["explanation"]["detailed_solution"] == "[mr] The Ganga is the longest."
    # No Marathi option row: English text and analysis rather than nothing
    b_mr = mr_sol["distractor_scores"][str(_state["wrong"])]
    assert (b_mr["text"], b_mr["analysis"]) == ("Yamuna", "Tempting because it is a major tributary.")
    en_sol = (await sol("en")).json()
    assert en_sol["explanation"]["detailed_solution"] == "The Ganga is the longest."
    b_en = en_sol["distractor_scores"][str(_state["wrong"])]
    assert (b_en["text"], b_en["analysis"]) == ("Yamuna", "Tempting because it is a major tributary.")


@pytest.mark.anyio
async def test_exam_translation_pipeline_includes_explanations(client, monkeypatch):
    from app.services.translation_service import QuestionTranslationService

    exam = Exam(code="EXPL-PIPE", name="MPSC (2024)", source_year=2024, exam_type=QuestionSourceType.PYQ,
                total_questions=1, is_active=True)
    async with AsyncSession(test_engine, expire_on_commit=False) as s:
        s.add(exam)
        await s.commit()
        await s.refresh(exam)
        q = Question(exam_id=exam.id, question_number_in_paper=1, status=QuestionStatus.PUBLISHED)
        s.add(q)
        await s.commit()
        await s.refresh(q)
        s.add_all([
            QuestionTranslation(question_id=q.id, language=LanguageCode.ENGLISH, question_text="Capital of Maharashtra?"),
            QuestionExplanation(question_id=q.id, language=LanguageCode.ENGLISH, detailed_solution="Mumbai is the capital."),
        ])
        await s.commit()
        result = await QuestionTranslationService(session=s, translation_service=FakeTranslator()).translate_exam(
            exam.id, target_languages=["en", "hi", "mr"])
    assert result["status"] == "COMPLETED"
    assert result["explanations_added"] == 2
    rows = await _explanations(q.id)
    assert rows[LanguageCode.MARATHI].detailed_solution == "[mr] Mumbai is the capital."
    assert rows[LanguageCode.HINDI].detailed_solution == "[hi] Mumbai is the capital."


@pytest.mark.anyio
async def test_failed_translation_is_not_remembered(client, monkeypatch):
    """The translator returns the original text when it fails; that must not be cached as the translation."""
    svc = GoogleTranslationService()
    monkeypatch.setattr(svc, "_get_cloud_translate_client", lambda: None)
    outcome = {"fail": True}

    async def fake_gemini(texts, target_language, source_language="en"):
        return list(texts) if outcome["fail"] else [f"अनुवाद {t}" for t in texts]

    monkeypatch.setattr(svc, "_translate_with_gemini", fake_gemini)
    assert await svc.translate_batch(["Retry me please"], target_language="hi") == ["Retry me please"]
    outcome["fail"] = False
    assert await svc.translate_batch(["Retry me please"], target_language="hi") == ["अनुवाद Retry me please"]
