import uuid
import datetime as dt_mod
from datetime import datetime, timezone, timedelta, date
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from sqlmodel import select, col, SQLModel, func
from sqlalchemy import case, cast, Date
from sqlmodel.ext.asyncio.session import AsyncSession
import asyncio

from app.db.session import get_async_session, async_session_factory
from app.db.models.user import User
from app.db.models.study_plan import StudyTask, StudyActivity
from app.db.models.enums import StudyActivityType, ActivitySource
from app.db.models.analytics import ExamAttempt
from app.db.models.gamification import Badge, UserBadge
from app.core.deps import get_current_user
from app.services.gamification_service import GamificationService
from app.services.email_service import send_pending_tasks_summary_email

router = APIRouter(prefix="/study-plan", tags=["Study Plan & Gamification"])

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

@router.post("/generate-weekly-plan")
async def generate_weekly_study_plan(
    req: Optional[GenerateWeeklyPlanRequest] = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
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

    # Clear ONLY AI-generated template tasks for the current week, keeping user custom tasks (is_ai_recommended == False)
    stmt_existing = select(StudyTask).where(
        StudyTask.user_id == current_user.id,
        StudyTask.scheduled_date >= base_date,
        StudyTask.scheduled_date <= end_date,
        StudyTask.is_ai_recommended == True
    )
    existing_tasks = (await session.exec(stmt_existing)).all()

    for t in existing_tasks:
        await session.delete(t)
    await session.commit()

    # Carry forward any incomplete tasks from past weeks to the current week (Monday)
    stmt_past_incomplete = select(StudyTask).where(
        StudyTask.user_id == current_user.id,
        StudyTask.scheduled_date < base_date,
        StudyTask.is_completed == False
    )
    past_incomplete_tasks = (await session.exec(stmt_past_incomplete)).all()
    for past_t in past_incomplete_tasks:
        past_t.scheduled_date = base_date  # Reschedule to current week Monday
        session.add(past_t)
    await session.commit()

    template_schedule = [
        # Monday (Day 0 - Polity Focus)
        [
            {"title": "Polity: Preamble & Key Features of Constitution", "subject": "Indian Polity & Governance", "topic": "Preamble & Key Features", "allocated_time_minutes": 30, "priority": "HIGH", "activity_type": "NEW_TOPIC"},
            {"title": "Polity: Fundamental Rights (Articles 12 to 22)", "subject": "Indian Polity & Governance", "topic": "Fundamental Rights Part 1", "allocated_time_minutes": 45, "priority": "HIGH", "activity_type": "NEW_TOPIC"},
            {"title": "Polity: Directive Principles (DPSP) & Duties", "subject": "Indian Polity & Governance", "topic": "DPSP & Fundamental Duties", "allocated_time_minutes": 30, "priority": "HIGH", "activity_type": "NEW_TOPIC"},
            {"title": "Polity Revision: Emergency Provisions & Schedules", "subject": "Indian Polity & Governance", "topic": "Emergency & Schedules", "allocated_time_minutes": 30, "priority": "MEDIUM", "activity_type": "CONCEPT_REVISION"},
            {"title": "Polity Revision: Constitutional Bodies & CAG", "subject": "Indian Polity & Governance", "topic": "CAG, Election Commission", "allocated_time_minutes": 30, "priority": "MEDIUM", "activity_type": "CONCEPT_REVISION"},
            {"title": "Polity Revision: Amendments & Basic Structure", "subject": "Indian Polity & Governance", "topic": "Basic Structure Doctrine", "allocated_time_minutes": 30, "priority": "MEDIUM", "activity_type": "CONCEPT_REVISION"},
            {"title": "Polity Quiz 1: Preamble & Fundamental Rights MCQs", "subject": "Indian Polity & Governance", "topic": "Preamble MCQs", "allocated_time_minutes": 30, "priority": "HIGH", "activity_type": "PRACTICE_MCQS"},
            {"title": "Polity Quiz 2: DPSP & Union Executive MCQs", "subject": "Indian Polity & Governance", "topic": "DPSP Quiz", "allocated_time_minutes": 30, "priority": "HIGH", "activity_type": "PRACTICE_MCQS"},
            {"title": "Polity PYQs: UPSC Past Years Question Practice", "subject": "Indian Polity & Governance", "topic": "UPSC Polity PYQs", "allocated_time_minutes": 30, "priority": "HIGH", "activity_type": "PYQ_SOLVING"}
        ],
        # Tuesday (Day 1 - Modern History Focus)
        [
            {"title": "History: 1857 Revolt & Causes of Uprising", "subject": "Modern Indian History", "topic": "1857 Revolt", "allocated_time_minutes": 30, "priority": "HIGH", "activity_type": "NEW_TOPIC"},
            {"title": "History: Socio-Religious Reform Movements", "subject": "Modern Indian History", "topic": "19th Century Reformers", "allocated_time_minutes": 45, "priority": "HIGH", "activity_type": "NEW_TOPIC"},
            {"title": "History: Early Congress & Moderate Phase", "subject": "Modern Indian History", "topic": "INC Formation & Moderates", "allocated_time_minutes": 30, "priority": "HIGH", "activity_type": "NEW_TOPIC"},
            {"title": "History Revision: Governor Generals & Viceroys", "subject": "Modern Indian History", "topic": "Viceroys & Reforms", "allocated_time_minutes": 30, "priority": "MEDIUM", "activity_type": "CONCEPT_REVISION"},
            {"title": "History Revision: Peasant & Tribal Movements", "subject": "Modern Indian History", "topic": "Tribal Uprisings", "allocated_time_minutes": 30, "priority": "MEDIUM", "activity_type": "CONCEPT_REVISION"},
            {"title": "History Revision: Colonial Press & Education Acts", "subject": "Modern Indian History", "topic": "Press & Education Acts", "allocated_time_minutes": 30, "priority": "MEDIUM", "activity_type": "CONCEPT_REVISION"},
            {"title": "History Quiz 1: 1857 Revolt & Reformers MCQs", "subject": "Modern Indian History", "topic": "1857 & Reform MCQs", "allocated_time_minutes": 30, "priority": "HIGH", "activity_type": "PRACTICE_MCQS"},
            {"title": "History Quiz 2: Freedom Movement Chronology Quiz", "subject": "Modern Indian History", "topic": "Chronology Quiz", "allocated_time_minutes": 30, "priority": "HIGH", "activity_type": "PRACTICE_MCQS"},
            {"title": "History PYQs: UPSC Past Years History Questions", "subject": "Modern Indian History", "topic": "Modern History PYQs", "allocated_time_minutes": 30, "priority": "HIGH", "activity_type": "PYQ_SOLVING"}
        ],
        # Wednesday (Day 2 - Indian Economy Focus)
        [
            {"title": "Economy: GDP, GNP & National Income Accounting", "subject": "Indian Economy", "topic": "National Income", "allocated_time_minutes": 30, "priority": "HIGH", "activity_type": "NEW_TOPIC"},
            {"title": "Economy: RBI Monetary Policy & Inflation Tools", "subject": "Indian Economy", "topic": "Monetary Policy & Inflation", "allocated_time_minutes": 45, "priority": "HIGH", "activity_type": "NEW_TOPIC"},
            {"title": "Economy: Banking System, NPA & IBC Code", "subject": "Indian Economy", "topic": "Banking & NPA", "allocated_time_minutes": 30, "priority": "HIGH", "activity_type": "NEW_TOPIC"},
            {"title": "Economy Revision: Union Budget & Fiscal Deficit", "subject": "Indian Economy", "topic": "Fiscal Deficit & Budget", "allocated_time_minutes": 30, "priority": "MEDIUM", "activity_type": "CONCEPT_REVISION"},
            {"title": "Economy Revision: Balance of Payments & Forex Reserves", "subject": "Indian Economy", "topic": "BoP & Forex", "allocated_time_minutes": 30, "priority": "MEDIUM", "activity_type": "CONCEPT_REVISION"},
            {"title": "Economy Revision: Tax Structure & GST Mechanisms", "subject": "Indian Economy", "topic": "GST & Direct Tax", "allocated_time_minutes": 30, "priority": "MEDIUM", "activity_type": "CONCEPT_REVISION"},
            {"title": "Economy Quiz 1: Monetary Policy & Inflation MCQs", "subject": "Indian Economy", "topic": "Inflation MCQs", "allocated_time_minutes": 30, "priority": "HIGH", "activity_type": "PRACTICE_MCQS"},
            {"title": "Economy Quiz 2: Banking & Financial Markets Quiz", "subject": "Indian Economy", "topic": "Financial Markets", "allocated_time_minutes": 30, "priority": "HIGH", "activity_type": "PRACTICE_MCQS"},
            {"title": "Economy PYQs: UPSC Past 10 Years Economy Questions", "subject": "Indian Economy", "topic": "Economy PYQs", "allocated_time_minutes": 30, "priority": "HIGH", "activity_type": "PYQ_SOLVING"}
        ],
        # Thursday (Day 3 - Geography & Environment Focus)
        [
            {"title": "Geography: Indian Drainage Systems & Major Rivers", "subject": "Geography & Environment", "topic": "Indian River Systems", "allocated_time_minutes": 30, "priority": "HIGH", "activity_type": "NEW_TOPIC"},
            {"title": "Geography: Monsoon System & Climate Zones of India", "subject": "Geography & Environment", "topic": "Monsoon & Climate", "allocated_time_minutes": 45, "priority": "HIGH", "activity_type": "NEW_TOPIC"},
            {"title": "Environment: Biodiversity Hotspots & National Parks", "subject": "Geography & Environment", "topic": "Biodiversity & Sanctuaries", "allocated_time_minutes": 30, "priority": "HIGH", "activity_type": "NEW_TOPIC"},
            {"title": "Geography Revision: Mountain Passes & Physical Features", "subject": "Geography & Environment", "topic": "Passes & Relief", "allocated_time_minutes": 30, "priority": "MEDIUM", "activity_type": "CONCEPT_REVISION"},
            {"title": "Environment Revision: Wildlife Protection Act & Ramsar Sites", "subject": "Geography & Environment", "topic": "WPA & Wetlands", "allocated_time_minutes": 30, "priority": "MEDIUM", "activity_type": "CONCEPT_REVISION"},
            {"title": "Environment Revision: Climate Conventions (COP, UNFCCC)", "subject": "Geography & Environment", "topic": "UNFCCC & COP", "allocated_time_minutes": 30, "priority": "MEDIUM", "activity_type": "CONCEPT_REVISION"},
            {"title": "Geography Quiz 1: River Map Location MCQs", "subject": "Geography & Environment", "topic": "River Map Quiz", "allocated_time_minutes": 30, "priority": "HIGH", "activity_type": "PRACTICE_MCQS"},
            {"title": "Environment Quiz 2: Species Status & Protected Areas", "subject": "Geography & Environment", "topic": "IUCN Status Quiz", "allocated_time_minutes": 30, "priority": "HIGH", "activity_type": "PRACTICE_MCQS"},
            {"title": "Geography PYQs: UPSC Physical Geography Questions", "subject": "Geography & Environment", "topic": "Geography PYQs", "allocated_time_minutes": 30, "priority": "HIGH", "activity_type": "PYQ_SOLVING"}
        ],
        # Friday (Day 4 - Science, Tech & CSAT Focus)
        [
            {"title": "Science & Tech: ISRO Space Missions & Launch Vehicles", "subject": "Science & Technology", "topic": "Space Missions & GSLV", "allocated_time_minutes": 30, "priority": "HIGH", "activity_type": "NEW_TOPIC"},
            {"title": "Science & Tech: Biotech, Genome Editing & Vaccines", "subject": "Science & Technology", "topic": "CRISPR & Biotech", "allocated_time_minutes": 35, "priority": "HIGH", "activity_type": "NEW_TOPIC"},
            {"title": "CSAT Focus: Reading Comprehension Passages", "subject": "CSAT & Aptitude", "topic": "Passage Comprehension", "allocated_time_minutes": 30, "priority": "HIGH", "activity_type": "NEW_TOPIC"},
            {"title": "Science Revision: Emerging Tech (AI, Quantum, 5G)", "subject": "Science & Technology", "topic": "AI & Quantum Tech", "allocated_time_minutes": 30, "priority": "MEDIUM", "activity_type": "CONCEPT_REVISION"},
            {"title": "CSAT Revision: Syllogism & Logical Deduction", "subject": "CSAT & Aptitude", "topic": "Syllogism & Deductions", "allocated_time_minutes": 30, "priority": "MEDIUM", "activity_type": "CONCEPT_REVISION"},
            {"title": "CSAT Revision: Data Interpretation & Chart Reading", "subject": "CSAT & Aptitude", "topic": "Data Interpretation", "allocated_time_minutes": 30, "priority": "MEDIUM", "activity_type": "CONCEPT_REVISION"},
            {"title": "Science Quiz 1: Space & Biotech Practice MCQs", "subject": "Science & Technology", "topic": "Space Tech Quiz", "allocated_time_minutes": 30, "priority": "HIGH", "activity_type": "PRACTICE_MCQS"},
            {"title": "CSAT Quiz 2: Passage Comprehension Practice Test", "subject": "CSAT & Aptitude", "topic": "Passage Speed Test", "allocated_time_minutes": 30, "priority": "HIGH", "activity_type": "PRACTICE_MCQS"},
            {"title": "CSAT PYQs: UPSC Past 5 Years Aptitude Test", "subject": "CSAT & Aptitude", "topic": "Aptitude PYQs", "allocated_time_minutes": 30, "priority": "HIGH", "activity_type": "PYQ_SOLVING"}
        ],
        # Saturday (Day 5 - Current Affairs Focus)
        [
            {"title": "Current Affairs: PIB Monthly Policy Highlights", "subject": "Current Affairs", "topic": "PIB & Policy", "allocated_time_minutes": 30, "priority": "HIGH", "activity_type": "NEW_TOPIC"},
            {"title": "Current Affairs: Important Government Schemes & Portals", "subject": "Current Affairs", "topic": "Government Schemes", "allocated_time_minutes": 45, "priority": "HIGH", "activity_type": "NEW_TOPIC"},
            {"title": "Current Affairs: International Relations & Summits", "subject": "Current Affairs", "topic": "G20, BRICS & Summits", "allocated_time_minutes": 30, "priority": "HIGH", "activity_type": "NEW_TOPIC"},
            {"title": "IR Revision: Bilateral Exercises & Treaties", "subject": "Current Affairs", "topic": "Military Exercises", "allocated_time_minutes": 30, "priority": "MEDIUM", "activity_type": "CONCEPT_REVISION"},
            {"title": "Schemes Revision: Social Welfare & Health Schemes", "subject": "Current Affairs", "topic": "Health Schemes", "allocated_time_minutes": 30, "priority": "MEDIUM", "activity_type": "CONCEPT_REVISION"},
            {"title": "Reports Revision: Global Indices & Ranking Reports", "subject": "Current Affairs", "topic": "Global Indices", "allocated_time_minutes": 30, "priority": "MEDIUM", "activity_type": "CONCEPT_REVISION"},
            {"title": "Affairs Quiz 1: PIB & Policy Practice Quiz", "subject": "Current Affairs", "topic": "Policy Quiz", "allocated_time_minutes": 30, "priority": "HIGH", "activity_type": "PRACTICE_MCQS"},
            {"title": "Affairs Quiz 2: International Summit MCQs", "subject": "Current Affairs", "topic": "IR Summit Quiz", "allocated_time_minutes": 30, "priority": "HIGH", "activity_type": "PRACTICE_MCQS"},
            {"title": "Affairs PYQs: Current Affairs Past Exam Questions", "subject": "Current Affairs", "topic": "Current Affairs PYQs", "allocated_time_minutes": 30, "priority": "HIGH", "activity_type": "PYQ_SOLVING"}
        ],
        # Sunday (Day 6 - Synthesis & Mock Focus)
        [
            {"title": "Synthesis: Weekly Mind Maps & Formula Sheets", "subject": "General Studies", "topic": "Mind Maps", "allocated_time_minutes": 30, "priority": "HIGH", "activity_type": "NEW_TOPIC"},
            {"title": "Synthesis: Short Notes Consolidation for GS1-GS3", "subject": "General Studies", "topic": "Short Notes", "allocated_time_minutes": 45, "priority": "HIGH", "activity_type": "NEW_TOPIC"},
            {"title": "Synthesis: Weak Spots Mapping & Strategy Adjustment", "subject": "General Studies", "topic": "Strategy Mapping", "allocated_time_minutes": 30, "priority": "HIGH", "activity_type": "NEW_TOPIC"},
            {"title": "Full Revision: Polity & History Core Articles/Dates", "subject": "General Studies", "topic": "Polity & History Review", "allocated_time_minutes": 30, "priority": "MEDIUM", "activity_type": "CONCEPT_REVISION"},
            {"title": "Full Revision: Economy Formulas & Indicators", "subject": "General Studies", "topic": "Economy Indicators Review", "allocated_time_minutes": 30, "priority": "MEDIUM", "activity_type": "CONCEPT_REVISION"},
            {"title": "Full Revision: Geography Maps & Species Lists", "subject": "General Studies", "topic": "Geography Map Review", "allocated_time_minutes": 30, "priority": "MEDIUM", "activity_type": "CONCEPT_REVISION"},
            {"title": "Sunday Mock 1: Sectional Test 1 (50 MCQs)", "subject": "General Studies", "topic": "Sectional Test 1", "allocated_time_minutes": 45, "priority": "HIGH", "activity_type": "MOCK_TEST"},
            {"title": "Sunday Mock 2: Sectional Test 2 (50 MCQs)", "subject": "General Studies", "topic": "Sectional Test 2", "allocated_time_minutes": 45, "priority": "HIGH", "activity_type": "MOCK_TEST"},
            {"title": "Sunday Mock 3: Full Sunday Mini Mock Review", "subject": "General Studies", "topic": "Mock Review", "allocated_time_minutes": 45, "priority": "HIGH", "activity_type": "MOCK_TEST"}
        ]
    ]

    existing_titles_stmt = select(StudyTask.title, StudyTask.scheduled_date).where(
        StudyTask.user_id == current_user.id,
        StudyTask.scheduled_date >= base_date,
        StudyTask.scheduled_date <= end_date
    )
    existing_rows = (await session.exec(existing_titles_stmt)).all()
    existing_keys = {(t_title, str(t_date)) for t_title, t_date in existing_rows}

    today_date = datetime.now(timezone.utc).date()
    created_tasks = []
    for day_idx, day_tasks in enumerate(template_schedule):
        task_date = base_date + timedelta(days=day_idx)
        # Mid-Week Onboarding: Skip past days when generating the current week's plan
        if task_date < today_date:
            continue

        date_str = str(task_date)
        for t_info in day_tasks:
            key = (t_info["title"], date_str)
            if key in existing_keys:
                continue
            existing_keys.add(key)
            new_task = StudyTask(
                user_id=current_user.id,
                title=t_info["title"],
                description=f"Auto-generated AI target for {t_info['subject']}",
                subject=t_info["subject"],
                topic=t_info["topic"],
                priority=t_info["priority"],
                allocated_time_minutes=t_info["allocated_time_minutes"],
                activity_type=t_info["activity_type"],
                scheduled_date=task_date,
                is_completed=False,
                is_ai_recommended=True
            )
            session.add(new_task)
            created_tasks.append(new_task)

    await session.commit()
    return {
        "message": f"Successfully generated 7-day study plan with {len(created_tasks)} target tasks!",
        "task_count": len(created_tasks),
        "start_date": str(base_date),
        "end_date": str(end_date),
        "generated": True
    }

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

    # Run tasks and activities queries concurrently
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

    tasks, activities = await asyncio.gather(get_tasks(), get_activities())

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

        allocated_mins = sum(t.allocated_time_minutes or 30 for t in day_tasks)
        logged_mins = sum(a.duration_minutes or 0 for a in day_activities)
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

    return {
        "start_date": str(base_date),
        "end_date": str(end_date),
        "days": days_data
    }


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

    end_date = base_date + timedelta(days=6)  # Sunday
    start_dt = datetime.combine(base_date, datetime.min.time(), tzinfo=timezone.utc)
    end_dt = datetime.combine(end_date, datetime.max.time(), tzinfo=timezone.utc)

    # 1. Aggregate Study Tasks (count & completion via SQL)
    stmt_tasks = select(
        func.count(col(StudyTask.id)),
        func.coalesce(func.sum(case((col(StudyTask.is_completed) == True, 1), else_=0)), 0)
    ).where(
        col(StudyTask.user_id) == current_user.id,
        col(StudyTask.scheduled_date) >= base_date,
        col(StudyTask.scheduled_date) <= end_date
    )
    task_res = (await session.exec(stmt_tasks)).first()
    total_tasks = int(task_res[0]) if task_res and task_res[0] is not None else 0
    completed_tasks = int(task_res[1]) if task_res and task_res[1] is not None else 0
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
    avg_accuracy = round((total_correct / total_questions * 100)) if total_questions > 0 else 78

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

    top_subject = max(subject_duration_map.items(), key=lambda x: x[1])[0] if subject_duration_map else "Polity & Governance"

    # 6. Build Dynamic Highlights List
    highlights = []
    if total_questions > 0:
        highlights.append(f"Completed {total_questions} practice questions with {avg_accuracy}% average accuracy.")
    else:
        highlights.append(f"Logged {logged_hours} hours of focused study across {len(active_days_set)} active day(s).")

    streak_days = max(len(active_days_set), getattr(current_user, 'current_streak', 1) or 1)
    highlights.append(f"Maintained {streak_days}-day study streak with consistent daily progress.")

    if total_tasks > 0:
        highlights.append(f"Achieved {completion_rate}% weekly target completion rate ({completed_tasks}/{total_tasks} finished).")
    else:
        highlights.append(f"Dedicated major focus to {top_subject} revision.")

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
    if incomplete_subjects:
        focus_next_week.append(f"Revise {incomplete_subjects[0]} (Core concepts & high-yield revision topics).")
    else:
        focus_next_week.append(f"Revise {top_subject} (Monetary Policy, Governance & PYQ practice).")

    focus_next_week.append("Attempt 2 Full-length Mock Tests for time management & exam pacing.")
    focus_next_week.append(f"Solve 20-30 PYQs on {top_subject} to benchmark concept clarity.")

    # Format date strings for header (e.g. "Aug 24 - Aug 30, 2026")
    date_range_str = f"{base_date.strftime('%b %d')} - {end_date.strftime('%b %d, %Y')}"

    # Cache control: weekly report is static intra-session
    response.headers["Cache-Control"] = "private, max-age=120, stale-while-revalidate=300"

    return {
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


# ==================== STUDY LOGGING (ACTIVITIES) ENDPOINTS ====================

class LogActivityRequest(SQLModel):
    subject: str
    topic: Optional[str] = None
    duration_minutes: int
    activity_type: Optional[str] = "CONCEPT_REVISION"
    questions_attempted: Optional[int] = None
    questions_correct: Optional[int] = None
    confidence_rating: Optional[int] = None  # 1 to 5
    notes: Optional[str] = None
    activity_date: Optional[str] = None

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

    act_type_enum = StudyActivityType.CONCEPT_REVISION
    if req.activity_type:
        try:
            act_type_enum = StudyActivityType(req.activity_type)
        except ValueError:
            pass

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
    await session.refresh(new_activity)

    # Trigger Gamification Updates
    gamification_service = GamificationService(session)
    gamification_result = await gamification_service.check_and_update_daily_goal(current_user.id)

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
async def trigger_daily_digests_for_all_users():
    """Admin / Background Trigger: Scans all users and dispatches pending task email digests for tasks in the last 14 days up to today."""
    from app.services.daily_scheduler_service import run_daily_midnight_dispatch
    res = await run_daily_midnight_dispatch(force=True)
    return res


