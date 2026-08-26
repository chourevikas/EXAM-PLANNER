from typing import Dict, List, Any


class BloomsMasteryStrategy:
    @classmethod
    def evaluate_blooms(cls, questions_with_responses: List[Dict]) -> Dict[str, Any]:
        levels = {
            "REMEMBER": [],
            "UNDERSTAND": [],
            "APPLY": [],
            "ANALYZE": [],
            "EVALUATE": [],
        }
        for item in questions_with_responses:
            b_val = str(item.get("blooms_level") or "ANALYZE").upper()
            if b_val not in levels:
                levels[b_val] = []
            
            # Check if attempted
            is_att = item.get("selected_option_id") is not None or item.get("user_selected_option") not in ("Unattempted", None)
            if is_att:
                is_corr = bool(item.get("is_correct", False))
                levels[b_val].append(1.0 if is_corr else 0.0)

        mastery = {}
        for lvl, scores in levels.items():
            if scores:
                mastery[lvl] = round((sum(scores) / len(scores)) * 100.0, 1)
            else:
                mastery[lvl] = 0.0

        mastery["fact_recall_accuracy"] = mastery.get("REMEMBER", 0.0)
        mastery["conceptual_analysis_accuracy"] = mastery.get("ANALYZE", 0.0)
        mastery["critical_evaluation_accuracy"] = mastery.get("EVALUATE", 0.0)
        mastery["understanding_accuracy"] = mastery.get("UNDERSTAND", 0.0)
        mastery["application_accuracy"] = mastery.get("APPLY", 0.0)

        return mastery
