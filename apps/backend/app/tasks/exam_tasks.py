import uuid
import asyncio
from pathlib import Path
from typing import Optional
from sqlmodel import select
from app.tasks.celery_app import celery_app
from app.config.settings import get_settings
from app.config.logger import setup_logger, TaskLoggerAdapter
from app.db.session import async_session_factory, async_init_db
from app.db.models import Exam
from app.pipeline.graph import build_langgraph_pipeline
from app.pipeline.vision_extractor import get_pdf_total_pages
from app.config.filename_parser import parse_question_paper_filename
from app.core.cleanup import cleanup_temp_artifacts

logger = setup_logger("TaskRunner")


@celery_app.task(name="process_exam_pdf_task")
def process_exam_pdf_task(
    exam_id_str: str,
    pdf_path: str,
    exam_title: Optional[str] = None,
    task_id: Optional[str] = None,
    execution_engine: str = "Celery Worker"
):
    """Celery background task to run the LangGraph PDF question extraction pipeline asynchronously."""
    t_id = task_id or str(uuid.uuid4())
    log = TaskLoggerAdapter(logger, task_id=t_id)
    log.info(f"⚡ [CELERY WORKER DISPATCH] Processing PDF '{Path(pdf_path).name}' (Task ID: {t_id})")
    return asyncio.run(
        async_process_exam_pdf(
            exam_id_str,
            pdf_path,
            exam_title,
            task_id=t_id,
            execution_engine="Celery Worker"
        )
    )


async def async_process_exam_pdf(
    exam_id_str: str,
    pdf_path: str,
    exam_title: Optional[str] = None,
    task_id: Optional[str] = None,
    execution_engine: str = "FastAPI BackgroundTasks"
):
    """Core async runner for PDF extraction pipeline with full logging and automated temp file cleanup."""
    t_id = task_id or str(uuid.uuid4())
    log = TaskLoggerAdapter(logger, task_id=t_id)

    pdf_file = Path(pdf_path).resolve()
    settings = get_settings()
    output_dir = Path(settings.OUTPUT_ARTIFACTS_DIR) / pdf_file.stem

    # Extract clean human-readable title from PDF filename if not explicitly provided
    if not exam_title or exam_id_str in exam_title:
        try:
            parsed = parse_question_paper_filename(pdf_file.name)
            exam_title = f"{parsed['exam_name'].upper()} {parsed['stage'].title()} ({parsed['year']}) - Set {parsed['raw_set_token']}"
        except Exception:
            exam_title = pdf_file.stem

    log.info("=" * 70)
    log.info(f"🚀 [EXTRACTION PIPELINE STARTED] Engine: {execution_engine} | Paper: '{exam_title}' | Task ID: '{t_id}'")
    log.info(f"📄 PDF Filename Stem: '{pdf_file.stem}' | Storage Path: '{pdf_path}'")
    log.info("=" * 70)

    try:
        exam_id = uuid.UUID(exam_id_str)
        output_dir.mkdir(parents=True, exist_ok=True)

        log.info(f"Reading total pages from PDF '{pdf_file.name}'...")
        total_pages = await get_pdf_total_pages(pdf_path)
        log.info(f"PDF Page Count: {total_pages} pages detected.")

        # Ensure database tables exist across worker processes
        await async_init_db()

        # Asynchronously update Exam record
        async with async_session_factory() as session:
            exam = await session.get(Exam, exam_id)
            if exam:
                exam.pdf_path = str(pdf_path)
                exam.total_pages = total_pages
                if not exam.name or exam_id_str in exam.name:
                    exam.name = exam_title
                session.add(exam)
                await session.commit()
                log.info(f"Updated Exam DB record for '{exam.code}' with total_pages={total_pages}")

        log.info(f"📄 Paper Title: '{exam_title}' | Target Dir: '{output_dir}'")
        log.info("Building LangGraph extraction pipeline graph...")
        pipeline = build_langgraph_pipeline()

        log.info(f"Invoking LangGraph pipeline across {total_pages} pages with max_concurrency=2...")
        result = await pipeline.ainvoke(
            {
                "pdf_path": str(pdf_path),
                "exam_title": exam_title,
                "exam_id": str(exam_id),
                "output_dir": str(output_dir),
                "total_pages": total_pages,
                "execution_pass": 1,
                "retry_count": 0,
                "target_retry_pages": [],
                "raw_page_payloads": [],
                "processed_question_keys": []
            },
            config={"max_concurrency": 2}
        )

        log.info("=" * 70)
        log.info(f"✅ [EXTRACTION PIPELINE COMPLETE] Engine: {execution_engine} | Paper: '{exam_title}' | Task ID: '{t_id}'")
        log.info("📁 Output Artifacts Saved To Storage Provider")
        log.info("=" * 70)
        return {
            "status": "SUCCESS",
            "paper_name": pdf_file.stem,
            "total_pages": total_pages,
            "task_id": t_id,
            "execution_engine": execution_engine
        }

    except Exception as exc:
        log.error(f"❌ [EXTRACTION PIPELINE FAILED] Engine: {execution_engine} | Paper '{pdf_file.stem}' (Task ID: '{t_id}'): {exc}", exc_info=True)
        raise
    finally:
        # Automated cleanup of temporary files and temporary output artifact directory
        log.info(f"🧹 Cleaning up temporary processing files for '{pdf_file.name}' (Task ID: '{t_id}')...")
        cleanup_temp_artifacts(pdf_path, output_dir)
