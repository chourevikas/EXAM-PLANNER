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

class BulkTaskItem(SQLModel):
    task_id: Optional[str] = None
    title: str
    subject: Optional[str] = None
    topic: Optional[str] = None
    subtopic: Optional[str] = None
    activity_type: Optional[str] = "CONCEPT_REVISION"
    priority: Optional[str] = "HIGH"
    allocated_time_minutes: Optional[int] = 30
    due_in_days: Optional[int] = 2
    reasoning: Optional[str] = None
    action_checklist: Optional[List[str]] = []
    linked_question_numbers: Optional[List[int]] = []

class BulkAddFromReportRequest(SQLModel):
    attempt_id: uuid.UUID
    tasks: List[BulkTaskItem]

@router.post("/tasks/bulk-from-report")
async def bulk_add_tasks_from_report(
    req: BulkAddFromReportRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    import datetime as dt_mod
    now_utc = datetime.now(timezone.utc)
    
    # Check existing tasks for this user to avoid duplicate titles
    existing_stmt = select(StudyTask).where(StudyTask.user_id == current_user.id)
    existing_tasks = (await session.exec(existing_stmt)).all()
    existing_titles = {t.title for t in existing_tasks}
    
    created_task_ids = []
    for t_item in req.tasks:
        full_title = f"[{t_item.subject or 'Core'}] {t_item.title}" if not t_item.title.startswith("[") else t_item.title
        if full_title in existing_titles:
            continue
            
        task_date = now_utc.date() + dt_mod.timedelta(days=max(0, t_item.due_in_days or 1))
        
        checklist_str = "\n".join([f"• {c}" for c in (t_item.action_checklist or [])])
        desc_parts = [
            f"⏱️ Allocated Time: {t_item.allocated_time_minutes or 30} mins | Priority: {t_item.priority or 'HIGH'}",
            f"📌 Activity: {(t_item.activity_type or 'CONCEPT_REVISION').replace('_', ' ').title()}",
        ]
        if t_item.reasoning:
            desc_parts.append(f"💡 Diagnostic Reasoning: {t_item.reasoning}")
        if checklist_str:
            desc_parts.append(f"📋 Action Checklist:\n{checklist_str}")
        if t_item.linked_question_numbers:
            desc_parts.append(f"🔗 Linked Questions: Q{', Q'.join(map(str, t_item.linked_question_numbers))}")
            
        full_desc = "\n\n".join(desc_parts)
        
        new_task = StudyTask(
            user_id=current_user.id,
            title=full_title,
            description=full_desc,
            scheduled_date=task_date,
            is_completed=False,
        )
        session.add(new_task)
        created_task_ids.append(str(new_task.id))
        existing_titles.add(full_title)
        
    await session.commit()
    return {
        "status": "SUCCESS",
        "scheduled_tasks_count": len(created_task_ids),
        "task_ids": created_task_ids,
        "message": f"Successfully scheduled {len(created_task_ids)} tasks into your study plan."
    }

@router.get("/tasks/attempt/{attempt_id}/status")
async def get_attempt_tasks_status(
    attempt_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    stmt = select(StudyTask).where(StudyTask.user_id == current_user.id)
    tasks = (await session.exec(stmt)).all()
    return {
        "attempt_id": str(attempt_id),
        "scheduled_task_titles": [t.title for t in tasks],
        "tasks": [
            {
                "id": str(t.id),
                "title": t.title,
                "description": t.description,
                "scheduled_date": str(t.scheduled_date),
                "is_completed": t.is_completed
            }
            for t in tasks
        ]
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
            "priority": t.priority or "MEDIUM",
            "allocated_time_minutes": t.allocated_time_minutes or 30,
            "activity_type": t.activity_type or "CONCEPT_REVISION",
            "is_ai_recommended": t.is_ai_recommended,
            "source_attempt_id": str(t.source_attempt_id) if t.source_attempt_id else None,
            "subject": t.subject,
            "topic": t.topic,
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

