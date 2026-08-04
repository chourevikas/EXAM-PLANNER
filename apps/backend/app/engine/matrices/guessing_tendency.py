import math
from typing import Dict, List, Any


class GuessingTendencyStrategy:
    TAU_THRESHOLD = 0.35
    BETA = 10.0

    @classmethod
    def compute_item_guessing(
        cls, 
        time_taken_sec: float, 
        expected_time_sec: float, 
        option_closeness: float,
        is_correct: bool,
        irt_difficulty_b: float = 0.0,
        irt_pseudo_guessing_c: float = 0.25
    ) -> float:
        if expected_time_sec <= 0:
            expected_time_sec = 60.0

        tau = time_taken_sec / expected_time_sec
        impulse_term = 1.0 / (1.0 + math.exp(cls.BETA * (tau - cls.TAU_THRESHOLD)))

        if is_correct:
            difficulty_weight = 1.0 / (1.0 + math.exp(1.5 * irt_difficulty_b))
            guessing_factor = irt_pseudo_guessing_c + (1.0 - irt_pseudo_guessing_c) * difficulty_weight
            guessing_prob = impulse_term * guessing_factor
        else:
            closeness_term = 1.0 - max(0.0, option_closeness)
            guessing_prob = impulse_term * closeness_term

        return max(0.0, min(1.0, round(guessing_prob, 4)))

    @classmethod
    def compute_aggregate_gti(cls, item_guessing_scores: List[float]) -> float:
        if not item_guessing_scores:
            return 0.0
        return round(sum(item_guessing_scores) / len(item_guessing_scores), 4)

    @classmethod
    def interpret_gti(cls, gti_value: float) -> Dict[str, Any]:
        if gti_value > 0.65:
            return {
                "category": "IMPULSIVE_BLIND_GUESSING",
                "label": "High Impulsive Risk-Taking",
                "color": "#ef4444",
                "recommendation": "Slow down during test execution. You are taking rapid uncalculated guesses on unfamiliar questions."
            }
        elif gti_value >= 0.30:
            return {
                "category": "TACTICAL_CALCULATED_RISK",
                "label": "Tactical Elimination Risk",
                "color": "#f59e0b",
                "recommendation": "Optimal elimination strategy. Your non-correct attempts stem from high-closeness distractors."
            }
        else:
            return {
                "category": "HIGH_CONFIDENCE_METHODICAL",
                "label": "High Confidence Methodical",
                "color": "#10b981",
                "recommendation": "Strong precision and thorough pacing. High conceptual recall with minimal random guessing."
            }
