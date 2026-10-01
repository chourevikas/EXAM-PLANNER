from typing import Dict, List, Any


class ConfidenceCalibrationStrategy:
    """
    Compares the student's self-reported confidence (SURE / FIFTY_FIFTY / GUESS) with the
    actual outcome. Answers whether "sure" answers can be trusted and whether guessing
    earns or loses marks under negative marking.
    """

    LEVELS = ("SURE", "FIFTY_FIFTY", "GUESS")
    MIN_SAMPLE = 3  # answers needed at a level before judging calibration on it

    @classmethod
    def summarize_counts(cls, counts: Dict[str, Dict[str, float]], attempted_count: int) -> Dict[str, Any]:
        """Builds the calibration result from per-level answered / correct / net-mark totals."""
        by_level: Dict[str, Dict[str, Any]] = {}
        for lvl in cls.LEVELS:
            c = counts.get(lvl, {})
            answered = int(c.get("answered", 0))
            correct = int(c.get("correct", 0))
            by_level[lvl] = {
                "answered": answered,
                "correct": correct,
                "wrong": answered - correct,
                "accuracy_pct": round((correct / answered) * 100.0, 1) if answered else None,
                "net_marks": round(float(c.get("net_marks", 0.0)), 2),
            }

        rated = sum(v["answered"] for v in by_level.values())
        sure = by_level["SURE"]
        unsure_answered = by_level["FIFTY_FIFTY"]["answered"] + by_level["GUESS"]["answered"]
        unsure_correct = by_level["FIFTY_FIFTY"]["correct"] + by_level["GUESS"]["correct"]
        unsure_acc = round((unsure_correct / unsure_answered) * 100.0, 1) if unsure_answered else None

        if rated < cls.MIN_SAMPLE:
            status, label = "INSUFFICIENT_DATA", "Not enough answers rated yet"
        elif sure["answered"] >= cls.MIN_SAMPLE and (sure["accuracy_pct"] or 0.0) < 60.0:
            status, label = "OVERCONFIDENT", "Overconfident: many 'sure' answers were wrong"
        elif (
            sure["answered"] >= cls.MIN_SAMPLE
            and unsure_answered >= cls.MIN_SAMPLE
            and unsure_acc is not None
            and unsure_acc >= (sure["accuracy_pct"] or 0.0)
        ):
            status, label = "UNDERCONFIDENT", "Underconfident: unsure answers were as accurate as sure ones"
        elif sure["answered"] >= cls.MIN_SAMPLE and (sure["accuracy_pct"] or 0.0) >= 80.0:
            status, label = "WELL_CALIBRATED", "Well calibrated: your 'sure' answers can be trusted"
        else:
            status, label = "DEVELOPING", "Calibration developing"

        return {
            "rated_count": rated,
            "rating_coverage_pct": round((rated / attempted_count) * 100.0, 1) if attempted_count else 0.0,
            "by_level": by_level,
            "sure_but_wrong_count": sure["wrong"],
            "sure_but_wrong_marks_lost": round(-min(0.0, float(counts.get("SURE", {}).get("wrong_marks", 0.0))), 2),
            "lucky_guess_count": by_level["GUESS"]["correct"],
            "guess_net_marks": by_level["GUESS"]["net_marks"],
            "fifty_fifty_net_marks": by_level["FIFTY_FIFTY"]["net_marks"],
            "calibration_status": status,
            "calibration_label": label,
        }

    @classmethod
    def evaluate(cls, questions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """questions: per-question cards with is_attempted, is_correct, marks_awarded, confidence_level."""
        counts: Dict[str, Dict[str, float]] = {}
        attempted = 0
        for q in questions:
            if not q.get("is_attempted"):
                continue
            attempted += 1
            lvl = str(q.get("confidence_level") or "").upper()
            if lvl not in cls.LEVELS:
                continue
            marks = float(q.get("marks_awarded", 0.0) or 0.0)
            c = counts.setdefault(lvl, {"answered": 0, "correct": 0, "net_marks": 0.0, "wrong_marks": 0.0})
            c["answered"] += 1
            c["net_marks"] += marks
            if q.get("is_correct"):
                c["correct"] += 1
            else:
                c["wrong_marks"] += marks
        return cls.summarize_counts(counts, attempted)
