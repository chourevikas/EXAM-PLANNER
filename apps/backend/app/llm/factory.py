import os
from langchain_core.rate_limiters import InMemoryRateLimiter
from langchain_openai import ChatOpenAI
from app.config.settings import get_settings


_rate_limiter = None


def get_rate_limiter():
    global _rate_limiter
    if _rate_limiter is None:
        settings = get_settings()
        _rate_limiter = InMemoryRateLimiter(
            requests_per_second=settings.VISION_LLM_RATE_LIMIT_RPS,
            check_every_n_seconds=0.1,
            max_bucket_size=5
        )
    return _rate_limiter


def get_vision_llm():
    """Returns rate-limited ChatOpenAI instance configured with retries and long timeout."""
    settings = get_settings()
    api_key = settings.OPENAI_API_KEY or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY is missing from configuration and environment.")

    return ChatOpenAI(
        model=settings.OPENAI_MODEL_NAME,
        temperature=0,
        max_retries=10,
        timeout=120,
        api_key=api_key,
        rate_limiter=get_rate_limiter()
    )
