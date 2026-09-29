"""Per-request LLM usage and cost tracking.

Every chat model built by `app.llm.factory.get_vision_llm` carries an `LlmUsageCallback`, which writes
one `llm_usage_events` row per request: the feature that made it, what it was for (exam / attempt /
user), token counts split into input, cached input, visible output and thinking, the cost, latency
and whether it failed. Grouping those rows answers "which feature costs most" and "what does one
exam / one report cost".

Callers name the feature when they build the model; what the request is for comes from
`llm_usage_scope(...)`, which the entry points (translate an exam, enrich an exam, build a report)
open around their work, so deep helpers never need extra parameters.
"""
import contextvars
import time
from contextlib import contextmanager
from typing import Any, Dict, Iterator, Optional, Tuple
from uuid import UUID

from langchain_core.callbacks import AsyncCallbackHandler
from langchain_core.outputs import LLMResult

from app.config.logger import setup_logger

logger = setup_logger("LlmUsage")

# List prices in USD per 1M tokens. Thinking tokens are billed as output.
# https://cloud.google.com/vertex-ai/generative-ai/pricing
MODEL_PRICES_USD_PER_M: Dict[str, Dict[str, float]] = {
    "gemini-2.5-flash": {"input": 0.30, "cached_input": 0.03, "output": 2.50},
    "gemini-2.5-flash-lite": {"input": 0.10, "cached_input": 0.01, "output": 0.40},
    "gemini-2.5-pro": {"input": 1.25, "cached_input": 0.125, "output": 10.00},
}

# What the current request is for; set by llm_usage_scope() around a unit of work
_usage_context: contextvars.ContextVar[Dict[str, Any]] = contextvars.ContextVar("llm_usage_context", default={})


@contextmanager
def llm_usage_scope(**context: Any) -> Iterator[None]:
    """Tags every LLM request made inside the block (including tasks it spawns) with this context.

    Nested scopes add to the outer one: `llm_usage_scope(exam_id=5)` then `llm_usage_scope(detail="hi")`.
    """
    merged = {**_usage_context.get(), **{k: v for k, v in context.items() if v is not None}}
    token = _usage_context.set(merged)
    try:
        yield
    finally:
        _usage_context.reset(token)


def _as_int(value: Any) -> Optional[int]:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def compute_cost_usd(model: str, input_tokens: int, cached_tokens: int, output_tokens: int, thinking_tokens: int) -> float:
    """List-price cost of one request. Unknown models are priced as gemini-2.5-flash (and logged)."""
    prices = MODEL_PRICES_USD_PER_M.get(model)
    if prices is None:
        logger.warning(f"No price for model '{model}'; costing it as gemini-2.5-flash")
        prices = MODEL_PRICES_USD_PER_M["gemini-2.5-flash"]
    uncached = max(0, input_tokens - cached_tokens)
    return (
        uncached * prices["input"]
        + cached_tokens * prices["cached_input"]
        + (output_tokens + thinking_tokens) * prices["output"]
    ) / 1_000_000


def extract_usage(response: LLMResult) -> Dict[str, int]:
    """Token counts from a LangChain result.

    langchain-google-genai reports output_tokens with thinking included and input_tokens with cached
    tokens included; they are split here so each is priced once.
    """
    usage: Dict[str, Any] = {}
    for gens in response.generations or []:
        for gen in gens:
            message = getattr(gen, "message", None)
            if message is not None and getattr(message, "usage_metadata", None):
                usage = message.usage_metadata
                break
        if usage:
            break
    if not usage:
        usage = (response.llm_output or {}).get("usage_metadata") or {}

    input_tokens = int(usage.get("input_tokens") or 0)
    output_with_thinking = int(usage.get("output_tokens") or 0)
    thinking = int((usage.get("output_token_details") or {}).get("reasoning") or 0)
    cached = int((usage.get("input_token_details") or {}).get("cache_read") or 0)
    return {
        "input_tokens": input_tokens,
        "cached_tokens": cached,
        "output_tokens": max(0, output_with_thinking - thinking),
        "thinking_tokens": thinking,
    }


async def record_usage_event(**fields: Any) -> None:
    """Stores one usage row. Never raises: losing a usage row must not fail the request it describes."""
    try:
        from app.db.models import LlmUsageEvent
        from app.db.session import async_session_factory

        async with async_session_factory() as session:
            session.add(LlmUsageEvent(**fields))
            await session.commit()
    except Exception as err:
        logger.warning(f"Could not record LLM usage for feature '{fields.get('feature')}': {err}")


class LlmUsageCallback(AsyncCallbackHandler):
    """Records tokens, cost, latency and outcome of every request made through one chat model."""

    def __init__(self, feature: str, model: str, context: Optional[Dict[str, Any]] = None):
        self.feature = feature
        self.model = model
        self.context = context or {}
        # run_id -> (start time, llm_usage_scope context captured in the caller's task)
        self._started: Dict[UUID, Tuple[float, Dict[str, Any]]] = {}

    def _start(self, run_id: UUID) -> None:
        self._started[run_id] = (time.monotonic(), dict(_usage_context.get()))

    async def on_chat_model_start(self, serialized: Dict[str, Any], messages: Any, *, run_id: UUID, **kwargs: Any) -> None:
        self._start(run_id)

    async def on_llm_start(self, serialized: Dict[str, Any], prompts: Any, *, run_id: UUID, **kwargs: Any) -> None:
        self._start(run_id)

    def _base_fields(self, run_id: UUID) -> Dict[str, Any]:
        started, scope = self._started.pop(run_id, (None, dict(_usage_context.get())))
        context = {**scope, **self.context}
        fields: Dict[str, Any] = {
            "feature": self.feature,
            "model": self.model,
            "latency_ms": int((time.monotonic() - started) * 1000) if started is not None else None,
            "exam_id": _as_int(context.get("exam_id")),
            "attempt_id": _as_int(context.get("attempt_id")),
            "user_id": _as_int(context.get("user_id")),
        }
        detail = context.get("detail")
        fields["detail"] = str(detail)[:128] if detail is not None else None
        return fields

    async def on_llm_end(self, response: LLMResult, *, run_id: UUID, **kwargs: Any) -> None:
        from app.config.settings import get_settings

        tokens = extract_usage(response)
        cost_usd = compute_cost_usd(self.model, **tokens)
        await record_usage_event(
            **self._base_fields(run_id),
            **tokens,
            status="ok",
            cost_usd=round(cost_usd, 6),
            cost_inr=round(cost_usd * get_settings().LLM_USD_TO_INR, 4),
        )

    async def on_llm_error(self, error: BaseException, *, run_id: UUID, **kwargs: Any) -> None:
        # A failed request may still be billed (e.g. a timeout after generation); the tokens are
        # unknown, but counting failures per feature shows where retries burn money
        await record_usage_event(
            **self._base_fields(run_id),
            status="error",
            error=f"{type(error).__name__}: {error}"[:500],
        )


def vertex_labels(feature: str, environment: str) -> Dict[str, str]:
    """Vertex AI request labels (they reach the GCP billing export), in the allowed character set."""
    import re

    def clean(value: str) -> str:
        return re.sub(r"[^a-z0-9_-]", "_", value.lower())[:63] or "unknown"

    return {"feature": clean(feature), "env": clean(environment)}
