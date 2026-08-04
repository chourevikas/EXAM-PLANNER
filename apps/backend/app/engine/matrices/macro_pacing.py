from typing import Dict, List, Any


class ExamMacroTimeStrategy:
    @classmethod
    def evaluate_overall_pacing(
        cls,
        total_time_spent_sec: float,
        total_allocated_minutes: float,
        total_questions: int,
        responses: List[Dict],
    ) -> Dict[str, Any]:
        allocated_sec = total_allocated_minutes * 60.0
        time_ratio = total_time_spent_sec / allocated_sec if allocated_sec > 0 else 1.0
        ideal_time_per_q = (
            allocated_sec / total_questions if total_questions > 0 else 60.0
        )

        n = len(responses)
        first_half = responses[: n // 2] if n > 1 else responses
        second_half = responses[n // 2 :] if n > 1 else responses

        time_first_half = sum([r.get("time_taken_seconds", 0) for r in first_half])
        time_second_half = sum([r.get("time_taken_seconds", 0) for r in second_half])

        skew_ratio = time_second_half / max(1, time_first_half)

        acc_first = sum(
            [1 for r in first_half if r.get("closeness_score_awarded", 0) >= 0.99]
        ) / max(1, len(first_half))
        acc_second = sum(
            [1 for r in second_half if r.get("closeness_score_awarded", 0) >= 0.99]
        ) / max(1, len(second_half))
        fatigue_drop = max(0.0, acc_first - acc_second)

        pacing_status = "BALANCED_PACING"
        if time_ratio < 0.60:
            pacing_status = "EXCESS_UNUSED_TIME_RUSHED"
        elif time_ratio > 1.05:
            pacing_status = "TIME_EXHAUSTION_OVERTHOUGHT"
        elif skew_ratio < 0.60:
            pacing_status = "LATE_EXAM_PANIC_RUSH"
        elif skew_ratio > 1.60:
            pacing_status = "EARLY_BOTTLENECK_OVERTHINK"

        return {
            "total_time_spent_sec": total_time_spent_sec,
            "total_allocated_sec": allocated_sec,
            "time_utilization_pct": round(time_ratio * 100, 1),
            "pacing_status": pacing_status,
            "skew_ratio": round(skew_ratio, 2),
            "fatigue_drop_pct": round(fatigue_drop * 100, 1),
            "ideal_time_per_q_sec": round(ideal_time_per_q, 1),
        }
