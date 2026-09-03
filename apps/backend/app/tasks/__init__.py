from app.tasks.celery_app import celery_app
import app.tasks.exam_tasks
import app.tasks.sync_tasks

__all__ = ["celery_app"]
