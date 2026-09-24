"""Controlled vocabularies for the PYQ Knowledge Layer.

Stored as plain strings (VARCHAR) in the database and validated here, so adding a value
never needs a Postgres enum migration.
"""

# Kinds of knowledge node a relationship end or alias can point at
NODE_CONCEPT = "CONCEPT"
NODE_ENTITY = "ENTITY"
NODE_KINDS = frozenset({NODE_CONCEPT, NODE_ENTITY})

# Review state of a concept/entity master row
STATUS_ACTIVE = "ACTIVE"  # curated (seed dictionary or approved)
STATUS_PENDING_REVIEW = "PENDING_REVIEW"  # created on the fly from a question; awaiting curation
NODE_STATUSES = frozenset({STATUS_ACTIVE, STATUS_PENDING_REVIEW})

# Where a question -> node link came from
SOURCE_AUTHORED = "AUTHORED"  # [Concepts: ...] / [Entities: ...] / [Relationships: ...] tags in the PDF
SOURCE_RULE = "RULE"  # deterministic extraction from question / solution text
LINK_SOURCES = frozenset({SOURCE_AUTHORED, SOURCE_RULE})

# Link weight applied to similarity scoring: rule-derived links count for less than authored ones
LINK_WEIGHTS = {SOURCE_AUTHORED: 1.0, SOURCE_RULE: 0.6}

ENTITY_TYPES = frozenset({
    "CONSTITUTION_ARTICLE",
    "ACT",
    "CASE",
    "PERSON",
    "ORGANIZATION",
    "EVENT",
    "MOVEMENT",
    "BOOK",
    "INSTITUTION",
    "PLACE",
    "COMMITTEE",
    "SCHEME",
    "ADMINISTRATIVE_UNIT",
    "OTHER",
})

DEFAULT_RELATION = "related_to"
RELATION_TYPES = frozenset({
    "related_to",
    "part_of",
    "provides_for",
    "prohibits",
    "associated_with",
    "founded_by",
    "written_by",
    "adopted_by",
    "occurred_at",
    "occurred_in",
    "succeeded_by",
    "predecessor_of",
    "resulted_in",
    "compared_with",
    "member_of",
    "officer_of",
    "headed_by",
    "divided_into",
    "translated_by",
})


def normalize_relation(raw: str | None) -> tuple[str, bool]:
    """Maps an authored relation label to the controlled vocabulary.

    Returns (relation, is_known). Unknown labels fall back to `related_to` so the
    relationship is kept, and the caller records the mismatch as an extraction issue.
    """
    if not raw:
        return DEFAULT_RELATION, True
    key = raw.strip().lower().replace("-", "_").replace(" ", "_")
    if key in RELATION_TYPES:
        return key, True
    return DEFAULT_RELATION, False
