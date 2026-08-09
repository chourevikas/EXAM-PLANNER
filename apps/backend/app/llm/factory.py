from app.config.logger import setup_logger
from app.config.settings import get_settings
from app.llm.providers import GeminiProvider, OpenAIProvider
from langchain_core.rate_limiters import InMemoryRateLimiter

_rate_limiter = None

logger = setup_logger()


def get_rate_limiter():
    global _rate_limiter
    if _rate_limiter is None:
        settings = get_settings()
        _rate_limiter = InMemoryRateLimiter(
            requests_per_second=settings.VISION_LLM_RATE_LIMIT_RPS,
            check_every_n_seconds=0.1,
            max_bucket_size=5,
        )
    return _rate_limiter


def get_vision_llm():
    """Returns rate-limited vision LLM instance configured with retries and timeout via provider delegator."""
    settings = get_settings()
    provider_name = (settings.LLM_PROVIDER or "vertexai").lower()
    rate_limiter = get_rate_limiter()

    if provider_name in ("vertexai", "gemini", "google"):
        provider = GeminiProvider(settings, rate_limiter=rate_limiter)
    elif provider_name == "openai":
        provider = OpenAIProvider(settings, rate_limiter=rate_limiter)
    else:
        raise ValueError(f"Unsupported LLM provider: {provider_name}")

    return provider.get_chat_model()

