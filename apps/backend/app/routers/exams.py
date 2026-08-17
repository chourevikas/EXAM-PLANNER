import os
import uuid
import logging
from typing import Optional, List
from fastapi import APIRouter, UploadFile, File, Form, Depends, BackgroundTasks, Query
from fastapi.responses import FileResponse
from sqlmodel.ext.asyncio.session import AsyncSession
from app.db.session import get_async_session
from app.db.models import Exam, LanguageCode, QuestionStatus
from app.schemas.question import ExamReviewQuestionsResponse
from app.services.exam_service import ExamService
from app.services.exam_export_service import ExamExportService
from app.services.question_service import QuestionService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/exams", tags=["Exams & Document Ingestion"])


def _remove_temp_file(path_str: str):
    """Background cleanup task to delete temporary ZIP file after download."""
    try:
        if os.path.exists(path_str):
            os.remove(path_str)
    except Exception:
        pass


@router.post("/upload")
async def upload_exam_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(
        ...,
        description="Uploaded Question Paper PDF file.",
    ),
    year: Optional[str] = Form(default=None, description="Exam year e.g. '2024'"),
    set_code: Optional[str] = Form(default=None, description="Paper set code e.g. 'SET_A'"),
    exam_name: Optional[str] = Form(default=None, description="Exam name e.g. 'UPSC'"),
    stage: Optional[str] = Form(default=None, description="Stage e.g. 'PRELIMS'"),
    subject_code: Optional[str] = Form(default=None, description="Subject e.g. 'GS1'"),
    run_mode: Optional[str] = Form(default="auto", description="'celery', 'background', or 'auto'"),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Uploads a Question Paper PDF and initiates Pipeline 1.
    Extracts canonical exam code, year, stage, subject, and set dynamically from uploaded file and form parameters.
    """
    service = ExamService(session)
    return await service.handle_pdf_upload(
        file=file,
        year=year,
        set_code=set_code,
        exam_name=exam_name,
        stage=stage,
        subject_code=subject_code,
        run_mode=run_mode,
        background_tasks=background_tasks,
    )


@router.get("", response_model=List[Exam])
async def list_exams(
    status: Optional[str] = Query(default=None, description="Filter by Exam status (e.g. 'PUBLISHED')"),
    is_active: Optional[bool] = Query(default=None, description="Filter by active status for candidates"),
    session: AsyncSession = Depends(get_async_session)
):
    """Lists all registered competitive exams, optionally filtered by status and is_active."""
    service = ExamService(session)
    return await service.list_exams(status=status, is_active=is_active)


@router.get(
    "/{exam_id}/review-questions",
    response_model=ExamReviewQuestionsResponse,
    summary="Get All Exam Questions with Complete Solutions for Verification & Review",
)
@router.get(
    "/{exam_id}/solutions",
    response_model=ExamReviewQuestionsResponse,
    summary="Get All Exam Questions with Complete Solutions (Alias)",
)
async def get_exam_questions_for_review(
    exam_id: uuid.UUID,
    language: LanguageCode = Query(default=LanguageCode.ENGLISH, description="Target Language"),
    status: Optional[QuestionStatus] = Query(default=None, description="Filter by Question status e.g. PENDING_HUMAN_REVIEW or PUBLISHED"),
    page: int = Query(default=1, ge=1, description="Page number"),
    limit: int = Query(default=100, ge=1, le=100, description="Items per page"),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Dedicated endpoint for user/admin review per question in an exam.
    Returns complete questions alongside full step-by-step solutions,
    core concepts, option distractor analyses (option explanations),
    key takeaways, and points to remember/common traps, with real-time review progress counters.
    """
    q_service = QuestionService(session)
    return await q_service.get_exam_questions_for_review(
        exam_id=exam_id,
        page=page,
        limit=limit,
        language=language,
        status=status,
    )


