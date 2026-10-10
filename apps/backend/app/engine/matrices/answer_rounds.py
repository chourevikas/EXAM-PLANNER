from typing import Dict, List, Any


class AnswerRoundStrategy:
    """
    Splits a full exam simulation's answers by the pass they were given in: Round 1 (answered on
    the first visit) vs Round 2 (left unanswered, answered on a later visit). Shows whether coming
    back to skipped questions earns or loses marks.
    """

    ROUNDS = (1, 2)

    @classmethod
    def evaluate(cls, questions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """questions: per-question cards with is_attempted, is_correct, marks_awarded, answer_round."""
        counts: Dict[int, Dict[str, float]] = {r: {"answered": 0, "correct": 0, "net_marks": 0.0} for r in cls.ROUNDS}
        for q in questions:
            if not q.get("is_attempted"):
                continue
            try:
                rnd = int(q.get("answer_round") or 0)
            except (TypeError, ValueError):
                continue
            if rnd not in counts:
                continue
            c = counts[rnd]
            c["answered"] += 1
            c["net_marks"] += float(q.get("marks_awarded", 0.0) or 0.0)
            if q.get("is_correct"):
                c["correct"] += 1

        result: Dict[str, Any] = {}
        for rnd, c in counts.items():
            answered = int(c["answered"])
            correct = int(c["correct"])
            result[f"round_{rnd}"] = {
                "answered": answered,
                "correct": correct,
                "wrong": answered - correct,
                "accuracy_pct": round((correct / answered) * 100.0, 1) if answered else None,
                "net_marks": round(c["net_marks"], 2),
            }
        result["tracked_count"] = result["round_1"]["answered"] + result["round_2"]["answered"]
        return result
