import os
from typing import Optional
from app.cache.base import BaseCache
from app.cache.redis_cache import RedisCache
from app.cache.memory_cache import InMemoryCache
from app.cache.noop_cache import NoOpCache
from app.cache.fallback_cache import FallbackCache
from app.config.settings import get_settings
from app.config.logger import setup_logger

logger = setup_logger("CacheFactory")

_global_cache: Optional[BaseCache] = None


def get_cache() -> BaseCache:
    """
    Returns the configured singleton BaseCache instance based on environment settings.
    Respects CACHE_ENABLED, CACHE_TYPE, and ENABLE_MEMORY_CACHE_FALLBACK.
    """
    global _global_cache
    if _global_cache is not None:
        return _global_cache

    settings = get_settings()

    if not settings.CACHE_ENABLED or settings.CACHE_TYPE.lower() == "none":
        logger.info("🚫 [CACHE_INIT] Application caching is DISABLED (NoOpCache active).")
        _global_cache = NoOpCache()
        return _global_cache

    cache_type = settings.CACHE_TYPE.lower()
    in_memory_instance = InMemoryCache(
        max_size=settings.CACHE_IN_MEMORY_MAX_SIZE,
        default_ttl=settings.CACHE_DEFAULT_TTL_SECONDS,
    )

    if cache_type == "memory":
        logger.info(
            f"🧠 [CACHE_INIT] In-Memory LRU Cache enabled (Max size: {settings.CACHE_IN_MEMORY_MAX_SIZE} items, Default TTL: {settings.CACHE_DEFAULT_TTL_SECONDS}s)."
        )
        _global_cache = in_memory_instance
        return _global_cache

    # Redis or Auto
    redis_instance = RedisCache(
        redis_url=settings.REDIS_CACHE_URL,
        default_ttl=settings.CACHE_DEFAULT_TTL_SECONDS,
    )

    if settings.ENABLE_MEMORY_CACHE_FALLBACK:
        logger.info(
            f"⚡ [CACHE_INIT] Redis Cache with In-Memory LRU Fallback enabled (Redis: {settings.REDIS_CACHE_URL}, Memory Max: {settings.CACHE_IN_MEMORY_MAX_SIZE})."
        )
        _global_cache = FallbackCache(
            primary=redis_instance,
            fallback=in_memory_instance,
            enable_fallback=True,
        )
    else:
        logger.info(
            f"⚡ [CACHE_INIT] Direct Redis Cache enabled (Redis: {settings.REDIS_CACHE_URL}, Fallback: Disabled)."
        )
        _global_cache = redis_instance

    return _global_cache


def reset_cache_client() -> None:
    """Helper to reset the global cache client for test isolation."""
    global _global_cache
    _global_cache = None
