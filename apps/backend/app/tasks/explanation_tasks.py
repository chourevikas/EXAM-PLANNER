import uuid
import asyncio
from typing import Optional, List, Dict, Any
from app.tasks.celery_app import celery_app
from app.config.logger import setup_logger, TaskLoggerAdapter
from app.db.session import async_init_db

logger = setup_logger("ExplanationTaskRunner")


@celery_app.task(name="process_exam_explanations_task")
def process_exam_explanations_task(
    exam_id_str: str,
    question_ids: Optional[List[str]] = None,
    language: str = "ENGLISH",
    task_id: Optional[str] = None,
    execution_engine: str = "Celery Worker",
):
    """Celery background task to generate static question explanations and distractor analyses."""
    t_id = task_id or str(uuid.uuid4())
    log = TaskLoggerAdapter(logger, task_id=t_id)
    log.info(
        f"⚡ [CELERY WORKER DISPATCH] Processing Explanations for Exam '{exam_id_str}' Language '{language}' (Task ID: {t_id})"
    )
    return asyncio.run(
        async_process_exam_explanations(
            exam_id_str,
            question_ids=question_ids,
            language=language,
            task_id=t_id,
            execution_engine="Celery Worker",
        )
    )


async def async_process_exam_explanations(
    exam_id_str: str,
    question_ids: Optional[List[str]] = None,
    language: str = "ENGLISH",
    task_id: Optional[str] = None,
    execution_engine: str = "FastAPI BackgroundTasks",
):
    """Core async runner for Phase 3 Explanation & Knowledge Base pipeline."""
    t_id = task_id or str(uuid.uuid4())
    log = TaskLoggerAdapter(logger, task_id=t_id)

    log.info("=" * 70)
    log.info(
        f"🧠 [EXPLANATION PIPELINE STARTED] Engine: {execution_engine} | Exam ID: '{exam_id_str}' | Language: '{language}' | Task ID: '{t_id}'"
    )
    log.info("=" * 70)

    try:
        await async_init_db()
        from app.pipeline.explanation_graph import build_explanation_pipeline
        pipeline = build_explanation_pipeline()

        result = await pipeline.ainvoke(
            {
                "exam_id": exam_id_str,
                "question_ids": question_ids,
                "language": language,
                "task_id": t_id,
                "total_questions": 0,
                "total_explanations_generated": 0,
                "failed_question_ids": [],
            }
        )

        log.info("=" * 70)
        log.info(
            f"✅ [EXPLANATION PIPELINE COMPLETE] Engine: {execution_engine} | Task ID: '{t_id}'"
        )
        log.info(
            f"Total Processed: {result.get('total_questions')} | Explanations Generated: {result.get('total_explanations_generated')}"
        )
        log.info("=" * 70)
        return {**result, "task_id": t_id, "execution_engine": execution_engine}

    except asyncio.CancelledError:
        log.warning(
            f"⏹️ [EXPLANATION PIPELINE STOPPED] Exam ID '{exam_id_str}' (Task ID: '{t_id}') was stopped/cancelled."
        )
        try:
            from app.db.session import async_session_factory
            from app.services.pipeline_management_service import PipelineManagementService
            async with async_session_factory() as session:
                pm = PipelineManagementService(session)
                await pm.update_pipeline_status(
                    exam_id=uuid.UUID(exam_id_str),
                    pipeline_type="EXPLANATION_INDEXING",
                    status="STOPPED",
                    current_step="CANCELLED_BY_ADMIN",
                    progress_percent=0.0,
                    error_log="Explanation pipeline task stopped by user/admin.",
                )
        except Exception as db_err:
            log.error(f"Failed to update stopped status in DB: {db_err}")
        raise

    except Exception as exc:
        log.error(
            f"❌ [EXPLANATION PIPELINE FAILED] Engine: {execution_engine} | Exam ID '{exam_id_str}' (Task ID: '{t_id}'): {exc}",
            exc_info=True,
        )
        try:
            from app.db.session import async_session_factory
            from app.services.pipeline_management_service import PipelineManagementService
            async with async_session_factory() as session:
                pm = PipelineManagementService(session)
                await pm.update_pipeline_status(
                    exam_id=uuid.UUID(exam_id_str),
                    pipeline_type="EXPLANATION_INDEXING",
                    status="FAILED",
                    current_step="FAILED_WITH_ERROR",
                    progress_percent=0.0,
                    error_log=str(exc),
                )
        except Exception:
            pass
        raise
