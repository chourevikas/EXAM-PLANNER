import uuid
import asyncio
from pathlib import Path
from typing import Optional, Any
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, BackgroundTasks, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlmodel import select, func
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.session import get_async_session
from app.db.models import Exam
from app.services.pipeline_management_service import PipelineManagementService
from app.services.task_registry import task_registry
from app.storage.factory import get_storage_provider
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


class CheckDuplicateExamRequest(BaseModel):
    exam_name: Optional[str] = Field(default=None, description="Exam name e.g. UPSC_CSE")
    year: Optional[int] = Field(default=None, description="Source year e.g. 2024")
    stage: Optional[str] = Field(default=None, description="Stage e.g. PRELIMS")
    subject_code: Optional[str] = Field(default=None, description="Subject code e.g. GS1")
    paper_set_code: Optional[str] = Field(default="SET_A", description="Paper set code e.g. SET_A")
    filename: Optional[str] = Field(default=None, description="Optional PDF filename to parse keys")


@router.post("/check-duplicate")
async def check_duplicate_exam(
    req: CheckDuplicateExamRequest,
    db: AsyncSession = Depends(get_async_session),
):
    """Checks if an exam paper matching all 5 keys (case-insensitive) already exists in DB."""
    parsed_meta = {}
    if req.filename:
        try:
            parsed_meta = parse_question_paper_filename(req.filename)
        except Exception:
            try:
                parsed_meta = parse_answer_key_filename(req.filename)
            except Exception:
                pass

    exam_name = req.exam_name or parsed_meta.get("exam_name") or parsed_meta.get("exam_code")
    year = req.year or parsed_meta.get("year")
    stage = req.stage or parsed_meta.get("stage")
    subject_code = req.subject_code or parsed_meta.get("subject_code")
    paper_set_code = req.paper_set_code or parsed_meta.get("paper_set_code") or "SET_A"

    stmt = select(Exam)
    if exam_name:
        stmt = stmt.where(func.lower(Exam.name) == func.lower(str(exam_name).strip()))
    if year:
        stmt = stmt.where(Exam.source_year == int(year))
    if stage:
        stmt = stmt.where(func.lower(Exam.stage) == func.lower(str(stage).strip()))
    if subject_code:
        stmt = stmt.where(func.lower(Exam.subject_code) == func.lower(str(subject_code).strip()))
    if paper_set_code:
        stmt = stmt.where(func.lower(Exam.paper_set_code) == func.lower(str(paper_set_code).strip()))

    res = await db.exec(stmt)
    existing_exam = res.first()

    if existing_exam:
        pm_service = PipelineManagementService(db)
        overview = await pm_service.get_exam_pipeline_overview(existing_exam.id)
        return {
            "is_duplicate": True,
            "existing_exam_id": str(existing_exam.id),
            "exam_name": existing_exam.name,
            "paper_set_code": existing_exam.paper_set_code,
            "message": f"Duplicate paper found matching 5 keys for Exam '{existing_exam.name}' (ID: {existing_exam.id}).",
            "pipeline_overview": overview,
            "options": ["IGNORE", "OVERWRITE"],
        }

    return {
        "is_duplicate": False,
        "message": "No duplicate exam paper found in DB.",
    }


