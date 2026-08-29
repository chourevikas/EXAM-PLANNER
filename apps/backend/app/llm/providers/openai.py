import os
from typing import Optional
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.rate_limiters import InMemoryRateLimiter

from app.config.settings import Settings
from app.llm.providers.base import BaseLLMProvider


class OpenAIProvider(BaseLLMProvider):
    """LLM Provider implementation for OpenAI models."""

    def __init__(self, settings: Settings, rate_limiter: Optional[InMemoryRateLimiter] = None):
        self.settings = settings
        self.rate_limiter = rate_limiter

    def get_chat_model(
        self, timeout: Optional[int] = None, max_retries: Optional[int] = None
    ) -> BaseChatModel:
        from langchain_openai import ChatOpenAI

        api_key = self.settings.OPENAI_API_KEY or os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError(
                "OPENAI_API_KEY is missing from configuration and environment."
            )

        kwargs = {
            "model": self.settings.OPENAI_MODEL_NAME,
            "temperature": 0,
            "max_retries": max_retries if max_retries is not None else 10,
            "timeout": timeout if timeout is not None else 120,
            "api_key": api_key,
        }
        if self.rate_limiter:
            kwargs["rate_limiter"] = self.rate_limiter

        return ChatOpenAI(**kwargs)
