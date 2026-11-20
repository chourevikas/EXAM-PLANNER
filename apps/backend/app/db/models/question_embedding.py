from datetime import datetime, timezone
from typing import Optional, List
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Text
from sqlalchemy.dialects.postgresql import TSVECTOR
from pgvector.sqlalchemy import HALFVEC
from app.db.models.types import BigIntPK, DateTimeTZ

# pgvector / tsvector types only exist on PostgreSQL; the SQLite test database stores them as text
_DENSE = HALFVEC(3072).with_variant(Text(), "sqlite")
_LEXICAL = TSVECTOR().with_variant(Text(), "sqlite")


class QuestionEmbedding(SQLModel, table=True):
    """Hybrid search representations for exam questions (dense vectors + BM25-ranked tsvectors)."""

    __tablename__ = "question_embeddings"

    question_id: int = Field(
        foreign_key="questions.id", primary_key=True, ondelete="CASCADE", sa_type=BigIntPK
    )

    # Question Dense Embedding (Gemini Embedding 1, full dim 3072, halfvec)
    question_dense_embedding: Optional[List[float]] = Field(
        default=None, sa_column=Column(_DENSE, nullable=True)
    )

    # Question lexical representation (PostgreSQL tsvector, ranked with BM25)
    question_tsv: Optional[str] = Field(
        default=None, sa_column=Column(_LEXICAL, nullable=True)
    )

    # Legacy: correct-option text embedding. No longer written or searched (short / "1 and 2 only"
    # answers make it noise); the explanation embedding below replaces it.
    answer_dense_embedding: Optional[List[float]] = Field(
        default=None, sa_column=Column(_DENSE, nullable=True)
    )

    # Correct answer lexical representation (PostgreSQL tsvector, ranked with BM25)
    answer_tsv: Optional[str] = Field(
        default=None, sa_column=Column(_LEXICAL, nullable=True)
    )

    # Solution / explanation dense embedding: the answer-side semantic signal
    explanation_dense_embedding: Optional[List[float]] = Field(
        default=None, sa_column=Column(_DENSE, nullable=True)
    )

    # Content hashes for change detection
    question_hash: str = Field(max_length=64, index=True)
    answer_hash: Optional[str] = Field(default=None, max_length=64)
    explanation_hash: Optional[str] = Field(default=None, max_length=64)
    embedding_model: str = Field(default="models/gemini-embedding-001", max_length=50)

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )


class Bm25TermStats(SQLModel, table=True):
    """Document frequency of each lexeme per searchable field (refreshed after vectorization)."""

    __tablename__ = "bm25_term_stats"

    field: str = Field(primary_key=True, max_length=32)
    lexeme: str = Field(primary_key=True, sa_type=Text)
    df: int


class Bm25FieldStats(SQLModel, table=True):
    """Document count and average document length (in tokens) per searchable field."""

    __tablename__ = "bm25_field_stats"

    field: str = Field(primary_key=True, max_length=32)
    n_docs: int
    avg_len: float
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
