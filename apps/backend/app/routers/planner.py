"""Study Planner v2: generate a plan from an exam syllabus, follow it day by day, and track coverage and progress.

Free students get plans of up to 7 days and the day-to-day planner; Pro adds longer plans, weak topics first,
days per subject, share links and the revision plan (PDF and calendar export are gated in the app).
"""
from datetime import date, datetime
from typing import Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field as PField

from app.core.deps import get_current_user
from app.db.session import AsyncSession, get_async_session
from app.db.models.user import User
from app.services import free_plan
from app.services import planner_service as svc
from app.services.planner_service import PlannerError

router = APIRouter(prefix="/planner", tags=["Study Planner"])
PRO_CODE = "PRO_STUDY_PLANNER"


class PlanRequest(BaseModel):
    syllabus_id: int  # an exam type's study syllabus (UPSC Prelims, UPSC Mains, …)
    days: int = PField(ge=1, le=365)
    exam_date: Optional[date] = None
    subjects: Optional[List[str]] = None  # None = every subject of the exam
    subject_days: Dict[str, int] = PField(default_factory=dict)
    hours: float = PField(default=4, ge=1, le=14)
    mock: Optional[int] = PField(default=0, ge=0, le=6)  # 0 = Sunday … 6 = Saturday
    rest: Optional[int] = PField(default=None, ge=0, le=6)
    tail: bool = True
    mix: int = PField(default=1, ge=1, le=3)
    ca: bool = True
    pyq: bool = True
    custom_title: str = PField(default="", max_length=60)
    weak_first: bool = False
    auto_catch: bool = True


class SettingsIn(BaseModel):
    daily_goal: Optional[int] = PField(default=None, ge=1, le=30)
    weekly_target: Optional[int] = PField(default=None, ge=1, le=200)


class CoverageIn(BaseModel):
    covered: bool


class FocusIn(BaseModel):
    minutes: int = PField(ge=1, le=240)
    task_id: Optional[int] = None


def _fail(e: PlannerError) -> HTTPException:
    return HTTPException(status_code=e.status, detail={"code": e.code, "message": e.message} if e.code else e.message)


async def _require_pro(session: AsyncSession, user: User, what: str) -> None:
    if await free_plan.is_limited(session, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail={"code": PRO_CODE, "message": f"{what} is part of Pro."})


@router.get("/exams")
async def list_exams(session: AsyncSession = Depends(get_async_session), user: User = Depends(get_current_user)):
    """Exam types with their study syllabi, and the one to preselect for this student."""
    return await svc.active_exams(session, user.id)


@router.get("/syllabus/{syllabus_id}")
async def get_syllabus(syllabus_id: int, session: AsyncSession = Depends(get_async_session),
                       user: User = Depends(get_current_user)):
    try:
        return await svc.syllabus(session, user.id, syllabus_id)
    except PlannerError as e:
        raise _fail(e)


@router.put("/coverage/{subtopic_id}")
async def set_coverage(subtopic_id: int, body: CoverageIn, session: AsyncSession = Depends(get_async_session),
                       user: User = Depends(get_current_user)):
    try:
        await svc.set_coverage(session, user.id, subtopic_id, body.covered)
    except PlannerError as e:
        raise _fail(e)
    return {"ok": True}


@router.get("/settings")
async def get_settings(session: AsyncSession = Depends(get_async_session), user: User = Depends(get_current_user)):
    s = await svc.get_settings(session, user.id)
    return {"daily_goal": s.daily_goal_topics, "weekly_target": s.weekly_coverage_target, "prefs": s.prefs or {},
            "pro": not await free_plan.is_limited(session, user), "free_max_days": svc.FREE_MAX_DAYS}


@router.put("/settings")
async def put_settings(body: SettingsIn, session: AsyncSession = Depends(get_async_session),
                       user: User = Depends(get_current_user)):
    s = await svc.update_settings(session, user.id, body.daily_goal, body.weekly_target)
    return {"daily_goal": s.daily_goal_topics, "weekly_target": s.weekly_coverage_target}


@router.post("/estimate")
async def estimate(body: PlanRequest, session: AsyncSession = Depends(get_async_session),
                   user: User = Depends(get_current_user)):
    try:
        return await svc.estimate(session, user.id, body.model_dump())
    except PlannerError as e:
        raise _fail(e)