@router.post("/upload-question-paper", status_code=status.HTTP_202_ACCEPTED)
async def upload_question_paper(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    exam_name: Optional[str] = Form(default=None),
    stage: Optional[str] = Form(default=None),
    subject_code: Optional[str] = Form(default=None),
    year: Optional[int] = Form(default=None),
    set_code: Optional[str] = Form(default="SET_A"),
    conflict_resolution: str = Form(default="CHECK"),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Uploads a Question Paper PDF and initiates Pipeline 1 (Question Extraction).
    Accepts explicit metadata parameters (exam_name, stage, subject_code, year, set_code)
    to support arbitrary filenames. Handles active task conflict confirmation and task cancellation/restart.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400, detail="Only PDF files are supported for Question Paper processing."
        )

    # 1. Extract canonical code and tokens from explicit metadata fields or filename
    meta = parse_question_paper_filename(
        file.filename,
        user_set_code=set_code,
        exam_name=exam_name,
        stage=stage,
        subject_code=subject_code,
        year=year,
    )
    canonical_exam_code = meta["canonical_code"]
    clean_set = meta["set_code"]

    # 2. Check if Exam exists in DB by canonical code or name
    stmt = select(Exam).where(
        (func.lower(Exam.code) == canonical_exam_code.lower()) |
        (func.lower(Exam.name) == canonical_exam_code.lower())
    )
    res = await db.exec(stmt)
    exam = res.first()

    # 3. Running Task Conflict Check & Resolution for Question Paper Pipeline (qp_{exam.id})
    if exam:
        key = f"qp_{exam.id}"
        if task_registry.is_running(key):
            if conflict_resolution.upper() == "RESTART":
                logger.info(f"User confirmed RESTART for running question paper task on exam '{canonical_exam_code}'. Cancelling active task...")
                task_registry.cancel_task(key)
                pm_service = PipelineManagementService(db)
                await pm_service.update_pipeline_status(
                    exam_id=exam.id,
                    pipeline_type="QUESTION_EXTRACTION",
                    status="CANCELLED",
                    current_step="CANCELLED_BY_USER_RESTART",
                    progress_percent=0.0,
                )
            elif conflict_resolution.upper() != "OVERWRITE":
                return JSONResponse(
                    status_code=status.HTTP_409_CONFLICT,
                    content={
                        "status": "TASK_ALREADY_RUNNING_CONFIRM_OVERWRITE",
                        "requires_confirmation": True,
                        "pipeline_type": "QUESTION_EXTRACTION",
                        "exam_id": str(exam.id),
                        "canonical_exam_code": canonical_exam_code,
                        "filename": file.filename,
                        "message": f"A question paper extraction task is currently running for paper '{canonical_exam_code}'. Confirm to cancel the old task and restart?",
                        "options": ["RESTART", "CANCEL"],
                    },
                )

    if conflict_resolution.upper() == "IGNORE" and exam:
        return {
            "status": "SKIPPED_DUPLICATE_EXAM",
            "exam_id": str(exam.id),
            "canonical_exam_code": canonical_exam_code,
            "filename": file.filename,
            "message": f"Exam paper '{canonical_exam_code}' already exists in DB. Pipeline execution skipped as requested.",
        }

    # Save to temp directory first
    temp_dir = Path("./temp_uploads").resolve()
    temp_path = await save_upload_file_temp(file, temp_dir)

    # Standardized Persistent Storage Path: uploads/question_papers/{canonical}/{set}/{canonical}_{set}.pdf
    storage = get_storage_provider()
    rel_storage_path = f"uploads/question_papers/{canonical_exam_code}/{clean_set}/{canonical_exam_code}_{clean_set}.pdf"
    persistent_path = await storage.upload_file(temp_path, rel_storage_path)

    if not exam:
        exam = Exam(
            code=canonical_exam_code,
            name=canonical_exam_code,
            stage=meta.get("stage", "PRELIMS"),
            subject_code=meta.get("subject_code", "GENERAL"),
            source_year=meta.get("year", 2024),
            paper_set_code=clean_set,
            pdf_path=persistent_path,
            canonical_question_id_prefix=canonical_exam_code,
        )
    else:
        exam.paper_set_code = clean_set
        exam.pdf_path = persistent_path
        if meta.get("stage"):
            exam.stage = meta["stage"]
        if meta.get("subject_code"):
            exam.subject_code = meta["subject_code"]
        if meta.get("year"):
            exam.source_year = meta["year"]
    
    db.add(exam)
    await db.commit()
    await db.refresh(exam)

    target_exam_id = exam.id
    task_id = f"p1_{uuid.uuid4().hex[:8]}"
    logger.info(f"Received Question Paper upload '{file.filename}'. Canonical Code: '{canonical_exam_code}', Set: '{clean_set}', Exam ID: '{target_exam_id}'")

    # Record Pipeline 1 initialization in Database
    pm_service = PipelineManagementService(db)
    await pm_service.update_pipeline_status(
        exam_id=target_exam_id,
        pipeline_type="QUESTION_EXTRACTION",
        status="RUNNING",
        current_step="PDF_UPLOADED_STARTING_QUESTION_EXTRACTION",
        progress_percent=5.0,
    )

    key = f"qp_{target_exam_id}"
    if has_active_celery_workers():
        celery_res = process_exam_pdf_task.delay(str(target_exam_id), persistent_path, task_id=task_id)
        task_registry.register_celery_task(key, celery_res.id)
    else:
        task = asyncio.create_task(
            async_process_exam_pdf(
                exam_id_str=str(target_exam_id),
                pdf_path=persistent_path,
                task_id=task_id,
                execution_engine="FastAPI BackgroundTasks",
            )
        )
        task_registry.register_async_task(key, task)

    return {
        "status": "PIPELINE_1_INITIATED",
        "exam_id": str(target_exam_id),
        "canonical_exam_code": canonical_exam_code,
        "set_code": clean_set,
        "task_id": task_id,
        "filename": file.filename,
        "message": "Question paper extraction pipeline has started.",
    }


