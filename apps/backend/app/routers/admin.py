from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.auth import AdminApprovalRequestOut, AdminActionPayload, UserOut, AdminApprovalLogOut, SystemStatsOut
from app.repositories.user_repository import UserRepository
from app.core.deps import require_roles

router = APIRouter(prefix="/admin", tags=["Admin Management"])

@router.get("/pending-requests", response_model=List[AdminApprovalRequestOut])
def list_pending_admin_requests(
  db: Session = Depends(get_db),
  current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN]))
):
  repo = UserRepository(db)
  pending_users = repo.get_pending_admins()
  
  result = []
  for u in pending_users:
    org_name = u.admin_profile.organization_name if u.admin_profile else None
    dept = u.admin_profile.department if u.admin_profile else None
    result.append(
      AdminApprovalRequestOut(
        id=u.id,
        full_name=u.full_name,
        email=u.email,
        role=u.role,
        status=u.status,
        organization_name=org_name,
        department=dept,
        created_at=u.created_at
      )
    )
  return result

@router.get("/active-admins", response_model=List[AdminApprovalRequestOut])
def list_active_admins(
  db: Session = Depends(get_db),
  current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN]))
):
  repo = UserRepository(db)
  active_users = repo.get_active_admins()
  
  result = []
  for u in active_users:
    org_name = u.admin_profile.organization_name if u.admin_profile else None
    dept = u.admin_profile.department if u.admin_profile else None
    result.append(
      AdminApprovalRequestOut(
        id=u.id,
        full_name=u.full_name,
        email=u.email,
        role=u.role,
        status=u.status,
        organization_name=org_name,
        department=dept,
        created_at=u.created_at
      )
    )
  return result

@router.post("/approve/{user_id}", response_model=UserOut)
def approve_admin_request(
  user_id: str,
  db: Session = Depends(get_db),
  current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN]))
):
  repo = UserRepository(db)
  approved_user = repo.approve_admin(admin_id=user_id, super_admin_id=current_user.id)
  if not approved_user:
    raise HTTPException(status_code=404, detail="Pending admin user not found.")
  return approved_user

@router.post("/reject/{user_id}", response_model=UserOut)
def reject_admin_request(
  user_id: str,
  payload: AdminActionPayload = AdminActionPayload(),
  db: Session = Depends(get_db),
  current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN]))
):
  repo = UserRepository(db)
  rejected_user = repo.reject_admin(
    admin_id=user_id,
    super_admin_id=current_user.id,
    reason=payload.reason
  )
  if not rejected_user:
    raise HTTPException(status_code=404, detail="Pending admin user not found.")
  return rejected_user

@router.post("/suspend/{user_id}", response_model=UserOut)
def suspend_admin_user(
  user_id: str,
  db: Session = Depends(get_db),
  current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN]))
):
  repo = UserRepository(db)
  user = repo.suspend_admin(admin_id=user_id)
  if not user:
    raise HTTPException(status_code=404, detail="Admin user not found.")
  return user

@router.post("/reactivate/{user_id}", response_model=UserOut)
def reactivate_admin_user(
  user_id: str,
  db: Session = Depends(get_db),
  current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN]))
):
  repo = UserRepository(db)
  user = repo.reactivate_admin(admin_id=user_id)
  if not user:
    raise HTTPException(status_code=404, detail="Admin user not found.")
  return user

@router.get("/audit-logs", response_model=List[AdminApprovalLogOut])
def get_approval_audit_logs(
  db: Session = Depends(get_db),
  current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN]))
):
  repo = UserRepository(db)
  logs = repo.get_approval_logs()
  
  result = []
  for log in logs:
    admin_user = repo.get_by_id(log.admin_user_id)
    reviewer_user = repo.get_by_id(log.reviewed_by_id) if log.reviewed_by_id else None
    
    result.append(
      AdminApprovalLogOut(
        id=log.id,
        admin_user_name=admin_user.full_name if admin_user else "Unknown User",
        admin_user_email=admin_user.email if admin_user else "N/A",
        action=log.action,
        reviewed_by_name=reviewer_user.full_name if reviewer_user else "System SuperAdmin",
        reason=log.reason,
        created_at=log.created_at
      )
    )
  return result

@router.get("/system-stats", response_model=SystemStatsOut)
def get_system_diagnostics(
  db: Session = Depends(get_db),
  current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN]))
):
  repo = UserRepository(db)
  return repo.get_system_stats()
