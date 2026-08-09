import os
from pathlib import Path

from app.config.logger import setup_logger
from app.config.settings import get_settings
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
    """Returns rate-limited vision LLM instance (Gemini via Vertex AI or OpenAI) configured with retries and timeout."""
    settings = get_settings()
    provider = (settings.LLM_PROVIDER or "vertexai").lower()

    if provider in ("vertexai", "gemini", "google"):
        from langchain_google_genai import ChatGoogleGenerativeAI

        kwargs = {
            "model": settings.GEMINI_MODEL_NAME,
            "vertexai": True,
            "temperature": 0,
            "max_retries": 10,
            "timeout": 120,
            "rate_limiter": get_rate_limiter(),
        }
        if settings.GCP_PROJECT_ID:
            kwargs["project"] = settings.GCP_PROJECT_ID
        if settings.GCP_LOCATION:
            kwargs["location"] = settings.GCP_LOCATION

        cred_path = settings.GOOGLE_APPLICATION_CREDENTIALS or os.environ.get(
            "GOOGLE_APPLICATION_CREDENTIALS"
        )
        if cred_path:
            abs_cred_path = Path(cred_path)
            if not abs_cred_path.is_absolute():
                project_root = Path(__file__).resolve().parent.parent.parent
                possible_paths = [
                    Path.cwd() / cred_path,
                    project_root / cred_path,
                    project_root.parent / cred_path,
                ]
                for parent_dir in Path(__file__).resolve().parents:
                    possible_paths.append(parent_dir / cred_path)

                for p in possible_paths:
                    if p.exists():
                        abs_cred_path = p.resolve()
                        break

            if abs_cred_path.exists():
                os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(abs_cred_path)
                try:
                    from google.oauth2 import service_account

                    kwargs["credentials"] = (
                        service_account.Credentials.from_service_account_file(
                            str(abs_cred_path),
                            scopes=["https://www.googleapis.com/auth/cloud-platform"],
                        )
                    )
                except Exception:
                    logger.exception(
                        "Failed to load Google credentials from path: %s", cred_path
                    )

        return ChatGoogleGenerativeAI(**kwargs)

    elif provider == "openai":
        from langchain_openai import ChatOpenAI

        api_key = settings.OPENAI_API_KEY or os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError(
                "OPENAI_API_KEY is missing from configuration and environment."
            )

        return ChatOpenAI(
            model=settings.OPENAI_MODEL_NAME,
            temperature=0,
            max_retries=10,
            timeout=120,
            api_key=api_key,
            rate_limiter=get_rate_limiter(),
        )
    else:
        raise ValueError(f"Unsupported LLM provider: {provider}")
