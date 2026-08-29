from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, col
from datetime import datetime, timezone

from app.db.session import get_async_session
from app.services.analytics_service import AnalyticsService
from app.core.deps import get_current_user
from app.db.models.user import User, UserRole
from app.schemas.analytics import StudyActivityCreate, StudyActivityOut
from app.db.models.study_plan import StudyActivity


router = APIRouter(prefix="/analytics", tags=["Psychometric & Cognitive Analytics"])


@router.get("/reports/attempts/{attempt_id}/status", summary="Check Post-Submission Evaluation Status (Long-Polling)")
async def get_attempt_evaluation_status(
    attempt_id: int | str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Long-polling status endpoint for post-submission psychometric pipeline evaluation.
    Guarantees zero proxy/deployment timeout errors by returning lightweight progress updates.
    """
    try:
        aid_int = int(attempt_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Attempt not found")
    service = AnalyticsService(session)
    res = await service.get_attempt_evaluation_status(attempt_id=aid_int)
    return JSONResponse(content=jsonable_encoder(res)) if isinstance(res, dict) else res


@router.post("/reports/attempts/{attempt_id}/retry", summary="Retry Failed Post-Submission Evaluation")
async def retry_attempt_evaluation(
    attempt_id: int | str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Manually re-triggers the post-submission evaluation pipeline for a failed attempt.
    """
    try:
        aid_int = int(attempt_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Attempt not found")
    service = AnalyticsService(session)
    res = await service.retry_attempt_evaluation(attempt_id=aid_int)
    return JSONResponse(content=jsonable_encoder(res))


@router.get("/reports/attempts/{attempt_id}/questions", summary="Report 1: Question-Level Detailed Diagnostic & Explanation Report")
async def get_attempt_question_report(
    attempt_id: int | str,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Report 1: Detailed question cards with explanations, core concepts, step-by-step solutions,
    distractor traps, time window, and question-level scores with optional pagination.
    """
    try:
        aid_int = int(attempt_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Attempt not found")
    service = AnalyticsService(session)
    res = await service.get_attempt_question_report(attempt_id=aid_int, page=page, page_size=page_size)
    return JSONResponse(content=jsonable_encoder(res)) if isinstance(res, dict) else res


@router.get("/reports/attempts/{attempt_id}/exam", summary="Report 2: Exam-Level 12-Matrix Aggregated Report")
async def get_attempt_exam_report(
    attempt_id: int | str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Report 2: Comprehensive 12-matrix aggregated exam diagnostic summary, taxonomy mastery grid, and AI insights.
    """
    try:
        aid_int = int(attempt_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Attempt not found")
    service = AnalyticsService(session)
    res = await service.get_attempt_exam_report(attempt_id=aid_int)
    return JSONResponse(content=jsonable_encoder(res)) if isinstance(res, dict) else res


@router.get("/reports/attempts/{attempt_id}/user-delta", summary="Report 3: Cumulative User Skill Progression Delta Report")
async def get_attempt_user_progression_report(
    attempt_id: int | str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Report 3: Longitudinal user skill progression, tracking exact matrix score deltas (ICRS, IRT, GTI, OEEI, SATOI),
    taxonomy promotions, and spaced repetition review schedules.
    """
    try:
        aid_int = int(attempt_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Attempt not found")
    service = AnalyticsService(session)
    res = await service.get_attempt_user_progression_report(attempt_id=aid_int)
    return JSONResponse(content=jsonable_encoder(res)) if isinstance(res, dict) else res


@router.get("/reports/user/{user_id}/skill-profile", summary="User Cumulative Psychometric Skill Profile")
async def get_user_cumulative_skill_profile(
    user_id: int | str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieves the user's cumulative long-term skill profile and active taxonomy mastery grid.
    """
    try:
        uid_int = int(user_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="User not found")
    if current_user.id != uid_int and current_user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(status_code=403, detail="FORBIDDEN: You cannot view another user's skill profile.")
    service = AnalyticsService(session)
    res = await service.get_user_skill_profile(user_id=uid_int)
    return JSONResponse(content=jsonable_encoder(res)) if isinstance(res, dict) else res


@router.get("/users/{user_id}/aggregate-report", summary="Cumulative Multi-Exam Psychometric Performance Report")
async def get_user_cumulative_aggregate_report(
    user_id: str,
    force_recompute: bool = False,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Synthesizes the complete longitudinal multi-exam performance report for all evaluated exams,
    including cross-exam comparison trajectories, 12-matrix aggregates, and universal taxonomy mastery.
    """
    if user_id == "me":
        target_id = current_user.id
    else:
        try:
            target_id = int(user_id)
        except (ValueError, TypeError):
            raise HTTPException(status_code=404, detail="User not found")
    if current_user.id != target_id and current_user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(status_code=403, detail="FORBIDDEN: You cannot view another user's cumulative report.")
    service = AnalyticsService(session)
    res = await service.get_user_cumulative_aggregate_report(user_id=target_id, force_recompute=force_recompute)
    return JSONResponse(content=jsonable_encoder(res)) if isinstance(res, dict) else res


@router.get("/users/{user_id}/aggregate-report/markdown", summary="Cumulative Multi-Exam Markdown Audit")
async def get_user_cumulative_aggregate_markdown(
    user_id: str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the complete cumulative multi-exam psychometric report rendered as a Markdown audit document.
    """
    if user_id == "me":
        target_id = current_user.id
    else:
        try:
            target_id = int(user_id)
        except (ValueError, TypeError):
            raise HTTPException(status_code=404, detail="User not found")
    if current_user.id != target_id and current_user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(status_code=403, detail="FORBIDDEN: You cannot view another user's cumulative audit.")
    service = AnalyticsService(session)
    return await service.get_user_cumulative_aggregate_markdown(user_id=target_id)


@router.get("/reports/attempts/{attempt_id}/json")
async def get_attempt_report_json(
    attempt_id: int | str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Generates/fetches full psychometric report in JSON format directly by attempt_id."""
    try:
        aid_int = int(attempt_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Attempt not found")
    service = AnalyticsService(session)
    return await service.get_psychometric_report_json(attempt_id=aid_int)


@router.get("/reports/attempts/{attempt_id}/yaml")
async def get_attempt_report_yaml(
    attempt_id: int | str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Generates/fetches full psychometric report in YAML format directly by attempt_id."""
    try:
        aid_int = int(attempt_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Attempt not found")
    service = AnalyticsService(session)
    return await service.get_psychometric_report_yaml(attempt_id=aid_int)


@router.get("/reports/attempts/{attempt_id}/markdown")
async def get_attempt_report_markdown(
    attempt_id: int | str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Generates/fetches full psychometric report in Markdown format directly by attempt_id."""
    try:
        aid_int = int(attempt_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Attempt not found")
    service = AnalyticsService(session)
    return await service.get_psychometric_report_markdown(attempt_id=aid_int)


@router.post("/activity", response_model=StudyActivityOut)
async def create_study_activity(
    activity_in: StudyActivityCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """Log a new study activity."""
    db_activity = StudyActivity(
        user_id=current_user.id,
        **activity_in.model_dump()
    )
    session.add(db_activity)
    await session.commit()
    await session.refresh(db_activity)
    return db_activity


@router.get("/activity/today", response_model=list[StudyActivityOut])
async def get_todays_activities(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """Get all study activities logged today for the current user."""
    today = datetime.now(timezone.utc).date()
    statement = select(StudyActivity).where(
        StudyActivity.user_id == current_user.id,
        StudyActivity.date == today
    ).order_by(col(StudyActivity.created_at).desc())
    
    result = await session.exec(statement)
    return result.all()


@router.get("/predicted-rank", summary="Get User's Estimated All India Rank (AIR) & Percentile")
async def get_user_predicted_rank(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """Calculates user's estimated All India Rank (AIR) and percentile for UPSC CSE Prelims."""
    service = AnalyticsService(session)
    return await service.get_predicted_rank(current_user.id)


@router.get("/monthly-benchmark", summary="Get User's National Benchmarking & Monthly Performance Metrics")
async def get_user_monthly_benchmark(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """Calculates candidate's national benchmarking, percentile growth, readiness index, and subject comparisons."""
    service = AnalyticsService(session)
    return await service.get_monthly_benchmark(current_user.id)


@router.get("/subject-performance", summary="Get Subject-Wise Accuracy & Performance Metrics")
async def get_user_subject_performance(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """Calculates subject accuracy percentages based on user study activities and exam responses."""
    service = AnalyticsService(session)
    return await service.get_user_subject_performance(current_user.id)


@router.get("/reports/user/{user_id}/exam/{exam_id}/json")
async def get_exam_psychometric_report_json(
    user_id: int | str,
    exam_id: int | str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Generates latest attempt Psychometric Report for a specific user and exam in JSON format."""
    try:
        uid_int = int(user_id)
        eid_int = int(exam_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="User or exam not found")
    _validate_user_ownership(current_user, uid_int)
    service = AnalyticsService(session)
    return await service.get_psychometric_report_json(user_id=uid_int, exam_id=eid_int)


@router.get("/reports/user/{user_id}/exam/{exam_id}/yaml")
async def get_exam_psychometric_report_yaml(
    user_id: int | str,
    exam_id: int | str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Generates latest attempt Psychometric Report for a specific user and exam in YAML format."""
    try:
        uid_int = int(user_id)
        eid_int = int(exam_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="User or exam not found")
    _validate_user_ownership(current_user, uid_int)
    service = AnalyticsService(session)
    return await service.get_psychometric_report_yaml(user_id=uid_int, exam_id=eid_int)


@router.get("/reports/user/{user_id}/exam/{exam_id}/markdown")
async def get_exam_psychometric_report_markdown(
    user_id: int | str,
    exam_id: int | str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Generates latest attempt Psychometric Report for a specific user and exam in Markdown format."""
    try:
        uid_int = int(user_id)
        eid_int = int(exam_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="User or exam not found")
    _validate_user_ownership(current_user, uid_int)
    service = AnalyticsService(session)
    return await service.get_psychometric_report_markdown(user_id=uid_int, exam_id=eid_int)


def _validate_user_ownership(current_user: User, target_user_id: int):
    if current_user.id != target_user_id and current_user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="UNAUTHORIZED_ACCESS: You can only access your own analytics reports.",
        )
