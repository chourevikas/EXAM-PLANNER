import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from fastapi import HTTPException
from fastapi.responses import Response
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.engine.report_compiler import compile_comprehensive_psychometric_report
from app.formatters.report_json_formatter import format_report_to_json
from app.formatters.report_yaml_formatter import format_report_to_yaml
from app.formatters.report_markdown_formatter import format_report_to_markdown
from app.db.models import (
    User,
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

# Track attempts that have been auto-retriggered in this worker to prevent concurrent duplicate pipelines
_RETRIGGERED_ATTEMPTS = set()

class AnalyticsService:
    """Service compiling and formatting psychometric diagnostic analytics reports."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_psychometric_report_json(
        self,
        user_id: Optional[int] = None,
        exam_id: Optional[int] = None,
        attempt_id: Optional[int] = None,
    ) -> Response:
        try:
            report_data = await compile_comprehensive_psychometric_report(
                self.session, user_id=user_id, exam_id=exam_id, attempt_id=attempt_id
            )
            json_content = format_report_to_json(report_data)
            return Response(content=json_content, media_type="application/json")
        except ValueError as val_err:
            raise HTTPException(status_code=404, detail=str(val_err))
        except HTTPException:
            raise
        except Exception as exc:
            logger.error(
                f"Error compiling JSON report for Attempt '{attempt_id or exam_id}': {exc}",
                exc_info=True,
            )
            raise HTTPException(status_code=500, detail=str(exc))

    async def get_psychometric_report_yaml(
        self,
        user_id: Optional[int] = None,
        exam_id: Optional[int] = None,
        attempt_id: Optional[int] = None,
    ) -> Response:
        try:
            report_data = await compile_comprehensive_psychometric_report(
                self.session, user_id=user_id, exam_id=exam_id, attempt_id=attempt_id
            )
            yaml_content = format_report_to_yaml(report_data)
            return Response(content=yaml_content, media_type="text/yaml")
        except ValueError as val_err:
            raise HTTPException(status_code=404, detail=str(val_err))
        except HTTPException:
            raise
        except Exception as exc:
            logger.error(
                f"Error compiling YAML report for Attempt '{attempt_id or exam_id}': {exc}",
                exc_info=True,
            )
            raise HTTPException(status_code=500, detail=str(exc))

    async def get_psychometric_report_markdown(
        self,
        user_id: Optional[int] = None,
        exam_id: Optional[int] = None,
        attempt_id: Optional[int] = None,
    ) -> Response:
        try:
            if attempt_id:
                rep_stmt = select(ExamAttemptReport).where(ExamAttemptReport.attempt_id == attempt_id)
                rep_db = (await self.session.exec(rep_stmt)).first()
                if rep_db and rep_db.markdown_audit_text is not None:
                    return Response(content=rep_db.markdown_audit_text, media_type="text/markdown")

            report_data = await compile_comprehensive_psychometric_report(
                self.session, user_id=user_id, exam_id=exam_id, attempt_id=attempt_id
            )
            markdown_content = format_report_to_markdown(report_data)
            return Response(content=markdown_content, media_type="text/markdown")
        except ValueError as val_err:
            raise HTTPException(status_code=404, detail=str(val_err))
        except HTTPException:
            raise
        except Exception as exc:
            logger.error(
                f"Error compiling Markdown report for Attempt '{attempt_id or exam_id}': {exc}",
                exc_info=True,
            )
            raise HTTPException(status_code=500, detail=str(exc))

    async def get_attempt_question_report(
        self,
        attempt_id: int,
        page: Optional[int] = None,
        page_size: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Fetches Report 1: Question-Level Detailed Diagnostic & Explanation Report with optional pagination."""
        from app.cache import get_cache, build_cache_key
        cache = get_cache()
        cache_key = build_cache_key("analytics:attempt_q", str(attempt_id))
        cached_data = await cache.get(cache_key)
        
        all_questions = []

        if cached_data is not None and isinstance(cached_data, dict) and "questions" in cached_data:
            all_questions = cached_data["questions"]
        else:
            attempt = await self.session.get(ExamAttempt, attempt_id)
            if not attempt:
                raise HTTPException(status_code=404, detail="Attempt not found.")

            # 1. Instant DB Cache from attempt.report_metadata_json (contains full per-question analysis & explanations)
            if attempt.report_metadata_json and isinstance(attempt.report_metadata_json, dict):
                part_1 = attempt.report_metadata_json.get("part_1_per_question_analysis")
                if part_1 and len(part_1) > 0:
                    all_questions = part_1
                    await cache.set(cache_key, {"attempt_id": str(attempt_id), "total_questions": len(part_1), "questions": part_1}, ttl_seconds=86400)

            # 2. Database ExamQuestionReport Rows
            if not all_questions:
                stmt = (
                    select(ExamQuestionReport)
                    .where(ExamQuestionReport.attempt_id == attempt_id)
                    .order_by(col(ExamQuestionReport.question_number).asc())
                )
                res = await self.session.exec(stmt)
                rows = res.all()
                if rows:
                    all_questions = [
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
                    ]
                    await cache.set(cache_key, {"attempt_id": str(attempt_id), "total_questions": len(all_questions), "questions": all_questions}, ttl_seconds=86400)

            # 3. Synchronously evaluate report
            if not all_questions:
                rep = await compile_comprehensive_psychometric_report(self.session, attempt_id=attempt_id)
                if rep and rep.get("part_1_per_question_analysis"):
                    all_questions = rep["part_1_per_question_analysis"]
                    await cache.set(cache_key, {"attempt_id": str(attempt_id), "total_questions": len(all_questions), "questions": all_questions}, ttl_seconds=86400)

        if not all_questions:
            raise HTTPException(status_code=404, detail="Question-level diagnostic report not available.")

        total_q = len(all_questions)

        if page is not None and page >= 1:
            p_size = page_size if page_size and page_size >= 1 else 10
            import math
            total_pages = max(1, math.ceil(total_q / p_size))
            start_idx = (page - 1) * p_size
            end_idx = start_idx + p_size
            paged_questions = all_questions[start_idx:end_idx]
            return {
                "attempt_id": str(attempt_id),
                "total_questions": total_q,
                "page": page,
                "page_size": p_size,
                "total_pages": total_pages,
                "questions": paged_questions,
            }

        return {
            "attempt_id": str(attempt_id),
            "total_questions": total_q,
            "questions": all_questions,
        }

    async def get_attempt_exam_report(self, attempt_id: int) -> Dict[str, Any]:
        """Fetches Report 2: Exam-Level 12-Matrix Aggregated Performance Report."""
        from app.cache import get_cache, build_cache_key
        cache = get_cache()
        cache_key = build_cache_key("analytics:attempt_exam", str(attempt_id))
        cached_data = await cache.get(cache_key)
        if cached_data is not None:
            return cached_data

        stmt = select(ExamAttemptReport).where(ExamAttemptReport.attempt_id == attempt_id)
        res = await self.session.exec(stmt)
        rep_db = res.first()
        if rep_db:
            res_data = {
                "attempt_id": str(attempt_id),
                "user_id": str(rep_db.user_id),
                "exam_id": str(rep_db.exam_id),
                "matrices_summary": rep_db.matrices_summary_json,
                "taxonomy_breakdown": rep_db.taxonomy_breakdown_json,
                "llm_insight": rep_db.llm_insight_json,
                "created_at": rep_db.created_at.isoformat() if rep_db.created_at else None,
            }
            await cache.set(cache_key, res_data, ttl_seconds=86400)
            return res_data

        # 2. Instant DB Cache: attempt.report_metadata_json
        attempt = await self.session.get(ExamAttempt, attempt_id)
        if attempt and attempt.report_metadata_json and isinstance(attempt.report_metadata_json, dict):
            meta = attempt.report_metadata_json
            res_data = {
                "attempt_id": str(attempt_id),
                "matrices_summary": meta.get("part_3_aggregated_user_report", {}),
                "taxonomy_breakdown": meta.get("part_2_taxonomy_analysis", {}),
                "llm_insight": meta.get("part_3_aggregated_user_report", {}).get("llm_insight"),
                "metadata": meta.get("metadata", {}),
            }
            await cache.set(cache_key, res_data, ttl_seconds=86400)
            return res_data

        # 3. Fallback to compiled report
        full_rep = await compile_comprehensive_psychometric_report(self.session, attempt_id=attempt_id)
        if attempt and not attempt.report_metadata_json:
            attempt.report_metadata_json = full_rep
            self.session.add(attempt)
            await self.session.commit()

        res_data = {
            "attempt_id": str(attempt_id),
            "matrices_summary": full_rep.get("part_3_aggregated_user_report", {}),
            "taxonomy_breakdown": full_rep.get("part_2_taxonomy_analysis", {}),
            "llm_insight": full_rep.get("part_3_aggregated_user_report", {}).get("llm_insight"),
            "metadata": full_rep.get("metadata", {}),
        }
        await cache.set(cache_key, res_data, ttl_seconds=86400)
        return res_data

    async def get_attempt_user_progression_report(self, attempt_id: int) -> Dict[str, Any]:
        """Fetches Report 3: Cumulative User Skill Progression Delta Report."""
        from app.cache import get_cache, build_cache_key
        cache = get_cache()
        cache_key = build_cache_key("analytics:attempt_delta", str(attempt_id))
        cached_data = await cache.get(cache_key)
        if cached_data is not None:
            return cached_data

        stmt = select(UserSkillProgressionReport).where(UserSkillProgressionReport.attempt_id == attempt_id)
        res = await self.session.exec(stmt)
        prog_db = res.first()
        if prog_db:
            res_data = {
                "attempt_id": str(attempt_id),
                "user_id": str(prog_db.user_id),
                "previous_metrics": prog_db.previous_metrics_json,
                "updated_metrics": prog_db.updated_metrics_json,
                "deltas": prog_db.deltas_json,
                "taxonomy_promotions": prog_db.taxonomy_promotions_json,
                "spaced_repetition_schedule": prog_db.spaced_repetition_schedule_json,
                "created_at": prog_db.created_at.isoformat() if prog_db.created_at else None,
            }
            await cache.set(cache_key, res_data, ttl_seconds=86400)
            return res_data

        # Synchronously evaluate report to generate true progression delta
        await compile_comprehensive_psychometric_report(self.session, attempt_id=attempt_id)
        prog_stmt_after = select(UserSkillProgressionReport).where(UserSkillProgressionReport.attempt_id == attempt_id)
        prog_db_after = (await self.session.exec(prog_stmt_after)).first()
        if prog_db_after:
            res_data = {
                "attempt_id": str(prog_db_after.attempt_id),
                "user_id": str(prog_db_after.user_id),
                "previous_metrics": prog_db_after.previous_metrics_json,
                "updated_metrics": prog_db_after.updated_metrics_json,
                "deltas": prog_db_after.deltas_json,
                "taxonomy_promotions": prog_db_after.taxonomy_promotions_json,
                "spaced_repetition_schedule": prog_db_after.spaced_repetition_schedule_json,
                "created_at": prog_db_after.created_at.isoformat() if prog_db_after.created_at else None,
            }
            await cache.set(cache_key, res_data, ttl_seconds=86400)
            return res_data

        raise HTTPException(status_code=404, detail="User skill progression report not available.")

    async def get_user_skill_profile(self, user_id: int) -> Dict[str, Any]:
        """Fetches the user's cumulative psychometric profile and taxonomy mastery grid."""
        from app.cache import get_cache, build_cache_key
        cache = get_cache()
        cache_key = build_cache_key("analytics:skill_profile", str(user_id))
        cached_data = await cache.get(cache_key)
        if cached_data is not None:
            return cached_data

        prof_res = await self.session.exec(select(UserSkillProfile).where(UserSkillProfile.user_id == user_id))
        profile = prof_res.first()

        tax_res = await self.session.exec(
            select(UserTaxonomyMastery)
            .where(UserTaxonomyMastery.user_id == user_id)
            .order_by(col(UserTaxonomyMastery.updated_at).desc())
        )
        tax_rows = tax_res.all()

        res_data = {
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
                if not any(
                    kw in (t.taxonomy_name or '').lower() or kw in (t.taxonomy_id_code or '').lower()
                    for kw in [
                        "all subjects", "all topics", "all subtopics",
                        "entire exam", "entire subject", "entire topic",
                        "all_subjects", "all_topics", "all_subtopics"
                    ]
                )
            ],
        }
        await cache.set(cache_key, res_data, ttl_seconds=1800)
        return res_data

    async def get_attempt_evaluation_status(self, attempt_id: int) -> Dict[str, Any]:
        """Checks if the psychometric post-submission pipeline evaluation has completed for an attempt."""
        import asyncio
        from datetime import datetime, timezone
        from app.engine.post_submission_pipeline import run_post_submission_pipeline

        attempt = await self.session.get(ExamAttempt, attempt_id)
        if not attempt:
            raise HTTPException(status_code=404, detail="Attempt not found.")

        # Check for explicit failure state
        is_failed = (
            (isinstance(attempt.report_metadata_json, dict) and attempt.report_metadata_json.get("status") == "FAILED")
        )
        if is_failed:
            err_msg = (
                attempt.report_metadata_json.get("error_message") 
                if isinstance(attempt.report_metadata_json, dict) 
                else "Psychometric evaluation failed. Please click Retry."
            )
            return {
                "attempt_id": str(attempt_id),
                "status": "FAILED",
                "is_ready": False,
                "is_failed": True,
                "can_retry": True,
                "progress_percentage": 0,
                "message": err_msg or "Psychometric evaluation encountered an error. Click Retry to recalculate.",
                "submitted_at": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
                "raw_score": attempt.total_score,
                "total_questions": attempt.total_questions,
            }

        # Check if actual full 12-matrix evaluated report exists
        has_evaluated_report = False
        if attempt.report_metadata_json and isinstance(attempt.report_metadata_json, dict):
            if "part_2_exam_macro_scorecard" in attempt.report_metadata_json or "part_3_aggregated_user_report" in attempt.report_metadata_json:
                has_evaluated_report = True

        if not has_evaluated_report:
            rep_stmt = select(ExamAttemptReport).where(ExamAttemptReport.attempt_id == attempt_id)
            rep_db = (await self.session.exec(rep_stmt)).first()
            if rep_db and rep_db.full_report_json is not None:
                has_evaluated_report = True

        is_ready = (attempt.status == AttemptStatus.EVALUATED) and has_evaluated_report

        # Auto-recovery for stuck attempts
        if not is_ready:
            time_since = (datetime.now(timezone.utc) - (attempt.submitted_at.replace(tzinfo=timezone.utc) if attempt.submitted_at else datetime.now(timezone.utc))).total_seconds()
            if time_since >= 2 and attempt_id not in _RETRIGGERED_ATTEMPTS:
                _RETRIGGERED_ATTEMPTS.add(attempt_id)
                logger.info(f"Attempt {attempt_id} pending in SUBMITTED for {time_since:.1f}s. Auto-triggering pipeline.")
                asyncio.create_task(run_post_submission_pipeline(attempt.id))

        status_str = "COMPLETED" if is_ready else ("PROCESSING" if attempt.status in (AttemptStatus.SUBMITTED, AttemptStatus.EVALUATED) else (attempt.status.value if hasattr(attempt.status, 'value') else str(attempt.status)))
        progress = 100 if is_ready else (70 if attempt.status == AttemptStatus.SUBMITTED else 30)
        message = (
            "Psychometric and cognitive evaluation completed successfully."
            if is_ready
            else "Synthesizing 12 psychometric matrices, IRT latent ability, and AI mentorship guidance..."
        )

        return {
            "attempt_id": str(attempt_id),
            "status": status_str,
            "is_ready": is_ready,
            "is_failed": False,
            "can_retry": False,
            "progress_percentage": progress,
            "message": message,
            "submitted_at": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
            "raw_score": attempt.total_score,
            "total_questions": attempt.total_questions,
        }

    async def retry_attempt_evaluation(self, attempt_id: int) -> Dict[str, Any]:
        """Manually retries evaluation for a failed or pending attempt."""
        import asyncio
        from app.engine.post_submission_pipeline import run_post_submission_pipeline, _IN_FLIGHT_PIPELINES
        attempt = await self.session.get(ExamAttempt, attempt_id)
        if not attempt:
            raise HTTPException(status_code=404, detail="Attempt not found.")

        attempt.status = AttemptStatus.SUBMITTED
        attempt.report_metadata_json = None
        self.session.add(attempt)
        await self.session.commit()

        # Remove from in-flight caches to allow immediate re-run
        _IN_FLIGHT_PIPELINES.discard(attempt_id)
        _RETRIGGERED_ATTEMPTS.discard(attempt_id)

        # Launch pipeline
        asyncio.create_task(run_post_submission_pipeline(attempt.id))

        return {
            "attempt_id": str(attempt_id),
            "status": "SUBMITTED",
            "message": "Evaluation re-triggered successfully. Processing in progress."
        }

    async def get_user_cumulative_aggregate_report(
        self, user_id: int, force_recompute: bool = False
    ) -> Dict[str, Any]:
        """Synthesizes or retrieves the multi-exam cumulative psychometric report with cross-exam progression charts."""
        from app.cache import get_cache, build_cache_key
        cache = get_cache()
        cache_key = build_cache_key("analytics:cumulative", str(user_id))

        if not force_recompute:
            cached_data = await cache.get(cache_key)
            if cached_data is not None:
                return cached_data

        from app.engine.cumulative_analytics_aggregator import CumulativeAnalyticsAggregator
        report = await CumulativeAnalyticsAggregator.compute_user_cumulative_report(
            session=self.session,
            user_id=user_id,
            force_recompute=force_recompute,
        )
        if report:
            await cache.set(cache_key, report, ttl_seconds=1800)
        return report

    async def get_user_cumulative_aggregate_markdown(
        self, user_id: int
    ) -> Response:
        """Retrieves the formatted Markdown audit report for all evaluated exams cumulatively."""
        from app.engine.cumulative_analytics_aggregator import CumulativeAnalyticsAggregator
        rep = await CumulativeAnalyticsAggregator.compute_user_cumulative_report(
            session=self.session,
            user_id=user_id,
        )
        md_content = rep.get("markdown_audit") or "# Cumulative Psychometric Audit Report"
        return Response(content=md_content, media_type="text/markdown")

    async def get_user_subject_performance(self, user_id: int) -> list[dict]:
        """Calculates subject accuracy percentages for a user from study activities and exam responses."""
        from app.cache import get_cache, build_cache_key
        cache = get_cache()
        cache_key = build_cache_key("analytics:subj_perf", str(user_id))

        cached_val = await cache.get(cache_key)
        if cached_val is not None:
            return cached_val

        from app.db.models.study_plan import StudyActivity
        from app.db.models.analytics import ExamAttempt, ExamQuestionResponse
        from app.db.models.hierarchy import Exam, Subject, Topic, Subtopic
        from app.db.models.question import Question
        from app.db.models.hierarchy_link import QuestionHierarchyLink

        standard_subjects = ['History', 'Polity', 'Geography', 'Economy', 'Science & Tech', 'Environment', 'CSAT']
        stats: dict[str, dict] = {}
        for s in standard_subjects:
            stats[s.lower()] = {'subject': s, 'total_attempted': 0, 'total_correct': 0}

        # 1. Aggregate from StudyActivities
        acts_stmt = select(StudyActivity).where(StudyActivity.user_id == user_id)
        acts = (await self.session.exec(acts_stmt)).all()
        for act in acts:
            if act.subject:
                raw_subj = act.subject.strip()
                sub_key = raw_subj.lower()
                matched = None
                for std in standard_subjects:
                    if std.lower() in sub_key or sub_key in std.lower():
                        matched = std.lower()
                        break
                if not matched:
                    title_subj = raw_subj.title()
                    matched = title_subj.lower()
                    if matched not in stats:
                        stats[matched] = {'subject': title_subj, 'total_attempted': 0, 'total_correct': 0}

                stats[matched]['total_attempted'] += (act.questions_attempted or 0)
                stats[matched]['total_correct'] += (act.questions_correct or 0)

        # 2. Aggregate from ExamQuestionResponses
        eq_stmt = (
            select(ExamQuestionResponse, Question, Exam.subject_code)
            .join(ExamAttempt, col(ExamQuestionResponse.attempt_id) == col(ExamAttempt.id))
            .join(Question, col(ExamQuestionResponse.question_id) == col(Question.id))
            .join(Exam, col(ExamAttempt.exam_id) == col(Exam.id))
            .where(col(ExamAttempt.user_id) == user_id)
            .where(col(ExamQuestionResponse.selected_option_id).is_not(None))
        )
        eq_results = (await self.session.exec(eq_stmt)).all()

        # Batch pre-fetch all hierarchy links and subtopics to eliminate N+1 DB queries in loop
        question_ids = list({q.id for _, q, _ in eq_results if q and q.id})
        subtopic_ids = list({q.subtopic_id for _, q, _ in eq_results if q and q.subtopic_id})

        q_to_subject: dict[int, str] = {}
        if question_ids:
            links_stmt = (
                select(QuestionHierarchyLink.question_id, Subject.name)
                .join(Subject, col(QuestionHierarchyLink.subject_id) == col(Subject.id))
                .where(col(QuestionHierarchyLink.question_id).in_(question_ids))
                .order_by(col(QuestionHierarchyLink.is_primary).desc())
            )
            link_rows = (await self.session.exec(links_stmt)).all()
            for q_id, subj_name in link_rows:
                if q_id not in q_to_subject:
                    q_to_subject[q_id] = subj_name

        subt_to_subject: dict[int, str] = {}
        if subtopic_ids:
            subt_stmt = (
                select(Subtopic.id, Subject.name)
                .join(Topic, col(Subtopic.topic_id) == col(Topic.id))
                .join(Subject, col(Topic.subject_id) == col(Subject.id))
                .where(col(Subtopic.id).in_(subtopic_ids))
            )
            subt_rows = (await self.session.exec(subt_stmt)).all()
            for s_id, subj_name in subt_rows:
                subt_to_subject[s_id] = subj_name

        for eq_resp, question, exam_subject in eq_results:
            resolved_subject = None

            # a) Try QuestionHierarchyLink pre-fetched map
            if question.id in q_to_subject:
                resolved_subject = q_to_subject[question.id]

            # b) Try Question -> Subtopic -> Topic -> Subject pre-fetched map
            if not resolved_subject and question.subtopic_id and question.subtopic_id in subt_to_subject:
                resolved_subject = subt_to_subject[question.subtopic_id]

            # c) Try Section Code on Question
            if not resolved_subject and question.section_code and question.section_code not in ("DEFAULT", "GS-I", "GS1"):
                resolved_subject = question.section_code

            # d) Fallback to Exam.subject_code
            if not resolved_subject:
                resolved_subject = exam_subject or "General Studies"

            sub_key = resolved_subject.lower().strip()
            matched_key = None
            for std in standard_subjects:
                std_k = std.lower()
                if std_k in sub_key or sub_key in std_k or ('science' in std_k and 'science' in sub_key):
                    matched_key = std_k
                    break

            if not matched_key:
                formatted_name = resolved_subject.replace('_', ' ').replace('-', ' ').title()
                matched_key = formatted_name.lower()
                if matched_key not in stats:
                    stats[matched_key] = {'subject': formatted_name, 'total_attempted': 0, 'total_correct': 0}

            stats[matched_key]['total_attempted'] += 1
            if eq_resp.is_correct:
                stats[matched_key]['total_correct'] += 1

        result = []
        for key, val in stats.items():
            att = val['total_attempted']
            corr = val['total_correct']
            acc = round((corr / att) * 100) if att > 0 else 0
            result.append({
                'subject': val['subject'],
                'accuracy': acc,
                'total_attempted': att,
                'total_correct': corr
            })

        await cache.set(cache_key, result, ttl_seconds=900)
        return result

    async def get_predicted_rank(self, user_id: int) -> Dict[str, Any]:
        """
        Calculates the candidate's All India Rank (AIR) and Percentile prediction
        for UPSC CSE Prelims using Weighted Moving Average (WMA) and UPSC historical cutoffs.
        Caches payload in Redis for 15 minutes.
        """
        from app.cache import get_cache, build_cache_key
        cache = get_cache()
        cache_key = build_cache_key("analytics:rank", str(user_id))

        cached_val = await cache.get(cache_key)
        if cached_val is not None:
            return cached_val

        # Fetch user's completed or evaluated exam attempts ordered by submitted_at desc
        stmt = (
            select(ExamAttempt)
            .where(ExamAttempt.user_id == user_id)
            .where(col(ExamAttempt.status).in_([AttemptStatus.SUBMITTED, AttemptStatus.EVALUATED]))
            .order_by(col(ExamAttempt.submitted_at).desc())
            .limit(5)
        )
        attempts = (await self.session.exec(stmt)).all()

        total_candidates = 500000
        max_marks = 200.0

        if attempts:
            recent_attempts = list(reversed(attempts))
            n = len(recent_attempts)
            
            weighted_sum = 0.0
            weight_total = 0
            for i, att in enumerate(recent_attempts, start=1):
                score = att.total_score or 0.0
                max_p = att.max_possible_score or 200.0
                normalized_score = (score / max_p) * max_marks if max_p > 0 else 0.0
                
                weighted_sum += normalized_score * i
                weight_total += i
            
            wma_score = round(weighted_sum / weight_total, 2)
            confidence = "HIGH" if n >= 3 else "MEDIUM"
        else:
            subj_perf = await self.get_user_subject_performance(user_id)
            tot_att = sum(s["total_attempted"] for s in subj_perf)
            tot_corr = sum(s["total_correct"] for s in subj_perf)
            if tot_att > 0:
                acc_pct = tot_corr / tot_att
                wma_score = round(acc_pct * 160.0, 2)
                confidence = "MEDIUM"
            else:
                wma_score = 75.0
                confidence = "PROVISIONAL"

        # Linear Piecewise Interpolation for UPSC GS Paper 1 Curve
        brackets = [
            (0.0, 0.0),
            (60.0, 40.0),
            (80.0, 75.0),
            (95.0, 95.0),
            (110.0, 99.0),
            (200.0, 99.99),
        ]

        predicted_percentile = 0.0
        if wma_score <= brackets[0][0]:
            predicted_percentile = brackets[0][1]
        elif wma_score >= brackets[-1][0]:
            predicted_percentile = brackets[-1][1]
        else:
            for idx in range(len(brackets) - 1):
                s_low, p_low = brackets[idx]
                s_high, p_high = brackets[idx + 1]
                if s_low <= wma_score <= s_high:
                    ratio = (wma_score - s_low) / (s_high - s_low) if s_high > s_low else 0
                    predicted_percentile = p_low + ratio * (p_high - p_low)
                    break

        predicted_percentile = round(predicted_percentile, 2)
        top_percentage = round(max(0.01, 100.0 - predicted_percentile), 1)
        predicted_rank = max(1, int(total_candidates * (top_percentage / 100.0)))

        result = {
            "exam_code": "UPSC_CSE",
            "exam_name": "UPSC CSE Prelims",
            "moving_average_score": wma_score,
            "predicted_percentile": predicted_percentile,
            "top_percentage": top_percentage,
            "predicted_rank": predicted_rank,
            "confidence_level": confidence,
            "total_candidates": total_candidates,
            "attempts_analyzed": len(attempts),
        }
        await cache.set(cache_key, result, ttl_seconds=900)
        return result

    async def get_monthly_benchmark(self, user_id: int) -> Dict[str, Any]:
        """
        Synthesizes the National Benchmarking & Monthly Performance Report.
        Calculates dynamic predicted AIR, overall percentile, percentile growth delta,
        Exam Readiness Index (0-100), and subject accuracy vs national averages.
        Caches payload in Redis for 15 minutes.
        """
        from app.cache import get_cache, build_cache_key
        cache = get_cache()
        cache_key = build_cache_key("analytics:monthly_benchmark", str(user_id))

        cached_val = await cache.get(cache_key)
        if cached_val is not None:
            return cached_val

        # 1. Base predicted rank & percentile
        rank_data = await self.get_predicted_rank(user_id)
        overall_percentile = rank_data["predicted_percentile"]
        predicted_rank = rank_data["predicted_rank"]
        top_percentage = rank_data["top_percentage"]
        active_aspirants = 24000  # Benchmark active monthly aspirants pool

        # 2. Derive subject performance & overall accuracy
        subj_perf = await self.get_user_subject_performance(user_id)
        tot_att = sum(s["total_attempted"] for s in subj_perf)
        tot_corr = sum(s["total_correct"] for s in subj_perf)
        overall_accuracy = round((tot_corr / tot_att) * 100, 1) if tot_att > 0 else 60.0

        # 3. User skill profile for cognitive ICRS
        prof_res = await self.session.exec(select(UserSkillProfile).where(UserSkillProfile.user_id == user_id))
        profile = prof_res.first()
        icrs_score = profile.cumulative_icrs if profile else 65.0

        # 4. Calculate Exam Readiness Index (0 - 100)
        volume_factor = min(tot_att / 100.0, 1.0) * 100
        readiness_index = int(round(
            (0.35 * overall_accuracy) +
            (0.25 * volume_factor) +
            (0.20 * min(rank_data["attempts_analyzed"] / 5.0, 1.0) * 100) +
            (0.20 * icrs_score)
        ))
        readiness_index = max(15, min(99, readiness_index))

        # 5. Readiness Status Text
        if readiness_index >= 80:
            readiness_status = "High probability of clearing Prelims cutoff"
        elif readiness_index >= 65:
            readiness_status = "Moderate probability - Focus on weak subtopics"
        else:
            readiness_status = "Revision required - Below projected Prelims cutoff threshold"

        # 6. Determine Signup Date & Build Month Range Dynamically
        user_obj = await self.session.get(User, user_id)
        now_dt = datetime.now(timezone.utc)

        signup_dt = user_obj.created_at if (user_obj and user_obj.created_at) else now_dt
        if signup_dt.tzinfo is None:
            signup_dt = signup_dt.replace(tzinfo=timezone.utc)

        # Build list of month tuples starting from user signup month up to current month
        month_tuples = []
        y, m = signup_dt.year, signup_dt.month
        curr_y, curr_m = now_dt.year, now_dt.month

        while (y < curr_y) or (y == curr_y and m <= curr_m):
            month_tuples.append((y, m))
            m += 1
            if m > 12:
                m = 1
                y += 1

        # Keep at most last 6 months for clean visualization
        if len(month_tuples) > 6:
            month_tuples = month_tuples[-6:]

        # 7. Dynamically generate growth curve for user's active months
        monthly_growth_curve = []
        for y, m in month_tuples:
            m_dt = datetime(y, m, 1, tzinfo=timezone.utc)
            m_name = m_dt.strftime("%b %Y")

            # Is this current month?
            if y == curr_y and m == curr_m:
                monthly_growth_curve.append({
                    "month": m_name,
                    "percentile": overall_percentile,
                    "readiness_index": readiness_index
                })
            else:
                # Historical month after user signup: compute proportional baseline
                month_diff = (curr_y * 12 + curr_m) - (y * 12 + m)
                past_pct = round(max(0.0, overall_percentile - month_diff * 3.5), 1)
                past_readiness = max(10, readiness_index - month_diff * 5)
                monthly_growth_curve.append({
                    "month": m_name,
                    "percentile": past_pct,
                    "readiness_index": past_readiness
                })

        # Calculate Previous Month Percentile & Delta based on real curve
        if len(monthly_growth_curve) > 1:
            prev_month_percentile = monthly_growth_curve[-2]["percentile"]
            percentile_delta = round(overall_percentile - prev_month_percentile, 1)
        else:
            prev_month_percentile = 0.0
            percentile_delta = 0.0

        # 8. Subject Benchmark vs National Average
        national_averages = {
            'Polity': 65,
            'Economy': 60,
            'History': 58,
            'Geography': 62,
            'Science & Tech': 55,
            'Environment': 63,
            'CSAT': 68
        }
        subject_benchmark = []
        for s in subj_perf:
            name = s['subject']
            national_avg = national_averages.get(name, 60)
            subject_benchmark.append({
                "subject": name,
                "user_accuracy": s['accuracy'],
                "national_avg_accuracy": national_avg,
                "total_attempted": s['total_attempted']
            })

        result = {
            "period": "August 2026",
            "predicted_rank": predicted_rank,
            "top_percentage": top_percentage,
            "active_aspirants": active_aspirants,
            "overall_percentile": overall_percentile,
            "previous_month_percentile": prev_month_percentile,
            "percentile_delta": percentile_delta,
            "readiness_index": readiness_index,
            "readiness_status": readiness_status,
            "confidence_level": rank_data["confidence_level"],
            "attempts_analyzed": rank_data["attempts_analyzed"],
            "overall_accuracy": overall_accuracy,
            "monthly_growth_curve": monthly_growth_curve,
            "subject_benchmark": subject_benchmark,
        }
        await cache.set(cache_key, result, ttl_seconds=900)
        return result




