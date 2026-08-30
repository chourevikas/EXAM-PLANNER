import uuid
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession
from app.db.models import (
    User,
    Exam,
    ExamAttempt,
    ExamAttemptReport,
)
from app.config.logger import setup_logger

logger = setup_logger("ReportCompiler")


async def compile_comprehensive_psychometric_report(
    session: AsyncSession,
    user_id: Optional[int] = None,
    exam_id: Optional[int] = None,
    attempt_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Compiles or retrieves a comprehensive 4-part psychometric diagnostic report.
    Guarantees authentic, mode-aware matrix evaluation (zero dummy data).
    """
    attempt: Optional[ExamAttempt] = None

    if attempt_id:
        attempt = await session.get(ExamAttempt, attempt_id)
        if not attempt:
            raise ValueError(f"Exam attempt with ID '{attempt_id}' not found.")
        user_id = attempt.user_id
        exam_id = attempt.exam_id
    elif user_id and exam_id:
        att_res = await session.exec(
            select(ExamAttempt)
            .where(ExamAttempt.user_id == user_id, ExamAttempt.exam_id == exam_id)
            .order_by(col(ExamAttempt.created_at).desc())
        )
        attempt = att_res.first()
        if not attempt:
            raise ValueError(f"No attempt found for User '{user_id}' on Exam '{exam_id}'.")
    else:
        raise ValueError("Must provide either attempt_id or both user_id and exam_id.")

    # 1. Return cached evaluated report from attempt.report_metadata_json if it is complete
    if attempt.report_metadata_json and isinstance(attempt.report_metadata_json, dict):
        if "part_2_exam_macro_scorecard" in attempt.report_metadata_json or "part_3_aggregated_user_report" in attempt.report_metadata_json:
            return attempt.report_metadata_json

    # 2. Check ExamAttemptReport in DB
    rep_stmt = select(ExamAttemptReport).where(ExamAttemptReport.attempt_id == attempt.id)
    rep_db = (await session.exec(rep_stmt)).first()
    if rep_db and rep_db.full_report_json is not None:
        return rep_db.full_report_json

    # 3. Synchronously execute post-submission pipeline core
    from app.engine.post_submission_pipeline import _run_pipeline_core
    from app.db.models.enums import AttemptStatus
    logger.info(f"Report for Attempt '{attempt.id}' requested. Evaluating 12 psychometric matrices synchronously...")
    try:
        await _run_pipeline_core(session, attempt.id)
        await session.refresh(attempt)
    except Exception as pipe_err:
        logger.error(f"Error during synchronous evaluation of attempt '{attempt.id}': {pipe_err}", exc_info=True)
        attempt.report_metadata_json = {
            "status": "FAILED",
            "is_ready": False,
            "can_retry": True,
            "error_message": str(pipe_err),
            "failed_at": datetime.now(timezone.utc).isoformat(),
        }
        session.add(attempt)
        await session.commit()
        raise ValueError(f"Evaluation failed for Attempt '{attempt.id}': {pipe_err}")

    # 4. Check ExamAttemptReport in DB after pipeline execution
    rep_stmt = select(ExamAttemptReport).where(ExamAttemptReport.attempt_id == attempt.id)
    rep_db = (await session.exec(rep_stmt)).first()
    if rep_db and rep_db.full_report_json is not None:
        return rep_db.full_report_json

    if attempt.report_metadata_json and isinstance(attempt.report_metadata_json, dict):
        if "part_2_exam_macro_scorecard" in attempt.report_metadata_json or "part_3_aggregated_user_report" in attempt.report_metadata_json:
            return attempt.report_metadata_json

    raise ValueError(f"Unable to compile psychometric report for Attempt '{attempt.id}': no valid questions or responses.")
