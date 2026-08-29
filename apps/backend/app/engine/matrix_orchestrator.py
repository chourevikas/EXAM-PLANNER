import uuid
import math
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone

from app.db.models.enums import AttemptMode
from app.engine.matrices.closeness_evaluator import ClosenessEvaluator
from app.engine.matrices.guessing_tendency import GuessingTendencyStrategy
from app.engine.matrices.time_tiered_scoring import TimeTieredScoringStrategy
from app.engine.matrices.fsrs_retention import FSRSEngine
from app.engine.matrices.macro_pacing import ExamMacroTimeStrategy
from app.engine.matrices.option_elimination import OptionEliminationStrategy
from app.engine.matrices.blooms_mastery import BloomsMasteryStrategy
from app.engine.matrices.irt_3pl_ability import IRT3PLStrategy
from app.engine.matrices.option_switch_regret import OptionSwitchRegretStrategy
from app.engine.matrices.speed_accuracy_tradeoff import SATOIEngine
from app.engine.matrices.topic_fsrs_decay import TopicFSRSDecayEngine
from app.engine.matrices.integrated_cognitive_readiness import IntegratedCognitiveReadinessEngine
from app.config.logger import setup_logger

logger = setup_logger("MatrixOrchestrator")


def is_placeholder_taxonomy(name: Optional[str]) -> bool:
    if not name:
        return True
    low = name.strip().lower()
    placeholders = [
        "all subjects",
        "all topics",
        "all subtopics",
        "entire exam",
        "entire subject",
        "entire topic",
        "all_subjects",
        "all_topics",
        "all_subtopics",
    ]
    return any(p in low for p in placeholders)


