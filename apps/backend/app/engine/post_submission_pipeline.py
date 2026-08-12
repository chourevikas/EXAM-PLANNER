import json
import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models import (
    User,
    Exam,
    Question,
    Subtopic,
    ExamAttempt,
    ExamQuestionResponse,
    UserMemoryState,
    UserConceptRetention,
    UserSkillProfile,
    UserTaxonomyMastery,
    StudyTask,
)
from app.db.models.enums import AttemptStatus
from app.engine.matrix_orchestrator import MatrixOrchestrator
from app.engine.matrices.fsrs_retention import FSRSEngine
from app.storage.factory import get_storage_provider
from app.db.session import managed_async_session
from app.config.logger import setup_logger

logger = setup_logger("PostSubmissionPipeline")


async def run_post_submission_pipeline(attempt_id: uuid.UUID) -> None:
    """
    Asynchronous post-submission pipeline triggered after exam submission:
    1. Executes mode-aware mathematical matrix engine via `MatrixOrchestrator` (zero LLM).
    2. Updates DB records: `ExamAttempt`, `UserSkillProfile`, `UserTaxonomyMastery`, `UserMemoryState`.
    3. Saves 3-part report JSON to S3 / local storage at `exams/{exam_code}/reports/{attempt_id}_report.json`.
    4. Executes **1 single LLM call** to generate personalized diagnostic insight & recommendations.
    5. Updates `ExamAttempt.report_metadata_json["llm_insight"]` and sets `status = EVALUATED`.
    """
    logger.info(f"Starting post-submission pipeline for attempt '{attempt_id}'...")

    async with managed_async_session() as session:
        # 1. Fetch Attempt
        attempt = await session.get(ExamAttempt, attempt_id)
        if not attempt:
            logger.error(f"Attempt '{attempt_id}' not found for post-submission pipeline.")
            return

        user = await session.get(User, attempt.user_id)
        exam = await session.get(Exam, attempt.exam_id)

        if not user or not exam:
            logger.error(f"User or Exam missing for attempt '{attempt_id}'. Aborting pipeline.")
            return

        # Fetch responses
        resp_res = await session.exec(
            select(ExamQuestionResponse)
            .where(ExamQuestionResponse.attempt_id == attempt_id)
            .order_by(col(ExamQuestionResponse.created_at).asc())
        )
        responses_db = resp_res.all()

        if not responses_db:
            logger.warning(f"Attempt '{attempt_id}' has 0 response records.")
            return

        storage = get_storage_provider()

        # 2. Load Solutions JSON from S3 / Local storage
        s_rel_path = exam.solutions_json_path or f"exams/{exam.code}/exam_solutions.json"
        try:
            solutions_data = await storage.download_json(s_rel_path)
        except Exception as err:
            logger.warning(f"Could not load solutions JSON '{s_rel_path}': {err}. Falling back to empty dict.")
            solutions_data = {"questions": []}

        # 3. Load User Memories & User Profile
        mem_res = await session.exec(
            select(UserMemoryState).where(UserMemoryState.user_id == user.id)
        )
        user_memories = mem_res.all()
        topic_mem_records = []
        for m in user_memories:
            sub = await session.get(Subtopic, m.subtopic_id) if m.subtopic_id else None
            last_rev = m.last_reviewed_at.replace(tzinfo=timezone.utc) if m.last_reviewed_at.tzinfo is None else m.last_reviewed_at
            elapsed = (datetime.now(timezone.utc) - last_rev).total_seconds() / 86400.0
            topic_mem_records.append({
                "topic_name": sub.name if sub else "General Concepts",
                "stability": m.fsrs_stability,
                "last_reviewed_days_ago": round(max(0.1, elapsed), 1),
            })

        prof_res = await session.exec(
            select(UserSkillProfile).where(UserSkillProfile.user_id == user.id)
        )
        profile = prof_res.first()
        profile_dict = {
            "cumulative_icrs": profile.cumulative_icrs if profile else 65.0,
            "cumulative_irt_theta": profile.cumulative_irt_theta if profile else 0.0,
            "cumulative_gti": profile.cumulative_gti if profile else 0.20,
            "cumulative_oeei": profile.cumulative_oeei if profile else 0.70,
            "cumulative_satoi": profile.cumulative_satoi if profile else 85.0,
            "total_tests_given": profile.total_tests_given if profile else 0,
            "total_questions_answered": profile.total_questions_answered if profile else 0,
        }

        # Transform DB responses to dicts for orchestrator
        responses_payload = []
        for index, r in enumerate(responses_db, 1):
            responses_payload.append({
                "question_id": str(r.question_id),
                "question_number": index,
                "selected_option_id": str(r.selected_option_id) if r.selected_option_id else None,
                "is_correct": r.is_correct,
                "closeness_score_awarded": r.closeness_score_awarded,
                "final_score": r.final_score,
                "time_taken_seconds": r.time_taken_seconds,
                "expected_time_seconds": r.expected_time_seconds,
                "is_switched": r.is_switched,
                "initial_correct": False,  # Simplified fallback
                "gti_item_score": r.gti_item_score,
                "answer_revealed": r.answer_revealed,
            })

        # 4. Execute Mode-Aware Matrix Orchestrator
        report = MatrixOrchestrator.compute_full_report(
            attempt_id=attempt.id,
            mode=attempt.mode,
            responses=responses_payload,
            solutions_data=solutions_data,
            allocated_duration_minutes=float(exam.total_duration_minutes or 120),
            user_memory_records=topic_mem_records,
            candidate_info={"user_id": str(user.id), "full_name": user.full_name, "email": user.email},
            exam_info={"exam_id": str(exam.id), "exam_name": exam.name, "exam_code": exam.code},
            profile_data=profile_dict,
        )

        part_3 = report["part_3_aggregated_user_report"]

        # 5. Update Attempt fields in DB
        attempt.irt_theta = part_3["irt_3pl"]["latent_ability_theta"]
        attempt.gti_score = part_3["gti"]["aggregate"]
        attempt.oeei_score = part_3["oeei"]["oeei_score"]
        attempt.satoi_score = part_3["satoi"]["satoi_score"]
        attempt.icrs_score = part_3["icrs"]["icrs_score"]
        attempt.pacing_status = part_3["pacing"]["pacing_status"]
        session.add(attempt)

        # 6. Update UserSkillProfile
        if not profile:
            profile = UserSkillProfile(
                user_id=user.id,
                cumulative_irt_theta=attempt.irt_theta,
                cumulative_gti=attempt.gti_score,
                cumulative_oeei=attempt.oeei_score,
                cumulative_icrs=attempt.icrs_score,
                cumulative_satoi=attempt.satoi_score,
                total_tests_given=1,
                total_questions_answered=len(responses_db),
            )
        else:
            n = profile.total_tests_given + 1
            profile.cumulative_irt_theta = round((profile.cumulative_irt_theta * profile.total_tests_given + attempt.irt_theta) / n, 2)
            profile.cumulative_gti = round((profile.cumulative_gti * profile.total_tests_given + attempt.gti_score) / n, 4)
            profile.cumulative_oeei = round((profile.cumulative_oeei * profile.total_tests_given + attempt.oeei_score) / n, 2)
            profile.cumulative_icrs = round((profile.cumulative_icrs * profile.total_tests_given + attempt.icrs_score) / n, 1)
            profile.cumulative_satoi = round((profile.cumulative_satoi * profile.total_tests_given + attempt.satoi_score) / n, 1)
            profile.total_tests_given = n
            profile.total_questions_answered += len(responses_db)
            profile.updated_at = datetime.now(timezone.utc)
        session.add(profile)

        # 7. Update UserTaxonomyMastery & FSRS UserMemoryState
        tax_by_subj = report["part_2_taxonomy_analysis"]["by_subject"]
        tax_by_top = report["part_2_taxonomy_analysis"]["by_topic"]
        tax_by_sub = report["part_2_taxonomy_analysis"]["by_subtopic"]

        all_tax_items = [("SUBJECT", x) for x in tax_by_subj] + [("TOPIC", x) for x in tax_by_top] + [("SUBTOPIC", x) for x in tax_by_sub]

        for tax_type, item in all_tax_items:
            code_name = item["taxonomy_name"]
            existing_m = await session.exec(
                select(UserTaxonomyMastery).where(
                    UserTaxonomyMastery.user_id == user.id,
                    UserTaxonomyMastery.taxonomy_type == tax_type,
                    UserTaxonomyMastery.taxonomy_id_code == code_name,
                )
            )
            m_obj = existing_m.first()
            if not m_obj:
                m_obj = UserTaxonomyMastery(
                    user_id=user.id,
                    taxonomy_type=tax_type,
                    taxonomy_id_code=code_name,
                    taxonomy_name=code_name,
                    total_attempts=item["total_questions"],
                    correct_attempts=item["correct"],
                    mastery_percentage=item["accuracy_percentage"],
                    strength_status=item["strength_status"],
                )
            else:
                m_obj.total_attempts += item["total_questions"]
                m_obj.correct_attempts += item["correct"]
                m_obj.mastery_percentage = round((m_obj.correct_attempts / max(1, m_obj.total_attempts)) * 100.0, 1)
                m_obj.strength_status = "STRONG" if m_obj.mastery_percentage >= 75.0 else ("MODERATE" if m_obj.mastery_percentage >= 50.0 else "WEAK_REVISION_REQUIRED")
                m_obj.updated_at = datetime.now(timezone.utc)
        await session.commit()

        # 7b. Upsert FSRS UserMemoryState & UserConceptRetention
        now_t = datetime.now(timezone.utc)
        for resp in responses_db:
            q_obj = await session.get(Question, resp.question_id)
            if not q_obj:
                continue

            is_corr = resp.is_correct or False
            mem_stmt = select(UserMemoryState).where(
                UserMemoryState.user_id == user.id,
                UserMemoryState.question_id == resp.question_id,
            )
            mem_res = await session.exec(mem_stmt)
            mem_obj = mem_res.first()

            if not mem_obj:
                diff = 5.0 if not is_corr else 3.5
                stab = 1.0 if not is_corr else 3.0
                ret = 0.4 if not is_corr else 1.0
                mem_obj = UserMemoryState(
                    user_id=user.id,
                    question_id=resp.question_id,
                    subtopic_id=q_obj.subtopic_id,
                    fsrs_difficulty=diff,
                    fsrs_stability=stab,
                    retrievability=ret,
                    last_reviewed_at=now_t,
                    next_scheduled_review=now_t + timedelta(days=max(1, int(stab))),
                )
                session.add(mem_obj)
            else:
                if is_corr:
                    mem_obj.fsrs_stability = round(mem_obj.fsrs_stability * 1.5, 2)
                    mem_obj.fsrs_difficulty = max(1.0, round(mem_obj.fsrs_difficulty - 0.2, 2))
                    mem_obj.retrievability = 1.0
                else:
                    mem_obj.fsrs_stability = max(0.5, round(mem_obj.fsrs_stability * 0.6, 2))
                    mem_obj.fsrs_difficulty = min(10.0, round(mem_obj.fsrs_difficulty + 0.5, 2))
                    mem_obj.retrievability = 0.4
                mem_obj.last_reviewed_at = now_t
                mem_obj.next_scheduled_review = now_t + timedelta(days=max(1, int(mem_obj.fsrs_stability)))
                session.add(mem_obj)

            if q_obj.subtopic_id:
                ret_stmt = select(UserConceptRetention).where(
                    UserConceptRetention.user_id == user.id,
                    UserConceptRetention.subtopic_id == q_obj.subtopic_id,
                )
                ret_res = await session.exec(ret_stmt)
                ret_obj = ret_res.first()
                if not ret_obj:
                    ret_obj = UserConceptRetention(
                        user_id=user.id,
                        subtopic_id=q_obj.subtopic_id,
                        fsrs_difficulty=mem_obj.fsrs_difficulty,
                        fsrs_stability=mem_obj.fsrs_stability,
                        fsrs_retrievability=mem_obj.retrievability,
                        total_reviews=1,
                        lapses=0 if is_corr else 1,
                        last_reviewed_at=now_t,
                        next_scheduled_review=now_t + timedelta(days=max(1, int(mem_obj.fsrs_stability))),
                    )
                else:
                    ret_obj.total_reviews += 1
                    if not is_corr:
                        ret_obj.lapses += 1
                    ret_obj.fsrs_difficulty = mem_obj.fsrs_difficulty
                    ret_obj.fsrs_stability = mem_obj.fsrs_stability
                    ret_obj.fsrs_retrievability = mem_obj.retrievability
                    ret_obj.last_reviewed_at = now_t
                    ret_obj.next_scheduled_review = now_t + timedelta(days=max(1, int(mem_obj.fsrs_stability)))
                session.add(ret_obj)

        # 7c. Award Gamification Badges & XP
        try:
            from app.services.gamification_service import GamificationService
            g_service = GamificationService(session)
            await g_service.award_badge_if_eligible(user.id, "first_test_completed")
            if attempt.total_score and attempt.max_possible_score and attempt.total_score >= (attempt.max_possible_score * 0.75):
                await g_service.award_badge_if_eligible(user.id, "high_score_achiever")
            await g_service.award_xp_for_activity(user.id, "test_completion", xp_amount=150)
        except Exception as badge_err:
            logger.warning(f"Gamification badge processing error: {badge_err}")

        # 7d. Create Revision Tasks for Weak Topics
        for tax_type, item in all_tax_items:
            if item.get("strength_status") == "WEAK_REVISION_REQUIRED":
                t_name = item.get("taxonomy_name")
                st_stmt = select(StudyTask).where(
                    StudyTask.user_id == user.id,
                    StudyTask.title == f"Revision: {t_name}",
                    StudyTask.is_completed == False,
                )
                st_res = await session.exec(st_stmt)
                if not st_res.first():
                    task = StudyTask(
                        user_id=user.id,
                        title=f"Revision: {t_name}",
                        description=f"Automated revision task generated from weak area performance ({item.get('accuracy_percentage')}% accuracy) on {exam.name}.",
                        task_type="WEAK_AREA_REVISION",
                        priority="HIGH",
                        estimated_minutes=45,
                        due_date=now_t + timedelta(days=3),
                    )
                    session.add(task)

        await session.commit()

        # 8. Save full report JSON to storage
        report_s3_key = f"exams/{exam.code}/reports/{attempt.id}_report.json"
        try:
            await storage.upload_json(report, report_s3_key)
            logger.info(f"Saved full report JSON to storage key '{report_s3_key}'.")
        except Exception as s3_err:
            logger.warning(f"Could not upload report JSON to storage: {s3_err}")

        # 9. Execute 1 Single LLM Call for Personalized Aggregate Insights
        llm_insight = await _generate_single_llm_insight(
            user=user,
            exam=exam,
            attempt=attempt,
            part_3=part_3,
            taxonomy=report["part_2_taxonomy_analysis"],
        )

        # 10. Update attempt report_metadata_json and status = EVALUATED
        report["part_3_aggregated_user_report"]["llm_insight"] = llm_insight
        attempt.report_metadata_json = report
        attempt.status = AttemptStatus.EVALUATED
        session.add(attempt)
        await session.commit()

        logger.info(f"Post-submission pipeline completed for attempt '{attempt_id}'. Status set to EVALUATED.")


