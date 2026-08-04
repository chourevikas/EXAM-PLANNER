import math
from datetime import datetime, timedelta, timezone
from typing import Dict, Any


class FSRSEngine:
    W8 = 0.50
    W9 = 0.15
    W10 = 0.40

    @classmethod
    def calculate_retrievability(cls, elapsed_days: float, stability: float) -> float:
        stability = max(0.1, stability)
        elapsed_days = max(0.0, elapsed_days)
        r = (1.0 + (elapsed_days / (9.0 * stability))) ** (-1.0)
        return max(0.0, min(1.0, r))

    @classmethod
    def update_memory_state(
        cls, 
        current_difficulty: float, 
        current_stability: float,
        elapsed_days: float, 
        grade: int
    ) -> Dict[str, Any]:
        r_current = cls.calculate_retrievability(elapsed_days, current_stability)

        delta_d = -0.3 * (grade - 3)
        new_difficulty = max(1.0, min(10.0, current_difficulty + delta_d))

        w_g_map = {1: 0.2, 2: 0.6, 3: 1.0, 4: 1.4}
        w_g = w_g_map.get(grade, 1.0)

        if grade == 1:
            new_stability = max(0.1, current_stability * 0.4)
        else:
            if elapsed_days < 0.05:
                growth = 0.10 * w_g * (current_stability ** (-cls.W9))
            else:
                growth = (
                    math.exp(cls.W8) 
                    * (11.0 - new_difficulty) 
                    * (current_stability ** (-cls.W9)) 
                    * (math.exp(cls.W10 * (1.0 - r_current)) - 1.0) 
                    * w_g
                )
            new_stability = current_stability * (1.0 + max(0.01, growth))

        new_stability = max(0.1, round(new_stability, 2))
        new_difficulty = round(new_difficulty, 2)

        r_target = 0.85
        days_until_next = 9.0 * new_stability * ((1.0 / r_target) - 1.0)
        days_until_next = max(0.5, round(days_until_next, 1))

        now = datetime.utcnow()
        next_review_dt = now + timedelta(days=days_until_next)

        return {
            "fsrs_difficulty": new_difficulty,
            "fsrs_stability": new_stability,
            "fsrs_retrievability": 1.0,
            "reviewed_retrievability": round(r_current, 4),
            "days_until_next_review": days_until_next,
            "last_reviewed_at": now.isoformat(),
            "next_scheduled_review": next_review_dt.isoformat()
        }
