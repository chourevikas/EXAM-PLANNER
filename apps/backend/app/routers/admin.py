import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, BackgroundTasks, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_session
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
    service = AdminService(session)
    return await service.get_admin_overview_stats()



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
    service = AdminService(session)
    return await service.approve_admin_request(
        user_id=user_id, current_super_admin=current_user
    )


@router.post("/reject/{user_id}", response_model=UserOut)
async def reject_admin_request(
    user_id: str,
    payload: AdminActionPayload = AdminActionPayload(),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    service = AdminService(session)
    return await service.reject_admin_request(
        user_id=user_id, payload=payload, current_super_admin=current_user
    )


@router.post("/suspend/{user_id}", response_model=UserOut)
async def suspend_admin_user(
    user_id: str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    service = AdminService(session)
    return await service.suspend_admin_user(user_id=user_id)


@router.post("/reactivate/{user_id}", response_model=UserOut)
async def reactivate_admin_user(
    user_id: str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    service = AdminService(session)
    return await service.reactivate_admin_user(user_id=user_id)


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
    service = AdminService(session)
    return await service.get_system_diagnostics()



@router.get("/exams/pipeline-status", summary="List All Exams with Pipeline Status & Question Metrics")
async def list_exam_pipeline_statuses(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    """
    Returns list of all exams with detailed pipeline status, extracted question metrics,
    and S3 JSON folder artifact paths.
    """
    from sqlmodel import select, func
    from app.db.models import Exam, Question

    res = await session.exec(select(Exam))
    exams = res.all()

    pipeline_list = []
    for exam in exams:
        # Get live count of extracted questions in DB
        q_cnt_res = await session.exec(select(func.count(Question.id)).where(Question.exam_id == exam.id))
        q_count = q_cnt_res.one()

        status_str = exam.status.value if hasattr(exam.status, "value") else str(exam.status)

        pipeline_list.append({
            "id": str(exam.id),
            "code": exam.code,
            "name": exam.name,
            "source_year": exam.source_year,
            "stage": exam.stage,
            "subject_code": exam.subject_code,
            "paper_set_code": exam.paper_set_code,
            "status": status_str,
            "is_active": exam.is_active,
            "total_questions": exam.total_questions or 100,
            "extracted_questions_count": q_count,
            "missing_questions_count": exam.missing_questions_count or max(0, (exam.total_questions or 100) - q_count),
            "questions_json_path": exam.questions_json_path,
            "solutions_json_path": exam.solutions_json_path,
            "questions_json_folder_path": exam.questions_json_folder_path,
            "solutions_json_folder_path": exam.solutions_json_folder_path,
        })

    return pipeline_list


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
    from app.db.models import Exam, ExamStatus, Question
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

    # 1 & 2. Generate JSON files and upload to S3 folder paths
    builder = ExamJsonBuilder(session)
    json_paths = await builder.generate_and_upload(exam_uuid)

    # 3 & 4. Mark exam status as PUBLISHED and is_active as True
    exam.status = ExamStatus.PUBLISHED
    exam.is_active = True
    session.add(exam)
    await session.commit()
    await session.refresh(exam)

    return {
        "status": "APPROVED_AND_PUBLISHED",
        "exam_id": str(exam.id),
        "exam_code": exam.code,
        "exam_status": exam.status.value if hasattr(exam.status, "value") else str(exam.status),
        "is_active": exam.is_active,
        "questions_count": len(questions),
        "questions_json_path": exam.questions_json_path,
        "solutions_json_path": exam.solutions_json_path,
        "questions_json_folder_path": exam.questions_json_folder_path,
        "solutions_json_folder_path": exam.solutions_json_folder_path,
        "message": f"Exam '{exam.code}' successfully approved, published, activated, and JSON folders generated.",
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

    return {
        "status": "ACCEPTED",
        "message": f"Answer Key uploaded successfully for exam '{canonical_exam_code}' (Set: {clean_set}).",
        "exam_id": str(exam.id),
        "exam_code": exam.code,
        "target_set_code": clean_set,
        "s3_path": persistent_path,
    }

