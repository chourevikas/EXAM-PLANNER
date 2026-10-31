"""Daily LLM spending cap (LLM_DAILY_BUDGET_INR).

Spend is the sum of `llm_usage_events.cost_inr` since midnight IST. Past 80% of the budget an alert goes
to Discord; past 100% report insights switch to the rule-based text until the next IST day. Translation
and the question pipeline are not gated: they are staff-triggered and must finish.
"""
import time
from datetime import datetime, timezone

from sqlalchemy import func
from sqlmodel import select

from app.config.logger import setup_logger
from app.config.settings import settings
from app.services.free_plan import IST, ist_day_bounds

logger = setup_logger("LlmBudget")

WARN_SHARE = 0.8
_CACHE_SECONDS = 60

_cached_spend: tuple[float, float] | None = None  # (monotonic time read, INR)
_alerted: set[tuple[str, str]] = set()  # (IST date, "warn" | "over"), one alert of each kind per day


def _reset_for_tests() -> None:
    global _cached_spend
    _cached_spend = None
    _alerted.clear()


async def spent_today_inr() -> float:
    global _cached_spend
    now = time.monotonic()
    if _cached_spend and now - _cached_spend[0] < _CACHE_SECONDS:
        return _cached_spend[1]

    from app.db.models.llm_usage import LlmUsageEvent
    from app.db.session import managed_async_session

    start, end = ist_day_bounds()
    async with managed_async_session() as session:
        total = (
            await session.exec(
                select(func.coalesce(func.sum(LlmUsageEvent.cost_inr), 0.0)).where(
                    LlmUsageEvent.created_at >= start, LlmUsageEvent.created_at < end
                )
            )
        ).one()
    spend = float(total or 0.0)
    _cached_spend = (now, spend)
    return spend


async def _alert_once(kind: str, spend: float, budget: float) -> None:
    today = datetime.now(timezone.utc).astimezone(IST).date().isoformat()
    if (today, kind) in _alerted:
        return
    _alerted.add((today, kind))

    from app.services.ops_alerts import ERROR_COLOR, WARNING_COLOR, send_discord_alert

    if kind == "over":
        title = "LLM daily budget used up"
        text = "Report insights now use the rule-based text until midnight IST."
        color = ERROR_COLOR
    else:
        title = f"LLM spend past {int(WARN_SHARE * 100)}% of today's budget"
        text = "Report insights switch to the rule-based text when the budget is used up."
        color = WARNING_COLOR
    logger.warning(f"{title}: ₹{spend:.2f} of ₹{budget:.2f}")
    await send_discord_alert(
        title, text, {"Spent today": f"₹{spend:.2f}", "Budget": f"₹{budget:.2f}"}, color=color
    )


async def report_llm_allowed() -> bool:
    """False once today's spend reaches LLM_DAILY_BUDGET_INR. Never raises: on error, allow."""
    budget = settings.LLM_DAILY_BUDGET_INR
    if not budget or budget <= 0:
        return True
    try:
        spend = await spent_today_inr()
        if spend >= budget:
            await _alert_once("over", spend, budget)
            return False
        if spend >= budget * WARN_SHARE:
            await _alert_once("warn", spend, budget)
        return True
    except Exception as err:
        logger.warning(f"Could not check the LLM budget: {err}")
        return True
