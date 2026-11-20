"""074_explanation_embedding_and_bm25

Revision ID: 074_explanation_embedding_and_bm25
Revises: 073_add_question_embeddings
Create Date: 2026-11-20 00:00:00.000000

Similar-question search, second iteration:
- `explanation_dense_embedding`: the solution text is embedded instead of the (often one-word or
  "1 and 2 only") correct option text, so the answer side has a meaningful dense signal.
- `bm25_term_stats` / `bm25_field_stats`: corpus statistics (document frequency per lexeme,
  document count and average length per field) so the lexical channels can rank with real BM25
  over the existing tsvector columns. Plain Postgres, no extension needed.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import HALFVEC

revision: str = "074_explanation_embedding_and_bm25"
down_revision: Union[str, None] = "073_add_question_embeddings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c["name"] for c in inspector.get_columns("question_embeddings")}

    if "explanation_dense_embedding" not in columns:
        op.add_column("question_embeddings", sa.Column("explanation_dense_embedding", HALFVEC(3072), nullable=True))
    if "explanation_hash" not in columns:
        op.add_column("question_embeddings", sa.Column("explanation_hash", sa.String(64), nullable=True))
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_qe_expl_dense ON question_embeddings "
        "USING hnsw (explanation_dense_embedding halfvec_cosine_ops);"
    )

    tables = set(inspector.get_table_names())
    if "bm25_term_stats" not in tables:
        op.create_table(
            "bm25_term_stats",
            sa.Column("field", sa.String(32), primary_key=True),
            sa.Column("lexeme", sa.Text(), primary_key=True),
            sa.Column("df", sa.Integer(), nullable=False),
        )
    if "bm25_field_stats" not in tables:
        op.create_table(
            "bm25_field_stats",
            sa.Column("field", sa.String(32), primary_key=True),
            sa.Column("n_docs", sa.Integer(), nullable=False),
            sa.Column("avg_len", sa.Float(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )

    # Seed the statistics from the tsvectors that already exist
    for field, column in (("question", "question_tsv"), ("answer", "answer_tsv")):
        op.execute(f"DELETE FROM bm25_term_stats WHERE field = '{field}'")
        op.execute(
            f"INSERT INTO bm25_term_stats (field, lexeme, df) "
            f"SELECT '{field}', word, ndoc FROM ts_stat('SELECT {column} FROM question_embeddings WHERE {column} IS NOT NULL')"
        )
        op.execute(f"DELETE FROM bm25_field_stats WHERE field = '{field}'")
        op.execute(
            f"""
            INSERT INTO bm25_field_stats (field, n_docs, avg_len, updated_at)
            SELECT '{field}', count(*), coalesce(avg(doc_len), 0), now()
            FROM (
                SELECT (SELECT coalesce(sum(coalesce(array_length(u.positions, 1), 1)), 0)
                        FROM unnest(e.{column}) AS u) AS doc_len
                FROM question_embeddings e
                WHERE e.{column} IS NOT NULL
            ) d
            """
        )


def downgrade() -> None:
    op.drop_table("bm25_field_stats")
    op.drop_table("bm25_term_stats")
    op.execute("DROP INDEX IF EXISTS ix_qe_expl_dense;")
    op.drop_column("question_embeddings", "explanation_hash")
    op.drop_column("question_embeddings", "explanation_dense_embedding")
