from typing import Dict, Any


class TimeTieredScoringStrategy:
    ALPHA_TIME = 0.25
    GAMMA_PENALTY = 0.50

    @classmethod
    def calculate_score(
        cls,
        is_correct: bool,
        time_taken_sec: float,
        expected_time_sec: float,
        closeness_score: float,
        marks_pos: float = 2.0,
        marks_neg: float = 0.66,
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

        if is_correct:
            if window == "OPTIMAL":
                final_score = marks_pos
            elif window == "OVERTHINKING":
                penalty_ratio = (time_taken_sec - t_max) / expected_time_sec
                adj_factor = max(0.2, 1.0 - (cls.ALPHA_TIME * penalty_ratio))
                final_score = marks_pos * adj_factor
            else:  # IMPULSIVE
                adj_factor = max(0.5, time_taken_sec / t_min)
                final_score = marks_pos * adj_factor
        else:
            if time_taken_sec <= t_max:
                final_score = -marks_neg
            else:
                penalty_ratio = (time_taken_sec - t_max) / expected_time_sec
                multiplier = min(2.5, 1.0 + (cls.GAMMA_PENALTY * penalty_ratio))
                final_score = -marks_neg * multiplier

        closeness_weighted = final_score
        if not is_correct:
            if closeness_score > 0:
                closeness_weighted += closeness_score * marks_pos * 0.25
            elif closeness_score < 0:
                closeness_weighted += closeness_score * marks_neg * 0.35

        return {
            "final_score": round(final_score, 2),
            "closeness_weighted_score": round(closeness_weighted, 2),
            "time_window": window,
            "t_min": round(t_min, 1),
            "t_max": round(t_max, 1),
            "is_correct": is_correct,
        }
