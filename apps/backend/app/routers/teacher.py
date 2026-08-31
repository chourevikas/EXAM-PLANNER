from typing import List
from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.session import get_async_session
from app.db.models.user import User, UserRole
from app.core.deps import require_roles, require_roles_or_permission
from app.schemas.teacher import (
    TeacherPointsSummaryOut,
    TeacherRewardOut,
    GrantRewardPayload,
    TeacherLeaderboardEntryOut,
)
from app.services.review_points_service import ReviewPointsService
from app.services.teacher_reward_service import TeacherRewardService

teacher_router = APIRouter(prefix="/teacher", tags=["Teacher"])
admin_teacher_router = APIRouter(prefix="/admin/teachers", tags=["Admin: Teacher Rewards"])

teacher_only = require_roles([UserRole.TEACHER])
manage_rewards = require_roles_or_permission([UserRole.ADMIN, UserRole.SUPER_ADMIN], "rewards.manage")


@teacher_router.get("/points", response_model=TeacherPointsSummaryOut)
async def get_my_points(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(teacher_only),
):
    return await ReviewPointsService(session).get_points_summary(current_user.id)


@teacher_router.get("/rewards", response_model=List[TeacherRewardOut])
async def get_my_rewards(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(teacher_only),
):
    return await TeacherRewardService(session).list_rewards_for_teacher(current_user.id)


@admin_teacher_router.get("", response_model=List[TeacherLeaderboardEntryOut])
async def list_teacher_leaderboard(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(manage_rewards),
):
    return await ReviewPointsService(session).get_teacher_leaderboard()


@admin_teacher_router.get("/{teacher_id}/rewards", response_model=List[TeacherRewardOut])
async def list_teacher_rewards(
    teacher_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(manage_rewards),
):
    return await TeacherRewardService(session).list_rewards_for_teacher(teacher_id)


@admin_teacher_router.post("/{teacher_id}/rewards", response_model=TeacherRewardOut)
async def grant_teacher_reward(
    teacher_id: int,
    payload: GrantRewardPayload,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(manage_rewards),
):
    return await TeacherRewardService(session).grant_reward(
        teacher_id=teacher_id,
        admin_id=current_user.id,
        title=payload.title,
        description=payload.description,
        points_value=payload.points_value,
    )
