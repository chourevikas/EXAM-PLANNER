import json
import uuid
from enum import Enum
from datetime import datetime, date
from typing import Any, Optional, Dict, List
import redis.asyncio as aioredis
from app.cache.base import BaseCache
from app.config.logger import setup_logger

logger = setup_logger("RedisCache")


class CacheJSONEncoder(json.JSONEncoder):
    """Custom JSON encoder supporting UUIDs, datetimes, Enums, and Pydantic/SQLModel models."""

    def default(self, obj: Any) -> Any:
        if isinstance(obj, uuid.UUID):
            return str(obj)
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, Enum):
            return obj.value
        if hasattr(obj, "model_dump"):
            return obj.model_dump(mode="json")
        if hasattr(obj, "dict") and callable(getattr(obj, "dict")):
            return obj.dict()
        if isinstance(obj, set):
            return list(obj)
        return super().default(obj)


class RedisCache(BaseCache):
    """
    Production Redis Cache Provider using redis.asyncio.
    Provides fast, persistent, and distributed key-value caching with connection pooling.
    """

    def __init__(self, redis_url: str, default_ttl: int = 300):
        self.redis_url = redis_url
        self.default_ttl = default_ttl
        self._pool = aioredis.ConnectionPool.from_url(
            redis_url,
            decode_responses=True,
            max_connections=50,
            socket_timeout=2.0,
            socket_connect_timeout=2.0,
        )
        self._client = aioredis.Redis(connection_pool=self._pool)

    def _serialize(self, value: Any) -> str:
        return json.dumps(value, cls=CacheJSONEncoder)

    def _deserialize(self, data: Optional[str]) -> Optional[Any]:
        if data is None:
            return None
        try:
            return json.loads(data)
        except Exception as e:
            logger.warning(f"[REDIS_CACHE] JSON deserialization failed: {e}")
            return None

    async def get(self, key: str) -> Optional[Any]:
        try:
            raw = await self._client.get(key)
            data = self._deserialize(raw)
            if data is not None:
                logger.info(f"⚡ [CACHE:HIT] (Redis) Fetched data for key: '{key}'")
            return data
        except Exception as e:
            logger.warning(f"[REDIS_CACHE_ERROR] get('{key}') failed: {e}")
            return None

    async def set(
        self, key: str, value: Any, ttl_seconds: Optional[int] = None
    ) -> bool:
        ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl
        try:
            serialized = self._serialize(value)
            if ttl and ttl > 0:
                await self._client.set(key, serialized, ex=ttl)
            else:
                await self._client.set(key, serialized)
            return True
        except Exception as e:
            logger.warning(f"[REDIS_CACHE_ERROR] set('{key}') failed: {e}")
            return False

    async def delete(self, key: str) -> bool:
        try:
            res = await self._client.delete(key)
            return bool(res)
        except Exception as e:
            logger.warning(f"[REDIS_CACHE_ERROR] delete('{key}') failed: {e}")
            return False

    async def delete_pattern(self, pattern: str) -> int:
        try:
            deleted_count = 0
            keys_batch: List[str] = []
            async for key in self._client.scan_iter(match=pattern, count=100):
                keys_batch.append(key)
                if len(keys_batch) >= 100:
                    deleted_count += await self._client.delete(*keys_batch)
                    keys_batch = []
            if keys_batch:
                deleted_count += await self._client.delete(*keys_batch)
            return deleted_count
        except Exception as e:
            logger.warning(
                f"[REDIS_CACHE_ERROR] delete_pattern('{pattern}') failed: {e}"
            )
            return 0

    async def exists(self, key: str) -> bool:
        try:
            res = await self._client.exists(key)
            return bool(res)
        except Exception as e:
            logger.warning(f"[REDIS_CACHE_ERROR] exists('{key}') failed: {e}")
            return False

    async def clear(self) -> bool:
        try:
            await self._client.flushdb()
            return True
        except Exception as e:
            logger.warning(f"[REDIS_CACHE_ERROR] clear() failed: {e}")
            return False

    async def health_check(self) -> bool:
        try:
            pong = await self._client.ping()
            return bool(pong)
        except Exception:
            return False

    async def close(self) -> None:
        try:
            await self._client.close()
            await self._pool.disconnect()
        except Exception:
            pass
