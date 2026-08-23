from typing import Dict, List, Any


class SATOIEngine:
    @classmethod
    def evaluate_satoi(cls, responses: List[Dict]) -> Dict[str, Any]:
        if not responses:
            return {
                "satoi_score": 50.0,
                "fatigue_curve": [],
                "cognitive_stamina_status": "EARLY_SESSION_ABANDONMENT",
                "stamina_label": "Early Session Dropout / Insufficient Data",
                "burnout_risk": "EARLY_SESSION_ABANDONMENT",
                "unattempted_impact": "No questions answered.",
            }

        total_questions = len(responses)
        attempted_items = [r for r in responses if r.get("selected_option_id") is not None or r.get("user_selected_option") not in ("Unattempted", None)]
        total_attempted = len(attempted_items)
        coverage_ratio = total_attempted / float(total_questions)

        # Divide the exam into 4 sequential quartiles (e.g. 1-25, 26-50, 51-75, 76-100)
        chunk_size = max(1, total_questions // 4)
        quartiles = [
            responses[0:chunk_size],
            responses[chunk_size : 2 * chunk_size],
            responses[2 * chunk_size : 3 * chunk_size],
            responses[3 * chunk_size :],
        ]

        fatigue_curve = []
        q_accs = []
        q_attempts = []

        for idx, q_items in enumerate(quartiles, 1):
            if not q_items:
                continue
            q_tot = len(q_items)
            q_att = sum(1 for r in q_items if r.get("selected_option_id") is not None or r.get("user_selected_option") not in ("Unattempted", None))
            q_corr = sum(1 for r in q_items if r.get("is_correct", False))
            q_acc = round((q_corr / max(1, q_att)) * 100.0, 1) if q_att > 0 else 0.0
            avg_time = sum(r.get("time_taken_seconds", 0.0) for r in q_items) / float(q_tot)

            q_accs.append(q_acc)
            q_attempts.append(q_att)
            fatigue_curve.append(
                {
                    "quartile": f"Q{idx} (Q{((idx-1)*q_tot)+1}-{idx*q_tot if idx<4 else total_questions})",
                    "attempted_count": q_att,
                    "unattempted_count": q_tot - q_att,
                    "accuracy_pct": q_acc,
                    "avg_time_sec": round(avg_time, 1),
                }
            )

        q1_acc = q_accs[0] if q_accs else 0.0
        q4_acc = q_accs[-1] if len(q_accs) >= 4 else q1_acc
        q1_att = q_attempts[0] if q_attempts else 0
        q4_att = q_attempts[-1] if len(q_attempts) >= 4 else 0

        acc_drop = max(0.0, q1_acc - q4_acc)
        attempt_drop = max(0, q1_att - q4_att)

        # Compute stamina score factoring in coverage, accuracy drop, and quartile drops
        base_stamina = max(0.0, 100.0 - (acc_drop * 0.8))
        
        # Scale by overall test coverage so quitting after 7 questions does not grant 100% stamina
        coverage_multiplier = 0.25 + (0.75 * coverage_ratio)
        if total_attempted < 15 and total_questions >= 50:
            coverage_multiplier = min(0.35, coverage_multiplier)

        satoi_score = round(max(15.0, min(100.0, base_stamina * coverage_multiplier)), 1)

        # 5-Tier Human-Friendly Stamina Classification
        if total_attempted < 15 and total_questions >= 50:
            status = "EARLY_SESSION_ABANDONMENT"
            stamina_label = "Early Test Exit (High Unattempted)"
            recommendation = "Exam was submitted early with high unattempted questions. Build endurance by completing full 100-question practice runs."
        elif satoi_score >= 85.0:
            status = "SUPERIOR_ENDURANCE_NO_FATIGUE"
            stamina_label = "Peak 2-Hour Focus & Endurance"
            recommendation = "Exceptional cognitive stamina. Maintained stable accuracy and pacing across all 4 exam quartiles."
        elif satoi_score >= 70.0:
            status = "STABLE_COGNITIVE_STAMINA"
            stamina_label = "Consistent Cognitive Stamina"
            recommendation = "Good stamina across the paper with minimal fatigue-induced accuracy drop in late sections."
        elif satoi_score >= 50.0:
            status = "MILD_LATE_SESSION_FATIGUE"
            stamina_label = "Mild Late-Session Fatigue (Q3/Q4 Dip)"
            recommendation = "Noticed an accuracy drop in the final 25 questions. Take 15-second breathing pauses during the 90-minute mark."
        else:
            status = "SIGNIFICANT_STAMINA_DECAY"
            stamina_label = "Significant Fatigue Decay"
            recommendation = "Substantial drop in focus and accuracy towards the end of the paper. Practice 2-hour timed full mocks to build exam endurance."

        return {
            "satoi_score": satoi_score,
            "accuracy_drop_q1_to_q4_pct": round(acc_drop, 1),
            "cognitive_stamina_status": status,
            "stamina_label": stamina_label,
            "burnout_risk": status,
            "recommendation": recommendation,
            "quartile_fatigue_curve": fatigue_curve,
        }
