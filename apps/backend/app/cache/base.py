from abc import ABC, abstractmethod
from typing import Any, Optional, List, Dict


class BaseCache(ABC):
    """Abstract Base Class for Application Caching Providers."""

    @abstractmethod
    async def get(self, key: str) -> Optional[Any]:
        """
        Retrieve an item from cache by key.
        Returns deserialized object (dict, list, primitive, etc.) or None on miss.
        """
        pass

    @abstractmethod
    async def set(
        self, key: str, value: Any, ttl_seconds: Optional[int] = None
    ) -> bool:
        """
        Store an item in cache with an optional time-to-live (TTL) in seconds.
        Returns True if successful, False otherwise.
        """
        pass

    @abstractmethod
    async def delete(self, key: str) -> bool:
        """
        Delete a single key from cache (Cache Invalidation).
        Returns True if deleted or False.
        """
        pass

    @abstractmethod
    async def delete_pattern(self, pattern: str) -> int:
        """
        Delete all keys matching a wildcard pattern (e.g., 'ep:exams:list*').
        Returns count of keys deleted.
        """
        pass

    @abstractmethod
    async def exists(self, key: str) -> bool:
        """
        Check if a key exists and has not expired.
        """
        pass

    @abstractmethod
    async def clear(self) -> bool:
        """
        Clear all keys managed by this cache instance.
        """
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """
        Check connectivity / availability of the caching backend.
        """
        pass
