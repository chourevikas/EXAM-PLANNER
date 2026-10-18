import datetime as dt_mod
from datetime import datetime, timezone, timedelta, date
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from sqlmodel import select, col, SQLModel, func, delete
from sqlalchemy import case, cast, Date
from sqlmodel.ext.asyncio.session import AsyncSession
import asyncio

from app.db.session import get_async_session, async_session_factory
from app.db.models.user import User, UserRole
from app.db.models.study_plan import StudyTask, StudyActivity
from app.db.models.enums import StudyActivityType, ActivitySource
from app.db.models.analytics import ExamAttempt
from app.db.models.gamification import Badge, UserBadge
from app.core.deps import get_current_user, require_roles
from app.services.gamification_service import GamificationService
from app.services.email_service import send_pending_tasks_summary_email
from app.config.logger import setup_logger

logger = setup_logger("StudyPlanRouter")

router = APIRouter(prefix="/study-plan", tags=["Study Plan & Gamification"])

async def _drop_cached_schedule(user_id) -> None:
    """Clear the cached weekly schedule/insights after a task or activity changes.

    Without this the planner keeps showing the old week for up to the cache TTL.
    A cache failure must never fail the write that already committed.
    """
    try:
        from app.cache import invalidate_study_activity_cache
        await invalidate_study_activity_cache(user_id)
    except Exception:
        logger.warning("Could not clear cached study schedule for user %s", user_id, exc_info=True)


