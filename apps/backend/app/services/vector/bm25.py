"""BM25 ranking over the tsvector columns of `question_embeddings`, in plain PostgreSQL.

Postgres full-text search (`ts_rank_cd`) has no inverse document frequency, so a word that occurs
in every question ("consider", "statements", "correct") counts as much as a rare, telling one
("Megasthenes"). BM25 fixes that. It needs three numbers per query term, all available here:

- tf  : how often the term occurs in a candidate     -> `unnest(tsvector)` gives each lexeme's positions
- df  : how many questions contain the term           -> `bm25_term_stats` (refreshed after vectorization)
- len : candidate length vs the corpus average         -> positions count / `bm25_field_stats.avg_len`

    score(D, Q) = sum over terms t of Q:
        idf(t) * tf * (k1 + 1) / (tf + k1 * (1 - b + b * len(D) / avg_len))
    idf(t) = ln(1 + (N - df + 0.5) / (df + 0.5))

Candidates are questions sharing at least one query term (an OR tsquery, served by the GIN
index), unlike `plainto_tsquery`, which requires every term to be present.
Stemming and stop words come from the 'english' text-search configuration used to build the tsvectors.
"""
from typing import Dict, List, Optional, Sequence, Tuple

from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config.logger import setup_logger

logger = setup_logger("Bm25Search")

# Searchable field -> tsvector column. Column names are interpolated into SQL, so only these are allowed.
BM25_FIELDS: Dict[str, str] = {
    "question": "question_tsv",
    "answer": "answer_tsv",
}

DEFAULT_K1 = 1.2
DEFAULT_B = 0.75


def _column(field: str) -> str:
    try:
        return BM25_FIELDS[field]
    except KeyError:
        raise ValueError(f"Unknown BM25 field '{field}'. Expected one of {sorted(BM25_FIELDS)}")


async def refresh_bm25_stats(session: AsyncSession, fields: Sequence[str] = tuple(BM25_FIELDS)) -> Dict[str, int]:
    """Recompute document frequencies and average lengths from the current tsvectors.

    A full recompute is cheap (one pass over the table per field), so it simply runs after
    every vectorization batch. Commits on the given session. Returns n_docs per field.
    """
    counts: Dict[str, int] = {}
    for field in fields:
        column = _column(field)
        await session.exec(text("DELETE FROM bm25_term_stats WHERE field = :field"), params={"field": field})
        await session.exec(
            text(
                f"INSERT INTO bm25_term_stats (field, lexeme, df) "
                f"SELECT :field, word, ndoc FROM ts_stat('SELECT {column} FROM question_embeddings WHERE {column} IS NOT NULL')"
            ),
            params={"field": field},
        )
        await session.exec(text("DELETE FROM bm25_field_stats WHERE field = :field"), params={"field": field})
        await session.exec(
            text(
                f"""
                INSERT INTO bm25_field_stats (field, n_docs, avg_len, updated_at)
                SELECT :field, count(*), coalesce(avg(doc_len), 0), now()
                FROM (
                    SELECT (SELECT coalesce(sum(coalesce(array_length(u.positions, 1), 1)), 0)
                            FROM unnest(e.{column}) AS u) AS doc_len
                    FROM question_embeddings e
                    WHERE e.{column} IS NOT NULL
                ) d
                """
            ),
            params={"field": field},
        )
        n_docs = (await session.exec(
            text("SELECT n_docs FROM bm25_field_stats WHERE field = :field"), params={"field": field}
        )).first()
        counts[field] = int(n_docs[0]) if n_docs else 0
    await session.commit()
    logger.info(f"[BM25] Statistics refreshed: {counts}")
    return counts


async def bm25_stats_ready(session: AsyncSession, field: str) -> bool:
    row = (await session.exec(
        text("SELECT n_docs, avg_len FROM bm25_field_stats WHERE field = :field"), params={"field": field}
    )).first()
    return bool(row and row[0] and row[1])


async def bm25_search(
    session: AsyncSession,
    field: str,
    query_text: str,
    exclude_id: int,
    limit: int,
    allowed_ids: Optional[List[int]] = None,
    k1: float = DEFAULT_K1,
    b: float = DEFAULT_B,
) -> List[Tuple[int, float]]:
    """Top `limit` (question_id, bm25_score) for `query_text` against one field, best first.

    `allowed_ids` restricts candidates (e.g. to the same subject); an empty list returns nothing.
    Terms missing from the statistics (added after the last refresh) are treated as rare (df=0).
    """
    column = _column(field)
    if not (query_text or "").strip():
        return []
    if allowed_ids is not None and not allowed_ids:
        return []

    allowed_clause = "AND e.question_id = ANY(:allowed_ids)" if allowed_ids is not None else ""
    sql = text(f"""
        WITH q AS (
            SELECT DISTINCT u.lexeme
            FROM unnest(to_tsvector('english', CAST(:query AS text))) AS u
        ),
        fs AS (
            SELECT CAST(n_docs AS float8) AS n_docs, CAST(avg_len AS float8) AS avg_len
            FROM bm25_field_stats WHERE field = :field AND avg_len > 0
        ),
        idf AS (
            SELECT q.lexeme,
                   ln(1.0 + (fs.n_docs - coalesce(ts.df, 0) + 0.5) / (coalesce(ts.df, 0) + 0.5)) AS idf
            FROM q
            CROSS JOIN fs
            LEFT JOIN bm25_term_stats ts ON ts.field = :field AND ts.lexeme = q.lexeme
        ),
        tsq AS (
            -- OR of the query's lexemes; quoted so no lexeme is re-stemmed or parsed as an operator
            SELECT CAST(string_agg(
                '''' || replace(replace(lexeme, '\\', '\\\\'), '''', '''''') || '''', ' | '
            ) AS tsquery) AS query
            FROM q
        ),
        cand AS (
            SELECT e.question_id, e.{column} AS tsv
            FROM question_embeddings e, tsq
            WHERE e.question_id <> :exclude_id
              AND e.{column} IS NOT NULL
              AND e.{column} @@ tsq.query
              {allowed_clause}
        ),
        tf AS (
            SELECT c.question_id,
                   u.lexeme,
                   coalesce(array_length(u.positions, 1), 1) AS tf,
                   sum(coalesce(array_length(u.positions, 1), 1)) OVER (PARTITION BY c.question_id) AS doc_len
            FROM cand c
            CROSS JOIN LATERAL unnest(c.tsv) AS u
        )
        SELECT tf.question_id,
               sum(
                   idf.idf * tf.tf * (CAST(:k1 AS float8) + 1)
                   / (tf.tf + CAST(:k1 AS float8) * (1 - CAST(:b AS float8) + CAST(:b AS float8) * tf.doc_len / fs.avg_len))
               ) AS score
        FROM tf
        JOIN idf ON idf.lexeme = tf.lexeme
        CROSS JOIN fs
        GROUP BY tf.question_id
        ORDER BY score DESC, tf.question_id
        LIMIT :limit
    """)
    params = {
        "query": query_text,
        "field": field,
        "exclude_id": exclude_id,
        "limit": limit,
        "k1": k1,
        "b": b,
    }
    if allowed_ids is not None:
        params["allowed_ids"] = allowed_ids
    rows = (await session.exec(sql, params=params)).fetchall()
    return [(int(r[0]), float(r[1])) for r in rows]