@router.get("/{exam_id}/question-artifact/{question_number}")
async def get_question_artifact(
    exam_id: uuid.UUID,
    question_number: int,
    session: AsyncSession = Depends(get_async_session),
):
    """
    Fetches individual Question JSON artifact for question_number.
    Loads from storage folder or constructs from database with secure presigned URL.
    """
    from app.db.models import Exam, Question
    from app.storage.factory import get_storage_provider
    from sqlmodel import select
    from fastapi import HTTPException

    exam = await session.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail=f"Exam with ID '{exam_id}' not found.")

    storage = get_storage_provider()
    paper_set = exam.paper_set_code or "SET_A"
    clean_set = str(paper_set).strip().lower().replace("_", "-")
    q_folder = exam.questions_json_folder_path or f"artifacts/{exam.code}/{clean_set}/json/questions"
    q_filename = f"Q{question_number:03d}.json"
    rel_path = f"{q_folder.rstrip('/')}/{q_filename}"

    logger.info(f"[EXAM_ARTIFACT] Querying S3 question artifact: exam_id={exam_id}, code={exam.code}, question_number={question_number}, target_path='{rel_path}'")

    try:
        if await storage.exists(rel_path):
            presigned_url = await storage.generate_presigned_url(rel_path)
            logger.info(f"[EXAM_ARTIFACT:S3_HIT] Generated presigned URL for question #{question_number}: {presigned_url[:60]}...")
            return {
                "question_number": question_number,
                "exam_id": str(exam.id),
                "exam_code": exam.code,
                "presigned_url": presigned_url,
                "source": "S3_ARTIFACT",
            }
        else:
            logger.warning(f"[EXAM_ARTIFACT:S3_MISS] Question #{question_number} artifact not found at '{rel_path}'")
    except Exception as exc:
        logger.error(f"[EXAM_ARTIFACT:S3_ERROR] Error checking S3 path '{rel_path}': {exc}", exc_info=True)

    raise HTTPException(
        status_code=404,
        detail=f"Question artifact #{question_number} not found in S3 storage folder.",
    )


@router.get("/{exam_id}/question-db/{question_number}")
async def get_question_from_db_fallback(
    exam_id: uuid.UUID,
    question_number: int,
    session: AsyncSession = Depends(get_async_session),
):
    """
    Dedicated Database Fallback endpoint: Directly queries PostgreSQL for question,
    options, translations, and metadata when direct S3 download fails.
    """
    from app.db.models import Exam, Question, QuestionOption, QuestionTranslation, OptionTranslation
    from sqlmodel import select
    from fastapi import HTTPException

    logger.info(f"[DB_FALLBACK:QUESTION] Invoked DB fallback for Question #{question_number}, Exam ID={exam_id}")

    exam = await session.get(Exam, exam_id)
    if not exam:
        logger.warning(f"[DB_FALLBACK:QUESTION] Exam {exam_id} not found in database.")
        raise HTTPException(status_code=404, detail=f"Exam with ID '{exam_id}' not found.")

    stmt = select(Question).where(
        Question.exam_id == exam_id,
        Question.question_number_in_paper == question_number,
    )
    res = await session.exec(stmt)
    q = res.first()
    if not q:
        logger.warning(f"[DB_FALLBACK:QUESTION] Question #{question_number} not found in DB for exam '{exam.code}'.")
        raise HTTPException(
            status_code=404,
            detail=f"Question #{question_number} not found in exam '{exam.code}'.",
        )

    opts_res = await session.exec(
        select(QuestionOption).where(QuestionOption.question_id == q.id).order_by(QuestionOption.display_order)
    )
    db_opts = opts_res.all()

    q_trans_res = await session.exec(
        select(QuestionTranslation).where(QuestionTranslation.question_id == q.id)
    )
    db_q_trans = q_trans_res.all()
    trans_map = {
        (t.language.value if hasattr(t.language, "value") else str(t.language)): {
            "question_text": t.question_text
        }
        for t in db_q_trans
    }

    opts_list = []
    for o in db_opts:
        opt_trans_res = await session.exec(
            select(OptionTranslation).where(OptionTranslation.option_id == o.id)
        )
        db_opt_trans = opt_trans_res.all()
        opt_trans_map = {
            (ot.language.value if hasattr(ot.language, "value") else str(ot.language)): ot.option_text
            for ot in db_opt_trans
        }
        default_txt = db_opt_trans[0].option_text if db_opt_trans else f"Option {o.option_label}"
        opts_list.append({
            "option_id": str(o.id),
            "option_label": o.option_label,
            "text": default_txt,
            "display_order": o.display_order,
            "translations": opt_trans_map,
        })

    default_q_txt = db_q_trans[0].question_text if db_q_trans else f"Question #{q.question_number_in_paper}"
    logger.info(f"[DB_FALLBACK:QUESTION_SUCCESS] Successfully retrieved Question #{question_number} from DB (options_count={len(opts_list)}) for Exam '{exam.code}'")

    return {
        "question_number": question_number,
        "exam_id": str(exam.id),
        "exam_code": exam.code,
        "data": {
            "question_id": str(q.id),
            "question_number": q.question_number_in_paper,
            "section_code": q.section_code or "GENERAL",
            "text": default_q_txt,
            "translations": trans_map,
            "options": opts_list,
            "marks": q.marks,
            "negative_marks": q.negative_marks,
            "expected_time_seconds": q.expected_time_seconds or 60.0,
        },
        "source": "DATABASE_FALLBACK",
    }


