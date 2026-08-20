import asyncio
import json
import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models import (
    User,
    Exam,
    Subject,
    Topic,
    Subtopic,
    Question,
    QuestionTranslation,
    QuestionOption,
    OptionTranslation,
    QuestionExplanation,
    ExamAttempt,
    ExamQuestionResponse,
    UserMemoryState,
    UserConceptRetention,
    UserSkillProfile,
    UserTaxonomyMastery,
    ExamQuestionReport,
    ExamAttemptReport,
    UserSkillProgressionReport,
    StudyTask,
)
from app.db.models.enums import AttemptStatus
from app.engine.matrix_orchestrator import MatrixOrchestrator
from app.engine.matrices.fsrs_retention import FSRSEngine
from app.storage.factory import get_storage_provider
from app.db.session import managed_async_session
from app.config.logger import setup_logger

logger = setup_logger("PostSubmissionPipeline")


async def load_exam_solutions_data(exam: Exam, session: AsyncSession, storage: Any) -> Dict[str, Any]:
    """
    Robust multi-tier solution resolver:
    Tier 1: S3 Solutions Folder (individual Q001.json, Q002.json... in artifacts/{code}/{set}/json/solutions or exams/{code}/solutions).
    Tier 2: Master S3 JSON file (exam.solutions_json_path or exams/{code}/exam_solutions.json).
    Tier 3: Dynamic Database fallback via ExamJsonBuilder or DB models.
    """
    paper_set = exam.paper_set_code or "SET_A"
    clean_set = str(paper_set).strip().lower().replace("_", "-")
    s_folder = exam.solutions_json_folder_path or f"artifacts/{exam.code}/{clean_set}/json/solutions"
    alt_folder = f"exams/{exam.code}/solutions"
    q_folder = exam.questions_json_folder_path or f"artifacts/{exam.code}/{clean_set}/json/questions"
    alt_q_folder = f"exams/{exam.code}/questions"
    s_rel_path = exam.solutions_json_path or f"exams/{exam.code}/exam_solutions.json"

    # Tier 1: Try S3 Solutions & Questions Folders with concurrent downloads
    try:
        questions_count = exam.total_questions or exam.extracted_questions_count or 100

        async def _fetch_q_and_sol(q_num: int):
            sol_data = None
            for s_prefix in [s_folder, alt_folder]:
                for pattern in [f"Q{q_num:03d}.json", f"Q{q_num:03d} Solution.json", f"Q{q_num}.json"]:
                    q_file = f"{s_prefix.rstrip('/')}/{pattern}"
                    try:
                        if await storage.exists(q_file):
                            sol_data = await storage.download_json(q_file)
                            if sol_data:
                                break
                    except Exception:
                        pass
                if sol_data:
                    break

            q_data = None
            for q_prefix in [q_folder, alt_q_folder]:
                for pattern in [f"Q{q_num:03d}.json", f"Q{q_num:03d} Question.json", f"Q{q_num}.json"]:
                    q_file = f"{q_prefix.rstrip('/')}/{pattern}"
                    try:
                        if await storage.exists(q_file):
                            q_data = await storage.download_json(q_file)
                            if q_data:
                                break
                    except Exception:
                        pass
                if q_data:
                    break

            if not sol_data and not q_data:
                return None

            merged = {}
            if q_data and isinstance(q_data, dict):
                merged.update(q_data)
            if sol_data and isinstance(sol_data, dict):
                merged.update(sol_data)

            # Ensure canonical keys
            if q_data and isinstance(q_data, dict):
                merged["question_text"] = q_data.get("text") or q_data.get("question_text") or merged.get("question_text")
                merged["options"] = q_data.get("options") or merged.get("options")
            merged["question_number"] = merged.get("question_number") or q_num
            return merged

        sol_tasks = [_fetch_q_and_sol(i) for i in range(1, questions_count + 1)]
        sol_results = await asyncio.gather(*sol_tasks, return_exceptions=True)
        sol_list = [r for r in sol_results if isinstance(r, dict) and r]

        if sol_list:
            logger.info(f"Loaded {len(sol_list)} question-solution pairs from S3 folders '{s_folder}' and '{q_folder}'.")
            return {
                "exam_id": str(exam.id),
                "exam_code": exam.code,
                "questions": sol_list,
            }
    except Exception as err:
        logger.warning(f"Tier 1 solutions folder '{s_folder}' failed: {err}")

    # Tier 2: Try Master S3 JSON
    try:
        if await storage.exists(s_rel_path):
            solutions_data = await storage.download_json(s_rel_path)
            if solutions_data and solutions_data.get("questions"):
                logger.info(f"Loaded solutions from master JSON '{s_rel_path}' ({len(solutions_data['questions'])} questions).")
                return solutions_data
    except Exception as err:
        logger.warning(f"Tier 2 master solutions JSON '{s_rel_path}' failed: {err}")

    # Tier 3: Dynamic Database Fallback
    try:
        from app.services.exam_json_builder import ExamJsonBuilder
        logger.info(f"Tier 3: Generating solutions data from database for exam '{exam.code}'...")
        builder = ExamJsonBuilder(session)
        res = await builder.generate_and_upload(exam.id)
        if res.get("solutions_json_path") and await storage.exists(res["solutions_json_path"]):
            solutions_data = await storage.download_json(res["solutions_json_path"])
            if solutions_data and solutions_data.get("questions"):
                return solutions_data
    except Exception as err:
        logger.error(f"Tier 3 DB solutions generation failed: {err}", exc_info=True)

    return {"exam_id": str(exam.id), "exam_code": exam.code, "questions": []}


