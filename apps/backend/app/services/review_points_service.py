from typing import Optional
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models.user import User
from app.db.models.enums import UserRole
from app.db.models.teacher import TeacherProfile, ReviewPointsLog
from app.config.settings import settings


class ReviewPointsService:
    """Awards review points to TEACHER-role reviewers only. Admins/SuperAdmins
    reviewing through the same reused endpoints do not accrue teacher points."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def award_for_review_action(
        self,
        reviewer_id: Optional[int],
        action: str,
        review_task_id: Optional[int] = None,
        question_id: Optional[int] = None,
    ) -> None:
        if not reviewer_id:
            return

        reviewer = await self.session.get(User, reviewer_id)
        if not reviewer or reviewer.role != UserRole.TEACHER:
            return

        profile = await self.session.get(TeacherProfile, reviewer_id)
        if profile is None:
            profile = TeacherProfile(user_id=reviewer_id)
            self.session.add(profile)

        points = settings.REVIEW_POINTS_PER_ACTION
        profile.total_review_points += points
        profile.reviews_completed_count += 1
        self.session.add(profile)

        log = ReviewPointsLog(
            user_id=reviewer_id,
            review_task_id=review_task_id,
            question_id=question_id,
            action=action,
            points=points,
        )
        self.session.add(log)
        await self.session.commit()

    async def get_points_summary(self, user_id: int) -> dict:
        profile = await self.session.get(TeacherProfile, user_id)
        logs_res = await self.session.exec(
            select(ReviewPointsLog)
            .where(ReviewPointsLog.user_id == user_id)
            .order_by(ReviewPointsLog.created_at.desc())
            .limit(50)
        )
        logs = logs_res.all()
        return {
            "total_review_points": profile.total_review_points if profile else 0,
            "reviews_completed_count": profile.reviews_completed_count if profile else 0,
            "recent_logs": logs,
        }

    async def get_teacher_leaderboard(self) -> list[dict]:
        query = (
            select(User, TeacherProfile)
            .join(TeacherProfile, TeacherProfile.user_id == User.id, isouter=True)
            .where(User.role == UserRole.TEACHER)
        )
        result = await self.session.exec(query)
        rows = result.all()
        return [
            {
                "teacher_id": user.id,
                "full_name": user.full_name,
                "email": user.email,
                "total_review_points": profile.total_review_points if profile else 0,
                "reviews_completed_count": profile.reviews_completed_count if profile else 0,
            }
            for user, profile in rows
        ]
