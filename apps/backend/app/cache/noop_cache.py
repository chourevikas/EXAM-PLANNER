from typing import Any, Optional
from app.cache.base import BaseCache


class NoOpCache(BaseCache):
    """No-Op Cache Provider used when caching is disabled (CACHE_ENABLED=False or CACHE_TYPE='none')."""

    async def get(self, key: str) -> Optional[Any]:
        return None

    async def set(
        self, key: str, value: Any, ttl_seconds: Optional[int] = None
    ) -> bool:
        return True

    async def delete(self, key: str) -> bool:
        return True

    async def delete_pattern(self, pattern: str) -> int:
        return 0

    async def exists(self, key: str) -> bool:
        return False

    async def clear(self) -> bool:
        return True

    async def health_check(self) -> bool:
        return True
