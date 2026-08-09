import uuid
import asyncio
from pathlib import Path
from typing import Optional, Any
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, BackgroundTasks, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.session import get_async_session
from app.services.pipeline_management_service import PipelineManagementService
from app.services.task_registry import task_registry
from app.utils.file_utils import save_upload_file_temp
from app.tasks.exam_tasks import async_process_exam_pdf, process_exam_pdf_task
from app.tasks.answer_key_tasks import async_process_answer_key_pdf, process_answer_key_pdf_task
from app.tasks.explanation_tasks import async_process_exam_explanations, process_exam_explanations_task
from app.tasks.celery_app import has_active_celery_workers
from app.config.filename_parser import parse_question_paper_filename, parse_answer_key_filename
from app.config.logger import setup_logger

logger = setup_logger("PipelineRouter")
router = APIRouter(prefix="/pipeline", tags=["Pipeline Management"])
def _clean_uuid_str(val: Any) -> str:
    return str(val).strip().strip('"').strip("'").strip()


def parse_exam_id_or_generate(raw_id: Optional[str]) -> uuid.UUID:
    """Parses raw_id string into uuid.UUID, or generates fresh uuid.uuid4() if empty/None."""
    if not raw_id:
        return uuid.uuid4()
    cleaned = _clean_uuid_str(raw_id)
    if not cleaned:
        return uuid.uuid4()
    try:
        return uuid.UUID(cleaned)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid 'exam_id': '{raw_id}'. Value must be a valid UUID/GUID (e.g. '6884bea7-6a8d-44b2-a1ad-c2749970083b' or '6884bea76a8d44b2a1adc2749970083b')."
        )


def parse_required_exam_id(raw_id: Any) -> uuid.UUID:
    """Parses required raw_id into uuid.UUID with clear error response."""
    if isinstance(raw_id, uuid.UUID):
        return raw_id
    if not raw_id:
        raise HTTPException(
            status_code=400,
            detail="Missing required 'exam_id'. Value must be a valid UUID/GUID."
        )
    cleaned = _clean_uuid_str(raw_id)
    if not cleaned:
        raise HTTPException(
            status_code=400,
            detail="Missing required 'exam_id'. Value must be a valid UUID/GUID."
        )
    try:
        return uuid.UUID(cleaned)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid 'exam_id': '{raw_id}'. Value must be a valid UUID/GUID (e.g. '6884bea7-6a8d-44b2-a1ad-c2749970083b' or '6884bea76a8d44b2a1adc2749970083b')."
        )


