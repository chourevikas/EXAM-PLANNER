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


# 20-Minute Sliding Window Memory Cache for S3 Exam Solutions
EXAM_SOLUTIONS_SLIDING_CACHE: Dict[str, Dict[str, Any]] = {}
CACHE_TTL_SECONDS = 1200  # 20 minutes


def get_cached_solutions_data(exam_code: str) -> Optional[Dict[str, Any]]:
    now = datetime.now(timezone.utc).timestamp()
    if exam_code in EXAM_SOLUTIONS_SLIDING_CACHE:
        entry = EXAM_SOLUTIONS_SLIDING_CACHE[exam_code]
        if now - entry["last_accessed"] < CACHE_TTL_SECONDS:
            entry["last_accessed"] = now  # Sliding window refresh
            return entry["data"]
        else:
            del EXAM_SOLUTIONS_SLIDING_CACHE[exam_code]
    return None


def set_cached_solutions_data(exam_code: str, data: Dict[str, Any]) -> None:
    now = datetime.now(timezone.utc).timestamp()
    # Sweep expired caches
    expired = [k for k, v in EXAM_SOLUTIONS_SLIDING_CACHE.items() if now - v["last_accessed"] > CACHE_TTL_SECONDS]
    for k in expired:
        del EXAM_SOLUTIONS_SLIDING_CACHE[k]
    EXAM_SOLUTIONS_SLIDING_CACHE[exam_code] = {
        "last_accessed": now,
        "data": data,
    }


async def load_exam_solutions_data(exam: Exam, session: AsyncSession, storage: Any) -> Dict[str, Any]:
    """
    Robust multi-tier solution resolver with 20-minute sliding memory cache:
    Tier 0: Active sliding memory cache (instant < 1ms lookup).
    Tier 1: Master S3 JSON file (exam.solutions_json_path or exams/{code}/exam_solutions.json) for instant full-exam loading.
    Tier 2: S3 Solutions Folder (individual Q001.json, Q002.json... in artifacts/{code}/{set}/json/solutions or exams/{code}/solutions) for practice / guest tests.
    Tier 3: Dynamic Database fallback via ExamJsonBuilder or DB models.
    """
    cached = get_cached_solutions_data(exam.code)
    if cached and cached.get("questions"):
        return cached

    paper_set = exam.paper_set_code or "SET_A"
    clean_set = str(paper_set).strip().lower().replace("_", "-")
    s_rel_path = exam.solutions_json_path or f"exams/{exam.code}/exam_solutions.json"
    s_folder = exam.solutions_json_folder_path or f"artifacts/{exam.code}/{clean_set}/json/solutions"
    alt_folder = f"exams/{exam.code}/solutions"
    q_folder = exam.questions_json_folder_path or f"artifacts/{exam.code}/{clean_set}/json/questions"
    alt_q_folder = f"exams/{exam.code}/questions"

    # Tier 1: Try Master S3 Solutions JSON (Fastest for full exams, < 15ms)
    try:
        if await storage.exists(s_rel_path):
            solutions_data = await storage.download_json(s_rel_path)
            if solutions_data and solutions_data.get("questions"):
                logger.info(f"Loaded solutions from master JSON '{s_rel_path}' ({len(solutions_data['questions'])} questions).")
                set_cached_solutions_data(exam.code, solutions_data)
                return solutions_data
    except Exception as err:
        logger.warning(f"Tier 1 master solutions JSON '{s_rel_path}' lookup failed: {err}")

    # Tier 2: Try S3 Solutions & Questions Folders (Individual files for practice/guest tests)
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
            res_dict = {
                "exam_id": str(exam.id),
                "exam_code": exam.code,
                "questions": sol_list,
            }
            set_cached_solutions_data(exam.code, res_dict)
            return res_dict
    except Exception as err:
        logger.warning(f"Tier 2 solutions folder '{s_folder}' failed: {err}")

    # Tier 3: Dynamic Database Fallback
    try:
        from app.services.exam_json_builder import ExamJsonBuilder
        logger.info(f"Tier 3: Generating solutions data from database for exam '{exam.code}'...")
        builder = ExamJsonBuilder(session)
        res = await builder.generate_and_upload(exam.id)
        if res.get("solutions_json_path") and await storage.exists(res["solutions_json_path"]):
            solutions_data = await storage.download_json(res["solutions_json_path"])
            if solutions_data and solutions_data.get("questions"):
                set_cached_solutions_data(exam.code, solutions_data)
                return solutions_data
    except Exception as err:
        logger.error(f"Tier 3 DB solutions generation failed: {err}", exc_info=True)

    fallback_dict = {"exam_id": str(exam.id), "exam_code": exam.code, "questions": []}
    return fallback_dict


