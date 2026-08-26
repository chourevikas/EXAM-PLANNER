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

celery_app.conf.update(
    imports=[
        "app.tasks.exam_tasks",
        "app.tasks.answer_key_tasks",
        "app.tasks.explanation_tasks",
        "app.tasks.sync_tasks",
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
)

if settings.CELERY_TASK_ALWAYS_EAGER:
    logger.warning(
        "CELERY_TASK_ALWAYS_EAGER is Enabled. Celery tasks will execute synchronously in-memory without Redis broker."
    )


def has_active_celery_workers(timeout: float = 0.2) -> bool:
    """Common utility checking if active Celery worker processes are online and listening on the queue."""
    try:
        i = celery_app.control.inspect(timeout=timeout)
        workers = i.ping()
        return bool(workers)
    except Exception:
        return False
