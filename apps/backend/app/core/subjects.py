"""Subject matching: exact subject names only.

Two questions share a subject only when their subject names are the same after ignoring case,
spacing and "&" vs "and". There is no synonym dictionary and no substring matching, so
"History", "Modern History" and "History & Culture" are three different subjects, as are
"Science & Tech" and "Science & Technology".

Used by similar-question search and by question-list subject filters (practice sessions,
recommendations, exam builder). The same normalization exists three times and must stay identical:
- `normalize_subject`            (Python)
- `subject_sql_expr`             (raw SQL text)
- `subject_norm_column`          (SQLAlchemy expression; portable to SQLite for tests)
- `normalizeSubject` in apps/frontend/src/services/similarQuestionService.ts
They only use lower / replace / trim, so every database computes the same value.
"""
import re
from typing import Any, Optional

# Runs of up to 2**_SPACE_PASSES spaces collapse to one in SQL (plenty for subject names)
_SPACE_PASSES = 4


def normalize_subject(name: Optional[str]) -> str:
    """Lower-case, "&" -> "and", spaces around "/", single spaces, trimmed."""
    if not name:
        return ""
    s = name.lower().replace("&", " and ").replace("/", " / ")
    return re.sub(r" +", " ", s).strip()


def canonical_subject(name: Optional[str]) -> Optional[str]:
    """The normalized subject name used for matching, or None when there is no name."""
    return normalize_subject(name) or None


def same_subject(a: Optional[str], b: Optional[str]) -> bool:
    ka, kb = canonical_subject(a), canonical_subject(b)
    return ka is not None and ka == kb


def subject_sql_expr(column_sql: str) -> str:
    """Raw SQL expression equal to `normalize_subject(column)` (column is a trusted SQL expression)."""
    expr = f"replace(replace(lower(coalesce({column_sql}, '')), '&', ' and '), '/', ' / ')"
    for _ in range(_SPACE_PASSES):
        expr = f"replace({expr}, '  ', ' ')"
    return f"trim({expr})"


def subject_norm_column(column: Any) -> Any:
    """SQLAlchemy expression equal to `normalize_subject(column)`."""
    from sqlalchemy import func

    expr = func.replace(func.replace(func.lower(func.coalesce(column, "")), "&", " and "), "/", " / ")
    for _ in range(_SPACE_PASSES):
        expr = func.replace(expr, "  ", " ")
    return func.trim(expr)