@router.post("/upload-question-paper", status_code=status.HTTP_202_ACCEPTED)
async def upload_question_paper(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    exam_id: Optional[str] = Form(default=None),
    db: AsyncSession = Depends(get_async_session),
):
    """Uploads a Question Paper PDF and initiates Pipeline 1 (Question Extraction)."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400, detail="Only PDF files are supported for Question Paper processing."
        )

    try:
        parse_question_paper_filename(file.filename)
    except ValueError as val_err:
        raise HTTPException(
            status_code=400,
            detail=f"Filename validation failed: {str(val_err)}"
        )

    temp_dir = Path("./temp_uploads").resolve()
    temp_path = await save_upload_file_temp(file, temp_dir)

    target_exam_id = parse_exam_id_or_generate(exam_id)
    task_id = f"p1_{uuid.uuid4().hex[:8]}"
    logger.info(f"Received Question Paper upload '{file.filename}'. Exam ID: '{target_exam_id}', Temp path: '{temp_path}'")

    # Record Pipeline 1 initialization in Database
    pm_service = PipelineManagementService(db)
    await pm_service.update_pipeline_status(
        exam_id=target_exam_id,
        pipeline_type="QUESTION_EXTRACTION",
        status="RUNNING",
        current_step="PDF_UPLOADED_STARTING_QUESTION_EXTRACTION",
        progress_percent=5.0,
    )

    key = str(target_exam_id)
    if has_active_celery_workers():
        celery_res = process_exam_pdf_task.delay(str(target_exam_id), str(temp_path), task_id=task_id)
        task_registry.register_celery_task(key, celery_res.id)
    else:
        task = asyncio.create_task(
            async_process_exam_pdf(
                exam_id_str=str(target_exam_id),
                pdf_path=str(temp_path),
                task_id=task_id,
                execution_engine="FastAPI BackgroundTasks",
            )
        )
        task_registry.register_async_task(key, task)

    return {
        "status": "PIPELINE_1_INITIATED",
        "exam_id": str(target_exam_id),
        "task_id": task_id,
        "filename": file.filename,
        "message": "Question paper extraction pipeline has started.",
    }


@router.post("/upload-answer-key", status_code=status.HTTP_202_ACCEPTED)
async def upload_answer_key(
    background_tasks: BackgroundTasks,
    exam_id: str = Form(...),
    target_set_code: str = Form(default="SET_A"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_async_session),
):
    """Uploads an Answer Key file, initiates Pipeline 2, and automatically triggers Pipeline 3 upon completion."""
    target_exam_uuid = parse_required_exam_id(exam_id)

    if not file.filename:
        raise HTTPException(status_code=400, detail="Answer key file name is required.")

    try:
        parse_answer_key_filename(file.filename)
    except ValueError as val_err:
        raise HTTPException(
            status_code=400,
            detail=f"Filename validation failed: {str(val_err)}"
        )

    temp_dir = Path("./temp_uploads").resolve()
    temp_path = await save_upload_file_temp(file, temp_dir)

    task_id = f"p2_{uuid.uuid4().hex[:8]}"
    logger.info(
        f"Received Answer Key upload for Exam '{exam_id}'. Set: '{target_set_code}'. Temp path: '{temp_path}'"
    )

    pm_service = PipelineManagementService(db)
    await pm_service.update_pipeline_status(
        exam_id=target_exam_uuid,
        pipeline_type="ANSWER_KEY",
        status="RUNNING",
        current_step="PROCESSING_ANSWER_KEY_FILE",
        progress_percent=10.0,
    )

    key = str(exam_id)
    if has_active_celery_workers():
        celery_res = process_answer_key_pdf_task.delay(
            str(exam_id), str(temp_path), target_set_code=target_set_code, task_id=task_id
        )
        task_registry.register_celery_task(key, celery_res.id)
    else:
        task = asyncio.create_task(
            async_process_answer_key_pdf(
                exam_id_str=str(exam_id),
                pdf_path=str(temp_path),
                target_set_code=target_set_code,
                task_id=task_id,
                execution_engine="FastAPI BackgroundTasks",
            )
        )
        task_registry.register_async_task(key, task)

    return {
        "status": "PIPELINE_2_INITIATED",
        "exam_id": str(exam_id),
        "task_id": task_id,
        "target_set_code": target_set_code,
        "message": "Answer key pipeline started. Pipeline 3 will run automatically upon completion.",
    }


@router.get("/status/{exam_id}")
async def get_exam_pipeline_status(
    exam_id: str,
    db: AsyncSession = Depends(get_async_session),
):
    """Fetches real-time status of all 3 pipelines for an exam paper for the frontend dashboard."""
    target_uuid = parse_required_exam_id(exam_id)
    pm_service = PipelineManagementService(db)
    return await pm_service.get_exam_pipeline_overview(target_uuid)


@router.post("/trigger-explanation/{exam_id}", status_code=status.HTTP_202_ACCEPTED)
async def trigger_explanation_pipeline(
    exam_id: str,
    background_tasks: BackgroundTasks,
    language: str = "ENGLISH",
    db: AsyncSession = Depends(get_async_session),
):
    """Manual endpoint allowing admins to trigger or re-run Pipeline 3 (Explanation & Multi-Concept Indexing)."""
    target_uuid = parse_required_exam_id(exam_id)
    pm_service = PipelineManagementService(db)
    await pm_service.update_pipeline_status(
        exam_id=target_uuid,
        pipeline_type="EXPLANATION_INDEXING",
        status="RUNNING",
        current_step="MANUAL_TRIGGER_EXPLANATION_PIPELINE",
        progress_percent=0.0,
    )

    task_id = f"p3_{uuid.uuid4().hex[:8]}"
    key = str(target_uuid)

    if has_active_celery_workers():
        celery_res = process_exam_explanations_task.delay(
            str(target_uuid), language=language, task_id=task_id
        )
        task_registry.register_celery_task(key, celery_res.id)
    else:
        task = asyncio.create_task(
            async_process_exam_explanations(
                exam_id_str=str(target_uuid),
                language=language,
                task_id=task_id,
                execution_engine="FastAPI BackgroundTasks",
            )
        )
        task_registry.register_async_task(key, task)

    return {
        "status": "PIPELINE_3_INITIATED",
        "exam_id": str(target_uuid),
        "task_id": task_id,
        "language": language,
        "message": "Explanation and multi-concept indexing pipeline has started.",
    }


@router.post("/stop/{exam_id}")
async def stop_pipeline_task(
    exam_id: str,
    db: AsyncSession = Depends(get_async_session),
):
    """Stops/cancels any running background pipeline task for the given exam_id."""
    target_uuid = parse_required_exam_id(exam_id)
    key = str(target_uuid)
    stopped = task_registry.cancel_task(key)

    pm_service = PipelineManagementService(db)
    runs_overview = await pm_service.get_exam_pipeline_overview(target_uuid)

    # Mark active RUNNING pipelines as STOPPED in DB
    for p_type, r_data in runs_overview.get("pipelines", {}).items():
        if isinstance(r_data, dict) and r_data.get("status") == "RUNNING":
            await pm_service.update_pipeline_status(
                exam_id=target_uuid,
                pipeline_type=p_type,
                status="STOPPED",
                current_step="STOPPED_BY_ADMIN",
                progress_percent=0.0,
                error_log="Pipeline execution stopped by admin request.",
            )

    return {
        "status": "STOPPED",
        "exam_id": str(target_uuid),
        "task_stopped": stopped,
        "message": "Pipeline task has been stopped successfully.",
    }


@router.post("/restart/{exam_id}", status_code=status.HTTP_202_ACCEPTED)
async def restart_pipeline_task(
    exam_id: str,
    language: str = "ENGLISH",
    db: AsyncSession = Depends(get_async_session),
):
    """Stops any existing task and restarts Pipeline 3 (Explanation & Knowledge Base) from scratch."""
    target_uuid = parse_required_exam_id(exam_id)
    key = str(target_uuid)
    task_registry.cancel_task(key)

    pm_service = PipelineManagementService(db)
    await pm_service.update_pipeline_status(
        exam_id=target_uuid,
        pipeline_type="EXPLANATION_INDEXING",
        status="RUNNING",
        current_step="RESTARTING_EXPLANATION_PIPELINE",
        progress_percent=0.0,
        error_log=None,
    )

    task_id = f"p3_restart_{uuid.uuid4().hex[:8]}"

    if has_active_celery_workers():
        celery_res = process_exam_explanations_task.delay(
            str(target_uuid), language=language, task_id=task_id
        )
        task_registry.register_celery_task(key, celery_res.id)
    else:
        task = asyncio.create_task(
            async_process_exam_explanations(
                exam_id_str=str(target_uuid),
                language=language,
                task_id=task_id,
                execution_engine="FastAPI BackgroundTasks",
            )
        )
        task_registry.register_async_task(key, task)

    return {
        "status": "RESTARTED",
        "exam_id": str(target_uuid),
        "task_id": task_id,
        "message": "Pipeline task restarted from the beginning.",
    }


@router.post("/retry/{exam_id}", status_code=status.HTTP_202_ACCEPTED)
async def retry_pipeline_task(
    exam_id: str,
    language: str = "ENGLISH",
    db: AsyncSession = Depends(get_async_session),
):
    """Retries a stopped or failed pipeline task for the given exam_id."""
    target_uuid = parse_required_exam_id(exam_id)
    key = str(target_uuid)
    task_registry.cancel_task(key)

    pm_service = PipelineManagementService(db)
    await pm_service.update_pipeline_status(
        exam_id=target_uuid,
        pipeline_type="EXPLANATION_INDEXING",
        status="RUNNING",
        current_step="RETRYING_EXPLANATION_PIPELINE",
        progress_percent=0.0,
        error_log=None,
    )

    task_id = f"p3_retry_{uuid.uuid4().hex[:8]}"

    if has_active_celery_workers():
        celery_res = process_exam_explanations_task.delay(
            str(target_uuid), language=language, task_id=task_id
        )
        task_registry.register_celery_task(key, celery_res.id)
    else:
        task = asyncio.create_task(
            async_process_exam_explanations(
                exam_id_str=str(target_uuid),
                language=language,
                task_id=task_id,
                execution_engine="FastAPI BackgroundTasks",
            )
        )
        task_registry.register_async_task(key, task)

    return {
        "status": "RETRIED",
        "exam_id": str(target_uuid),
        "task_id": task_id,
        "message": "Pipeline task retried successfully.",
    }
