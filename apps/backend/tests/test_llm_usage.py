"""LLM usage tracking: token split, cost, feature/context tagging and the stored usage row."""
import asyncio
from typing import Any, List, Optional
from unittest.mock import MagicMock, patch

import pytest
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.outputs import ChatGeneration, ChatResult, LLMResult
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config.settings import Settings
from app.db.models import LlmUsageEvent
from app.llm import usage as usage_mod
from app.llm.usage import (
    LlmUsageCallback,
    compute_cost_usd,
    extract_usage,
    llm_usage_scope,
    vertex_labels,
)

# How langchain-google-genai reports a Gemini 2.5 response: output_tokens includes the thinking
# tokens and input_tokens includes the cached ones
GEMINI_USAGE = {
    "input_tokens": 10_000,
    "output_tokens": 3_000,
    "total_tokens": 13_000,
    "input_token_details": {"cache_read": 2_000},
    "output_token_details": {"reasoning": 2_200},
}


class FakeGemini(BaseChatModel):
    """Chat model that answers with fixed text and Gemini-shaped usage metadata, or fails."""

    fail: bool = False

    @property
    def _llm_type(self) -> str:
        return "fake-gemini"

    def _generate(self, messages: List[BaseMessage], stop: Optional[List[str]] = None, run_manager: Any = None, **kwargs: Any) -> ChatResult:
        if self.fail:
            raise TimeoutError("deadline exceeded")
        message = AIMessage(content='["नमस्ते"]', usage_metadata=GEMINI_USAGE)
        return ChatResult(generations=[ChatGeneration(message=message)])


def _result_with(usage):
    """What callbacks receive: an LLMResult with one list of generations per prompt."""
    return LLMResult(generations=[[ChatGeneration(message=AIMessage(content="x", usage_metadata=usage))]])


def test_extract_usage_separates_thinking_and_cached_tokens():
    assert extract_usage(_result_with(GEMINI_USAGE)) == {
        "input_tokens": 10_000,
        "cached_tokens": 2_000,
        "output_tokens": 800,
        "thinking_tokens": 2_200,
    }


def test_extract_usage_without_thinking_or_metadata():
    no_thinking = {"input_tokens": 50, "output_tokens": 20, "total_tokens": 70, "input_token_details": {"cache_read": 0}}
    assert extract_usage(_result_with(no_thinking)) == {
        "input_tokens": 50, "cached_tokens": 0, "output_tokens": 20, "thinking_tokens": 0,
    }
    empty = LLMResult(generations=[[ChatGeneration(message=AIMessage(content="x"))]])
    assert extract_usage(empty) == {"input_tokens": 0, "cached_tokens": 0, "output_tokens": 0, "thinking_tokens": 0}


def test_cost_prices_cached_input_and_thinking_separately():
    # 8,000 uncached input at $0.30/M + 2,000 cached at $0.03/M + (800 + 2,200) output/thinking at $2.50/M
    cost = compute_cost_usd("gemini-2.5-flash", input_tokens=10_000, cached_tokens=2_000, output_tokens=800, thinking_tokens=2_200)
    assert cost == pytest.approx((8_000 * 0.30 + 2_000 * 0.03 + 3_000 * 2.50) / 1_000_000)
    # Unknown models fall back to gemini-2.5-flash prices rather than being free
    assert compute_cost_usd("gemini-9", 1_000_000, 0, 0, 0) == pytest.approx(0.30)


def test_vertex_labels_use_allowed_characters():
    assert vertex_labels("Knowledge Tagging!", "Production") == {"feature": "knowledge_tagging_", "env": "production"}


def _capture_events(monkeypatch):
    events = []

    async def fake_record(**fields):
        events.append(fields)

    monkeypatch.setattr(usage_mod, "record_usage_event", fake_record)
    return events


def test_callback_records_one_row_per_request_with_feature_scope_and_cost(monkeypatch):
    events = _capture_events(monkeypatch)
    model = FakeGemini(callbacks=[LlmUsageCallback("translation", "gemini-2.5-flash", {"detail": "hi"})])

    async def run():
        with llm_usage_scope(exam_id=30):
            await model.ainvoke("translate")
        await model.ainvoke("outside any scope")

    asyncio.run(run())

    assert len(events) == 2
    first, second = events
    assert first["feature"] == "translation" and first["model"] == "gemini-2.5-flash"
    assert first["status"] == "ok" and first["exam_id"] == 30 and first["detail"] == "hi"
    assert (first["input_tokens"], first["cached_tokens"], first["output_tokens"], first["thinking_tokens"]) == (10_000, 2_000, 800, 2_200)
    expected_usd = compute_cost_usd("gemini-2.5-flash", 10_000, 2_000, 800, 2_200)
    assert first["cost_usd"] == pytest.approx(expected_usd, abs=1e-6)
    assert first["cost_inr"] == pytest.approx(expected_usd * 95.5, abs=1e-3)
    assert first["latency_ms"] is not None and first["latency_ms"] >= 0
    # The scope ended, so the second request is not attributed to exam 30
    assert second["exam_id"] is None and second["detail"] == "hi"


