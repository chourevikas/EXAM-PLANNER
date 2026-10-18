import math
import uuid
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone
from sqlmodel import case, col, func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models import (
    User,
    Exam,
    ExamAttempt,
    ExamAttemptReport,
    UserSkillProfile,
    UserTaxonomyMastery,
    UserConceptRetention,
    Question,
    QuestionMetadata,
    ExamQuestionResponse,
    ExamQuestionReport,
    Subject,
    Topic,
    Subtopic,
    BloomsLevel,
    UserMemoryState,
)
from app.db.models.enums import AttemptStatus
from app.formatters.report_markdown_formatter import format_report_to_markdown
from app.engine.matrix_orchestrator import classify_strength, accuracy_retention_estimate
from app.engine.matrices.integrated_cognitive_readiness import IntegratedCognitiveReadinessEngine
from app.engine.matrices.guessing_tendency import GuessingTendencyStrategy
from app.engine.matrices.fsrs_retention import FSRSEngine
from app.engine.matrices.confidence_calibration import ConfidenceCalibrationStrategy
from app.config.logger import setup_logger
from app.services.scoring import UPSC_MARKS, UPSC_NEGATIVE

logger = setup_logger("CumulativeAnalyticsAggregator")

# Bump when the cumulative report's computation changes so stale caches are rebuilt
CUMULATIVE_REPORT_VERSION = 3


def _first_present(*values: Any, default: float) -> float:
    """First value that is not None (0.0 is a real score, not a missing one)."""
    for v in values:
        if v is not None:
            return float(v)
    return default


def _theta_percentile(theta: float) -> float:
    return round(0.5 * (1.0 + math.erf(theta / math.sqrt(2.0))) * 100.0, 1)


