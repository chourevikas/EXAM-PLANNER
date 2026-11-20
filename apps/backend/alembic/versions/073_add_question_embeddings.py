"""073_add_question_embeddings

Revision ID: 073_add_question_embeddings
Revises: 072_user_feedback
Create Date: 2026-11-03 00:00:00.000000

4-Channel Hybrid Similarity Search table with pgvector HNSW indexes and tsvector GIN indexes.
Full 3072 dimensions using pgvector HALFVEC.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import TSVECTOR
from pgvector.sqlalchemy import HALFVEC

revision: str = "073_add_question_embeddings"
down_revision: Union[str, None] = "072_user_feedback"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TS = sa.DateTime(timezone=True)
NOW = sa.text("CURRENT_TIMESTAMP")


def upgrade() -> None:
    # 1. Ensure pgvector extension exists
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())

    if "question_embeddings" not in tables:
        op.create_table(
            "question_embeddings",
            sa.Column(
                "question_id",
                sa.BigInteger(),
                sa.ForeignKey("questions.id", ondelete="CASCADE"),
                primary_key=True,
            ),
            sa.Column("question_dense_embedding", HALFVEC(3072), nullable=True),
            sa.Column("question_tsv", TSVECTOR, nullable=True),
            sa.Column("answer_dense_embedding", HALFVEC(3072), nullable=True),
            sa.Column("answer_tsv", TSVECTOR, nullable=True),
            sa.Column("question_hash", sa.String(64), nullable=False),
            sa.Column("answer_hash", sa.String(64), nullable=True),
            sa.Column(
                "embedding_model",
                sa.String(50),
                nullable=False,
                server_default="models/gemini-embedding-001",
            ),
            sa.Column("created_at", TS, nullable=False, server_default=NOW),
            sa.Column("updated_at", TS, nullable=False, server_default=NOW),
        )

        # 2. Create the 4 dedicated indexes for independent retrieval channels
        # Channel 1: Question Dense (HNSW cosine on halfvec 3072)
        op.execute(
            "CREATE INDEX IF NOT EXISTS ix_qe_q_dense ON question_embeddings USING hnsw (question_dense_embedding halfvec_cosine_ops);"
        )
        # Channel 2: Question Lexical (GIN tsvector)
        op.execute(
            "CREATE INDEX IF NOT EXISTS ix_qe_q_tsv ON question_embeddings USING gin (question_tsv);"
        )
        # Channel 3: Answer Dense (HNSW cosine on halfvec 3072)
        op.execute(
            "CREATE INDEX IF NOT EXISTS ix_qe_ans_dense ON question_embeddings USING hnsw (answer_dense_embedding halfvec_cosine_ops);"
        )
        # Channel 4: Answer Lexical (GIN tsvector)
        op.execute(
            "CREATE INDEX IF NOT EXISTS ix_qe_ans_tsv ON question_embeddings USING gin (answer_tsv);"
        )
        # Index on question_hash for fast change checks
        op.create_index("ix_qe_q_hash", "question_embeddings", ["question_hash"])


def downgrade() -> None:
    op.drop_table("question_embeddings")
