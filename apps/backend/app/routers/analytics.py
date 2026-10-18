from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response
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


async def _deny_analysis_on_free_plan(session: AsyncSession, current_user: User) -> None:
    """Free-plan students get their score, answers and explanations, but not the analysis reports."""
    from app.services import free_plan

    if await free_plan.is_limited(session, current_user):
        raise free_plan.analysis_locked_error()


def _score_only_report(report_response: Response) -> JSONResponse:
    """The parts of an attempt report the free plan includes: per-question answers/explanations and the score."""
    import json

    report = json.loads(report_response.body or b"{}")
    p2 = report.get("part_2_exam_macro_scorecard") or report.get("part_3_aggregated_user_report") or {}
    return JSONResponse(content={
        "analysis_locked": True,
        "metadata": report.get("metadata", {}),
        "part_1_per_question_analysis": report.get("part_1_per_question_analysis", []),
        "part_2_exam_macro_scorecard": {"score_summary": p2.get("score_summary", {})},
    })


async def _owned_attempt_id(session: AsyncSession, current_user: User, attempt_id: int | str) -> int:
    """Resolves an attempt id the caller may access: their own attempt, or any attempt for admins.

    Attempt ids are sequential, so another user's attempt answers 404 (not 403) to avoid confirming it exists.
    """
    from app.db.models.analytics import ExamAttempt

    not_found = HTTPException(status_code=404, detail="Attempt not found")
    try:
        aid_int = int(attempt_id)
    except (ValueError, TypeError):
        raise not_found
    owner_id = (await session.exec(select(ExamAttempt.user_id).where(ExamAttempt.id == aid_int))).first()
    if owner_id is None:
        raise not_found
    if owner_id != current_user.id and current_user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise not_found
    return aid_int


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
    aid_int = await _owned_attempt_id(session, current_user, attempt_id)
    service = AnalyticsService(session)
    res = await service.get_attempt_evaluation_status(attempt_id=aid_int)
    return JSONResponse(
        content=jsonable_encoder(res) if isinstance(res, dict) else res,
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
    )


@router.post("/reports/attempts/{attempt_id}/retry", summary="Retry Failed Post-Submission Evaluation")
async def retry_attempt_evaluation(
    attempt_id: int | str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Manually re-triggers the post-submission evaluation pipeline for a failed attempt.
    """
    aid_int = await _owned_attempt_id(session, current_user, attempt_id)
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
    aid_int = await _owned_attempt_id(session, current_user, attempt_id)
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
    aid_int = await _owned_attempt_id(session, current_user, attempt_id)
    await _deny_analysis_on_free_plan(session, current_user)
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
    aid_int = await _owned_attempt_id(session, current_user, attempt_id)
    await _deny_analysis_on_free_plan(session, current_user)
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
    await _deny_analysis_on_free_plan(session, current_user)
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
    await _deny_analysis_on_free_plan(session, current_user)
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
    await _deny_analysis_on_free_plan(session, current_user)
    service = AnalyticsService(session)
    return await service.get_user_cumulative_aggregate_markdown(user_id=target_id)


@router.get("/reports/attempts/{attempt_id}/json")
async def get_attempt_report_json(
    attempt_id: int | str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Generates/fetches full psychometric report in JSON format directly by attempt_id.

    Free-plan students get the score and per-question review only (analysis_locked: true).
    """
    aid_int = await _owned_attempt_id(session, current_user, attempt_id)
    service = AnalyticsService(session)
    report = await service.get_psychometric_report_json(attempt_id=aid_int)
    from app.services import free_plan
    if await free_plan.is_limited(session, current_user) and isinstance(report, Response):
        return _score_only_report(report)
    return report


@router.get("/reports/attempts/{attempt_id}/yaml")
async def get_attempt_report_yaml(
    attempt_id: int | str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Generates/fetches full psychometric report in YAML format directly by attempt_id."""
    aid_int = await _owned_attempt_id(session, current_user, attempt_id)
    await _deny_analysis_on_free_plan(session, current_user)
    service = AnalyticsService(session)
    return await service.get_psychometric_report_yaml(attempt_id=aid_int)


@router.get("/reports/attempts/{attempt_id}/markdown")
async def get_attempt_report_markdown(
    attempt_id: int | str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Generates/fetches full psychometric report in Markdown format directly by attempt_id."""
    aid_int = await _owned_attempt_id(session, current_user, attempt_id)
    await _deny_analysis_on_free_plan(session, current_user)
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
    from app.cache import invalidate_study_activity_cache
    await invalidate_study_activity_cache(current_user.id)
    return db_activity


@router.get("/activity/today", response_model=list[StudyActivityOut])
async def get_todays_activities(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """Get all study activities logged today for the current user."""
    from app.cache import get_cache, build_cache_key
    cache = get_cache()
    cache_key = build_cache_key("analytics:activity_today", str(current_user.id))

    cached_val = await cache.get(cache_key)
    if cached_val is not None:
        return cached_val

    today = datetime.now(timezone.utc).date()
    statement = select(StudyActivity).where(
        StudyActivity.user_id == current_user.id,
        StudyActivity.date == today
    ).order_by(col(StudyActivity.created_at).desc())
    
    result = await session.exec(statement)
    activities = result.all()
    
    # We must serialize to dicts to cache them, since the router uses model_dump,
    # but the cache requires JSON serializable objects.
    # Alternatively we just cache the raw models if the cache handles it.
    # Actually, returning them directly to FastAPI allows FastAPI to serialize them.
    # We will just cache the dict representations.
    out_list = []
    for a in activities:
        out_list.append({
            "id": a.id,
            "user_id": a.user_id,
            "subject": a.subject,
            "topic": a.topic,
            "duration_minutes": a.duration_minutes,
            "activity_type": a.activity_type.value if hasattr(a.activity_type, 'value') else str(a.activity_type),
            "questions_attempted": a.questions_attempted,
            "questions_correct": a.questions_correct,
            "confidence_rating": a.confidence_rating,
            "score": a.score,
            "notes": a.notes,
            "date": a.date.isoformat() if a.date else None,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "activity_source": a.activity_source.value if hasattr(a.activity_source, 'value') else str(a.activity_source)
        })
    await cache.set(cache_key, out_list, ttl_seconds=300)
    return out_list


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
    response: Response,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """Calculates candidate's national benchmarking, percentile growth, readiness index, and subject comparisons."""
    response.headers["Cache-Control"] = "private, max-age=300, stale-while-revalidate=600"
    service = AnalyticsService(session)
    return await service.get_monthly_benchmark(current_user.id)


@router.get("/trends/speed-negative", summary="Speed and negative marking across the student's completed tests")
async def get_speed_and_negative_trend(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Seconds per answered question and marks lost to wrong answers, per completed test (oldest first)."""
    await _deny_analysis_on_free_plan(session, current_user)
    from app.services.trend_service import speed_and_negative_marking
    return await speed_and_negative_marking(session, current_user.id, max(2, min(limit, 50)))


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
    await _deny_analysis_on_free_plan(session, current_user)
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
    await _deny_analysis_on_free_plan(session, current_user)
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
    await _deny_analysis_on_free_plan(session, current_user)
    service = AnalyticsService(session)
    return await service.get_psychometric_report_markdown(user_id=uid_int, exam_id=eid_int)


def _validate_user_ownership(current_user: User, target_user_id: int):
    if current_user.id != target_user_id and current_user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="UNAUTHORIZED_ACCESS: You can only access your own analytics reports.",
        )
