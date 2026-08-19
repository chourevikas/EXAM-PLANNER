from abc import ABC, abstractmethod
from typing import Dict, Any


class BaseSecretLoader(ABC):
    """Abstract base class for modular secret providers."""

    @abstractmethod
    def load_secrets(self) -> Dict[str, Any]:
        """Fetch secrets key-value map from source."""
        pass
