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

    except Exception as exc:
        log.error(
            f"❌ [EXPLANATION PIPELINE FAILED] Engine: {execution_engine} | Exam ID '{exam_id_str}' (Task ID: '{t_id}'): {exc}",
            exc_info=True,
        )
        raise