class MatrixOrchestrator:
    """
    Mode-Aware Psychometric Engine Orchestrator.
    Computes all mathematical analytics (zero LLM) and returns the structured 4-part diagnostic report:
      - Part 1: Per-Question Diagnostic Cards & Solutions
      - Part 2: Per-Exam Cognitive Scorecard & Macro Dashboard
      - Part 3: Per-Subject / Topic / Subtopic Hierarchy & Topic Retention
      - Part 4: Aggregated Candidate Profile & Growth
    """

    @classmethod
    def compute_full_report(
        cls,
        attempt_id: int | str,
        mode: AttemptMode,
        responses: List[Dict[str, Any]],
        solutions_data: Dict[str, Any],
        allocated_duration_minutes: float = 120.0,
        user_memory_records: Optional[List[Dict[str, Any]]] = None,
        candidate_info: Optional[Dict[str, Any]] = None,
        exam_info: Optional[Dict[str, Any]] = None,
        profile_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Executes mode-aware matrix evaluation based on `AttemptMode` (EXAM, PRACTICE, REVISION).
        """
        sol_map = {
            str(item["question_id"]): item
            for item in solutions_data.get("questions", [])
            if "question_id" in item
        }
        # Also index by question number for robust resolution
        sol_num_map = {
            int(item["question_number"]): item
            for item in solutions_data.get("questions", [])
            if "question_number" in item and item["question_number"] is not None
        }

        # Build memory lookup map early for per-question FSRS metrics
        mem_map = {}
        if user_memory_records:
            for m in user_memory_records:
                key = m.get("subtopic_name") or m.get("topic_name") or "General"
                mem_map[key] = m

        # 1. Part 1 — Per-Question Diagnostics & Solutions
        part_1_questions = []
        response_payloads = []
        switch_events = []
        irt_items = []
        gti_scores_list = []
        closeness_counts = {
            "Correct Response": 0,
            "High-Closeness Distractor (Partial Knowledge)": 0,
            "Moderate Distractor (Plausible Alternative)": 0,
            "Neutral Distractor (Weak Alignment)": 0,
            "Misleading Distractor (Cognitive Trap)": 0,
            "Inverse Distractor (Inverted Logic)": 0,
            "Contradictory Distractor (Direct Opposing Fact)": 0,
        }

        taxonomy_acc = {
            "SUBJECT": {},
            "TOPIC": {},
            "SUBTOPIC": {},
        }

        for idx, r in enumerate(responses, 1):
            q_id = str(r.get("question_id", ""))
            q_num = int(r.get("question_number") or idx)
            sol = sol_map.get(q_id) or sol_num_map.get(q_num, {})
            irt_p = sol.get("irt_params", {"a": 1.5, "b": 0.0, "c": 0.25})

            is_corr = bool(r.get("is_correct", False))
            time_taken = float(r.get("time_taken_seconds", 0.0) or 0.0)
            exp_time = float(r.get("expected_time_seconds", 60.0) or 60.0)
            c_score = float(r.get("closeness_score_awarded", 1.0 if is_corr else 0.0))

            # Compute item GTI mathematically if not already set
            gti_item = float(r.get("gti_item_score", 0.0))
            if gti_item == 0.0:
                gti_item = GuessingTendencyStrategy.compute_item_guessing(
                    time_taken_sec=time_taken,
                    expected_time_sec=exp_time,
                    option_closeness=c_score,
                    is_correct=is_corr,
                    irt_difficulty_b=float(irt_p.get("b", 0.0)),
                    irt_pseudo_guessing_c=float(irt_p.get("c", 0.25)),
                )

            gti_scores_list.append(gti_item)

            c_class = ClosenessEvaluator.classify_option(c_score)
            closeness_counts[c_class] = closeness_counts.get(c_class, 0) + 1

            scoring_eval = TimeTieredScoringStrategy.calculate_score(
                is_correct=is_corr,
                time_taken_sec=time_taken,
                expected_time_sec=exp_time,
                closeness_score=c_score,
                marks_pos=float(r.get("marks", 2.0)),
                marks_neg=float(r.get("negative_marks", 0.66)),
            )

            time_eff_ratio = round(time_taken / max(1.0, exp_time), 2)

            if r.get("is_switched"):
                switch_events.append(
                    {
                        "initial_correct": bool(r.get("initial_correct", False)),
                        "final_correct": is_corr,
                    }
                )

            blooms_lbl = sol.get("blooms_level") or r.get("blooms_level") or "ANALYZE"
            blooms_lbl = str(blooms_lbl).upper()

            # Human-friendly thinking level
            blooms_friendly_map = {
                "REMEMBER": "Fact Recall",
                "UNDERSTAND": "Conceptual Understanding",
                "APPLY": "Practical Application",
                "ANALYZE": "Deep Analytical Thinking",
                "EVALUATE": "Critical Judgment",
            }
            blooms_friendly = blooms_friendly_map.get(blooms_lbl, "Deep Analytical Thinking")

            # Human-friendly Pacing Window
            pacing_window = scoring_eval["time_window"]
            pacing_friendly_map = {
                "OPTIMAL": "Optimal Pace",
                "IMPULSIVE": "Impulsive / Rushed",
                "OVERTHINKING": "Overthinking / Bottleneck",
            }
            pacing_friendly = pacing_friendly_map.get(pacing_window, "Optimal Pace")

            # Human-friendly Guessing Category for this item
            if gti_item >= 0.60:
                item_guessing_label = "High Impulse Guess Risk"
            elif gti_item >= 0.30:
                item_guessing_label = "Calculated 50:50 Choice"
            else:
                item_guessing_label = "High Confidence"

            response_payloads.append(
                {
                    "is_correct": is_corr,
                    "time_taken_seconds": time_taken,
                    "expected_time_seconds": exp_time,
                    "closeness_score_awarded": c_score,
                    "final_score": float(r.get("final_score", scoring_eval["final_score"])),
                    "gti_item_score": gti_item,
                    "blooms_level": blooms_lbl,
                }
            )

            irt_items.append(
                {
                    "a": float(irt_p.get("a", 1.5)),
                    "b": float(irt_p.get("b", 0.0)),
                    "c": float(irt_p.get("c", 0.25)),
                    "is_correct": is_corr,
                }
            )

            raw_subj = r.get("subject") if not is_placeholder_taxonomy(r.get("subject")) else None
            raw_top = r.get("topic") if not is_placeholder_taxonomy(r.get("topic")) else None
            raw_sub = r.get("subtopic") if not is_placeholder_taxonomy(r.get("subtopic")) else None

            sol_subj = sol.get("subject") if not is_placeholder_taxonomy(sol.get("subject")) else None
            sol_top = sol.get("topic") if not is_placeholder_taxonomy(sol.get("topic")) else None
            sol_sub = sol.get("subtopic") if not is_placeholder_taxonomy(sol.get("subtopic")) else None

            subj_name = raw_subj or sol_subj or "General Studies"
            top_name = raw_top or sol_top or "General Knowledge"
            sub_name = raw_sub or sol_sub or "Core Concepts"

            # Compute FSRS Topic Memory for this question
            mem_rec = mem_map.get(sub_name) or mem_map.get(top_name) or {}
            is_attempted = r.get("selected_option_id") is not None or r.get("user_selected_label") not in ("Unattempted", None)

            if is_attempted and not is_corr:
                # Direct lapse on this question: retention drops to reflect concept gap
                fsrs_stab = float(mem_rec.get("stability", 0.8))
                fsrs_ret_pct = round(max(25.0, min(45.0, 32.0 + (c_score * 12.0))), 1)
            elif is_attempted and is_corr:
                fsrs_stab = float(mem_rec.get("stability", 4.0))
                days_ago = float(mem_rec.get("last_reviewed_days_ago", 0.2))
                raw_r = FSRSEngine.calculate_retrievability(days_ago, fsrs_stab)
                fsrs_ret_pct = round(max(85.0, min(98.5, raw_r * 100.0)), 1)
            else:
                # Unattempted question
                fsrs_stab = float(mem_rec.get("stability", 2.0))
                fsrs_ret_pct = 50.0

            # Compute OSRI Switch outcome for this question
            is_sw = bool(r.get("is_switched", False))
            if is_sw:
                init_corr = bool(r.get("initial_correct", False))
                if not init_corr and is_corr:
                    osri_status = "Rewarding Switch (+2.67 Marks)"
                    osri_impact = 2.6667
                elif init_corr and not is_corr:
                    osri_status = "Costly Second-Guess (-2.67 Marks)"
                    osri_impact = -2.6667
                else:
                    osri_status = "Neutral Switch"
                    osri_impact = 0.0
            else:
                osri_status = "Initial Selection Retained"
                osri_impact = 0.0

            time_score_pct = round((exp_time / max(1.0, time_taken)) * 100.0, 1)

            # Unattempted behavioral classification
            if not is_attempted:
                if time_taken >= 35.0:
                    unatt_behavior = "HESITATED_ABANDONED"
                    unatt_label = "Hesitated & Abandoned (Time Lost)"
                elif time_taken <= 5.0:
                    unatt_behavior = "TIME_STARVED"
                    unatt_label = "Time-Starved (Ran Out of Time)"
                else:
                    unatt_behavior = "STRATEGIC_SKIP"
                    unatt_label = "Strategic Safe Skip"
            else:
                unatt_behavior = "ATTEMPTED"
                unatt_label = "Attempted"

            part_1_questions.append(
                {
                    "question_number": q_num,
                    "question_id": q_id,
                    "question_text": r.get("question_text") or sol.get("question_text") or sol.get("text", ""),
                    "options": r.get("options") or sol.get("options", []),
                    "subject": subj_name,
                    "topic": top_name,
                    "subtopic": sub_name,
                    "blooms_level": blooms_lbl,
                    "cognitive_thinking_level": blooms_friendly,
                    "difficulty": r.get("difficulty", "MEDIUM"),
                    "selected_option_id": r.get("selected_option_id"),
                    "user_selected_option": r.get("user_selected_label", "Unattempted"),
                    "correct_option": sol.get("correct_option_label", "A"),
                    "correct_option_id": sol.get("correct_option_id"),
                    "is_correct": is_corr,
                    "is_attempted": is_attempted,
                    "unattempted_behavior": unatt_behavior,
                    "unattempted_label": unatt_label,
                    "closeness_score": round(c_score, 2),
                    "distractor_classification": c_class,
                    "closeness_classification": c_class,
                    "time_taken_seconds": round(time_taken, 1),
                    "expected_time_seconds": round(exp_time, 1),
                    "time_window": pacing_window,
                    "pacing_efficiency": pacing_friendly,
                    "time_efficiency_ratio": time_eff_ratio,
                    "time_efficiency_score": time_score_pct,
                    "marks_awarded": round(2.0 if is_corr else (-0.6667 if r.get("selected_option_id") is not None else 0.0), 2),
                    "gti_item_score": round(gti_item, 4),
                    "item_guessing_label": item_guessing_label,
                    "is_option_switched": is_sw,
                    "osri_status": osri_status,
                    "osri_impact": round(osri_impact, 2),
                    "fsrs_retention_pct": fsrs_ret_pct,
                    "fsrs_stability_days": round(fsrs_stab, 1),
                    "answer_revealed_during_exam": bool(r.get("answer_revealed", False)),
                    "explanation": r.get("explanation") or sol.get("explanation"),
                    "explanation_translations": sol.get("explanation_translations") or r.get("explanation_translations", {}),
                    "distractor_scores": sol.get("distractor_scores") or r.get("distractor_scores", {}),
                    "distractor_analysis": sol.get("distractor_scores") or r.get("distractor_scores", {}),
                }
            )

            # Taxonomy Aggregation Helper
            for tax_type, tax_name in [
                ("SUBJECT", subj_name),
                ("TOPIC", top_name),
                ("SUBTOPIC", sub_name),
            ]:
                if is_placeholder_taxonomy(tax_name):
                    continue
                if tax_name not in taxonomy_acc[tax_type]:
                    taxonomy_acc[tax_type][tax_name] = {
                        "name": tax_name,
                        "subject": subj_name,
                        "topic": top_name,
                        "total": 0,
                        "correct": 0,
                        "incorrect": 0,
                        "unattempted": 0,
                        "total_time": 0.0,
                        "expected_time": 0.0,
                        "blooms": {"REMEMBER": 0, "UNDERSTAND": 0, "APPLY": 0, "ANALYZE": 0, "EVALUATE": 0},
                        "blooms_correct": {"REMEMBER": 0, "UNDERSTAND": 0, "APPLY": 0, "ANALYZE": 0, "EVALUATE": 0},
                    }
                entry = taxonomy_acc[tax_type][tax_name]
                entry["total"] += 1
                entry["total_time"] += time_taken
                entry["expected_time"] += exp_time
                b_lbl = blooms_lbl if blooms_lbl in entry["blooms"] else "ANALYZE"
                entry["blooms"][b_lbl] = entry["blooms"].get(b_lbl, 0) + 1

                if r.get("selected_option_id") is None:
                    entry["unattempted"] += 1
                elif is_corr:
                    entry["correct"] += 1
                    entry["blooms_correct"][b_lbl] = entry["blooms_correct"].get(b_lbl, 0) + 1
                else:
                    entry["incorrect"] += 1

        part_1_questions.sort(key=lambda x: x["question_number"])

        # 2. Part 3 — Taxonomy Hierarchy & Topic Retention Analysis
        part_3_taxonomy = {
            "by_subject": [],
            "by_topic": [],
            "by_subtopic": [],
        }

        # Build memory lookup map
        mem_map = {}
        if user_memory_records:
            for m in user_memory_records:
                key = m.get("subtopic_name") or m.get("topic_name") or "General"
                mem_map[key] = m

        for tax_type, key_name in [
            ("SUBJECT", "by_subject"),
            ("TOPIC", "by_topic"),
            ("SUBTOPIC", "by_subtopic"),
        ]:
            for name, stats in taxonomy_acc[tax_type].items():
                if is_placeholder_taxonomy(name):
                    continue
                tot = stats["total"]
                corr = stats["correct"]
                inc = stats["incorrect"]
                unatt = stats["unattempted"]
                tot_t = stats["total_time"]
                exp_t = stats["expected_time"]

                acc_pct = round((corr / max(1, tot)) * 100.0, 1)
                avg_time = round(tot_t / max(1, tot), 1)
                eff_avg = round(tot_t / max(1.0, exp_t), 2)

                # 5-Tier Strength Classification
                if acc_pct >= 85.0:
                    status = "EXCEPTIONAL_MASTERY"
                    status_label = "Mastered"
                elif acc_pct >= 70.0:
                    status = "STRONG"
                    status_label = "Strong"
                elif acc_pct >= 50.0:
                    status = "MODERATE"
                    status_label = "Competent"
                elif acc_pct >= 30.0:
                    status = "WEAK_REVISION_REQUIRED"
                    status_label = "Developing - Needs Practice"
                else:
                    status = "CRITICAL_DEFICIT"
                    status_label = "Critical Gap"

                # Topic Retention calculation (FSRS retrievability per subtopic/topic)
                m_rec = mem_map.get(name, {})
                attempted_in_tax = corr + inc
                if attempted_in_tax > 0:
                    if acc_pct == 0.0:
                        stab = float(m_rec.get("stability", 0.6))
                        r_pct = round(max(20.0, min(40.0, 25.0 + (eff_avg * 5.0))), 1)
                    elif acc_pct >= 80.0:
                        stab = float(m_rec.get("stability", 5.0))
                        r_pct = round(min(98.0, 85.0 + (acc_pct - 80.0) * 0.65), 1)
                    elif acc_pct >= 50.0:
                        stab = float(m_rec.get("stability", 2.5))
                        r_pct = round(60.0 + (acc_pct - 50.0) * 0.66, 1)
                    else:
                        stab = float(m_rec.get("stability", 1.2))
                        r_pct = round(40.0 + (acc_pct / 50.0) * 18.0, 1)
                else:
                    # Unattempted topic
                    stab = float(m_rec.get("stability", 2.0))
                    r_pct = 50.0

                # 5-Tier Memory Retention Health
                if r_pct >= 85.0:
                    r_health = "OPTIMAL_LONG_TERM_STABILITY"
                    r_health_label = "Strong Memory"
                elif r_pct >= 70.0:
                    r_health = "HEALTHY_ACTIVE_RETENTION"
                    r_health_label = "Healthy Active Retention"
                elif r_pct >= 55.0:
                    r_health = "REVISION_RECOMMENDED_SOON"
                    r_health_label = "Revision Due Soon"
                elif r_pct >= 40.0:
                    r_health = "ACCELERATED_FORGETTING_RISK"
                    r_health_label = "Imminent Forgetting Risk"
                else:
                    r_health = "CRITICAL_MEMORY_DECAY"
                    r_health_label = "Critical Decay - Revise Immediately"

                blooms_data = {}
                for b_k, b_tot in stats.get("blooms", {}).items():
                    if b_tot > 0:
                        b_c = stats.get("blooms_correct", {}).get(b_k, 0)
                        blooms_data[b_k] = {
                            "total": b_tot,
                            "correct": b_c,
                            "accuracy": round((b_c / max(1, b_tot)) * 100.0, 1),
                        }

                p_status = "OPTIMAL" if 0.7 <= eff_avg <= 1.35 else ("BOTTLENECK" if eff_avg > 1.35 else "RUSHED")
                p_label = "Optimal Pace" if p_status == "OPTIMAL" else ("Time Bottleneck" if p_status == "BOTTLENECK" else "Rushed Pace")

                part_3_taxonomy[key_name].append(
                    {
                        "taxonomy_name": name,
                        "taxonomy_type": tax_type,
                        "subject": stats.get("subject", subj_name),
                        "topic": stats.get("topic", top_name),
                        "total_questions": tot,
                        "attempted_questions": corr + inc,
                        "correct": corr,
                        "incorrect": inc,
                        "unattempted": unatt,
                        "accuracy_percentage": acc_pct,
                        "avg_time_per_question": avg_time,
                        "expected_time_per_question": round(exp_t / max(1, tot), 1),
                        "total_time_spent": round(tot_t, 1),
                        "time_efficiency_avg": eff_avg,
                        "pacing_status": p_status,
                        "pacing_label": p_label,
                        "strength_status": status,
                        "strength_label": status_label,
                        "blooms_breakdown": blooms_data,
                        "topic_retention_pct": r_pct,
                        "fsrs_retention_pct": r_pct,
                        "fsrs_stability_days": round(stab, 1),
                        "retention_health": r_health,
                        "retention_health_label": r_health_label,
                    }
                )

        # 3. Part 2 — Exam Macro Performance Scorecard (Mode-Aware)
        tot_time_spent = sum(r.get("time_taken_seconds", 0.0) for r in response_payloads)
        total_q = len(response_payloads)

        agg_gti = GuessingTendencyStrategy.compute_aggregate_gti(gti_scores_list)
        gti_interp = GuessingTendencyStrategy.interpret_gti(agg_gti)

        pacing_eval = ExamMacroTimeStrategy.evaluate_overall_pacing(
            total_time_spent_sec=tot_time_spent,
            total_allocated_minutes=allocated_duration_minutes,
            total_questions=total_q,
            responses=response_payloads,
        )

        blooms_eval = BloomsMasteryStrategy.evaluate_blooms(response_payloads)
        topic_decay_eval = TopicFSRSDecayEngine.evaluate_topic_decay(user_memory_records or [])

        tot_score = sum(r["final_score"] for r in response_payloads)
        tot_corr_count = sum(1 for r in response_payloads if r["is_correct"])
        tot_attempted = sum(1 for r in responses if r.get("selected_option_id") is not None or r.get("user_selected_option") not in ("Unattempted", None))
        tot_unatt = sum(1 for r in responses if r.get("selected_option_id") is None and r.get("user_selected_option") in ("Unattempted", None))
        max_score = sum(float(r.get("marks", 2.0)) for r in responses)

        # Selective computation based on AttemptMode
        if mode == AttemptMode.REVISION:
            irt_eval = {"latent_ability_theta": 0.0, "percentile_rank": 50.0, "ability_level": "REVISION_MODE", "ability_label": "Revision Mode"}
            oeei_eval = {"oeei_score": 0.70, "elimination_rating": "NOT_EVALUATED_IN_REVISION", "elimination_label": "Revision Mode"}
            satoi_eval = {"satoi_score": 100.0, "cognitive_stamina_status": "REVISION_MODE", "stamina_label": "Revision Mode", "quartile_fatigue_curve": []}
            switch_eval = {"total_switches": len(switch_events), "regret_index": 0.0, "regret_level": "INTUITIVE_PRECISION_NO_REGRET", "recommendation": "Revision mode", "regret_label": "Zero Switch Regret"}
            icrs_eval = {"icrs_score": 70.0, "readiness_tier": "MODERATE_PREPARATION", "readiness_label": "Revision Benchmark", "interpretation": "Revision session completed.", "breakdown": {}}
        elif mode == AttemptMode.PRACTICE:
            irt_eval = IRT3PLStrategy.estimate_latent_ability(irt_items)
            irt_friendly_map = {"TOP_PERFORMER": "Top Performer", "ABOVE_AVERAGE": "Above Average", "AVERAGE": "Competent", "NEEDS_FOUNDATION": "Foundation Needed"}
            irt_eval["ability_label"] = irt_friendly_map.get(irt_eval.get("ability_level"), "Competent")
            oeei_eval = OptionEliminationStrategy.evaluate_elimination(response_payloads)
            satoi_eval = {"satoi_score": 100.0, "cognitive_stamina_status": "PRACTICE_MODE", "stamina_label": "Practice Mode", "quartile_fatigue_curve": []}
            switch_eval = OptionSwitchRegretStrategy.evaluate_switches(switch_events)
            icrs_eval = IntegratedCognitiveReadinessEngine.compute_icrs(
                irt_theta=irt_eval["latent_ability_theta"],
                gti_value=agg_gti,
                oeei_score=oeei_eval["oeei_score"],
                pacing_skew=pacing_eval["skew_ratio"],
                satoi_score=satoi_eval["satoi_score"],
                net_score=tot_score,
                max_score=max_score,
                attempted_count=tot_attempted,
                total_questions=total_q,
                qualifying_cutoff=92.0,
            )
        else:  # AttemptMode.EXAM
            irt_eval = IRT3PLStrategy.estimate_latent_ability(irt_items)
            irt_friendly_map = {"TOP_PERFORMER": "Top Performer", "ABOVE_AVERAGE": "Above Average", "AVERAGE": "Competent", "NEEDS_FOUNDATION": "Foundation Needed"}
            irt_eval["ability_label"] = irt_friendly_map.get(irt_eval.get("ability_level"), "Competent")
            oeei_eval = OptionEliminationStrategy.evaluate_elimination(response_payloads)
            satoi_eval = SATOIEngine.evaluate_satoi(response_payloads)
            switch_eval = OptionSwitchRegretStrategy.evaluate_switches(switch_events)
            icrs_eval = IntegratedCognitiveReadinessEngine.compute_icrs(
                irt_theta=irt_eval["latent_ability_theta"],
                gti_value=agg_gti,
                oeei_score=oeei_eval["oeei_score"],
                pacing_skew=pacing_eval["skew_ratio"],
                satoi_score=satoi_eval["satoi_score"],
                net_score=tot_score,
                max_score=max_score,
                attempted_count=tot_attempted,
                total_questions=total_q,
                qualifying_cutoff=92.0,
            )

        # Unattempted Behavioral Aggregation
        time_starved_cnt = sum(1 for q in part_1_questions if q.get("unattempted_behavior") == "TIME_STARVED")
        hesitated_cnt = sum(1 for q in part_1_questions if q.get("unattempted_behavior") == "HESITATED_ABANDONED")
        strategic_cnt = sum(1 for q in part_1_questions if q.get("unattempted_behavior") == "STRATEGIC_SKIP")
        wasted_abandoned_time = sum(q.get("time_taken_seconds", 0.0) for q in part_1_questions if q.get("unattempted_behavior") == "HESITATED_ABANDONED")
        missed_easy_cnt = sum(1 for q in part_1_questions if not q.get("is_attempted") and str(q.get("difficulty", "")).upper() == "EASY")

        unattempted_summary = {
            "total_unattempted": tot_unatt,
            "time_starved_count": time_starved_cnt,
            "hesitated_abandoned_count": hesitated_cnt,
            "strategic_skip_count": strategic_cnt,
            "wasted_time_on_abandoned_seconds": round(wasted_abandoned_time, 1),
            "missed_easy_questions_count": missed_easy_cnt,
            "potential_marks_left_on_table": round(missed_easy_cnt * 2.0, 2),
        }

        # Human-friendly Readiness tier labels
        icrs_tier_labels = {
            "EXCEPTIONAL_PRELIMS_READY": "Prelims Ready - Top Rank Contender",
            "HIGH_COMPETENCE_READY": "Prelims Ready Benchmark",
            "COMPETITIVE_BENCHMARK_READY": "Prelims Ready Benchmark",
            "MODERATE_DEVELOPING_READINESS": "Developing Readiness - Target Revision Needed",
            "FOUNDATIONAL_VULNERABILITY": "Foundation Building Needed",
            "SIGNIFICANT_CONCEPTUAL_DEFICIT": "Critical Foundation Gap",
            "CRITICAL_INTERVENTION_REQUIRED": "Critical Foundation & Practice Required",
        }
        icrs_eval["readiness_label"] = icrs_tier_labels.get(icrs_eval.get("readiness_tier"), "Competitive Benchmark Ready")

        score_summary = {
            "total_score": round(tot_score, 2),
            "max_score": round(max_score, 2),
            "attempted_count": tot_attempted,
            "unattempted_count": tot_unatt,
            "accuracy_percentage": round((tot_corr_count / max(1, tot_attempted)) * 100.0, 1) if tot_attempted > 0 else 0.0,
            "overall_coverage_percentage": round((tot_attempted / max(1, total_q)) * 100.0, 1),
            "correct_count": tot_corr_count,
            "incorrect_count": sum(1 for r in response_payloads if not r["is_correct"] and r.get("selected_option_id") is not None),
        }

        # 4. Instant Deterministic Rule-Based Mentorship Insights
        strong_subjs = [s["taxonomy_name"] for s in part_3_taxonomy.get("by_subject", []) if s.get("strength_status") in ("STRONG", "EXCEPTIONAL_MASTERY")]
        weak_subjs = [s["taxonomy_name"] for s in part_3_taxonomy.get("by_subject", []) if s.get("strength_status") in ("WEAK_REVISION_REQUIRED", "CRITICAL_DEFICIT")]
        weak_topics = [s["taxonomy_name"] for s in part_3_taxonomy.get("by_topic", []) if s.get("strength_status") in ("WEAK_REVISION_REQUIRED", "CRITICAL_DEFICIT")][:3]

        strengths_list = []
        weaknesses_list = []

        if strong_subjs:
            strengths_list.append(f"Demonstrated solid concept command in {', '.join(strong_subjs)}.")
        if gti_interp.get("category") in ("HIGH_CONFIDENCE_METHODICAL", "CONTROLLED_CALCULATED_RISK"):
            strengths_list.append("High instinct discipline with minimal rushed guessing errors.")
        if float(oeei_eval.get("oeei_score") or 0.0) >= 0.70:
            strengths_list.append("Effective option elimination tactics, avoiding cognitive distractor traps.")
        if not strengths_list:
            strengths_list.append(f"Successfully completed all {total_q} questions within the exam duration.")

        if weak_subjs:
            weaknesses_list.append(f"Accuracy dipped below target benchmarks in {', '.join(weak_subjs)}.")
        if weak_topics:
            weaknesses_list.append(f"Identified high distractor trap vulnerability in topics: {', '.join(weak_topics)}.")
        if gti_interp.get("category") in ("IMPULSIVE_BLIND_GUESSING", "ELEVATED_IMPULSIVE_RISK"):
            weaknesses_list.append("Tendency to answer prematurely under time pressure without verifying all options.")
        if pacing_eval.get("pacing_status") in ("EARLY_BOTTLENECK_OVERTHINK", "LATE_EXAM_PANIC_RUSH"):
            weaknesses_list.append("Pacing imbalance detected between the first and second halves of the exam.")
        if not weaknesses_list:
            weaknesses_list.append("Minor accuracy drop on higher-order analytical statement questions.")

        # Generate Concrete Actionable Revision Tasks (Exactly 4 max)
        actionable_tasks = []
        for idx, wt in enumerate(part_3_taxonomy.get("by_topic", [])[:4], start=1):
            if wt.get("strength_status") in ("WEAK_REVISION_REQUIRED", "CRITICAL_DEFICIT", "MODERATE"):
                t_name = wt.get("taxonomy_name", "General Studies")
                t_acc = wt.get("accuracy_percentage", 40.0)
                missed_q_nums = [q["question_number"] for q in part_1_questions if (q.get("topic") == t_name or q.get("subject") == t_name) and not q.get("is_correct")]
                
                actionable_tasks.append({
                    "task_id": f"task_{idx}_{uuid.uuid4().hex[:6]}",
                    "title": f"Targeted Concept Revision: {t_name}",
                    "subject": wt.get("subject") or "General Studies",
                    "topic": t_name,
                    "subtopic": wt.get("subtopic"),
                    "activity_type": "CONCEPT_REVISION" if t_acc < 45.0 else "TARGETED_MCQ_PRACTICE",
                    "priority": "CRITICAL" if t_acc < 40.0 else ("HIGH" if t_acc < 55.0 else "MEDIUM"),
                    "allocated_time_minutes": 45 if t_acc < 40.0 else 30,
                    "due_in_days": min(7, idx + 1),
                    "reasoning": f"Scored {t_acc}% accuracy with {len(missed_q_nums)} incorrect/near-miss selections.",
                    "action_checklist": [
                        f"Review core textbook notes & syllabus chapter for {t_name}",
                        f"Review step-by-step solution breakdowns for missed questions in this test",
                        f"Practice 15 high-yield MCQs focusing on option elimination in {t_name}",
                    ],
                    "linked_question_numbers": missed_q_nums,
                    "is_added_to_plan": False,
                })

        if not actionable_tasks:
            actionable_tasks.append({
                "task_id": f"task_1_{uuid.uuid4().hex[:6]}",
                "title": "Comprehensive Mock Error Log Review",
                "subject": "General Studies",
                "topic": "Comprehensive Review",
                "subtopic": "Distractor Traps",
                "activity_type": "ERROR_LOG_AUDIT",
                "priority": "HIGH",
                "allocated_time_minutes": 30,
                "due_in_days": 2,
                "reasoning": "Consolidate learning from this attempt before the next mock test.",
                "action_checklist": [
                    "Review step-by-step solutions for all questions where options were switched or flagged",
                    "Note high-yield traps into your personal revision notebook",
                    "Schedule your next full-length benchmark mock test in 4 days",
                ],
                "linked_question_numbers": [],
                "is_added_to_plan": False,
            })

        actionable_tasks = actionable_tasks[:4]

        instant_mentorship_insight = {
            "executive_summary": f"Completed test with {tot_score:.2f} net marks ({round((tot_corr_count / max(1, tot_attempted)) * 100.0, 1)}% accuracy). Pacing was {pacing_eval.get('pacing_status', 'BALANCED').replace('_', ' ').title()}.",
            "benchmark_verdict": f"Score: {tot_score:.2f} / {max_score:.2f} Marks",
            "tactical_strengths": strengths_list,
            "critical_vulnerabilities": weaknesses_list,
            "pacing_and_unattempted_diagnosis": f"Paced at {pacing_eval.get('avg_time_per_question_sec', 60.0):.1f}s/question. Of {tot_unatt} unattempted questions, {time_starved_cnt} were time-starved and {hesitated_cnt} were hesitated & abandoned.",
            "distractor_trap_critique": f"Distractor resistance index at {round((1.0 - (closeness_counts.get('Misleading Distractor (Cognitive Trap)', 0)/max(1, total_q))) * 100.0, 1)}%. Second-guess switches resulted in {switch_eval.get('net_score_impact', 0.0):+.2f} marks impact.",
            "study_plan_tasks": actionable_tasks,
            "closing_mentorship_advice": "Execute the recommended tasks in your study planner to steadily elevate your score benchmark!",
        }

        # 5. Synthesize 7-Dimension Categorization of Weak & Strong Spots
        weak_spots_categorized = {
            "techniques": [],
            "subject": [s["taxonomy_name"] for s in part_3_taxonomy["by_subject"] if s["strength_status"] in ("WEAK_REVISION_REQUIRED", "CRITICAL_DEFICIT")],
            "topic": [t["taxonomy_name"] for t in part_3_taxonomy["by_topic"] if t["strength_status"] in ("WEAK_REVISION_REQUIRED", "CRITICAL_DEFICIT")],
            "subtopic": [st["taxonomy_name"] for st in part_3_taxonomy["by_subtopic"] if st["strength_status"] in ("WEAK_REVISION_REQUIRED", "CRITICAL_DEFICIT")],
            "blooms_thinking": [lvl for lvl, score in blooms_eval.items() if score < 50.0],
            "topic_retention": [st["taxonomy_name"] for st in part_3_taxonomy["by_subtopic"] if st["retention_health"] in ("ACCELERATED_FORGETTING_RISK", "CRITICAL_MEMORY_DECAY")],
            "readiness_gap": icrs_eval.get("readiness_label", "Developing"),
        }
        if gti_interp.get("category") in ("IMPULSIVE_BLIND_GUESSING", "ELEVATED_IMPULSIVE_RISK"):
            weak_spots_categorized["techniques"].append("Impulsive Guessing Risk")
        if float(switch_eval.get("regret_index") or 0.0) > 0.40:
            weak_spots_categorized["techniques"].append("Panic Answer Switching")
        if pacing_eval.get("pacing_status") in ("EARLY_BOTTLENECK_OVERTHINK", "LATE_EXAM_PANIC_RUSH"):
            weak_spots_categorized["techniques"].append("Uneven Exam Pacing")

        strong_spots_categorized = {
            "techniques": [],
            "subject": [s["taxonomy_name"] for s in part_3_taxonomy["by_subject"] if s["strength_status"] in ("STRONG", "EXCEPTIONAL_MASTERY")],
            "topic": [t["taxonomy_name"] for t in part_3_taxonomy["by_topic"] if t["strength_status"] in ("STRONG", "EXCEPTIONAL_MASTERY")],
            "subtopic": [st["taxonomy_name"] for st in part_3_taxonomy["by_subtopic"] if st["strength_status"] in ("STRONG", "EXCEPTIONAL_MASTERY")],
            "blooms_thinking": [lvl for lvl, score in blooms_eval.items() if score >= 70.0],
            "topic_retention": [st["taxonomy_name"] for st in part_3_taxonomy["by_subtopic"] if st["retention_health"] in ("OPTIMAL_LONG_TERM_STABILITY", "HEALTHY_ACTIVE_RETENTION")],
            "readiness_tier": icrs_eval.get("readiness_label", "Competitive"),
        }
        if gti_interp.get("category") in ("HIGH_CONFIDENCE_METHODICAL", "CONTROLLED_CALCULATED_RISK"):
            strong_spots_categorized["techniques"].append("Disciplined Instinct & Minimal Guessing")
        if float(oeei_eval.get("oeei_score") or 0.0) >= 0.70:
            strong_spots_categorized["techniques"].append("Tactical Option Elimination")

        # Mode-Aware Benchmark Analysis (Full Mock vs Practice / Guest Exam)
        corr_marks = round(tot_corr_count * 2.0, 2)
        inc_count = sum(1 for r in response_payloads if not r["is_correct"] and r.get("selected_option_id") is not None)
        neg_marks = round(inc_count * 0.66, 2)
        net_marks = round(tot_score, 2)
        is_practice_test = (max_score < 100.0) or (total_q < 50) or (mode == AttemptMode.PRACTICE)

        if is_practice_test:
            # Scaled 46% qualifying target based on test max score
            cutoff_target = round(max_score * 0.46, 2)
            if net_marks >= max_score * 0.70:
                bench_status = "High Mastery (≥70% Precision Standard)"
                bench_badge_color = "#10b981"
            elif net_marks >= cutoff_target:
                bench_status = "Qualifying Practice Standard (Passed Topic Benchmark)"
                bench_badge_color = "#2563eb"
            elif net_marks >= max_score * 0.30:
                bench_status = "Near Practice Benchmark (Revision Recommended)"
                bench_badge_color = "#f59e0b"
            else:
                bench_status = "Foundational Remediation (Focus on Weak Concepts)"
                bench_badge_color = "#ef4444"
        else:
            cutoff_target = 92.0
            if net_marks >= 105.0:
                bench_status = "Well Above Prelims Cutoff (Exceptional Standard)"
                bench_badge_color = "#10b981"
            elif net_marks >= cutoff_target:
                bench_status = "Clearing Qualifying Cutoff (Competitive Trajectory)"
                bench_badge_color = "#2563eb"
            elif net_marks >= 78.0:
                bench_status = "Near Cutoff Margin (Target +10–15 Marks in Weak Topics)"
                bench_badge_color = "#f59e0b"
            else:
                bench_status = "Below Cutoff (Focus on High-Weightage Core Subjects)"
                bench_badge_color = "#ef4444"

        upsc_benchmark = {
            "is_practice_mode": is_practice_test,
            "expected_cutoff_marks": cutoff_target,
            "candidate_net_score": net_marks,
            "cutoff_margin": round(net_marks - cutoff_target, 2),
            "benchmark_status": bench_status,
            "benchmark_color": bench_badge_color,
            "positive_marks_earned": corr_marks,
            "negative_marks_lost": neg_marks,
            "net_marks": net_marks,
            "total_marks_possible": round(max_score, 2),
        }

        part_2_exam_scorecard = {
            "score_summary": score_summary,
            "upsc_prelims_benchmark": upsc_benchmark,
            "actionable_tasks": actionable_tasks,
            "overall_exam_readiness": icrs_eval,
            "icrs": icrs_eval,
            "concept_mastery_level": irt_eval,
            "irt_3pl": irt_eval,
            "guessing_instinct_risk": {
                "aggregate": agg_gti,
                "category": gti_interp["category"],
                "label": gti_interp["label"],
                "recommendation": gti_interp["recommendation"],
            },
            "gti": {
                "aggregate": agg_gti,
                "category": gti_interp["category"],
                "label": gti_interp["label"],
                "recommendation": gti_interp["recommendation"],
            },
            "pacing_efficiency": pacing_eval,
            "pacing": pacing_eval,
            "option_elimination_precision": oeei_eval,
            "oeei": oeei_eval,
            "cognitive_stamina": satoi_eval,
            "satoi": satoi_eval,
            "second_guessing_discipline": switch_eval,
            "switch_regret": switch_eval,
            "thinking_cognitive_levels": blooms_eval,
            "blooms_mastery": blooms_eval,
            "distractor_trap_distribution": closeness_counts,
            "closeness_distribution": closeness_counts,
            "unattempted_summary": unattempted_summary,
            "unattempted_analysis": unattempted_summary,
            "mentorship_insight": instant_mentorship_insight,
            "llm_insight": instant_mentorship_insight,
            "weak_spots_categorized": weak_spots_categorized,
            "strong_spots_categorized": strong_spots_categorized,
        }

        # 6. Part 4 — Aggregate Candidate Profile
        part_4_aggregate_profile = {
            "cumulative_skill_profile": profile_data or {},
            "topic_memory_retention_overview": topic_decay_eval,
            "topic_fsrs_decay": topic_decay_eval,
            "weak_spots_overview": weak_spots_categorized,
            "strong_spots_overview": strong_spots_categorized,
        }

        # 7. Final Assembly into 4 Clean Sections
        return {
            "metadata": {
                "report_title": "Comprehensive 4-Section Psychometric & Cognitive Diagnostic Audit Report",
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "candidate": candidate_info or {},
                "exam_attempt": {
                    "attempt_id": str(attempt_id),
                    "mode": mode.value if hasattr(mode, "value") else str(mode),
                    "total_score": round(tot_score, 2),
                    "max_possible_score": round(max_score, 2),
                    "time_spent_seconds": round(tot_time_spent, 1),
                    "total_questions_attempted": total_q,
                    **(exam_info or {}),
                },
            },
            # 4 Standardized Report Sections
            "part_1_per_question_analysis": part_1_questions,
            "part_2_exam_macro_scorecard": part_2_exam_scorecard,
            "part_3_taxonomy_hierarchy_retention": part_3_taxonomy,
            "part_4_aggregate_user_profile": part_4_aggregate_profile,
            # Backward-compatibility aliases
            "part_2_taxonomy_analysis": part_3_taxonomy,
            "part_3_aggregated_user_report": part_2_exam_scorecard,
        }

