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


class MatrixOrchestrator:
    """
    Mode-Aware Psychometric Engine Orchestrator.
    Computes all mathematical analytics (zero LLM) and returns the structured 3-part diagnostic report:
      - Part 1: Per-Question Diagnostic Cards
      - Part 2: Per-Taxonomy Breakdown (Subject, Topic, Subtopic with average time & FSRS retention)
      - Part 3: Aggregated User Report & Cognitive Profile
    """

    @classmethod
    def compute_full_report(
        cls,
        attempt_id: uuid.UUID,
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
            item["question_id"]: item for item in solutions_data.get("questions", [])
        }

        # 1. Part 1 — Per-Question Diagnostics
        part_1_questions = []
        response_payloads = []
        switch_events = []
        irt_items = []
        gti_scores_list = []
        closeness_counts = {
            "Correct Response": 0,
            "High-Closeness Distractor (Partial Knowledge)": 0,
            "Neutral Distractor (Weak Alignment)": 0,
            "Misleading Distractor (Cognitive Trap)": 0,
            "Inverse Distractor (Inverted Logic)": 0,
        }

        taxonomy_acc = {
            "SUBJECT": {},
            "TOPIC": {},
            "SUBTOPIC": {},
        }

        for r in responses:
            q_id = str(r["question_id"])
            sol = sol_map.get(q_id, {})
            irt_p = sol.get("irt_params", {"a": 1.5, "b": 0.0, "c": 0.25})

            is_corr = bool(r.get("is_correct", False))
            time_taken = float(r.get("time_taken_seconds", 60.0))
            exp_time = float(r.get("expected_time_seconds", 60.0))
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

            blooms_lbl = sol.get("blooms_level", "ANALYZE").upper()

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

            q_num = int(r.get("question_number", 1))
            subj_name = r.get("subject", "General Knowledge")
            top_name = r.get("topic", "General Studies")
            sub_name = r.get("subtopic", "Core Concepts")

            part_1_questions.append(
                {
                    "question_number": q_num,
                    "question_id": q_id,
                    "question_text": r.get("question_text") or sol.get("question_text", ""),
                    "options": r.get("options") or sol.get("options", []),
                    "subject": subj_name,
                    "topic": top_name,
                    "subtopic": sub_name,
                    "blooms_level": blooms_lbl,
                    "difficulty": r.get("difficulty", "MEDIUM"),
                    "selected_option_id": r.get("selected_option_id"),
                    "user_selected_option": r.get("user_selected_label", "Unattempted"),
                    "correct_option": sol.get("correct_option_label", "A"),
                    "correct_option_id": sol.get("correct_option_id"),
                    "is_correct": is_corr,
                    "closeness_score": round(c_score, 2),
                    "closeness_classification": c_class,
                    "time_taken_seconds": round(time_taken, 1),
                    "expected_time_seconds": round(exp_time, 1),
                    "time_window": scoring_eval["time_window"],
                    "time_efficiency_ratio": time_eff_ratio,
                    "marks_awarded": round(r.get("final_score", scoring_eval["final_score"]), 2),
                    "gti_item_score": round(gti_item, 4),
                    "is_option_switched": bool(r.get("is_switched", False)),
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
                if tax_name not in taxonomy_acc[tax_type]:
                    taxonomy_acc[tax_type][tax_name] = {
                        "name": tax_name,
                        "total": 0,
                        "correct": 0,
                        "incorrect": 0,
                        "unattempted": 0,
                        "total_time": 0.0,
                        "expected_time": 0.0,
                    }
                entry = taxonomy_acc[tax_type][tax_name]
                entry["total"] += 1
                entry["total_time"] += time_taken
                entry["expected_time"] += exp_time

                if r.get("selected_option_id") is None:
                    entry["unattempted"] += 1
                elif is_corr:
                    entry["correct"] += 1
                else:
                    entry["incorrect"] += 1

        part_1_questions.sort(key=lambda x: x["question_number"])

        # 2. Part 2 — Taxonomy Breakdown Analysis
        part_2_taxonomy = {
            "by_subject": [],
            "by_topic": [],
            "by_subtopic": [],
        }

        # Build memory lookup map
        mem_map = {}
        if user_memory_records:
            for m in user_memory_records:
                key = m.get("topic_name") or m.get("subtopic_name") or "General"
                mem_map[key] = m

        for tax_type, key_name in [
            ("SUBJECT", "by_subject"),
            ("TOPIC", "by_topic"),
            ("SUBTOPIC", "by_subtopic"),
        ]:
            for name, stats in taxonomy_acc[tax_type].items():
                tot = stats["total"]
                corr = stats["correct"]
                inc = stats["incorrect"]
                unatt = stats["unattempted"]
                tot_t = stats["total_time"]
                exp_t = stats["expected_time"]

                acc_pct = round((corr / max(1, tot)) * 100.0, 1)
                avg_time = round(tot_t / max(1, tot), 1)
                eff_avg = round(tot_t / max(1.0, exp_t), 2)

                status = "STRONG" if acc_pct >= 75.0 else ("MODERATE" if acc_pct >= 50.0 else "WEAK_REVISION_REQUIRED")

                # FSRS retention lookup if present
                m_rec = mem_map.get(name, {})
                stab = m_rec.get("stability", 2.0)
                elap = m_rec.get("last_reviewed_days_ago", 0.1)
                r_ret = FSRSEngine.calculate_retrievability(elap, stab)
                r_pct = round(r_ret * 100.0, 1)

                r_health = "HEALTHY_RETENTION"
                if r_pct < 60.0:
                    r_health = "IMMINENT_FORGETTING_RISK"
                elif r_pct < 80.0:
                    r_health = "REVISION_DUE_SOON"

                part_2_taxonomy[key_name].append(
                    {
                        "taxonomy_name": name,
                        "taxonomy_type": tax_type,
                        "total_questions": tot,
                        "correct": corr,
                        "incorrect": inc,
                        "unattempted": unatt,
                        "accuracy_percentage": acc_pct,
                        "avg_time_per_question": avg_time,
                        "total_time_spent": round(tot_t, 1),
                        "time_efficiency_avg": eff_avg,
                        "strength_status": status,
                        "fsrs_retention_pct": r_pct,
                        "retention_health": r_health,
                    }
                )

        # 3. Part 3 — Mode-Aware Aggregated Psychometric Profile
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

        # Selective computation based on AttemptMode
        if mode == AttemptMode.REVISION:
            # Revision mode: focus on retention & blooms; skip IRT/SATOI/OEEI
            irt_eval = {"latent_ability_theta": 0.0, "percentile_rank": 50.0, "ability_level": "REVISION_MODE"}
            oeei_eval = {"oeei_score": 0.70, "elimination_rating": "NOT_EVALUATED_IN_REVISION"}
            satoi_eval = {"satoi_score": 100.0, "cognitive_stamina_status": "REVISION_MODE"}
            switch_eval = {"total_switches": len(switch_events), "regret_index": 0.0, "recommendation": "Revision mode"}
            icrs_eval = {"icrs_score": 70.0, "readiness_tier": "MODERATE_PREPARATION", "breakdown": {}}
        elif mode == AttemptMode.PRACTICE:
            # Practice mode: include IRT, GTI, OEEI, Pacing; skip heavy stamina SATOI
            irt_eval = IRT3PLStrategy.estimate_latent_ability(irt_items)
            oeei_eval = OptionEliminationStrategy.evaluate_elimination(response_payloads)
            satoi_eval = {"satoi_score": 100.0, "cognitive_stamina_status": "PRACTICE_MODE"}
            switch_eval = OptionSwitchRegretStrategy.evaluate_switches(switch_events)
            icrs_eval = IntegratedCognitiveReadinessEngine.compute_icrs(
                irt_theta=irt_eval["latent_ability_theta"],
                gti_value=agg_gti,
                oeei_score=oeei_eval["oeei_score"],
                pacing_skew=pacing_eval["skew_ratio"],
                satoi_score=satoi_eval["satoi_score"],
            )
        else:  # AttemptMode.EXAM
            # Full EXAM mode: execute full 12-matrix battery
            irt_eval = IRT3PLStrategy.estimate_latent_ability(irt_items)
            oeei_eval = OptionEliminationStrategy.evaluate_elimination(response_payloads)
            satoi_eval = SATOIEngine.evaluate_satoi(response_payloads)
            switch_eval = OptionSwitchRegretStrategy.evaluate_switches(switch_events)
            icrs_eval = IntegratedCognitiveReadinessEngine.compute_icrs(
                irt_theta=irt_eval["latent_ability_theta"],
                gti_value=agg_gti,
                oeei_score=oeei_eval["oeei_score"],
                pacing_skew=pacing_eval["skew_ratio"],
                satoi_score=satoi_eval["satoi_score"],
            )

        tot_score = sum(r["final_score"] for r in response_payloads)
        tot_corr_count = sum(1 for r in response_payloads if r["is_correct"])
        max_score = sum(float(r.get("marks", 2.0)) for r in responses)

        score_summary = {
            "total_score": round(tot_score, 2),
            "max_score": round(max_score, 2),
            "accuracy_percentage": round((tot_corr_count / max(1, total_q)) * 100.0, 1),
            "correct_count": tot_corr_count,
            "incorrect_count": sum(1 for r in response_payloads if not r["is_correct"] and r.get("closeness_score_awarded") != 0.0),
            "unattempted_count": sum(1 for r in responses if r.get("selected_option_id") is None),
        }

        part_3_aggregated = {
            "score_summary": score_summary,
            "irt_3pl": irt_eval,
            "gti": {
                "aggregate": agg_gti,
                "category": gti_interp["category"],
                "label": gti_interp["label"],
                "recommendation": gti_interp["recommendation"],
            },
            "icrs": icrs_eval,
            "pacing": pacing_eval,
            "oeei": oeei_eval,
            "satoi": satoi_eval,
            "switch_regret": switch_eval,
            "blooms_mastery": blooms_eval,
            "topic_fsrs_decay": topic_decay_eval,
            "closeness_distribution": closeness_counts,
            "llm_insight": None,  # Populated asynchronously by single LLM call post-submission
            "cumulative_skill_profile": profile_data or {},
        }

        # Assembly
        return {
            "metadata": {
                "report_title": "Comprehensive Psychometric & Cognitive Diagnostic Audit Report",
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "candidate": candidate_info or {},
                "exam_attempt": {
                    "attempt_id": str(attempt_id),
                    "mode": mode.value if hasattr(mode, 'value') else str(mode),
                    "total_score": round(tot_score, 2),
                    "max_possible_score": round(max_score, 2),
                    "time_spent_seconds": round(tot_time_spent, 1),
                    "total_questions_attempted": total_q,
                    **(exam_info or {}),
                },
            },
            "part_1_per_question_analysis": part_1_questions,
            "part_2_taxonomy_analysis": part_2_taxonomy,
            "part_3_aggregated_user_report": part_3_aggregated,
        }
