"""Marks per question, from the paper's own marking scheme.

Each question stores its marks and negative marks, set from the exam type when the paper is imported
(UPSC +2 / -2/3, other exams their own). Scores, reports and analytics use these instead of assuming
UPSC for every paper.
"""
from typing import Optional, Tuple

UPSC_MARKS = 2.0
UPSC_NEGATIVE = 2.0 / 3.0


def question_marks(marks: Optional[float], negative_marks: Optional[float]) -> Tuple[float, float]:
    """(marks for a correct answer, marks deducted for a wrong one).

    Negative marks are stored rounded to two decimals, so a third of the marks (UPSC's -2/3, stored
    as 0.66 or 0.67) is read back as exactly one third.
    """
    pos = float(marks) if marks is not None and float(marks) > 0 else UPSC_MARKS
    if negative_marks is None:
        return pos, pos / 3.0
    neg = abs(float(negative_marks))
    if abs(neg - pos / 3.0) < 0.01:
        neg = pos / 3.0
    return pos, neg


def awarded(is_correct: bool, attempted: bool, pos: float, neg: float) -> float:
    """Marks for one answer: +pos when correct, -neg when wrong, 0 when not attempted."""
    if not attempted:
        return 0.0
    return pos if is_correct else -neg


def exam_marking_scheme(exam, exam_type=None) -> Tuple[float, float]:
    """The marks an exam's questions get: the exam's own scheme, else its exam type's, else UPSC's."""
    marks = getattr(exam, "marks_per_question", None) if exam is not None else None
    if marks:
        neg = getattr(exam, "negative_marks_per_question", None)
        return float(marks), float(neg if neg is not None else 0.0)
    if exam_type is not None and getattr(exam_type, "positive_marks", None):
        return float(exam_type.positive_marks), float(exam_type.negative_marks or 0.0)
    return UPSC_MARKS, round(UPSC_MARKS / 3.0, 2)


def validate_marking_scheme(marks: float, negative: float) -> Optional[str]:
    """An error message, or None when the scheme makes sense."""
    if marks is None or marks <= 0 or marks > 100:
        return "Marks for a correct answer must be more than 0 (and at most 100)."
    if negative is None or negative < 0:
        return "Marks deducted for a wrong answer can't be negative (use 0 for no negative marking)."
    if negative > marks:
        return "Marks deducted for a wrong answer can't be more than the marks for a correct one."
    return None
