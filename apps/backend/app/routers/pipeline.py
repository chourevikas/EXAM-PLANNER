import uuid
import asyncio
from pathlib import Path
from typing import Optional, Any
from fastapi import (
    APIRouter,
    Depends,
    UploadFile,
    File,
    Form,
    HTTPException,
    BackgroundTasks,
    status,
)
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlmodel import select, func
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.session import get_async_session
from app.db.models import Exam, QuestionSourceType
from app.services.pipeline_management_service import PipelineManagementService
from app.services.task_registry import task_registry
from app.storage.factory import get_storage_provider
from app.utils.file_utils import save_upload_file_temp
from app.core.cleanup import cleanup_file
from app.tasks.exam_tasks import async_process_exam_pdf, process_exam_pdf_task
from app.tasks.celery_app import has_active_celery_workers
from app.config.filename_parser import (
    parse_question_paper_filename,
    parse_answer_key_filename,
)
from app.core.deps import require_roles, require_admin_section
from app.db.models.user import User, UserRole
from app.config.logger import setup_logger


logger = setup_logger("PipelineRouter")
router = APIRouter(prefix="/pipeline", tags=["Pipeline Management"])


def _clean_id_str(val: Any) -> str:
    return str(val).strip().strip('"').strip("'").strip()


def parse_required_exam_id(raw_id: Any) -> int:
    """Parses required raw_id into int with clear error response."""
    if isinstance(raw_id, int):
        return raw_id
    if not raw_id:
        raise HTTPException(
            status_code=400,
            detail="Missing required 'exam_id'. Value must be a valid integer ID.",
        )
    cleaned = _clean_id_str(raw_id)
    if not cleaned:
        raise HTTPException(
            status_code=400,
            detail="Missing required 'exam_id'. Value must be a valid integer ID.",
        )
    try:
        return int(cleaned)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid 'exam_id': '{raw_id}'. Value must be a valid integer ID.",
        )


class CheckDuplicateExamRequest(BaseModel):
    exam_name: Optional[str] = Field(
        default=None, description="Exam name e.g. UPSC_CSE"
    )
    year: Optional[int] = Field(default=None, description="Source year e.g. 2024")
    stage: Optional[str] = Field(default=None, description="Stage e.g. PRELIMS")
    subject_code: Optional[str] = Field(
        default=None, description="Subject code e.g. GS1"
    )
    paper_set_code: Optional[str] = Field(
        default="SET_A", description="Paper set code e.g. SET_A"
    )
    filename: Optional[str] = Field(
        default=None, description="Optional PDF filename to parse keys"
    )