@router.post("/tasks/{task_id}/complete")
async def complete_study_task(
    task_id: int | str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    try:
        tid = int(task_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Task not found")

    # Fetch the task
    stmt = select(StudyTask).where(
        StudyTask.id == tid,
        StudyTask.user_id == current_user.id
    )
    result = await session.exec(stmt)
    task = result.first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    if task.is_completed:
        return {"message": "Task is already completed"}
        
    # Mark task as completed
    task.is_completed = True
    task.completed_at = datetime.now(timezone.utc)
    await session.commit()
    await _drop_cached_schedule(current_user.id)
    
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
    subject: Optional[str] = None
    topic: Optional[str] = None
    priority: Optional[str] = "MEDIUM"  # HIGH, MEDIUM, LOW
    allocated_time_minutes: Optional[int] = 30
    activity_type: Optional[str] = "CONCEPT_REVISION"
    due_in_days: Optional[int] = 0

@router.post("/tasks")
async def create_study_task(
    req: CreateTaskRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    task_date = datetime.now(timezone.utc).date() + timedelta(days=max(0, req.due_in_days or 0))
    desc = req.description or f"[{req.target_type or 'DAILY'}] Topic: {req.topic or 'Core Revision'}"

    # Task Deduplication Check: Prevent duplicate tasks on the same date for the user
    stmt_dup = select(StudyTask).where(
        StudyTask.user_id == current_user.id,
        StudyTask.title == req.title,
        StudyTask.scheduled_date == task_date
    )
    existing_dup = (await session.exec(stmt_dup)).first()
    if existing_dup:
        return {
            "message": "Task already exists for this date",
            "task_id": str(existing_dup.id),
            "title": existing_dup.title,
            "subject": existing_dup.subject,
            "priority": existing_dup.priority,
            "allocated_time_minutes": existing_dup.allocated_time_minutes,
            "target_type": req.target_type or "DAILY",
            "scheduled_date": str(existing_dup.scheduled_date)
        }

    new_task = StudyTask(
        user_id=current_user.id,
        title=req.title,
        description=desc,
        subject=req.subject,
        topic=req.topic,
        priority=req.priority or "MEDIUM",
        allocated_time_minutes=req.allocated_time_minutes or 30,
        activity_type=req.activity_type or "CONCEPT_REVISION",
        scheduled_date=task_date,
        is_completed=False
    )
    session.add(new_task)
    await session.commit()
    await session.refresh(new_task)
    await _drop_cached_schedule(current_user.id)
    return {
        "message": "Task added to study plan successfully",
        "task_id": str(new_task.id),
        "title": new_task.title,
        "subject": new_task.subject,
        "priority": new_task.priority,
        "allocated_time_minutes": new_task.allocated_time_minutes,
        "target_type": req.target_type or "DAILY",
        "scheduled_date": str(new_task.scheduled_date)
    }

class UpdateTaskRequest(SQLModel):
    title: Optional[str] = None
    description: Optional[str] = None
    subject: Optional[str] = None
    topic: Optional[str] = None
    priority: Optional[str] = None
    allocated_time_minutes: Optional[int] = None
    activity_type: Optional[str] = None
    scheduled_date: Optional[str] = None

@router.put("/tasks/{task_id}")
async def update_study_task(
    task_id: int | str,
    req: UpdateTaskRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    try:
        tid = int(task_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Task not found")

    stmt = select(StudyTask).where(
        StudyTask.id == tid,
        StudyTask.user_id == current_user.id
    )
    task = (await session.exec(stmt)).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if req.title is not None:
        task.title = req.title
    if req.description is not None:
        task.description = req.description
    if req.subject is not None:
        task.subject = req.subject
    if req.topic is not None:
        task.topic = req.topic
    if req.priority is not None:
        task.priority = req.priority
    if req.allocated_time_minutes is not None:
        task.allocated_time_minutes = req.allocated_time_minutes
    if req.activity_type is not None:
        task.activity_type = req.activity_type
    if req.scheduled_date is not None:
        try:
            task.scheduled_date = datetime.strptime(req.scheduled_date, "%Y-%m-%d").date()
        except ValueError:
            pass

    await session.commit()
    await session.refresh(task)
    await _drop_cached_schedule(current_user.id)
    return {"message": "Task updated successfully", "task_id": str(task.id)}

@router.delete("/tasks/{task_id}")
async def delete_study_task(
    task_id: int | str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    try:
        tid = int(task_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Task not found")

    stmt = select(StudyTask).where(
        StudyTask.id == tid,
        StudyTask.user_id == current_user.id
    )
    task = (await session.exec(stmt)).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    await session.delete(task)
    await session.commit()
    await _drop_cached_schedule(current_user.id)
    return {"message": "Task deleted successfully", "task_id": str(task_id)}

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
    attempt_id: int | str
    tasks: List[BulkTaskItem]

@router.post("/tasks/bulk-from-report")
async def bulk_add_tasks_from_report(
    req: BulkAddFromReportRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    now_utc = datetime.now(timezone.utc)
    
    existing_stmt = select(StudyTask).where(StudyTask.user_id == current_user.id)
    existing_tasks = (await session.exec(existing_stmt)).all()
    existing_titles = {t.title for t in existing_tasks}
    
    today = now_utc.date()
    monday_date = today - timedelta(days=today.weekday())
    
    # Limit diagnostic tasks to top 14 high-yield recommendations to avoid overwhelming the weekly plan
    top_tasks = req.tasks[:14] if len(req.tasks) > 14 else req.tasks

    created_task_ids = []
    activity_cycle = ["CONCEPT_REVISION", "PRACTICE_MCQS", "PYQ_SOLVING", "NEW_TOPIC"]
    
    for idx, t_item in enumerate(top_tasks):
        full_title = f"[{t_item.subject or 'Core'}] {t_item.title}" if not t_item.title.startswith("[") else t_item.title
        if full_title in existing_titles:
            continue
            
        # Distribute tasks evenly across Monday through Sunday (0 to 6)
        day_offset = idx % 7
        task_date = monday_date + timedelta(days=day_offset)
        assigned_activity = t_item.activity_type or activity_cycle[idx % len(activity_cycle)]
        
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
            subject=t_item.subject,
            topic=t_item.topic,
            priority=t_item.priority or "HIGH",
            allocated_time_minutes=t_item.allocated_time_minutes or 30,
            activity_type=assigned_activity,
            scheduled_date=task_date,
            is_completed=False,
            is_ai_recommended=True,
            source_attempt_id=int(req.attempt_id) if req.attempt_id is not None and str(req.attempt_id).isdigit() else None
        )
        session.add(new_task)
        created_task_ids.append(str(new_task.id))
        existing_titles.add(full_title)
        
    await session.commit()
    await _drop_cached_schedule(current_user.id)
    return {
        "status": "SUCCESS",
        "scheduled_tasks_count": len(created_task_ids),
        "task_ids": created_task_ids,
        "message": f"Successfully scheduled {len(created_task_ids)} tasks into your study plan."
    }

@router.get("/tasks/attempt/{attempt_id}/status")
async def get_attempt_tasks_status(
    attempt_id: int | str,
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
                "subject": t.subject,
                "priority": t.priority,
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

class GenerateWeeklyPlanRequest(SQLModel):
    start_date: Optional[str] = None
    overwrite_existing: Optional[bool] = False


class GenerateMonthlyPlanRequest(SQLModel):
    month: Optional[str] = None  # YYYY-MM; this month when left out


def _today_ist() -> date:
    from app.services.free_plan import IST
    return datetime.now(timezone.utc).astimezone(IST).date()


def _month_range(month: Optional[str], today: date) -> tuple[date, date]:
    if month:
        try:
            first = datetime.strptime(month, "%Y-%m").date()
        except ValueError:
            raise HTTPException(status_code=422, detail="month must be YYYY-MM")
    else:
        first = today.replace(day=1)
    following = (first.replace(day=28) + timedelta(days=4)).replace(day=1)
    return first, following - timedelta(days=1)


async def _write_generated_plan(session: AsyncSession, user_id: int, start: date, end: date,
                                carry_to: date, monthly: bool) -> int:
    """Replaces the student's open generated tasks in [start, end] with a fresh data-driven plan.

    Tasks the student added themselves and anything already completed are kept. Unfinished tasks
    from before `start` move to `carry_to`. Returns how many tasks were created.
    """
    from app.services.study_plan_generator import build_plan

    await session.exec(delete(StudyTask).where(
        StudyTask.user_id == user_id,
        StudyTask.scheduled_date >= start,
        StudyTask.scheduled_date <= end,
        StudyTask.is_ai_recommended == True,
        StudyTask.is_completed == False,
    ))
    for past_t in (await session.exec(select(StudyTask).where(
        StudyTask.user_id == user_id, StudyTask.scheduled_date < start, StudyTask.is_completed == False
    ))).all():
        past_t.scheduled_date = carry_to
        session.add(past_t)
    await session.commit()

    existing_keys = {(title, str(d)) for title, d in (await session.exec(
        select(StudyTask.title, StudyTask.scheduled_date).where(
            StudyTask.user_id == user_id, StudyTask.scheduled_date >= start, StudyTask.scheduled_date <= end
        )
    )).all()}
    created = 0
    for t in await build_plan(session, user_id, start, end, today=_today_ist(), monthly=monthly):
        key = (t["title"], str(t["scheduled_date"]))
        if key in existing_keys:
            continue
        existing_keys.add(key)
        session.add(StudyTask(user_id=user_id, is_completed=False, is_ai_recommended=True, **t))
        created += 1
    await session.commit()
    await _drop_cached_schedule(user_id)
    return created


@router.post("/generate-weekly-plan")
async def generate_weekly_study_plan(
    req: Optional[GenerateWeeklyPlanRequest] = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """A week built from the student's own data: due revision, weak subtopics, new subtopics, a test day."""
    today = datetime.now(timezone.utc).date()
    start_date_str = req.start_date if req else None
    if start_date_str:
        try:
            base_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        except ValueError:
            base_date = today - timedelta(days=today.weekday())
    else:
        base_date = today - timedelta(days=today.weekday())

    end_date = base_date + timedelta(days=6)
    created = await _write_generated_plan(session, current_user.id, base_date, end_date, base_date, monthly=False)
    return {
        "message": f"Generated your week from your own results: {created} tasks.",
        "task_count": created,
        "start_date": str(base_date),
        "end_date": str(end_date),
        "generated": True
    }


@router.post("/generate-monthly-plan")
async def generate_monthly_study_plan(
    req: Optional[GenerateMonthlyPlanRequest] = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """The same plan for a whole calendar month; its last week is for revision and full papers."""
    today = _today_ist()
    first, last = _month_range(req.month if req else None, today)
    if last < today:
        raise HTTPException(status_code=422, detail="That month is already over")
    created = await _write_generated_plan(session, current_user.id, first, last, max(first, today), monthly=True)
    return {
        "message": f"Generated your month from your own results: {created} tasks.",
        "task_count": created,
        "start_date": str(first),
        "end_date": str(last),
        "generated": True
    }


@router.get("/monthly-schedule")
async def get_monthly_schedule(
    month: Optional[str] = Query(None, description="YYYY-MM; this month when left out"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """Tasks for every day of a calendar month, for the planner's Month view."""
    today = _today_ist()
    first, last = _month_range(month, today)
    tasks = (await session.exec(select(StudyTask).where(
        StudyTask.user_id == current_user.id, StudyTask.scheduled_date >= first, StudyTask.scheduled_date <= last
    ).order_by(StudyTask.scheduled_date, StudyTask.id))).all()
    by_day: dict = {}
    for t in tasks:
        by_day.setdefault(str(t.scheduled_date), []).append(t)
    days = []
    d = first
    while d <= last:
        day_tasks = by_day.get(str(d), [])
        days.append({
            "date": str(d),
            "is_today": d == today,
            "allocated_minutes": sum(t.allocated_time_minutes or 30 for t in day_tasks),
            "completed_tasks_count": sum(1 for t in day_tasks if t.is_completed),
            "total_tasks_count": len(day_tasks),
            "tasks": [
                {
                    "id": str(t.id),
                    "title": t.title,
                    "description": t.description,
                    "subject": t.subject,
                    "topic": t.topic,
                    "priority": t.priority or "MEDIUM",
                    "allocated_time_minutes": t.allocated_time_minutes or 30,
                    "activity_type": t.activity_type or "CONCEPT_REVISION",
                    "is_completed": t.is_completed,
                    "is_ai_recommended": t.is_ai_recommended,
                }
                for t in day_tasks
            ],
        })
        d += timedelta(days=1)
    return {"month": first.strftime("%Y-%m"), "start_date": str(first), "end_date": str(last), "days": days}

# ==================== WEEKLY SCHEDULE ENDPOINT ====================

@router.get("/weekly-schedule")
async def get_weekly_schedule(
    start_date: Optional[str] = Query(None, description="Start date of week YYYY-MM-DD"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    today = datetime.now(timezone.utc).date()
    if start_date:
        try:
            base_date = datetime.strptime(start_date, "%Y-%m-%d").date()
        except ValueError:
            base_date = today - timedelta(days=today.weekday())
    else:
        base_date = today - timedelta(days=today.weekday())  # Monday of current week

    end_date = base_date + timedelta(days=6)  # Sunday
    
    from app.cache import get_cache, build_cache_key
    cache = get_cache()
    cache_key = build_cache_key("studyplan:weekly_schedule", f"{current_user.id}:{base_date}")

    cached_val = await cache.get(cache_key)
    if cached_val is not None:
        return cached_val

    # Run tasks, activities, and exam attempts queries concurrently
    start_dt = datetime.combine(base_date, datetime.min.time(), tzinfo=timezone.utc)
    end_dt = datetime.combine(end_date, datetime.max.time(), tzinfo=timezone.utc)

    async def get_tasks():
        async with async_session_factory() as s:
            stmt = select(StudyTask).where(
                StudyTask.user_id == current_user.id,
                StudyTask.scheduled_date >= base_date,
                StudyTask.scheduled_date <= end_date
            )
            return (await s.exec(stmt)).all()

    async def get_activities():
        async with async_session_factory() as s:
            stmt = select(StudyActivity).where(
                StudyActivity.user_id == current_user.id,
                StudyActivity.date >= base_date,
                StudyActivity.date <= end_date
            )
            return (await s.exec(stmt)).all()

    async def get_attempts():
        async with async_session_factory() as s:
            stmt = select(ExamAttempt).where(
                ExamAttempt.user_id == current_user.id,
                ExamAttempt.started_at >= start_dt,
                ExamAttempt.started_at <= end_dt
            )
            return (await s.exec(stmt)).all()

    tasks, activities, attempts = await asyncio.gather(get_tasks(), get_activities(), get_attempts())

    # Group by date
    days_data = []
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    for i in range(7):
        current_day_date = base_date + timedelta(days=i)
        date_str = str(current_day_date)
        day_name = day_names[i]

        raw_day_tasks = [t for t in tasks if str(t.scheduled_date) == date_str]
        seen_titles = set()
        day_tasks = []
        for t in raw_day_tasks:
            title_key = (t.title or "").strip().lower()
            if title_key in seen_titles:
                continue
            seen_titles.add(title_key)
            day_tasks.append(t)
        day_activities = [a for a in activities if str(a.date) == date_str]
        day_attempts = [
            att for att in attempts
            if (att.started_at.date() if hasattr(att.started_at, 'date') else str(att.started_at)[:10]) == date_str
        ]

        allocated_mins = sum(t.allocated_time_minutes or 30 for t in day_tasks)
        activity_mins = sum(a.duration_minutes or 0 for a in day_activities)
        attempt_mins = sum(round((att.time_spent_seconds or 0) / 60) for att in day_attempts)
        logged_mins = activity_mins + attempt_mins
        completed_tasks = sum(1 for t in day_tasks if t.is_completed)

        days_data.append({
            "date": date_str,
            "day_name": day_name,
            "is_today": current_day_date == today,
            "allocated_minutes": allocated_mins,
            "logged_minutes": logged_mins,
            "completed_tasks_count": completed_tasks,
            "total_tasks_count": len(day_tasks),
            "tasks": [
                {
                    "id": str(t.id),
                    "title": t.title,
                    "description": t.description,
                    "subject": t.subject,
                    "topic": t.topic,
                    "priority": t.priority or "MEDIUM",
                    "allocated_time_minutes": t.allocated_time_minutes or 30,
                    "activity_type": t.activity_type or "CONCEPT_REVISION",
                    "is_completed": t.is_completed,
                    "is_ai_recommended": t.is_ai_recommended
                }
                for t in day_tasks
            ],
            "activities": [
                {
                    "id": str(a.id),
                    "subject": a.subject,
                    "topic": a.topic,
                    "duration_minutes": a.duration_minutes,
                    "questions_attempted": a.questions_attempted,
                    "confidence_rating": a.confidence_rating
                }
                for a in day_activities
            ]
        })

    result = {
        "start_date": str(base_date),
        "end_date": str(end_date),
        "days": days_data
    }
    await cache.set(cache_key, result, ttl_seconds=300)
    return result


# ==================== WEEKLY INSIGHTS EXECUTIVE REPORT ====================

@router.get("/weekly-insights")
async def get_weekly_insights(
    response: Response,
    start_date: Optional[str] = Query(None, description="Start date of week YYYY-MM-DD"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """Generates dynamic weekly executive summary report, performance highlights, and focus recommendations."""
    today = datetime.now(timezone.utc).date()
    if start_date:
        try:
            base_date = datetime.strptime(start_date, "%Y-%m-%d").date()
        except ValueError:
            base_date = today - timedelta(days=today.weekday())
    else:
        base_date = today - timedelta(days=today.weekday())  # Monday of current week

    from app.cache import get_cache, build_cache_key
    cache = get_cache()
    cache_key = build_cache_key("studyplan:weekly_insights", f"{current_user.id}:{base_date}")

    cached_val = await cache.get(cache_key)
    if cached_val is not None:
        return cached_val

    end_date = base_date + timedelta(days=6)  # Sunday
    start_dt = datetime.combine(base_date, datetime.min.time(), tzinfo=timezone.utc)
    end_dt = datetime.combine(end_date, datetime.max.time(), tzinfo=timezone.utc)

    # Run all 3 queries concurrently
    async def get_tasks():
        async with async_session_factory() as s:
            stmt = select(StudyTask).where(
                StudyTask.user_id == current_user.id,
                StudyTask.scheduled_date >= base_date,
                StudyTask.scheduled_date <= end_date
            )
            return (await s.exec(stmt)).all()

    async def get_activities():
        async with async_session_factory() as s:
            stmt = select(StudyActivity).where(
                StudyActivity.user_id == current_user.id,
                StudyActivity.date >= base_date,
                StudyActivity.date <= end_date
            )
            return (await s.exec(stmt)).all()

    async def get_attempts():
        async with async_session_factory() as s:
            stmt = select(ExamAttempt).where(
                ExamAttempt.user_id == current_user.id,
                ExamAttempt.started_at >= start_dt,
                ExamAttempt.started_at <= end_dt
            )
            return (await s.exec(stmt)).all()

    tasks, activities, attempts = await asyncio.gather(get_tasks(), get_activities(), get_attempts())

    total_tasks = len(tasks)
    completed_tasks = sum(1 for t in tasks if t.is_completed)
    completion_rate = round((completed_tasks / total_tasks * 100)) if total_tasks > 0 else 0

    # 2. Aggregate Study Activities (duration & questions via SQL)
    stmt_activities = select(
        func.coalesce(func.sum(col(StudyActivity.duration_minutes)), 0),
        func.coalesce(func.sum(col(StudyActivity.questions_attempted)), 0),
        func.coalesce(func.sum(col(StudyActivity.questions_correct)), 0)
    ).where(
        col(StudyActivity.user_id) == current_user.id,
        col(StudyActivity.date) >= base_date,
        col(StudyActivity.date) <= end_date
    )
    act_res = (await session.exec(stmt_activities)).first()
    logged_minutes = int(act_res[0]) if act_res and act_res[0] is not None else 0
    logged_hours = round(logged_minutes / 60, 1)
    questions_from_logs = int(act_res[1]) if act_res and act_res[1] is not None else 0
    correct_from_logs = int(act_res[2]) if act_res and act_res[2] is not None else 0

    # 3. Active dates from activities and exam attempts
    stmt_act_dates = select(col(StudyActivity.date)).where(
        col(StudyActivity.user_id) == current_user.id,
        col(StudyActivity.date) >= base_date,
        col(StudyActivity.date) <= end_date
    ).distinct()
    act_dates = {str(d) for d in (await session.exec(stmt_act_dates)).all() if d}

    # 4. Aggregate Exam Attempts (questions & correct via SQL)
    stmt_attempts = select(
        func.coalesce(func.sum(col(ExamAttempt.total_correct)), 0),
        func.coalesce(func.sum(col(ExamAttempt.total_correct) + func.coalesce(col(ExamAttempt.total_incorrect), 0)), 0)
    ).where(
        col(ExamAttempt.user_id) == current_user.id,
        col(ExamAttempt.started_at) >= start_dt,
        col(ExamAttempt.started_at) <= end_dt
    )
    att_res = (await session.exec(stmt_attempts)).first()
    exam_correct = int(att_res[0]) if att_res and att_res[0] is not None else 0
    exam_questions = int(att_res[1]) if att_res and att_res[1] is not None else 0

    # Distinct attempt dates
    stmt_att_dates = select(cast(col(ExamAttempt.started_at), Date)).where(
        col(ExamAttempt.user_id) == current_user.id,
        col(ExamAttempt.started_at) >= start_dt,
        col(ExamAttempt.started_at) <= end_dt
    ).distinct()
    att_dates = {str(d) for d in (await session.exec(stmt_att_dates)).all() if d}

    active_days_set = act_dates.union(att_dates)

    total_questions = questions_from_logs + exam_questions
    total_correct = correct_from_logs + exam_correct
    avg_accuracy = round((total_correct / total_questions * 100)) if total_questions > 0 else None

    # 5. Top Subject Determination via SQL GROUP BY
    stmt_act_subj = select(
        col(StudyActivity.subject),
        func.coalesce(func.sum(col(StudyActivity.duration_minutes)), 0)
    ).where(
        col(StudyActivity.user_id) == current_user.id,
        col(StudyActivity.date) >= base_date,
        col(StudyActivity.date) <= end_date
    ).group_by(col(StudyActivity.subject))
    act_subjects = (await session.exec(stmt_act_subj)).all()

    stmt_task_subj = select(
        col(StudyTask.subject),
        func.coalesce(func.sum(col(StudyTask.allocated_time_minutes)), 0)
    ).where(
        col(StudyTask.user_id) == current_user.id,
        col(StudyTask.scheduled_date) >= base_date,
        col(StudyTask.scheduled_date) <= end_date
    ).group_by(col(StudyTask.subject))
    task_subjects = (await session.exec(stmt_task_subj)).all()

    subject_duration_map = {}
    for subj, duration in act_subjects:
        s_name = subj or "General Studies"
        subject_duration_map[s_name] = subject_duration_map.get(s_name, 0) + (int(duration) if duration else 0)
    for subj, duration in task_subjects:
        s_name = subj or "General Studies"
        subject_duration_map[s_name] = subject_duration_map.get(s_name, 0) + (int(duration) if duration else 0)

    top_subject = max(subject_duration_map.items(), key=lambda x: x[1])[0] if subject_duration_map else None

    # 6. Build Dynamic Highlights List
    highlights = []
    if total_questions > 0:
        highlights.append(f"Completed {total_questions} practice questions with {avg_accuracy}% average accuracy.")
    if logged_hours > 0:
        highlights.append(f"Logged {logged_hours} hours of focused study.")

    active_days = len(active_days_set)
    if active_days > 0:
        highlights.append(f"Studied on {active_days} of 7 days this week.")

    if total_tasks > 0:
        highlights.append(f"Achieved {completion_rate}% weekly target completion rate ({completed_tasks}/{total_tasks} finished).")
    elif top_subject:
        highlights.append(f"Most of your study time went to {top_subject}.")

    if not highlights:
        highlights.append("No study activity recorded this week yet.")

    # 7. Incomplete Subjects for Focus Next Week (SQL distinct)
    stmt_incomplete_subj = select(col(StudyTask.subject)).where(
        col(StudyTask.user_id) == current_user.id,
        col(StudyTask.scheduled_date) >= base_date,
        col(StudyTask.scheduled_date) <= end_date,
        col(StudyTask.is_completed) == False,
        col(StudyTask.subject).isnot(None)
    ).distinct().limit(3)
    incomplete_subjects = [s for s in (await session.exec(stmt_incomplete_subj)).all() if s]

    focus_next_week = []
    focus_subject = incomplete_subjects[0] if incomplete_subjects else top_subject
    if incomplete_subjects:
        focus_next_week.append(f"Finish the pending {incomplete_subjects[0]} targets from this week.")
    if focus_subject:
        focus_next_week.append(f"Solve 20-30 PYQs on {focus_subject} to check concept clarity.")
    elif total_questions > 0:
        focus_next_week.append("Review the questions you got wrong this week and their explanations.")
    else:
        focus_next_week.append("Take a practice test to find the subjects to focus on.")
    focus_next_week.append("Attempt a full-length paper under timed conditions to practise pacing.")

    # Format date strings for header (e.g. "Aug 24 - Aug 30, 2026")
    date_range_str = f"{base_date.strftime('%b %d')} - {end_date.strftime('%b %d, %Y')}"

    # Cache control: weekly report is static intra-session
    response.headers["Cache-Control"] = "private, max-age=120, stale-while-revalidate=300"

    result = {
        "start_date": str(base_date),
        "end_date": str(end_date),
        "date_range_formatted": date_range_str,
        "total_logged_hours": logged_hours,
        "total_questions_solved": total_questions,
        "avg_accuracy": avg_accuracy,
        "completion_rate": completion_rate,
        "completed_tasks": completed_tasks,
        "total_tasks": total_tasks,
        "active_days_count": len(active_days_set),
        "top_subject": top_subject,
        "highlights": highlights,
        "focus_next_week": focus_next_week
    }
    
    from app.cache import get_cache, build_cache_key
    cache = get_cache()
    cache_key = build_cache_key("studyplan:weekly_insights", f"{current_user.id}:{base_date}")
    await cache.set(cache_key, result, ttl_seconds=300)
    return result


# ==================== STUDY LOGGING (ACTIVITIES) ENDPOINTS ====================

class LogActivityRequest(SQLModel):
    subject: str
    topic: Optional[str] = None
    duration_minutes: int
    activity_type: Optional[str] = "REVISION"
    questions_attempted: Optional[int] = None
    questions_correct: Optional[int] = None
    confidence_rating: Optional[int] = None  # 1 to 5
    notes: Optional[str] = None
    activity_date: Optional[str] = None

# Study-task style names (used by the planner and older clients) -> StudyActivityType members.
_LEGACY_ACTIVITY_TYPES = {
    "CONCEPT_REVISION": StudyActivityType.REVISION,
    "NOTES_REVIEW": StudyActivityType.REVISION,
    "PRACTICE_MCQS": StudyActivityType.PYQ,
    "PYQ_SOLVING": StudyActivityType.PYQ,
    "TARGETED_MCQ_PRACTICE": StudyActivityType.PYQ,
    "MOCK": StudyActivityType.MOCK_TEST,
}


def resolve_activity_type(raw: Optional[str]) -> StudyActivityType:
    """Maps a client-supplied activity type onto the enum; unknown values become OTHER, missing ones REVISION."""
    if not raw:
        return StudyActivityType.REVISION
    key = raw.strip().upper().replace(" ", "_")
    try:
        return StudyActivityType(key)
    except ValueError:
        return _LEGACY_ACTIVITY_TYPES.get(key, StudyActivityType.OTHER)


@router.post("/activities")
async def log_study_activity(
    req: LogActivityRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    log_date = datetime.now(timezone.utc).date()
    if req.activity_date:
        try:
            log_date = datetime.strptime(req.activity_date, "%Y-%m-%d").date()
        except ValueError:
            pass

    act_type_enum = resolve_activity_type(req.activity_type)

    new_activity = StudyActivity(
        user_id=current_user.id,
        date=log_date,
        activity_type=act_type_enum,
        activity_source=ActivitySource.UNPLANNED,
        subject=req.subject,
        topic=req.topic,
        duration_minutes=max(1, req.duration_minutes),
        questions_attempted=req.questions_attempted,
        questions_correct=req.questions_correct,
        confidence_rating=req.confidence_rating,
        notes=req.notes
    )
    session.add(new_activity)
    await session.commit()
    # Everything derived from activities (today's log, weekly views, streak stats) is now stale.
    try:
        from app.cache import invalidate_study_activity_cache
        await invalidate_study_activity_cache(current_user.id)
    except Exception:
        pass

    # Trigger Gamification Updates
    # The session is already saved; a gamification problem must not make the log look like it failed.
    try:
        gamification_service = GamificationService(session)
        gamification_result = await gamification_service.check_and_update_daily_goal(current_user.id)
    except Exception as exc:
        logger.warning("Daily-goal update failed after logging study activity for user %s: %s", current_user.id, exc)
        gamification_result = {"daily_goal_met": False, "message": "Study session saved."}

    return {
        "message": "Study session logged successfully!",
        "activity_id": str(new_activity.id),
        "duration_minutes": new_activity.duration_minutes,
        "gamification": gamification_result
    }

@router.get("/activities")
async def list_study_activities(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    stmt = select(StudyActivity).where(StudyActivity.user_id == current_user.id).order_by(col(StudyActivity.date).desc(), col(StudyActivity.created_at).desc())
    activities = (await session.exec(stmt)).all()
    return JSONResponse(content=jsonable_encoder([
        {
            "id": str(a.id),
            "date": str(a.date),
            "subject": a.subject,
            "topic": a.topic,
            "activity_type": a.activity_type.value if hasattr(a.activity_type, "value") else str(a.activity_type),
            "duration_minutes": a.duration_minutes,
            "questions_attempted": a.questions_attempted,
            "questions_correct": a.questions_correct,
            "confidence_rating": a.confidence_rating,
            "notes": a.notes,
            "created_at": a.created_at.isoformat() if a.created_at else None
        }
        for a in activities
    ]))

@router.delete("/activities/{activity_id}")
async def delete_study_activity(
    activity_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    activity = await session.get(StudyActivity, activity_id)
    if not activity or activity.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Study activity record not found")
    await session.delete(activity)
    await session.commit()
    await _drop_cached_schedule(current_user.id)
    return {"message": "Study activity deleted successfully"}

@router.get("/activities/summary")
async def get_study_activities_summary(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    stmt = select(StudyActivity).where(StudyActivity.user_id == current_user.id)
    activities = (await session.exec(stmt)).all()

    total_minutes = sum(a.duration_minutes or 0 for a in activities)
    total_qs_attempted = sum(a.questions_attempted or 0 for a in activities)
    total_qs_correct = sum(a.questions_correct or 0 for a in activities)

    subject_breakdown = {}
    for a in activities:
        subj = a.subject or "General Studies"
        subject_breakdown[subj] = subject_breakdown.get(subj, 0) + (a.duration_minutes or 0)

    return {
        "total_logged_hours": round(total_minutes / 60.0, 1),
        "total_logged_minutes": total_minutes,
        "total_questions_attempted": total_qs_attempted,
        "total_questions_correct": total_qs_correct,
        "subject_breakdown": subject_breakdown
    }

# ==================== BADGES ENDPOINT ====================

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

    stmt_all = select(Badge)
    badges = (await session.exec(stmt_all)).all()
    
    stmt_user = select(UserBadge).where(UserBadge.user_id == current_user.id)
    user_badges = (await session.exec(stmt_user)).all()
    unlocked_at = {ub.badge_id: ub.unlocked_at for ub in user_badges}

    # Milestones carry the student's progress toward them; switched-off ones show only if already earned
    from app.services import milestone_service
    counts = await milestone_service.progress(session, current_user.id) if any(b.criteria_type for b in badges) else {}

    unlocked = []
    locked = []
    
    for badge in badges:
        is_unlocked = badge.id in unlocked_at
        if badge.criteria_type and not badge.is_active and not is_unlocked:
            continue
        badge_data = {
            "id": str(badge.id),
            "name": badge.name,
            "description": badge.description,
            "icon_url": badge.icon_url,
            "required_xp": badge.required_xp,
        }
        if badge.criteria_type:
            badge_data["milestone"] = {
                "criteria_type": badge.criteria_type,
                "criteria_label": milestone_service.CRITERIA.get(badge.criteria_type, badge.criteria_type),
                "threshold": badge.threshold,
                "progress": min(counts.get(badge.criteria_type, 0), badge.threshold or 0),
                "xp_reward": badge.xp_reward,
            }
        if is_unlocked:
            badge_data["unlocked_at"] = unlocked_at[badge.id]
            unlocked.append(badge_data)
        else:
            locked.append(badge_data)
            
    res_dict = {
        "unlocked": unlocked,
        "locked": locked
    }
    await cache.set(cache_key, res_dict, ttl_seconds=1800)
    return JSONResponse(content=jsonable_encoder(res_dict))


@router.post("/send-pending-email")
async def send_pending_tasks_email(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """Checks today's & recent 14 days pending tasks for the user and sends a daily summary email."""
    today = datetime.now(timezone.utc).date()
    cutoff_date = today - timedelta(days=14)
    stmt = select(StudyTask).where(
        StudyTask.user_id == current_user.id,
        StudyTask.scheduled_date >= cutoff_date,
        StudyTask.scheduled_date <= today,
        StudyTask.is_completed == False
    )
    pending_tasks = (await session.exec(stmt)).all()

    if not pending_tasks:
        return {"message": "No pending tasks for today. Great job!", "pending_count": 0}

    tasks_data = [
        {
            "title": t.title,
            "subject": t.subject or "General",
            "allocated_time_minutes": t.allocated_time_minutes or 30
        }
        for t in pending_tasks
    ]

    user_name = getattr(current_user, 'full_name', None) or current_user.email.split('@')[0]
    sent = await send_pending_tasks_summary_email(
        email=current_user.email,
        user_name=user_name,
        pending_tasks=tasks_data
    )

    if not sent:
        return JSONResponse(
            status_code=400,
            content={
                "message": f"SMTP mail dispatch failed for {current_user.email}. Check MAIL_USERNAME and MAIL_PASSWORD in backend settings.",
                "pending_count": len(pending_tasks),
                "email_sent": False
            }
        )

    return {
        "message": f"Pending tasks email sent to {current_user.email} with {len(pending_tasks)} task(s).",
        "pending_count": len(pending_tasks),
        "email_sent": True
    }


@router.post("/trigger-daily-digests")
async def trigger_daily_digests_for_all_users(
    _admin: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    """Admin / Background Trigger: Scans all users and dispatches pending task email digests for tasks in the last 14 days up to today."""
    from app.services.daily_scheduler_service import run_daily_midnight_dispatch
    res = await run_daily_midnight_dispatch(force=True)
    return res


@router.post("/trigger-midnight-translation")
async def trigger_midnight_translation(
    _admin: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    """Admin Trigger: Runs the midnight batch translation job immediately (for testing/manual force-run).
    Translates all un-translated question stems + options into Hindi and Marathi.
    Cache deduplication is bypassed when called directly."""
    from app.services.daily_scheduler_service import run_midnight_translation_job
    res = await run_midnight_translation_job()
    return res
