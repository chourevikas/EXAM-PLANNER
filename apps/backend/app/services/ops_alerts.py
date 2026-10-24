"""Discord pings for operations events (student feedback, LLM budget).

Alerting must never break the request that triggered it, so every error here is logged and swallowed.
"""
from datetime import datetime, timezone
from typing import Optional

import httpx

from app.config.logger import setup_logger
from app.config.settings import settings

logger = setup_logger("OpsAlerts")

ALERT_TIMEOUT_SECONDS = 10.0
_FIELD_LIMIT = 1024
_DESCRIPTION_LIMIT = 4000

INFO_COLOR = 0x2563EB
WARNING_COLOR = 0xD97706
ERROR_COLOR = 0xDC2626


def _truncate(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[: limit - 15] + "\n…[truncated]"


async def send_discord_alert(
    title: str,
    description: str = "",
    fields: Optional[dict[str, str]] = None,
    color: int = INFO_COLOR,
) -> bool:
    url = settings.DISCORD_ALERT_WEBHOOK_URL
    if not url:
        return False
    payload = {
        "username": "ExamPlanner Alerts",
        # Text can come from students: never let it ping @everyone / roles
        "allowed_mentions": {"parse": []},
        "embeds": [
            {
                "title": _truncate(title, 250),
                "description": _truncate(description, _DESCRIPTION_LIMIT),
                "color": color,
                "fields": [
                    {"name": k, "value": _truncate(v or "—", _FIELD_LIMIT), "inline": True}
                    for k, v in (fields or {}).items()
                ],
                "footer": {"text": settings.ENVIRONMENT},
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        ],
    }
    try:
        async with httpx.AsyncClient(timeout=ALERT_TIMEOUT_SECONDS) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
        return True
    except Exception as err:
        logger.warning(f"Discord alert '{title}' failed: {err}")
        return False
