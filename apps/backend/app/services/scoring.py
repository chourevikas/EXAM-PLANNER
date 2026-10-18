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