def test_callback_records_failed_requests(monkeypatch):
    events = _capture_events(monkeypatch)
    model = FakeGemini(fail=True, callbacks=[LlmUsageCallback("knowledge_tagging", "gemini-2.5-flash")])

    with pytest.raises(TimeoutError):
        asyncio.run(model.ainvoke("tag"))

    assert len(events) == 1
    assert events[0]["feature"] == "knowledge_tagging"
    assert events[0]["status"] == "error" and "deadline exceeded" in events[0]["error"]


def test_scope_tags_requests_in_spawned_tasks_and_nested_scopes(monkeypatch):
    events = _capture_events(monkeypatch)
    model = FakeGemini(callbacks=[LlmUsageCallback("attempt_report", "gemini-2.5-flash", {"user_id": "7"})])

    async def run():
        with llm_usage_scope(exam_id="12"):
            with llm_usage_scope(attempt_id=99):
                await asyncio.gather(model.ainvoke("a"), model.ainvoke("b"))

    asyncio.run(run())

    assert [(e["exam_id"], e["attempt_id"], e["user_id"]) for e in events] == [(12, 99, 7), (12, 99, 7)]


def test_non_numeric_ids_are_stored_as_null(monkeypatch):
    events = _capture_events(monkeypatch)
    model = FakeGemini(callbacks=[LlmUsageCallback("cumulative_report", "gemini-2.5-flash", {"exam_id": "ALL_EXAMS", "attempt_id": "CUMULATIVE_ALL"})])
    asyncio.run(model.ainvoke("r"))
    assert events[0]["exam_id"] is None and events[0]["attempt_id"] is None


def test_record_usage_event_stores_row_and_never_raises(tmp_path, monkeypatch):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'usage.db'}")
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    monkeypatch.setattr("app.db.session.async_session_factory", factory)

    async def run():
        async with engine.begin() as conn:
            await conn.run_sync(lambda c: SQLModel.metadata.create_all(c, tables=[LlmUsageEvent.__table__]))
        model = FakeGemini(callbacks=[LlmUsageCallback("translation", "gemini-2.5-flash")])
        with llm_usage_scope(exam_id=5, detail="mr"):
            await model.ainvoke("translate")
        async with factory() as session:
            rows = (await session.exec(select(LlmUsageEvent))).all()
        # A failing store (bad field) is logged, not raised
        await usage_mod.record_usage_event(feature="x", model="m", not_a_column=1)
        await engine.dispose()
        return rows

    rows = asyncio.run(run())
    assert len(rows) == 1
    row = rows[0]
    assert (row.feature, row.exam_id, row.detail, row.thinking_tokens, row.status) == ("translation", 5, "mr", 2_200, "ok")
    assert row.cost_inr > 0


@patch("langchain_google_genai.ChatGoogleGenerativeAI")
def test_factory_attaches_usage_callback_and_billing_labels(mock_chat_genai):
    mock_chat_genai.return_value = MagicMock()
    from app.llm.factory import get_vision_llm

    test_settings = Settings(LLM_PROVIDER="vertexai", ENVIRONMENT="production", GEMINI_MODEL_NAME="gemini-2.5-flash")
    with patch("app.llm.factory.get_settings", return_value=test_settings):
        get_vision_llm(feature="translation", usage_context={"exam_id": 3})
    kwargs = mock_chat_genai.call_args.kwargs
    assert kwargs["labels"] == {"feature": "translation", "env": "production"}
    (callback,) = kwargs["callbacks"]
    assert isinstance(callback, LlmUsageCallback)
    assert (callback.feature, callback.model, callback.context) == ("translation", "gemini-2.5-flash", {"exam_id": 3})

    mock_chat_genai.reset_mock()
    with patch("app.llm.factory.get_settings", return_value=Settings(LLM_PROVIDER="vertexai", LLM_USAGE_TRACKING_ENABLED=False)):
        get_vision_llm(feature="translation")
    assert "callbacks" not in mock_chat_genai.call_args.kwargs
