import os
from pathlib import Path
from typing import Optional
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.rate_limiters import InMemoryRateLimiter

from app.config.logger import setup_logger
from app.config.settings import Settings
from app.llm.providers.base import BaseLLMProvider

logger = setup_logger("GeminiProvider")


class GeminiProvider(BaseLLMProvider):
    """LLM Provider implementation for Google Gemini via Vertex AI."""

    def __init__(self, settings: Settings, rate_limiter: Optional[InMemoryRateLimiter] = None):
        self.settings = settings
        self.rate_limiter = rate_limiter

    def get_chat_model(
        self, timeout: Optional[int] = None, max_retries: Optional[int] = None
    ) -> BaseChatModel:
        from langchain_google_genai import ChatGoogleGenerativeAI

        kwargs = {
            "model": self.settings.GEMINI_MODEL_NAME,
            "vertexai": True,
            "temperature": 0,
            "max_retries": max_retries if max_retries is not None else 10,
            "timeout": timeout if timeout is not None else 120,
        }
        if self.rate_limiter:
            kwargs["rate_limiter"] = self.rate_limiter

        if self.settings.GCP_PROJECT_ID:
            kwargs["project"] = self.settings.GCP_PROJECT_ID
        if self.settings.GCP_LOCATION:
            kwargs["location"] = self.settings.GCP_LOCATION

        cred_path = self.settings.GOOGLE_APPLICATION_CREDENTIALS or os.environ.get(
            "GOOGLE_APPLICATION_CREDENTIALS"
        )
        if cred_path:
            abs_cred_path = Path(cred_path)
            if not abs_cred_path.is_absolute():
                project_root = Path(__file__).resolve().parent.parent.parent.parent
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
