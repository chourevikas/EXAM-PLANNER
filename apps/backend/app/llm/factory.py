from typing import Any, Dict, Optional
from app.config.logger import setup_logger
from app.config.settings import get_settings
from app.llm.providers import GeminiProvider
from langchain_core.rate_limiters import InMemoryRateLimiter

_rate_limiters: Dict[float, InMemoryRateLimiter] = {}

logger = setup_logger()


def get_rate_limiter(requests_per_second: Optional[float] = None):
    """Returns a cached rate limiter for the given RPS (default: the shared vision-pipeline limiter).

    Cached per-RPS value so a caller that needs its own throughput budget (e.g. a fast, lightweight
    text call distinct from heavy bulk PDF/vision ingestion) doesn't share a bucket with, and get
    throttled behind, unrelated background jobs.
    """
    settings = get_settings()
    rps = (
        requests_per_second
        if requests_per_second is not None
        else settings.VISION_LLM_RATE_LIMIT_RPS
    )
    if rps not in _rate_limiters:
        _rate_limiters[rps] = InMemoryRateLimiter(
            requests_per_second=rps,
            check_every_n_seconds=0.1,
            max_bucket_size=5,
        )
    return _rate_limiters[rps]


def get_vision_llm(
    timeout: Optional[int] = None,
    max_retries: Optional[int] = None,
    rate_limit_rps: Optional[float] = None,
    feature: str = "unspecified",
    usage_context: Optional[Dict[str, Any]] = None,
):
    """Returns rate-limited vision LLM instance configured with retries and timeout via provider delegator.

    Overrides let a caller with its own failure fallback (so it should fail fast rather than retry for
    minutes) request a shorter timeout/fewer retries and a separate rate-limit bucket, without changing
    behavior for existing callers (bulk PDF ingestion, answer-key extraction, etc.) that omit them.

    `feature` names the product feature the requests belong to (e.g. "translation"); every request is
    recorded in llm_usage_events under it and labelled with it for the GCP billing export.
    `usage_context` (exam_id / attempt_id / user_id / detail) adds to any `llm_usage_scope` context.
    """
    settings = get_settings()
    provider_name = (settings.LLM_PROVIDER or "vertexai").lower()
    rate_limiter = get_rate_limiter(rate_limit_rps)

    if provider_name in ("vertexai", "gemini", "google"):
        provider = GeminiProvider(settings, rate_limiter=rate_limiter)
    else:
        raise ValueError(f"Unsupported LLM provider: {provider_name}")

    callbacks = None
    if settings.LLM_USAGE_TRACKING_ENABLED:
        from app.llm.usage import LlmUsageCallback

        callbacks = [LlmUsageCallback(feature, settings.GEMINI_MODEL_NAME, usage_context)]

    from app.llm.usage import vertex_labels

    return provider.get_chat_model(
        timeout=timeout,
        max_retries=max_retries,
        callbacks=callbacks,
        labels=vertex_labels(feature, settings.ENVIRONMENT),
    )
