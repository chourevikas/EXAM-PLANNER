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
        irt_pseudo_guessing_c: float = 0.25,
    ) -> float:
        if expected_time_sec <= 0:
            expected_time_sec = 60.0

        tau = time_taken_sec / expected_time_sec
        impulse_term = 1.0 / (1.0 + math.exp(cls.BETA * (tau - cls.TAU_THRESHOLD)))

        if is_correct:
            difficulty_weight = 1.0 / (1.0 + math.exp(1.5 * irt_difficulty_b))
            guessing_factor = (
                irt_pseudo_guessing_c
                + (1.0 - irt_pseudo_guessing_c) * difficulty_weight
            )
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
        # 5-Tier Finer Risk Boundaries
        if gti_value >= 0.70:
            return {
                "category": "IMPULSIVE_BLIND_GUESSING",
                "label": "Severe Impulsive Guessing",
                "color": "#dc2626",
                "recommendation": "Critical negative mark leakage. Cease guessing on unreviewed questions.",
            }
        elif gti_value >= 0.50:
            return {
                "category": "ELEVATED_IMPULSIVE_RISK",
                "label": "Elevated Impulsive Risk",
                "color": "#ea580c",
                "recommendation": "Frequent premature answering detected. Enforce a minimum 25s reading latency.",
            }
        elif gti_value >= 0.30:
            return {
                "category": "MODERATE_ELIMINATION_GUESSING",
                "label": "Moderate Elimination Guessing",
                "color": "#f59e0b",
                "recommendation": "Calculated guesses on 50:50 questions. Monitor borderline items closely.",
            }
        elif gti_value >= 0.15:
            return {
                "category": "CONTROLLED_CALCULATED_RISK",
                "label": "Controlled / Calculated Risk",
                "color": "#3b82f6",
                "recommendation": "Disciplined risk management. Minimal uncalculated impulse errors.",
            }
        else:
            return {
                "category": "HIGH_CONFIDENCE_METHODICAL",
                "label": "High Confidence Methodical",
                "color": "#10b981",
                "recommendation": "Exceptional cognitive discipline. Questions answered only upon full verification.",
            }