@router.get("/{exam_id}/solution-artifact/{question_number}")
async def get_solution_artifact(
    exam_id: uuid.UUID,
    question_number: int,
    session: AsyncSession = Depends(get_async_session),
):
    """
    Fetches individual Solution JSON artifact presigned URL for question_number.
    """
    from app.db.models import Exam
    from app.storage.factory import get_storage_provider
    from fastapi import HTTPException

    exam = await session.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail=f"Exam with ID '{exam_id}' not found.")

    storage = get_storage_provider()
    paper_set = exam.paper_set_code or "SET_A"
    clean_set = str(paper_set).strip().lower().replace("_", "-")
    s_folder = exam.solutions_json_folder_path or f"artifacts/{exam.code}/{clean_set}/json/solutions"
    q_filename = f"Q{question_number:03d}.json"
    rel_path = f"{s_folder.rstrip('/')}/{q_filename}"

    logger.info(f"[EXAM_ARTIFACT] Querying S3 solution artifact: exam_id={exam_id}, code={exam.code}, question_number={question_number}, target_path='{rel_path}'")

    try:
        if await storage.exists(rel_path):
            presigned_url = await storage.generate_presigned_url(rel_path)
            logger.info(f"[EXAM_ARTIFACT:S3_HIT] Generated presigned URL for solution #{question_number}: {presigned_url[:60]}...")
            return {
                "question_number": question_number,
                "exam_id": str(exam.id),
                "exam_code": exam.code,
                "presigned_url": presigned_url,
                "source": "S3_ARTIFACT",
            }
        else:
            logger.warning(f"[EXAM_ARTIFACT:S3_MISS] Solution #{question_number} artifact not found at '{rel_path}'")
    except Exception as exc:
        logger.error(f"[EXAM_ARTIFACT:S3_ERROR] Error checking S3 path '{rel_path}': {exc}", exc_info=True)

    raise HTTPException(
        status_code=404,
        detail=f"Solution artifact #{question_number} not found in S3 storage folder.",
    )