_IN_FLIGHT_PIPELINES: set = set()


async def run_post_submission_pipeline(attempt_id: uuid.UUID, session: Optional[AsyncSession] = None) -> None:
    """
    Asynchronous, non-blocking post-submission pipeline:
    1. Executes mode-aware mathematical matrix engine via `MatrixOrchestrator` (zero LLM).
    2. Updates DB records: `ExamAttempt`, `UserSkillProfile`, `UserTaxonomyMastery`, `UserMemoryState`.
    3. Saves 3-part report JSON to S3 / local storage.
    4. Executes **1 single LLM call** to generate personalized diagnostic insight & recommendations.
    5. Updates `ExamAttempt.report_metadata_json["llm_insight"]` and sets `status = EVALUATED`.
    """
    if attempt_id in _IN_FLIGHT_PIPELINES:
        logger.info(f"Pipeline for attempt '{attempt_id}' is already executing in-flight. Skipping duplicate trigger.")
        return

    _IN_FLIGHT_PIPELINES.add(attempt_id)
    try:
        logger.info(f"Starting post-submission pipeline for attempt '{attempt_id}'...")
        if session is not None:
            await _run_pipeline_core(session, attempt_id)
        else:
            async with managed_async_session() as managed_sess:
                await _run_pipeline_core(managed_sess, attempt_id)
    except Exception as e:
        logger.error(f"Post-submission pipeline encountered an unexpected error on attempt '{attempt_id}': {e}", exc_info=True)
    finally:
        _IN_FLIGHT_PIPELINES.discard(attempt_id)


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

    storage = get_storage_provider()

    # 2. Load Solutions JSON via robust multi-tier resolver
    solutions_data = await load_exam_solutions_data(exam, session, storage)

    # Fetch responses
    resp_res = await session.exec(
        select(ExamQuestionResponse)
        .where(ExamQuestionResponse.attempt_id == attempt_id)
        .order_by(col(ExamQuestionResponse.created_at).asc())
    )
    responses_db = resp_res.all()

    # If responses_db is empty, auto-seed all questions from DB or solutions_data as unattempted
    if not responses_db:
        logger.info(f"Attempt '{attempt_id}' has 0 response records. Auto-seeding question responses for exam '{exam.name}'.")
        seeded_resps = []
        q_res = await session.exec(
            select(Question).where(Question.exam_id == exam.id).order_by(col(Question.question_number_in_paper))
        )
        q_rows = q_res.all()
        if q_rows:
            for index, q_obj in enumerate(q_rows, 1):
                seeded_resps.append(
                    ExamQuestionResponse(
                        attempt_id=attempt.id,
                        question_id=q_obj.id,
                        question_status=QuestionResponseStatus.UNVISITED,
                        expected_time_seconds=float(q_obj.expected_time_seconds or 60.0),
                        time_taken_seconds=0.0,
                        is_correct=False,
                        final_score=0.0,
                    )
                )
        elif solutions_data.get("questions"):
            for index, s_item in enumerate(solutions_data["questions"], 1):
                if s_item.get("question_id"):
                    seeded_resps.append(
                        ExamQuestionResponse(
                            attempt_id=attempt.id,
                            question_id=uuid.UUID(str(s_item["question_id"])),
                            question_status=QuestionResponseStatus.UNVISITED,
                            expected_time_seconds=float(s_item.get("expected_time_seconds") or 60.0),
                            time_taken_seconds=0.0,
                            is_correct=False,
                            final_score=0.0,
                        )
                    )
        if seeded_resps:
            session.add_all(seeded_resps)
            await session.commit()
            responses_db = seeded_resps
        else:
            logger.warning(f"No questions found to seed for exam '{exam.name}'.")
            return

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

    # Bulk preload options and questions if needed for DB fallback
    q_ids = [r.question_id for r in responses_db if r.question_id]
    opt_ids = [r.selected_option_id for r in responses_db if r.selected_option_id]
    
    q_map = {}
    opt_map = {}
    if q_ids and (not sol_by_id or len(sol_by_id) < len(q_ids)):
        q_res = await session.exec(select(Question).where(col(Question.id).in_(q_ids)))
        q_map = {q.id: q for q in q_res.all()}
    if opt_ids:
        opt_res = await session.exec(select(QuestionOption).where(col(QuestionOption.id).in_(opt_ids)))
        opt_map = {opt.id: opt for opt in opt_res.all()}

    for index, r in enumerate(responses_db, 1):
        q_model = q_map.get(r.question_id)
        opt_model = opt_map.get(r.selected_option_id) if r.selected_option_id else None
        
        sol_item = sol_by_id.get(str(r.question_id))
        if not sol_item and q_model and q_model.question_number_in_paper:
            sol_item = sol_by_num.get(int(q_model.question_number_in_paper))
        if not sol_item:
            sol_item = sol_by_num.get(index, {})
        
        # Fast resolution from in-memory sol_item
        q_text = sol_item.get("question_text") or sol_item.get("text") or (getattr(q_model, "text", "") if q_model else "")
        options_payload = sol_item.get("options", [])
        expl_dict = sol_item.get("explanation")
        
        user_sel_label = opt_model.option_label if opt_model else "Unattempted"
        if user_sel_label == "Unattempted" and r.selected_option_id and options_payload:
            for opt in options_payload:
                if str(opt.get("option_id")) == str(r.selected_option_id):
                    user_sel_label = opt.get("option_label", "A")
                    break

        responses_payload.append({
            "question_id": str(r.question_id),
            "question_number": q_model.question_number_in_paper if q_model and q_model.question_number_in_paper else (sol_item.get("question_number") or index),
            "question_text": q_text,
            "options": options_payload,
            "subject": sol_item.get("subject", "General Studies"),
            "topic": sol_item.get("topic", "General Knowledge"),
            "subtopic": sol_item.get("subtopic", "Core Concepts"),
            "difficulty": sol_item.get("difficulty", "MEDIUM"),
            "selected_option_id": str(r.selected_option_id) if r.selected_option_id else None,
            "user_selected_label": user_sel_label,
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

    t_start = datetime.now(timezone.utc)
    logger.info(f"🚀 [PIPELINE_START] Beginning submission analysis for Attempt '{attempt.id}' | Exam: '{exam.name}' ({exam.code}) | User: '{user.full_name}' ({user.email})")

    # 4. Execute Mode-Aware Matrix Orchestrator
    t_mat_start = datetime.now(timezone.utc)
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
    t_mat_end = datetime.now(timezone.utc)
    mat_duration_ms = round((t_mat_end - t_mat_start).total_seconds() * 1000, 1)

    part_2 = report.get("part_2_exam_macro_scorecard", {})
    part_3 = report.get("part_3_aggregated_user_report", {})
    tax_analysis = report.get("part_2_taxonomy_analysis", {})

    # Detailed logs explaining how each matrix was evaluated
    logger.info(f"🧠 [STEP 1/4: 12-MATRIX COMPUTATION COMPLETED in {mat_duration_ms}ms]")
    icrs_obj = part_3.get("icrs", {})
    logger.info(
        f"   ├─ 1. ICRS (Exam Preparedness): {icrs_obj.get('icrs_score', 0)}/100 ({icrs_obj.get('readiness_tier', 'FOUNDATION')}) "
        f"| Grounding: Net Marks={icrs_obj.get('net_score', 0):.2f}/200.0, Qualifying Cutoff={icrs_obj.get('qualifying_cutoff_marks', 92.0)} Marks, Coverage={icrs_obj.get('attempted_count', 0)}/{icrs_obj.get('total_questions', 100)} questions"
    )
    irt_obj = part_3.get("irt_3pl", {})
    logger.info(
        f"   ├─ 2. IRT 3PL Mastery (Latent Ability): Theta={irt_obj.get('latent_ability_theta', 0.0):+.2f} "
        f"| Percentile={irt_obj.get('percentile_rank', 50.0)}% | Tier={irt_obj.get('ability_label', 'Competent')}"
    )
    gti_obj = part_3.get("gti", {})
    logger.info(
        f"   ├─ 3. GTI (Guessing Tendency): Aggregate={gti_obj.get('aggregate', 0.0)*100:.1f}% "
        f"| Category={gti_obj.get('label', 'Calculated 50:50')} | High Impulse Guesses={gti_obj.get('high_guessing_count', 0)}"
    )
    oeei_obj = part_3.get("oeei", {})
    logger.info(
        f"   ├─ 4. OEEI (Option Elimination Precision): Conversion={oeei_obj.get('oeei_score_pct', 70.0):.1f}% "
        f"| Rating={oeei_obj.get('elimination_rating', 'HIGH_TACTICAL_PRECISION')}"
    )
    satoi_obj = part_3.get("satoi", {})
    logger.info(
        f"   ├─ 5. SATOI (Exam Stamina & Endurance): Stamina Score={satoi_obj.get('satoi_score', 80)}/100 "
        f"| Status={satoi_obj.get('stamina_label', 'Healthy Stamina')} | Dropout Check: {len(responses_payload)} items assessed"
    )
    pacing_obj = part_3.get("pacing", {})
    logger.info(
        f"   ├─ 6. Time Budgeting & Pacing: Status={pacing_obj.get('pacing_status', 'BALANCED')} "
        f"| Avg Pace={pacing_obj.get('avg_time_per_question_sec', 60.0):.1f}s/question (Target: 72s) | Duration Utilization={pacing_obj.get('time_utilization_pct', 90)}%"
    )
    osri_obj = part_3.get("switch_regret", {})
    logger.info(
        f"   ├─ 7. Answer Revision Safety: Total Switches={osri_obj.get('total_switches', 0)} "
        f"| Right->Wrong (Costly)={osri_obj.get('negative_regret_switches', 0)} (lost {osri_obj.get('negative_regret_switches', 0)*2.67:.1f} Marks) "
        f"| Wrong->Right (Rewarding)={osri_obj.get('positive_switches', 0)} (gained +{osri_obj.get('positive_switches', 0)*2.67:.1f} Marks) "
        f"| Net Revision Impact={osri_obj.get('net_score_impact', 0.0):+.2f} Marks"
    )
    blooms_obj = part_3.get("blooms", {})
    logger.info(
        f"   ├─ 8. Cognitive Thinking Levels (Bloom's): Recall={blooms_obj.get('fact_recall_accuracy', 0.0):.1f}% "
        f"| Analytical={blooms_obj.get('conceptual_analysis_accuracy', 0.0):.1f}% | Critical Evaluation={blooms_obj.get('critical_evaluation_accuracy', 0.0):.1f}%"
    )
    dist_obj = part_3.get("distractor", {})
    logger.info(
        f"   ├─ 9. Trap Detection & Distractor Resistance: Trap Resistance Index={part_2.get('trap_resistance_index', 80)}/100 "
        f"| Near-Miss Selections={dist_obj.get('high_closeness_count', 0)} | Cognitive Traps={dist_obj.get('misleading_distractor_count', 0)}"
    )
    logger.info(
        f"   ├─ 10. FSRS Concept Memory Retention: Average Concept Stability={part_2.get('avg_concept_stability_days', 3.5):.1f} Days "
        f"| Topics Scheduled for Review={len(topic_mem_records)}"
    )
    tax_by_subj = tax_analysis.get("by_subject", [])
    tax_by_top = tax_analysis.get("by_topic", [])
    tax_by_sub = tax_analysis.get("by_subtopic", [])
    logger.info(
        f"   ├─ 11. Taxonomy Hierarchy: {len(tax_by_subj)} Subjects, {len(tax_by_top)} Topics, {len(tax_by_sub)} Subtopics evaluated"
    )
    actionable_tasks = part_2.get("actionable_tasks", [])
    logger.info(
        f"   └─ 12. Strategic Mentorship & Guidance: Generated {len(actionable_tasks)} actionable study plan targets"
    )

    # 5. Update Attempt fields in DB
    attempt.irt_theta = part_3["irt_3pl"]["latent_ability_theta"]
    attempt.gti_score = part_3["gti"]["aggregate"]
    attempt.oeei_score = part_3["oeei"]["oeei_score"]
    attempt.satoi_score = part_3["satoi"]["satoi_score"]
    attempt.icrs_score = part_3["icrs"]["icrs_score"]
    attempt.pacing_status = part_3["pacing"]["pacing_status"]
    session.add(attempt)

    # 6. Update UserSkillProfile
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

    # 7. Bulk Update UserTaxonomyMastery
    t_db_start = datetime.now(timezone.utc)
    all_tax_items = [("SUBJECT", x) for x in tax_by_subj] + [("TOPIC", x) for x in tax_by_top] + [("SUBTOPIC", x) for x in tax_by_sub]
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

    # Bulk query existing taxonomy masteries in 1 query
    existing_tax_res = await session.exec(select(UserTaxonomyMastery).where(UserTaxonomyMastery.user_id == user.id))
    tax_map = {(m.taxonomy_type, m.taxonomy_id_code): m for m in existing_tax_res.all()}

    for (tax_type, code_name), item in aggregated_tax.items():
        m_obj = tax_map.get((tax_type, code_name))
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

    # 7b. Bulk Update FSRS UserMemoryState & UserConceptRetention
    now_t = datetime.now(timezone.utc)
    all_resp_q_ids = [r.question_id for r in responses_db if r.question_id]
    
    # Bulk load memory records
    existing_mem_res = await session.exec(
        select(UserMemoryState).where(
            UserMemoryState.user_id == user.id,
            col(UserMemoryState.question_id).in_(all_resp_q_ids),
        )
    )
    existing_mem_map = {m.question_id: m for m in existing_mem_res.all()}

    existing_ret_res = await session.exec(
        select(UserConceptRetention).where(UserConceptRetention.user_id == user.id)
    )
    existing_ret_map = {r.subtopic_id: r for r in existing_ret_res.all() if r.subtopic_id}

    for resp in responses_db:
        q_sol_info = sol_by_id.get(str(resp.question_id)) or {}
        q_subtopic_id = None
        if resp.question_id in q_map:
            q_subtopic_id = q_map[resp.question_id].subtopic_id

        is_corr = bool(resp.is_correct)
        mem_obj = existing_mem_map.get(resp.question_id)

        if not mem_obj:
            diff = 5.0 if not is_corr else 3.5
            stab = 1.0 if not is_corr else 3.0
            ret = 0.4 if not is_corr else 1.0
            mem_obj = UserMemoryState(
                user_id=user.id,
                question_id=resp.question_id,
                subtopic_id=q_subtopic_id,
                fsrs_difficulty=diff,
                fsrs_stability=stab,
                retrievability=ret,
                last_reviewed_at=now_t,
                next_scheduled_review=now_t + timedelta(days=max(1, int(stab))),
            )
            session.add(mem_obj)
            existing_mem_map[resp.question_id] = mem_obj
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

        if q_subtopic_id:
            ret_obj = existing_ret_map.get(q_subtopic_id)
            if not ret_obj:
                ret_obj = UserConceptRetention(
                    user_id=user.id,
                    subtopic_id=q_subtopic_id,
                    fsrs_difficulty=mem_obj.fsrs_difficulty,
                    fsrs_stability=mem_obj.fsrs_stability,
                    fsrs_retrievability=mem_obj.retrievability,
                    total_reviews=1,
                    lapses=0 if is_corr else 1,
                    last_reviewed_at=now_t,
                    next_scheduled_review=now_t + timedelta(days=max(1, int(mem_obj.fsrs_stability))),
                )
                session.add(ret_obj)
                existing_ret_map[q_subtopic_id] = ret_obj
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

    # 8. Save Full Report JSON (Report 2) to storage
    report_s3_key = f"exams/{exam.code}/reports/{attempt.id}_exam_report.json"
    try:
        await storage.upload_json(report, report_s3_key)
        logger.info(f"Saved exam report JSON to storage key '{report_s3_key}'.")
    except Exception as s3_err:
        logger.warning(f"Could not upload report JSON to storage: {s3_err}")

    # 9. Mentorship Insights (Fast Rule-Based)
    mentorship_insight = part_3.get("mentorship_insight") or part_3.get("llm_insight") or _generate_rule_based_insight(
        user=user,
        exam=exam,
        attempt=attempt,
        part_3=part_3,
        taxonomy=report["part_2_taxonomy_analysis"],
    )

    # 10. Bulk Persist Report 1 (Per-Question Diagnostics)
    part_1_items = report.get("part_1_per_question_analysis", [])
    q_reports_data = []
    
    # Bulk load existing question reports in 1 query
    existing_q_reps = await session.exec(select(ExamQuestionReport).where(ExamQuestionReport.attempt_id == attempt.id))
    q_rep_map = {r.question_id: r for r in existing_q_reps.all()}

    for q_item in part_1_items:
        q_uid = uuid.UUID(q_item["question_id"]) if isinstance(q_item["question_id"], str) else q_item["question_id"]
        expl_dict = q_item.get("explanation")

        existing_q_rep = q_rep_map.get(q_uid)
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

    # 11. Persist Report 2 (Exam Macro Scorecard Report)
    report["part_3_aggregated_user_report"]["llm_insight"] = mentorship_insight
    report["part_3_aggregated_user_report"]["mentorship_insight"] = mentorship_insight
    if "part_2_exam_macro_scorecard" in report:
        report["part_2_exam_macro_scorecard"]["llm_insight"] = mentorship_insight
        report["part_2_exam_macro_scorecard"]["mentorship_insight"] = mentorship_insight

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
            llm_insight_json=mentorship_insight,
            full_report_json=report,
            markdown_audit_text=markdown_audit,
            s3_report_url=report_s3_key,
        )
        session.add(att_rep)
    else:
        existing_att_rep.matrices_summary_json = report["part_3_aggregated_user_report"]
        existing_att_rep.taxonomy_breakdown_json = report["part_2_taxonomy_analysis"]
        existing_att_rep.llm_insight_json = mentorship_insight
        existing_att_rep.full_report_json = report
        existing_att_rep.markdown_audit_text = markdown_audit
        session.add(existing_att_rep)

    # 12. Persist Report 3 (User Progression Delta Report)
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
    await session.commit()

    t_end = datetime.now(timezone.utc)
    total_pipeline_ms = round((t_end - t_start).total_seconds() * 1000, 1)
    logger.info(f"✅ [PIPELINE_COMPLETE] Attempt '{attempt.id}' status set to EVALUATED. Total Pipeline Runtime: {total_pipeline_ms}ms")

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

    logger.info(f"Post-submission pipeline completed for attempt '{attempt_id}'. All 4 sections persisted. Status set to EVALUATED.")


def _generate_rule_based_insight(
    user: User,
    exam: Exam,
    attempt: ExamAttempt,
    part_3: Dict[str, Any],
    taxonomy: Dict[str, Any],
) -> Dict[str, Any]:
    """Generates instant, deterministic, rule-based diagnostic insight (Zero LLM API call)."""
    strong_subjs = [s["taxonomy_name"] for s in taxonomy.get("by_subject", []) if s.get("strength_status") in ("STRONG", "EXCEPTIONAL_MASTERY")]
    weak_subjs = [s["taxonomy_name"] for s in taxonomy.get("by_subject", []) if s.get("strength_status") in ("WEAK_REVISION_REQUIRED", "CRITICAL_DEFICIT")]
    weak_topics = [s["taxonomy_name"] for s in taxonomy.get("by_topic", []) if s.get("strength_status") in ("WEAK_REVISION_REQUIRED", "CRITICAL_DEFICIT")][:3]

    strengths = []
    weaknesses = []
    recommendations = []

    if strong_subjs:
        strengths.append(f"Demonstrated solid concept command in {', '.join(strong_subjs)}.")
    if part_3.get("gti", {}).get("category") in ("HIGH_CONFIDENCE_METHODICAL", "CONTROLLED_CALCULATED_RISK"):
        strengths.append("High instinct discipline with minimal rushed guessing errors.")
    if part_3.get("oeei", {}).get("oeei_score", 0) >= 0.70:
        strengths.append("Effective option elimination tactics, avoiding cognitive distractor traps.")
    if not strengths:
        strengths.append(f"Successfully completed all questions within the exam duration.")

    if weak_subjs:
        weaknesses.append(f"Accuracy dipped below target benchmarks in {', '.join(weak_subjs)}.")
    if weak_topics:
        weaknesses.append(f"Identified distractor trap vulnerability in topics: {', '.join(weak_topics)}.")
    if part_3.get("pacing", {}).get("pacing_status") in ("EARLY_BOTTLENECK_OVERTHINK", "LATE_EXAM_PANIC_RUSH"):
        weaknesses.append("Pacing imbalance detected between first and second halves of the exam.")
    if not weaknesses:
        weaknesses.append("Minor accuracy drop on higher-order analytical statement questions.")

    if weak_topics:
        recommendations.append(f"Schedule prioritized revision for high-yield weak areas: {', '.join(weak_topics)}.")
    recommendations.append("Enforce a minimum 20-second reading buffer to eliminate unforced distractor errors.")
    recommendations.append("Maintain steady pacing by flagging complex questions for second-pass review.")

    return {
        "strengths": strengths,
        "weaknesses": weaknesses,
        "recommendations": recommendations,
        "closing": "Consistent targeted practice will steadily elevate your exam readiness benchmark!",
    }

