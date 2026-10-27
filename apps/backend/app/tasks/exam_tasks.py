import uuid
import re
import asyncio
from pathlib import Path
from typing import Optional
from sqlmodel import select
from app.tasks.celery_app import celery_app
from app.config.settings import get_settings
from app.config.logger import setup_logger, TaskLoggerAdapter
from app.db.session import managed_async_session, async_init_db
from app.db.models import Exam
from app.pipeline.graph import build_langgraph_pipeline
from app.utils.pdf_utils import get_pdf_total_pages, clear_pdf_cache, ensure_local_pdf
from app.config.filename_parser import parse_question_paper_filename
from app.core.cleanup import cleanup_file

logger = setup_logger("TaskRunner")


@celery_app.task(name="process_exam_pdf_task")
def process_exam_pdf_task(
    exam_id_str: str,
    pdf_path: str,
    exam_title: Optional[str] = None,
    task_id: Optional[str] = None,
    execution_engine: str = "Celery Worker",
):
    """Celery background task to run the LangGraph PDF question extraction pipeline asynchronously."""
    t_id = task_id or str(uuid.uuid4())
    log = TaskLoggerAdapter(logger, task_id=t_id)
    log.info(
        f"⚡ [CELERY WORKER DISPATCH] Processing PDF '{Path(pdf_path).name}' (Task ID: {t_id})"
    )
    return asyncio.run(
        async_process_exam_pdf(
            exam_id_str,
            pdf_path,
            exam_title,
            task_id=t_id,
            execution_engine="Celery Worker",
        )
    )