@router.get("/{exam_id}/solution-db/{question_number}")
async def get_solution_from_db_fallback(
    exam_id: uuid.UUID,
    question_number: int,
    session: AsyncSession = Depends(get_async_session),
):
    """
    Dedicated Database Fallback endpoint: Directly queries PostgreSQL for solution explanation,
    correct option, and distractor closeness when S3 is unavailable.
    """
    from app.db.models import Exam, Question, QuestionOption, QuestionExplanation
    from app.engine.matrices.closeness_evaluator import ClosenessEvaluator
    from sqlmodel import select
    from fastapi import HTTPException

    logger.info(f"[DB_FALLBACK:SOLUTION] Invoked DB fallback for Solution #{question_number}, Exam ID={exam_id}")

    exam = await session.get(Exam, exam_id)
    if not exam:
        logger.warning(f"[DB_FALLBACK:SOLUTION] Exam {exam_id} not found in database.")
        raise HTTPException(status_code=404, detail=f"Exam with ID '{exam_id}' not found.")

    stmt = select(Question).where(
        Question.exam_id == exam_id,
        Question.question_number_in_paper == question_number,
    )
    res = await session.exec(stmt)
    q = res.first()
    if not q:
        logger.warning(f"[DB_FALLBACK:SOLUTION] Question #{question_number} not found in DB for exam '{exam.code}'.")
        raise HTTPException(
            status_code=404,
            detail=f"Question #{question_number} not found in exam '{exam.code}'.",
        )

    opts_res = await session.exec(
        select(QuestionOption).where(QuestionOption.question_id == q.id)
    )
    db_opts = opts_res.all()
    correct_opt = next((o for o in db_opts if o.is_correct), None)
    if not correct_opt:
        logger.error(f"[DB_FALLBACK:SOLUTION] No correct option configured in DB for question #{question_number}")
        raise HTTPException(status_code=404, detail="Correct option not configured in database.")

    expl_res = await session.exec(
        select(QuestionExplanation).where(QuestionExplanation.question_id == q.id)
    )
    expl_model = expl_res.first()

    distractor_map = {}
    for o in db_opts:
        closeness = getattr(o, "distractor_closeness_score", 0.0) or 0.0
        cls_tier = ClosenessEvaluator.classify_option(closeness)
        distractor_map[str(o.id)] = {
            "label": o.option_label,
            "closeness_score": closeness,
            "classification": cls_tier,
        }

    logger.info(f"[DB_FALLBACK:SOLUTION_SUCCESS] Successfully retrieved Solution #{question_number} from DB for Exam '{exam.code}' (correct_opt={correct_opt.option_label})")

    return {
        "question_number": question_number,
        "exam_id": str(exam.id),
        "exam_code": exam.code,
        "data": {
            "question_id": str(q.id),
            "question_number": q.question_number_in_paper,
            "correct_option_id": str(correct_opt.id),
            "correct_option_label": correct_opt.option_label,
            "explanation": {
                "text": expl_model.detailed_solution if expl_model else "Comprehensive explanation available in study mode.",
                "core_concept": expl_model.core_concept if expl_model else None,
                "key_takeaways": expl_model.key_takeaways_json if expl_model else [],
                "common_traps": expl_model.common_traps_json if expl_model else [],
            },
            "distractor_scores": distractor_map,
        },
        "source": "DATABASE_FALLBACK",
    }



@router.get("/export-zip")
async def download_exam_export_zip(
    background_tasks: BackgroundTasks,
    exam_name: str = Query(
        ...,
        description="Exam name in the uploaded 5-token format e.g. 'upsc_cse-prelims-gs1-2023-A' or 'upsc_cse-prelims-gs1-2023-A.pdf'",
    ),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Generates and downloads a production ZIP bundle containing all Pipeline 1-3 extracted information:
    - Per-question Markdown files (statements, options, correct answers, metadata, explanations, key takeaways, option distractor analysis).
    - Master SUMMARY_WEIGHTAGE.md (answer key & Subject/Topic/Subtopic weightage distribution).
    """
    export_service = ExamExportService(session)
    zip_path, filename = await export_service.create_exam_export_zip(exam_name)

    background_tasks.add_task(_remove_temp_file, str(zip_path))

    return FileResponse(
        path=str(zip_path),
        filename=filename,
        media_type="application/zip",
    )


@router.get("/{exam_name:path}/export-zip")
async def download_exam_export_zip_path(
    exam_name: str,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_async_session),
):
    """Path parameter alias for downloading exam export ZIP archives."""
    export_service = ExamExportService(session)
    zip_path, filename = await export_service.create_exam_export_zip(exam_name)

    background_tasks.add_task(_remove_temp_file, str(zip_path))

    return FileResponse(
        path=str(zip_path),
        filename=filename,
        media_type="application/zip",
    )


@router.get("/{exam_id}", response_model=Exam)
async def get_exam_detail(
    exam_id: uuid.UUID, session: AsyncSession = Depends(get_async_session)
):
    """Fetches details of a specific exam by ID."""
    service = ExamService(session)
    return await service.get_exam_detail(exam_id)

