import uuid
from typing import Optional, Dict, Any
from fastapi import HTTPException
from fastapi.responses import Response
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.engine.report_compiler import compile_comprehensive_psychometric_report
from app.formatters.report_json_formatter import format_report_to_json
from app.formatters.report_yaml_formatter import format_report_to_yaml
from app.formatters.report_markdown_formatter import format_report_to_markdown
from app.db.models import (
    Exam,
    ExamAttempt,
    AttemptStatus,
    UserSkillProfile,
    UserTaxonomyMastery,
    ExamQuestionReport,
    ExamAttemptReport,
    UserSkillProgressionReport,
)
from app.config.logger import setup_logger

logger = setup_logger("AnalyticsService")


class AnalyticsService:
    """Service compiling and formatting psychometric diagnostic analytics reports."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_psychometric_report_json(
        self,
        user_id: Optional[uuid.UUID] = None,
        exam_id: Optional[uuid.UUID] = None,
        attempt_id: Optional[uuid.UUID] = None,
    ) -> Response:
        try:
            report_data = await compile_comprehensive_psychometric_report(
                self.session, user_id=user_id, exam_id=exam_id, attempt_id=attempt_id
            )
            json_content = format_report_to_json(report_data)
            return Response(content=json_content, media_type="application/json")
        except ValueError as val_err:
            raise HTTPException(status_code=404, detail=str(val_err))
        except Exception as exc:
            logger.error(
                f"Error compiling JSON report for Attempt '{attempt_id or exam_id}': {exc}",
                exc_info=True,
            )
            raise HTTPException(status_code=500, detail=str(exc))

    async def get_psychometric_report_yaml(
        self,
        user_id: Optional[uuid.UUID] = None,
        exam_id: Optional[uuid.UUID] = None,
        attempt_id: Optional[uuid.UUID] = None,
    ) -> Response:
        try:
            report_data = await compile_comprehensive_psychometric_report(
                self.session, user_id=user_id, exam_id=exam_id, attempt_id=attempt_id
            )
            yaml_content = format_report_to_yaml(report_data)
            return Response(content=yaml_content, media_type="text/yaml")
        except ValueError as val_err:
            raise HTTPException(status_code=404, detail=str(val_err))
        except Exception as exc:
            logger.error(
                f"Error compiling YAML report for Attempt '{attempt_id or exam_id}': {exc}",
                exc_info=True,
            )
            raise HTTPException(status_code=500, detail=str(exc))

    async def get_psychometric_report_markdown(
        self,
        user_id: Optional[uuid.UUID] = None,
        exam_id: Optional[uuid.UUID] = None,
        attempt_id: Optional[uuid.UUID] = None,
    ) -> Response:
        try:
            report_data = await compile_comprehensive_psychometric_report(
                self.session, user_id=user_id, exam_id=exam_id, attempt_id=attempt_id
            )
            markdown_content = format_report_to_markdown(report_data)
            return Response(content=markdown_content, media_type="text/markdown")
        except ValueError as val_err:
            raise HTTPException(status_code=404, detail=str(val_err))
    async def get_attempt_question_report(self, attempt_id: uuid.UUID) -> Dict[str, Any]:
        """Fetches Report 1: Question-Level Detailed Diagnostic & Explanation Report."""
        attempt = await self.session.get(ExamAttempt, attempt_id)
        if not attempt:
            raise HTTPException(status_code=404, detail="Attempt not found.")

        # 1. Instant DB Cache from attempt.report_metadata_json (contains full per-question analysis & explanations)
        if attempt.report_metadata_json and isinstance(attempt.report_metadata_json, dict):
            part_1 = attempt.report_metadata_json.get("part_1_per_question_analysis")
            if part_1 and len(part_1) > 0:
                return {
                    "attempt_id": str(attempt_id),
                    "total_questions": len(part_1),
                    "questions": part_1,
                }

        # 2. Database ExamQuestionReport Rows
        stmt = (
            select(ExamQuestionReport)
            .where(ExamQuestionReport.attempt_id == attempt_id)
            .order_by(col(ExamQuestionReport.question_number).asc())
        )
        res = await self.session.exec(stmt)
        rows = res.all()
        if rows:
            return {
                "attempt_id": str(attempt_id),
                "total_questions": len(rows),
                "questions": [
                    {
                        "question_number": r.question_number,
                        "question_id": str(r.question_id),
                        "is_correct": r.is_correct,
                        "final_score": r.final_score,
                        "time_taken_seconds": r.time_taken_seconds,
                        "expected_time_seconds": r.expected_time_seconds,
                        "time_window": r.time_window,
                        "closeness_score": r.closeness_score,
                        "closeness_classification": r.closeness_classification,
                        "gti_item_score": r.gti_item_score,
                        "is_option_switched": r.is_option_switched,
                        "blooms_level": r.blooms_level,
                        "explanation": r.explanation_json,
                    }
                    for r in rows
                ],
            }

        # 3. Fallback to comprehensive psychometric report compiler
        rep = await compile_comprehensive_psychometric_report(self.session, attempt_id=attempt_id)
        if rep and rep.get("part_1_per_question_analysis"):
            return {
                "attempt_id": str(attempt_id),
                "total_questions": len(rep.get("part_1_per_question_analysis", [])),
                "questions": rep.get("part_1_per_question_analysis", []),
            }

        return {
            "attempt_id": str(attempt_id),
            "total_questions": 0,
            "questions": [],
        }

    async def get_attempt_exam_report(self, attempt_id: uuid.UUID) -> Dict[str, Any]:
        """Fetches Report 2: Exam-Level 12-Matrix Aggregated Performance Report."""
        stmt = select(ExamAttemptReport).where(ExamAttemptReport.attempt_id == attempt_id)
        res = await self.session.exec(stmt)
        rep_db = res.first()
        if rep_db:
            return {
                "attempt_id": str(attempt_id),
                "user_id": str(rep_db.user_id),
                "exam_id": str(rep_db.exam_id),
                "matrices_summary": rep_db.matrices_summary_json,
                "taxonomy_breakdown": rep_db.taxonomy_breakdown_json,
                "llm_insight": rep_db.llm_insight_json,
                "created_at": rep_db.created_at.isoformat() if rep_db.created_at else None,
            }

        # 2. Instant DB Cache: attempt.report_metadata_json
        attempt = await self.session.get(ExamAttempt, attempt_id)
        if attempt and attempt.report_metadata_json and isinstance(attempt.report_metadata_json, dict):
            meta = attempt.report_metadata_json
            return {
                "attempt_id": str(attempt_id),
                "matrices_summary": meta.get("part_3_aggregated_user_report", {}),
                "taxonomy_breakdown": meta.get("part_2_taxonomy_analysis", {}),
                "llm_insight": meta.get("part_3_aggregated_user_report", {}).get("llm_insight"),
                "metadata": meta.get("metadata", {}),
            }

        # 3. Fallback to compiled report
        full_rep = await compile_comprehensive_psychometric_report(self.session, attempt_id=attempt_id)
        return {
            "attempt_id": str(attempt_id),
            "matrices_summary": full_rep.get("part_3_aggregated_user_report", {}),
            "taxonomy_breakdown": full_rep.get("part_2_taxonomy_analysis", {}),
            "llm_insight": full_rep.get("part_3_aggregated_user_report", {}).get("llm_insight"),
            "metadata": full_rep.get("metadata", {}),
        }

    async def get_attempt_user_progression_report(self, attempt_id: uuid.UUID) -> Dict[str, Any]:
        """Fetches Report 3: Cumulative User Skill Progression Delta Report."""
        stmt = select(UserSkillProgressionReport).where(UserSkillProgressionReport.attempt_id == attempt_id)
        res = await self.session.exec(stmt)
        prog_db = res.first()
        if prog_db:
            return {
                "attempt_id": str(attempt_id),
                "user_id": str(prog_db.user_id),
                "previous_metrics": prog_db.previous_metrics_json,
                "updated_metrics": prog_db.updated_metrics_json,
                "deltas": prog_db.deltas_json,
                "taxonomy_promotions": prog_db.taxonomy_promotions_json,
                "spaced_repetition_schedule": prog_db.spaced_repetition_schedule_json,
                "created_at": prog_db.created_at.isoformat() if prog_db.created_at else None,
            }

        # Fallback query from UserSkillProfile
        attempt = await self.session.get(ExamAttempt, attempt_id)
        if not attempt:
            raise HTTPException(status_code=404, detail="Attempt not found.")

        profile = (await self.session.exec(select(UserSkillProfile).where(UserSkillProfile.user_id == attempt.user_id))).first()
        return {
            "attempt_id": str(attempt_id),
            "user_id": str(attempt.user_id),
            "current_metrics": {
                "cumulative_icrs": profile.cumulative_icrs if profile else 65.0,
                "cumulative_irt_theta": profile.cumulative_irt_theta if profile else 0.0,
                "cumulative_gti": profile.cumulative_gti if profile else 0.20,
                "cumulative_oeei": profile.cumulative_oeei if profile else 0.70,
                "cumulative_satoi": profile.cumulative_satoi if profile else 85.0,
                "total_tests_given": profile.total_tests_given if profile else 0,
            },
        }

    async def get_user_skill_profile(self, user_id: uuid.UUID) -> Dict[str, Any]:
        """Fetches the user's cumulative psychometric profile and taxonomy mastery grid."""
        prof_res = await self.session.exec(select(UserSkillProfile).where(UserSkillProfile.user_id == user_id))
        profile = prof_res.first()

        tax_res = await self.session.exec(
            select(UserTaxonomyMastery)
            .where(UserTaxonomyMastery.user_id == user_id)
            .order_by(col(UserTaxonomyMastery.updated_at).desc())
        )
        tax_rows = tax_res.all()

        return {
            "user_id": str(user_id),
            "profile": {
                "cumulative_icrs": profile.cumulative_icrs if profile else 65.0,
                "cumulative_irt_theta": profile.cumulative_irt_theta if profile else 0.0,
                "cumulative_gti": profile.cumulative_gti if profile else 0.20,
                "cumulative_oeei": profile.cumulative_oeei if profile else 0.70,
                "cumulative_satoi": profile.cumulative_satoi if profile else 85.0,
                "total_tests_given": profile.total_tests_given if profile else 0,
                "total_questions_answered": profile.total_questions_answered if profile else 0,
            },
            "taxonomy_mastery": [
                {
                    "type": t.taxonomy_type,
                    "name": t.taxonomy_name,
                    "total_attempts": t.total_attempts,
                    "correct_attempts": t.correct_attempts,
                    "mastery_percentage": t.mastery_percentage,
                    "strength_status": t.strength_status,
                }
                for t in tax_rows
            ],
        }

    async def get_attempt_evaluation_status(self, attempt_id: uuid.UUID) -> Dict[str, Any]:
        """Checks if the psychometric post-submission pipeline evaluation has completed for an attempt."""
        attempt = await self.session.get(ExamAttempt, attempt_id)
        if not attempt:
            raise HTTPException(status_code=404, detail="Attempt not found.")

        is_evaluated = attempt.status == AttemptStatus.EVALUATED
        has_report_json = bool(attempt.report_metadata_json)
        
        rep_stmt = select(ExamAttemptReport).where(ExamAttemptReport.attempt_id == attempt_id)
        existing_rep = (await self.session.exec(rep_stmt)).first()

        is_ready = is_evaluated or (has_report_json and existing_rep is not None)

        status_str = "COMPLETED" if is_ready else ("PROCESSING" if attempt.status in (AttemptStatus.SUBMITTED, AttemptStatus.EVALUATED) else (attempt.status.value if hasattr(attempt.status, 'value') else str(attempt.status)))
        progress = 100 if is_ready else (75 if attempt.status == AttemptStatus.SUBMITTED else 25)
        message = (
            "Psychometric and cognitive evaluation completed successfully."
            if is_ready
            else "Synthesizing 12 psychometric matrices, IRT latent ability, and AI mentorship guidance..."
        )

        return {
            "attempt_id": str(attempt_id),
            "status": status_str,
            "is_ready": is_ready,
            "progress_percentage": progress,
            "message": message,
            "submitted_at": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
            "raw_score": attempt.total_score,
            "total_questions": attempt.total_questions,
        }


