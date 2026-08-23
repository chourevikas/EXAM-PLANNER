import uuid
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from sqlmodel import select, col, SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.session import get_async_session
from app.db.models.user import User
from app.db.models.study_plan import StudyTask
from app.db.models.gamification import Badge, UserBadge
from app.core.deps import get_current_user
from app.services.gamification_service import GamificationService

router = APIRouter(prefix="/study-plan", tags=["Study Plan & Gamification"])

@router.post("/tasks/{task_id}/complete")
async def complete_study_task(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    # Fetch the task
    stmt = select(StudyTask).where(
        StudyTask.id == task_id,
        StudyTask.user_id == current_user.id
    )
    result = await session.execute(stmt)
    task = result.scalars().first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    if task.is_completed:
        return {"message": "Task is already completed"}
        
    # Mark task as completed
    task.is_completed = True
    task.completed_at = datetime.now(timezone.utc)
    await session.commit()
    
    from app.cache import get_cache
    cache = get_cache()
    await cache.delete_pattern(f"ep:users:badges:{current_user.id}*")

    # Trigger the Gamification Hook
    gamification_service = GamificationService(session)
    gamification_result = await gamification_service.check_and_update_daily_goal(current_user.id)
    
    return {
        "message": "Task marked as completed",
        "task_id": str(task.id),
        "gamification": gamification_result
    }

class CreateTaskRequest(SQLModel):
    title: str
    description: Optional[str] = None
    target_type: Optional[str] = "DAILY"  # DAILY, WEEKLY, REVISION_MILESTONE
    topic: Optional[str] = None
    due_in_days: Optional[int] = 1

@router.post("/tasks")
async def create_study_task(
    req: CreateTaskRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    import datetime as dt_mod
    task_date = datetime.now(timezone.utc).date() + dt_mod.timedelta(days=max(0, req.due_in_days or 0))
    desc = req.description or f"[{req.target_type or 'DAILY'}] Topic: {req.topic or 'Core Revision'}"
    new_task = StudyTask(
        user_id=current_user.id,
        title=req.title,
        description=desc,
        scheduled_date=task_date,
        is_completed=False
    )
    session.add(new_task)
    await session.commit()
    await session.refresh(new_task)
    return {
        "message": "Task added to study plan successfully",
        "task_id": str(new_task.id),
        "title": new_task.title,
        "target_type": req.target_type or "DAILY",
        "scheduled_date": str(new_task.scheduled_date)
    }

@router.get("/tasks")
async def list_study_tasks(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    stmt = select(StudyTask).where(StudyTask.user_id == current_user.id).order_by(col(StudyTask.created_at).desc())
    tasks = (await session.exec(stmt)).all()
    return JSONResponse(content=jsonable_encoder([
        {
            "id": str(t.id),
            "title": t.title,
            "description": t.description,
            "scheduled_date": str(t.scheduled_date),
            "is_completed": t.is_completed,
            "created_at": t.created_at.isoformat() if t.created_at else None
        }
        for t in tasks
    ]))

@router.get("/badges")
async def get_user_badges(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    from app.cache import get_cache, build_cache_key
    cache = get_cache()
    cache_key = build_cache_key("users:badges", str(current_user.id))
    cached_data = await cache.get(cache_key)
    if cached_data is not None:
        return JSONResponse(content=jsonable_encoder(cached_data))

    # Fetch all badges
    stmt_all = select(Badge)
    badges = (await session.execute(stmt_all)).scalars().all()
    
    # Fetch user's unlocked badges
    stmt_user = select(UserBadge).where(UserBadge.user_id == current_user.id)
    user_badges = (await session.execute(stmt_user)).scalars().all()
    unlocked_badge_ids = {ub.badge_id for ub in user_badges}
    
    unlocked = []
    locked = []
    
    for badge in badges:
        badge_data = {
            "id": str(badge.id),
            "name": badge.name,
            "description": badge.description,
            "icon_url": badge.icon_url,
            "required_xp": badge.required_xp
        }
        if badge.id in unlocked_badge_ids:
            unlocked.append(badge_data)
        else:
            locked.append(badge_data)
            
    res_dict = {
        "unlocked": unlocked,
        "locked": locked
    }
    await cache.set(cache_key, res_dict, ttl_seconds=1800)
    return JSONResponse(content=jsonable_encoder(res_dict))

