import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.session import get_async_session
from app.db.models.user import User
from app.db.models.study_plan import StudyTask
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
    
    # Trigger the Gamification Hook
    gamification_service = GamificationService(session)
    gamification_result = await gamification_service.check_and_update_daily_goal(current_user.id)
    
    return {
        "message": "Task marked as completed",
        "task_id": str(task.id),
        "gamification": gamification_result
    }

@router.post("/tasks/dummy-create")
async def create_dummy_task(
    title: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    # Just for testing the streak hook before we have LLM integration
    today = datetime.now(timezone.utc).date()
    new_task = StudyTask(
        user_id=current_user.id,
        title=title,
        scheduled_date=today,
        is_completed=False
    )
    session.add(new_task)
    await session.commit()
    await session.refresh(new_task)
    return {"message": "Dummy task created", "task_id": str(new_task.id)}
