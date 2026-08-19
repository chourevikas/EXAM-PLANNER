"""Compatibility re-export module for subject_litral.py.

Maps to app.schemas.syllabus_literals for backward and alias compatibility.
"""

from app.schemas.syllabus_literals import (
    SubjectLiteral,
    TopicLiteral,
    SubtopicLiteral,
    SYLLABUS_HIERARCHY,
    SUBTOPIC_TO_PARENT_MAP,
    TOPIC_TO_PARENT_MAP,
    get_canonical_parents,
)

__all__ = [
    "SubjectLiteral",
    "TopicLiteral",
    "SubtopicLiteral",
    "SYLLABUS_HIERARCHY",
    "SUBTOPIC_TO_PARENT_MAP",
    "TOPIC_TO_PARENT_MAP",
    "get_canonical_parents",
]
