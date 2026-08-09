import uuid
import asyncio
from typing import Dict, Optional, Any
from app.tasks.celery_app import celery_app, has_active_celery_workers
from app.config.logger import setup_logger

logger = setup_logger("TaskRegistry")


class TaskRegistry:
    """Central registry tracking running pipeline tasks (Celery worker tasks & asyncio background tasks)."""

    def __init__(self):
        self._async_tasks: Dict[str, asyncio.Task] = {}
        self._celery_tasks: Dict[str, str] = {}

    def register_async_task(self, key: str, task: asyncio.Task) -> None:
        """Registers an active asyncio Task in memory."""
        self._async_tasks[key] = task

        def _cleanup(t: asyncio.Task):
            if self._async_tasks.get(key) == t:
                self._async_tasks.pop(key, None)

        task.add_done_callback(_cleanup)

    def register_celery_task(self, key: str, celery_task_id: str) -> None:
        """Registers a Celery task ID mapped to exam/pipeline key."""
        self._celery_tasks[key] = celery_task_id

    def cancel_task(self, key: str) -> bool:
        """Cancels or revokes a running task by key (e.g. exam_id)."""
        stopped = False

        # 1. Check & revoke Celery task if present
        celery_id = self._celery_tasks.pop(key, None)
        if celery_id:
            try:
                logger.info(f"🚫 Revoking Celery task '{celery_id}' for key '{key}'...")
                celery_app.control.revoke(celery_id, terminate=True, signal="SIGKILL")
                stopped = True
            except Exception as err:
                logger.error(f"Failed to revoke Celery task '{celery_id}': {err}")

        # 2. Check & cancel local asyncio task if present
        async_task = self._async_tasks.pop(key, None)
        if async_task and not async_task.done():
            logger.info(f"⏹️ Cancelling asyncio task for key '{key}'...")
            async_task.cancel()
            stopped = True

        return stopped

    def is_running(self, key: str) -> bool:
        """Checks if a task is currently registered and running."""
        celery_id = self._celery_tasks.get(key)
        if celery_id:
            res = celery_app.AsyncResult(celery_id)
            if res.state in ("PENDING", "STARTED"):
                return True

        async_task = self._async_tasks.get(key)
        if async_task and not async_task.done():
            return True

        return False


# Global TaskRegistry singleton instance
task_registry = TaskRegistry()