@router.post("/generate")
async def generate(body: PlanRequest, session: AsyncSession = Depends(get_async_session),
                   user: User = Depends(get_current_user)):
    req = body.model_dump()
    try:
        svc.check_limits(req, await free_plan.is_limited(session, user))
        return await svc.generate(session, user.id, req)
    except PlannerError as e:
        raise _fail(e)


@router.delete("/plan")
async def clear_plan(session: AsyncSession = Depends(get_async_session), user: User = Depends(get_current_user)):
    return {"removed": await svc.clear_plan(session, user.id)}


@router.get("/overview")
async def overview(session: AsyncSession = Depends(get_async_session), user: User = Depends(get_current_user)):
    return await svc.overview(session, user.id)


@router.get("/tasks")
async def tasks(start: date = Query(...), end: date = Query(...), session: AsyncSession = Depends(get_async_session),
                user: User = Depends(get_current_user)):
    if (end - start).days > 62 or end < start:
        raise HTTPException(422, "Ask for up to 62 days at a time")
    return await svc.tasks_between(session, user.id, start, end)


@router.get("/plan-tasks")
async def plan_tasks(session: AsyncSession = Depends(get_async_session), user: User = Depends(get_current_user)):
    """Every task of the plan, for the PDF and calendar downloads (Pro)."""
    await _require_pro(session, user, "Downloading your plan")
    return await svc.plan_tasks(session, user.id)


@router.post("/tasks/{task_id}/skip")
async def skip(task_id: int, session: AsyncSession = Depends(get_async_session), user: User = Depends(get_current_user)):
    try:
        return {"date": await svc.skip_task(session, user.id, task_id)}
    except PlannerError as e:
        raise _fail(e)


@router.post("/tasks/{task_id}/reopen")
async def reopen(task_id: int, session: AsyncSession = Depends(get_async_session), user: User = Depends(get_current_user)):
    try:
        await svc.reopen_task(session, user.id, task_id)
    except PlannerError as e:
        raise _fail(e)
    return {"ok": True}


@router.post("/catch-up")
async def catch_up(session: AsyncSession = Depends(get_async_session), user: User = Depends(get_current_user)):
    return {"moved": await svc.catch_up(session, user.id)}


@router.post("/focus")
async def focus(body: FocusIn, session: AsyncSession = Depends(get_async_session), user: User = Depends(get_current_user)):
    await svc.log_focus(session, user.id, body.minutes, body.task_id)
    return {"ok": True}


@router.get("/tracker")
async def tracker(range: Literal["week", "month"] = "week", anchor: Optional[date] = None,
                  session: AsyncSession = Depends(get_async_session), user: User = Depends(get_current_user)):
    return await svc.tracker(session, user.id, range, anchor or svc.today_ist())


@router.get("/revision-plan")
async def revision_plan(session: AsyncSession = Depends(get_async_session), user: User = Depends(get_current_user)):
    await _require_pro(session, user, "The revision plan")
    return await svc.revision_plan(session, user.id)


@router.post("/revision-plan/add")
async def add_revision_plan(session: AsyncSession = Depends(get_async_session), user: User = Depends(get_current_user)):
    await _require_pro(session, user, "The revision plan")
    return {"added": await svc.add_revision_plan(session, user.id)}


@router.post("/share")
async def share(session: AsyncSession = Depends(get_async_session), user: User = Depends(get_current_user)):
    await _require_pro(session, user, "Sharing your plan")
    try:
        return {"token": await svc.create_share(session, user.id)}
    except PlannerError as e:
        raise _fail(e)


@router.get("/share/{token}")
async def share_summary(token: str, session: AsyncSession = Depends(get_async_session),
                        _: User = Depends(get_current_user)):
    try:
        return await svc.share_summary(session, token)
    except PlannerError as e:
        raise _fail(e)


@router.post("/share/{token}/import")
async def import_share(token: str, session: AsyncSession = Depends(get_async_session),
                       user: User = Depends(get_current_user)):
    try:
        return {"imported": await svc.import_share(session, user.id, token,
                                                    limited=await free_plan.is_limited(session, user))}
    except PlannerError as e:
        raise _fail(e)
