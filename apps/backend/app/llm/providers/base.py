from abc import ABC, abstractmethod
from langchain_core.language_models.chat_models import BaseChatModel


class BaseLLMProvider(ABC):
    """Abstract base class for LLM provider client factories."""

    @abstractmethod
    def get_chat_model(self) -> BaseChatModel:
        """Constructs and returns a configured BaseChatModel instance."""
        pass
