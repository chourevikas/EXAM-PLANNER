from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_session
from app.db.models.user import User, UserRole
from app.schemas.auth import (
    AdminApprovalRequestOut,
    AdminActionPayload,
    UserOut,
    AdminApprovalLogOut,
    SystemStatsOut,
)
from app.services.admin_service import AdminService
from app.core.deps import require_roles

router = APIRouter(prefix="/admin", tags=["Admin Management"])


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
