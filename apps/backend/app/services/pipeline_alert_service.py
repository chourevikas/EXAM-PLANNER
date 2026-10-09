"""Admin alerts (email + Discord) for pipeline failures.

Called wherever a PipelineRun is marked FAILED, and for partial failures (e.g. DB batches that
failed to commit during extraction). Alerting must never break the pipeline, so every error here
is logged and swallowed.
"""
import asyncio
import sys
import traceback
from datetime import datetime, timezone
from html import escape
from typing import Optional

import httpx

from app.config.logger import setup_logger
from app.config.settings import settings

logger = setup_logger("PipelineAlerts")

ALERT_TIMEOUT_SECONDS = 10.0
_DISCORD_FIELD_LIMIT = 1024
_DISCORD_DESCRIPTION_LIMIT = 4000


def _alert_recipients() -> list[str]:
    raw = settings.PIPELINE_ALERT_EMAILS or settings.SUPERADMIN_EMAIL or ""
    return [e.strip() for e in raw.split(",") if e.strip()]


def _truncate(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[: limit - 15] + "\n…[truncated]"


def _active_traceback() -> Optional[str]:
    """Traceback of the exception being handled, if the caller is inside an `except` block."""
    if sys.exc_info()[0] is None:
        return None
    return "".join(traceback.format_exc(limit=8))


async def _exam_label(exam_id: Optional[int]) -> str:
    if not exam_id:
        return "Unknown exam"
    try:
        from app.db.models import Exam
        from app.db.session import managed_async_session

        async with managed_async_session() as session:
            exam = await session.get(Exam, exam_id)
            if exam:
                return f"#{exam_id} — {exam.name or exam.code}"
    except Exception as err:
        logger.debug(f"Could not load exam #{exam_id} for alert: {err}")
    return f"#{exam_id}"


async def _send_discord(title: str, exam: str, fields: dict[str, str], error: str, tb: Optional[str]) -> None:
    url = settings.DISCORD_ALERT_WEBHOOK_URL
    if not url:
        return
    description = f"```\n{_truncate(error, _DISCORD_DESCRIPTION_LIMIT - 400)}\n```"
    if tb:
        description += f"\n**Traceback (tail)**\n```\n{_truncate(tb[-1500:], 1500)}\n```"
    payload = {
        "username": "ExamPlanner Alerts",
        # Error text is untrusted: never let it ping @everyone / roles
        "allowed_mentions": {"parse": []},
        "embeds": [
            {
                "title": _truncate(title, 250),
                "description": _truncate(description, _DISCORD_DESCRIPTION_LIMIT),
                "color": 0xDC2626,
                "fields": [{"name": "Exam", "value": _truncate(exam, _DISCORD_FIELD_LIMIT), "inline": False}]
                + [
                    {"name": k, "value": _truncate(v, _DISCORD_FIELD_LIMIT), "inline": True}
                    for k, v in fields.items()
                ],
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        ],
    }
    async with httpx.AsyncClient(timeout=ALERT_TIMEOUT_SECONDS) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
    logger.info(f"🔔 Discord pipeline alert sent: {title}")


async def _send_email(title: str, exam: str, fields: dict[str, str], error: str, tb: Optional[str]) -> None:
    recipients = _alert_recipients()
    if not recipients:
        return
    from app.services.email_service import send_admin_alert_email

    rows = "".join(
        f'<tr><td style="padding:4px 12px 4px 0;color:#64748B;">{escape(k)}</td>'
        f'<td style="padding:4px 0;"><strong>{escape(v)}</strong></td></tr>'
        for k, v in {"Exam": exam, **fields}.items()
    )
    tb_html = (
        f'<p style="margin:16px 0 4px;"><strong>Traceback (tail)</strong></p>'
        f'<pre style="background:#0F172A;color:#E2E8F0;padding:12px;border-radius:6px;font-size:12px;white-space:pre-wrap;">{escape(tb[-3000:])}</pre>'
        if tb
        else ""
    )
    html = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.5; color: #172033; max-width: 680px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #DC2626; padding: 18px 22px; border-radius: 8px; color: white;">
                <h2 style="margin: 0; font-size: 19px;">🚨 {escape(title)}</h2>
            </div>
            <table style="margin-top: 18px; font-size: 14px; border-collapse: collapse;">{rows}</table>
            <p style="margin:16px 0 4px;"><strong>Error</strong></p>
            <pre style="background:#FEF2F2;border-left:4px solid #DC2626;padding:12px;font-size:13px;white-space:pre-wrap;">{escape(_truncate(error, 4000))}</pre>
            {tb_html}
            <div style="margin: 24px 0;">
                <a href="{settings.FRONTEND_URL}/admin" style="background-color: #172033; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">Open Admin Pipeline Queue</a>
            </div>
            <p style="color: #94A3B8; font-size: 12px;">Automated alert from ExamPlanner ({escape(settings.ENVIRONMENT)}).</p>
        </body>
    </html>
    """
    if not await send_admin_alert_email(recipients, f"🚨 [{settings.ENVIRONMENT}] {title}", html):
        raise RuntimeError("email dispatch returned False")


async def notify_pipeline_failure(
    exam_id: Optional[int],
    pipeline_type: str,
    error: Optional[str],
    failed_step: Optional[str] = None,
    details: Optional[dict[str, str]] = None,
    partial: bool = False,
) -> None:
    """Email + Discord the admins about a failed (or partially failed) pipeline run. Never raises."""
    try:
        if not settings.PIPELINE_ALERTS_ENABLED:
            return
        tb = _active_traceback()
        kind = "PARTIALLY FAILED" if partial else "FAILED"
        title = f"{pipeline_type} pipeline {kind}"
        exam = await _exam_label(exam_id)
        fields = {
            "Pipeline": pipeline_type,
            "Failed step": failed_step or "unknown",
            "Environment": settings.ENVIRONMENT,
            "Time (UTC)": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
            **(details or {}),
        }
        error_text = error or "No error message recorded."

        results = await asyncio.wait_for(
            asyncio.gather(
                _send_discord(title, exam, fields, error_text, tb),
                _send_email(title, exam, fields, error_text, tb),
                return_exceptions=True,
            ),
            timeout=ALERT_TIMEOUT_SECONDS * 2,
        )
        for channel, res in zip(("Discord", "email"), results):
            if isinstance(res, Exception):
                logger.error(f"Pipeline failure alert via {channel} failed for exam #{exam_id}: {res}")
    except Exception as err:
        logger.error(f"Pipeline failure alert could not be sent for exam #{exam_id} ({pipeline_type}): {err}")
