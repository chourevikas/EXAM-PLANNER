import asyncio
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

# Single-flight registry preventing cache stampedes (thundering herds) across concurrent misses
_in_flight_tasks: Dict[str, asyncio.Future] = {}
_in_flight_lock = asyncio.Lock()


def cached(
    prefix: str,
    ttl: Optional[int] = None,
    key_builder: Optional[Callable[..., str]] = None,
):
    """
    Decorator for caching asynchronous endpoint or service function results.
    1. Checks cache for existing key -> returns if hit (0-2ms).
    2. On miss -> coalesces concurrent callers with single-flight locking -> executes DB operation -> saves to cache.
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

            # Cache stampede protection: single-flight execution for concurrent cache misses
            leader = False
            async with _in_flight_lock:
                if cache_key in _in_flight_tasks:
                    existing_future = _in_flight_tasks[cache_key]
                else:
                    loop = asyncio.get_running_loop()
                    existing_future = loop.create_future()
                    _in_flight_tasks[cache_key] = existing_future
                    leader = True

            if not leader:
                logger.info(f"⏳ [CACHE:COALESCE] Waiting on in-flight DB query for key: '{cache_key}'")
                return await asyncio.shield(existing_future)

            logger.info(f"🔍 [CACHE:MISS] Key '{cache_key}' not in cache -> fetching from database...")

            try:
                # 3. Execute DB operation
                result = await func(*args, **kwargs)

                # 4. Save to Cache on Miss (only if result is not None/empty)
                if result is not None:
                    await cache.set(cache_key, result, ttl_seconds=ttl)

                if not existing_future.done():
                    existing_future.set_result(result)
                return result
            except BaseException as exc:
                if not existing_future.done():
                    existing_future.set_exception(exc)
                raise
            finally:
                async with _in_flight_lock:
                    _in_flight_tasks.pop(cache_key, None)

        return wrapper

    return decorator
