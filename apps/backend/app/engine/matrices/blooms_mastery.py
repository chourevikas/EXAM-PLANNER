from typing import Dict, List


class BloomsMasteryStrategy:
    @classmethod
    def evaluate_blooms(cls, questions_with_responses: List[Dict]) -> Dict[str, float]:
        levels = {
            "REMEMBER": [],
            "UNDERSTAND": [],
            "APPLY": [],
            "ANALYZE": [],
            "EVALUATE": [],
        }
        for item in questions_with_responses:
            blooms = item.get("blooms_level", "ANALYZE").upper()
            if blooms not in levels:
                levels[blooms] = []
            is_corr = item.get("is_correct", False)
            levels[blooms].append(1.0 if is_corr else 0.0)

        mastery = {}
        for lvl, scores in levels.items():
            if scores:
                mastery[lvl] = round((sum(scores) / len(scores)) * 100, 1)
            else:
                mastery[lvl] = 0.0

        return mastery