@router.post("/check-duplicate")
async def check_duplicate_exam(
    req: CheckDuplicateExamRequest,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_admin_section("admin.upload", "admin.review")),
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

    exam_name = (
        req.exam_name or parsed_meta.get("exam_name") or parsed_meta.get("exam_code")
    )
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
        stmt = stmt.where(
            func.lower(Exam.subject_code) == func.lower(str(subject_code).strip())
        )
    if paper_set_code:
        stmt = stmt.where(
            func.lower(Exam.paper_set_code) == func.lower(str(paper_set_code).strip())
        )

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
    exam_name: Optional[str] = Form(default="UPSC"),
    stage: Optional[str] = Form(default="prelims"),
    exam_type: Optional[str] = Form(default="PYQ"),
    exam_type_id: Optional[int] = Form(default=None),
    total_questions: Optional[int] = Form(default=None),
    year: int = Form(...),
    set_code: Optional[str] = Form(default="SET_A"),
    conflict_resolution: str = Form(default="CHECK"),
    db: AsyncSession = Depends(get_async_session),
    _: User = Depends(require_admin_section("admin.upload", "admin.review")),
):
    """
    Uploads a Question Paper PDF and initiates Pipeline 1 (Question Extraction).
    Accepts mandatory year and explicit metadata parameters (exam_name, stage, exam_type, total_questions, year, set_code).
    Normalizes 'uspc' to 'UPSC' and defaults stage to 'prelims' and total_questions to 100 for PYQ.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported for Question Paper processing.",
        )

    try:
        meta = parse_question_paper_filename(
            filename_or_code=file.filename,
            year=year,
            user_set_code=set_code,
            exam_name=exam_name,
            stage=stage,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    canonical_exam_code = meta["canonical_code"]
    clean_set = meta["set_code"]

    from app.repositories.exam_repository import ExamRepository
    from app.services.exam_service import ExamService

    exam_repo = ExamRepository(db)
    existing_matches = await exam_repo.get_all_matching_canonical_exams(
        code=canonical_exam_code,
        year=meta.get("year", year),
        stage=meta.get("stage", stage),
        subject_code=meta.get("subject_code"),
        paper_set_code=clean_set,
    )
    exam = existing_matches[0] if existing_matches else None

    if exam:
        key = f"qp_{exam.id}"
        if task_registry.is_running(key):
            if conflict_resolution.upper() == "RESTART":
                logger.info(
                    f"User confirmed RESTART for running question paper task on exam '{canonical_exam_code}'. Cancelling active task..."
                )
                task_registry.cancel_task(key)
                pm_service = PipelineManagementService(db)
                await pm_service.update_pipeline_status(
                    exam_id=exam.id,
                    pipeline_type="DOCUMENT_EXTRACTION",
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
                        "pipeline_type": "DOCUMENT_EXTRACTION",
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

    # On OVERWRITE: completely delete all matching exams, their DB entities, and caches before re-ingestion
    if conflict_resolution.upper() == "OVERWRITE" and existing_matches:
        exam_service = ExamService(db)
        for old_exam in existing_matches:
            logger.info(
                f"Conflict resolution OVERWRITE: deleting existing exam ID {old_exam.id} ({old_exam.code}) and all related data before pipeline re-ingestion..."
            )
            await exam_service.delete_exam(old_exam.id)
        exam = None

    temp_dir = Path("./temp_uploads").resolve()
    temp_path = await save_upload_file_temp(file, temp_dir)

    storage = get_storage_provider()
    rel_storage_path = (
        f"uploads/question_papers/{canonical_exam_code}/{canonical_exam_code}.pdf"
    )
    persistent_path = await storage.upload_file(temp_path, rel_storage_path)

    from app.utils.pdf_utils import seed_pdf_cache

    seed_pdf_cache(persistent_path, temp_path)

    cleanup_file(temp_path)

    # Resolve ExamType metadata
    from app.repositories.exam_type_repository import ExamTypeRepository

    et_repo = ExamTypeRepository(db)
    resolved_et = None
    if exam_type_id:
        resolved_et = await et_repo.get_by_id(exam_type_id)
    if not resolved_et and exam_type:
        resolved_et = await et_repo.get_by_type(exam_type)
    if not resolved_et and exam_name:
        resolved_et = await et_repo.get_by_type(exam_name)
    if not resolved_et:
        resolved_et = await et_repo.get_by_type("upsc")

    et_id = resolved_et.id if resolved_et else None
    dur_mins = resolved_et.total_duration if resolved_et else 120
    tot_marks = resolved_et.total_marks if resolved_et else 200.0
    tot_q = total_questions or (resolved_et.number_of_questions if resolved_et else 100)

    e_type_enum = QuestionSourceType.PYQ
    if exam_type:
        try:
            e_type_enum = QuestionSourceType(exam_type.upper())
        except ValueError:
            pass

    if not exam:
        exam = Exam(
            code=canonical_exam_code,
            name=meta.get("exam_name", "UPSC"),
            stage=meta.get("stage", "prelims"),
            exam_type=e_type_enum,
            exam_type_id=et_id,
            total_questions=tot_q,
            total_duration_minutes=dur_mins,
            total_marks=tot_marks,
            source_year=meta.get("year", 2024),
            paper_set_code=clean_set,
            pdf_path=persistent_path,
            is_active=False,
        )
        db.add(exam)
        try:
            await db.commit()
            await db.refresh(exam)
        except Exception:
            await db.rollback()
            retry_stmt = select(Exam).where(
                func.lower(Exam.code) == canonical_exam_code.lower()
            )
            exam = (await db.exec(retry_stmt)).first()
            if not exam:
                raise
            exam.paper_set_code = clean_set
            exam.pdf_path = persistent_path
            exam.total_questions = tot_q
            exam.exam_type = e_type_enum
            if et_id and not exam.exam_type_id:
                exam.exam_type_id = et_id
                exam.total_duration_minutes = exam.total_duration_minutes or dur_mins
                exam.total_marks = exam.total_marks or tot_marks
            db.add(exam)
            await db.commit()
            await db.refresh(exam)
    else:
        exam.paper_set_code = clean_set
        exam.pdf_path = persistent_path
        exam.total_questions = tot_q
        exam.exam_type = e_type_enum
        if et_id and not exam.exam_type_id:
            exam.exam_type_id = et_id
            exam.total_duration_minutes = exam.total_duration_minutes or dur_mins
            exam.total_marks = exam.total_marks or tot_marks
        if meta.get("stage"):
            exam.stage = meta["stage"]
        if meta.get("year"):
            exam.source_year = meta["year"]
        db.add(exam)
        await db.commit()
        await db.refresh(exam)

    target_exam_id = exam.id
    task_id = f"p1_{uuid.uuid4().hex[:8]}"
    logger.info(
        f"Received Question Paper upload '{file.filename}'. Canonical Code: '{canonical_exam_code}', Set: '{clean_set}', Exam ID: '{target_exam_id}'"
    )

    pm_service = PipelineManagementService(db)
    await pm_service.update_pipeline_status(
        exam_id=target_exam_id,
        pipeline_type="DOCUMENT_EXTRACTION",
        status="RUNNING",
        current_step="PDF_UPLOADED_STARTING_QUESTION_EXTRACTION",
        progress_percent=5.0,
    )

    key = f"qp_{target_exam_id}"
    if has_active_celery_workers():
        celery_res = process_exam_pdf_task.delay(
            str(target_exam_id), persistent_path, task_id=task_id
        )
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
        "total_questions": tot_q,
        "task_id": task_id,
        "filename": file.filename,
        "message": "Question paper extraction pipeline has started.",
    }


@router.get("/questions-status/{exam_identifier}")
async def get_exam_questions_extraction_status(
    exam_identifier: str,
    db: AsyncSession = Depends(get_async_session),
    _: User = Depends(require_admin_section("admin.upload", "admin.review")),
):
    """
    Fetches real-time status of extracted questions, missing questions, and review statuses
    for frontend display. Accepts canonical_exam_code or exam_id UUID.
    """
    exam_id_int = None
    try:
        exam_id_int = int(exam_identifier)
    except ValueError:
        pass

    if exam_id_int is not None:
        target_exam = await db.get(Exam, exam_id_int)
    else:
        stmt = select(Exam).where(
            (func.lower(Exam.code) == exam_identifier.lower())
            | (func.lower(Exam.name) == exam_identifier.lower())
        )
        res = await db.exec(stmt)
        target_exam = res.first()

    if not target_exam:
        raise HTTPException(
            status_code=404,
            detail=f"Exam with identifier '{exam_identifier}' not found in database.",
        )

    from app.db.models import (
        Question,
        QuestionExplanation,
        QuestionOption,
        QuestionStatus,
    )

    q_stmt = (
        select(Question)
        .where(Question.exam_id == target_exam.id)
        .order_by(Question.question_number_in_paper)
    )
    q_res = await db.exec(q_stmt)
    questions = q_res.all()

    extracted_numbers = set()
    pending_count = 0
    published_count = 0
    questions_checklist = []

    q_ids = [q.id for q in questions]
    exp_qids = set()
    opt_qids = set()
    if q_ids:
        exp_res = await db.exec(
            select(QuestionExplanation.question_id).where(
                QuestionExplanation.question_id.in_(q_ids)
            )
        )
        exp_qids = set(exp_res.all())

        opt_res = await db.exec(
            select(QuestionOption.question_id).where(
                QuestionOption.question_id.in_(q_ids)
            )
        )
        opt_qids = set(opt_res.all())

    for q in questions:
        extracted_numbers.add(q.question_number_in_paper)
        if q.status == QuestionStatus.PENDING_HUMAN_REVIEW:
            pending_count += 1
        elif q.status == QuestionStatus.PUBLISHED:
            published_count += 1

        has_exp = q.id in exp_qids
        has_opts = q.id in opt_qids

        questions_checklist.append(
            {
                "question_id": str(q.id),
                "question_number": q.question_number_in_paper,
                "status": q.status.value
                if hasattr(q.status, "value")
                else str(q.status),
                "is_complete": q.is_complete,
                "has_options": has_opts,
                "has_explanation": has_exp,
            }
        )

    tot_expected = target_exam.total_questions or 100
    missing_numbers = [
        num for num in range(1, tot_expected + 1) if num not in extracted_numbers
    ]

    target_exam.extracted_questions_count = len(questions)
    target_exam.missing_questions_count = len(missing_numbers)
    target_exam.missing_question_numbers_json = missing_numbers
    db.add(target_exam)
    await db.commit()

    return {
        "exam_id": str(target_exam.id),
        "exam_code": target_exam.code,
        "exam_name": target_exam.name,
        "status": target_exam.status.value
        if hasattr(target_exam.status, "value")
        else str(target_exam.status),
        "is_active": target_exam.is_active,
        "total_questions": tot_expected,
        "extracted_questions_count": len(questions),
        "missing_questions_count": len(missing_numbers),
        "missing_question_numbers": missing_numbers,
        "pending_human_review_count": pending_count,
        "published_questions_count": published_count,
        "is_ready_for_approval": len(missing_numbers) == 0 and len(questions) > 0,
        "questions": questions_checklist,
    }


@router.get("/status/{exam_identifier}")
async def get_exam_pipeline_status(
    exam_identifier: str,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_admin_section("admin.upload", "admin.review")),
):
    """Fetches real-time status of all 3 pipelines using either canonical_exam_code or exam_id UUID."""
    exam_id_int = None
    try:
        exam_id_int = int(exam_identifier)
    except ValueError:
        pass

    if exam_id_int is not None:
        target_exam = await db.get(Exam, exam_id_int)
    else:
        stmt = select(Exam).where(
            (func.lower(Exam.code) == exam_identifier.lower())
            | (func.lower(Exam.name) == exam_identifier.lower())
        )
        res = await db.exec(stmt)
        target_exam = res.first()

    if not target_exam:
        raise HTTPException(
            status_code=404,
            detail=f"Exam with identifier '{exam_identifier}' not found in database.",
        )

    pm_service = PipelineManagementService(db)
    return await pm_service.get_exam_pipeline_overview(target_exam.id)


@router.post("/stop/{exam_id}")
async def stop_pipeline_task(
    exam_id: str,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_admin_section("admin.upload", "admin.review")),
):
    """Stops/cancels any running background pipeline task for the given exam_id."""
    target_exam_id = parse_required_exam_id(exam_id)
    stopped_qp = task_registry.cancel_task(f"qp_{target_exam_id}")
    stopped_ak = task_registry.cancel_task(f"ak_{target_exam_id}")
    stopped_exp = task_registry.cancel_task(f"exp_{target_exam_id}")
    stopped_bare = task_registry.cancel_task(str(target_exam_id))
    stopped = stopped_qp or stopped_ak or stopped_exp or stopped_bare

    pm_service = PipelineManagementService(db)
    runs_overview = await pm_service.get_exam_pipeline_overview(target_exam_id)

    # Mark active RUNNING pipelines as STOPPED in DB
    type_map = {
        "question_extraction": ["DOCUMENT_EXTRACTION", "QUESTION_EXTRACTION"],
        "answer_key": ["ANSWER_KEY"],
        "explanation_indexing": ["EXPLANATION_INDEXING"],
    }
    for p_type, r_data in runs_overview.get("pipelines", {}).items():
        if isinstance(r_data, dict) and r_data.get("status") == "RUNNING":
            db_targets = type_map.get(p_type, [p_type])
            for target_type in db_targets:
                await pm_service.update_pipeline_status(
                    exam_id=target_exam_id,
                    pipeline_type=target_type,
                    status="STOPPED",
                    current_step="STOPPED_BY_ADMIN",
                    progress_percent=0.0,
                    error_log="Pipeline execution stopped by admin request.",
                )

    return {
        "status": "STOPPED",
        "exam_id": str(target_exam_id),
        "task_stopped": stopped,
        "message": "Pipeline task has been stopped successfully.",
    }


@router.post("/restart/{exam_id}", status_code=status.HTTP_202_ACCEPTED)
async def restart_pipeline_task(
    exam_id: str,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_admin_section("admin.upload", "admin.review")),
):
    """Stops any existing task and restarts Document Extraction from scratch."""
    target_exam_id = parse_required_exam_id(exam_id)
    key = str(target_exam_id)
    task_registry.cancel_task(key)

    exam = await db.get(Exam, target_exam_id)
    if not exam or not exam.pdf_path:
        raise HTTPException(status_code=404, detail="Exam or PDF path not found.")

    pm_service = PipelineManagementService(db)
    await pm_service.update_pipeline_status(
        exam_id=target_exam_id,
        pipeline_type="DOCUMENT_EXTRACTION",
        status="RUNNING",
        current_step="RESTARTING_DOCUMENT_EXTRACTION",
        progress_percent=0.0,
        error_log=None,
    )

    task_id = f"p1_restart_{uuid.uuid4().hex[:8]}"

    if has_active_celery_workers():
        celery_res = process_exam_pdf_task.delay(
            str(target_exam_id), exam.pdf_path, exam.name, task_id
        )
        task_registry.register_celery_task(key, celery_res.id)
    else:
        task = asyncio.create_task(
            async_process_exam_pdf(
                pdf_path=exam.pdf_path,
                exam_title=exam.name,
                exam_id_str=str(target_exam_id),
                task_id=task_id,
                execution_engine="FastAPI BackgroundTasks",
            )
        )
        task_registry.register_async_task(key, task)

    return {
        "status": "RESTARTED",
        "exam_id": str(target_exam_id),
        "task_id": task_id,
        "message": "Document extraction restarted from the beginning.",
    }


@router.post("/retry/{exam_id}", status_code=status.HTTP_202_ACCEPTED)
async def retry_pipeline_task(
    exam_id: str,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_admin_section("admin.upload", "admin.review")),
):
    """Retries a stopped or failed document extraction task for the given exam_id."""
    target_exam_id = parse_required_exam_id(exam_id)
    key = str(target_exam_id)
    task_registry.cancel_task(key)

    exam = await db.get(Exam, target_exam_id)
    if not exam or not exam.pdf_path:
        raise HTTPException(status_code=404, detail="Exam or PDF path not found.")

    pm_service = PipelineManagementService(db)
    await pm_service.update_pipeline_status(
        exam_id=target_exam_id,
        pipeline_type="DOCUMENT_EXTRACTION",
        status="RUNNING",
        current_step="RETRYING_DOCUMENT_EXTRACTION",
        progress_percent=0.0,
        error_log=None,
    )

    task_id = f"p1_retry_{uuid.uuid4().hex[:8]}"

    if has_active_celery_workers():
        celery_res = process_exam_pdf_task.delay(
            str(target_exam_id), exam.pdf_path, exam.name, task_id
        )
        task_registry.register_celery_task(key, celery_res.id)
    else:
        task = asyncio.create_task(
            async_process_exam_pdf(
                pdf_path=exam.pdf_path,
                exam_title=exam.name,
                exam_id_str=str(target_exam_id),
                task_id=task_id,
                execution_engine="FastAPI BackgroundTasks",
            )
        )
        task_registry.register_async_task(key, task)

    return {
        "status": "RETRIED",
        "exam_id": str(target_exam_id),
        "task_id": task_id,
        "message": "Document extraction task retried successfully.",
    }
