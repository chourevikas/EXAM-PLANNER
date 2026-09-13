from celery import Celery
from app.config.settings import get_settings
from app.config.logger import setup_logger

logger = setup_logger("CeleryApp")
settings = get_settings()

celery_app = Celery(
    "exam_platform_tasks",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

from celery.schedules import crontab

celery_app.conf.update(
    imports=[
        "app.tasks.exam_tasks",
        "app.tasks.sync_tasks",
        "app.tasks.translation_tasks",
    ],  # Explicitly import task modules for Celery autodiscovery
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,
    task_always_eager=settings.CELERY_TASK_ALWAYS_EAGER,
    task_eager_propagates=True,
    beat_schedule={
        "reconcile_missing_translations_midnight": {
            "task": "reconcile_missing_translations_task",
            "schedule": crontab(hour=0, minute=0),  # Runs daily at midnight UTC
        },
    },
)

if settings.CELERY_TASK_ALWAYS_EAGER:
    logger.warning(
        "CELERY_TASK_ALWAYS_EAGER is Enabled. Celery tasks will execute synchronously in-memory without Redis broker."
    )


import time
from typing import Any, Dict

_worker_cache: Dict[str, Any] = {"status": False, "expires_at": 0.0}


def has_active_celery_workers(timeout: float = 0.2) -> bool:
    """Common utility checking if active Celery worker processes are online and listening on the queue.

    Optimized with short in-memory cache (5s) to prevent blocking broker inspection overhead
    on high-frequency status checks, and returns True immediately in eager execution mode.
    """
    if settings.CELERY_TASK_ALWAYS_EAGER:
        return True

    now = time.monotonic()
    if now < _worker_cache["expires_at"]:
        return bool(_worker_cache["status"])

    try:
        i = celery_app.control.inspect(timeout=timeout)
        workers = i.ping()
        is_active = bool(workers)
        _worker_cache["status"] = is_active
        _worker_cache["expires_at"] = now + 5.0
        return is_active
    except Exception:
        _worker_cache["status"] = False
        _worker_cache["expires_at"] = now + 2.0
        return False
