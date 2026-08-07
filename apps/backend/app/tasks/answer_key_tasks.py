import uuid
import asyncio
from pathlib import Path
from typing import Optional
from app.tasks.celery_app import celery_app
from app.config.settings import get_settings
from app.config.logger import setup_logger, TaskLoggerAdapter
from app.db.session import async_init_db
from app.pipeline.answer_key_graph import build_answer_key_pipeline
from app.config.filename_parser import parse_answer_key_filename
from app.core.cleanup import cleanup_temp_artifacts

logger = setup_logger("TaskRunner")


@celery_app.task(name="process_answer_key_pdf_task")
def process_answer_key_pdf_task(
    exam_id_str: str,
    pdf_path: str,
    target_set_code: str = "SET_A",
    task_id: Optional[str] = None,
    execution_engine: str = "Celery Worker",
):
    """Celery background task to extract answer keys and map correct answers into the database."""
    t_id = task_id or str(uuid.uuid4())
    log = TaskLoggerAdapter(logger, task_id=t_id)
    pdf_name = Path(pdf_path).name
    log.info(
        f"⚡ [CELERY WORKER DISPATCH] Processing Answer Key '{pdf_name}' Target Set '{target_set_code}' (Task ID: {t_id})"
    )
    return asyncio.run(
        async_process_answer_key_pdf(
            exam_id_str,
            pdf_path,
            target_set_code,
            task_id=t_id,
            execution_engine="Celery Worker",
        )
    )


async def async_process_answer_key_pdf(
    exam_id_str: str,
    pdf_path: str,
    target_set_code: str = "SET_A",
    task_id: Optional[str] = None,
    execution_engine: str = "FastAPI BackgroundTasks",
):
    """Core async runner for Answer Key extraction & DB mapping with automated temp file cleanup."""
    t_id = task_id or str(uuid.uuid4())
    log = TaskLoggerAdapter(logger, task_id=t_id)
    pdf_file = Path(pdf_path).resolve()

    try:
        parsed = parse_answer_key_filename(pdf_file.name)
        paper_title = f"{parsed['exam_name'].upper()} {parsed['stage'].title()} ({parsed['year']}) Answer Key"
    except Exception:
        paper_title = pdf_file.stem

    log.info("=" * 70)
    log.info(
        f"🔑 [ANSWER KEY PIPELINE STARTED] Engine: {execution_engine} | Paper: '{paper_title}' | Target Set: '{target_set_code}' | Task ID: '{t_id}'"
    )
    log.info(f"📄 File Name: '{pdf_file.name}' | Storage Path: '{pdf_path}'")
    log.info("=" * 70)

    try:
        await async_init_db()
        pipeline = build_answer_key_pipeline()

        result = await pipeline.ainvoke(
            {
                "pdf_path": pdf_path,
                "exam_id": exam_id_str,
                "target_set_code": target_set_code,
                "total_pages": 0,
                "task_id": t_id,
                "raw_page_payloads": [],
                "batch_id": None,
                "total_keys_extracted": 0,
                "total_keys_mapped": 0,
                "set_match_status": "PENDING",
            }
        )

        log.info("=" * 70)
        log.info(
            f"✅ [ANSWER KEY PIPELINE COMPLETE] Engine: {execution_engine} | Batch ID: {result.get('batch_id')} | Task ID: '{t_id}'"
        )
        log.info(
            f"Paper: '{paper_title}' | Extracted: {result.get('total_keys_extracted')} | Mapped: {result.get('total_keys_mapped')}"
        )
        log.info("=" * 70)

        # Notify PipelineManagementService & Auto-Chain Pipeline 3
        from app.db.session import async_session_factory
        from app.services.pipeline_management_service import PipelineManagementService
        async with async_session_factory() as session:
            pm_service = PipelineManagementService(session)
            await pm_service.on_pipeline_2_completed(
                uuid.UUID(exam_id_str), auto_trigger_pipeline_3=True
            )

        return {**result, "task_id": t_id, "execution_engine": execution_engine}

    except Exception as exc:
        log.error(
            f"❌ [ANSWER KEY PIPELINE FAILED] Engine: {execution_engine} | Paper '{pdf_file.stem}' (Task ID: '{t_id}'): {exc}",
            exc_info=True,
        )
        raise
    finally:
        log.info(
            f"🧹 Cleaning up temporary answer key file '{pdf_file.name}' (Task ID: '{t_id}')..."
        )
        cleanup_temp_artifacts(pdf_path)