async def _generate_single_llm_insight(
    user: User,
    exam: Exam,
    attempt: ExamAttempt,
    part_3: Dict[str, Any],
    taxonomy: Dict[str, Any],
) -> Dict[str, Any]:
    """Generates a personalized aggregate report insight using 1 single LLM call."""
    try:
        from app.llm.factory import get_vision_llm
        from langchain_core.messages import SystemMessage, HumanMessage

        llm = get_vision_llm()

        strong_subjs = [s["taxonomy_name"] for s in taxonomy.get("by_subject", []) if s.get("strength_status") == "STRONG"]
        weak_subjs = [s["taxonomy_name"] for s in taxonomy.get("by_subject", []) if s.get("strength_status") == "WEAK_REVISION_REQUIRED"]

        prompt = f"""
You are an expert competitive exam mentor for RankEdge. Analyze this candidate's test performance:

CANDIDATE: {user.full_name}
EXAM: {exam.name} (Mode: {attempt.mode.value if hasattr(attempt.mode, 'value') else attempt.mode})
SCORE: {attempt.total_score} / {attempt.max_possible_score} (Accuracy: {part_3['score_summary']['accuracy_percentage']}%)
IRT LATENT ABILITY (Theta): {part_3['irt_3pl']['latent_ability_theta']} (Percentile: {part_3['irt_3pl']['percentile_rank']}%)
ICRS READINESS INDEX: {part_3['icrs']['icrs_score']}/100 ({part_3['icrs']['readiness_tier']})
PACING: {part_3['pacing']['pacing_status']} (Utilization: {part_3['pacing']['time_utilization_pct']}%)
GUESSING TENDENCY: {part_3['gti']['category']}
STRONG SUBJECTS: {', '.join(strong_subjs) if strong_subjs else 'None'}
WEAK SUBJECTS: {', '.join(weak_subjs) if weak_subjs else 'None'}

Return ONLY a valid JSON object with the following schema:
{{
  "strengths": ["bullet point 1", "bullet point 2"],
  "weaknesses": ["bullet point 1", "bullet point 2"],
  "recommendations": ["actionable advice 1", "actionable advice 2"],
  "closing": "One sentence motivational summary."
}}
"""

        messages = [
            SystemMessage(content="You are a strict JSON-emitting diagnostic AI mentor. Output valid JSON only."),
            HumanMessage(content=prompt),
        ]

        response = await llm.ainvoke(messages)
        res_text = response.content if hasattr(response, 'content') else str(response)

        # Clean JSON markdown fences if present
        cleaned = res_text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]

        parsed = json.loads(cleaned.strip())
        return parsed

    except Exception as exc:
        logger.warning(f"Single LLM insight generation encountered error: {exc}. Falling back to default insight.")
        return {
            "strengths": [
                f"Completed test within allocated duration of {exam.total_duration_minutes} minutes.",
                f"Earned a raw score of {attempt.total_score}.",
            ],
            "weaknesses": [
                "Focus on improving accuracy in weak subjects.",
                "Review distractor traps in missed questions.",
            ],
            "recommendations": [
                "Revise weak topics identified in taxonomy breakdown.",
                "Practice time management on long questions.",
            ],
            "closing": "Consistent practice leads to steady score improvements!",
        }
