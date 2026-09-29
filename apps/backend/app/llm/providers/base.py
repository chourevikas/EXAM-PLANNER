from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from langchain_core.language_models.chat_models import BaseChatModel


class BaseLLMProvider(ABC):
    """Abstract base class for LLM provider client factories."""

    @abstractmethod
    def get_chat_model(
        self,
        timeout: Optional[int] = None,
        max_retries: Optional[int] = None,
        callbacks: Optional[List[Any]] = None,
        labels: Optional[Dict[str, str]] = None,
    ) -> BaseChatModel:
        """Constructs and returns a configured BaseChatModel instance.

        `timeout`/`max_retries` override the provider's defaults when given, so callers on a
        user-facing latency budget (e.g. a call with its own fallback) can fail fast instead of
        inheriting settings tuned for long-running background ingestion jobs. `callbacks` observe
        every request (usage tracking); `labels` are billing labels where the provider supports them.
        """
        pass