async def run_post_submission_pipeline(
    attempt_id: uuid.UUID, session: Optional[AsyncSession] = None
) -> None:
    """
    Asynchronous post-submission pipeline triggered after exam submission:
    1. Executes mode-aware mathematical matrix engine via `MatrixOrchestrator` (zero LLM).
    2. Updates DB records: `ExamAttempt`, `UserSkillProfile`, `UserTaxonomyMastery`, `UserMemoryState`.
    3. Saves 3-part report JSON to S3 / local storage.
    4. Executes **1 single LLM call** to generate personalized diagnostic insight & recommendations.
    5. Updates `ExamAttempt.report_metadata_json["llm_insight"]` and sets `status = EVALUATED`.
    """
    logger.info(f"Starting post-submission pipeline for attempt '{attempt_id}'...")

    if session is not None:
        await _run_pipeline_core(session, attempt_id)
    else:
        async with managed_async_session() as managed_sess:
            await _run_pipeline_core(managed_sess, attempt_id)


async def _run_pipeline_core(session: AsyncSession, attempt_id: uuid.UUID) -> None:
    # 1. Fetch Attempt
    attempt = await session.get(ExamAttempt, attempt_id)
    if not attempt:
        logger.error(f"Attempt '{attempt_id}' not found for post-submission pipeline.")
        return

    if attempt.status == AttemptStatus.EVALUATED:
        logger.info(f"Attempt '{attempt_id}' is already EVALUATED. Skipping duplicate run.")
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

    # 2. Load Solutions JSON via robust multi-tier resolver
    solutions_data = await load_exam_solutions_data(exam, session, storage)

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
    sol_by_id = {}
    sol_by_num = {}
    for item in solutions_data.get("questions", []):
        if item.get("question_id"):
            sol_by_id[str(item["question_id"])] = item
        if item.get("question_number") is not None:
            try:
                sol_by_num[int(item["question_number"])] = item
            except (ValueError, TypeError):
                pass

    for index, r in enumerate(responses_db, 1):
        q_model = await session.get(Question, r.question_id)
        subtopic_obj = await session.get(Subtopic, q_model.subtopic_id) if q_model and q_model.subtopic_id else None
        topic_obj = await session.get(Topic, subtopic_obj.topic_id) if subtopic_obj and subtopic_obj.topic_id else None
        subject_obj = await session.get(Subject, topic_obj.subject_id) if topic_obj and topic_obj.subject_id else None
        
        opt_model = await session.get(QuestionOption, r.selected_option_id) if r.selected_option_id else None
        
        sol_item = sol_by_id.get(str(r.question_id))
        if not sol_item and q_model and q_model.question_number_in_paper:
            sol_item = sol_by_num.get(int(q_model.question_number_in_paper))
        if not sol_item:
            sol_item = sol_by_num.get(index, {})
        
        # Question text
        q_trans = (await session.exec(select(QuestionTranslation).where(QuestionTranslation.question_id == r.question_id))).first() if q_model else None
        q_text = (q_trans.question_text if q_trans and q_trans.question_text else None) or getattr(q_model, "text", None) or sol_item.get("question_text") or sol_item.get("text") or ""

        # Options list
        options_db = (await session.exec(select(QuestionOption).where(QuestionOption.question_id == r.question_id))).all() if q_model else []
        options_payload = []
        for o in options_db:
            o_trans = (await session.exec(select(OptionTranslation).where(OptionTranslation.option_id == o.id))).first()
            options_payload.append({
                "option_id": str(o.id),
                "option_label": o.option_label,
                "text": (o_trans.option_text if o_trans and o_trans.option_text else None) or getattr(o, "text_content", None) or getattr(o, "text", "") or f"Option {o.option_label}",
                "is_correct": o.is_correct,
            })
        if not options_payload or not any(opt.get("text") for opt in options_payload):
            options_payload = sol_item.get("options", [])
        
        # Explanation
        expl_obj = (await session.exec(select(QuestionExplanation).where(QuestionExplanation.question_id == r.question_id))).first() if q_model else None
        expl_dict = None
        if expl_obj:
            expl_dict = {
                "core_concept": expl_obj.core_concept,
                "detailed_solution": expl_obj.detailed_solution,
                "common_traps": expl_obj.common_traps_json,
                "key_takeaways": expl_obj.key_takeaways_json,
            }
        elif sol_item.get("explanation"):
            expl_dict = sol_item["explanation"]

        responses_payload.append({
            "question_id": str(r.question_id),
            "question_number": q_model.question_number_in_paper if q_model and q_model.question_number_in_paper else index,
            "question_text": q_text,
            "options": options_payload,
            "subject": subject_obj.name if subject_obj else sol_item.get("subject", "General Studies"),
            "topic": topic_obj.name if topic_obj else sol_item.get("topic", "General Knowledge"),
            "subtopic": subtopic_obj.name if subtopic_obj else sol_item.get("subtopic", "Core Concepts"),
            "difficulty": q_model.difficulty.value if q_model and hasattr(q_model.difficulty, 'value') else (q_model.difficulty if q_model else sol_item.get("difficulty", "MEDIUM")),
            "selected_option_id": str(r.selected_option_id) if r.selected_option_id else None,
            "user_selected_label": opt_model.option_label if opt_model else "Unattempted",
            "is_correct": r.is_correct,
            "closeness_score_awarded": r.closeness_score_awarded,
            "final_score": r.final_score,
            "time_taken_seconds": r.time_taken_seconds,
            "expected_time_seconds": r.expected_time_seconds,
            "is_switched": r.is_switched,
            "initial_correct": False,
            "gti_item_score": r.gti_item_score,
            "answer_revealed": r.answer_revealed,
            "explanation": expl_dict,
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

    # 6. Update UserSkillProfile (only counting actual attempted questions)
    actual_attempted_count = len([r for r in responses_db if r.selected_option_id is not None])
    if not profile:
        profile = UserSkillProfile(
            user_id=user.id,
            cumulative_irt_theta=attempt.irt_theta,
            cumulative_gti=attempt.gti_score,
            cumulative_oeei=attempt.oeei_score,
            cumulative_icrs=attempt.icrs_score,
            cumulative_satoi=attempt.satoi_score,
            total_tests_given=1,
            total_questions_answered=actual_attempted_count,
        )
    else:
        n = profile.total_tests_given + 1
        profile.cumulative_irt_theta = round((profile.cumulative_irt_theta * profile.total_tests_given + attempt.irt_theta) / n, 2)
        profile.cumulative_gti = round((profile.cumulative_gti * profile.total_tests_given + attempt.gti_score) / n, 4)
        profile.cumulative_oeei = round((profile.cumulative_oeei * profile.total_tests_given + attempt.oeei_score) / n, 2)
        profile.cumulative_icrs = round((profile.cumulative_icrs * profile.total_tests_given + attempt.icrs_score) / n, 1)
        profile.cumulative_satoi = round((profile.cumulative_satoi * profile.total_tests_given + attempt.satoi_score) / n, 1)
        profile.total_tests_given = n
        profile.total_questions_answered += actual_attempted_count
        profile.updated_at = datetime.now(timezone.utc)
    session.add(profile)

    # 7. Update UserTaxonomyMastery & FSRS UserMemoryState
    tax_by_subj = report["part_2_taxonomy_analysis"]["by_subject"]
    tax_by_top = report["part_2_taxonomy_analysis"]["by_topic"]
    tax_by_sub = report["part_2_taxonomy_analysis"]["by_subtopic"]

    all_tax_items = [("SUBJECT", x) for x in tax_by_subj] + [("TOPIC", x) for x in tax_by_top] + [("SUBTOPIC", x) for x in tax_by_sub]

    # Deduplicate and aggregate incoming taxonomy items by (taxonomy_type, taxonomy_id_code)
    aggregated_tax: Dict[tuple, Dict[str, Any]] = {}
    for tax_type, item in all_tax_items:
        code_name = item.get("taxonomy_name") or "General"
        t_key = (tax_type, code_name)
        if t_key in aggregated_tax:
            aggregated_tax[t_key]["total_questions"] += item.get("total_questions", 0)
            aggregated_tax[t_key]["correct"] += item.get("correct", 0)
        else:
            aggregated_tax[t_key] = {
                "taxonomy_type": tax_type,
                "taxonomy_id_code": code_name,
                "total_questions": item.get("total_questions", 0),
                "correct": item.get("correct", 0),
                "accuracy_percentage": item.get("accuracy_percentage", 0.0),
                "strength_status": item.get("strength_status", "MODERATE"),
            }

    for (tax_type, code_name), item in aggregated_tax.items():
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
            session.add(m_obj)
        else:
            m_obj.total_attempts += item["total_questions"]
            m_obj.correct_attempts += item["correct"]
            m_obj.mastery_percentage = round((m_obj.correct_attempts / max(1, m_obj.total_attempts)) * 100.0, 1)
            m_obj.strength_status = "STRONG" if m_obj.mastery_percentage >= 75.0 else ("MODERATE" if m_obj.mastery_percentage >= 50.0 else "WEAK_REVISION_REQUIRED")
            m_obj.updated_at = datetime.now(timezone.utc)
            session.add(m_obj)

    await session.flush()
    await session.commit()

    # 7b. Upsert FSRS UserMemoryState & UserConceptRetention
    # In-memory cache for the current transaction to prevent IntegrityError on duplicate subtopics
    session_retention_cache = {}
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
            cache_key = (user.id, q_obj.subtopic_id)
            if cache_key in session_retention_cache:
                ret_obj = session_retention_cache[cache_key]
            else:
                ret_stmt = select(UserConceptRetention).where(
                    UserConceptRetention.user_id == user.id,
                    UserConceptRetention.subtopic_id == q_obj.subtopic_id,
                )
                ret_res = await session.exec(ret_stmt)
                ret_obj = ret_res.first()
                if ret_obj:
                    session_retention_cache[cache_key] = ret_obj

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
                session.add(ret_obj)
                session_retention_cache[cache_key] = ret_obj
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
        await g_service.check_and_update_daily_goal(user.id)
    except Exception as badge_err:
        logger.warning(f"Gamification processing warning: {badge_err}")

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
                    scheduled_date=(now_t + timedelta(days=3)).date(),
                    is_completed=False,
                )
                session.add(task)

    await session.flush()
    await session.commit()

    # 8. Save Full Report JSON (Report 2) to storage
    report_s3_key = f"exams/{exam.code}/reports/{attempt.id}_exam_report.json"
    try:
        await storage.upload_json(report, report_s3_key)
        logger.info(f"Saved exam report JSON to storage key '{report_s3_key}'.")
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

    # 10. Persist Report 1 (Per-Question Detailed Diagnostic & Explanations)
    part_1_items = report.get("part_1_per_question_analysis", [])
    q_reports_data = []
    for q_item in part_1_items:
        q_uid = uuid.UUID(q_item["question_id"]) if isinstance(q_item["question_id"], str) else q_item["question_id"]
        
        # Fetch explanation from DB or q_item
        expl_stmt = select(QuestionExplanation).where(QuestionExplanation.question_id == q_uid)
        expl_res = await session.exec(expl_stmt)
        expl_db = expl_res.first()
        expl_dict = None
        if expl_db:
            expl_dict = {
                "core_concept": expl_db.core_concept,
                "detailed_solution": expl_db.detailed_solution,
                "common_traps": expl_db.common_traps_json,
                "key_takeaways": expl_db.key_takeaways_json,
            }
        elif q_item.get("explanation"):
            expl_dict = q_item["explanation"]

        q_rep_stmt = select(ExamQuestionReport).where(
            ExamQuestionReport.attempt_id == attempt.id,
            ExamQuestionReport.question_id == q_uid,
        )
        existing_q_rep = (await session.exec(q_rep_stmt)).first()
        if not existing_q_rep:
            q_rep = ExamQuestionReport(
                attempt_id=attempt.id,
                question_id=q_uid,
                question_number=q_item.get("question_number", 1),
                is_correct=q_item.get("is_correct", False),
                final_score=float(q_item.get("marks_awarded", 0.0)),
                time_taken_seconds=float(q_item.get("time_taken_seconds", 60.0)),
                expected_time_seconds=float(q_item.get("expected_time_seconds", 60.0)),
                time_window=q_item.get("time_window", "OPTIMAL"),
                closeness_score=float(q_item.get("closeness_score", 0.0)),
                closeness_classification=q_item.get("closeness_classification", "Neutral Distractor"),
                gti_item_score=float(q_item.get("gti_item_score", 0.0)),
                is_option_switched=bool(q_item.get("is_option_switched", False)),
                blooms_level=q_item.get("blooms_level", "ANALYZE"),
                explanation_json=expl_dict,
            )
            session.add(q_rep)
        else:
            existing_q_rep.explanation_json = expl_dict
            existing_q_rep.is_correct = q_item.get("is_correct", False)
            existing_q_rep.final_score = float(q_item.get("marks_awarded", 0.0))
            session.add(existing_q_rep)
        
        q_reports_data.append({**q_item, "explanation": expl_dict})

    # Save Report 1 JSON to storage
    q_report_s3_key = f"exams/{exam.code}/reports/{attempt.id}_question_report.json"
    try:
        await storage.upload_json({
            "attempt_id": str(attempt.id),
            "exam_id": str(exam.id),
            "user_id": str(user.id),
            "total_questions": len(q_reports_data),
            "questions": q_reports_data,
        }, q_report_s3_key)
    except Exception as q_s3_err:
        logger.warning(f"Could not upload question report JSON: {q_s3_err}")

    # 11. Persist Report 2 (Exam-Level 12-Matrix Aggregated Report)
    report["part_3_aggregated_user_report"]["llm_insight"] = llm_insight
    from app.formatters.report_markdown_formatter import format_report_to_markdown
    markdown_audit = format_report_to_markdown(report)

    attempt_rep_stmt = select(ExamAttemptReport).where(ExamAttemptReport.attempt_id == attempt.id)
    existing_att_rep = (await session.exec(attempt_rep_stmt)).first()
    if not existing_att_rep:
        att_rep = ExamAttemptReport(
            attempt_id=attempt.id,
            user_id=user.id,
            exam_id=exam.id,
            matrices_summary_json=report["part_3_aggregated_user_report"],
            taxonomy_breakdown_json=report["part_2_taxonomy_analysis"],
            llm_insight_json=llm_insight,
            full_report_json=report,
            markdown_audit_text=markdown_audit,
            s3_report_url=report_s3_key,
        )
        session.add(att_rep)
    else:
        existing_att_rep.matrices_summary_json = report["part_3_aggregated_user_report"]
        existing_att_rep.taxonomy_breakdown_json = report["part_2_taxonomy_analysis"]
        existing_att_rep.llm_insight_json = llm_insight
        existing_att_rep.full_report_json = report
        existing_att_rep.markdown_audit_text = markdown_audit
        session.add(existing_att_rep)

    # 12. Persist Report 3 (Cumulative User Skill Progression Delta Report)
    updated_profile_dict = {
        "cumulative_icrs": profile.cumulative_icrs,
        "cumulative_irt_theta": profile.cumulative_irt_theta,
        "cumulative_gti": profile.cumulative_gti,
        "cumulative_oeei": profile.cumulative_oeei,
        "cumulative_satoi": profile.cumulative_satoi,
        "total_tests_given": profile.total_tests_given,
        "total_questions_answered": profile.total_questions_answered,
    }
    deltas = {
        "icrs_delta": round(profile.cumulative_icrs - profile_dict["cumulative_icrs"], 1),
        "irt_theta_delta": round(profile.cumulative_irt_theta - profile_dict["cumulative_irt_theta"], 2),
        "gti_delta": round(profile.cumulative_gti - profile_dict["cumulative_gti"], 4),
        "oeei_delta": round(profile.cumulative_oeei - profile_dict["cumulative_oeei"], 2),
        "satoi_delta": round(profile.cumulative_satoi - profile_dict["cumulative_satoi"], 1),
    }
    user_prog_stmt = select(UserSkillProgressionReport).where(UserSkillProgressionReport.attempt_id == attempt.id)
    existing_user_prog = (await session.exec(user_prog_stmt)).first()
    if not existing_user_prog:
        user_prog = UserSkillProgressionReport(
            attempt_id=attempt.id,
            user_id=user.id,
            previous_metrics_json=profile_dict,
            updated_metrics_json=updated_profile_dict,
            deltas_json=deltas,
            taxonomy_promotions_json=report["part_2_taxonomy_analysis"],
            spaced_repetition_schedule_json={"evaluated_at": now_t.isoformat()},
        )
        session.add(user_prog)
    else:
        existing_user_prog.previous_metrics_json = profile_dict
        existing_user_prog.updated_metrics_json = updated_profile_dict
        existing_user_prog.deltas_json = deltas
        existing_user_prog.taxonomy_promotions_json = report["part_2_taxonomy_analysis"]
        existing_user_prog.spaced_repetition_schedule_json = {"evaluated_at": now_t.isoformat()}
        session.add(existing_user_prog)

    user_prog_s3_key = f"users/{user.id}/reports/progression_{attempt.id}.json"
    try:
        await storage.upload_json({
            "user_id": str(user.id),
            "attempt_id": str(attempt.id),
            "previous_metrics": profile_dict,
            "updated_metrics": updated_profile_dict,
            "deltas": deltas,
        }, user_prog_s3_key)
    except Exception as up_s3_err:
        logger.warning(f"Could not upload user progression report: {up_s3_err}")

    # 13. Update attempt report_metadata_json and status = EVALUATED
    attempt.report_metadata_json = report
    attempt.status = AttemptStatus.EVALUATED
    session.add(attempt)
    await session.flush()
    await session.commit()

    # 14. Trigger instant recomputation of multi-exam cumulative aggregate profile
    try:
        from app.engine.cumulative_analytics_aggregator import CumulativeAnalyticsAggregator
        await CumulativeAnalyticsAggregator.compute_user_cumulative_report(
            session=session,
            user_id=user.id,
            force_recompute=True,
        )
    except Exception as cum_err:
        logger.warning(f"Cumulative profile auto-update warning: {cum_err}")

    logger.info(f"Post-submission pipeline completed for attempt '{attempt_id}'. All 3 reports persisted. Status set to EVALUATED.")


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
