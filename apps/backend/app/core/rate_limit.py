"""Brute-force protection for sign-in: lock an email address after repeated failures.

Counters live in the shared cache (Redis in production, in-memory locally), keyed by email so the
limit cannot be dodged by rotating source IPs. The trade-off is that someone can deliberately lock
a known address for LOGIN_LOCKOUT_MINUTES; the lock only blocks sign-in, never an existing session.
"""
import time
from typing import Optional

from fastapi import HTTPException, status

from app.cache import get_cache
from app.config.settings import settings


def _key(email: str) -> str:
    return f"ep:login-fail:{email.strip().lower()}"


async def _state(email: str) -> dict:
    cached = await get_cache().get(_key(email))
    return cached if isinstance(cached, dict) else {"count": 0, "locked_until": 0}


async def ensure_not_locked(email: str) -> None:
    state = await _state(email)
    remaining = int(state.get("locked_until", 0) - time.time())
    if remaining > 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed sign-in attempts. Try again later.",
            headers={"Retry-After": str(remaining)},
        )


async def record_failure(email: str) -> bool:
    """Count a failed attempt. Returns True when this failure locked the address."""
    state = await _state(email)
    if state.get("locked_until", 0) <= time.time():
        state = {"count": state.get("count", 0), "locked_until": 0}
    state["count"] += 1
    locked = state["count"] >= settings.LOGIN_MAX_FAILED_ATTEMPTS
    if locked:
        state = {"count": 0, "locked_until": time.time() + settings.LOGIN_LOCKOUT_MINUTES * 60}
    await get_cache().set(_key(email), state, ttl_seconds=settings.LOGIN_LOCKOUT_MINUTES * 60)
    return locked


async def reset(email: str) -> None:
    await get_cache().delete(_key(email))
