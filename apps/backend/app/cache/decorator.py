import functools
import inspect
from typing import Callable, Any, Optional, Dict
from app.cache.factory import get_cache
from app.cache.helpers import build_cache_key, generate_filter_hash
from app.config.logger import setup_logger

logger = setup_logger("CacheDecorator")

EXCLUDED_ARG_NAMES = {
    "self",
    "cls",
    "session",
    "db",
    "background_tasks",
    "current_user",
    "current_admin",
    "current_super_admin",
    "request",
    "response",
}


def cached(
    prefix: str,
    ttl: Optional[int] = None,
    key_builder: Optional[Callable[..., str]] = None,
):
    """
    Decorator for caching asynchronous endpoint or service function results.
    1. Checks cache for existing key -> returns if hit (0-2ms).
    2. On miss -> executes DB operation -> serializes & saves to cache -> returns result.
    """

    def decorator(func: Callable):
        sig = inspect.signature(func)

        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            cache = get_cache()

            # 1. Generate Cache Key
            if key_builder:
                cache_key = key_builder(*args, **kwargs)
            else:
                # Extract bound arguments
                bound = sig.bind_partial(*args, **kwargs)
                bound.apply_defaults()
                clean_kwargs: Dict[str, Any] = {}
                for k, v in bound.arguments.items():
                    if k not in EXCLUDED_ARG_NAMES:
                        clean_kwargs[k] = v

                cache_key = build_cache_key(prefix, **clean_kwargs)

            # 2. Check Cache
            cached_val = await cache.get(cache_key)
            if cached_val is not None:
                logger.info(f"⚡ [CACHE:HIT] Fetched from cache for key: '{cache_key}'")
                return cached_val

            logger.info(f"🔍 [CACHE:MISS] Key '{cache_key}' not in cache -> fetching from database...")

            # 3. Execute DB operation
            result = await func(*args, **kwargs)

            # 4. Save to Cache on Miss (only if result is not None/empty)
            if result is not None:
                await cache.set(cache_key, result, ttl_seconds=ttl)

            return result

        return wrapper

    return decorator
