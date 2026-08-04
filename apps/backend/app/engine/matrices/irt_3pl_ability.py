import math
from typing import Dict, List, Any


class IRT3PLStrategy:
    @classmethod
    def _prob_3pl(cls, theta: float, a: float, b: float, c: float) -> float:
        val = a * (theta - b)
        val = max(-10.0, min(10.0, val))
        return c + (1.0 - c) / (1.0 + math.exp(-val))

    @classmethod
    def estimate_latent_ability(cls, items_response_data: List[Dict]) -> Dict[str, Any]:
        if not items_response_data:
            return {"latent_ability_theta": 0.0, "percentile_rank": 50.0, "ability_level": "NEEDS_FOUNDATION"}

        theta = 0.0
        max_iterations = 30
        tolerance = 0.001

        for _ in range(max_iterations):
            score_func = -theta
            fisher_info = 1.0

            for item in items_response_data:
                a = max(0.1, item.get('a', 1.5))
                b = item.get('b', 0.0)
                c = max(0.0, min(0.9, item.get('c', 0.25)))
                y = 1.0 if item.get('is_correct') else 0.0

                p = cls._prob_3pl(theta, a, b, c)
                p = max(c + 0.0001, min(0.9999, p))

                p_star = (p - c) / (1.0 - c)
                dp_dtheta = a * (p - c) * (1.0 - p_star)

                score_func += (y - p) * dp_dtheta / (p * (1.0 - p))
                fisher_info += (dp_dtheta ** 2) / (p * (1.0 - p))

            if fisher_info < 1e-6:
                break

            delta = score_func / fisher_info
            theta += delta
            theta = max(-3.5, min(3.5, theta))

            if abs(delta) < tolerance:
                break

        percentile = 0.5 * (1.0 + math.erf(theta / math.sqrt(2.0))) * 100.0

        level = "AVERAGE"
        if theta > 1.5:
            level = "TOP_PERFORMER"
        elif theta > 0.5:
            level = "ABOVE_AVERAGE"
        elif theta < -1.0:
            level = "NEEDS_FOUNDATION"

        return {
            "latent_ability_theta": round(theta, 2),
            "percentile_rank": round(percentile, 1),
            "ability_level": level
        }
