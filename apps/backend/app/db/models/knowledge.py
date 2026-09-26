"""PYQ Knowledge Layer: Concepts, Entities and Relationships attached to questions.

An additional retrieval layer on top of the existing Subject / Topic (Microtheme) /
Subtopic (Nano Theme) taxonomy, which it never changes. Enum-like columns are plain
strings validated in app/knowledge/vocabulary.py.
"""
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import SQLModel, Field, Index

from app.db.models.types import BigIntPK, DateTimeTZ


def _now() -> datetime:
    return datetime.now(timezone.utc)


class KnowledgeConcept(SQLModel, table=True):
    """Abstract idea tested by a question, e.g. "Right to Equality", "Sanskrit drama"."""

    __tablename__ = "knowledge_concepts"

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    canonical_name: str = Field(max_length=255)
    normalized_key: str = Field(max_length=255, unique=True, index=True)
    status: str = Field(default="PENDING_REVIEW", max_length=20, index=True)
    created_at: datetime = Field(default_factory=_now, sa_type=DateTimeTZ)


class KnowledgeEntity(SQLModel, table=True):
    """Specific identifiable node reused across questions, e.g. "Article 15", "Government of India Act 1935"."""

    __tablename__ = "knowledge_entities"

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    canonical_name: str = Field(max_length=255)
    normalized_key: str = Field(max_length=255, unique=True, index=True)
    entity_type: str = Field(default="OTHER", max_length=40, index=True)
    parent_entity_id: Optional[int] = Field(
        default=None, foreign_key="knowledge_entities.id", ondelete="SET NULL", index=True,
        description="Broader provision, e.g. Article 15 for Article 15(4)",
    )
    status: str = Field(default="PENDING_REVIEW", max_length=20, index=True)
    created_at: datetime = Field(default_factory=_now, sa_type=DateTimeTZ)


class KnowledgeAlias(SQLModel, table=True):
    """Alternative spelling of a concept/entity. The unique key guarantees an alias resolves to exactly one node."""

    __tablename__ = "knowledge_aliases"
    __table_args__ = (Index("ix_k_alias_node", "node_kind", "node_id"),)

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    normalized_alias: str = Field(max_length=255, unique=True, index=True)
    alias_text: str = Field(max_length=255)
    node_kind: str = Field(max_length=10)  # CONCEPT | ENTITY
    node_id: int = Field(sa_type=BigIntPK)


class QuestionConcept(SQLModel, table=True):
    __tablename__ = "question_concepts"
    __table_args__ = (Index("ix_qc_question_concept", "question_id", "concept_id", unique=True),)

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    question_id: int = Field(foreign_key="questions.id", ondelete="CASCADE", index=True)
    concept_id: int = Field(foreign_key="knowledge_concepts.id", ondelete="CASCADE", index=True)
    weight: float = Field(default=1.0)
    source: str = Field(default="AUTHORED", max_length=20)  # AUTHORED | RULE


class QuestionEntity(SQLModel, table=True):
    __tablename__ = "question_entities"
    __table_args__ = (Index("ix_qe_question_entity", "question_id", "entity_id", unique=True),)

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    question_id: int = Field(foreign_key="questions.id", ondelete="CASCADE", index=True)
    entity_id: int = Field(foreign_key="knowledge_entities.id", ondelete="CASCADE", index=True)
    relevance: float = Field(default=1.0)
    source: str = Field(default="AUTHORED", max_length=20)  # AUTHORED | RULE


class KnowledgeRelationship(SQLModel, table=True):
    """Directed connection between two concepts/entities, e.g. Article 15(4) -provides_for-> Special Provisions."""

    __tablename__ = "knowledge_relationships"
    __table_args__ = (
        Index(
            "ix_kr_edge", "source_kind", "source_id", "relation_type", "target_kind", "target_id", unique=True
        ),
        Index("ix_kr_source", "source_kind", "source_id"),
        Index("ix_kr_target", "target_kind", "target_id"),
    )

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    source_kind: str = Field(max_length=10)
    source_id: int = Field(sa_type=BigIntPK)
    relation_type: str = Field(max_length=40)
    target_kind: str = Field(max_length=10)
    target_id: int = Field(sa_type=BigIntPK)
    confidence: float = Field(default=1.0)
    source_question_id: Optional[int] = Field(
        default=None, foreign_key="questions.id", ondelete="SET NULL",
        description="Question the relationship was first authored on",
    )
    created_at: datetime = Field(default_factory=_now, sa_type=DateTimeTZ)


class QuestionRelationship(SQLModel, table=True):
    __tablename__ = "question_relationships"
    __table_args__ = (Index("ix_qr_question_relationship", "question_id", "relationship_id", unique=True),)

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    question_id: int = Field(foreign_key="questions.id", ondelete="CASCADE", index=True)
    relationship_id: int = Field(foreign_key="knowledge_relationships.id", ondelete="CASCADE", index=True)
