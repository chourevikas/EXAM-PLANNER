"""Full-text search over question text (all stored languages), for the header search and search practice.

On PostgreSQL, Latin-script queries use the GIN index on to_tsvector('simple', question_text) (migration
069): every word must match, the last ones as prefixes, ranked by ts_rank. Queries in other scripts
(Hindi, Marathi) use a substring match instead, because how the text parser splits Devanagari depends on
the database locale. Other databases (the SQLite test suite) always use the substring match.
"""
import re
from typing import List, Optional, Tuple

from sqlalchemy import func, literal_column
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models.enums import QuestionStatus
from app.db.models.question import Question, QuestionTranslation

MIN_QUERY_LENGTH = 3
_TSQUERY_SPECIAL = re.compile(r"[&|!():*'\\<>]")
_SPLIT = re.compile(r"[\s.,;:!?\"'()\[\]{}<>|&*\\/-]+")


def _tsquery(query: str) -> Optional[str]:
    """'indus valley' -> 'indus:* & valley:*' (every word, as a prefix); None if nothing searchable is left."""
    words = [_TSQUERY_SPECIAL.sub("", w).lower() for w in _SPLIT.split(query)]
    words = [w for w in words if w]
    return " & ".join(f"{w}:*" for w in words) if words else None


async def search_questions(session: AsyncSession, query: str, limit: int = 20) -> List[Tuple[int, str]]:
    """Published questions whose text matches, best first, as (question_id, matching text)."""
    clean = " ".join(query.split())
    if len(clean) < MIN_QUERY_LENGTH:
        return []
    published = col(Question.status) == QuestionStatus.PUBLISHED
    text_col = col(QuestionTranslation.question_text)

    use_fts = session.bind.dialect.name == "postgresql" and clean.isascii()
    tsq = _tsquery(clean) if use_fts else None
    if tsq:
        vector = func.to_tsvector(literal_column("'simple'::regconfig"), text_col)
        tsquery = func.to_tsquery(literal_column("'simple'::regconfig"), tsq)
        rank = func.ts_rank(vector, tsquery)
        stmt = (
            select(QuestionTranslation.question_id, text_col, rank.label("rank"))
            .join(Question, col(Question.id) == col(QuestionTranslation.question_id))
            .where(published, vector.op("@@")(tsquery))
            .order_by(rank.desc(), col(QuestionTranslation.question_id).desc())
            .limit(limit * 3)  # a question can match in several languages
        )
    else:
        escaped = clean.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        stmt = (
            select(QuestionTranslation.question_id, text_col, literal_column("0").label("rank"))
            .join(Question, col(Question.id) == col(QuestionTranslation.question_id))
            .where(published, text_col.ilike(f"%{escaped}%", escape="\\"))
            .order_by(col(QuestionTranslation.question_id).desc())
            .limit(limit * 3)
        )

    seen: dict = {}
    for qid, text, _ in (await session.exec(stmt)).all():
        if qid not in seen:
            seen[qid] = text
        if len(seen) >= limit:
            break
    return list(seen.items())


def snippet(text: str, query: str, width: int = 140) -> str:
    """A one-line excerpt of the question around the first matched word."""
    flat = " ".join((text or "").split())
    if len(flat) <= width:
        return flat
    first = next((w for w in _SPLIT.split(query) if w), "")
    at = flat.lower().find(first.lower()) if first else -1
    start = max(0, min(at - width // 3, len(flat) - width)) if at > 0 else 0
    if start > 0:
        # Begin at a word boundary, so a Hindi/Marathi excerpt never opens on a stray vowel sign
        space = flat.find(" ", start)
        start = space + 1 if 0 <= space < (at if at > start else start + width // 2) else start
    end = start + width
    if end < len(flat):
        space = flat.rfind(" ", start, end)  # end on a word boundary too
        end = space if space > start + width // 2 else end
    out = flat[start:end].strip()
    return ("…" if start > 0 else "") + out + ("…" if end < len(flat) else "")
