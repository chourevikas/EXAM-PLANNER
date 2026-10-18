"""Admin management of milestones (badges with a criterion, threshold and XP reward)."""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlmodel import col, func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.deps import require_admin_section
from app.db.models.gamification import Badge, UserBadge
from app.db.models.user import User
from app.db.session import get_async_session
from app.services.milestone_service import CRITERIA

router = APIRouter(prefix="/admin/milestones", tags=["Admin: Milestones"])
admin_only = require_admin_section("admin.milestones")


class MilestoneIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1, max_length=300)
    criteria_type: str
    threshold: int = Field(ge=1, le=1_000_000)
    xp_reward: int = Field(default=100, ge=0, le=10_000)
    is_active: bool = True

    @field_validator("criteria_type")
    @classmethod
    def _known(cls, v: str) -> str:
        v = v.strip().upper()
        if v not in CRITERIA:
            raise ValueError(f"criteria_type must be one of {', '.join(CRITERIA)}")
        return v


async def _rows(session: AsyncSession) -> List[Dict[str, Any]]:
    counts = dict((await session.exec(
        select(UserBadge.badge_id, func.count(UserBadge.id)).group_by(UserBadge.badge_id)
    )).all())
    milestones = (await session.exec(
        select(Badge).where(col(Badge.criteria_type).is_not(None)).order_by(Badge.criteria_type, Badge.threshold)
    )).all()
    return [_out(m, counts.get(m.id, 0)) for m in milestones]


def _out(m: Badge, unlocked_count: int) -> Dict[str, Any]:
    return {
        "id": m.id,
        "name": m.name,
        "description": m.description,
        "criteria_type": m.criteria_type,
        "criteria_label": CRITERIA.get(m.criteria_type or "", m.criteria_type),
        "threshold": m.threshold,
        "xp_reward": m.xp_reward,
        "is_active": m.is_active,
        "unlocked_count": int(unlocked_count or 0),
    }


async def _award_qualifying_students() -> None:
    """Background: give the milestone to students who already qualify."""
    from app.db.session import async_session_factory
    from app.services import milestone_service

    async with async_session_factory() as session:
        await milestone_service.check_all_students(session)


@router.get("", summary="List milestones with how many students unlocked each")
async def list_milestones(
    session: AsyncSession = Depends(get_async_session), _: User = Depends(admin_only),
) -> Dict[str, Any]:
    return {"criteria": CRITERIA, "milestones": await _rows(session)}


@router.post("", status_code=status.HTTP_201_CREATED, summary="Create a milestone")
async def create_milestone(
    payload: MilestoneIn,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(admin_only),
) -> Dict[str, Any]:
    m = Badge(**payload.model_dump())
    session.add(m)
    await session.commit()
    await session.refresh(m)
    if m.is_active:
        background_tasks.add_task(_award_qualifying_students)
    return _out(m, 0)


@router.put("/{milestone_id}", summary="Update a milestone (students who now qualify get it)")
async def update_milestone(
    milestone_id: int,
    payload: MilestoneIn,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(admin_only),
) -> Dict[str, Any]:
    m = await session.get(Badge, milestone_id)
    if not m or m.criteria_type is None:
        raise HTTPException(status_code=404, detail="Milestone not found")
    for field, value in payload.model_dump().items():
        setattr(m, field, value)
    session.add(m)
    await session.commit()
    await session.refresh(m)
    unlocked = (await session.exec(select(func.count(UserBadge.id)).where(UserBadge.badge_id == m.id))).one()
    if m.is_active:
        background_tasks.add_task(_award_qualifying_students)
    return _out(m, unlocked)


@router.delete("/{milestone_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a milestone nobody has unlocked")
async def delete_milestone(
    milestone_id: int,
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(admin_only),
) -> None:
    m = await session.get(Badge, milestone_id)
    if not m or m.criteria_type is None:
        raise HTTPException(status_code=404, detail="Milestone not found")
    unlocked = (await session.exec(select(func.count(UserBadge.id)).where(UserBadge.badge_id == m.id))).one()
    if unlocked:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{unlocked} student(s) have unlocked this milestone. Switch it off instead, so they keep it.",
        )
    await session.delete(m)
    await session.commit()
