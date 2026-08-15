from typing import Dict, List, Any


class SATOIEngine:
    @classmethod
    def evaluate_satoi(cls, responses: List[Dict]) -> Dict[str, Any]:
        if not responses or len(responses) < 4:
            return {
                "satoi_score": 100.0,
                "fatigue_curve": [],
                "cognitive_stamina_status": "STABLE_STAMINA",
                "burnout_risk": "SUPERIOR_ENDURANCE_NO_FATIGUE",
            }

        n = len(responses)
        chunk_size = max(1, n // 4)
        quartiles = [
            responses[0:chunk_size],
            responses[chunk_size : 2 * chunk_size],
            responses[2 * chunk_size : 3 * chunk_size],
            responses[3 * chunk_size :],
        ]

        fatigue_curve = []
        for idx, q_items in enumerate(quartiles, 1):
            if not q_items:
                continue
            acc = sum([1 for r in q_items if r.get("is_correct", False)]) / len(q_items)
            avg_time = sum([r.get("time_taken_seconds", 0) for r in q_items]) / len(
                q_items
            )
            fatigue_curve.append(
                {
                    "quartile": f"Q{idx}",
                    "accuracy_pct": round(acc * 100, 1),
                    "avg_time_sec": round(avg_time, 1),
                }
            )

        q1_acc = fatigue_curve[0]["accuracy_pct"] if fatigue_curve else 0.0
        q4_acc = (
            fatigue_curve[-1]["accuracy_pct"] if len(fatigue_curve) >= 4 else q1_acc
        )
        drop = max(0.0, q1_acc - q4_acc)

        # 5-Tier Finer Stamina / Burnout Risk Boundaries
        if drop > 30.0:
            status = "CRITICAL_BURNOUT_COLLAPSE"
        elif drop > 20.0:
            status = "SIGNIFICANT_STAMINA_DECAY"
        elif drop > 12.0:
            status = "MILD_LATE_SESSION_FATIGUE"
        elif drop > 5.0:
            status = "STABLE_COGNITIVE_STAMINA"
        else:
            status = "SUPERIOR_ENDURANCE_NO_FATIGUE"

        satoi_score = max(0.0, round(100.0 - drop, 1))

        return {
            "satoi_score": satoi_score,
            "accuracy_drop_q1_to_q4_pct": round(drop, 1),
            "cognitive_stamina_status": status,
            "burnout_risk": status,
            "quartile_fatigue_curve": fatigue_curve,
        }
