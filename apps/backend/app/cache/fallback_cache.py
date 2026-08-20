from typing import Any, Optional
from app.cache.base import BaseCache
from app.config.logger import setup_logger

logger = setup_logger("FallbackCache")


class FallbackCache(BaseCache):
    """
    Resilient multi-backend cache that attempts operations on a primary cache (e.g. RedisCache)
    and automatically falls back to a bounded secondary cache (e.g. InMemoryCache) on connectivity failures.
    """

    def __init__(
        self,
        primary: BaseCache,
        fallback: BaseCache,
        enable_fallback: bool = True,
    ):
        self.primary = primary
        self.fallback = fallback
        self.enable_fallback = enable_fallback
        self._primary_down_warned = False

    async def get(self, key: str) -> Optional[Any]:
        try:
            val = await self.primary.get(key)
            if val is not None:
                self._primary_down_warned = False
                return val
        except Exception as e:
            if not self._primary_down_warned:
                logger.warning(
                    f"⚠️ [CACHE_FALLBACK] Primary cache read failed ({e}). Falling back to In-Memory cache."
                )
                self._primary_down_warned = True

        if self.enable_fallback:
            return await self.fallback.get(key)
        return None

    async def set(
        self, key: str, value: Any, ttl_seconds: Optional[int] = None
    ) -> bool:
        primary_success = False
        try:
            primary_success = await self.primary.set(key, value, ttl_seconds)
            if primary_success:
                self._primary_down_warned = False
        except Exception as e:
            if not self._primary_down_warned:
                logger.warning(
                    f"⚠️ [CACHE_FALLBACK] Primary cache write failed ({e}). Writing to In-Memory cache."
                )
                self._primary_down_warned = True

        if self.enable_fallback:
            # Also store in fallback cache if primary failed or for seamless fallback coverage
            if not primary_success:
                return await self.fallback.set(key, value, ttl_seconds)
        return primary_success

    async def delete(self, key: str) -> bool:
        res1 = False
        try:
            res1 = await self.primary.delete(key)
        except Exception:
            pass

        res2 = False
        if self.enable_fallback:
            res2 = await self.fallback.delete(key)
        return res1 or res2

    async def delete_pattern(self, pattern: str) -> int:
        count1 = 0
        try:
            count1 = await self.primary.delete_pattern(pattern)
        except Exception:
            pass

        count2 = 0
        if self.enable_fallback:
            count2 = await self.fallback.delete_pattern(pattern)
        return max(count1, count2)

    async def exists(self, key: str) -> bool:
        try:
            if await self.primary.exists(key):
                return True
        except Exception:
            pass

        if self.enable_fallback:
            return await self.fallback.exists(key)
        return False

    async def clear(self) -> bool:
        try:
            await self.primary.clear()
        except Exception:
            pass
        if self.enable_fallback:
            await self.fallback.clear()
        return True

    async def health_check(self) -> bool:
        primary_ok = False
        try:
            primary_ok = await self.primary.health_check()
        except Exception:
            primary_ok = False

        if primary_ok:
            return True
        return await self.fallback.health_check() if self.enable_fallback else False