async def async_process_exam_pdf(
    exam_id_str: Optional[str] = None,
    pdf_path: str = "",
    exam_title: Optional[str] = None,
    task_id: Optional[str] = None,
    execution_engine: str = "FastAPI BackgroundTasks",
):
    """Core async runner for PDF extraction pipeline with full logging and automated temp file cleanup."""
    t_id = task_id or str(uuid.uuid4())
    exam_id_str = exam_id_str or str(uuid.uuid4())
    log = TaskLoggerAdapter(logger, task_id=t_id)

    pdf_file = Path(pdf_path).resolve()
    settings = get_settings()
    output_dir = Path(settings.OUTPUT_ARTIFACTS_DIR) / pdf_file.stem

    # Extract clean human-readable title from PDF filename if not explicitly provided
    if not exam_title or exam_id_str in exam_title:
        try:
            ym = re.search(r"\b(19\d\d|20\d\d)\b", pdf_file.name)
            if not ym.group(1):
                raise ValueError("Exam year not found in filename.")
            yr = int(ym.group(1))
            parsed = parse_question_paper_filename(pdf_file.name, year=yr)
            exam_title = f"{parsed['exam_name'].upper()} {parsed['stage'].title()} ({parsed['year']}) - Set {parsed['raw_set_token']}"
        except Exception:
            exam_title = pdf_file.stem

    log.info("=" * 70)
    log.info(
        f"🚀 [EXTRACTION PIPELINE STARTED] Engine: {execution_engine} | Paper: '{exam_title}' | Task ID: '{t_id}'"
    )
    log.info(f"📄 PDF Filename Stem: '{pdf_file.stem}' | Storage Path: '{pdf_path}'")
    log.info("=" * 70)

    try:
        from app.services.task_registry import task_registry
        exam_id = int(exam_id_str) if exam_id_str and str(exam_id_str).isdigit() else None
        if exam_id:
            task_registry.register_current_task(str(exam_id))

        output_dir.mkdir(parents=True, exist_ok=True)

        log.info(f"Reading total pages from PDF '{pdf_file.name}'...")
        local_pdf = await ensure_local_pdf(pdf_path)
        total_pages = await get_pdf_total_pages(str(local_pdf))
        log.info(f"PDF Page Count: {total_pages} pages detected.")

        # Asynchronously create or update Exam record in DB
        async with managed_async_session() as session:
            exam = await session.get(Exam, exam_id) if exam_id else None
            if not exam:
                try:
                    ym = re.search(r"\b(19\d\d|20\d\d)\b", pdf_file.name)
                    yr = int(ym.group(1)) if ym else 2024
                    parsed = parse_question_paper_filename(pdf_file.name, year=yr)
                    canonical_code = parsed["canonical_code"]
                    paper_set_code = parsed["set_code"]
                    stage = parsed["stage"]
                    subject_code = parsed["subject_code"]
                    source_year = parsed["year"]
                except Exception:
                    canonical_code = pdf_file.stem
                    paper_set_code = "SET_A"
                    stage = "PRELIMS"
                    subject_code = "GS1"
                    source_year = 2024

                code_stmt = select(Exam).where(Exam.code == canonical_code)
                existing_by_code = (await session.exec(code_stmt)).first()
                if existing_by_code:
                    exam = existing_by_code
                    exam_id = exam.id
                    exam.pdf_path = str(pdf_path)
                    exam.total_pages = total_pages
                    if not exam.name or (exam_id_str and exam_id_str in exam.name):
                        exam.name = exam_title
                    session.add(exam)
                    await session.commit()
                else:
                    exam = Exam(
                        code=canonical_code,
                        name=exam_title,
                        stage=stage,
                        subject_code=subject_code,
                        source_year=source_year,
                        paper_set_code=paper_set_code,
                        pdf_path=str(pdf_path),
                        total_pages=total_pages,
                    )
                    session.add(exam)
                    await session.commit()
                    await session.refresh(exam)
                    exam_id = exam.id
                    task_registry.register_current_task(str(exam_id))
                log.info(
                    f"Created Exam DB record for '{exam.code}' (ID: {exam.id}) with total_pages={total_pages}"
                )
            else:
                exam.pdf_path = str(pdf_path)
                exam.total_pages = total_pages
                if not exam.name or exam_id_str in exam.name:
                    exam.name = exam_title
                session.add(exam)
                await session.commit()
                log.info(
                    f"Updated Exam DB record for '{exam.code}' with total_pages={total_pages}"
                )

        if exam_id:
            try:
                from app.services.syllabus_service import SyllabusService
                async with managed_async_session() as syl_session:
                    await SyllabusService(syl_session).sync_or_create_exam_syllabus(exam_id)
            except Exception as syl_err:
                log.warning(f"Could not auto-sync syllabus for exam '{exam_id}': {syl_err}")

        log.info(f"📄 Paper Title: '{exam_title}' | Target Dir: '{output_dir}'")
        log.info("Building LangGraph extraction pipeline graph...")
        pipeline = build_langgraph_pipeline()

        async with managed_async_session() as session:
            from app.services.pipeline_management_service import PipelineManagementService
            pm = PipelineManagementService(session)
            await pm.update_pipeline_status(
                exam_id=exam_id,
                pipeline_type="DOCUMENT_EXTRACTION",
                status="RUNNING",
                current_step="EXTRACTING_DOCUMENT_WITH_DOCLING_OCR",
                progress_percent=30.0,
            )

        log.info(
            f"Invoking LangGraph pipeline across {total_pages} pages with max_concurrency=2..."
        )
        result = await pipeline.ainvoke(
            {
                "pdf_path": str(local_pdf),
                "exam_title": exam_title,
                "exam_id": str(exam_id),
                "output_dir": str(output_dir),
                "total_pages": total_pages,
                "task_id": t_id,
                "execution_pass": 1,
                "retry_count": 0,
                "target_retry_pages": [],
                "raw_page_payloads": [],
                "processed_question_keys": [],
            },
            config={"max_concurrency": get_settings().MAX_VISION_CONCURRENCY},
        )

        async with managed_async_session() as session:
            from app.services.pipeline_management_service import PipelineManagementService
            pm = PipelineManagementService(session)
            await pm.on_pipeline_1_completed(exam_id)

        # Trigger background question translation pipeline (English, Hindi, Marathi only) if enabled
        if settings.ENABLE_TRANSLATION_PIPELINE:
            try:
                from app.tasks.celery_app import has_active_celery_workers
                from app.tasks.translation_tasks import translate_exam_questions_task, async_translate_exam
                from app.core.languages import ACTIVE_TRANSLATION_LANGUAGE_CODES
                
                target_langs = list(ACTIVE_TRANSLATION_LANGUAGE_CODES)

                if has_active_celery_workers():
                    translate_exam_questions_task.delay(str(exam_id), target_languages=target_langs)
                    log.info(f"🌐 Dispatched background translation task to Celery worker for Exam #{exam_id}.")
                else:
                    asyncio.create_task(
                        async_translate_exam(str(exam_id), target_languages=target_langs, execution_engine="BackgroundTasks")
                    )
                    log.info(f"🌐 Dispatched background translation task via asyncio for Exam #{exam_id}.")
            except Exception as trans_err:
                log.warning(f"Could not auto-trigger post-extraction translation for Exam #{exam_id}: {trans_err}")

        # Knowledge Layer enrichment (concepts / entities / relationships) for similar-question retrieval
        from app.tasks.enrichment_tasks import dispatch_exam_enrichment
        dispatch_exam_enrichment(exam_id, log)

        log.info("=" * 70)
        log.info(
            f"✅ [EXTRACTION PIPELINE COMPLETE] Engine: {execution_engine} | Paper: '{exam_title}' | Task ID: '{t_id}'"
        )
        log.info("=" * 70)
        return {
            "status": "SUCCESS",
            "paper_name": pdf_file.stem,
            "total_pages": total_pages,
            "task_id": t_id,
            "execution_engine": execution_engine,
        }

    except asyncio.CancelledError:
        log.warning(
            f"⏹️ [EXTRACTION PIPELINE STOPPED] Exam ID '{exam_id_str}' (Task ID: '{t_id}') was stopped/cancelled."
        )
        try:
            from app.services.pipeline_management_service import PipelineManagementService
            async with managed_async_session() as session:
                pm = PipelineManagementService(session)
                await pm.update_pipeline_status(
                    exam_id=int(exam_id_str),
                    pipeline_type="DOCUMENT_EXTRACTION",
                    status="STOPPED",
                    current_step="CANCELLED_BY_ADMIN",
                    progress_percent=0.0,
                    error_log="Question extraction task stopped by user/admin.",
                )
        except Exception as db_err:
            log.error(f"Failed to update stopped status in DB: {db_err}")
        raise

    except Exception as exc:
        log.error(
            f"❌ [EXTRACTION PIPELINE FAILED] Engine: {execution_engine} | Paper '{pdf_file.stem}' (Task ID: '{t_id}'): {exc}",
            exc_info=True,
        )
        try:
            from app.services.pipeline_management_service import PipelineManagementService
            async with managed_async_session() as session:
                pm = PipelineManagementService(session)
                await pm.update_pipeline_status(
                    exam_id=int(exam_id_str),
                    pipeline_type="DOCUMENT_EXTRACTION",
                    status="FAILED",
                    current_step="FAILED_WITH_ERROR",
                    progress_percent=0.0,
                    error_log=str(exc),
                )
        except Exception:
            pass
        raise
    finally:
        # End-of-pipeline cleanup: remove task-specific temporary processing cache and in-memory bytes
        log.info(f"🧹 Cleaning up temporary processing files and cache for Task ID '{t_id}'...")
        try:
            clear_pdf_cache(pdf_path)
        except Exception:
            pass
        clean_name = str(pdf_path).replace("\\", "/").strip("/").replace("/", "_")
        if not clean_name.lower().endswith(".pdf"):
            clean_name = f"{clean_name}.pdf"
        local_cache_file = Path("./temp_pdf_cache").resolve() / clean_name
        cleanup_file(local_cache_file)
