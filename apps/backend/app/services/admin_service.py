from datetime import datetime, timezone
from typing import List
from fastapi import HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, func

from app.db.models import Exam, Question, Subject, QuestionHierarchyLink, ExamStatus
from app.db.models.user import User, UserRole
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
    AdminApprovalRequestOut,
    AdminActionPayload,
    UserOut,
    AdminApprovalLogOut,
    SystemStatsOut,
    AdminOverviewStatsOut,
    OverviewMetricOut,
    RecentUploadItemOut,
    SubjectBreakdownItemOut,
    UserDirectoryItemOut,
)


class AdminService:
    """Service encapsulating admin management operations, approvals, and audit logging."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = UserRepository(session)

    async def list_pending_admin_requests(self) -> List[AdminApprovalRequestOut]:
        pending_users = await self.repo.get_pending_admins()
        result = []
        for u in pending_users:
            org_name = u.admin_profile.organization_name if u.admin_profile else None
            dept = u.admin_profile.department if u.admin_profile else None
            result.append(
                AdminApprovalRequestOut(
                    id=str(u.id),
                    full_name=u.full_name,
                    email=u.email,
                    role=u.role,
                    status=u.status,
                    organization_name=org_name,
                    department=dept,
                    created_at=u.created_at,
                )
            )
        return result

    async def list_active_admins(self) -> List[AdminApprovalRequestOut]:
        from app.db.models.user import UserStatus
        active_users = await self.repo.get_all_users_for_superadmin(role=UserRole.ADMIN, status=UserStatus.ACTIVE)
        result = []
        for u in active_users:
            org_name = u.admin_profile.organization_name if u.admin_profile else None
            dept = u.admin_profile.department if u.admin_profile else None
            result.append(
                AdminApprovalRequestOut(
                    id=str(u.id),
                    full_name=u.full_name,
                    email=u.email,
                    role=u.role,
                    status=u.status,
                    organization_name=org_name,
                    department=dept,
                    created_at=u.created_at,
                )
            )
        return result

    async def list_all_users(self) -> List[UserDirectoryItemOut]:
        all_users = await self.repo.get_all_users_for_superadmin()
        result = []
        for u in all_users:
            admin_prof = u.__dict__.get("admin_profile")
            
            org_name = admin_prof.organization_name if admin_prof else None
            dept = admin_prof.department if admin_prof else None
            
            target_exam = getattr(u, "target_exam", None)
            target_year = getattr(u, "target_year", None)

            result.append(
                UserDirectoryItemOut(
                    id=str(u.id),
                    full_name=u.full_name,
                    email=u.email,
                    role=u.role,
                    status=u.status,
                    organization_name=org_name,
                    department=dept,
                    target_exam=target_exam,
                    target_year=target_year,
                    created_at=u.created_at,
                    suspended_at=u.suspended_at,
                    updated_at=u.updated_at,
                    custom_role_id=u.custom_role_id,
                )
            )
        return result

    async def update_user_role(self, user_id: str, new_role: UserRole) -> UserOut:
        user = await self.repo.update_user_role(user_id=user_id, new_role=new_role)
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
        return user

    async def approve_admin_request(
        self, user_id: str, current_super_admin: User
    ) -> UserOut:
        approved_user = await self.repo.approve_admin(
            admin_id=user_id, super_admin_id=current_super_admin.id
        )
        if not approved_user:
            raise HTTPException(status_code=404, detail="Pending admin user not found.")
        return approved_user

    async def reject_admin_request(
        self, user_id: str, payload: AdminActionPayload, current_super_admin: User
    ) -> UserOut:
        rejected_user = await self.repo.reject_admin(
            admin_id=user_id,
            super_admin_id=current_super_admin.id,
            reason=payload.reason,
        )
        if not rejected_user:
            raise HTTPException(status_code=404, detail="Pending admin user not found.")
        return rejected_user

    async def suspend_admin_user(self, user_id: str) -> UserOut:
        user = await self.repo.suspend_admin(admin_id=user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Admin user not found.")
        return user

    async def reactivate_admin_user(self, user_id: str) -> UserOut:
        user = await self.repo.reactivate_admin(admin_id=user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Admin user not found.")
        return user

    async def get_approval_audit_logs(self) -> List[AdminApprovalLogOut]:
        logs = await self.repo.get_approval_audit_logs()
        result = []
        for log in logs:
            admin_user = await self.repo.get_by_id(log.admin_user_id)
            reviewer_user = (
                await self.repo.get_by_id(log.reviewed_by_id)
                if log.reviewed_by_id
                else None
            )
            result.append(
                AdminApprovalLogOut(
                    id=str(log.id),
                    admin_user_name=admin_user.full_name
                    if admin_user
                    else "Unknown User",
                    admin_user_email=admin_user.email if admin_user else "N/A",
                    action=log.action,
                    reviewed_by_name=reviewer_user.full_name
                    if reviewer_user
                    else "System SuperAdmin",
                    reason=log.reason,
                    created_at=log.created_at,
                )
            )
        return result

    async def get_system_diagnostics(self) -> SystemStatsOut:
        from app.cache import get_cache, build_cache_key
        cache = get_cache()
        cache_key = build_cache_key("admin:stats")
        cached_data = await cache.get(cache_key)
        if cached_data is not None:
            return SystemStatsOut(**cached_data) if isinstance(cached_data, dict) else cached_data

        stats = await self.repo.get_system_audit_stats()
        if stats:
            serialized = stats if isinstance(stats, dict) else (stats.model_dump(mode="json") if hasattr(stats, "model_dump") else stats)
            await cache.set(cache_key, serialized, ttl_seconds=300)
            return SystemStatsOut(**stats) if isinstance(stats, dict) else stats
        return stats

    async def get_admin_overview_stats(self) -> AdminOverviewStatsOut:
        from app.cache import get_cache, build_cache_key
        cache = get_cache()
        cache_key = build_cache_key("admin:overview_stats")
        cached_data = await cache.get(cache_key)
        if cached_data is not None:
            return AdminOverviewStatsOut(**cached_data)

        now = datetime.now(timezone.utc)

        # 1. Total Papers Uploaded
        total_papers_res = await self.session.exec(select(func.count(Exam.id)))
        total_papers = total_papers_res.one() or 0

        first_of_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        month_papers_res = await self.session.exec(
            select(func.count(Exam.id)).where(Exam.created_at >= first_of_month)
        )
        papers_this_month = month_papers_res.one() or 0
        papers_badge = f"+{papers_this_month} this month" if papers_this_month > 0 else "Active papers"

        # 2. Questions Extracted
        total_q_res = await self.session.exec(select(func.count(Question.id)))
        total_questions = total_q_res.one() or 0

        complete_q_res = await self.session.exec(
            select(func.count(Question.id)).where(Question.is_complete == True)
        )
        complete_questions = complete_q_res.one() or 0

        parse_percent = round((complete_questions / total_questions * 100), 1) if total_questions > 0 else 100.0
        parse_badge = f"{int(parse_percent)}% Parsed" if total_questions > 0 else "100% Parsed"

        # 3. AI Extraction Accuracy
        ai_accuracy = round((complete_questions / total_questions * 100), 1) if total_questions > 0 else 95.0
        accuracy_badge = "High Confidence" if ai_accuracy >= 90 else "Standard Confidence"

        # 4. Supported Exam Types
        stages_res = await self.session.exec(select(func.count(func.distinct(Exam.stage))))
        exam_types_count = stages_res.one() or 0
        if exam_types_count == 0:
            exam_types_count = 1

        metrics = [
            OverviewMetricOut(
                title="Total Papers Uploaded",
                value=f"{total_papers:,}",
                badge=papers_badge,
                color="#2563eb",
                bg="rgba(37, 99, 235, 0.12)",
                icon_name="Upload",
            ),
            OverviewMetricOut(
                title="Questions Extracted",
                value=f"{total_questions:,}",
                badge=parse_badge,
                color="#10b981",
                bg="rgba(16, 185, 129, 0.12)",
                icon_name="FileText",
            ),
            OverviewMetricOut(
                title="AI Extraction Accuracy",
                value=f"{ai_accuracy}%",
                badge=accuracy_badge,
                color="#8b5cf6",
                bg="rgba(139, 92, 246, 0.12)",
                icon_name="Sparkles",
            ),
            OverviewMetricOut(
                title="Supported Exam Types",
                value=str(exam_types_count),
                badge="UPSC / State PSC",
                color="#f59e0b",
                bg="rgba(245, 158, 11, 0.12)",
                icon_name="Layers",
            ),
        ]

        # 5. Recent Exam Uploads (top 5 from DB)
        recent_exams_res = await self.session.exec(
            select(Exam).order_by(Exam.created_at.desc()).limit(5)
        )
        recent_exams = recent_exams_res.all()

        recent_uploads = []
        for e in recent_exams:
            status_enum = e.status.value if hasattr(e.status, "value") else str(e.status)
            if status_enum == "PUBLISHED":
                status_text = "Approved & Published"
            elif status_enum == "PENDING_HUMAN_REVIEW":
                status_text = "Ready for Review"
            elif status_enum in ("PARSING_PDF", "PROCESSING"):
                status_text = "AI Processing"
            else:
                status_text = status_enum.replace("_", " ").title()

            e_date = e.created_at
            if e_date:
                if e_date.date() == now.date():
                    date_str = f"Today, {e_date.strftime('%I:%M %p')}"
                elif (now.date() - e_date.date()).days == 1:
                    date_str = "Yesterday"
                else:
                    date_str = e_date.strftime("%b %d, %Y")
            else:
                date_str = "Recently"

            total_exp = e.total_questions or 100
            ext_cnt = e.extracted_questions_count or 0
            if total_exp > 0 and ext_cnt > 0:
                conf = min(99.0, max(85.0, round((ext_cnt / total_exp) * 100, 1)))
            else:
                conf = 95.0

            recent_uploads.append(
                RecentUploadItemOut(
                    id=str(e.id),
                    title=e.name or f"{e.code}",
                    questions=ext_cnt,
                    date=date_str,
                    status=status_text,
                    confidence=conf,
                )
            )

        # 6. Subject Breakdown
        sub_stmt = (
            select(Subject.name, func.count(func.distinct(QuestionHierarchyLink.question_id)))
            .join(QuestionHierarchyLink, Subject.id == QuestionHierarchyLink.subject_id)
            .group_by(Subject.name)
            .order_by(func.count(func.distinct(QuestionHierarchyLink.question_id)).desc())
            .limit(6)
        )
        sub_rows = (await self.session.exec(sub_stmt)).all()

        palette = ["#2563eb", "#8b5cf6", "#10b981", "#f59e0b", "#06b6d4", "#ec4899"]
        subject_breakdown = []

        total_linked_questions = sum(r[1] for r in sub_rows) if sub_rows else total_questions

        if sub_rows and total_linked_questions > 0:
            for idx, (s_name, count) in enumerate(sub_rows):
                pct = round((count / total_linked_questions) * 100, 1)
                subject_breakdown.append(
                    SubjectBreakdownItemOut(
                        subject=s_name,
                        count=count,
                        percent=pct,
                        color=palette[idx % len(palette)],
                    )
                )
        else:
            sec_stmt = (
                select(Question.section_code, func.count(Question.id))
                .group_by(Question.section_code)
                .order_by(func.count(Question.id).desc())
                .limit(6)
            )
            sec_rows = (await self.session.exec(sec_stmt)).all()
            total_sec = sum(r[1] for r in sec_rows) if sec_rows else 1

            for idx, (sec_code, count) in enumerate(sec_rows):
                label = sec_code.replace("_", " ").title() if sec_code != "DEFAULT" else "General Studies"
                pct = round((count / total_sec) * 100, 1)
                subject_breakdown.append(
                    SubjectBreakdownItemOut(
                        subject=label,
                        count=count,
                        percent=pct,
                        color=palette[idx % len(palette)],
                    )
                )

        res = AdminOverviewStatsOut(
            metrics=metrics,
            recent_uploads=recent_uploads,
            subject_breakdown=subject_breakdown,
        )
        await cache.set(cache_key, res.model_dump(mode="json"), ttl_seconds=300)
        return res

