"""Canonical subject names for self-rated subject proficiency.

The syllabus taxonomy holds near-duplicate spellings of the same subject ("Art & Culture",
"Arts & Culture", "Arts and Culture"). Ratings are stored under one canonical spelling so every
student's ratings use the same keys. Keep `subject_key` in sync with `subjectKey` in
apps/frontend/src/components/student/SubjectRatingEditor.tsx.
"""
import re

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

# Word variants the taxonomy uses for the same subject ("Science & Tech", "Economics").
WORD_ALIASES = {"tech": "technology", "economic": "economy"}


def _normalise_word(word: str) -> str:
    if len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
        word = word[:-1]
    return WORD_ALIASES.get(word, word)


def subject_key(name: str) -> str:
    """Spelling-insensitive key: case, '&' vs 'and', punctuation and plurals are ignored."""
    text = re.sub(r"[^a-z0-9]+", " ", name.lower().replace("&", " and ")).strip()
    return " ".join(_normalise_word(w) for w in text.split())


async def _known_subject_names(session: AsyncSession) -> list[str]:
    from app.db.models import Subject

    rows = (await session.exec(select(Subject.name).distinct())).all()
    names = {n.strip() for n in rows if n and n.strip()}
    if not names:
        # Same fallback the taxonomy endpoint uses when the database has no subjects.
        from app.schemas.syllabus_literals import SYLLABUS_HIERARCHY

        names = set(SYLLABUS_HIERARCHY)
    return sorted(names)


async def canonicalize_proficiency(session: AsyncSession, ratings: dict[str, int]) -> dict[str, int]:
    """Re-key ratings to the canonical spelling: the alphabetically-first taxonomy variant.

    That is also the spelling the rating editor shows to students with no saved ratings.
    Subjects that aren't in the taxonomy keep the name they were sent with.
    """
    if not ratings:
        return ratings
    canonical: dict[str, str] = {}
    for name in await _known_subject_names(session):
        canonical.setdefault(subject_key(name), name)
    return {canonical.get(subject_key(name), name): rating for name, rating in ratings.items()}