@router.post("/upload-answer-key", status_code=status.HTTP_202_ACCEPTED)
async def upload_answer_key(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    exam_name: Optional[str] = Form(default=None),
    stage: Optional[str] = Form(default=None),
    subject_code: Optional[str] = Form(default=None),
    year: Optional[int] = Form(default=None),
    conflict_resolution: str = Form(default="CHECK"),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Uploads an Answer Key PDF and initiates Pipeline 2.
    Accepts explicit metadata fields or falls back to filename stem.
    Handles active task conflict confirmation and task cancellation/restart.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported for Answer Key processing.")

    meta = parse_answer_key_filename(
        file.filename,
        exam_name=exam_name,
        stage=stage,
        subject_code=subject_code,
        year=year,
    )
    canonical_exam_code = meta["canonical_code"]

    # Search for matching Exam by code or name
    stmt = select(Exam).where(
        (func.lower(Exam.code) == canonical_exam_code.lower()) |
        (func.lower(Exam.name) == canonical_exam_code.lower())
    )
    res = await db.exec(stmt)
    exam = res.first()

    # Task conflict check & resolution for Answer Key Pipeline (ak_{exam.id})
    if exam:
        key = f"ak_{exam.id}"
        if task_registry.is_running(key):
            if conflict_resolution.upper() == "RESTART":
                logger.info(f"User confirmed RESTART for running answer key task on exam '{canonical_exam_code}'. Cancelling active task...")
                task_registry.cancel_task(key)
                pm_service = PipelineManagementService(db)
                await pm_service.update_pipeline_status(
                    exam_id=exam.id,
                    pipeline_type="ANSWER_KEY",
                    status="CANCELLED",
                    current_step="CANCELLED_BY_USER_RESTART",
                    progress_percent=0.0,
                )
            elif conflict_resolution.upper() != "OVERWRITE":
                return JSONResponse(
                    status_code=status.HTTP_409_CONFLICT,
                    content={
                        "status": "TASK_ALREADY_RUNNING_CONFIRM_OVERWRITE",
                        "requires_confirmation": True,
                        "pipeline_type": "ANSWER_KEY",
                        "exam_id": str(exam.id),
                        "canonical_exam_code": canonical_exam_code,
                        "filename": file.filename,
                        "message": f"An answer key extraction task is currently running for paper '{canonical_exam_code}'. Confirm to cancel the old task and restart?",
                        "options": ["RESTART", "CANCEL"],
                    },
                )

    temp_dir = Path("./temp_uploads").resolve()
    temp_path = await save_upload_file_temp(file, temp_dir)

    # Standardized Persistent Storage Path: uploads/answer_keys/{canonical}/{canonical}.pdf
    storage = get_storage_provider()
    rel_storage_path = f"uploads/answer_keys/{canonical_exam_code}/{canonical_exam_code}.pdf"
    persistent_path = await storage.upload_file(temp_path, rel_storage_path)

    if not exam:
        exam = Exam(
            code=canonical_exam_code,
            name=canonical_exam_code,
            stage=meta.get("stage", "PRELIMS"),
            subject_code=meta.get("subject_code", "GENERAL"),
            source_year=meta.get("year", 2024),
            paper_set_code="SET_A",
            pdf_path=persistent_path,
            canonical_question_id_prefix=canonical_exam_code,
        )
        db.add(exam)
        await db.commit()
        await db.refresh(exam)

    target_exam_id = exam.id
    target_set_code = exam.paper_set_code or "SET_A"
    task_id = f"p2_{uuid.uuid4().hex[:8]}"

    logger.info(
        f"Received Answer Key upload '{file.filename}'. Canonical Code: '{canonical_exam_code}', Target Exam ID: '{target_exam_id}', Set: '{target_set_code}'"
    )

    pm_service = PipelineManagementService(db)
    await pm_service.update_pipeline_status(
        exam_id=target_exam_id,
        pipeline_type="ANSWER_KEY",
        status="RUNNING",
        current_step="PROCESSING_ANSWER_KEY_FILE",
        progress_percent=10.0,
    )

    key = f"ak_{target_exam_id}"
    if has_active_celery_workers():
        celery_res = process_answer_key_pdf_task.delay(
            str(target_exam_id), persistent_path, target_set_code=target_set_code, task_id=task_id
        )
        task_registry.register_celery_task(key, celery_res.id)
    else:
        task = asyncio.create_task(
            async_process_answer_key_pdf(
                exam_id_str=str(target_exam_id),
                pdf_path=persistent_path,
                target_set_code=target_set_code,
                task_id=task_id,
                execution_engine="FastAPI BackgroundTasks",
            )
        )
        task_registry.register_async_task(key, task)

    return {
        "status": "PIPELINE_2_INITIATED",
        "exam_id": str(target_exam_id),
        "canonical_exam_code": canonical_exam_code,
        "task_id": task_id,
        "target_set_code": target_set_code,
        "message": "Answer key pipeline started. Pipeline 3 will run automatically upon completion.",
    }


@router.get("/status/{exam_identifier}")
async def get_exam_pipeline_status(
    exam_identifier: str,
    db: AsyncSession = Depends(get_async_session),
):
    """Fetches real-time status of all 3 pipelines using either canonical_exam_code or exam_id UUID."""
    exam_uuid = None
    try:
        exam_uuid = uuid.UUID(exam_identifier)
    except ValueError:
        pass

    if exam_uuid:
        target_exam = await db.get(Exam, exam_uuid)
    else:
        stmt = select(Exam).where(
            (func.lower(Exam.code) == exam_identifier.lower()) |
            (func.lower(Exam.name) == exam_identifier.lower())
        )
        res = await db.exec(stmt)
        target_exam = res.first()

    if not target_exam:
        raise HTTPException(
            status_code=404,
            detail=f"Exam with identifier '{exam_identifier}' not found in database."
        )

    pm_service = PipelineManagementService(db)
    return await pm_service.get_exam_pipeline_overview(target_exam.id)


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
    stopped_qp = task_registry.cancel_task(f"qp_{target_uuid}")
    stopped_ak = task_registry.cancel_task(f"ak_{target_uuid}")
    stopped_exp = task_registry.cancel_task(f"exp_{target_uuid}")
    stopped_bare = task_registry.cancel_task(str(target_uuid))
    stopped = stopped_qp or stopped_ak or stopped_exp or stopped_bare

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
    key = f"exp_{target_uuid}"
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
    key = f"exp_{target_uuid}"
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
