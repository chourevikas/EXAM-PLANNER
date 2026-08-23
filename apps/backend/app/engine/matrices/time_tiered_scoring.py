from typing import Dict, Any


class TimeTieredScoringStrategy:
    @classmethod
    def calculate_score(
        cls,
        is_correct: bool,
        time_taken_sec: float,
        expected_time_sec: float,
        closeness_score: float,
        marks_pos: float = 2.0,
        marks_neg: float = 0.6667,
    ) -> Dict[str, Any]:
        if expected_time_sec <= 0:
            expected_time_sec = 60.0

        t_min = 0.4 * expected_time_sec
        t_max = 1.2 * expected_time_sec

        window = "OPTIMAL"
        if time_taken_sec < t_min:
            window = "IMPULSIVE"
        elif time_taken_sec > t_max:
            window = "OVERTHINKING"

        # Standard UPSC Objective Scoring: +2.00 for correct, -0.67 for incorrect
        standard_score = float(marks_pos) if is_correct else -float(marks_neg)

        # Diagnostic closeness weighted score for psychometric modeling
        closeness_weighted = standard_score
        if not is_correct:
            if closeness_score > 0:
                closeness_weighted += closeness_score * marks_pos * 0.25
            elif closeness_score < 0:
                closeness_weighted += closeness_score * marks_neg * 0.35

        return {
            "final_score": round(standard_score, 2),
            "standard_score": round(standard_score, 2),
            "closeness_weighted_score": round(closeness_weighted, 2),
            "time_window": window,
            "t_min": round(t_min, 1),
            "t_max": round(t_max, 1),
            "is_correct": is_correct,
        }
