import time
from typing import Any, Optional
from app.cache.base import BaseCache
from app.config.logger import setup_logger

logger = setup_logger("FallbackCache")


class FallbackCache(BaseCache):
    """
    Resilient multi-backend cache that attempts operations on a primary cache (e.g. RedisCache)
    and automatically falls back to a bounded secondary cache (e.g. InMemoryCache) on connectivity failures.
    Includes a circuit breaker so that once a primary failure occurs, subsequent requests do not wait for timeouts.
    """

    def __init__(
        self,
        primary: BaseCache,
        fallback: BaseCache,
        enable_fallback: bool = True,
        circuit_break_duration: float = 30.0,
    ):
        self.primary = primary
        self.fallback = fallback
        self.enable_fallback = enable_fallback
        self.circuit_break_duration = circuit_break_duration
        self._primary_down_until: float = 0.0
        self._primary_down_warned = False

    def _is_circuit_open(self) -> bool:
        return time.time() < self._primary_down_until

    def _trip_circuit(self, exc: Exception, op: str):
        self._primary_down_until = time.time() + self.circuit_break_duration
        if not self._primary_down_warned:
            logger.warning(
                f"⚠️ [CACHE_FALLBACK] Primary cache {op} failed ({exc}). "
                f"Circuit breaker tripped for {self.circuit_break_duration}s. Falling back to In-Memory cache."
            )
            self._primary_down_warned = True

    async def get(self, key: str) -> Optional[Any]:
        if not self._is_circuit_open():
            try:
                val = await self.primary.get(key)
                if val is not None:
                    self._primary_down_warned = False
                    return val
            except Exception as e:
                self._trip_circuit(e, "read")

        if self.enable_fallback:
            return await self.fallback.get(key)
        return None

    async def set(
        self, key: str, value: Any, ttl_seconds: Optional[int] = None
    ) -> bool:
        primary_success = False
        if not self._is_circuit_open():
            try:
                primary_success = await self.primary.set(key, value, ttl_seconds)
                if primary_success:
                    self._primary_down_warned = False
            except Exception as e:
                self._trip_circuit(e, "write")

        fallback_success = False
        if self.enable_fallback:
            # Keep fallback cache synchronized so fresh data is immediately available during failover
            fallback_success = await self.fallback.set(key, value, ttl_seconds)

        return primary_success or fallback_success

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
