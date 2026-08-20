import time
import fnmatch
import asyncio
from typing import Any, Optional, Dict, Tuple
from collections import OrderedDict
from app.cache.base import BaseCache
from app.config.logger import setup_logger

logger = setup_logger("InMemoryCache")


class InMemoryCache(BaseCache):
    """
    Bounded In-Memory LRU Cache with TTL expiry.
    Prevents RAM exhaustion by capping total entries at max_size (default 1000 items)
    and automatically evicting oldest/expired entries.
    """

    def __init__(self, max_size: int = 1000, default_ttl: int = 300):
        self.max_size = max(1, max_size)
        self.default_ttl = default_ttl
        # OrderedDict stores key -> (value, expire_at_timestamp)
        self._store: OrderedDict[str, Tuple[Any, Optional[float]]] = OrderedDict()
        self._lock = asyncio.Lock()

    def _is_expired(self, expire_at: Optional[float]) -> bool:
        if expire_at is None:
            return False
        return time.time() > expire_at

    def _prune_expired_sync(self, limit: int = 50) -> None:
        """Prunes a batch of expired keys without blocking."""
        now = time.time()
        expired_keys = [
            k for k, (_, exp) in self._store.items() if exp is not None and now > exp
        ]
        for k in expired_keys[:limit]:
            self._store.pop(k, None)

    async def get(self, key: str) -> Optional[Any]:
        async with self._lock:
            if key not in self._store:
                return None

            val, expire_at = self._store[key]
            if self._is_expired(expire_at):
                self._store.pop(key, None)
                return None

            # Move accessed key to end (MRU)
            self._store.move_to_end(key)
            return val

    async def set(
        self, key: str, value: Any, ttl_seconds: Optional[int] = None
    ) -> bool:
        ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl
        expire_at = (time.time() + ttl) if ttl and ttl > 0 else None

        async with self._lock:
            # Check if key already exists
            if key in self._store:
                self._store[key] = (value, expire_at)
                self._store.move_to_end(key)
                return True

            # Prune any expired items first to make room
            self._prune_expired_sync()

            # Evict oldest entry (LRU) if capacity exceeded
            if len(self._store) >= self.max_size:
                evicted_key, _ = self._store.popitem(last=False)
                logger.debug(
                    f"[IN_MEMORY_CACHE] Capacity reached ({self.max_size}). Evicted oldest key: '{evicted_key}'"
                )

            self._store[key] = (value, expire_at)
            return True

    async def delete(self, key: str) -> bool:
        async with self._lock:
            if key in self._store:
                self._store.pop(key, None)
                return True
            return False

    async def delete_pattern(self, pattern: str) -> int:
        async with self._lock:
            matching_keys = [
                k for k in self._store.keys() if fnmatch.fnmatch(k, pattern)
            ]
            count = 0
            for k in matching_keys:
                if k in self._store:
                    self._store.pop(k, None)
                    count += 1
            return count

    async def exists(self, key: str) -> bool:
        async with self._lock:
            if key not in self._store:
                return False
            _, expire_at = self._store[key]
            if self._is_expired(expire_at):
                self._store.pop(key, None)
                return False
            return True

    async def clear(self) -> bool:
        async with self._lock:
            self._store.clear()
            return True

    async def health_check(self) -> bool:
        return True

    def current_size(self) -> int:
        return len(self._store)
