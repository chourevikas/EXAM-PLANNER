import asyncio
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone, timedelta
from sqlmodel import select, col
from sqlalchemy.orm.attributes import flag_modified
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
    QuestionMetadata,
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
    QuestionSwitchLog,
)
from app.db.models.enums import AttemptStatus, AttemptMode, QuestionResponseStatus
from app.engine.matrix_orchestrator import MatrixOrchestrator, is_placeholder_taxonomy
from app.engine.matrices.fsrs_retention import FSRSEngine
from app.storage.factory import get_storage_provider
from app.db.session import managed_async_session
from app.config.logger import setup_logger
from app.services.scoring import question_marks

logger = setup_logger("PostSubmissionPipeline")


# 24-Hour Sliding Window Memory Cache for Exam Solutions
EXAM_SOLUTIONS_SLIDING_CACHE: Dict[str, Dict[str, Any]] = {}
CACHE_TTL_SECONDS = 86400  # 24 Hours in-memory sliding cache


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


def clear_cached_solutions_data(exam_code: Optional[str] = None) -> None:
    if exam_code:
        EXAM_SOLUTIONS_SLIDING_CACHE.pop(str(exam_code), None)
    else:
        EXAM_SOLUTIONS_SLIDING_CACHE.clear()


async def get_cached_solutions_data_async(exam_code: str, exam_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
    """Checks in-memory cache first, then Redis app cache."""
    # 1. Memory cache check
    mem = get_cached_solutions_data(exam_code)
    if mem and mem.get("questions"):
        return mem
    if exam_id:
        mem_id = get_cached_solutions_data(str(exam_id))
        if mem_id and mem_id.get("questions"):
            return mem_id

    # 2. Redis cache check
    try:
        from app.cache.factory import get_cache
        from app.config.settings import get_settings
        cache = get_cache()
        prefix = get_settings().CACHE_KEY_PREFIX or "ep"
        val = await cache.get(f"{prefix}:exam_solutions:{exam_code}")
        if not val and exam_id:
            val = await cache.get(f"{prefix}:exam_solutions:{exam_id}")
        if val and isinstance(val, dict) and val.get("questions"):
            set_cached_solutions_data(exam_code, val)
            if exam_id:
                set_cached_solutions_data(str(exam_id), val)
            return val
    except Exception as cache_err:
        logger.debug(f"Redis solutions cache lookup warning: {cache_err}")
    return None


async def set_cached_solutions_data_async(exam_code: str, exam_id: Optional[int], data: Dict[str, Any]) -> None:
    """Stores solutions data in both in-memory cache and Redis app cache."""
    set_cached_solutions_data(exam_code, data)
    if exam_id:
        set_cached_solutions_data(str(exam_id), data)
    try:
        from app.cache.factory import get_cache
        from app.config.settings import get_settings
        cache = get_cache()
        prefix = get_settings().CACHE_KEY_PREFIX or "ep"
        await cache.set(f"{prefix}:exam_solutions:{exam_code}", data, ttl_seconds=CACHE_TTL_SECONDS)
        if exam_id:
            await cache.set(f"{prefix}:exam_solutions:{exam_id}", data, ttl_seconds=CACHE_TTL_SECONDS)
    except Exception as cache_err:
        logger.debug(f"Redis solutions cache store warning: {cache_err}")


async def load_exam_solutions_data(exam: Any, session: AsyncSession, storage: Any = None) -> Dict[str, Any]:
    """
    Direct Database & Redis/Memory cached solutions resolver.
    Database is the single source of truth; caches are populated at exam start or first load.
    Zero external S3 dependency.
    """
    if isinstance(exam, (int, str)) and str(exam).isdigit():
        exam_id = int(exam)
        from app.db.models import Exam
        exam_obj = await session.get(Exam, exam_id)
        if not exam_obj:
            return {}
        exam_code = exam_obj.code
    elif hasattr(exam, "id") and hasattr(exam, "code"):
        exam_id = exam.id
        exam_code = getattr(exam, "code", "")
    else:
        return {}

    cached = await get_cached_solutions_data_async(exam_code, exam_id)
    if cached and cached.get("questions"):
        return cached

    # Direct High-Performance Database Question & Solution Resolver via ExamJsonBuilder
    try:
        from app.services.exam_json_builder import ExamJsonBuilder
        builder = ExamJsonBuilder(session)
        stmt = (
            select(Question)
            .where(Question.exam_id == exam_id)
            .order_by(col(Question.question_number_in_paper))
        )
        res = await session.exec(stmt)
        questions = list(res.all())
        if questions:
            preloaded_data = await builder.preload_batch_question_data(questions, include_solution_data=True)
            solutions_payload = []
            for q in questions:
                q_card, sol_card = await builder.build_single_question_cards(q, preloaded=preloaded_data)
                
                merged_options = []
                for opt in q_card.get("options", []):
                    opt_id_str = str(opt.get("option_id"))
                    d_info = sol_card.get("distractor_scores", {}).get(opt_id_str, {})
                    is_corr = bool(d_info.get("is_correct", opt_id_str == str(sol_card.get("correct_option_id"))))
                    c_score = float(d_info.get("closeness_score", 1.0 if is_corr else 0.25))
                    merged_options.append({
                        "option_id": opt_id_str,
                        "option_label": opt.get("option_label"),
                        "text": opt.get("text"),
                        "is_correct": is_corr,
                        "closeness_score": c_score,
                        "distractor_analysis": d_info.get("distractor_analysis"),
                    })

                merged = {
                    **sol_card,
                    "question_text": q_card.get("text") or q_card.get("question_text"),
                    "options": merged_options,
                }
                solutions_payload.append(merged)

            res_dict = {"exam_id": str(exam_id), "exam_code": exam_code, "questions": solutions_payload}
            await set_cached_solutions_data_async(exam_code, exam_id, res_dict)
            logger.info(f"Loaded and cached {len(solutions_payload)} questions/solutions directly from database for exam '{exam_code}'.")
            return res_dict
    except Exception as err:
        logger.error(f"Direct DB solutions generation failed for exam '{exam_code}': {err}", exc_info=True)
        return {}

    return {"exam_id": str(exam.id), "exam_code": exam.code, "questions": []}


_IN_FLIGHT_PIPELINES: set = set()


async def run_post_submission_pipeline(
    attempt_id: int | str,
    session: Optional[AsyncSession] = None,
    report_only: bool = False,
) -> None:
    """
    Asynchronous, non-blocking post-submission pipeline.
    Phase 1 (fast): Matrix computation + DB persistence → status = SUBMITTED with math data.
    Phase 2 (async): LLM AI synthesis → status = EVALUATED with insights.

    report_only=True rebuilds the attempt's report without touching the user's running
    totals (skill profile, taxonomy mastery, FSRS memory, badges). Used to backfill reports
    after a scoring fix.
    """
    # Normalize to int to prevent str/int dedup failures
    try:
        attempt_id = int(attempt_id)
    except (ValueError, TypeError):
        logger.error(f"Invalid attempt_id '{attempt_id}' — cannot run pipeline.")
        return

    if attempt_id in _IN_FLIGHT_PIPELINES:
        logger.info(f"Pipeline for attempt '{attempt_id}' already in-flight. Skipping duplicate.")
        return

    _IN_FLIGHT_PIPELINES.add(attempt_id)
    try:
        logger.info(f"Starting post-submission pipeline for attempt '{attempt_id}'...")
        if session is not None:
            await _run_pipeline_core(session, attempt_id, report_only=report_only)
        else:
            async with managed_async_session() as managed_sess:
                await _run_pipeline_core(managed_sess, attempt_id, report_only=report_only)
    except Exception as e:
        logger.error(f"Post-submission pipeline encountered an unexpected error on attempt '{attempt_id}': {e}", exc_info=True)
        try:
            async with managed_async_session() as err_sess:
                err_att = await err_sess.get(ExamAttempt, attempt_id)
                if err_att:
                    err_att.report_metadata_json = {
                        "status": "FAILED",
                        "is_ready": False,
                        "can_retry": True,
                        "error_message": f"Evaluation error: {str(e)}",
                        "failed_at": datetime.now(timezone.utc).isoformat(),
                    }
                    err_sess.add(err_att)
                    await err_sess.commit()
                    logger.info(f"Recorded evaluation failure on attempt '{attempt_id}' with retry capability.")
        except Exception as db_fail_err:
            logger.error(f"Failed to record failure status on attempt '{attempt_id}': {db_fail_err}")
    finally:
        _IN_FLIGHT_PIPELINES.discard(attempt_id)


async def _run_pipeline_core(session: AsyncSession, attempt_id: int, report_only: bool = False) -> None:
    # 1. Fetch Attempt
    attempt = await session.get(ExamAttempt, attempt_id)
    if not attempt:
        logger.error(f"Attempt '{attempt_id}' not found for post-submission pipeline.")
        return

    if attempt.status == AttemptStatus.EVALUATED and not report_only:
        logger.info(f"Attempt '{attempt_id}' is already EVALUATED. Skipping duplicate run.")
        return

    user = await session.get(User, attempt.user_id)
    exam = await session.get(Exam, attempt.exam_id)

    if not user or not exam:
        logger.error(f"User or Exam missing for attempt '{attempt_id}'. Aborting pipeline.")
        return

    storage = get_storage_provider()

    # Fetch attempt question responses
    resp_res = await session.exec(
        select(ExamQuestionResponse)
        .where(ExamQuestionResponse.attempt_id == attempt_id)
        .order_by(col(ExamQuestionResponse.created_at).asc())
    )
    responses_db = resp_res.all()

    # Determine if this is a Practice / Guest Exam / Question Subset
    is_practice_or_guest = (
        attempt.mode == AttemptMode.PRACTICE
        or bool(attempt.report_metadata_json and (
            attempt.report_metadata_json.get("is_guest_synced")
            or attempt.report_metadata_json.get("topic_name")
            or attempt.report_metadata_json.get("subtopic_name")
            or attempt.report_metadata_json.get("target_exam")
        ))
    )

    # If responses_db is empty, auto-seed all questions from DB as unattempted
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
        if seeded_resps:
            session.add_all(seeded_resps)
            await session.commit()
            responses_db = seeded_resps
        else:
            logger.warning(f"No questions found to seed for exam '{exam.name}'.")
            return

    # Load User Memories & User Profile — bulk subtopic fetch (avoids N+1)
    mem_res = await session.exec(
        select(UserMemoryState).where(UserMemoryState.user_id == user.id)
    )
    user_memories = mem_res.all()

    # Batch-load all referenced Subtopics in 1 query instead of 1-per-memory-record
    mem_subtopic_ids = [m.subtopic_id for m in user_memories if m.subtopic_id]
    mem_subtopic_map: Dict[Any, Subtopic] = {}
    if mem_subtopic_ids:
        mem_sub_res = await session.exec(select(Subtopic).where(col(Subtopic.id).in_(mem_subtopic_ids)))
        mem_subtopic_map = {s.id: s for s in mem_sub_res.all()}

    topic_mem_records = []
    for m in user_memories:
        sub = mem_subtopic_map.get(m.subtopic_id) if m.subtopic_id else None
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

    # 3. High-Performance Direct DB / Cached Question & Solution Resolution (Zero S3)
    meta_subtopic_override = (attempt.report_metadata_json or {}).get("subtopic_name")
    meta_topic_override = (attempt.report_metadata_json or {}).get("topic_name")
    meta_subject_override = (attempt.report_metadata_json or {}).get("subject_name") or (attempt.report_metadata_json or {}).get("target_exam") or "General Studies"

    master_sol_by_num: Dict[int, Dict[str, Any]] = {}
    master_sol_by_id: Dict[str, Dict[str, Any]] = {}

    try:
        master_sol_doc = await load_exam_solutions_data(exam, session)
        if master_sol_doc and master_sol_doc.get("questions"):
            for s_item in master_sol_doc["questions"]:
                if "question_number" in s_item:
                    master_sol_by_num[int(s_item["question_number"])] = s_item
                if "question_id" in s_item:
                    master_sol_by_id[str(s_item["question_id"])] = s_item
            logger.info(f"Loaded {len(master_sol_doc['questions'])} exam questions/solutions from DB cache for attempt '{attempt.id}'.")
    except Exception as sol_err:
        logger.warning(f"DB solutions cache load failed for exam '{exam.code}': {sol_err}")

    # Preload questions map so question records (knowledge_tags_raw, difficulty, marks) are always available
    q_ids = [r.question_id for r in responses_db if r.question_id]
    q_map: Dict[Any, Question] = {}
    if q_ids:
        q_res = await session.exec(select(Question).where(col(Question.id).in_(q_ids)))
        q_map = {q.id: q for q in q_res.all()}

    # Lazy Database Fallback Cache (only populated if cache is missing data for any question)
    db_loaded = False
    opt_map: Dict[Any, QuestionOption] = {}
    opts_by_qid: Dict[Any, List[QuestionOption]] = {}
    expl_map: Dict[Any, QuestionExplanation] = {}
    meta_map: Dict[Any, QuestionMetadata] = {}
    q_trans_map: Dict[Any, str] = {}
    opt_trans_map: Dict[Any, OptionTranslation] = {}
    subtopic_map: Dict[Any, Subtopic] = {}
    topic_map: Dict[Any, Topic] = {}
    subject_map: Dict[Any, Subject] = {}

    def _is_english(lang: Any) -> bool:
        return str(getattr(lang, "value", lang)).upper() in ("ENGLISH", "EN")

    async def _ensure_db_fallback_loaded():
        nonlocal db_loaded, q_map, opt_map, opts_by_qid, expl_map, meta_map, q_trans_map, opt_trans_map, subtopic_map, topic_map, subject_map
        if db_loaded:
            return
        db_loaded = True
        logger.info(f"Triggering lazy database fallback lookup for attempt '{attempt.id}'...")
        if q_ids and not q_map:
            q_res = await session.exec(select(Question).where(col(Question.id).in_(q_ids)))
            q_rows = q_res.all()
            q_map = {q.id: q for q in q_rows}

        if q_ids:
            opt_res = await session.exec(
                select(QuestionOption)
                .where(col(QuestionOption.question_id).in_(q_ids))
                .order_by(col(QuestionOption.display_order).asc())
            )
            opt_rows = opt_res.all()
            for o in opt_rows:
                opt_map[o.id] = o
                opts_by_qid.setdefault(o.question_id, []).append(o)

            all_opt_ids = [o.id for o in opt_rows]
            if all_opt_ids:
                opt_trans_res = await session.exec(
                    select(OptionTranslation).where(col(OptionTranslation.option_id).in_(all_opt_ids))
                )
                for ot in opt_trans_res.all():
                    prev = opt_trans_map.get(ot.option_id)
                    if prev is None or (_is_english(ot.language) and not _is_english(prev.language)):
                        opt_trans_map[ot.option_id] = ot

            q_trans_res = await session.exec(
                select(QuestionTranslation).where(col(QuestionTranslation.question_id).in_(q_ids))
            )
            q_trans_lang: Dict[Any, Any] = {}
            for qt in q_trans_res.all():
                if qt.question_id not in q_trans_map or (
                    _is_english(qt.language) and not _is_english(q_trans_lang[qt.question_id])
                ):
                    q_trans_map[qt.question_id] = qt.question_text
                    q_trans_lang[qt.question_id] = qt.language

            expl_res = await session.exec(
                select(QuestionExplanation).where(col(QuestionExplanation.question_id).in_(q_ids))
            )
            for ex in expl_res.all():
                prev_ex = expl_map.get(ex.question_id)
                if prev_ex is None or (_is_english(ex.language) and not _is_english(prev_ex.language)):
                    expl_map[ex.question_id] = ex

            meta_res = await session.exec(
                select(QuestionMetadata).where(col(QuestionMetadata.question_id).in_(q_ids))
            )
            for qm in meta_res.all():
                meta_map[qm.question_id] = qm

            subtopic_ids = [q.subtopic_id for q in q_rows if q.subtopic_id]
            if subtopic_ids:
                sub_res = await session.exec(select(Subtopic).where(col(Subtopic.id).in_(subtopic_ids)))
                sub_rows = sub_res.all()
                subtopic_map = {s.id: s for s in sub_rows}

                topic_ids = [s.topic_id for s in sub_rows if s.topic_id]
                if topic_ids:
                    top_res = await session.exec(select(Topic).where(col(Topic.id).in_(topic_ids)))
                    top_rows = top_res.all()
                    topic_map = {t.id: t for t in top_rows}

                    subject_ids = [t.subject_id for t in top_rows if t.subject_id]
                    if subject_ids:
                        subj_res = await session.exec(select(Subject).where(col(Subject.id).in_(subject_ids)))
                        subject_map = {sb.id: sb for sb in subj_res.all()}

    # First recorded "from" option per switched response = the student's initial answer
    initial_option_by_resp: Dict[Any, Any] = {}
    switched_resp_ids = [r.id for r in responses_db if r.is_switched and r.id is not None]
    if switched_resp_ids:
        sw_res = await session.exec(
            select(QuestionSwitchLog)
            .where(col(QuestionSwitchLog.exam_response_id).in_(switched_resp_ids))
            .order_by(col(QuestionSwitchLog.created_at).asc())
        )
        for sw in sw_res.all():
            if sw.exam_response_id not in initial_option_by_resp and sw.from_option_id is not None:
                initial_option_by_resp[sw.exam_response_id] = sw.from_option_id

    responses_payload = []
    resolved_sol_questions = []
    unresolved_question_count = 0

    for index, r in enumerate(responses_db, 1):
        q_num = index
        sol_data: Optional[Dict[str, Any]] = (
            master_sol_by_id.get(str(r.question_id))
            or master_sol_by_num.get(q_num)
        )

        if not sol_data or not sol_data.get("options") or not sol_data.get("explanation"):
            await _ensure_db_fallback_loaded()

        q_model = q_map.get(r.question_id)
        selected_opt = opt_map.get(r.selected_option_id) if (db_loaded and r.selected_option_id) else None

        # Taxonomy resolution
        sub_obj = subtopic_map.get(q_model.subtopic_id) if (q_model and q_model.subtopic_id) else None
        top_obj = topic_map.get(sub_obj.topic_id) if (sub_obj and sub_obj.topic_id) else None
        sbj_obj = subject_map.get(top_obj.subject_id) if (top_obj and top_obj.subject_id) else None

        subtopic_name = (sol_data.get("subtopic") if sol_data else None) or (sub_obj.name if sub_obj else None) or meta_subtopic_override or "Core Concepts"
        topic_name = (sol_data.get("topic") if sol_data else None) or (top_obj.name if top_obj else None) or meta_topic_override or (subtopic_name if not sub_obj else "General Knowledge")
        subject_name = (sol_data.get("subject") if sol_data else None) or (sbj_obj.name if sbj_obj else None) or meta_subject_override or "General Studies"

        # Question text
        sol_q_text = (sol_data.get("question_text") or sol_data.get("text")) if sol_data else None
        db_q_text = q_trans_map.get(r.question_id)
        if not sol_q_text and not db_q_text:
            unresolved_question_count += 1
            logger.warning(f"Question #{q_num} (ID: {r.question_id}) in attempt '{attempt.id}' used fallback text.")
        q_text = sol_q_text or db_q_text or f"Question {q_num}"

        # Options resolution
        options_payload = []
        correct_option_id = sol_data.get("correct_option_id") if sol_data else None
        correct_option_label = sol_data.get("correct_option_label", "A") if sol_data else "A"

        sol_options = sol_data.get("options") if sol_data else None
        if sol_options and isinstance(sol_options, list) and len(sol_options) > 0:
            for opt_idx, opt_raw in enumerate(sol_options):
                lbl = str(opt_raw.get("option_label") or opt_raw.get("label") or chr(65 + opt_idx))
                opt_id_str = str(opt_raw.get("option_id") or opt_raw.get("id") or f"opt-{q_num}-{lbl}")
                is_corr = bool(opt_raw.get("is_correct", False))
                c_score = float(opt_raw.get("closeness_score", 1.0 if is_corr else 0.25))
                dist_ana = opt_raw.get("distractor_analysis")
                opt_txt = str(opt_raw.get("text") or opt_raw.get("option_text") or f"Option {lbl}")

                if is_corr:
                    correct_option_id = opt_id_str
                    correct_option_label = lbl

                options_payload.append({
                    "option_id": opt_id_str,
                    "option_label": lbl,
                    "text": opt_txt,
                    "is_correct": is_corr,
                    "closeness_score": c_score,
                    "distractor_analysis": dist_ana,
                })
        else:
            q_opts = opts_by_qid.get(r.question_id, [])
            for o in q_opts:
                o_trans = opt_trans_map.get(o.id)
                o_text = o_trans.option_text if o_trans else f"Option {o.option_label}"
                o_dist_analysis = o_trans.distractor_analysis if o_trans else None

                if o.is_correct:
                    correct_option_id = str(o.id)
                    correct_option_label = o.option_label

                options_payload.append({
                    "option_id": str(o.id),
                    "option_label": o.option_label,
                    "text": o_text,
                    "is_correct": o.is_correct,
                    "closeness_score": float(o.closeness_score if o.closeness_score is not None else (1.0 if o.is_correct else 0.25)),
                    "distractor_analysis": o_dist_analysis,
                })

        # Explanations
        sol_expl = sol_data.get("explanation") if (sol_data and isinstance(sol_data.get("explanation"), dict)) else None
        expl_record = expl_map.get(r.question_id)

        if sol_expl:
            detailed_sol = sol_expl.get("detailed_solution") or sol_expl.get("detailed_text") or f"**Option ({correct_option_label}) is correct.**"
            expl_dict = {
                "core_concept": sol_expl.get("core_concept") or f"{topic_name} - {subtopic_name}",
                "detailed_solution": detailed_sol,
                "common_traps": sol_expl.get("common_traps") or [],
                "key_takeaways": sol_expl.get("key_takeaways") or ([sol_expl.get("key_takeaway")] if sol_expl.get("key_takeaway") else [f"Key focus area: {subtopic_name}"]),
            }
        elif expl_record:
            detailed_sol = expl_record.detailed_solution or f"**Option ({correct_option_label}) is correct.**"
            expl_dict = {
                "core_concept": expl_record.core_concept or f"{topic_name} - {subtopic_name}",
                "detailed_solution": detailed_sol,
                "common_traps": expl_record.common_traps_json or [],
                "key_takeaways": expl_record.key_takeaways_json or [f"Key focus area: {subtopic_name}"],
            }
        else:
            logger.warning(f"Question #{q_num} (ID: {r.question_id}) in attempt '{attempt.id}' used fallback explanation.")
            expl_dict = {
                "core_concept": f"{topic_name} - {subtopic_name}",
                "detailed_solution": f"**Option ({correct_option_label}) is correct.**\n\nThis question evaluates mastery of {subtopic_name}.",
                "common_traps": [],
                "key_takeaways": [f"Key focus area: {subtopic_name}"],
            }

        # Metadata (Blooms, Cognitive Skill, IRT, Difficulty)
        qm_record = meta_map.get(r.question_id)
        sol_blooms = sol_data.get("blooms_level") if sol_data else None
        sol_cognitive = sol_data.get("cognitive_skill") if sol_data else None
        sol_irt = sol_data.get("irt_params") if (sol_data and isinstance(sol_data.get("irt_params"), dict)) else None
        sol_diff = sol_data.get("difficulty") if sol_data else None

        raw_q_type = (
            (q_model.knowledge_tags_raw.get("question_type") if (q_model and q_model.knowledge_tags_raw and isinstance(q_model.knowledge_tags_raw, dict)) else None)
            or (sol_data.get("question_type_tag") if sol_data else None)
            or (sol_data.get("question_type") if (sol_data and str(sol_data.get("question_type")).strip() not in ("MCQ_SINGLE", "MCQ_MULTIPLE")) else None)
            or (sol_data.get("cognitive_skill") if (sol_data and str(sol_data.get("cognitive_skill")).strip().lower() not in ("extraction stage initialized", "conceptual reasoning")) else None)
            or (qm_record.cognitive_skill if qm_record and qm_record.cognitive_skill and str(qm_record.cognitive_skill).strip().lower() not in ("extraction stage initialized", "conceptual reasoning") else None)
        )

        blooms_val = sol_blooms or ((qm_record.blooms_level.value if hasattr(qm_record.blooms_level, "value") else str(qm_record.blooms_level)) if (qm_record and qm_record.blooms_level) else "ANALYZE")
        cognitive_skill = raw_q_type or (sol_cognitive if (sol_cognitive and str(sol_cognitive).strip().lower() not in ("extraction stage initialized", "conceptual reasoning")) else None) or (qm_record.cognitive_skill if (qm_record and qm_record.cognitive_skill) else "Conceptual Reasoning")

        if sol_irt:
            irt_params = {
                "a": float(sol_irt.get("a", 1.50)),
                "b": float(sol_irt.get("b", 0.00)),
                "c": float(sol_irt.get("c", 0.25)),
            }
        else:
            irt_params = {
                "a": qm_record.irt_discrimination_a if qm_record and qm_record.irt_discrimination_a is not None else 1.50,
                "b": qm_record.irt_difficulty_b if qm_record and qm_record.irt_difficulty_b is not None else 0.00,
                "c": qm_record.irt_pseudo_guessing_c if qm_record and qm_record.irt_pseudo_guessing_c is not None else 0.25,
            }

        diff_val = sol_diff or ((q_model.difficulty.value if hasattr(q_model.difficulty, "value") else str(q_model.difficulty)) if q_model else "MEDIUM")

        # Match User Selected Label
        user_sel_label = "Unattempted"
        if r.selected_option_id:
            sel_str = str(r.selected_option_id)
            matched_opt = next((o for o in options_payload if str(o.get("option_id")) == sel_str), None)
            if matched_opt:
                user_sel_label = matched_opt.get("option_label", "A")
            elif selected_opt:
                user_sel_label = selected_opt.option_label
            else:
                user_sel_label = "A"

        resp_item = {
            "question_id": str(r.question_id),
            "question_number": index,
            "question_text": q_text,
            "options": options_payload,
            "subject": subject_name,
            "topic": topic_name,
            "subtopic": subtopic_name,
            "difficulty": diff_val,
            "blooms_level": blooms_val,
            "cognitive_skill": cognitive_skill,
            "question_type_tag": raw_q_type,
            "selected_option_id": str(r.selected_option_id) if r.selected_option_id else None,
            "user_selected_label": user_sel_label,
            "is_correct": r.is_correct,
            "closeness_score_awarded": r.closeness_score_awarded,
            "final_score": r.final_score,
            # The paper's own marking scheme for this question
            "marks": question_marks(getattr(q_model, "marks", None), getattr(q_model, "negative_marks", None))[0],
            "negative_marks": question_marks(getattr(q_model, "marks", None), getattr(q_model, "negative_marks", None))[1],
            "time_taken_seconds": float(r.time_taken_seconds or 0.0),
            "expected_time_seconds": float(r.expected_time_seconds if (r.expected_time_seconds and r.expected_time_seconds > 0) else 60.0),
            "is_switched": r.is_switched,
            "confidence_level": r.confidence_level,
            "answer_round": r.answer_round,
            "initial_correct": bool(
                correct_option_id
                and r.id in initial_option_by_resp
                and str(initial_option_by_resp[r.id]) == str(correct_option_id)
            ),
            "gti_item_score": r.gti_item_score,
            "answer_revealed": r.answer_revealed,
            "explanation": expl_dict,
        }
        responses_payload.append(resp_item)

        resolved_sol_questions.append({
            "question_id": str(r.question_id),
            "question_number": index,
            "question_text": q_text,
            "options": options_payload,
            "correct_option_id": correct_option_id,
            "correct_option_label": correct_option_label,
            "subject": subject_name,
            "topic": topic_name,
            "subtopic": subtopic_name,
            "difficulty": diff_val,
            "blooms_level": blooms_val,
            "cognitive_skill": cognitive_skill,
            "irt_params": irt_params,
            "explanation": expl_dict,
        })

    if is_practice_or_guest or not master_sol_doc or not master_sol_doc.get("questions"):
        solutions_data = {
            "exam_id": str(exam.id),
            "exam_code": exam.code,
            "questions": resolved_sol_questions,
        }
    else:
        solutions_data = master_sol_doc

    t_start = datetime.now(timezone.utc)

    # Resolve traceable exam name for practice/guest tests
    meta = attempt.report_metadata_json or {}
    is_guest = bool(meta.get("is_guest_synced") or meta.get("guest_session_id"))
    topic_desc = meta.get("subtopic_name") or meta.get("topic_name")
    if not topic_desc and responses_payload:
        topics_in_resps = [r.get("topic") or r.get("subject") for r in responses_payload if r.get("topic") or r.get("subject")]
        if topics_in_resps:
            from collections import Counter
            topic_desc = Counter(topics_in_resps).most_common(1)[0][0]

    if not topic_desc:
        topic_desc = "Topic Practice"

    q_count = len(responses_payload) or attempt.total_questions or 10
    if is_guest:
        traceable_exam_name = f"Guest Practice: {topic_desc} ({q_count} Questions)"
    elif is_practice_or_guest:
        traceable_exam_name = f"Practice Test: {topic_desc} ({q_count} Questions)"
    else:
        traceable_exam_name = exam.name

    logger.info(f"🚀 [PIPELINE_START] Beginning submission analysis for Attempt '{attempt.id}' | Title: '{traceable_exam_name}' | User: '{user.full_name}' ({user.email})")

    # 4. Execute Mode-Aware Matrix Orchestrator
    allocated_duration = float(exam.total_duration_minutes or 120)
    if is_practice_or_guest:
        allocated_duration = max(5.0, len(responses_payload) * 2.0)

    t_mat_start = datetime.now(timezone.utc)
    report = MatrixOrchestrator.compute_full_report(
        attempt_id=attempt.id,
        mode=attempt.mode,
        responses=responses_payload,
        solutions_data=solutions_data,
        allocated_duration_minutes=allocated_duration,
        user_memory_records=topic_mem_records,
        candidate_info={"user_id": str(user.id), "full_name": user.full_name, "email": user.email},
        exam_info={"exam_id": str(exam.id), "exam_name": traceable_exam_name, "exam_code": exam.code},
        profile_data=profile_dict,
    )
    t_mat_end = datetime.now(timezone.utc)
    mat_duration_ms = round((t_mat_end - t_mat_start).total_seconds() * 1000, 1)

    part_2 = report.get("part_2_exam_macro_scorecard", {})
    part_3 = report.get("part_3_aggregated_user_report", {})
    tax_analysis = report.get("part_2_taxonomy_analysis", {})

    # Detailed logs explaining how each matrix was evaluated
    logger.info(f"🧠 [STEP 1/4: 12-MATRIX COMPUTATION COMPLETED in {mat_duration_ms}ms]")
    icrs_obj = part_3.get("icrs", {}) or part_2.get("icrs_overall_readiness", {})
    logger.info(
        f"   ├─ 1. ICRS (Exam Preparedness): {icrs_obj.get('icrs_score', 0)}/100 ({icrs_obj.get('readiness_tier', 'FOUNDATION')}) "
        f"| Grounding: Net Marks={icrs_obj.get('net_score', 0):.2f}/200.0, Qualifying Cutoff={icrs_obj.get('qualifying_cutoff_marks', 92.0)} Marks, Coverage={icrs_obj.get('attempted_count', 0)}/{icrs_obj.get('total_questions', 100)} questions"
    )
    irt_obj = part_3.get("irt_3pl", {}) or part_2.get("irt_ability_estimate", {})
    logger.info(
        f"   ├─ 2. IRT 3PL Mastery (Latent Ability): Theta={irt_obj.get('latent_ability_theta', 0.0):+.2f} "
        f"| Percentile={irt_obj.get('percentile_rank', 50.0)}% | Tier={irt_obj.get('ability_label', 'Competent')}"
    )
    gti_obj = part_3.get("gti", {}) or part_2.get("guessing_tendency_index", {})
    logger.info(
        f"   ├─ 3. GTI (Guessing Tendency): Aggregate={gti_obj.get('aggregate', 0.0)*100:.1f}% "
        f"| Category={gti_obj.get('label', 'Calculated 50:50')} | High Impulse Guesses={gti_obj.get('high_guessing_count', 0)}"
    )
    oeei_obj = part_3.get("oeei", {}) or part_2.get("option_elimination_index", {})
    logger.info(
        f"   ├─ 4. OEEI (Option Elimination Precision): Conversion={oeei_obj.get('oeei_score_pct', 70.0):.1f}% "
        f"| Rating={oeei_obj.get('elimination_rating', 'HIGH_TACTICAL_PRECISION')}"
    )
    satoi_obj = part_3.get("satoi", {}) or part_2.get("satoi_cognitive_stamina", {})
    logger.info(
        f"   ├─ 5. SATOI (Exam Stamina & Endurance): Stamina Score={satoi_obj.get('satoi_score', 80)}/100 "
        f"| Status={satoi_obj.get('stamina_label', 'Healthy Stamina')} | Dropout Check: {len(responses_payload)} items assessed"
    )
    pacing_obj = part_3.get("pacing", {}) or part_2.get("pacing_speed_strategy", {})
    logger.info(
        f"   ├─ 6. Time Budgeting & Pacing: Status={pacing_obj.get('pacing_status', 'BALANCED')} "
        f"| Avg Pace={pacing_obj.get('avg_time_per_question_sec', 60.0):.1f}s/question (Target: 72s) | Duration Utilization={pacing_obj.get('time_utilization_pct', 90)}%"
    )
    osri_obj = part_3.get("switch_regret", {}) or part_2.get("osri_switch_regret", {})
    logger.info(
        f"   ├─ 7. Answer Revision Safety: Total Switches={osri_obj.get('total_switches', 0)} "
        f"| Right->Wrong (Costly)={osri_obj.get('negative_regret_switches', 0)} (lost {osri_obj.get('negative_regret_switches', 0)*2.67:.1f} Marks) "
        f"| Wrong->Right (Rewarding)={osri_obj.get('positive_switches', 0)} (gained +{osri_obj.get('positive_switches', 0)*2.67:.1f} Marks) "
        f"| Net Revision Impact={osri_obj.get('net_score_impact', 0.0):+.2f} Marks"
    )
    blooms_obj = part_3.get("blooms", {}) or part_2.get("blooms_mastery_index", {})
    logger.info(
        f"   ├─ 8. Cognitive Thinking Levels: Recall={blooms_obj.get('fact_recall_accuracy', 0.0):.1f}% "
        f"| Analytical={blooms_obj.get('conceptual_analysis_accuracy', 0.0):.1f}% | Critical Evaluation={blooms_obj.get('critical_evaluation_accuracy', 0.0):.1f}%"
    )
    dist_obj = part_3.get("distractor", {}) or part_2.get("distractor_closeness_model", {})
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
    attempt.irt_theta = float(irt_obj.get("latent_ability_theta", 0.0))
    attempt.gti_score = float(gti_obj.get("aggregate", 0.20))
    attempt.oeei_score = float(oeei_obj.get("oeei_score", 0.70))
    attempt.satoi_score = float(satoi_obj.get("satoi_score", 85.0))
    attempt.icrs_score = float(icrs_obj.get("icrs_score", 65.0))
    attempt.pacing_status = str(pacing_obj.get("pacing_status", "BALANCED_PACING"))
    session.add(attempt)

    now_t = datetime.now(timezone.utc)

    # 6–7c mutate running per-user totals; a report-only re-run (backfill) must not apply them twice
    if not report_only:
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

        # 7. Bulk Update UserTaxonomyMastery (Filtering out synthetic wildcard/placeholder labels)
        t_db_start = datetime.now(timezone.utc)
        tax_by_blooms = [
            {
                "taxonomy_name": f"Bloom's {b_k.upper()} Thinking",
                "taxonomy_id_code": b_k.upper(),
                "total_questions": b_v.get("total", 0),
                "correct": b_v.get("correct", 0),
                "accuracy_percentage": b_v.get("accuracy", 0.0),
                "strength_status": "STRONG" if b_v.get("accuracy", 0.0) >= 75.0 else ("MODERATE" if b_v.get("accuracy", 0.0) >= 50.0 else "WEAK_REVISION_REQUIRED"),
            }
            for b_k, b_v in (blooms_obj.get("breakdown", {}) or {}).items()
            if b_v.get("total", 0) > 0
        ]
        all_tax_items = [
            (t_type, x)
            for (t_type, items) in [
                ("SUBJECT", tax_by_subj),
                ("TOPIC", tax_by_top),
                ("SUBTOPIC", tax_by_sub),
                ("BLOOMS", tax_by_blooms),
            ]
            for x in items
            if not is_placeholder_taxonomy(x.get("taxonomy_name") or x.get("name"))
        ]
        aggregated_tax: Dict[tuple, Dict[str, Any]] = {}
        for tax_type, item in all_tax_items:
            code_id = (item.get("taxonomy_id_code") or item.get("taxonomy_name") or "General").strip()
            disp_name = (item.get("taxonomy_name") or item.get("taxonomy_id_code") or code_id).strip()
            norm_type = str(tax_type).strip().upper()
            norm_code = code_id.strip().upper()[:100]
            t_key = (norm_type, norm_code)
            if t_key in aggregated_tax:
                aggregated_tax[t_key]["total_questions"] += item.get("total_questions", 0)
                aggregated_tax[t_key]["correct"] += item.get("correct", 0)
                tot = aggregated_tax[t_key]["total_questions"]
                cor = aggregated_tax[t_key]["correct"]
                aggregated_tax[t_key]["accuracy_percentage"] = round((cor / max(1, tot)) * 100.0, 1)
            else:
                aggregated_tax[t_key] = {
                    "taxonomy_type": norm_type,
                    "taxonomy_id_code": norm_code,
                    "taxonomy_name": disp_name,
                    "total_questions": item.get("total_questions", 0),
                    "correct": item.get("correct", 0),
                    "accuracy_percentage": item.get("accuracy_percentage", 0.0),
                    "strength_status": item.get("strength_status", "MODERATE"),
                }

        # Bulk query existing taxonomy masteries in 1 query with case-normalized upper keys
        existing_tax_res = await session.exec(select(UserTaxonomyMastery).where(UserTaxonomyMastery.user_id == user.id))
        existing_tax_all = existing_tax_res.all()
        tax_map: Dict[tuple, UserTaxonomyMastery] = {}
        for m in existing_tax_all:
            norm_t = str(m.taxonomy_type).strip().upper()
            norm_c = str(m.taxonomy_id_code).strip().upper()
            norm_n = str(m.taxonomy_name).strip().upper()
            tax_map[(norm_t, norm_c)] = m
            tax_map[(norm_t, norm_n)] = m

        # Compute all taxonomy row updates in-memory first (no DB calls), then persist in a single
        # bulk upsert statement instead of 1 upsert exec per distinct taxonomy item.
        tax_rows: List[Dict[str, Any]] = []
        for (norm_type, norm_code), item in aggregated_tax.items():
            m_obj = tax_map.get((norm_type, norm_code)) or tax_map.get((norm_type, item["taxonomy_name"].strip().upper()))
            if not m_obj:
                tot = item["total_questions"]
                cor = item["correct"]
                acc = item["accuracy_percentage"]
                st = item["strength_status"]
            else:
                tot = m_obj.total_attempts + item["total_questions"]
                cor = m_obj.correct_attempts + item["correct"]
                acc = round((cor / max(1, tot)) * 100.0, 1)
                st = "STRONG" if acc >= 75.0 else ("MODERATE" if acc >= 50.0 else "WEAK_REVISION_REQUIRED")

            tax_rows.append({
                "user_id": user.id,
                "taxonomy_type": norm_type,
                "taxonomy_id_code": norm_code,
                "taxonomy_name": item["taxonomy_name"],
                "total_attempts": tot,
                "correct_attempts": cor,
                "mastery_percentage": acc,
                "strength_status": st,
                "updated_at": datetime.now(timezone.utc),
            })

        if tax_rows:
            try:
                from sqlalchemy.dialects.postgresql import insert as pg_insert

                # Deduplicate by unique index (user_id, taxonomy_type, taxonomy_id_code)
                unique_tax_rows = {}
                for r in tax_rows:
                    unique_tax_rows[(r["user_id"], r["taxonomy_type"], r["taxonomy_id_code"])] = r
                deduped_rows = list(unique_tax_rows.values())

                stmt = pg_insert(UserTaxonomyMastery).values(deduped_rows)
                stmt = stmt.on_conflict_do_update(
                    index_elements=["user_id", "taxonomy_type", "taxonomy_id_code"],
                    set_={
                        "taxonomy_name": stmt.excluded.taxonomy_name,
                        "total_attempts": stmt.excluded.total_attempts,
                        "correct_attempts": stmt.excluded.correct_attempts,
                        "mastery_percentage": stmt.excluded.mastery_percentage,
                        "strength_status": stmt.excluded.strength_status,
                        "updated_at": stmt.excluded.updated_at,
                    },
                )
                await session.exec(stmt)
            except Exception as tax_err:
                logger.warning(f"PostgreSQL ON CONFLICT upsert failed: {tax_err}. Falling back to safe row-by-row merge.")
                for row in tax_rows:
                    m_obj = tax_map.get((row["taxonomy_type"], row["taxonomy_id_code"])) or tax_map.get(
                        (row["taxonomy_type"], row["taxonomy_name"].strip().upper())
                    )
                    if not m_obj:
                        new_m = UserTaxonomyMastery(
                            user_id=row["user_id"],
                            taxonomy_type=row["taxonomy_type"],
                            taxonomy_id_code=row["taxonomy_id_code"],
                            taxonomy_name=row["taxonomy_name"],
                            total_attempts=row["total_attempts"],
                            correct_attempts=row["correct_attempts"],
                            mastery_percentage=row["mastery_percentage"],
                            strength_status=row["strength_status"],
                            updated_at=row["updated_at"],
                        )
                        session.add(new_m)
                        tax_map[(row["taxonomy_type"], row["taxonomy_id_code"])] = new_m
                    else:
                        m_obj.total_attempts = row["total_attempts"]
                        m_obj.correct_attempts = row["correct_attempts"]
                        m_obj.mastery_percentage = row["mastery_percentage"]
                        m_obj.strength_status = row["strength_status"]
                        m_obj.updated_at = row["updated_at"]
                        session.add(m_obj)

        # 7b. Bulk Update FSRS UserMemoryState & UserConceptRetention
        try:
            async with session.begin_nested():
                all_resp_q_ids = [r.question_id for r in responses_db if r.question_id]
                uid = int(user.id) if user.id is not None else 0

                # Bulk load memory records
                existing_mem_res = await session.exec(
                    select(UserMemoryState).where(
                        UserMemoryState.user_id == uid,
                        col(UserMemoryState.question_id).in_(all_resp_q_ids),
                    )
                )
                existing_mem_map = {m.question_id: m for m in existing_mem_res.all()}

                existing_ret_res = await session.exec(
                    select(UserConceptRetention).where(UserConceptRetention.user_id == uid)
                )
                existing_ret_map = {r.subtopic_id: r for r in existing_ret_res.all() if r.subtopic_id}

                for resp in responses_db:
                    if not resp.question_id:
                        continue
                    q_subtopic_id = None
                    if resp.question_id in q_map:
                        q_subtopic_id = q_map[resp.question_id].subtopic_id

                    is_corr = bool(resp.is_correct)
                    mem_obj = existing_mem_map.get(resp.question_id)

                    if not mem_obj:
                        diff = 5.0 if not is_corr else 3.5
                        stab = 1.0 if not is_corr else 3.0
                        ret = 0.4 if not is_corr else 1.0
                    else:
                        if is_corr:
                            stab = round(mem_obj.fsrs_stability * 1.5, 2)
                            diff = max(1.0, round(mem_obj.fsrs_difficulty - 0.2, 2))
                            ret = 1.0
                        else:
                            stab = max(0.5, round(mem_obj.fsrs_stability * 0.6, 2))
                            diff = min(10.0, round(mem_obj.fsrs_difficulty + 0.5, 2))
                            ret = 0.4

                    next_review_dt = now_t + timedelta(days=max(1, int(stab)))

                    if not mem_obj:
                        mem_obj = UserMemoryState(
                            user_id=uid,
                            question_id=resp.question_id,
                            subtopic_id=q_subtopic_id,
                            fsrs_difficulty=diff,
                            fsrs_stability=stab,
                            retrievability=ret,
                            last_reviewed_at=now_t,
                            next_scheduled_review=next_review_dt,
                        )
                        session.add(mem_obj)
                        existing_mem_map[resp.question_id] = mem_obj
                    else:
                        mem_obj.subtopic_id = q_subtopic_id
                        mem_obj.fsrs_difficulty = diff
                        mem_obj.fsrs_stability = stab
                        mem_obj.retrievability = ret
                        mem_obj.last_reviewed_at = now_t
                        mem_obj.next_scheduled_review = next_review_dt
                        session.add(mem_obj)

                    if q_subtopic_id:
                        ret_obj = existing_ret_map.get(q_subtopic_id)
                        if not ret_obj:
                            ret_obj = UserConceptRetention(
                                user_id=uid,
                                subtopic_id=q_subtopic_id,
                                fsrs_difficulty=diff,
                                fsrs_stability=stab,
                                fsrs_retrievability=ret,
                                total_reviews=1,
                                lapses=0 if is_corr else 1,
                                last_reviewed_at=now_t,
                                next_scheduled_review=next_review_dt,
                            )
                            session.add(ret_obj)
                            existing_ret_map[q_subtopic_id] = ret_obj
                        else:
                            ret_obj.fsrs_difficulty = diff
                            ret_obj.fsrs_stability = stab
                            ret_obj.fsrs_retrievability = ret
                            ret_obj.total_reviews += 1
                            if not is_corr:
                                ret_obj.lapses += 1
                            ret_obj.last_reviewed_at = now_t
                            ret_obj.next_scheduled_review = next_review_dt
                            session.add(ret_obj)

                await session.flush()
        except Exception as mem_err:
            logger.warning(f"Error updating UserMemoryState / UserConceptRetention: {mem_err}")

        # 7c. Award Gamification Badges & XP (isolated so gamification never aborts submission pipeline)
        try:
            from app.services.gamification_service import GamificationService
            async with session.begin_nested():
                g_service = GamificationService(session)
                if user.id is not None:
                    await g_service.check_and_update_daily_goal(int(user.id))
        except Exception as badge_err:
            logger.warning(f"Gamification processing warning: {badge_err}")

        # 7d. XP for this test (+50, +10 per correct, +20 for the day); keyed by attempt, so never paid twice
        try:
            from app.services import xp_service
            async with session.begin_nested():
                if user.id is not None:
                    correct = sum(1 for r in responses_db if r.selected_option_id is not None and r.is_correct)
                    await xp_service.award_test_completion(
                        session, int(user.id), int(attempt.id), correct, attempt.submitted_at, commit=False
                    )
        except Exception as xp_err:
            logger.warning(f"XP award warning for attempt '{attempt.id}': {xp_err}")

        # 7e. Milestones reached with this test (badge, XP, notification)
        try:
            from app.services import milestone_service
            async with session.begin_nested():
                if user.id is not None:
                    await milestone_service.check(session, int(user.id), commit=False)
        except Exception as ms_err:
            logger.warning(f"Milestone check warning for attempt '{attempt.id}': {ms_err}")

    elif profile is None:
        profile = UserSkillProfile(user_id=user.id, **profile_dict)

    # 8. AI Diagnostic Synthesis (Structured Output LLM Call with Zero Math Hallucination)
    from app.engine.report_ai_synthesizer import ReportAISynthesizer
    
    part_1_items = report.get("part_1_per_question_analysis", [])
    tax_analysis = report.get("part_2_taxonomy_analysis", {})
    score_summary = part_2.get("score_summary", {})
    upsc_bench = part_2.get("upsc_prelims_benchmark", {})
    
    precalc_payload = {
        "scoring": {
            "net_score": score_summary.get("total_score", 0.0),
            "max_score": score_summary.get("max_score", 200.0),
            "qualifying_cutoff": upsc_bench.get("expected_cutoff_marks", 92.0),
            "cutoff_margin": upsc_bench.get("cutoff_margin", 0.0),
            "accuracy_percentage": score_summary.get("accuracy_percentage", 0.0),
            "attempted_count": score_summary.get("attempted_count", 0),
            "unattempted_count": score_summary.get("unattempted_count", 0),
            "correct_count": score_summary.get("correct_count", 0),
            "incorrect_count": score_summary.get("incorrect_count", 0),
            "gross_positive_marks": upsc_bench.get("positive_marks_earned", 0.0),
            "negative_marks_lost": upsc_bench.get("negative_marks_lost", 0.0),
        },
        "psychometrics": {
            "icrs_score": icrs_obj.get("icrs_score", 65.0),
            "readiness_tier": icrs_obj.get("readiness_tier", "MODERATE_DEVELOPING_READINESS"),
            "irt_latent_theta": irt_obj.get("latent_ability_theta", 0.0),
            "percentile_rank": irt_obj.get("percentile_rank", 50.0),
            "gti_aggregate": gti_obj.get("aggregate", 0.20),
            "gti_category": gti_obj.get("category", "CONTROLLED_CALCULATED_RISK"),
            "oeei_score_pct": oeei_obj.get("oeei_score_pct", 70.0),
            "satoi_score": satoi_obj.get("satoi_score", 85.0),
            "pacing_status": pacing_obj.get("pacing_status", "BALANCED"),
            "avg_seconds_per_question": pacing_obj.get("avg_time_per_question_sec", 60.0),
            "switch_regret_index": osri_obj.get("regret_index", 0.0),
            "negative_switches_count": osri_obj.get("negative_regret_switches", 0),
            "positive_switches_count": osri_obj.get("positive_switches", 0),
        },
        "unattempted_analysis": part_2.get("unattempted_summary", {}),
        "distractor_vulnerability": {
            "high_closeness_traps_fallen": dist_obj.get("high_closeness_count", 0),
            "inverse_fact_traps_fallen": dist_obj.get("inverse_distractor_count", 0),
            "neutral_distractor_misses": dist_obj.get("neutral_distractor_count", 0),
        },
        "blooms_mastery": blooms_obj,
        "weak_taxonomy_areas": [
            {
                "subject": wt.get("subject") or "General Studies",
                "topic": wt.get("taxonomy_name") or wt.get("name"),
                "subtopic": wt.get("subtopic"),
                "accuracy": wt.get("accuracy_percentage", 0.0),
                "missed_questions": [q["question_number"] for q in part_1_items if (q.get("topic") == wt.get("taxonomy_name") or q.get("subject") == wt.get("taxonomy_name")) and not q.get("is_correct")],
                "fsrs_stability_days": wt.get("fsrs_stability_days", 1.5),
                "retention_health": wt.get("retention_health", "REVISION_RECOMMENDED_SOON"),
            }
            for wt in tax_analysis.get("by_topic", []) if wt.get("strength_status") in ("WEAK_REVISION_REQUIRED", "CRITICAL_DEFICIT", "MODERATE")
        ][:5],
        "strong_taxonomy_areas": [
            {
                "subject": st.get("subject") or "General Studies",
                "topic": st.get("taxonomy_name") or st.get("name"),
                "accuracy": st.get("accuracy_percentage", 0.0),
                "fsrs_stability_days": st.get("fsrs_stability_days", 5.0),
                "retention_health": st.get("retention_health", "OPTIMAL_LONG_TERM_STABILITY"),
            }
            for st in tax_analysis.get("by_topic", []) if st.get("strength_status") in ("STRONG", "EXCEPTIONAL_MASTERY")
        ][:3],
    }

    candidate_dict = {"user_id": str(user.id), "full_name": user.full_name, "email": user.email}
    exam_dict = {"attempt_id": str(attempt.id), "exam_id": str(exam.id), "exam_name": traceable_exam_name, "exam_code": exam.code, "mode": str(attempt.mode)}

    # ─── Phase 1: Flush all math results to DB immediately ───────────────────
    # Persist per-question diagnostics BEFORE LLM call so the report is readable
    # even if LLM is slow or fails. Frontend can show math report immediately.
    existing_q_reps = await session.exec(select(ExamQuestionReport).where(ExamQuestionReport.attempt_id == attempt.id))
    q_rep_map = {r.question_id: r for r in existing_q_reps.all()}
    for q_item in part_1_items:
        q_raw = q_item.get("question_id")
        q_uid = int(q_raw) if q_raw is not None else None
        expl_dict = q_item.get("explanation")
        existing_q_rep = q_rep_map.get(q_uid)
        if not existing_q_rep:
            session.add(ExamQuestionReport(
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
            ))
        else:
            existing_q_rep.explanation_json = expl_dict
            existing_q_rep.is_correct = q_item.get("is_correct", False)
            existing_q_rep.final_score = float(q_item.get("marks_awarded", 0.0))
            session.add(existing_q_rep)

    # Persist ExamAttemptReport with full 12-matrix math evaluation so reports are instantly available
    attempt_rep_stmt_p1 = select(ExamAttemptReport).where(ExamAttemptReport.attempt_id == attempt.id)
    existing_att_rep_p1 = (await session.exec(attempt_rep_stmt_p1)).first()
    if not existing_att_rep_p1:
        session.add(ExamAttemptReport(
            attempt_id=attempt.id,
            user_id=user.id,
            exam_id=exam.id,
            matrices_summary_json=report.get("part_3_aggregated_user_report", {}),
            taxonomy_breakdown_json=report.get("part_2_taxonomy_analysis", {}),
            llm_insight_json=None,
            full_report_json=report,
            s3_report_url=None,
        ))
    else:
        existing_att_rep_p1.matrices_summary_json = report.get("part_3_aggregated_user_report", {})
        existing_att_rep_p1.taxonomy_breakdown_json = report.get("part_2_taxonomy_analysis", {})
        existing_att_rep_p1.full_report_json = report
        session.add(existing_att_rep_p1)

    # Slim metadata summary stored on attempt (NOT the full 100-question report)
    _score_summary = part_2.get("score_summary", {})
    attempt.report_metadata_json = {
        "is_ready": True,
        "phase": "MATH_COMPLETE",
        "exam_name": traceable_exam_name,
        "scoring": {
            "net_score": _score_summary.get("total_score", 0.0),
            "max_score": _score_summary.get("max_score", 200.0),
            "accuracy_percentage": _score_summary.get("accuracy_percentage", 0.0),
            "correct_count": _score_summary.get("correct_count", 0),
            "incorrect_count": _score_summary.get("incorrect_count", 0),
            "unattempted_count": _score_summary.get("unattempted_count", 0),
        },
        "icrs_score": icrs_obj.get("icrs_score", 65.0),
        "irt_theta": irt_obj.get("latent_ability_theta", 0.0),
        "unresolved_question_count": unresolved_question_count,
    }
    session.add(attempt)
    await session.commit()

    from app.cache import invalidate_attempt_cache
    await invalidate_attempt_cache(attempt.id, user.id)

    logger.info(f"⚡ [PHASE_1_DONE] Math results persisted for attempt '{attempt.id}'. Starting LLM synthesis...")

    # ─── Phase 2: AI synthesis (with rule-based fallback) ────────────────────
    # The free plan has no AI analysis: skip the LLM call and keep the rule-based insight, so the
    # report is complete if the student upgrades later.
    from app.services.free_plan import is_limited
    if user is not None and await is_limited(session, user):
        logger.info(f"[PHASE_2] Free plan: rule-based insight only for attempt '{attempt.id}' (no LLM call).")
        mentorship_insight = _generate_rule_based_insight(
            part_3=report.get("part_3_aggregated_user_report", {}),
            taxonomy=report.get("part_2_taxonomy_analysis", {}),
        )
    else:
        try:
            mentorship_insight = await ReportAISynthesizer.generate_diagnostic_insight(
                candidate_info=candidate_dict,
                exam_info=exam_dict,
                precalculated_metrics=precalc_payload,
            )
        except Exception as llm_err:
            logger.warning(f"LLM diagnostic insight generation failed for attempt '{attempt.id}': {llm_err}. Using rule-based insight fallback.")
            mentorship_insight = _generate_rule_based_insight(
                part_3=report.get("part_3_aggregated_user_report", {}),
                taxonomy=report.get("part_2_taxonomy_analysis", {}),
            )

    # Sync AI insights into report
    ai_tasks = mentorship_insight.get("study_plan_tasks", [])
    if "part_2_exam_macro_scorecard" in report:
        report["part_2_exam_macro_scorecard"]["ai_cognitive_insights"] = mentorship_insight
        if ai_tasks:
            report["part_2_exam_macro_scorecard"]["actionable_tasks"] = ai_tasks
    if "part_3_aggregated_user_report" in report:
        report["part_3_aggregated_user_report"]["ai_cognitive_insights"] = mentorship_insight
        if ai_tasks:
            report["part_3_aggregated_user_report"]["actionable_tasks"] = ai_tasks
    report["ai_cognitive_insights"] = mentorship_insight

    # Update per-question reports with final explanations (Phase 2 enrichment)
    existing_q_reps2 = await session.exec(select(ExamQuestionReport).where(ExamQuestionReport.attempt_id == attempt.id))
    q_rep_map2 = {r.question_id: r for r in existing_q_reps2.all()}
    for q_item in part_1_items:
        q_raw = q_item.get("question_id")
        q_uid = int(q_raw) if q_raw is not None else None
        existing_q_rep = q_rep_map2.get(q_uid)
        if existing_q_rep:
            existing_q_rep.explanation_json = q_item.get("explanation")
            session.add(existing_q_rep)

    report["part_3_aggregated_user_report"]["llm_insight"] = mentorship_insight
    report["part_3_aggregated_user_report"]["mentorship_insight"] = mentorship_insight
    if "part_2_exam_macro_scorecard" in report:
        report["part_2_exam_macro_scorecard"]["llm_insight"] = mentorship_insight
        report["part_2_exam_macro_scorecard"]["mentorship_insight"] = mentorship_insight

    attempt_rep_stmt = select(ExamAttemptReport).where(ExamAttemptReport.attempt_id == attempt.id)
    existing_att_rep = (await session.exec(attempt_rep_stmt)).first()
    if not existing_att_rep:
        session.add(ExamAttemptReport(
            attempt_id=attempt.id,
            user_id=user.id,
            exam_id=exam.id,
            matrices_summary_json=report["part_3_aggregated_user_report"],
            taxonomy_breakdown_json=report["part_2_taxonomy_analysis"],
            llm_insight_json=mentorship_insight,
            full_report_json=report,
            s3_report_url=None,
        ))
    else:
        existing_att_rep.matrices_summary_json = report["part_3_aggregated_user_report"]
        existing_att_rep.taxonomy_breakdown_json = report["part_2_taxonomy_analysis"]
        existing_att_rep.llm_insight_json = mentorship_insight
        existing_att_rep.full_report_json = report
        existing_att_rep.s3_report_url = None
        # The session keeps objects after commit, so these attributes still hold the very dicts Phase 1
        # saved; the AI insight was added to them in place. Re-assigning the same object is not seen as a
        # change, so without this the narrative is never written when a report is rebuilt.
        for json_field in ("matrices_summary_json", "taxonomy_breakdown_json", "llm_insight_json", "full_report_json"):
            flag_modified(existing_att_rep, json_field)
        session.add(existing_att_rep)

    # Persist User Progression Delta Report
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
        session.add(UserSkillProgressionReport(
            attempt_id=attempt.id,
            user_id=user.id,
            previous_metrics_json=profile_dict,
            updated_metrics_json=updated_profile_dict,
            deltas_json=deltas,
            taxonomy_promotions_json=report["part_2_taxonomy_analysis"],
            spaced_repetition_schedule_json={"evaluated_at": now_t.isoformat()},
        ))
    else:
        existing_user_prog.previous_metrics_json = profile_dict
        existing_user_prog.updated_metrics_json = updated_profile_dict
        existing_user_prog.deltas_json = deltas
        existing_user_prog.taxonomy_promotions_json = report["part_2_taxonomy_analysis"]
        existing_user_prog.spaced_repetition_schedule_json = {"evaluated_at": now_t.isoformat()}
        session.add(existing_user_prog)

    # Final status = EVALUATED with slim metadata (full report is in ExamAttemptReport)
    attempt.report_metadata_json = {
        "is_ready": True,
        "phase": "EVALUATED",
        "exam_name": traceable_exam_name,
        "scoring": {
            "net_score": _score_summary.get("total_score", 0.0),
            "max_score": _score_summary.get("max_score", 200.0),
            "accuracy_percentage": _score_summary.get("accuracy_percentage", 0.0),
            "correct_count": _score_summary.get("correct_count", 0),
            "incorrect_count": _score_summary.get("incorrect_count", 0),
            "unattempted_count": _score_summary.get("unattempted_count", 0),
        },
        "icrs_score": icrs_obj.get("icrs_score", 65.0),
        "irt_theta": irt_obj.get("latent_ability_theta", 0.0),
        "ai_ready": True,
        "unresolved_question_count": unresolved_question_count,
    }
    attempt.status = AttemptStatus.EVALUATED
    session.add(attempt)
    await session.commit()

    await invalidate_attempt_cache(attempt.id, user.id)

    t_end = datetime.now(timezone.utc)
    total_pipeline_ms = round((t_end - t_start).total_seconds() * 1000, 1)
    logger.info(f"✅ [PIPELINE_COMPLETE] Attempt '{attempt.id}' EVALUATED. Total Runtime: {total_pipeline_ms}ms")

    # Fire cumulative profile recomputation non-blocking (new session so it doesn't
    # share the committed state of the current session)
    async def _run_cumulative_update():
        try:
            from app.engine.cumulative_analytics_aggregator import CumulativeAnalyticsAggregator
            async with managed_async_session() as cum_sess:
                await CumulativeAnalyticsAggregator.compute_user_cumulative_report(
                    session=cum_sess,
                    user_id=user.id,
                    force_recompute=True,
                )
        except Exception as cum_err:
            logger.warning(f"Cumulative profile update warning: {cum_err}")

    asyncio.create_task(_run_cumulative_update())
    logger.info(f"Post-submission pipeline completed for attempt '{attempt_id}'. All sections persisted. Status = EVALUATED.")


def _generate_rule_based_insight(
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

