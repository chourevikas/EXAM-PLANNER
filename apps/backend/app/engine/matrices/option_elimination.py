from typing import Dict, List, Any


class OptionEliminationStrategy:
    @classmethod
    def evaluate_elimination(cls, responses: List[Dict]) -> Dict[str, Any]:
        if not responses:
            return {"oeei_score": 0.0, "elimination_rating": "NEUTRAL"}

        tactical_choices = 0
        blind_mistakes = 0

        for r in responses:
            closeness = r.get("closeness_score_awarded", 0.0)
            if closeness >= 0.33:
                tactical_choices += 1
            elif closeness < 0.0:
                blind_mistakes += 1

        oeei = tactical_choices / len(responses)

        rating = "EXCELLENT_TACTICAL_ELIMINATION"
        if oeei < 0.40:
            rating = "VULNERABLE_TO_STATEMENT_TRAPS"
        elif oeei < 0.70:
            rating = "MODERATE_ELIMINATION_PRECISION"

        return {
            "oeei_score": round(oeei, 2),
            "tactical_eliminations_pct": round((tactical_choices / len(responses)) * 100, 1),
            "blind_mistakes_pct": round((blind_mistakes / len(responses)) * 100, 1),
            "elimination_rating": rating
        }
