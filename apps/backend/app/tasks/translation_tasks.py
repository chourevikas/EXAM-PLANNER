"""
Celery background tasks for Question Translation Pipeline and Midnight Reconciliation.
"""

import uuid
import asyncio
from typing import Optional, List, Dict, Any
from app.tasks.celery_app import celery_app
from app.config.logger import setup_logger, TaskLoggerAdapter
from app.services.translation_service import QuestionTranslationService

logger = setup_logger("TranslationTasks")


@celery_app.task(name="translate_exam_questions_task")
def translate_exam_questions_task(
    exam_id_str: str,
    target_languages: Optional[List[str]] = None,
    task_id: Optional[str] = None,
    execution_engine: str = "Celery Worker",
):
    """Celery background worker entry point to run exam question translation across 22 Indian languages."""
    t_id = task_id or str(uuid.uuid4())
    log = TaskLoggerAdapter(logger, task_id=t_id)
    log.info(f"⚡ [CELERY WORKER DISPATCH] Translating Exam '{exam_id_str}' (Task ID: {t_id})")
    return asyncio.run(
        async_translate_exam(
            exam_id_str=exam_id_str,
            target_languages=target_languages,
            task_id=t_id,
            execution_engine=execution_engine,
        )
    )


async def async_translate_exam(
    exam_id_str: str,
    target_languages: Optional[List[str]] = None,
    task_id: Optional[str] = None,
    execution_engine: str = "FastAPI BackgroundTasks",
) -> Dict[str, Any]:
    """Async runner for exam question translation."""
    t_id = task_id or str(uuid.uuid4())
    log = TaskLoggerAdapter(logger, task_id=t_id)
    exam_id = int(exam_id_str)

    log.info("=" * 70)
    log.info(f"🌐 [TRANSLATION TASK STARTED] Engine: {execution_engine} | Exam ID: {exam_id}")
    log.info("=" * 70)

    service = QuestionTranslationService()
    return await service.translate_exam(
        exam_id=exam_id, target_languages=target_languages, task_id=t_id
    )


@celery_app.task(name="reconcile_missing_translations_task")
def reconcile_missing_translations_task(
    task_id: Optional[str] = None,
    execution_engine: str = "Celery Beat / Midnight Job",
):
    """Midnight automated scheduled maintenance task to backfill any missing translations across all exams."""
    t_id = task_id or str(uuid.uuid4())
    log = TaskLoggerAdapter(logger, task_id=t_id)
    log.info(f"🌙 [CELERY BEAT DISPATCH] Running Midnight Missing Translations Reconciliation (Task ID: {t_id})")
    return asyncio.run(
        async_reconcile_missing_translations(
            task_id=t_id, execution_engine=execution_engine
        )
    )


async def async_reconcile_missing_translations(
    task_id: Optional[str] = None,
    execution_engine: str = "Scheduler",
) -> Dict[str, Any]:
    """Async runner for midnight reconciliation."""
    t_id = task_id or str(uuid.uuid4())
    log = TaskLoggerAdapter(logger, task_id=t_id)
    log.info(f"🌙 [MIDNIGHT RECONCILIATION STARTED] Engine: {execution_engine} (Task ID: {t_id})")

    service = QuestionTranslationService()
    return await service.reconcile_all_missing_translations()
