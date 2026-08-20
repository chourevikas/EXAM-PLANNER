import unittest
import asyncio
import uuid
import time
from datetime import datetime, timezone
from pydantic import BaseModel

from app.cache.base import BaseCache
from app.cache.memory_cache import InMemoryCache
from app.cache.noop_cache import NoOpCache
from app.cache.fallback_cache import FallbackCache
from app.cache.redis_cache import RedisCache
from app.cache.factory import get_cache, reset_cache_client
from app.cache.decorator import cached
from app.cache.helpers import build_cache_key, generate_filter_hash


class TestCacheLayer(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        reset_cache_client()

    async def asyncTearDown(self):
        reset_cache_client()

    async def test_in_memory_cache_basic_ops(self):
        cache = InMemoryCache(max_size=10, default_ttl=60)
        
        # 1. Set & Get
        await cache.set("test:key1", {"msg": "hello"}, ttl_seconds=10)
        val = await cache.get("test:key1")
        self.assertEqual(val, {"msg": "hello"})

        # 2. Exists
        self.assertTrue(await cache.exists("test:key1"))
        self.assertFalse(await cache.exists("test:nonexistent"))

        # 3. Delete
        deleted = await cache.delete("test:key1")
        self.assertTrue(deleted)
        self.assertIsNone(await cache.get("test:key1"))

        # 4. Clear
        await cache.set("test:k1", "v1")
        await cache.set("test:k2", "v2")
        await cache.clear()
        self.assertIsNone(await cache.get("test:k1"))
        self.assertIsNone(await cache.get("test:k2"))

    async def test_in_memory_cache_ttl_expiration(self):
        cache = InMemoryCache(max_size=10, default_ttl=1)
        
        # Store key with 1s TTL
        await cache.set("exp:key", "value", ttl_seconds=1)
        self.assertEqual(await cache.get("exp:key"), "value")

        # Wait for expiry
        await asyncio.sleep(1.1)
        self.assertIsNone(await cache.get("exp:key"))
        self.assertFalse(await cache.exists("exp:key"))

    async def test_in_memory_cache_lru_bounded_capacity(self):
        # Cache with max 3 items
        cache = InMemoryCache(max_size=3, default_ttl=60)

        await cache.set("k1", "v1")
        await cache.set("k2", "v2")
        await cache.set("k3", "v3")
        self.assertEqual(cache.current_size(), 3)

        # Access k1 to make it most recently used (MRU: k2, k3, k1)
        await cache.get("k1")

        # Add k4 -> should evict least recently used (k2)
        await cache.set("k4", "v4")
        self.assertEqual(cache.current_size(), 3)
        self.assertIsNone(await cache.get("k2"))  # Evicted
        self.assertEqual(await cache.get("k1"), "v1")  # Kept
        self.assertEqual(await cache.get("k3"), "v3")  # Kept
        self.assertEqual(await cache.get("k4"), "v4")  # Kept

    async def test_in_memory_cache_delete_pattern(self):
        cache = InMemoryCache(max_size=20, default_ttl=60)

        await cache.set("ep:exams:list:1", "data1")
        await cache.set("ep:exams:list:2", "data2")
        await cache.set("ep:exams:detail:123", "exam123")
        await cache.set("ep:users:list:1", "users")

        # Delete pattern ep:exams:list*
        deleted_count = await cache.delete_pattern("ep:exams:list*")
        self.assertEqual(deleted_count, 2)
        self.assertIsNone(await cache.get("ep:exams:list:1"))
        self.assertIsNone(await cache.get("ep:exams:list:2"))
        self.assertEqual(await cache.get("ep:exams:detail:123"), "exam123")
        self.assertEqual(await cache.get("ep:users:list:1"), "users")

    async def test_noop_cache(self):
        cache = NoOpCache()
        self.assertIsNone(await cache.get("any_key"))
        self.assertTrue(await cache.set("any_key", "val"))
        self.assertTrue(await cache.delete("any_key"))
        self.assertEqual(await cache.delete_pattern("*"), 0)
        self.assertFalse(await cache.exists("any_key"))

    async def test_fallback_cache_on_failure(self):
        # Primary cache pointing to an unreachable dummy port
        bad_redis = RedisCache(redis_url="redis://127.0.0.1:9999/1", default_ttl=10)
        in_memory = InMemoryCache(max_size=50, default_ttl=60)

        fallback = FallbackCache(primary=bad_redis, fallback=in_memory, enable_fallback=True)

        # Set and Get should transparently use in_memory without raising exceptions
        await fallback.set("fallback:key", {"status": "ok"}, ttl_seconds=30)
        val = await fallback.get("fallback:key")
        self.assertEqual(val, {"status": "ok"})

        # Pattern deletion works on fallback
        deleted = await fallback.delete_pattern("fallback:*")
        self.assertGreaterEqual(deleted, 1)
        self.assertIsNone(await fallback.get("fallback:key"))

    async def test_cached_decorator(self):
        call_count = 0

        @cached(prefix="test_fn", ttl=60)
        async def expensive_computation(x: int, y: int) -> dict:
            nonlocal call_count
            call_count += 1
            return {"result": x + y, "count": call_count}

        # First call: cache miss -> computation executed
        res1 = await expensive_computation(5, 10)
        self.assertEqual(res1["result"], 15)
        self.assertEqual(res1["count"], 1)
        self.assertEqual(call_count, 1)

        # Second call with same args: cache hit -> returned immediately without re-executing
        res2 = await expensive_computation(5, 10)
        self.assertEqual(res2["result"], 15)
        self.assertEqual(res2["count"], 1)
        self.assertEqual(call_count, 1)  # Did NOT increment

        # Call with different args: cache miss -> executes
        res3 = await expensive_computation(10, 20)
        self.assertEqual(res3["result"], 30)
        self.assertEqual(res3["count"], 2)
        self.assertEqual(call_count, 2)

    def test_build_cache_key(self):
        key1 = build_cache_key("exams:list", status="PUBLISHED", is_active=True)
        key2 = build_cache_key("exams:list", is_active=True, status="PUBLISHED")
        # Query param order should not affect the hash
        self.assertEqual(key1, key2)
        self.assertTrue(key1.startswith("ep:exams:list:"))
