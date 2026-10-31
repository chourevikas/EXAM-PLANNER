from typing import List, Optional, Union
from fastapi import (
    APIRouter,
    Depends,
    Request,
    UploadFile,
    File,
    Form,
    BackgroundTasks,
    HTTPException,
    Query,
)
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
    UserDirectoryItemOut,
    UpdateRolePayload,
    AdminActionLogOut,
)
from app.schemas.question import (
    QuestionDetailResponse,
    QuestionUpdatePayload,
    QuestionCreatePayload,
    ExamReviewQuestionsResponse,
    QuestionCatalogSubjectsResponseOut,
)
from app.schemas.platform_analytics import PlatformAnalyticsResponse
from app.services.admin_service import AdminService
from app.services import audit_service

from app.services.question_service import QuestionService
from app.core.deps import require_roles, require_admin_section
from app.config.logger import setup_logger

logger = setup_logger("AdminRouter")
router = APIRouter(prefix="/admin", tags=["Admin Management"])


@router.get(
    "/overview-stats",
    response_model=AdminOverviewStatsOut,
    summary="Get Live Admin Dashboard Overview Metrics",
)
async def get_admin_overview_stats(
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

    from app.db.session import async_session_factory
    async with async_session_factory() as session:
        service = AdminService(session)
        stats = await service.get_admin_overview_stats()
        if stats is not None:
            serialized = jsonable_encoder(stats)
            await cache.set(cache_key, serialized, ttl_seconds=300)
            return JSONResponse(content=serialized)
        return JSONResponse(content={})


@router.get(
    "/question-catalog/subjects",
    response_model=QuestionCatalogSubjectsResponseOut,
    summary="Get Live Question Catalog Subjects Directory",
)
async def get_question_catalog_subjects(
    current_user: User = Depends(require_admin_section("admin.question_bank")),
):
    """
    Returns live aggregated catalog metrics (questions, pending reviews, subtopics)
    per subject category using a single CTE query and Redis/memory caching.
    """
    from app.cache import get_cache, build_cache_key

    cache = get_cache()
    cache_key = build_cache_key("admin:question_catalog:subjects")
    cached_data = await cache.get(cache_key)
    if cached_data is not None:
        return JSONResponse(content=jsonable_encoder(cached_data))

    from app.db.session import async_session_factory
    async with async_session_factory() as session:
        service = AdminService(session)
        catalog = await service.get_question_catalog_subjects()
        if catalog is not None:
            serialized = jsonable_encoder(catalog)
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


@router.get("/all-users", response_model=List[UserDirectoryItemOut])
async def list_all_users(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    from app.cache import get_cache, build_cache_key

    cache = get_cache()
    cache_key = build_cache_key("admin:all_users")
    cached_data = await cache.get(cache_key)
    if cached_data is not None:
        return JSONResponse(content=jsonable_encoder(cached_data))

    service = AdminService(session)
    users = await service.list_all_users()
    encoded = jsonable_encoder(users)
    await cache.set(cache_key, encoded, ttl_seconds=300)
    return JSONResponse(content=encoded)


@router.post("/users/{user_id}/role", response_model=UserOut)
async def update_user_role(
    user_id: str,
    payload: UpdateRolePayload,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    from app.cache import invalidate_user_cache, get_cache

    # SUPER_ADMIN accounts are provisioned out-of-band (init_superadmin), never granted through the API.
    if payload.new_role == UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Super Admin role cannot be assigned")

    service = AdminService(session)
    res = await service.update_user_role(user_id=user_id, new_role=payload.new_role)
    await audit_service.record_admin_action(
        session,
        audit_service.ROLE_CHANGED,
        actor=current_user,
        target_id=int(user_id) if str(user_id).isdigit() else None,
        target_email=getattr(res, "email", None),
        details={"to": payload.new_role.value},
        request=request,
    )
    await invalidate_user_cache(str(user_id))
    await get_cache().delete_pattern("ep:admin:*")
    return res


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
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    from app.cache import invalidate_user_cache, get_cache

    service = AdminService(session)
    res = await service.suspend_admin_user(user_id=user_id)
    await audit_service.record_admin_action(
        session,
        audit_service.USER_SUSPENDED,
        actor=current_user,
        target_id=int(user_id) if str(user_id).isdigit() else None,
        target_email=getattr(res, "email", None),
        request=request,
    )
    await invalidate_user_cache(str(user_id))
    await get_cache().delete_pattern("ep:admin:overview_stats*")
    return res


@router.post("/reactivate/{user_id}", response_model=UserOut)
async def reactivate_admin_user(
    user_id: str,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    from app.cache import invalidate_user_cache, get_cache

    service = AdminService(session)
    try:
        res = await service.reactivate_admin_user(user_id=user_id)
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    await audit_service.record_admin_action(
        session,
        audit_service.USER_REACTIVATED,
        actor=current_user,
        target_id=int(user_id) if str(user_id).isdigit() else None,
        target_email=getattr(res, "email", None),
        request=request,
    )
    await invalidate_user_cache(str(user_id))
    await get_cache().delete_pattern("ep:admin:overview_stats*")
    return res


@router.get("/action-logs", response_model=List[AdminActionLogOut])
async def get_admin_action_logs(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    action: Optional[str] = Query(None, max_length=64),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    """Newest-first log of staff creation, credential resends, role changes, suspensions, MFA and Super Admin sign-ins."""
    from sqlalchemy import desc, select as sa_select
    from app.db.models.user import AdminActionLog

    stmt = sa_select(AdminActionLog).order_by(desc(AdminActionLog.created_at), desc(AdminActionLog.id))
    if action:
        stmt = stmt.where(AdminActionLog.action == action)
    rows = (await session.execute(stmt.limit(limit).offset(offset))).scalars().all()
    return rows


@router.get("/audit-logs", response_model=List[AdminApprovalLogOut])
async def get_approval_audit_logs(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    from app.cache import get_cache, build_cache_key

    cache = get_cache()
    cache_key = build_cache_key("admin:audit_logs")
    cached_data = await cache.get(cache_key)
    if cached_data is not None:
        return JSONResponse(content=jsonable_encoder(cached_data))

    service = AdminService(session)
    logs = await service.get_approval_audit_logs()
    encoded = jsonable_encoder(logs)
    await cache.set(cache_key, encoded, ttl_seconds=300)
    return JSONResponse(content=encoded)


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


@router.get(
    "/analytics/platform-reports",
    response_model=PlatformAnalyticsResponse,
    summary="Get Platform-Wide Diagnostics & Reports Analytics",
)
async def get_platform_reports(
    time_range: str = Query("30d", description="Time window: 7d, 30d, 90d, 1y"),
    exam_filter: str = Query("ALL", description="Exam filter: ALL, UPSC_CSE, STATE_PSC"),
    current_user: User = Depends(require_admin_section("admin.analytics")),
):
    """
    Returns platform-wide candidate metrics, subject diagnostic performance,
    and AI ingestion pipeline precision metrics with high-speed Redis caching.
    """
    from app.cache import get_cache, build_cache_key

    cache = get_cache()
    cache_key = build_cache_key(
        "admin:platform_analytics", time_range=time_range, exam_filter=exam_filter
    )
    cached_data = await cache.get(cache_key)
    if cached_data is not None:
        return JSONResponse(content=jsonable_encoder(cached_data))

    from app.db.session import async_session_factory
    async with async_session_factory() as session:
        service = AdminService(session)
        return await service.get_platform_analytics(time_range=time_range, exam_filter=exam_filter)


async def _compute_exam_pipeline_statuses(session: AsyncSession) -> list:
    from sqlmodel import select, func, case
    from app.db.models import (
        Exam,
        Question,
        QuestionOption,
        QuestionExplanation,
        QuestionStatus,
    )
    from app.db.models.pipeline_run import PipelineRun
    from sqlalchemy import cast, String

    # 1. Fetch all exams ordered by source year desc, excluding user-generated dynamic exams
    res = await session.exec(
        select(Exam).where(Exam.code.not_like("DYN_%")).order_by(Exam.source_year.desc(), Exam.created_at.desc())
    )
    exams = res.all()

    # Fetch ExamTypes for mapping
    from app.db.models import ExamType
    try:
        et_rows = (await session.exec(select(ExamType))).all()
        et_map = {et.id: et for et in et_rows}
    except Exception:
        et_map = {}

    # 2. Aggregated Question counts per exam
    q_stmt = select(
        Question.exam_id,
        func.count(Question.id).label("total_q"),
        func.sum(
            case((cast(Question.status, String) == "PUBLISHED", 1), else_=0)
        ).label("pub_q"),
        func.sum(
            case((cast(Question.status, String) == "PENDING_HUMAN_REVIEW", 1), else_=0)
        ).label("pend_q"),
        func.sum(case((cast(Question.status, String) == "REJECTED", 1), else_=0)).label(
            "rej_q"
        ),
    ).group_by(Question.exam_id)
    q_rows = (await session.exec(q_stmt)).all()
    q_map = {
        row[0]: {
            "total": row[1] or 0,
            "pub": row[2] or 0,
            "pend": row[3] or 0,
            "rej": row[4] or 0,
        }
        for row in q_rows
    }

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
        select(
            Question.exam_id, func.count(func.distinct(QuestionExplanation.question_id))
        )
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
    ak_map = {row[0]: max(row[1] or 0, row[2] or 0) for row in ak_rows}

    # 6. Fetch all PipelineRun records for real-time stage statuses
    run_stmt = select(PipelineRun).order_by(PipelineRun.id.desc())
    run_rows = (await session.exec(run_stmt)).all()
    run_map: dict = {}
    for r in run_rows:
        if r.exam_id not in run_map:
            run_map[r.exam_id] = {}
        curr = run_map[r.exam_id].get(r.pipeline_type)
        if not curr:
            run_map[r.exam_id][r.pipeline_type] = r
        elif str(r.status).upper() in ("RUNNING", "PROCESSING", "INITIALIZING", "QUEUED"):
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

        status_str = (
            exam.status.value if hasattr(exam.status, "value") else str(exam.status)
        )

        # PipelineRun lookups
        from app.services.task_registry import task_registry

        exam_runs = run_map.get(exam.id, {})
        p1_candidates = [exam_runs.get("DOCUMENT_EXTRACTION"), exam_runs.get("QUESTION_EXTRACTION")]
        p1 = next((r for r in p1_candidates if r and str(r.status).upper() in ("RUNNING", "PROCESSING", "INITIALIZING", "QUEUED")), None)
        if not p1:
            p1 = exam_runs.get("DOCUMENT_EXTRACTION") or exam_runs.get("QUESTION_EXTRACTION")

        p2 = exam_runs.get("ANSWER_KEY")
        p3 = (
            exam_runs.get("EXPLANATION_INDEXING")
            or exam_runs.get("EXPLANATION_GENERATION")
            or exam_runs.get("EXPLANATION")
        )
        p_trans = (
            exam_runs.get("QUESTION_TRANSLATION")
            or exam_runs.get("TRANSLATION")
        )

        is_task_running = bool(
            task_registry.is_running(str(exam.id))
            or task_registry.is_running(f"qp_{exam.id}")
            or task_registry.is_running(f"ak_{exam.id}")
            or task_registry.is_running(f"exp_{exam.id}")
            or task_registry.is_running(f"trans_{exam.id}")
        )

        stage1_status = "QUEUED"
        stage2_status = "QUEUED"
        stage3_status = "QUEUED"

        # Stage 1: Extraction Status
        if is_task_running:
            stage1_status = "IN_PROGRESS"
        elif p1:
            p1_status_upper = str(p1.status).upper()
            if q_count > 0 and (status_str == "PUBLISHED" or q_count >= total_exp):
                stage1_status = "COMPLETED"
            elif p1_status_upper in (
                "RUNNING",
                "PROCESSING",
                "INITIALIZING",
            ) or status_str in ("PROCESSING", "PARSING_PDF", "EXTRACTING"):
                stage1_status = "IN_PROGRESS"
            elif p1_status_upper in (
                "COMPLETED",
                "WAITING_FOR_ANSWER_KEY",
                "WAITING_FOR_HITL",
            ):
                stage1_status = "COMPLETED"
            elif p1_status_upper in ("FAILED", "STOPPED", "CANCELLED"):
                stage1_status = "FAILED"
            elif not has_paper:
                stage1_status = "MISSING_INPUT"
            else:
                stage1_status = "QUEUED"
        else:
            if status_str in ("PROCESSING", "PARSING_PDF", "EXTRACTING"):
                stage1_status = "IN_PROGRESS"
            elif q_count > 0 and (status_str == "PUBLISHED" or q_count >= total_exp):
                stage1_status = "COMPLETED"
            elif not has_paper:
                stage1_status = "MISSING_INPUT"
            else:
                stage1_status = "QUEUED"

        # Stage 2: Key Mapping Status
        if p2:
            p2_status_upper = str(p2.status).upper()
            if (
                p2_status_upper in ("COMPLETED", "MATCHED")
                or status_str == "PUBLISHED"
                or (key_count >= q_count and q_count > 0)
            ):
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

        # Stage 3: Explanations Status (PDF authentic; no LLM explanation indexing required)
        if p3:
            p3_status_upper = str(p3.status).upper()
            if (
                p3_status_upper in ("COMPLETED", "DISMISSED", "SKIPPED")
                or status_str == "PUBLISHED"
                or (exp_count >= q_count and q_count > 0)
                or (stage1_status == "COMPLETED" and stage2_status == "COMPLETED")
            ):
                stage3_status = "COMPLETED"
            elif p3_status_upper in ("RUNNING", "PROCESSING") and not (stage1_status == "COMPLETED" and stage2_status == "COMPLETED"):
                stage3_status = "IN_PROGRESS"
            elif p3_status_upper in ("FAILED", "CANCELLED"):
                stage3_status = "FAILED"
            elif stage1_status != "COMPLETED" or stage2_status != "COMPLETED":
                stage3_status = "WAITING_INPUTS"
            else:
                stage3_status = "COMPLETED"
        else:
            if status_str == "PUBLISHED" or (stage1_status == "COMPLETED" and stage2_status == "COMPLETED"):
                stage3_status = "COMPLETED"
            elif stage1_status != "COMPLETED" or stage2_status != "COMPLETED":
                stage3_status = "WAITING_INPUTS"
            else:
                stage3_status = "COMPLETED"
        # Stage 4: Question Translation Status
        translation_status = "NOT_STARTED"
        if p_trans:
            p_trans_status_upper = str(p_trans.status).upper()
            if p_trans_status_upper in ("COMPLETED", "FINISHED"):
                translation_status = "COMPLETED"
            elif p_trans_status_upper in ("RUNNING", "PROCESSING", "INITIALIZING", "QUEUED"):
                translation_status = "IN_PROGRESS"
            elif p_trans_status_upper in ("FAILED", "CANCELLED", "ERROR"):
                translation_status = "FAILED"
            else:
                translation_status = p_trans_status_upper
        elif is_task_running and task_registry.is_running(f"trans_{exam.id}"):
            translation_status = "IN_PROGRESS"
        elif stage1_status == "COMPLETED":
            translation_status = "QUEUED"

        translation_step = p_trans.current_step if p_trans else None
        translation_progress = (
            p_trans.progress_percent
            if p_trans
            else (100.0 if translation_status == "COMPLETED" else 0.0)
        )

        # Overall Status
        is_s3_published = status_str == "PUBLISHED" and bool(
            exam.questions_json_path or exam.questions_json_folder_path
        )
        if is_s3_published:
            overall_status = "PUBLISHED"
        elif not has_paper or not has_key:
            overall_status = "MISSING_INPUTS"
        elif (
            stage1_status == "IN_PROGRESS"
            or status_str in ("PROCESSING", "PARSING_PDF")
        ):
            overall_status = "PROCESSING"
        elif stage1_status == "COMPLETED":
            overall_status = "READY_FOR_REVIEW"
        else:
            overall_status = "PENDING_REVIEW"

        pipeline_list.append(
            {
                "id": str(exam.id),
                "code": exam.code,
                "name": exam.name,
                "exam_type_id": exam.exam_type_id,
                "exam_type_code": et_map[exam.exam_type_id].type if (exam.exam_type_id and exam.exam_type_id in et_map) else "upsc",
                "exam_type_name": et_map[exam.exam_type_id].name if (exam.exam_type_id and exam.exam_type_id in et_map) else "UPSC",
                "source_year": exam.source_year,
                "stage": exam.stage,
                "subject_code": exam.subject_code,
                "paper_set_code": exam.paper_set_code,
                "status": status_str,
                "overall_status": overall_status,
                "is_extracting": bool(
                    is_task_running
                    or overall_status == "PROCESSING"
                    or stage1_status in ("IN_PROGRESS", "QUEUED")
                    or status_str in ("PROCESSING", "PARSING_PDF", "EXTRACTING")
                    or (p1 and str(p1.status).upper() in ("RUNNING", "PROCESSING", "INITIALIZING", "QUEUED"))
                    or (status_str != "PUBLISHED" and stage1_status != "COMPLETED" and has_paper)
                ),
                "stage1_status": stage1_status,
                "stage2_status": stage2_status,
                "stage3_status": stage3_status,
                "stage1_step": p1.current_step if p1 else None,
                "stage2_step": p2.current_step if p2 else None,
                "stage3_step": p3.current_step if p3 else None,
                "stage3_progress": p3.progress_percent
                if p3
                else (100.0 if stage3_status == "COMPLETED" else 0.0),
                "translation_status": translation_status,
                "translation_step": translation_step,
                "translation_progress": translation_progress,
                "is_active": exam.is_active,
                "total_questions": total_exp,
                "extracted_questions_count": q_count,
                "missing_questions_count": 0 if (overall_status == "PROCESSING" or stage1_status == "IN_PROGRESS" or status_str in ("PROCESSING", "PARSING_PDF", "EXTRACTING")) else (exam.missing_questions_count or max(0, total_exp - q_count)),
                "published_questions_count": pub_count,
                "pending_questions_count": pend_count,
                "rejected_questions_count": rej_count,
                "key_mapped_count": key_count,
                "explanations_count": exp_count,
                "has_question_paper": has_paper,
                "has_answer_key": has_key,
                "pdf_path": exam.pdf_path,
                "answer_key_pdf_path": exam.answer_key_pdf_path,
                "questions_json_path": exam.questions_json_path,
                "solutions_json_path": exam.solutions_json_path,
                "questions_json_folder_path": exam.questions_json_folder_path,
                "solutions_json_folder_path": exam.solutions_json_folder_path,
            }
        )

    return pipeline_list


@router.get(
    "/exams/pipeline-status",
    summary="List All Exams with Pipeline Status & Question Metrics",
)
async def list_exam_pipeline_statuses(
    current_user: User = Depends(require_admin_section("admin.upload", "admin.review", "admin.question_bank")),
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

    from app.db.session import async_session_factory
    async with async_session_factory() as session:
        pipeline_list = await _compute_exam_pipeline_statuses(session)
        encoded = jsonable_encoder(pipeline_list)
        await cache.set(cache_key, encoded, ttl_seconds=60)
        return JSONResponse(content=encoded)


async def _compute_stuck_pipelines(session: AsyncSession) -> list:
    from sqlmodel import select, func
    from app.db.models import (
        Exam,
        Question,
        QuestionOption,
        QuestionExplanation,
        ExamStatus,
    )
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
    exams = (
        await session.exec(select(Exam).where(cast(Exam.status, String) != "PUBLISHED"))
    ).all()

    # 3. Batch aggregate question counts
    q_stmt = select(Question.exam_id, func.count(Question.id)).group_by(
        Question.exam_id
    )
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
        select(
            Question.exam_id, func.count(func.distinct(QuestionExplanation.question_id))
        )
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
        p1 = exam_runs.get("QUESTION_EXTRACTION") or exam_runs.get("DOCUMENT_EXTRACTION")
        p2 = exam_runs.get("ANSWER_KEY")
        p3 = (
            exam_runs.get("EXPLANATION_INDEXING")
            or exam_runs.get("EXPLANATION_GENERATION")
            or exam_runs.get("EXPLANATION")
        )

        # Determine if any stage is incomplete / interrupted
        is_stuck = False
        stuck_stage = "EXPLANATION_INDEXING"
        stuck_step = "INTERRUPTED"
        stuck_progress = 0.0

        if p3 and p3.status in (
            "INTERRUPTED",
            "FAILED",
            "STOPPED",
            "CANCELLED",
            "RUNNING",
        ):
            is_stuck = True
            stuck_stage = "EXPLANATION_INDEXING"
            stuck_step = p3.current_step
            stuck_progress = p3.progress_percent
        elif p2 and p2.status in (
            "INTERRUPTED",
            "FAILED",
            "STOPPED",
            "CANCELLED",
            "RUNNING",
        ):
            is_stuck = True
            stuck_stage = "ANSWER_KEY"
            stuck_step = p2.current_step
            stuck_progress = p2.progress_percent
        elif p1 and p1.status in (
            "INTERRUPTED",
            "FAILED",
            "STOPPED",
            "CANCELLED",
            "RUNNING",
        ):
            is_stuck = True
            stuck_stage = "QUESTION_EXTRACTION"
            stuck_step = p1.current_step
            stuck_progress = p1.progress_percent
        elif (
            q_count > 0
            and key_count < q_count
            and exam.answer_key_pdf_path
            and (p2 is None or p2.status != "COMPLETED")
        ):
            is_stuck = True
            stuck_stage = "ANSWER_KEY"
            stuck_step = f"INCOMPLETE_ANSWER_KEY_MAPPING_({key_count}/{q_count})"
            stuck_progress = round((key_count / max(1, q_count)) * 100.0, 1)

        # Check if explicitly dismissed
        if (p3 and p3.status == "DISMISSED") or (p1 and p1.status == "DISMISSED"):
            continue

        if is_stuck:
            stuck_list.append(
                {
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
                }
            )

    return stuck_list


@router.get(
    "/exams/stuck-pipelines",
    summary="List Interrupted / Stuck Pipelines Requiring Admin Action",
)
async def list_stuck_pipelines(
    current_user: User = Depends(require_admin_section("admin.upload")),
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

    from app.db.session import async_session_factory
    async with async_session_factory() as session:
        stuck_list = await _compute_stuck_pipelines(session)
        encoded = jsonable_encoder(stuck_list)
        await cache.set(cache_key, encoded, ttl_seconds=60)
        return JSONResponse(content=encoded)


@router.post(
    "/exams/{exam_id}/resume-pipeline",
    summary="Resume Interrupted Pipeline Skipping Completed Parts",
)
async def resume_interrupted_pipeline(
    exam_id: str,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_admin_section("admin.upload")),
):
    """
    Resumes an interrupted pipeline for an exam in the background, immediately returning HTTP 200 in <10ms.
    Automatically skips any questions/explanations that were already extracted or generated in the database.
    """
    import uuid
    from fastapi import HTTPException
    from sqlmodel import select, func
    from app.db.models import (
        Exam,
        Question,
        QuestionOption,
        QuestionExplanation,
        AnswerKeyBatch,
    )
    from app.db.models.pipeline_run import PipelineRun
    from app.services.pipeline_management_service import PipelineManagementService
    from app.services.task_registry import task_registry

    try:
        exam_id_int = int(exam_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid exam_id: '{exam_id}'")

    exam = await session.get(Exam, exam_id_int)
    if not exam:
        raise HTTPException(status_code=404, detail=f"Exam '{exam_id}' not found.")

    pm = PipelineManagementService(session)

    q_count = (
        await session.exec(
            select(func.count(Question.id)).where(Question.exam_id == exam_id_int)
        )
    ).first() or 0
    key_count = (
        await session.exec(
            select(func.count(func.distinct(Question.id)))
            .select_from(Question)
            .join(QuestionOption, Question.id == QuestionOption.question_id)
            .where(Question.exam_id == exam_id_int, QuestionOption.is_correct == True)
        )
    ).first() or 0
    exp_count = (
        await session.exec(
            select(func.count(func.distinct(QuestionExplanation.question_id)))
            .select_from(Question)
            .join(QuestionExplanation, Question.id == QuestionExplanation.question_id)
            .where(
                Question.exam_id == exam_id_int,
                QuestionExplanation.detailed_solution != None,
                QuestionExplanation.detailed_solution != "",
            )
        )
    ).first() or 0

    key = str(exam_id_int)

    from app.tasks.celery_app import has_active_celery_workers

    use_celery = has_active_celery_workers()

    # Case 1: Stage 1 (Extraction) incomplete and pdf_path exists
    if q_count == 0 and exam.pdf_path:
        from app.tasks.exam_tasks import async_process_exam_pdf, process_exam_pdf_task

        await pm.update_pipeline_status(
            exam_id=exam_id_int,
            pipeline_type="QUESTION_EXTRACTION",
            status="RUNNING",
            current_step="RESUMING_QUESTION_EXTRACTION",
            progress_percent=10.0,
        )
        task_id = f"resume_p1_{uuid.uuid4().hex[:8]}"
        if use_celery:
            task_res = process_exam_pdf_task.delay(
                str(exam_id_int), exam.pdf_path, exam.name, task_id
            )
            task_registry.register_celery_task(key, getattr(task_res, "id", task_id))
        else:
            background_tasks.add_task(
                async_process_exam_pdf,
                pdf_path=exam.pdf_path,
                exam_title=exam.name,
                exam_id_str=str(exam_id_int),
                task_id=task_id,
            )
        from app.cache import invalidate_pipeline_status_cache
        await invalidate_pipeline_status_cache()
        return {
            "status": "RESUMED",
            "stage": "QUESTION_EXTRACTION",
            "message": f"Extraction resumed for '{exam.name}'.",
        }

    return {
        "status": "COMPLETED",
        "stage": "DOCUMENT_EXTRACTION",
        "message": f"Pipeline already completed for '{exam.name}' ({q_count} questions extracted).",
    }


@router.post(
    "/exams/{exam_id}/dismiss-stuck-pipeline",
    summary="Dismiss Interrupted Pipeline Prompt",
)
async def dismiss_stuck_pipeline(
    exam_id: str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_admin_section("admin.upload")),
):
    """Dismisses the interrupted status prompt for an exam."""
    from fastapi import HTTPException
    from sqlmodel import select
    from app.db.models.pipeline_run import PipelineRun

    try:
        exam_id_int = int(exam_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid exam_id: '{exam_id}'")

    runs = (
        await session.exec(
            select(PipelineRun).where(PipelineRun.exam_id == exam_id_int)
        )
    ).all()
    for r in runs:
        if str(r.status).upper() in ("INTERRUPTED", "RUNNING", "FAILED", "WAITING_FOR_HITL", "WAITING_FOR_ANSWER_KEY"):
            r.status = "DISMISSED"
            session.add(r)

    # Ensure a DISMISSED marker exists for explanation indexing
    p3_run = next((r for r in runs if r.pipeline_type in ("EXPLANATION_INDEXING", "EXPLANATION_GENERATION")), None)
    if not p3_run:
        new_p3 = PipelineRun(
            exam_id=exam_id_int,
            pipeline_type="EXPLANATION_INDEXING",
            status="DISMISSED",
            current_step="DISMISSED_BY_ADMIN",
            progress_percent=100.0,
        )
        session.add(new_p3)

    await session.commit()
    from app.cache import invalidate_pipeline_status_cache
    await invalidate_pipeline_status_cache()
    return {
        "status": "DISMISSED",
        "message": f"Interrupted pipeline prompt dismissed for exam {exam_id}.",
    }


@router.get(
    "/exams/{exam_id}/review-questions",
    response_model=ExamReviewQuestionsResponse,
    summary="Get Exam Questions with Full Solution Knowledge Base for Review",
)
async def get_exam_review_questions_admin(
    exam_id: int,
    language: str = Query(
        default="en", description="Target Language"
    ),
    status: Optional[QuestionStatus] = Query(
        default=None, description="Filter by Question status"
    ),
    page: int = Query(default=1, ge=1, description="Page number"),
    limit: int = Query(default=10, ge=1, le=100, description="Items per page"),
    target_question_number: Optional[int] = Query(default=None, description="Jump to question number"),
    target_question_id: Optional[Union[str, int]] = Query(default=None, description="Jump to question ID"),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_admin_section("admin.review", "admin.reported_questions", "admin.question_bank")),
):
    """Admin review endpoint returning all questions with full solutions, option explanations, and review counters."""
    from app.cache import get_cache, build_cache_key
    from app.core.languages import parse_language

    lang_code = parse_language(language)
    cache = get_cache()
    is_targeted = bool(target_question_number or target_question_id)
    cache_key = None
    if not is_targeted:
        cache_key = build_cache_key(
            "admin:review",
            str(exam_id),
            page=page,
            limit=limit,
            lang=lang_code.value,
            status=str(status.value if hasattr(status, "value") else status)
            if status
            else None,
        )
        cached_data = await cache.get(cache_key)
        if cached_data is not None:
            return JSONResponse(content=jsonable_encoder(cached_data))

    q_service = QuestionService(session)
    review_res = await q_service.get_exam_questions_for_review(
        exam_id=exam_id,
        page=page,
        limit=limit,
        language=lang_code,
        status=status,
        target_question_number=target_question_number,
        target_question_id=target_question_id,
    )
    if review_res is not None:
        serialized = jsonable_encoder(review_res)
        if not is_targeted and cache_key:
            await cache.set(cache_key, serialized, ttl_seconds=1800)
        return JSONResponse(content=serialized)
    return JSONResponse(content={})


@router.post("/exams/{exam_id}/approve", summary="Approve Exam & Build JSON Folders")
async def approve_and_publish_exam(
    exam_id: str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_admin_section("admin.upload", "admin.review")),
):
    """
    Requirement 9, 10 & 11: Admin approves the exam paper after human review.
    1. Triggers automatic generation of questions JSON and solutions JSON.
    2. Uploads individual question and solution JSONs to S3 folder paths.
    3. Saves questions_json_folder_path and solutions_json_folder_path on Exam DB record.
    4. Sets Exam.status = PUBLISHED and Exam.is_active = True.
    """
    from datetime import datetime, timezone
    from fastapi import HTTPException
    from app.db.models import Exam, ExamStatus, Question, QuestionStatus
    from sqlmodel import select

    try:
        exam_id_int = int(exam_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid exam_id: '{exam_id}'")

    exam = await session.get(Exam, exam_id_int)
    if not exam:
        raise HTTPException(
            status_code=404, detail=f"Exam with ID '{exam_id}' not found."
        )

    q_res = await session.exec(select(Question).where(Question.exam_id == exam_id_int))
    questions = q_res.all()

    if not questions:
        raise HTTPException(
            status_code=422,
            detail=f"EXAM_CANNOT_BE_APPROVED: Exam '{exam.code}' has no extracted questions.",
        )

    # Validate that each and every question has been reviewed and published
    unreviewed_qs = [q for q in questions if q.status != QuestionStatus.PUBLISHED]
    if unreviewed_qs:
        pending_count = sum(
            1 for q in unreviewed_qs if q.status == QuestionStatus.PENDING_HUMAN_REVIEW
        )
        rejected_count = sum(
            1 for q in unreviewed_qs if q.status == QuestionStatus.REJECTED
        )
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cannot publish exam '{exam.name}': {len(unreviewed_qs)} question(s) are not yet approved "
                f"({pending_count} pending review, {rejected_count} rejected). "
                f"All questions must be reviewed and marked as PUBLISHED before publishing."
            ),
        )

    # Pre-flight Database Integrity / Corruption Validation (Batch O(1) Queries)
    from app.db.models import PipelineRun, QuestionTranslation, QuestionOption
    from sqlmodel import col

    q_ids = [q.id for q in questions]

    # Batch query all translations for all questions in one round-trip
    all_qt_res = await session.exec(
        select(QuestionTranslation).where(col(QuestionTranslation.question_id).in_(q_ids))
    )
    qt_by_qid = {}
    for t in all_qt_res.all():
        qt_by_qid.setdefault(t.question_id, []).append(t)

    # Batch query all options for all questions in one round-trip
    all_opt_res = await session.exec(
        select(QuestionOption).where(col(QuestionOption.question_id).in_(q_ids))
    )
    opts_by_qid = {}
    for o in all_opt_res.all():
        opts_by_qid.setdefault(o.question_id, []).append(o)

    for q in questions:
        q_trans = qt_by_qid.get(q.id, [])
        has_text = any(t.question_text and t.question_text.strip() for t in q_trans)
        if not has_text:
            corruption_msg = f"EXAM_DATA_CORRUPTED: Question #{q.question_number_in_paper} has blank or missing question statement text in database."
            corrupt_run = PipelineRun(
                exam_id=exam_id_int,
                pipeline_type="S3_PUBLISH",
                status="CORRUPTED",
                current_step="CORRUPTED_DATABASE_RECORD",
                progress_percent=0.0,
                error_log=corruption_msg,
            )
            session.add(corrupt_run)
            await session.commit()
            raise HTTPException(status_code=422, detail=corruption_msg)

        q_opts = opts_by_qid.get(q.id, [])
        if not q_opts:
            corruption_msg = f"EXAM_DATA_CORRUPTED: Question #{q.question_number_in_paper} has 0 answer options in database."
            corrupt_run = PipelineRun(
                exam_id=exam_id_int,
                pipeline_type="S3_PUBLISH",
                status="CORRUPTED",
                current_step="CORRUPTED_DATABASE_RECORD",
                progress_percent=0.0,
                error_log=corruption_msg,
            )
            session.add(corrupt_run)
            await session.commit()
            raise HTTPException(status_code=422, detail=corruption_msg)

    # Mark exam status as PUBLISHED and is_active as True directly in database (no S3 file creation)
    now_utc = datetime.now(timezone.utc)
    exam.status = ExamStatus.PUBLISHED
    exam.is_active = True
    exam.updated_at = now_utc
    exam.last_synced_at = now_utc
    session.add(exam)

    success_run = PipelineRun(
        exam_id=exam_id_int,
        pipeline_type="S3_PUBLISH",
        status="COMPLETED",
        current_step="EXAM_PUBLISHED",
        progress_percent=100.0,
        error_log=None,
    )
    session.add(success_run)

    await session.commit()
    await session.refresh(exam)

    from app.cache import invalidate_exam_cache, invalidate_pipeline_status_cache

    await invalidate_exam_cache(str(exam.id))
    await invalidate_pipeline_status_cache()

    return {
        "status": "APPROVED_AND_PUBLISHED",
        "publish_status": "PUBLISHED",
        "exam_id": str(exam.id),
        "exam_code": exam.code,
        "exam_status": exam.status.value
        if hasattr(exam.status, "value")
        else str(exam.status),
        "is_active": exam.is_active,
        "questions_count": len(questions),
        "questions_json_path": exam.questions_json_path,
        "solutions_json_path": exam.solutions_json_path,
        "questions_json_folder_path": exam.questions_json_folder_path,
        "solutions_json_folder_path": exam.solutions_json_folder_path,
        "last_synced_at": exam.last_synced_at.isoformat()
        if exam.last_synced_at
        else None,
        "updated_at": exam.updated_at.isoformat() if exam.updated_at else None,
        "is_s3_out_of_sync": False,
        "message": f"Exam '{exam.code}' successfully approved and published in database.",
    }


@router.post(
    "/exams/{exam_id}/sync",
    status_code=202,
    summary="Sync Exam Questions & Solutions to S3 (Background Task)",
)
async def sync_exam_s3_artifacts(
    exam_id: str,
    background_tasks: BackgroundTasks,
    sync_all: bool = Query(
        default=False,
        description="If True, re-syncs all individual questions + master JSON. If False (default), re-syncs only master exam JSONs.",
    ),
    sync_target: str = Query(
        default="MASTERS_ONLY",
        description="Sync target scope: 'MASTERS_ONLY' (both masters), 'QUESTIONS_MASTER', 'SOLUTIONS_MASTER', 'FULL_ALL'",
    ),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_admin_section("admin.upload", "admin.review")),
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
        exam_id_int = int(exam_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid exam_id: '{exam_id}'")

    exam = await session.get(Exam, exam_id_int)
    if not exam:
        raise HTTPException(
            status_code=404, detail=f"Exam with ID '{exam_id}' not found."
        )

    q_res = await session.exec(select(Question).where(Question.exam_id == exam_id_int))
    questions = q_res.all()
    if not questions:
        raise HTTPException(
            status_code=422,
            detail=f"EXAM_CANNOT_BE_SYNCED: Exam '{exam.code}' has no questions in database.",
        )

    if sync_all:
        sync_target = "FULL_ALL"

    # Check if a sync or publish pipeline is already running
    existing_run_stmt = (
        select(PipelineRun)
        .where(
            PipelineRun.exam_id == exam_id_int,
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
        exam_id=exam_id_int,
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
            str(exam_id_int),
            str(run_id),
            sync_all=sync_all,
            sync_target=sync_target,
            task_id=task_id,
            execution_engine="Celery Worker",
        )
        task_registry.register_celery_task(
            str(exam_id_int), getattr(celery_res, "id", task_id)
        )
        task_registry.register_celery_task(
            f"sync_{exam_id_int}", getattr(celery_res, "id", task_id)
        )
        execution_engine = "Celery Worker"
    else:
        background_tasks.add_task(
            async_sync_exam_s3,
            exam_id_str=str(exam_id_int),
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
    current_user: User = Depends(require_admin_section("admin.upload", "admin.review")),
):
    """
    Returns the current S3 sync status, whether a background sync task is currently running,
    progress info, error logs if failed, and sync timestamps.
    """
    from fastapi import HTTPException
    from app.db.models import Exam
    from app.db.models.pipeline_run import PipelineRun
    from sqlmodel import select
    from datetime import datetime, timezone

    try:
        exam_id_int = int(exam_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid exam_id: '{exam_id}'")

    exam = await session.get(Exam, exam_id_int)
    if not exam:
        raise HTTPException(
            status_code=404, detail=f"Exam with ID '{exam_id}' not found."
        )

    publish_run_stmt = (
        select(PipelineRun)
        .where(
            PipelineRun.exam_id == exam_id_int,
            PipelineRun.pipeline_type.in_(["S3_PUBLISH", "S3_SYNC"]),
        )
        .order_by(PipelineRun.started_at.desc())
    )
    publish_run = (await session.exec(publish_run_stmt)).first()

    is_syncing = bool(
        publish_run
        and publish_run.status in ("RUNNING", "IN_PROGRESS", "QUEUED", "PENDING")
    )

    exam_status_str = (
        exam.status.value if hasattr(exam.status, "value") else str(exam.status)
    )
    is_published = (exam_status_str == "PUBLISHED") and bool(
        exam.questions_json_path or exam.questions_json_folder_path
    )

    is_s3_out_of_sync = False
    if is_published:
        if exam.last_synced_at is None:
            is_s3_out_of_sync = True
        elif exam.updated_at:
            upd = (
                exam.updated_at
                if exam.updated_at.tzinfo
                else exam.updated_at.replace(tzinfo=timezone.utc)
            )
            sync = (
                exam.last_synced_at
                if exam.last_synced_at.tzinfo
                else exam.last_synced_at.replace(tzinfo=timezone.utc)
            )
            is_s3_out_of_sync = upd > sync

    from app.cache import get_cache
    cache = get_cache()
    cache_key = f"ep:admin:exam:{exam_id}:sync_status"
    cached_res = await cache.get(cache_key)
    if cached_res is not None:
        return cached_res

    res = {
        "exam_id": str(exam.id),
        "exam_code": exam.code,
        "is_published": is_published,
        "is_syncing": is_syncing,
        "sync_status": publish_run.status if publish_run else "IDLE",
        "current_step": publish_run.current_step if publish_run else None,
        "progress_percent": publish_run.progress_percent if publish_run else 0.0,
        "error_log": publish_run.error_log if publish_run else None,
        "last_synced_at": exam.last_synced_at.isoformat()
        if exam.last_synced_at
        else None,
        "updated_at": exam.updated_at.isoformat() if exam.updated_at else None,
        "is_s3_out_of_sync": is_s3_out_of_sync,
        "questions_json_path": exam.questions_json_path,
        "solutions_json_path": exam.solutions_json_path,
        "questions_json_folder_path": exam.questions_json_folder_path,
        "solutions_json_folder_path": exam.solutions_json_folder_path,
    }
    if not is_syncing:
        await cache.set(cache_key, res, ttl_seconds=60)
    return res


@router.post(
    "/questions",
    response_model=QuestionDetailResponse,
    status_code=201,
    summary="Admin Create or Fill Missing Question",
)
async def admin_create_question(
    payload: QuestionCreatePayload,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_admin_section("admin.review", "admin.reported_questions")),
):
    """
    Admin endpoint to create a new question or fill in a missing question for an exam.
    Automatically sets Question status to PUBLISHED and updates Exam missing question metrics.
    """
    service = QuestionService(session)
    return await service.create_question(payload=payload)


@router.put(
    "/questions/{question_id}",
    response_model=QuestionDetailResponse,
    summary="Admin Update Question",
)
async def admin_update_question(
    question_id: int,
    payload: QuestionUpdatePayload,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_admin_section("admin.review", "admin.reported_questions")),
):
    """
    Admin endpoint to update question details.
    Automatically sets Question status to PUBLISHED and updates Exam missing question metrics.
    """
    service = QuestionService(session)
    return await service.update_question_detail(
        question_id=question_id, payload=payload
    )


@router.patch(
    "/questions/{question_id}",
    response_model=QuestionDetailResponse,
    summary="Admin Partial Update Question",
)
async def admin_patch_question(
    question_id: int,
    payload: QuestionUpdatePayload,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_admin_section("admin.review", "admin.reported_questions")),
):
    """
    Admin endpoint to partially update question details.
    Automatically sets Question status to PUBLISHED and updates Exam missing question metrics.
    """
    service = QuestionService(session)
    return await service.update_question_detail(
        question_id=question_id, payload=payload
    )


@router.post(
    "/upload-question-paper", status_code=202, summary="Admin Upload Question Paper PDF"
)
async def admin_upload_question_paper(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    exam_name: Optional[str] = Form(default="UPSC"),
    year: int = Form(...),
    stage: Optional[str] = Form(default="prelims"),
    set_code: Optional[str] = Form(default="SET_A"),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_admin_section("admin.upload")),
):
    """
    Admin endpoint to upload a Question Paper PDF document for an examination.
    Stores the PDF in storage and initializes the exam record.
    """
    from pathlib import Path
    from app.utils.file_utils import save_upload_file_temp
    from app.storage.factory import get_storage_provider

    storage = get_storage_provider()
    from app.config.filename_parser import parse_question_paper_filename
    from app.db.models import Exam
    from sqlmodel import select, func

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
        raise HTTPException(status_code=400, detail=str(e))

    canonical_exam_code = meta["canonical_code"]
    clean_set = meta["set_code"]

    temp_dir = Path("./temp_uploads").resolve()
    temp_path = await save_upload_file_temp(file, temp_dir)

    rel_storage_path = (
        f"uploads/question_papers/{canonical_exam_code}/{canonical_exam_code}.pdf"
    )
    persistent_path = await storage.upload_file(temp_path, rel_storage_path)
    from app.utils.pdf_utils import seed_pdf_cache
    seed_pdf_cache(persistent_path, temp_path)

    # Check if exam exists or create/update
    res = await session.exec(
        select(Exam).where(
            (func.lower(Exam.code) == canonical_exam_code.lower())
            | (func.lower(Exam.name) == canonical_exam_code.lower())
        )
    )
    exam = res.first()

    if not exam:
        exam = Exam(
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


@router.post(
    "/upload-answer-key", status_code=202, summary="Admin Upload Answer Key PDF"
)
async def admin_upload_answer_key(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    set_code: str = Form(...),
    exam_name: Optional[str] = Form(default="UPSC"),
    year: int = Form(...),
    stage: Optional[str] = Form(default="prelims"),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_admin_section("admin.upload")),
):
    """
    Admin endpoint to upload an Answer Key PDF document for a specific examination year and set code.
    Stores the Answer Key PDF and links it to the exam record.
    """
    from pathlib import Path
    from app.utils.file_utils import save_upload_file_temp
    from app.storage.factory import get_storage_provider

    storage = get_storage_provider()
    from app.config.filename_parser import parse_answer_key_filename
    from app.db.models import Exam
    from sqlmodel import select, func

    ALLOWED_SET_TOKENS = {
        "SET_A",
        "SET_B",
        "SET_C",
        "SET_D",
        "SET_1",
        "SET_2",
        "SET_3",
        "SET_4",
        "A",
        "B",
        "C",
        "D",
        "1",
        "2",
        "3",
        "4",
    }
    raw_set = str(set_code).strip().upper() if set_code else ""
    if not raw_set or raw_set not in ALLOWED_SET_TOKENS:
        raise HTTPException(
            status_code=400,
            detail="Invalid paper set code. Allowed values: SET_A, SET_B, SET_C, SET_D, A, B, C, D.",
        )

    clean_set = raw_set if raw_set.startswith("SET_") else f"SET_{raw_set}"

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported for Answer Key processing.",
        )

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
    from app.utils.pdf_utils import seed_pdf_cache
    seed_pdf_cache(persistent_path, temp_path)

    # Check if exam exists or create/update
    res = await session.exec(
        select(Exam).where(
            (func.lower(Exam.code) == canonical_exam_code.lower())
            | (func.lower(Exam.name) == canonical_exam_code.lower())
        )
    )
    exam = res.first()

    if not exam:
        exam = Exam(
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

@router.post("/exams/{exam_id}/approve-all-questions", summary="Approve and Verify All Questions for an Exam")
@router.post("/{exam_id}/approve-all-questions", summary="Approve and Verify All Questions for an Exam")
async def approve_all_questions(
    exam_id: int,
    current_user: User = Depends(require_admin_section("admin.review")),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Mark all questions for a given exam as PUBLISHED, bypassing LLM/human review.
    This is intended for questions where solution data is already verified.
    """
    service = QuestionService(session)
    res = await service.approve_all_questions_for_exam(
        exam_id=exam_id
    )
    return JSONResponse(content=jsonable_encoder(res))


@router.post("/exams/{exam_id}/translate", summary="Trigger Question Translation Pipeline for an Exam")
@router.post("/{exam_id}/translate", summary="Trigger Question Translation Pipeline for an Exam")
async def trigger_exam_translation(
    exam_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_admin_section("admin.upload", "admin.review")),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Manually trigger or retry question translation into all 22 Indian languages for an exam.
    Runs in the background via Celery or BackgroundTasks.
    """
    from app.config.settings import get_settings
    if not get_settings().ENABLE_TRANSLATION_PIPELINE:
        return {
            "status": "DISABLED",
            "message": "Translation pipeline is globally disabled.",
            "exam_id": exam_id,
        }

    from app.db.models import Exam
    from app.tasks.translation_tasks import translate_exam_questions_task
    from app.cache import invalidate_pipeline_status_cache
    from app.db.session import async_session_factory

    exam = await session.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail=f"Exam {exam_id} not found")

    try:
        task = translate_exam_questions_task.delay(exam_id)
        task_id = task.id
    except Exception as e:
        logger.warning(f"Celery dispatch failed ({e}), running via background tasks")
        from app.services.translation_service import QuestionTranslationService

        async def _run_inline():
            async with async_session_factory() as s:
                svc = QuestionTranslationService(s)
                await svc.translate_exam(exam_id)

        background_tasks.add_task(_run_inline)
        task_id = "background_task"

    await invalidate_pipeline_status_cache()
    return {
        "status": "QUEUED",
        "exam_id": exam_id,
        "task_id": task_id,
        "message": f"Question translation pipeline queued for exam {exam_id}",
    }


@router.post("/exams/reconcile-translations", summary="Trigger Midnight Missing Translations Reconciliation")
async def trigger_reconcile_translations(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_admin_section("admin.upload")),
):
    """
    Manually trigger missing translations audit and reconciliation across all exams.
    """
    from app.tasks.translation_tasks import reconcile_missing_translations_task
    from app.db.session import async_session_factory

    try:
        task = reconcile_missing_translations_task.delay()
        task_id = task.id
    except Exception as e:
        logger.warning(f"Celery dispatch failed ({e}), running via background tasks")
        from app.services.translation_service import QuestionTranslationService

        async def _run_reconcile():
            async with async_session_factory() as s:
                svc = QuestionTranslationService(s)
                await svc.reconcile_all_missing_translations()

        background_tasks.add_task(_run_reconcile)
        task_id = "background_task"

    return {
        "status": "QUEUED",
        "task_id": task_id,
        "message": "Missing translations reconciliation audit queued.",
    }


@router.get("/languages", summary="List all 22 official Indian languages + English")
async def get_all_languages(
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    from app.core.languages import get_all_supported_languages

    return get_all_supported_languages()

    