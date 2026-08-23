import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, BackgroundTasks, HTTPException, Query
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import cast, String

from app.db.session import get_async_session
from app.db.models import LanguageCode, QuestionStatus
from app.db.models.user import User, UserRole
from app.schemas.auth import (
    AdminApprovalRequestOut,
    AdminActionPayload,
    UserOut,
    AdminApprovalLogOut,
    SystemStatsOut,
    AdminOverviewStatsOut,
)
from app.schemas.question import (
    QuestionDetailResponse,
    QuestionUpdatePayload,
    QuestionCreatePayload,
    ExamReviewQuestionsResponse,
)
from app.services.admin_service import AdminService
from app.services.question_service import QuestionService
from app.core.deps import require_roles

router = APIRouter(prefix="/admin", tags=["Admin Management"])


@router.get("/overview-stats", response_model=AdminOverviewStatsOut, summary="Get Live Admin Dashboard Overview Metrics")
async def get_admin_overview_stats(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    """
    Returns real-time dashboard statistics: total uploaded papers, extracted question counts,
    AI parsing accuracy, supported exam types, recent uploads feed, and subject distribution.
    """
    from app.cache import get_cache, build_cache_key
    cache = get_cache()
    cache_key = build_cache_key("admin:overview_stats")
    cached_data = await cache.get(cache_key)
    if cached_data is not None:
        return JSONResponse(content=jsonable_encoder(cached_data))

    service = AdminService(session)
    stats = await service.get_admin_overview_stats()
    if stats is not None:
        serialized = jsonable_encoder(stats)
        await cache.set(cache_key, serialized, ttl_seconds=300)
        return JSONResponse(content=serialized)
    return JSONResponse(content={})



@router.get("/pending-requests", response_model=List[AdminApprovalRequestOut])
async def list_pending_admin_requests(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    service = AdminService(session)
    return await service.list_pending_admin_requests()


@router.get("/active-admins", response_model=List[AdminApprovalRequestOut])
async def list_active_admins(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    service = AdminService(session)
    return await service.list_active_admins()


@router.post("/approve/{user_id}", response_model=UserOut)
async def approve_admin_request(
    user_id: str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    from app.cache import invalidate_user_cache, get_cache
    service = AdminService(session)
    res = await service.approve_admin_request(
        user_id=user_id, current_super_admin=current_user
    )
    await invalidate_user_cache(str(user_id))
    await get_cache().delete_pattern("ep:admin:overview_stats*")
    return res


@router.post("/reject/{user_id}", response_model=UserOut)
async def reject_admin_request(
    user_id: str,
    payload: AdminActionPayload = AdminActionPayload(),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    from app.cache import invalidate_user_cache, get_cache
    service = AdminService(session)
    res = await service.reject_admin_request(
        user_id=user_id, payload=payload, current_super_admin=current_user
    )
    await invalidate_user_cache(str(user_id))
    await get_cache().delete_pattern("ep:admin:overview_stats*")
    return res


@router.post("/suspend/{user_id}", response_model=UserOut)
async def suspend_admin_user(
    user_id: str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    from app.cache import invalidate_user_cache, get_cache
    service = AdminService(session)
    res = await service.suspend_admin_user(user_id=user_id)
    await invalidate_user_cache(str(user_id))
    await get_cache().delete_pattern("ep:admin:overview_stats*")
    return res


@router.post("/reactivate/{user_id}", response_model=UserOut)
async def reactivate_admin_user(
    user_id: str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    from app.cache import invalidate_user_cache, get_cache
    service = AdminService(session)
    res = await service.reactivate_admin_user(user_id=user_id)
    await invalidate_user_cache(str(user_id))
    await get_cache().delete_pattern("ep:admin:overview_stats*")
    return res


@router.get("/audit-logs", response_model=List[AdminApprovalLogOut])
async def get_approval_audit_logs(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    service = AdminService(session)
    return await service.get_approval_audit_logs()


@router.get("/system-stats", response_model=SystemStatsOut)
async def get_system_diagnostics(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    from app.cache import get_cache, build_cache_key
    cache = get_cache()
    cache_key = build_cache_key("admin:system_stats")
    cached_data = await cache.get(cache_key)
    if cached_data is not None:
        return JSONResponse(content=jsonable_encoder(cached_data))

    service = AdminService(session)
    stats = await service.get_system_diagnostics()
    if stats is not None:
        serialized = jsonable_encoder(stats)
        await cache.set(cache_key, serialized, ttl_seconds=300)
        return JSONResponse(content=serialized)
    return JSONResponse(content={})



@router.get("/exams/pipeline-status", summary="List All Exams with Pipeline Status & Question Metrics")
async def list_exam_pipeline_statuses(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    """
    Returns list of all exams with detailed 3-stage pipeline status, extracted question metrics,
    answer key mapping, explanation generation status, and S3 JSON folder artifact paths.
    """
    from app.cache import get_cache
    cache = get_cache()
    cache_key = "ep:admin:pipeline_status"
    cached_data = await cache.get(cache_key)
    if cached_data is not None:
        return JSONResponse(content=jsonable_encoder(cached_data))

    from sqlmodel import select, func, case
    from app.db.models import Exam, Question, QuestionOption, QuestionExplanation, QuestionStatus
    from app.db.models.pipeline_run import PipelineRun
    from sqlalchemy import cast, String

    # 1. Fetch all exams ordered by source year desc
    res = await session.exec(select(Exam).order_by(Exam.source_year.desc(), Exam.created_at.desc()))
    exams = res.all()

    # 2. Aggregated Question counts per exam
    q_stmt = (
        select(
            Question.exam_id,
            func.count(Question.id).label("total_q"),
            func.sum(case((cast(Question.status, String) == "PUBLISHED", 1), else_=0)).label("pub_q"),
            func.sum(case((cast(Question.status, String) == "PENDING_HUMAN_REVIEW", 1), else_=0)).label("pend_q"),
            func.sum(case((cast(Question.status, String) == "REJECTED", 1), else_=0)).label("rej_q"),
        )
        .group_by(Question.exam_id)
    )
    q_rows = (await session.exec(q_stmt)).all()
    q_map = {row[0]: {"total": row[1] or 0, "pub": row[2] or 0, "pend": row[3] or 0, "rej": row[4] or 0} for row in q_rows}

    # 3. Aggregated correct answers per exam
    key_stmt = (
        select(Question.exam_id, func.count(func.distinct(Question.id)))
        .select_from(Question)
        .join(QuestionOption, Question.id == QuestionOption.question_id)
        .where(QuestionOption.is_correct == True)
        .group_by(Question.exam_id)
    )
    key_rows = (await session.exec(key_stmt)).all()
    key_map = {row[0]: row[1] or 0 for row in key_rows}

    # 4. Aggregated valid explanations per exam (only non-empty detailed solutions)
    exp_stmt = (
        select(Question.exam_id, func.count(func.distinct(QuestionExplanation.question_id)))
        .select_from(Question)
        .join(QuestionExplanation, Question.id == QuestionExplanation.question_id)
        .where(
            QuestionExplanation.detailed_solution != None,
            QuestionExplanation.detailed_solution != "",
        )
        .group_by(Question.exam_id)
    )
    exp_rows = (await session.exec(exp_stmt)).all()
    exp_map = {row[0]: row[1] or 0 for row in exp_rows}

    # 5. Check AnswerKeyBatch for extracted key counts
    from app.db.models.answer_key import AnswerKeyBatch
    ak_stmt = select(
        AnswerKeyBatch.exam_id,
        func.max(AnswerKeyBatch.total_keys_mapped),
        func.max(AnswerKeyBatch.total_keys_extracted),
    ).group_by(AnswerKeyBatch.exam_id)
    ak_rows = (await session.exec(ak_stmt)).all()
    ak_map = {
        row[0]: max(row[1] or 0, row[2] or 0)
        for row in ak_rows
    }

    # 6. Fetch all PipelineRun records for real-time stage statuses
    run_stmt = select(PipelineRun)
    run_rows = (await session.exec(run_stmt)).all()
    run_map: dict = {}
    for r in run_rows:
        if r.exam_id not in run_map:
            run_map[r.exam_id] = {}
        run_map[r.exam_id][r.pipeline_type] = r

    pipeline_list = []
    for exam in exams:
        q_info = q_map.get(exam.id, {"total": 0, "pub": 0, "pend": 0, "rej": 0})
        q_count = q_info["total"]
        pub_count = q_info["pub"]
        pend_count = q_info["pend"]
        rej_count = q_info["rej"]

        total_exp = exam.total_questions or 100

        # Exact and bounded key count
        raw_key_count = key_map.get(exam.id, 0)
        if raw_key_count == 0 and ak_map.get(exam.id, 0) > 0:
            raw_key_count = ak_map.get(exam.id, 0)
        key_count = min(raw_key_count, q_count if q_count > 0 else total_exp)

        # Exact and bounded explanation count
        raw_exp_count = exp_map.get(exam.id, 0)
        exp_count = min(raw_exp_count, q_count if q_count > 0 else total_exp)

        has_paper = bool(exam.pdf_path or q_count > 0)
        has_key = bool(exam.answer_key_pdf_path or key_count > 0 or exam.paper_set_code)

        status_str = exam.status.value if hasattr(exam.status, "value") else str(exam.status)

        # PipelineRun lookups
        exam_runs = run_map.get(exam.id, {})
        p1 = exam_runs.get("QUESTION_EXTRACTION")
        p2 = exam_runs.get("ANSWER_KEY")
        p3 = exam_runs.get("EXPLANATION_INDEXING") or exam_runs.get("EXPLANATION_GENERATION") or exam_runs.get("EXPLANATION")

        # Stage 1: Extraction Status
        if p1:
            p1_status_upper = str(p1.status).upper()
            if p1_status_upper in ("COMPLETED", "WAITING_FOR_ANSWER_KEY", "WAITING_FOR_HITL") or (q_count > 0 and (status_str == "PUBLISHED" or q_count >= total_exp)):
                stage1_status = "COMPLETED"
            elif p1_status_upper in ("RUNNING", "PROCESSING", "INITIALIZING") or status_str in ("PROCESSING", "PARSING_PDF", "EXTRACTING"):
                stage1_status = "IN_PROGRESS"
            elif p1_status_upper in ("FAILED", "STOPPED", "CANCELLED"):
                stage1_status = "FAILED"
            elif not has_paper:
                stage1_status = "MISSING_INPUT"
            else:
                stage1_status = "QUEUED"
        else:
            if q_count > 0 and (status_str == "PUBLISHED" or q_count >= total_exp):
                stage1_status = "COMPLETED"
            elif q_count > 0 or status_str in ("PROCESSING", "PARSING_PDF", "EXTRACTING"):
                stage1_status = "IN_PROGRESS"
            elif not has_paper:
                stage1_status = "MISSING_INPUT"
            else:
                stage1_status = "QUEUED"

        # Stage 2: Key Mapping Status
        if p2:
            p2_status_upper = str(p2.status).upper()
            if p2_status_upper in ("COMPLETED", "MATCHED") or status_str == "PUBLISHED" or (key_count >= q_count and q_count > 0):
                stage2_status = "COMPLETED"
            elif p2_status_upper in ("RUNNING", "PROCESSING"):
                stage2_status = "IN_PROGRESS"
            elif p2_status_upper in ("FAILED", "CANCELLED"):
                stage2_status = "FAILED"
            elif not has_key:
                stage2_status = "MISSING_INPUT"
            else:
                stage2_status = "QUEUED"
        else:
            if status_str == "PUBLISHED" or (key_count > 0 and key_count >= q_count):
                stage2_status = "COMPLETED"
            elif not has_key:
                stage2_status = "MISSING_INPUT"
            elif key_count > 0 or status_str in ("ANSWER_KEY_MAPPING", "PROCESSING"):
                stage2_status = "IN_PROGRESS"
            elif stage1_status == "COMPLETED" and exam.paper_set_code:
                stage2_status = "COMPLETED"
            else:
                stage2_status = "QUEUED"

        # Stage 3: Explanations Status
        if p3:
            p3_status_upper = str(p3.status).upper()
            if p3_status_upper == "COMPLETED" or status_str == "PUBLISHED" or (exp_count >= q_count and q_count > 0):
                stage3_status = "COMPLETED"
            elif p3_status_upper in ("RUNNING", "PROCESSING") or exp_count > 0:
                stage3_status = "IN_PROGRESS"
            elif p3_status_upper in ("FAILED", "CANCELLED"):
                stage3_status = "FAILED"
            elif stage1_status != "COMPLETED" or stage2_status != "COMPLETED":
                stage3_status = "WAITING_INPUTS"
            else:
                stage3_status = "QUEUED"
        else:
            if status_str == "PUBLISHED" or (exp_count > 0 and exp_count >= q_count):
                stage3_status = "COMPLETED"
            elif exp_count > 0:
                stage3_status = "IN_PROGRESS"
            elif stage1_status != "COMPLETED" or stage2_status != "COMPLETED":
                stage3_status = "WAITING_INPUTS"
            else:
                stage3_status = "QUEUED"

        # Overall Status
        is_s3_published = status_str == "PUBLISHED" and bool(exam.questions_json_path or exam.questions_json_folder_path)
        if is_s3_published:
            overall_status = "PUBLISHED"
        elif not has_paper or not has_key:
            overall_status = "MISSING_INPUTS"
        elif stage1_status == "IN_PROGRESS" or stage2_status == "IN_PROGRESS" or stage3_status == "IN_PROGRESS" or status_str in ("PROCESSING", "PARSING_PDF"):
            overall_status = "PROCESSING"
        elif stage1_status == "COMPLETED" and stage2_status == "COMPLETED" and stage3_status == "COMPLETED":
            overall_status = "READY_FOR_REVIEW"
        else:
            overall_status = "PENDING_REVIEW"

        pipeline_list.append({
            "id": str(exam.id),
            "code": exam.code,
            "name": exam.name,
            "source_year": exam.source_year,
            "stage": exam.stage,
            "subject_code": exam.subject_code,
            "paper_set_code": exam.paper_set_code,
            "status": status_str,
            "overall_status": overall_status,
            "stage1_status": stage1_status,
            "stage2_status": stage2_status,
            "stage3_status": stage3_status,
            "stage1_step": p1.current_step if p1 else None,
            "stage2_step": p2.current_step if p2 else None,
            "stage3_step": p3.current_step if p3 else None,
            "stage3_progress": p3.progress_percent if p3 else (100.0 if stage3_status == "COMPLETED" else 0.0),
            "is_active": exam.is_active,
            "total_questions": total_exp,
            "extracted_questions_count": q_count,
            "missing_questions_count": exam.missing_questions_count or max(0, total_exp - q_count),
            "published_questions_count": pub_count,
            "pending_questions_count": pend_count,
            "rejected_questions_count": rej_count,
            "key_mapped_count": key_count,
            "explanations_count": exp_count,
            "has_question_paper": has_paper,
            "has_answer_key": has_key,
            "pdf_path": exam.pdf_path,
            "answer_key_pdf_path": exam.answer_key_pdf_path,
            "stage1_status": stage1_status,
            "stage2_status": stage2_status,
            "stage3_status": stage3_status,
            "questions_json_path": exam.questions_json_path,
            "solutions_json_path": exam.solutions_json_path,
            "questions_json_folder_path": exam.questions_json_folder_path,
            "solutions_json_folder_path": exam.solutions_json_folder_path,
        })

    encoded = jsonable_encoder(pipeline_list)
    await cache.set(cache_key, encoded, ttl_seconds=10)
    return JSONResponse(content=encoded)


@router.get("/exams/stuck-pipelines", summary="List Interrupted / Stuck Pipelines Requiring Admin Action")
async def list_stuck_pipelines(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    """
    Returns any pipelines that were interrupted (e.g. server restart/reload, worker failure, or stopped mid-way)
    so the admin UI can display an action prompt to resume with skipped pre-extracted items.
    """
    from app.cache import get_cache
    cache = get_cache()
    cache_key = "ep:admin:stuck_pipelines"
    cached_data = await cache.get(cache_key)
    if cached_data is not None:
        return JSONResponse(content=jsonable_encoder(cached_data))

    from sqlmodel import select, func
    from app.db.models import Exam, Question, QuestionOption, QuestionExplanation, ExamStatus
    from app.db.models.pipeline_run import PipelineRun
    from app.services.task_registry import task_registry

    # 1. Fetch all runs
    runs = (await session.exec(select(PipelineRun))).all()
    run_map: dict = {}
    for r in runs:
        if r.exam_id not in run_map:
            run_map[r.exam_id] = {}
        run_map[r.exam_id][r.pipeline_type] = r

    # 2. Fetch all exams that are not published
    exams = (await session.exec(
        select(Exam).where(cast(Exam.status, String) != "PUBLISHED")
    )).all()

    # 3. Batch aggregate question counts
    q_stmt = select(Question.exam_id, func.count(Question.id)).group_by(Question.exam_id)
    q_map = {row[0]: row[1] or 0 for row in (await session.exec(q_stmt)).all()}

    # 4. Batch aggregate key-mapped counts
    key_stmt = (
        select(Question.exam_id, func.count(func.distinct(Question.id)))
        .select_from(Question)
        .join(QuestionOption, Question.id == QuestionOption.question_id)
        .where(QuestionOption.is_correct == True)
        .group_by(Question.exam_id)
    )
    key_map = {row[0]: row[1] or 0 for row in (await session.exec(key_stmt)).all()}

    # 5. Batch aggregate explanation counts
    exp_stmt = (
        select(Question.exam_id, func.count(func.distinct(QuestionExplanation.question_id)))
        .select_from(Question)
        .join(QuestionExplanation, Question.id == QuestionExplanation.question_id)
        .where(
            QuestionExplanation.detailed_solution != None,
            QuestionExplanation.detailed_solution != "",
        )
        .group_by(Question.exam_id)
    )
    exp_map = {row[0]: row[1] or 0 for row in (await session.exec(exp_stmt)).all()}

    stuck_list = []

    for exam in exams:
        is_active = (
            task_registry.is_running(str(exam.id))
            or task_registry.is_running(f"qp_{exam.id}")
            or task_registry.is_running(f"ak_{exam.id}")
            or task_registry.is_running(f"exp_{exam.id}")
        )
        if is_active:
            continue  # Actively running in current process/worker

        q_count = q_map.get(exam.id, 0)
        key_count = key_map.get(exam.id, 0)
        exp_count = exp_map.get(exam.id, 0)

        total_exp = exam.total_questions or 100
        exam_runs = run_map.get(exam.id, {})
        p1 = exam_runs.get("QUESTION_EXTRACTION")
        p2 = exam_runs.get("ANSWER_KEY")
        p3 = exam_runs.get("EXPLANATION_INDEXING") or exam_runs.get("EXPLANATION_GENERATION") or exam_runs.get("EXPLANATION")

        # Determine if any stage is incomplete / interrupted
        is_stuck = False
        stuck_stage = "EXPLANATION_INDEXING"
        stuck_step = "INTERRUPTED"
        stuck_progress = 0.0

        if p3 and p3.status in ("INTERRUPTED", "FAILED", "STOPPED", "CANCELLED", "RUNNING"):
            is_stuck = True
            stuck_stage = "EXPLANATION_INDEXING"
            stuck_step = p3.current_step
            stuck_progress = p3.progress_percent
        elif p2 and p2.status in ("INTERRUPTED", "FAILED", "STOPPED", "CANCELLED", "RUNNING"):
            is_stuck = True
            stuck_stage = "ANSWER_KEY"
            stuck_step = p2.current_step
            stuck_progress = p2.progress_percent
        elif p1 and p1.status in ("INTERRUPTED", "FAILED", "STOPPED", "CANCELLED", "RUNNING"):
            is_stuck = True
            stuck_stage = "QUESTION_EXTRACTION"
            stuck_step = p1.current_step
            stuck_progress = p1.progress_percent
        elif q_count > 0 and exp_count < q_count and (p3 is None or p3.status != "COMPLETED"):
            is_stuck = True
            stuck_stage = "EXPLANATION_INDEXING"
            stuck_step = f"INCOMPLETE_EXPLANATIONS_({exp_count}/{q_count})"
            stuck_progress = round((exp_count / max(1, q_count)) * 100.0, 1)
        elif q_count > 0 and key_count < q_count and exam.answer_key_pdf_path and (p2 is None or p2.status != "COMPLETED"):
            is_stuck = True
            stuck_stage = "ANSWER_KEY"
            stuck_step = f"INCOMPLETE_ANSWER_KEY_MAPPING_({key_count}/{q_count})"
            stuck_progress = round((key_count / max(1, q_count)) * 100.0, 1)

        # Check if explicitly dismissed
        if (p3 and p3.status == "DISMISSED") or (p1 and p1.status == "DISMISSED"):
            continue

        if is_stuck:
            stuck_list.append({
                "exam_id": str(exam.id),
                "exam_name": exam.name,
                "exam_code": exam.code,
                "pipeline_type": stuck_stage,
                "status": "INTERRUPTED",
                "current_step": stuck_step,
                "progress_percent": stuck_progress,
                "extracted_questions_count": q_count,
                "key_mapped_count": key_count,
                "explanations_count": exp_count,
                "total_questions": total_exp,
                "can_resume": True,
            })

    encoded = jsonable_encoder(stuck_list)
    await cache.set(cache_key, encoded, ttl_seconds=10)
    return JSONResponse(content=encoded)


@router.post("/exams/{exam_id}/resume-pipeline", summary="Resume Interrupted Pipeline Skipping Completed Parts")
async def resume_interrupted_pipeline(
    exam_id: str,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    """
    Resumes an interrupted pipeline for an exam in the background, immediately returning HTTP 200 in <10ms.
    Automatically skips any questions/explanations that were already extracted or generated in the database.
    """
    import uuid
    import asyncio
    from fastapi import HTTPException
    from sqlmodel import select, func
    from app.db.models import Exam, Question, QuestionOption, QuestionExplanation, AnswerKeyBatch
    from app.db.models.pipeline_run import PipelineRun
    from app.services.pipeline_management_service import PipelineManagementService
    from app.services.task_registry import task_registry

    try:
        exam_uuid = uuid.UUID(exam_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid exam_id UUID: '{exam_id}'")

    exam = await session.get(Exam, exam_uuid)
    if not exam:
        raise HTTPException(status_code=404, detail=f"Exam '{exam_id}' not found.")

    pm = PipelineManagementService(session)

    q_count = (await session.exec(select(func.count(Question.id)).where(Question.exam_id == exam_uuid))).first() or 0
    key_count = (await session.exec(
        select(func.count(func.distinct(Question.id)))
        .select_from(Question)
        .join(QuestionOption, Question.id == QuestionOption.question_id)
        .where(Question.exam_id == exam_uuid, QuestionOption.is_correct == True)
    )).first() or 0
    exp_count = (await session.exec(
        select(func.count(func.distinct(QuestionExplanation.question_id)))
        .select_from(Question)
        .join(QuestionExplanation, Question.id == QuestionExplanation.question_id)
        .where(
            Question.exam_id == exam_uuid,
            QuestionExplanation.detailed_solution != None,
            QuestionExplanation.detailed_solution != "",
        )
    )).first() or 0

    key = str(exam_uuid)

    from app.tasks.celery_app import has_active_celery_workers
    use_celery = has_active_celery_workers()

    # Case 1: Stage 1 (Extraction) incomplete and pdf_path exists
    if q_count == 0 and exam.pdf_path:
        from app.tasks.exam_tasks import async_process_exam_pdf, process_exam_pdf_task
        await pm.update_pipeline_status(
            exam_id=exam_uuid,
            pipeline_type="QUESTION_EXTRACTION",
            status="RUNNING",
            current_step="RESUMING_QUESTION_EXTRACTION",
            progress_percent=10.0,
        )
        task_id = f"resume_p1_{uuid.uuid4().hex[:8]}"
        if use_celery:
            task_res = process_exam_pdf_task.delay(str(exam_uuid), exam.pdf_path, exam.name, task_id)
            task_registry.register_celery_task(key, getattr(task_res, "id", task_id))
        else:
            background_tasks.add_task(
                async_process_exam_pdf,
                pdf_path_or_storage_key=exam.pdf_path,
                exam_title=exam.name,
                exam_id_str=str(exam_uuid),
                task_id=task_id,
            )
        return {
            "status": "RESUMED",
            "stage": "QUESTION_EXTRACTION",
            "message": f"Extraction resumed for '{exam.name}'.",
        }

    # Case 2: Stage 2 (Answer Key Mapping) incomplete
    ak_batch = (await session.exec(select(AnswerKeyBatch).where(AnswerKeyBatch.exam_id == exam_uuid))).first()
    if ak_batch and key_count < q_count:
        async def _resume_stage_2():
            from app.db.session import managed_async_session
            from app.services.answer_key_service import AnswerKeyService
            from app.services.pipeline_management_service import PipelineManagementService
            async with managed_async_session() as bg_session:
                bg_ak = AnswerKeyService(bg_session)
                bg_pm = PipelineManagementService(bg_session)
                await bg_ak.map_stored_answers_from_db(exam_uuid)
                await bg_pm.on_pipeline_2_completed(exam_id=exam_uuid, auto_trigger_pipeline_3=True)

        background_tasks.add_task(_resume_stage_2)
        return {
            "status": "RESUMED",
            "stage": "ANSWER_KEY",
            "message": f"Answer keys mapping resumed for '{exam.name}'.",
        }

    # Case 3: Stage 3 (Explanation Generation) incomplete
    from app.tasks.explanation_tasks import async_process_exam_explanations, process_exam_explanations_task
    await pm.update_pipeline_status(
        exam_id=exam_uuid,
        pipeline_type="EXPLANATION_INDEXING",
        status="RUNNING",
        current_step=f"RESUMING_EXPLANATIONS_FROM_({exp_count}/{q_count})",
        progress_percent=max(10.0, (exp_count / max(1, q_count)) * 90.0),
    )
    task_id = f"resume_p3_{uuid.uuid4().hex[:8]}"
    if use_celery:
        task_res = process_exam_explanations_task.delay(str(exam_uuid), None, "ENGLISH", task_id)
        task_registry.register_celery_task(f"exp_{exam_uuid}", getattr(task_res, "id", task_id))
    else:
        background_tasks.add_task(
            async_process_exam_explanations,
            exam_id_str=str(exam_uuid),
            task_id=task_id,
        )
    return {
        "status": "RESUMED",
        "stage": "EXPLANATION_INDEXING",
        "message": f"Explanation generation resumed for '{exam.name}' (skipping {exp_count} existing explanations).",
    }


@router.post("/exams/{exam_id}/dismiss-stuck-pipeline", summary="Dismiss Interrupted Pipeline Prompt")
async def dismiss_stuck_pipeline(
    exam_id: str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    """Dismisses the interrupted status prompt for an exam."""
    import uuid
    from fastapi import HTTPException
    from sqlmodel import select
    from app.db.models.pipeline_run import PipelineRun

    try:
        exam_uuid = uuid.UUID(exam_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid exam_id UUID: '{exam_id}'")

    runs = (await session.exec(select(PipelineRun).where(PipelineRun.exam_id == exam_uuid, PipelineRun.status == "INTERRUPTED"))).all()
    for r in runs:
        r.status = "DISMISSED"
        session.add(r)
    await session.commit()
    return {"status": "DISMISSED", "message": f"Interrupted pipeline prompt dismissed for exam {exam_id}."}


@router.get(
    "/exams/{exam_id}/review-questions",
    response_model=ExamReviewQuestionsResponse,
    summary="Get Exam Questions with Full Solution Knowledge Base for Review",
)
async def get_exam_review_questions_admin(
    exam_id: uuid.UUID,
    language: LanguageCode = Query(default=LanguageCode.ENGLISH, description="Target Language"),
    status: Optional[QuestionStatus] = Query(default=None, description="Filter by Question status"),
    page: int = Query(default=1, ge=1, description="Page number"),
    limit: int = Query(default=10, ge=1, le=100, description="Items per page"),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    """Admin review endpoint returning all questions with full solutions, option explanations, and review counters."""
    from app.cache import get_cache, build_cache_key
    cache = get_cache()
    cache_key = build_cache_key(
        "admin:review",
        str(exam_id),
        page=page,
        limit=limit,
        lang=str(language.value if hasattr(language, "value") else language),
        status=str(status.value if hasattr(status, "value") else status) if status else None,
    )
    cached_data = await cache.get(cache_key)
    if cached_data is not None:
        return JSONResponse(content=jsonable_encoder(cached_data))

    q_service = QuestionService(session)
    review_res = await q_service.get_exam_questions_for_review(
        exam_id=exam_id,
        page=page,
        limit=limit,
        language=language,
        status=status,
    )
    if review_res is not None:
        serialized = jsonable_encoder(review_res)
        await cache.set(cache_key, serialized, ttl_seconds=1800)
        return JSONResponse(content=serialized)
    return JSONResponse(content={})


@router.post("/exams/{exam_id}/approve", summary="Approve Exam & Build JSON Folders")
async def approve_and_publish_exam(
    exam_id: str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    """
    Requirement 9, 10 & 11: Admin approves the exam paper after human review.
    1. Triggers automatic generation of questions JSON and solutions JSON.
    2. Uploads individual question and solution JSONs to S3 folder paths.
    3. Saves questions_json_folder_path and solutions_json_folder_path on Exam DB record.
    4. Sets Exam.status = PUBLISHED and Exam.is_active = True.
    """
    import uuid
    from fastapi import HTTPException
    from app.db.models import Exam, ExamStatus, Question, QuestionStatus
    from app.services.exam_json_builder import ExamJsonBuilder
    from sqlmodel import select

    try:
        exam_uuid = uuid.UUID(exam_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid exam_id UUID: '{exam_id}'")

    exam = await session.get(Exam, exam_uuid)
    if not exam:
        raise HTTPException(status_code=404, detail=f"Exam with ID '{exam_id}' not found.")

    q_res = await session.exec(select(Question).where(Question.exam_id == exam_uuid))
    questions = q_res.all()

    if not questions:
        raise HTTPException(
            status_code=422,
            detail=f"EXAM_CANNOT_BE_APPROVED: Exam '{exam.code}' has no extracted questions."
        )

    # Validate that each and every question has been reviewed and published
    unreviewed_qs = [q for q in questions if q.status != QuestionStatus.PUBLISHED]
    if unreviewed_qs:
        pending_count = sum(1 for q in unreviewed_qs if q.status == QuestionStatus.PENDING_HUMAN_REVIEW)
        rejected_count = sum(1 for q in unreviewed_qs if q.status == QuestionStatus.REJECTED)
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cannot publish exam '{exam.name}': {len(unreviewed_qs)} question(s) are not yet approved "
                f"({pending_count} pending review, {rejected_count} rejected). "
                f"All questions must be reviewed and marked as PUBLISHED before publishing to S3."
            ),
        )

    # Pre-flight Database Integrity / Corruption Validation
    from app.db.models import PipelineRun, QuestionTranslation, QuestionOption

    for q in questions:
        qt_stmt = select(QuestionTranslation).where(QuestionTranslation.question_id == q.id)
        qt_res = await session.exec(qt_stmt)
        q_trans = qt_res.all()
        has_text = any(t.question_text and t.question_text.strip() for t in q_trans)
        if not has_text:
            corruption_msg = f"EXAM_DATA_CORRUPTED: Question #{q.question_number_in_paper} has blank or missing question statement text in database."
            corrupt_run = PipelineRun(
                exam_id=exam_uuid,
                pipeline_type="S3_PUBLISH",
                status="CORRUPTED",
                current_step="CORRUPTED_DATABASE_RECORD",
                progress_percent=0.0,
                error_log=corruption_msg,
            )
            session.add(corrupt_run)
            await session.commit()
            raise HTTPException(status_code=422, detail=corruption_msg)

        opt_stmt = select(QuestionOption).where(QuestionOption.question_id == q.id)
        opt_res = await session.exec(opt_stmt)
        q_opts = opt_res.all()
        if not q_opts:
            corruption_msg = f"EXAM_DATA_CORRUPTED: Question #{q.question_number_in_paper} has 0 answer options in database."
            corrupt_run = PipelineRun(
                exam_id=exam_uuid,
                pipeline_type="S3_PUBLISH",
                status="CORRUPTED",
                current_step="CORRUPTED_DATABASE_RECORD",
                progress_percent=0.0,
                error_log=corruption_msg,
            )
            session.add(corrupt_run)
            await session.commit()
            raise HTTPException(status_code=422, detail=corruption_msg)

    # 1 & 2. Generate JSON files and upload to S3 folder paths with Retryable Error Handling
    builder = ExamJsonBuilder(session)
    try:
        json_paths = await builder.generate_and_upload(exam_uuid, sync_all=True)
    except Exception as s3_err:
        logger.error(f"S3 publishing failed for exam '{exam.code}': {s3_err}", exc_info=True)
        # Record retryable failed pipeline run
        failed_run = PipelineRun(
            exam_id=exam_uuid,
            pipeline_type="S3_PUBLISH",
            status="FAILED",
            current_step="S3_UPLOAD_FAILED",
            progress_percent=0.0,
            error_log=str(s3_err),
        )
        session.add(failed_run)
        await session.commit()
        raise HTTPException(
            status_code=500,
            detail=f"S3_PUBLISH_FAILED: {str(s3_err)}. This failure is fixable through retry.",
        )

    # 3 & 4. Mark exam status as PUBLISHED and is_active as True, and record successful PipelineRun
    exam.status = ExamStatus.PUBLISHED
    exam.is_active = True
    session.add(exam)

    success_run = PipelineRun(
        exam_id=exam_uuid,
        pipeline_type="S3_PUBLISH",
        status="COMPLETED",
        current_step="PUBLISHED_TO_S3",
        progress_percent=100.0,
        error_log=None,
    )
    session.add(success_run)

    await session.commit()
    await session.refresh(exam)

    from app.cache import invalidate_exam_cache
    await invalidate_exam_cache(str(exam.id))

    return {
        "status": "APPROVED_AND_PUBLISHED",
        "publish_status": "PUBLISHED",
        "exam_id": str(exam.id),
        "exam_code": exam.code,
        "exam_status": exam.status.value if hasattr(exam.status, "value") else str(exam.status),
        "is_active": exam.is_active,
        "questions_count": len(questions),
        "questions_json_path": exam.questions_json_path,
        "solutions_json_path": exam.solutions_json_path,
        "questions_json_folder_path": exam.questions_json_folder_path,
        "solutions_json_folder_path": exam.solutions_json_folder_path,
        "last_synced_at": exam.last_synced_at.isoformat() if exam.last_synced_at else None,
        "updated_at": exam.updated_at.isoformat() if exam.updated_at else None,
        "is_s3_out_of_sync": False,
        "message": f"Exam '{exam.code}' successfully approved, published, activated, and JSON folders generated.",
    }


@router.post("/exams/{exam_id}/sync", status_code=202, summary="Sync Exam Questions & Solutions to S3 (Background Task)")
async def sync_exam_s3_artifacts(
    exam_id: str,
    background_tasks: BackgroundTasks,
    sync_all: bool = Query(default=False, description="If True, re-syncs all individual questions + master JSON. If False (default), re-syncs only master exam JSONs."),
    sync_target: str = Query(default="MASTERS_ONLY", description="Sync target scope: 'MASTERS_ONLY' (both masters), 'QUESTIONS_MASTER', 'SOLUTIONS_MASTER', 'FULL_ALL'"),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    """
    Launches a background task to regenerate and upload consolidated exam_questions.json
    and exam_solutions.json (and optionally all individual Q files if sync_all=True or sync_target='FULL_ALL') to S3,
    updating last_synced_at upon completion.
    """
    import uuid
    from datetime import datetime, timezone
    from fastapi import HTTPException
    from app.db.models import Exam, Question
    from app.db.models.pipeline_run import PipelineRun
    from sqlmodel import select

    try:
        exam_uuid = uuid.UUID(exam_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid exam_id UUID: '{exam_id}'")

    exam = await session.get(Exam, exam_uuid)
    if not exam:
        raise HTTPException(status_code=404, detail=f"Exam with ID '{exam_id}' not found.")

    q_res = await session.exec(select(Question).where(Question.exam_id == exam_uuid))
    questions = q_res.all()
    if not questions:
        raise HTTPException(
            status_code=422,
            detail=f"EXAM_CANNOT_BE_SYNCED: Exam '{exam.code}' has no questions in database."
        )

    if sync_all:
        sync_target = "FULL_ALL"

    # Check if a sync or publish pipeline is already running
    existing_run_stmt = (
        select(PipelineRun)
        .where(
            PipelineRun.exam_id == exam_uuid,
            PipelineRun.pipeline_type.in_(["S3_PUBLISH", "S3_SYNC"]),
            PipelineRun.status.in_(["RUNNING", "IN_PROGRESS", "QUEUED", "PENDING"]),
        )
        .order_by(PipelineRun.started_at.desc())
    )
    existing_run = (await session.exec(existing_run_stmt)).first()
    if existing_run:
        return {
            "status": "SYNC_ALREADY_IN_PROGRESS",
            "pipeline_run_id": str(existing_run.id),
            "exam_id": str(exam.id),
            "exam_code": exam.code,
            "is_syncing": True,
            "message": f"S3 synchronization is already running in background for exam '{exam.code}'.",
        }

    # Create new PipelineRun for S3_PUBLISH
    run = PipelineRun(
        exam_id=exam_uuid,
        pipeline_type="S3_PUBLISH",
        status="RUNNING",
        current_step=f"INITIALIZING_S3_SYNC_({sync_target.upper()})",
        progress_percent=10.0,
        started_at=datetime.now(timezone.utc),
    )
    session.add(run)
    await session.commit()
    await session.refresh(run)

    run_id = run.id

    from app.tasks.celery_app import has_active_celery_workers
    from app.tasks.sync_tasks import async_sync_exam_s3, sync_exam_s3_task
    from app.services.task_registry import task_registry

    use_celery = has_active_celery_workers()
    task_id = f"s3_sync_{uuid.uuid4().hex[:8]}"

    if use_celery:
        celery_res = sync_exam_s3_task.delay(
            str(exam_uuid),
            str(run_id),
            sync_all=sync_all,
            sync_target=sync_target,
            task_id=task_id,
            execution_engine="Celery Worker",
        )
        task_registry.register_celery_task(str(exam_uuid), getattr(celery_res, "id", task_id))
        task_registry.register_celery_task(f"sync_{exam_uuid}", getattr(celery_res, "id", task_id))
        execution_engine = "Celery Worker"
    else:
        background_tasks.add_task(
            async_sync_exam_s3,
            exam_id_str=str(exam_uuid),
            run_id_str=str(run_id),
            sync_all=sync_all,
            sync_target=sync_target,
            task_id=task_id,
            execution_engine="FastAPI BackgroundTasks",
            session=session,
        )
        execution_engine = "FastAPI BackgroundTasks"

    scope_name = (
        "Full S3 Sync (Master + All Individual Q Files)"
        if sync_target == "FULL_ALL"
        else "Master Solutions JSON Sync"
        if sync_target == "SOLUTIONS_MASTER"
        else "Master Questions JSON Sync"
        if sync_target == "QUESTIONS_MASTER"
        else "Master Questions & Solutions Sync"
    )

    return {
        "status": "SYNC_STARTED",
        "pipeline_run_id": str(run_id),
        "exam_id": str(exam.id),
        "exam_code": exam.code,
        "sync_all": sync_all,
        "sync_target": sync_target,
        "is_syncing": True,
        "execution_engine": execution_engine,
        "message": f"{scope_name} started ({execution_engine}) for exam '{exam.code}'.",
    }


@router.get("/exams/{exam_id}/sync-status", summary="Get S3 Sync Status of Exam")
async def get_exam_sync_status(
    exam_id: str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    """
    Returns the current S3 sync status, whether a background sync task is currently running,
    progress info, error logs if failed, and sync timestamps.
    """
    import uuid
    from fastapi import HTTPException
    from app.db.models import Exam, ExamStatus
    from app.db.models.pipeline_run import PipelineRun
    from sqlmodel import select

    try:
        exam_uuid = uuid.UUID(exam_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid exam_id UUID: '{exam_id}'")

    exam = await session.get(Exam, exam_uuid)
    if not exam:
        raise HTTPException(status_code=404, detail=f"Exam with ID '{exam_id}' not found.")

    publish_run_stmt = (
        select(PipelineRun)
        .where(
            PipelineRun.exam_id == exam_uuid,
            PipelineRun.pipeline_type.in_(["S3_PUBLISH", "S3_SYNC"]),
        )
        .order_by(PipelineRun.started_at.desc())
    )
    publish_run = (await session.exec(publish_run_stmt)).first()

    is_syncing = bool(publish_run and publish_run.status in ("RUNNING", "IN_PROGRESS", "QUEUED", "PENDING"))

    exam_status_str = exam.status.value if hasattr(exam.status, "value") else str(exam.status)
    is_published = (exam_status_str == "PUBLISHED") and bool(exam.questions_json_path or exam.questions_json_folder_path)

    is_s3_out_of_sync = False
    if is_published:
        if exam.last_synced_at is None:
            is_s3_out_of_sync = True
        elif exam.updated_at:
            upd = exam.updated_at if exam.updated_at.tzinfo else exam.updated_at.replace(tzinfo=timezone.utc)
            sync = exam.last_synced_at if exam.last_synced_at.tzinfo else exam.last_synced_at.replace(tzinfo=timezone.utc)
            is_s3_out_of_sync = upd > sync

    return {
        "exam_id": str(exam.id),
        "exam_code": exam.code,
        "is_published": is_published,
        "is_syncing": is_syncing,
        "sync_status": publish_run.status if publish_run else "IDLE",
        "current_step": publish_run.current_step if publish_run else None,
        "progress_percent": publish_run.progress_percent if publish_run else 0.0,
        "error_log": publish_run.error_log if publish_run else None,
        "last_synced_at": exam.last_synced_at.isoformat() if exam.last_synced_at else None,
        "updated_at": exam.updated_at.isoformat() if exam.updated_at else None,
        "is_s3_out_of_sync": is_s3_out_of_sync,
        "questions_json_path": exam.questions_json_path,
        "solutions_json_path": exam.solutions_json_path,
        "questions_json_folder_path": exam.questions_json_folder_path,
        "solutions_json_folder_path": exam.solutions_json_folder_path,
    }


@router.post("/questions", response_model=QuestionDetailResponse, status_code=201, summary="Admin Create or Fill Missing Question")
async def admin_create_question(
    payload: QuestionCreatePayload,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    """
    Admin endpoint to create a new question or fill in a missing question for an exam.
    Automatically sets Question status to PUBLISHED and updates Exam missing question metrics.
    """
    service = QuestionService(session)
    return await service.create_question(payload=payload)


@router.put("/questions/{question_id}", response_model=QuestionDetailResponse, summary="Admin Update Question")
async def admin_update_question(
    question_id: uuid.UUID,
    payload: QuestionUpdatePayload,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    """
    Admin endpoint to update question details.
    Automatically sets Question status to PUBLISHED and updates Exam missing question metrics.
    """
    service = QuestionService(session)
    return await service.update_question_detail(question_id=question_id, payload=payload)


@router.patch("/questions/{question_id}", response_model=QuestionDetailResponse, summary="Admin Partial Update Question")
async def admin_patch_question(
    question_id: uuid.UUID,
    payload: QuestionUpdatePayload,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    """
    Admin endpoint to partially update question details.
    Automatically sets Question status to PUBLISHED and updates Exam missing question metrics.
    """
    service = QuestionService(session)
    return await service.update_question_detail(question_id=question_id, payload=payload)


@router.post("/upload-question-paper", status_code=202, summary="Admin Upload Question Paper PDF")
async def admin_upload_question_paper(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    exam_name: Optional[str] = Form(default="UPSC"),
    year: int = Form(...),
    stage: Optional[str] = Form(default="prelims"),
    set_code: Optional[str] = Form(default="SET_A"),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    """
    Admin endpoint to upload a Question Paper PDF document for an examination.
    Stores the PDF in storage and initializes the exam record.
    """
    from pathlib import Path
    from app.utils.file_utils import save_upload_file_temp
    from app.services.storage_service import storage
    from app.config.filename_parser import parse_question_paper_filename
    from app.db.models import Exam
    from sqlmodel import select, func

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported for Question Paper processing.")

    try:
        meta = parse_question_paper_filename(
            filename_or_code=file.filename,
            year=year,
            user_set_code=set_code,
            exam_name=exam_name,
            stage=stage,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    canonical_exam_code = meta["canonical_code"]
    clean_set = meta["set_code"]

    temp_dir = Path("./temp_uploads").resolve()
    temp_path = await save_upload_file_temp(file, temp_dir)

    rel_storage_path = f"uploads/question_papers/{canonical_exam_code}/{canonical_exam_code}.pdf"
    persistent_path = await storage.upload_file(temp_path, rel_storage_path)

    # Check if exam exists or create/update
    res = await session.exec(
        select(Exam).where(
            (func.lower(Exam.code) == canonical_exam_code.lower()) |
            (func.lower(Exam.name) == canonical_exam_code.lower())
        )
    )
    exam = res.first()

    if not exam:
        exam = Exam(
            id=uuid.uuid4(),
            code=canonical_exam_code,
            name=f"{exam_name.upper()} {stage.title()} {year} Set {clean_set.replace('SET_', '')}",
            source_year=year,
            stage=stage,
            paper_set_code=clean_set,
            subject_code="GS1",
            raw_pdf_path=persistent_path,
        )
        session.add(exam)
    else:
        exam.raw_pdf_path = persistent_path
        session.add(exam)

    await session.commit()
    await session.refresh(exam)

    from app.cache import invalidate_exam_cache, invalidate_pipeline_status_cache
    await invalidate_exam_cache(str(exam.id))
    await invalidate_pipeline_status_cache()

    return {
        "status": "ACCEPTED",
        "message": f"Question Paper uploaded successfully for exam '{canonical_exam_code}'.",
        "exam_id": str(exam.id),
        "exam_code": exam.code,
        "s3_path": persistent_path,
    }


@router.post("/upload-answer-key", status_code=202, summary="Admin Upload Answer Key PDF")
async def admin_upload_answer_key(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    set_code: str = Form(...),
    exam_name: Optional[str] = Form(default="UPSC"),
    year: int = Form(...),
    stage: Optional[str] = Form(default="prelims"),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    """
    Admin endpoint to upload an Answer Key PDF document for a specific examination year and set code.
    Stores the Answer Key PDF and links it to the exam record.
    """
    from pathlib import Path
    from app.utils.file_utils import save_upload_file_temp
    from app.services.storage_service import storage
    from app.services.filename_parser import parse_answer_key_filename
    from app.db.models import Exam
    from sqlmodel import select, func

    ALLOWED_SET_TOKENS = {"SET_A", "SET_B", "SET_C", "SET_D", "SET_1", "SET_2", "SET_3", "SET_4", "A", "B", "C", "D", "1", "2", "3", "4"}
    raw_set = str(set_code).strip().upper() if set_code else ""
    if not raw_set or raw_set not in ALLOWED_SET_TOKENS:
        raise HTTPException(
            status_code=400,
            detail="Invalid paper set code. Allowed values: SET_A, SET_B, SET_C, SET_D, A, B, C, D.",
        )

    clean_set = raw_set if raw_set.startswith("SET_") else f"SET_{raw_set}"

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported for Answer Key processing.")

    try:
        meta = parse_answer_key_filename(
            filename_or_code=file.filename,
            year=year,
            user_set_code=clean_set,
            exam_name=exam_name,
            stage=stage,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    canonical_exam_code = meta["canonical_code"]

    temp_dir = Path("./temp_uploads").resolve()
    temp_path = await save_upload_file_temp(file, temp_dir)

    rel_storage_path = f"uploads/answer_keys/{canonical_exam_code}/{canonical_exam_code}_AK_{clean_set}.pdf"
    persistent_path = await storage.upload_file(temp_path, rel_storage_path)

    # Check if exam exists or create/update
    res = await session.exec(
        select(Exam).where(
            (func.lower(Exam.code) == canonical_exam_code.lower()) |
            (func.lower(Exam.name) == canonical_exam_code.lower())
        )
    )
    exam = res.first()

    if not exam:
        exam = Exam(
            id=uuid.uuid4(),
            code=canonical_exam_code,
            name=f"{exam_name.upper()} {stage.title()} {year} Set {clean_set.replace('SET_', '')}",
            source_year=year,
            stage=stage,
            paper_set_code=clean_set,
            subject_code="GS1",
            answer_key_pdf_path=persistent_path,
        )
        session.add(exam)
    else:
        exam.answer_key_pdf_path = persistent_path
        session.add(exam)

    await session.commit()
    await session.refresh(exam)

    from app.cache import invalidate_exam_cache, invalidate_pipeline_status_cache
    await invalidate_exam_cache(str(exam.id))
    await invalidate_pipeline_status_cache()

    return {
        "status": "ACCEPTED",
        "message": f"Answer Key uploaded successfully for exam '{canonical_exam_code}' (Set: {clean_set}).",
        "exam_id": str(exam.id),
        "exam_code": exam.code,
        "target_set_code": clean_set,
        "s3_path": persistent_path,
    }