class CumulativeAnalyticsAggregator:
    """
    Synthesizes longitudinal, multi-exam psychometric reports across all evaluated
    test attempts for a candidate. Computes weighted 12-matrix aggregates, cross-exam
    evolution trajectories, and a unified taxonomy hierarchy.
    """

    @classmethod
    async def compute_user_cumulative_report(
        cls,
        session: AsyncSession,
        user_id: int | str,
        force_recompute: bool = False,
    ) -> Dict[str, Any]:
        if isinstance(user_id, str):
            try:
                user_id = int(user_id)
            except ValueError:
                raise ValueError(f"User with ID '{user_id}' not found.")
        user = await session.get(User, user_id)
        if not user:
            raise ValueError(f"User with ID '{user_id}' not found.")

        # Check existing cached profile if not forcing recompute
        prof_res = await session.exec(
            select(UserSkillProfile).where(UserSkillProfile.user_id == user_id)
        )
        profile = prof_res.first()
        if not force_recompute and profile and profile.aggregate_report_json:
            cached_rep = profile.aggregate_report_json
            if (cached_rep.get("metadata") or {}).get("report_version") == CUMULATIVE_REPORT_VERSION:
                return cached_rep

        # Fetch all evaluated exam attempts chronologically
        stmt = (
            select(ExamAttempt)
            .where(
                ExamAttempt.user_id == user_id,
                col(ExamAttempt.status).in_([AttemptStatus.EVALUATED, AttemptStatus.SUBMITTED]),
            )
            .order_by(col(ExamAttempt.created_at).asc())
        )
        attempts_res = await session.exec(stmt)
        attempts = attempts_res.all()

        now_iso = datetime.now(timezone.utc).isoformat()

        if not attempts:
            return cls._build_empty_cumulative_report(user, now_iso)

        # Batch load all exams and attempt reports in 2 queries (prevents 2N queries)
        exam_ids = list({att.exam_id for att in attempts if att.exam_id})
        exam_map: Dict[Any, Exam] = {}
        if exam_ids:
            exams_res = await session.exec(select(Exam).where(col(Exam.id).in_(exam_ids)))
            exam_map = {e.id: e for e in exams_res.all()}

        attempt_ids = [att.id for att in attempts]
        rep_db_map: Dict[Any, ExamAttemptReport] = {}
        if attempt_ids:
            rep_res = await session.exec(
                select(ExamAttemptReport).where(col(ExamAttemptReport.attempt_id).in_(attempt_ids))
            )
            rep_db_map = {r.attempt_id: r for r in rep_res.all()}

        # Marks gained and lost per attempt, from each answer's stored score (its paper's own scheme)
        marks_split: Dict[Any, Tuple[float, float]] = {}
        if attempt_ids:
            split_rows = await session.exec(
                select(
                    ExamQuestionResponse.attempt_id,
                    func.coalesce(func.sum(case((col(ExamQuestionResponse.final_score) > 0, ExamQuestionResponse.final_score), else_=0.0)), 0.0),
                    func.coalesce(func.sum(case((col(ExamQuestionResponse.final_score) < 0, -col(ExamQuestionResponse.final_score)), else_=0.0)), 0.0),
                )
                .where(col(ExamQuestionResponse.attempt_id).in_(attempt_ids))
                .group_by(ExamQuestionResponse.attempt_id)
            )
            marks_split = {a_id: (float(g or 0.0), float(l or 0.0)) for a_id, g, l in split_rows.all()}
        total_marks_gained = 0.0
        total_marks_lost = 0.0

        # 1. Process Timeline & Collect Attempt Reports
        exam_timeline: List[Dict[str, Any]] = []
        all_tax_subjects: Dict[str, Dict[str, Any]] = {}
        all_tax_topics: Dict[str, Dict[str, Any]] = {}
        all_tax_subtopics: Dict[str, Dict[str, Any]] = {}

        total_questions_attempted_sum = 0
        total_correct_sum = 0
        total_incorrect_sum = 0
        total_unattempted_sum = 0
        total_time_spent_sum = 0.0

        # Real per-attempt behavioural totals (summed from each attempt's exam-wise report)
        switch_totals = {"total": 0, "positive": 0, "negative": 0, "net_impact": 0.0}
        unattempted_totals = {"time_starved": 0, "hesitated_abandoned": 0, "strategic_skip": 0, "wasted_sec": 0.0}
        closeness_totals: Dict[str, int] = {}
        confidence_counts: Dict[str, Dict[str, float]] = {}
        total_q_time_sec = 0.0
        total_q_expected_sec = 0.0

        all_blooms_totals: Dict[str, Dict[str, int]] = {
            "REMEMBER": {"total": 0, "correct": 0},
            "UNDERSTAND": {"total": 0, "correct": 0},
            "APPLY": {"total": 0, "correct": 0},
            "ANALYZE": {"total": 0, "correct": 0},
            "EVALUATE": {"total": 0, "correct": 0},
            "CREATE": {"total": 0, "correct": 0},
        }

        for idx, att in enumerate(attempts, 1):
            exam = exam_map.get(att.exam_id)
            exam_name = exam.name if exam else f"Exam Attempt #{idx}"
            exam_code = exam.code if exam else f"EXAM-{idx}"

            # Attempt report metadata or DB report
            rep_db = rep_db_map.get(att.id)

            meta = att.report_metadata_json or (rep_db.full_report_json if rep_db else {}) or {}
            macro = meta.get("part_3_aggregated_user_report", {}) or meta.get("part_2_exam_macro_scorecard", {})

            score = float(att.total_score or 0.0)
            max_sc = float(att.max_possible_score or 200.0)
            corr = int(att.total_correct or 0)
            inc = int(att.total_incorrect or 0)
            unatt = int(att.total_unattempted or 0)
            tot_q = int(att.total_questions or (corr + inc + unatt) or 100)
            acc_pct = round((corr / max(1, (corr + inc))) * 100.0, 1) if (corr + inc) > 0 else 0.0
            t_spent = float(att.time_spent_seconds or 0.0)

            total_questions_attempted_sum += (corr + inc)
            total_correct_sum += corr
            total_incorrect_sum += inc
            # Attempts without stored answers (e.g. old synced sessions) fall back to UPSC marking
            att_gained, att_lost = marks_split.get(att.id) or (corr * UPSC_MARKS, inc * UPSC_NEGATIVE)
            total_marks_gained += att_gained
            total_marks_lost += att_lost
            total_unattempted_sum += unatt
            total_time_spent_sum += t_spent

            icrs = _first_present(att.icrs_score, macro.get("icrs", {}).get("icrs_score"), default=0.0)
            irt = _first_present(att.irt_theta, macro.get("irt_3pl", {}).get("latent_ability_theta"), default=0.0)
            gti = _first_present(att.gti_score, macro.get("gti", {}).get("aggregate"), default=0.0)
            oeei = _first_present(att.oeei_score, macro.get("oeei", {}).get("oeei_score"), default=0.0)
            satoi = _first_present(att.satoi_score, macro.get("satoi", {}).get("satoi_score"), default=0.0)

            sw = macro.get("switch_regret") or macro.get("second_guessing_discipline") or {}
            switch_totals["total"] += int(sw.get("total_switches", 0) or 0)
            switch_totals["positive"] += int(sw.get("positive_switches", 0) or 0)
            switch_totals["negative"] += int(sw.get("negative_regret_switches", 0) or 0)
            switch_totals["net_impact"] += float(sw.get("net_score_impact", 0.0) or 0.0)

            un = macro.get("unattempted_summary") or macro.get("unattempted_analysis") or {}
            unattempted_totals["time_starved"] += int(un.get("time_starved_count", 0) or 0)
            unattempted_totals["hesitated_abandoned"] += int(un.get("hesitated_abandoned_count", 0) or 0)
            unattempted_totals["strategic_skip"] += int(un.get("strategic_skip_count", 0) or 0)
            unattempted_totals["wasted_sec"] += float(un.get("wasted_time_on_abandoned_seconds", 0.0) or 0.0)

            conf = macro.get("confidence_calibration") or {}
            for lvl, lvl_stats in (conf.get("by_level") or {}).items():
                c_acc = confidence_counts.setdefault(lvl, {"answered": 0, "correct": 0, "net_marks": 0.0, "wrong_marks": 0.0})
                c_acc["answered"] += int(lvl_stats.get("answered", 0) or 0)
                c_acc["correct"] += int(lvl_stats.get("correct", 0) or 0)
                c_acc["net_marks"] += float(lvl_stats.get("net_marks", 0.0) or 0.0)
            if conf:
                sure_acc = confidence_counts.setdefault("SURE", {"answered": 0, "correct": 0, "net_marks": 0.0, "wrong_marks": 0.0})
                sure_acc["wrong_marks"] -= float(conf.get("sure_but_wrong_marks_lost", 0.0) or 0.0)

            for c_label, c_cnt in (macro.get("closeness_distribution") or macro.get("distractor_trap_distribution") or {}).items():
                c_label = c_label.replace("(Partial Knowledge)", "(Near-Correct)")
                closeness_totals[c_label] = closeness_totals.get(c_label, 0) + int(c_cnt or 0)

            att_mode_str = att.mode.value if hasattr(att.mode, "value") else str(att.mode)
            is_guest = bool(meta.get("is_guest_synced") or meta.get("guest_session_id"))

            if is_guest:
                exam_type_label = "GUEST_PRACTICE"
                mode_weight = 0.25
            elif att_mode_str == "PRACTICE":
                exam_type_label = "PRACTICE_TEST"
                mode_weight = 0.65
            elif att_mode_str == "REVISION":
                exam_type_label = "REVISION_TEST"
                mode_weight = 0.50
            else:
                exam_type_label = "FULL_MOCK"
                mode_weight = 1.00

            timeline_item = {
                "attempt_number": idx,
                "attempt_id": str(att.id),
                "exam_id": str(att.exam_id),
                "exam_name": exam_name,
                "exam_code": exam_code,
                "mode": att_mode_str,
                "exam_type_label": exam_type_label,
                "mode_weight": mode_weight,
                "date": (att.submitted_at or att.created_at).strftime("%Y-%m-%d"),
                "date_formatted": (att.submitted_at or att.created_at).strftime("%b %d, %Y"),
                "total_score": round(score, 2),
                "max_possible_score": round(max_sc, 2),
                "accuracy_percentage": acc_pct,
                "correct_count": corr,
                "incorrect_count": inc,
                "unattempted_count": unatt,
                "total_questions": tot_q,
                "time_taken_seconds": round(t_spent, 1),
                "icrs_score": round(icrs, 1),
                "irt_theta": round(irt, 2),
                "gti_score": round(gti, 4),
                "oeei_score": round(oeei, 2),
                "satoi_score": round(satoi, 1),
                "pacing_status": att.pacing_status or "BALANCED_PACING",
            }
            exam_timeline.append(timeline_item)

            # 1.1 Process questions directly from attempt per-question analysis or ExamQuestionReport
            q_list = meta.get("part_1_per_question_analysis") or meta.get("questions") or []
            if not q_list and rep_db and rep_db.full_report_json:
                q_list = rep_db.full_report_json.get("part_1_per_question_analysis") or []

            if not q_list:
                eqr_res = await session.exec(
                    select(ExamQuestionReport).where(ExamQuestionReport.attempt_id == att.id)
                )
                eqr_rows = eqr_res.all()
                eqr_q_ids = list({eqr.question_id for eqr in eqr_rows if eqr.question_id})
                q_model_map: Dict[Any, Question] = {}
                if eqr_q_ids:
                    _qm_res = await session.exec(select(Question).where(col(Question.id).in_(eqr_q_ids)))
                    q_model_map = {q.id: q for q in _qm_res.all()}

                for eqr in eqr_rows:
                    q_model = q_model_map.get(eqr.question_id) if eqr.question_id else None
                    q_subj = getattr(q_model, "subject", None) or getattr(q_model, "subject_name", None) or "General Studies"
                    q_top = getattr(q_model, "topic", None) or getattr(q_model, "topic_name", None) or "Core Concepts"
                    q_sub = getattr(q_model, "subtopic", None) or getattr(q_model, "subtopic_name", None) or "Foundations"
                    q_blm = (eqr.blooms_level or getattr(q_model, "blooms_level", None) or "ANALYZE").upper()
                    q_list.append({
                        "subject": q_subj,
                        "topic": q_top,
                        "subtopic": q_sub,
                        "is_correct": eqr.is_correct,
                        "final_score": eqr.final_score,
                        # Unattempted questions score exactly 0; attempted ones score their marks or minus the penalty
                        "is_attempted": bool(eqr.is_correct or (eqr.final_score or 0.0) != 0.0),
                        "time_taken_seconds": eqr.time_taken_seconds,
                        "expected_time_seconds": eqr.expected_time_seconds,
                        "blooms_level": q_blm,
                    })

            for q in q_list:
                s_name = q.get("subject") or q.get("subject_name") or "General Studies"
                t_name = q.get("topic") or q.get("topic_name") or "Core Concepts"
                sub_name = q.get("subtopic") or q.get("subtopic_name") or "Foundations"
                is_c = bool(q.get("is_correct") or (q.get("score_awarded", 0) > 0))
                if "is_attempted" in q:
                    is_att = bool(q["is_attempted"]) or is_c
                elif "selected_option_id" in q:
                    is_att = q.get("selected_option_id") is not None or is_c
                else:
                    is_att = True
                b_level = (q.get("blooms_level") or q.get("bloom_level") or "ANALYZE").upper()

                if s_name not in all_tax_subjects:
                    all_tax_subjects[s_name] = {
                        "name": s_name,
                        "taxonomy_name": s_name,
                        "total_questions": 0,
                        "attempted": 0,
                        "correct": 0,
                        "incorrect": 0,
                        "topics": {},
                    }
                t_map_ref = all_tax_subjects[s_name]["topics"]
                if t_name not in t_map_ref:
                    t_map_ref[t_name] = {
                        "name": t_name,
                        "taxonomy_name": t_name,
                        "subject": s_name,
                        "total_questions": 0,
                        "attempted": 0,
                        "correct": 0,
                        "incorrect": 0,
                        "subtopics": {},
                    }
                t_obj = t_map_ref[t_name]
                if sub_name not in t_obj["subtopics"]:
                    t_obj["subtopics"][sub_name] = {
                        "name": sub_name,
                        "subject": s_name,
                        "topic": t_name,
                        "total_questions": 0,
                        "attempted": 0,
                        "correct": 0,
                        "incorrect": 0,
                    }
                if t_name not in all_tax_topics:
                    all_tax_topics[t_name] = {
                        "name": t_name,
                        "taxonomy_name": t_name,
                        "subject": s_name,
                        "total_questions": 0,
                        "attempted": 0,
                        "correct": 0,
                        "incorrect": 0,
                    }
                if sub_name not in all_tax_subtopics:
                    all_tax_subtopics[sub_name] = {
                        "name": sub_name,
                        "subject": s_name,
                        "topic": t_name,
                        "total_questions": 0,
                        "attempted": 0,
                        "correct": 0,
                        "incorrect": 0,
                    }

                # Marks this answer got under its paper's scheme; UPSC +2 / -2/3 for old reports without it
                q_awarded = q.get("marks_awarded", q.get("final_score"))
                gained = lost = 0.0
                if is_att:
                    if is_c:
                        gained = float(q_awarded) if q_awarded is not None and float(q_awarded) > 0 else UPSC_MARKS
                    else:
                        lost = -float(q_awarded) if q_awarded is not None and float(q_awarded) <= 0 else UPSC_NEGATIVE
                for bucket in (
                    all_tax_subjects[s_name],
                    t_obj,
                    t_obj["subtopics"][sub_name],
                    all_tax_topics[t_name],
                    all_tax_subtopics[sub_name],
                ):
                    bucket["total_questions"] += 1
                    if is_att:
                        bucket["attempted"] += 1
                        if is_c:
                            bucket["correct"] += 1
                        else:
                            bucket["incorrect"] += 1
                        bucket["marks_gained"] = bucket.get("marks_gained", 0.0) + gained
                        bucket["marks_lost"] = bucket.get("marks_lost", 0.0) + lost

                if is_att:
                    total_q_time_sec += float(q.get("time_taken_seconds") or 0.0)
                    total_q_expected_sec += float(q.get("expected_time_seconds") or 0.0)
                    match_b = next((k for k in all_blooms_totals if k in b_level), "ANALYZE")
                    all_blooms_totals[match_b]["total"] += 1
                    if is_c:
                        all_blooms_totals[match_b]["correct"] += 1

            # Also incorporate summary taxonomy from part 2 if present
            tax_part = meta.get("part_2_taxonomy_analysis", {})
            for subj in (tax_part.get("subject_breakdown", []) or tax_part.get("by_subject", [])):
                s_name = subj.get("subject_name") or subj.get("name") or subj.get("taxonomy_name")
                if s_name and s_name not in all_tax_subjects:
                    all_tax_subjects[s_name] = {
                        "name": s_name,
                        "taxonomy_name": s_name,
                        "total_questions": int(subj.get("total_questions", 0) or subj.get("total", 0)),
                        "attempted": int(subj.get("attempted", 0) or subj.get("attempted_questions", 0)),
                        "correct": int(subj.get("correct", 0)),
                        "incorrect": int(subj.get("incorrect", 0)),
                        "topics": {},
                    }

        # Direct DB aggregation from all recorded ExamQuestionResponse rows if all_blooms_totals is still empty
        if sum(b["total"] for b in all_blooms_totals.values()) == 0:
            db_resp_stmt = (
                select(ExamQuestionResponse.is_correct, QuestionMetadata.blooms_level, ExamQuestionReport.blooms_level)
                .join(ExamAttempt, col(ExamQuestionResponse.attempt_id) == col(ExamAttempt.id))
                .outerjoin(QuestionMetadata, col(ExamQuestionResponse.question_id) == col(QuestionMetadata.question_id))
                .outerjoin(
                    ExamQuestionReport,
                    (col(ExamQuestionResponse.attempt_id) == col(ExamQuestionReport.attempt_id))
                    & (col(ExamQuestionResponse.question_id) == col(ExamQuestionReport.question_id)),
                )
                .where(col(ExamAttempt.user_id) == user_id)
                .where(col(ExamQuestionResponse.selected_option_id).is_not(None))
            )
            db_resps = (await session.exec(db_resp_stmt)).all()
            for is_c, qm_blm, eqr_blm in db_resps:
                raw_b = str(qm_blm.value if (qm_blm and hasattr(qm_blm, "value")) else qm_blm or eqr_blm or "ANALYZE").upper()
                match_b = next((k for k in all_blooms_totals if k in raw_b), "ANALYZE")
                all_blooms_totals[match_b]["total"] += 1
                if is_c:
                    all_blooms_totals[match_b]["correct"] += 1

        # Query UserTaxonomyMastery for all subjects, topics, subtopics, and bloom metrics
        db_tax_res = await session.exec(
            select(UserTaxonomyMastery).where(UserTaxonomyMastery.user_id == user_id)
        )
        db_tax_list = db_tax_res.all()

        has_blooms_already = sum(b["total"] for b in all_blooms_totals.values()) > 0

        for tax_item in db_tax_list:
            t_type = (tax_item.taxonomy_type or "").upper()
            if t_type == "BLOOMS" and not has_blooms_already:
                b_code = (tax_item.taxonomy_id_code or tax_item.taxonomy_name or "").upper()
                match_b = next((k for k in all_blooms_totals if k in b_code), None)
                if match_b:
                    all_blooms_totals[match_b]["total"] += int(tax_item.total_attempts or 0)
                    all_blooms_totals[match_b]["correct"] += int(tax_item.correct_attempts or 0)
            elif t_type == "SUBJECT":
                s_name = tax_item.taxonomy_name or tax_item.taxonomy_id_code
                if s_name not in all_tax_subjects:
                    all_tax_subjects[s_name] = {
                        "name": s_name,
                        "taxonomy_name": s_name,
                        "total_questions": tax_item.total_attempts,
                        "attempted": tax_item.total_attempts,
                        "correct": tax_item.correct_attempts,
                        "incorrect": max(0, tax_item.total_attempts - tax_item.correct_attempts),
                        "topics": {},
                    }
            elif t_type == "TOPIC":
                t_name = tax_item.taxonomy_name or tax_item.taxonomy_id_code
                if t_name not in all_tax_topics:
                    all_tax_topics[t_name] = {
                        "name": t_name,
                        "taxonomy_name": t_name,
                        "subject": "General Studies",
                        "total_questions": tax_item.total_attempts,
                        "attempted": tax_item.total_attempts,
                        "correct": tax_item.correct_attempts,
                        "incorrect": max(0, tax_item.total_attempts - tax_item.correct_attempts),
                    }

        # Persist / Sync real Bloom statistics into UserTaxonomyMastery in DB
        tax_blooms_map = {
            t.taxonomy_id_code.upper(): t
            for t in db_tax_list
            if (t.taxonomy_type or "").upper() == "BLOOMS" and t.taxonomy_id_code
        }
        for b_name, b_counts in all_blooms_totals.items():
            tot = b_counts["total"]
            corr = b_counts["correct"]
            b_acc = round((corr / max(1, tot)) * 100.0, 1) if tot > 0 else 0.0
            st_status = "STRONG" if b_acc >= 75.0 else ("MODERATE" if b_acc >= 50.0 else "WEAK_REVISION_REQUIRED")

            tax_m = tax_blooms_map.get(b_name.upper())
            if not tax_m:
                tax_m = UserTaxonomyMastery(
                    user_id=user_id,
                    taxonomy_type="BLOOMS",
                    taxonomy_id_code=b_name,
                    taxonomy_name=f"Bloom's {b_name.capitalize()} Thinking",
                    total_attempts=tot,
                    correct_attempts=corr,
                    mastery_percentage=b_acc,
                    strength_status=st_status,
                    updated_at=datetime.now(timezone.utc),
                )
                tax_blooms_map[b_name.upper()] = tax_m
            else:
                tax_m.taxonomy_name = f"Bloom's {b_name.capitalize()} Thinking"
                tax_m.total_attempts = tot
                tax_m.correct_attempts = corr
                tax_m.mastery_percentage = b_acc
                tax_m.strength_status = st_status
                tax_m.updated_at = datetime.now(timezone.utc)
            session.add(tax_m)

        n_att = max(1, len(exam_timeline))
        # Finalize Subject, Topic, Subtopic calculations
        for s_name, s_data in all_tax_subjects.items():
            att_cnt = s_data["attempted"]
            corr_cnt = s_data["correct"]
            inc_cnt = s_data.get("incorrect", max(0, att_cnt - corr_cnt))
            s_acc = round((corr_cnt / max(1, att_cnt)) * 100.0, 1) if att_cnt > 0 else 0.0
            pos_marks = round(s_data.get("marks_gained", corr_cnt * UPSC_MARKS), 2)
            neg_marks = round(s_data.get("marks_lost", inc_cnt * UPSC_NEGATIVE), 2)
            net_marks = round(pos_marks - neg_marks, 2)
            mean_score = round(net_marks / n_att, 2)

            s_data["accuracy_percentage"] = s_acc
            s_data["positive_marks"] = pos_marks
            s_data["negative_marks"] = neg_marks
            s_data["net_marks"] = net_marks
            s_data["mean_score"] = mean_score
            s_data["mean_score_per_exam"] = mean_score
            s_data["retention_percentage"] = accuracy_retention_estimate(s_acc)
            s_data["status"], s_data["status_label"] = classify_strength(s_acc)
            s_data["strength_status"] = s_data["status"]

            # Finalize nested topics
            t_map = s_data.get("topics", {})
            if isinstance(t_map, dict):
                for t_name, t_obj in t_map.items():
                    t_att = t_obj["attempted"]
                    t_corr = t_obj["correct"]
                    t_inc = t_obj.get("incorrect", max(0, t_att - t_corr))
                    t_acc = round((t_corr / max(1, t_att)) * 100.0, 1) if t_att > 0 else 0.0
                    t_pos = round(t_obj.get("marks_gained", t_corr * UPSC_MARKS), 2)
                    t_neg = round(t_obj.get("marks_lost", t_inc * UPSC_NEGATIVE), 2)
                    t_net = round(t_pos - t_neg, 2)
                    t_mean = round(t_net / n_att, 2)

                    t_obj["accuracy_percentage"] = t_acc
                    t_obj["positive_marks"] = t_pos
                    t_obj["negative_marks"] = t_neg
                    t_obj["net_marks"] = t_net
                    t_obj["mean_score"] = t_mean
                    t_obj["retention_percentage"] = accuracy_retention_estimate(t_acc)
                    t_obj["status"], t_obj["status_label"] = classify_strength(t_acc)
                    t_obj["strength_status"] = t_obj["status"]

                    sub_map = t_obj.get("subtopics", {})
                    if isinstance(sub_map, dict):
                        for sub_name, sub_obj in sub_map.items():
                            sub_att = sub_obj["attempted"]
                            sub_corr = sub_obj["correct"]
                            sub_inc = sub_obj.get("incorrect", max(0, sub_att - sub_corr))
                            sub_acc = round((sub_corr / max(1, sub_att)) * 100.0, 1) if sub_att > 0 else 0.0
                            sub_pos = round(sub_obj.get("marks_gained", sub_corr * UPSC_MARKS), 2)
                            sub_neg = round(sub_obj.get("marks_lost", sub_inc * UPSC_NEGATIVE), 2)
                            sub_net = round(sub_pos - sub_neg, 2)
                            sub_obj["accuracy_percentage"] = sub_acc
                            sub_obj["positive_marks"] = sub_pos
                            sub_obj["negative_marks"] = sub_neg
                            sub_obj["net_marks"] = sub_net
                            sub_obj["mean_score"] = round(sub_net / n_att, 2)
                            sub_obj["status"], sub_obj["status_label"] = classify_strength(sub_acc)
                            sub_obj["strength_status"] = sub_obj["status"]

                s_data["topics_list"] = list(t_map.values())

        for t_name, t_data in all_tax_topics.items():
            att_cnt = t_data["attempted"]
            corr_cnt = t_data["correct"]
            inc_cnt = t_data.get("incorrect", max(0, att_cnt - corr_cnt))
            t_acc = round((corr_cnt / max(1, att_cnt)) * 100.0, 1) if att_cnt > 0 else 0.0
            pos_marks = round(t_data.get("marks_gained", corr_cnt * UPSC_MARKS), 2)
            neg_marks = round(t_data.get("marks_lost", inc_cnt * UPSC_NEGATIVE), 2)
            net_marks = round(pos_marks - neg_marks, 2)
            mean_score = round(net_marks / n_att, 2)

            t_data["accuracy_percentage"] = t_acc
            t_data["positive_marks"] = pos_marks
            t_data["negative_marks"] = neg_marks
            t_data["net_marks"] = net_marks
            t_data["mean_score"] = mean_score
            t_data["retention_percentage"] = accuracy_retention_estimate(t_acc)
            t_data["status"], t_data["status_label"] = classify_strength(t_acc)
            t_data["strength_status"] = t_data["status"]

        # 2. Helper to compute weighted aggregates for any subset of attempts
        def _compute_subset_aggregate(items: List[Dict[str, Any]]) -> Dict[str, Any]:
            if not items:
                return {
                    "count": 0,
                    "icrs_score": 0.0,
                    "irt_theta": 0.0,
                    "gti_score": 0.0,
                    "oeei_score": 0.0,
                    "satoi_score": 0.0,
                    "accuracy_percentage": 0.0,
                    "total_questions_attempted": 0,
                    "total_score": 0.0,
                }
            m_weights = [item.get("mode_weight", 1.0) * (1.0 + 0.12 * i) for i, item in enumerate(items)]
            sum_mw = sum(m_weights) or 1.0
            
            tot_att_q = sum(item["correct_count"] + item["incorrect_count"] for item in items)
            tot_corr_q = sum(item["correct_count"] for item in items)
            sub_acc = round((tot_corr_q / max(1, tot_att_q)) * 100.0, 1) if tot_att_q > 0 else 0.0

            return {
                "count": len(items),
                "icrs_score": round(sum(item["icrs_score"] * w for item, w in zip(items, m_weights)) / sum_mw, 1),
                "irt_theta": round(sum(item["irt_theta"] * w for item, w in zip(items, m_weights)) / sum_mw, 2),
                "gti_score": round(sum(item["gti_score"] * w for item, w in zip(items, m_weights)) / sum_mw, 4),
                "oeei_score": round(sum(item["oeei_score"] * w for item, w in zip(items, m_weights)) / sum_mw, 2),
                "satoi_score": round(sum(item["satoi_score"] * w for item, w in zip(items, m_weights)) / sum_mw, 1),
                "accuracy_percentage": sub_acc,
                "total_questions_attempted": tot_att_q,
                "total_score": round(sum(item["total_score"] for item in items), 2),
                "total_max_score": round(sum(item["max_possible_score"] for item in items), 2),
            }

        # 3. Segregated Aggregates by Modality
        full_mocks_items = [i for i in exam_timeline if i.get("exam_type_label") == "FULL_MOCK"]
        practice_items = [i for i in exam_timeline if i.get("exam_type_label") == "PRACTICE_TEST"]
        guest_items = [i for i in exam_timeline if i.get("exam_type_label") == "GUEST_PRACTICE"]

        segregated_aggregates = {
            "all_exams": _compute_subset_aggregate(exam_timeline),
            "full_mock_exams": _compute_subset_aggregate(full_mocks_items),
            "practice_tests": _compute_subset_aggregate(practice_items),
            "guest_trials": _compute_subset_aggregate(guest_items),
            "modality_weights": {
                "FULL_MOCK": 1.00,
                "PRACTICE_TEST": 0.65,
                "REVISION_TEST": 0.50,
                "GUEST_PRACTICE": 0.25,
            }
        }

        global_agg = segregated_aggregates["all_exams"]
        w_icrs = global_agg["icrs_score"]
        w_irt = global_agg["irt_theta"]
        w_gti = global_agg["gti_score"]
        w_oeei = global_agg["oeei_score"]
        w_satoi = global_agg["satoi_score"]
        cum_accuracy = global_agg["accuracy_percentage"]
        n_att = len(exam_timeline)

        # Dynamic Bloom calculation with exact counts
        blooms_computed: Dict[str, float] = {}
        for b_name, b_data in all_blooms_totals.items():
            if b_data["total"] > 0:
                blooms_computed[b_name] = round((b_data["correct"] / b_data["total"]) * 100.0, 1)
            else:
                blooms_computed[b_name] = 0.0

        blooms_mastery_payload = {
            "REMEMBER": blooms_computed["REMEMBER"],
            "UNDERSTAND": blooms_computed["UNDERSTAND"],
            "APPLY": blooms_computed["APPLY"],
            "ANALYZE": blooms_computed["ANALYZE"],
            "EVALUATE": blooms_computed["EVALUATE"],
            "CREATE": blooms_computed["CREATE"],
            "remember_total": all_blooms_totals["REMEMBER"]["total"],
            "remember_correct": all_blooms_totals["REMEMBER"]["correct"],
            "understand_total": all_blooms_totals["UNDERSTAND"]["total"],
            "understand_correct": all_blooms_totals["UNDERSTAND"]["correct"],
            "apply_total": all_blooms_totals["APPLY"]["total"],
            "apply_correct": all_blooms_totals["APPLY"]["correct"],
            "analyze_total": all_blooms_totals["ANALYZE"]["total"],
            "analyze_correct": all_blooms_totals["ANALYZE"]["correct"],
            "evaluate_total": all_blooms_totals["EVALUATE"]["total"],
            "evaluate_correct": all_blooms_totals["EVALUATE"]["correct"],
            "create_total": all_blooms_totals["CREATE"]["total"],
            "create_correct": all_blooms_totals["CREATE"]["correct"],
            "breakdown": {
                b_k: {
                    "accuracy": blooms_computed[b_k],
                    "total": all_blooms_totals[b_k]["total"],
                    "correct": all_blooms_totals[b_k]["correct"],
                }
                for b_k in all_blooms_totals
            },
            "fact_recall_accuracy": blooms_computed["REMEMBER"],
            "conceptual_analysis_accuracy": blooms_computed["ANALYZE"],
            "critical_evaluation_accuracy": blooms_computed["EVALUATE"],
        }

        # 3. Evolution Progression Curves & Graph Series
        evolution_graphs = {
            "labels": [f"Exam {i['attempt_number']}: {i['exam_name'][:18]}" for i in exam_timeline],
            "dates": [i["date_formatted"] for i in exam_timeline],
            "scores": [i["total_score"] for i in exam_timeline],
            "max_scores": [i["max_possible_score"] for i in exam_timeline],
            "accuracies": [i["accuracy_percentage"] for i in exam_timeline],
            "icrs_scores": [i["icrs_score"] for i in exam_timeline],
            "irt_thetas": [i["irt_theta"] for i in exam_timeline],
            "gti_percentages": [round(i["gti_score"] * 100.0, 1) for i in exam_timeline],
            "oeei_percentages": [round(i["oeei_score"] * 100.0, 1) for i in exam_timeline],
            "satoi_scores": [i["satoi_score"] for i in exam_timeline],
        }

        # 4. Formulate Full 12-Matrix Aggregation Schema & AI Synthesis (every value below is measured, none assumed)
        from app.engine.report_ai_synthesizer import ReportAISynthesizer

        icrs_tier, icrs_label, icrs_interp = IntegratedCognitiveReadinessEngine.classify_tier(w_icrs)
        gti_interp = GuessingTendencyStrategy.interpret_gti(w_gti)
        oeei_rating = (
            "ELITE_TACTICAL_PRECISION" if w_oeei >= 0.85
            else "HIGH_TACTICAL_PRECISION" if w_oeei >= 0.70
            else "MODERATE_ELIMINATION_DISCIPLINE" if w_oeei >= 0.50
            else "VULNERABLE_TO_STATEMENT_TRAPS" if w_oeei >= 0.30
            else "CRITICAL_DISTRACTOR_SUSCEPTIBILITY"
        )
        satoi_label = (
            "Peak Focus & Endurance" if w_satoi >= 85
            else "Consistent Cognitive Stamina" if w_satoi >= 70
            else "Mild Late-Session Fatigue" if w_satoi >= 50
            else "Significant Fatigue Decay"
        )
        percentile = _theta_percentile(w_irt)
        ability_label = (
            "Top Performer" if w_irt > 1.5
            else "Above Average" if w_irt > 0.5
            else "Foundation Needed" if w_irt < -1.0
            else "Competent"
        )
        avg_sec_per_q = round(total_time_spent_sum / max(1, total_questions_attempted_sum), 1) if total_questions_attempted_sum > 0 else 0.0
        latest_pacing = exam_timeline[-1]["pacing_status"] if exam_timeline else "OPTIMAL_SUSTAINED_PACING"
        regret_ratio = round(switch_totals["negative"] / switch_totals["total"], 2) if switch_totals["total"] else 0.0
        total_closeness_q = sum(closeness_totals.values())
        near_miss_cnt = closeness_totals.get("High-Closeness Distractor (Near-Correct)", 0) + closeness_totals.get("Moderate Distractor (Plausible Alternative)", 0)
        trap_cnt = (
            closeness_totals.get("Misleading Distractor (Cognitive Trap)", 0)
            + closeness_totals.get("Inverse Distractor (Inverted Logic)", 0)
            + closeness_totals.get("Contradictory Distractor (Direct Opposing Fact)", 0)
        )
        trap_avoidance_pct = round((1.0 - trap_cnt / total_closeness_q) * 100.0, 1) if total_closeness_q else 0.0
        time_eff_ratio = round(total_q_time_sec / total_q_expected_sec, 2) if total_q_expected_sec > 0 else 0.0
        confidence_eval = ConfidenceCalibrationStrategy.summarize_counts(confidence_counts, total_questions_attempted_sum)

        # Real FSRS memory state across the user's reviewed subtopics
        mem_rows = (await session.exec(select(UserMemoryState).where(UserMemoryState.user_id == user_id))).all()
        mem_retr: List[float] = []
        mem_stab: List[float] = []
        now_dt_mem = datetime.now(timezone.utc)
        for m in mem_rows:
            last_rev = m.last_reviewed_at if m.last_reviewed_at.tzinfo else m.last_reviewed_at.replace(tzinfo=timezone.utc)
            elapsed_days = max(0.0, (now_dt_mem - last_rev).total_seconds() / 86400.0)
            mem_retr.append(FSRSEngine.calculate_retrievability(elapsed_days, m.fsrs_stability) * 100.0)
            mem_stab.append(m.fsrs_stability)
        avg_retrievability = round(sum(mem_retr) / len(mem_retr), 1) if mem_retr else None
        avg_stability = round(sum(mem_stab) / len(mem_stab), 1) if mem_stab else None
        due_revisions = sum(1 for r_val in mem_retr if r_val < 70.0)

        precalc_payload = {
            "scoring": {
                "net_score": round(sum(i["total_score"] for i in exam_timeline), 2),
                "max_score": round(sum(i["max_possible_score"] for i in exam_timeline), 2),
                "qualifying_cutoff": 92.0,
                "accuracy_percentage": cum_accuracy,
                "attempted_count": total_questions_attempted_sum,
                "correct_count": total_correct_sum,
                "incorrect_count": total_incorrect_sum,
                "unattempted_count": total_unattempted_sum,
                "gross_positive_marks": round(total_marks_gained, 2),
                "negative_marks_lost": round(total_marks_lost, 2),
            },
            "psychometrics": {
                "icrs_score": w_icrs,
                "readiness_tier": icrs_tier,
                "irt_latent_theta": w_irt,
                "percentile_rank": percentile,
                "gti_aggregate": w_gti,
                "gti_category": gti_interp["category"],
                "oeei_score_pct": round(w_oeei * 100.0, 1),
                "satoi_score": w_satoi,
                "pacing_status": latest_pacing,
                "avg_seconds_per_question": avg_sec_per_q,
                "switch_regret_index": regret_ratio,
                "negative_switches_count": switch_totals["negative"],
                "positive_switches_count": switch_totals["positive"],
                "confidence_calibration": confidence_eval["calibration_status"],
                "sure_but_wrong_count": confidence_eval["sure_but_wrong_count"],
                "guess_net_marks": confidence_eval["guess_net_marks"],
            },
            "unattempted_analysis": {
                "total_unattempted": total_unattempted_sum,
                "time_starved": unattempted_totals["time_starved"],
                "hesitated_abandoned": unattempted_totals["hesitated_abandoned"],
                "strategic_skip": unattempted_totals["strategic_skip"],
                "wasted_time_on_abandoned_sec": round(unattempted_totals["wasted_sec"], 1),
            },
            "distractor_vulnerability": {
                "near_miss_wrong_answers": near_miss_cnt,
                "trap_wrong_answers": trap_cnt,
            },
            "blooms_mastery": blooms_mastery_payload,
            "weak_taxonomy_areas": [
                {
                    "subject": t.get("subject", "General Studies"),
                    "topic": t.get("taxonomy_name", "Core Concepts"),
                    "subtopic": t.get("subtopic"),
                    "accuracy": t.get("accuracy_percentage", 0.0),
                }
                for t in all_tax_topics.values()
                if t.get("attempted", 0) > 0 and t.get("accuracy_percentage", 0) < 50
            ][:5],
            "strong_taxonomy_areas": [
                {
                    "subject": t.get("subject", "General Studies"),
                    "topic": t.get("taxonomy_name", "Core Concepts"),
                    "accuracy": t.get("accuracy_percentage", 0.0),
                }
                for t in all_tax_topics.values() if t.get("strength_status") in ("STRONG", "EXCEPTIONAL_MASTERY")
            ][:3],
        }

        candidate_dict = {"user_id": str(user.id), "full_name": user.full_name, "email": user.email}
        exam_dict = {"attempt_id": "CUMULATIVE_ALL", "exam_id": "ALL_EXAMS", "exam_name": f"All {n_att} Completed Exams", "exam_code": "CUMULATIVE", "mode": "FULL_MOCK"}

        # Free plan: no AI analysis, so no LLM call for the all-exams summary either
        from app.services.free_plan import is_limited
        if await is_limited(session, user):
            cum_insight = ReportAISynthesizer.rule_based_insight(
                candidate_info=candidate_dict,
                exam_info=exam_dict,
                precalculated_metrics=precalc_payload,
            )
        else:
            cum_insight = await ReportAISynthesizer.generate_diagnostic_insight(
                candidate_info=candidate_dict,
                exam_info=exam_dict,
                precalculated_metrics=precalc_payload,
            )

        part_2_exam_macro_scorecard = {
            "score_summary": {
                "total_score": round(sum(i["total_score"] for i in exam_timeline), 2),
                "max_score": round(sum(i["max_possible_score"] for i in exam_timeline), 2),
                "accuracy_percentage": cum_accuracy,
                "attempted_count": total_questions_attempted_sum,
                "correct_count": total_correct_sum,
                "incorrect_count": total_incorrect_sum,
                "unattempted_count": total_unattempted_sum,
                "total_count": total_questions_attempted_sum + total_unattempted_sum,
            },
            "upsc_prelims_benchmark": {
                "expected_cutoff_marks": 92.0,
                "cutoff_margin": round((sum(i["total_score"] for i in exam_timeline)/max(1, n_att)) - 92.0, 2),
                "positive_marks_earned": round(total_marks_gained, 2),
                "negative_marks_lost": round(total_marks_lost, 2),
            },
            "icrs": {"icrs_score": w_icrs, "readiness_tier": icrs_tier, "readiness_label": icrs_label, "interpretation": icrs_interp},
            "irt_3pl": {"latent_ability_theta": w_irt, "percentile_rank": percentile, "ability_label": ability_label},
            "gti": {"aggregate": w_gti, "category": gti_interp["category"], "label": gti_interp["label"], "recommendation": gti_interp["recommendation"]},
            "oeei": {"oeei_score": w_oeei, "oeei_score_pct": round(w_oeei * 100.0, 1), "elimination_rating": oeei_rating},
            "satoi": {"satoi_score": w_satoi, "stamina_label": satoi_label},
            "pacing": {"pacing_status": latest_pacing, "avg_time_per_question_sec": avg_sec_per_q},
            "switch_regret": {
                "total_switches": switch_totals["total"],
                "positive_switches": switch_totals["positive"],
                "negative_regret_switches": switch_totals["negative"],
                "regret_index": regret_ratio,
                "net_score_impact": round(switch_totals["net_impact"], 2),
            },
            "blooms": blooms_mastery_payload,
            "confidence_calibration": confidence_eval,
            "distractor": {"near_miss_count": near_miss_cnt, "trap_count": trap_cnt, "trap_avoidance_rate_pct": trap_avoidance_pct},
            "topic_decay": {"active_memory_topics_count": len(mem_rows), "avg_concept_stability_days": avg_stability, "due_revisions": due_revisions},
            "ai_cognitive_insights": cum_insight,
            "actionable_tasks": cum_insight.get("study_plan_tasks", []),
            "subject_cumulative_mean_scoreboard": list(all_tax_subjects.values()),
            "subjects": list(all_tax_subjects.values()),
        }

        matrices_summary = {
            "1_integrated_cognitive_readiness": {
                "name": "Integrated Cognitive Readiness Score (ICRS)",
                "value": {"icrs_score": w_icrs, "readiness_tier": icrs_tier, "interpretation": icrs_interp},
            },
            "2_fsrs_memory_retention": {
                "name": "FSRS Memory Retention & Stability",
                "value": {
                    "average_retrievability_pct": avg_retrievability,
                    "average_stability_days": avg_stability,
                    "tracked_subtopics": len(mem_rows),
                },
            },
            "3_irt_3pl_ability": {
                "name": "Item Response Theory (IRT 3PL) Latent Ability",
                "value": {"latent_ability_theta": w_irt, "percentile_rank": percentile, "ability_label": ability_label},
            },
            "4_macro_pacing_efficiency": {
                "name": "Macro Exam Pacing & Section Allocation",
                "value": {
                    "pacing_status": latest_pacing,
                    "avg_seconds_per_question": avg_sec_per_q,
                    "total_exam_time_minutes": round(total_time_spent_sum / 60.0, 1),
                },
            },
            "5_option_elimination_efficiency": {
                "name": "Option Elimination Efficiency Index (OEEI)",
                "value": {"oeei_score": w_oeei, "conversion_rate_percentage": round(w_oeei * 100.0, 1), "elimination_rating": oeei_rating},
            },
            "6_guessing_tendency_index": {
                "name": "Guessing Tendency Index (GTI)",
                "value": {"aggregate": w_gti, "risk_classification": gti_interp["category"]},
            },
            "7_speed_accuracy_tradeoff": {
                "name": "Speed-Accuracy Tradeoff Optimization Index (SATOI)",
                "value": {"satoi_score": w_satoi, "stamina_label": satoi_label},
            },
            "8_blooms_cognitive_mastery": {
                "name": "Bloom's Cognitive Taxonomy Breakdown",
                "value": blooms_mastery_payload["breakdown"],
            },
            "9_option_switch_regret": {
                "name": "Option Switch Regret & Second-Guessing Index",
                "value": {
                    "total_switches_across_exams": switch_totals["total"],
                    "positive_switches": switch_totals["positive"],
                    "negative_regret_switches": switch_totals["negative"],
                    "regret_index": regret_ratio,
                },
            },
            "10_question_closeness_distribution": {
                "name": "Closeness & Conceptual Distractor Alignment",
                "value": {"distribution": closeness_totals, "trap_avoidance_rate_pct": trap_avoidance_pct},
            },
            "11_time_tiered_scoring": {
                "name": "Time-Tiered Scoring Efficiency",
                "value": {"time_efficiency_ratio": time_eff_ratio},
            },
            "12_topic_decay_projections": {
                "name": "Topic FSRS Memory Decay & Revision Radar",
                "value": {"tracked_subtopics": len(mem_rows), "upcoming_revisions_due": due_revisions},
            },
        }

        # 5. Compile Comprehensive Aggregate Document
        full_aggregate_report = {
            "metadata": {
                "report_title": f"Cumulative Longitudinal Performance Profile ({user.full_name})",
                "report_type": "CUMULATIVE_MULTI_EXAM_AGGREGATE",
                "report_version": CUMULATIVE_REPORT_VERSION,
                "total_exams_evaluated": n_att,
                "total_questions_attempted": total_questions_attempted_sum,
                "total_correct": total_correct_sum,
                "total_incorrect": total_incorrect_sum,
                "total_unattempted": total_unattempted_sum,
                "cumulative_accuracy_percentage": cum_accuracy,
                "generated_at": now_iso,
                "candidate": {
                    "user_id": str(user.id),
                    "full_name": user.full_name,
                    "email": user.email,
                },
                "exam_attempt": {
                    "exam_name": f"All {n_att} Completed Exams (Cumulative Master Overview)",
                    "canonical_code": "ALL-EXAMS-CUMULATIVE",
                    "total_score": round(sum(i["total_score"] for i in exam_timeline), 2),
                    "max_possible_score": round(sum(i["max_possible_score"] for i in exam_timeline), 2),
                    "time_spent_seconds": total_time_spent_sum,
                    "attempt_date": f"Across {n_att} sessions ({exam_timeline[0]['date']} to {exam_timeline[-1]['date']})",
                },
            },
            "is_cumulative": True,
            "exam_timeline": exam_timeline,
            "segregated_aggregates": segregated_aggregates,
            "evolution_graphs": evolution_graphs,
            "part_1_per_question_analysis": [],
            "part_2_exam_macro_scorecard": part_2_exam_macro_scorecard,
            "part_2_taxonomy_analysis": {
                "by_subject": list(all_tax_subjects.values()),
                "by_topic": list(all_tax_topics.values()),
                "subtopic_breakdown": list(all_tax_subtopics.values()),
                "subject_breakdown": list(all_tax_subjects.values()),
                "topic_breakdown": list(all_tax_topics.values()),
                "syllabus_hierarchy": list(all_tax_subjects.values()),
            },
            "part_3_aggregated_user_report": {
                **matrices_summary,
                "part_2_exam_macro_scorecard": part_2_exam_macro_scorecard,
                "segregated_aggregates": segregated_aggregates,
                "ai_cognitive_insights": cum_insight,
                "actionable_tasks": cum_insight.get("study_plan_tasks", []),
                "cumulative_skill_profile": {
                    "cumulative_icrs": w_icrs,
                    "cumulative_icrs_score": w_icrs,
                    "cumulative_irt_theta": w_irt,
                    "cumulative_gti": w_gti,
                    "cumulative_oeei": w_oeei,
                    "cumulative_satoi": w_satoi,
                    "total_tests_given": n_att,
                    "total_questions_answered": total_questions_attempted_sum,
                },
            },
            "ai_cognitive_insights": cum_insight,
        }

        # 6. Format Markdown Audit for Cumulative Profile
        markdown_audit = format_report_to_markdown(full_aggregate_report)
        full_aggregate_report["markdown_audit"] = markdown_audit

        # 7. Update UserSkillProfile Cache in DB via atomic upsert
        from app.db.upsert import get_upsert_insert
        upsert_insert = get_upsert_insert(session)
        now_dt = datetime.now(timezone.utc)
        upsert_stmt = (
            upsert_insert(UserSkillProfile)
            .values(
                user_id=user.id,
                cumulative_irt_theta=w_irt,
                cumulative_gti=w_gti,
                cumulative_oeei=w_oeei,
                cumulative_icrs=w_icrs,
                cumulative_satoi=w_satoi,
                total_tests_given=n_att,
                total_questions_answered=total_questions_attempted_sum,
                aggregate_report_json=full_aggregate_report,
                aggregate_markdown_audit=markdown_audit,
                updated_at=now_dt,
            )
            .on_conflict_do_update(
                index_elements=["user_id"],
                set_={
                    "cumulative_irt_theta": w_irt,
                    "cumulative_gti": w_gti,
                    "cumulative_oeei": w_oeei,
                    "cumulative_icrs": w_icrs,
                    "cumulative_satoi": w_satoi,
                    "total_tests_given": n_att,
                    "total_questions_answered": total_questions_attempted_sum,
                    "aggregate_report_json": full_aggregate_report,
                    "aggregate_markdown_audit": markdown_audit,
                    "updated_at": now_dt,
                },
            )
        )
        await session.exec(upsert_stmt)
        await session.commit()
        from app.cache import invalidate_user_cache
        await invalidate_user_cache(str(user.id))
        return full_aggregate_report

    @classmethod
    def _build_empty_cumulative_report(cls, user: User, now_iso: str) -> Dict[str, Any]:
        return {
            "metadata": {
                "report_title": f"Cumulative Psychometric Profile ({user.full_name})",
                "report_type": "CUMULATIVE_MULTI_EXAM_AGGREGATE",
                "total_exams_evaluated": 0,
                "total_questions_attempted": 0,
                "total_correct": 0,
                "total_incorrect": 0,
                "total_unattempted": 0,
                "cumulative_accuracy_percentage": 0.0,
                "generated_at": now_iso,
                "candidate": {
                    "user_id": str(user.id),
                    "full_name": user.full_name,
                    "email": user.email,
                },
                "exam_attempt": {
                    "exam_name": "No Completed Exams Yet",
                    "canonical_code": "NO-EXAMS",
                    "total_score": 0.0,
                    "max_possible_score": 200.0,
                    "time_spent_seconds": 0,
                    "attempt_date": "N/A",
                },
            },
            "is_cumulative": True,
            "exam_timeline": [],
            "evolution_graphs": {
                "labels": [],
                "dates": [],
                "scores": [],
                "max_scores": [],
                "accuracies": [],
                "icrs_scores": [],
                "irt_thetas": [],
                "gti_percentages": [],
                "oeei_percentages": [],
                "satoi_scores": [],
            },
            "part_1_per_question_analysis": [],
            "part_2_taxonomy_analysis": {
                "subject_breakdown": [],
                "topic_breakdown": [],
                "subtopic_breakdown": [],
            },
            "part_3_aggregated_user_report": {
                "cumulative_skill_profile": {
                    "cumulative_icrs": 65.0,
                    "cumulative_irt_theta": 0.0,
                    "cumulative_gti": 0.20,
                    "cumulative_oeei": 0.70,
                    "cumulative_satoi": 85.0,
                    "total_tests_given": 0,
                    "total_questions_answered": 0,
                }
            },
            "markdown_audit": f"# Cumulative Psychometric Profile\n\nNo evaluated exam attempts found for candidate **{user.full_name}**.",
        }
