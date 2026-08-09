import uuid
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, BackgroundTasks, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.session import get_async_session
from app.services.pipeline_management_service import PipelineManagementService
from app.utils.file_utils import save_upload_file_temp
from app.tasks.exam_tasks import async_process_exam_pdf
from app.tasks.answer_key_tasks import async_process_answer_key_pdf
from app.tasks.explanation_tasks import async_process_exam_explanations
from app.config.filename_parser import parse_question_paper_filename, parse_answer_key_filename
from app.config.logger import setup_logger

logger = setup_logger("PipelineRouter")
router = APIRouter(prefix="/pipeline", tags=["Pipeline Management"])


@router.post("/upload-question-paper", status_code=status.HTTP_202_ACCEPTED)
async def upload_question_paper(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    exam_id: Optional[uuid.UUID] = Form(default=None),
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

    target_exam_id = exam_id or uuid.uuid4()
    task_id = f"p1_{uuid.uuid4().hex[:8]}"
    logger.info(f"Received Question Paper upload '{file.filename}'. Exam ID: '{target_exam_id}', Temp path: '{temp_path}'")

    background_tasks.add_task(
        async_process_exam_pdf,
        exam_id_str=str(target_exam_id),
        pdf_path=str(temp_path),
        task_id=task_id,
        execution_engine="FastAPI BackgroundTasks",
    )

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
    exam_id: uuid.UUID = Form(...),
    target_set_code: str = Form(default="SET_A"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_async_session),
):
    """Uploads an Answer Key file, initiates Pipeline 2, and automatically triggers Pipeline 3 upon completion."""
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
        exam_id=exam_id,
        pipeline_type="ANSWER_KEY",
        status="RUNNING",
        current_step="PROCESSING_ANSWER_KEY_FILE",
        progress_percent=10.0,
    )

    background_tasks.add_task(
        async_process_answer_key_pdf,
        exam_id_str=str(exam_id),
        pdf_path=str(temp_path),
        target_set_code=target_set_code,
        task_id=task_id,
        execution_engine="FastAPI BackgroundTasks",
    )

    return {
        "status": "PIPELINE_2_INITIATED",
        "exam_id": str(exam_id),
        "task_id": task_id,
        "target_set_code": target_set_code,
        "message": "Answer key pipeline started. Pipeline 3 will run automatically upon completion.",
    }


@router.get("/status/{exam_id}")
async def get_exam_pipeline_status(
    exam_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
):
    """Fetches real-time status of all 3 pipelines for an exam paper for the frontend dashboard."""
    pm_service = PipelineManagementService(db)
    return await pm_service.get_exam_pipeline_overview(exam_id)


@router.post("/trigger-explanation/{exam_id}", status_code=status.HTTP_202_ACCEPTED)
async def trigger_explanation_pipeline(
    exam_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    language: str = "ENGLISH",
    db: AsyncSession = Depends(get_async_session),
):
    """Manual endpoint allowing admins to trigger or re-run Pipeline 3 (Explanation & Multi-Concept Indexing)."""
    pm_service = PipelineManagementService(db)
    await pm_service.update_pipeline_status(
        exam_id=exam_id,
        pipeline_type="EXPLANATION_INDEXING",
        status="RUNNING",
        current_step="MANUAL_TRIGGER_EXPLANATION_PIPELINE",
        progress_percent=0.0,
    )

    task_id = f"p3_{uuid.uuid4().hex[:8]}"
    background_tasks.add_task(
        async_process_exam_explanations,
        exam_id_str=str(exam_id),
        language=language,
        task_id=task_id,
        execution_engine="FastAPI BackgroundTasks",
    )

    return {
        "status": "PIPELINE_3_INITIATED",
        "exam_id": str(exam_id),
        "task_id": task_id,
        "language": language,
        "message": "Explanation and multi-concept indexing pipeline has started.",
    }
