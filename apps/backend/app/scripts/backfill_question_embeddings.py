"""
Backfill script for the hybrid similar-question search representations.

Per question it stores:
1. Question dense embedding      (Gemini, question text)
2. Question tsvector             (PostgreSQL 'english' full text, ranked with BM25)
3. Correct answer tsvector       (PostgreSQL 'english' full text, ranked with BM25)
4. Explanation dense embedding   (Gemini, English solution text)
and then refreshes the BM25 corpus statistics.

Only what changed is re-embedded: the question vector when the question text changes, the explanation
vector when the solution changes. The correct-option text is no longer embedded (one-word and
"1 and 2 only" answers made that vector noise); it is still indexed for BM25.

Usage:
  # Dry run (inspect how many questions need embedding)
  python -m app.scripts.backfill_question_embeddings --dry-run

  # Vectorize first 10 questions for testing
  python -m app.scripts.backfill_question_embeddings --limit 10

  # Vectorize all questions
  python -m app.scripts.backfill_question_embeddings --all

  # Vectorize a specific exam
  python -m app.scripts.backfill_question_embeddings --exam-id 12

  # Only recompute BM25 statistics
  python -m app.scripts.backfill_question_embeddings --refresh-bm25-only
"""
import sys
import argparse
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional

# Ensure apps/backend is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from sqlalchemy import text
from sqlmodel import select
from app.db.session import async_session_factory
from app.db.models.question import Question, QuestionTranslation, QuestionOption, OptionTranslation
from app.db.models.explanation import QuestionExplanation
from app.db.models.enums import LanguageCode
from app.services.vector.gemini_embedder import GeminiEmbedder, compute_sha256
from app.services.vector.bm25 import refresh_bm25_stats
from app.config.logger import setup_logger
from app.config.settings import get_settings

logger = setup_logger("BackfillQuestionEmbeddings")

# gemini-embedding-001 accepts ~2048 tokens; solutions are a paragraph or two, this only guards outliers
MAX_EXPLANATION_CHARS = 8000


def explanation_text_for_embedding(solution: Optional[str]) -> Optional[str]:
    clean = (solution or "").strip()
    return clean[:MAX_EXPLANATION_CHARS] if clean else None


async def fetch_question_candidates(
    exam_id: Optional[int] = None,
    limit: Optional[int] = None,
    force: bool = False,
) -> List[Dict[str, Any]]:
    """Fetch questions with their English stem, correct answer and solution, plus what needs (re)embedding."""
    async with async_session_factory() as session:
        # 1. Fetch questions
        stmt = select(Question.id, Question.exam_id).order_by(Question.id)
        if exam_id:
            stmt = stmt.where(Question.exam_id == exam_id)
        if limit:
            stmt = stmt.limit(limit)

        q_rows = (await session.exec(stmt)).all()
        q_ids = [r[0] for r in q_rows]
        if not q_ids:
            return []

        # 2. Fetch question texts (prefer English)
        trans_stmt = select(
            QuestionTranslation.question_id,
            QuestionTranslation.language,
            QuestionTranslation.question_text,
        ).where(QuestionTranslation.question_id.in_(q_ids))
        trans_rows = (await session.exec(trans_stmt)).all()

        q_texts: Dict[int, str] = {}
        for qid, lang, txt in trans_rows:
            if qid not in q_texts or lang == LanguageCode.ENGLISH:
                q_texts[qid] = txt

        # 3. Fetch correct answer texts (options with is_correct = True)
        opt_stmt = (
            select(
                QuestionOption.question_id,
                QuestionOption.id,
                OptionTranslation.language,
                OptionTranslation.option_text,
            )
            .join(OptionTranslation, OptionTranslation.option_id == QuestionOption.id)
            .where(
                QuestionOption.question_id.in_(q_ids),
                QuestionOption.is_correct.is_(True),
            )
        )
        opt_rows = (await session.exec(opt_stmt)).all()

        ans_texts: Dict[int, str] = {}
        for qid, opt_id, lang, txt in opt_rows:
            if qid not in ans_texts or lang == LanguageCode.ENGLISH:
                ans_texts[qid] = txt

        # 4. Fetch solution texts (prefer English)
        expl_rows = (await session.exec(
            select(QuestionExplanation.question_id, QuestionExplanation.language, QuestionExplanation.detailed_solution)
            .where(QuestionExplanation.question_id.in_(q_ids))
        )).all()
        expl_texts: Dict[int, str] = {}
        for qid, lang, txt in expl_rows:
            if txt and (qid not in expl_texts or lang == LanguageCode.ENGLISH):
                expl_texts[qid] = txt

        # 5. Check existing embeddings and hashes
        existing_res = await session.exec(
            text("""
                SELECT question_id, question_hash, answer_hash, explanation_hash,
                       question_dense_embedding IS NOT NULL,
                       explanation_dense_embedding IS NOT NULL
                FROM question_embeddings WHERE question_id = ANY(:qids)
            """),
            params={"qids": q_ids},
        )
        existing = {row[0]: row[1:] for row in existing_res.fetchall()}

        candidates = []
        for qid in q_ids:
            q_txt = q_texts.get(qid, "").strip()
            ans_txt = ans_texts.get(qid, "").strip() if ans_texts.get(qid) else None
            expl_txt = explanation_text_for_embedding(expl_texts.get(qid))
            q_hash = compute_sha256(q_txt)
            ans_hash = compute_sha256(ans_txt)
            expl_hash = compute_sha256(expl_txt)

            ex = existing.get(qid)
            if ex:
                ex_q_hash, ex_ans_hash, ex_expl_hash, has_q_vec, has_expl_vec = ex
                embed_question = force or ex_q_hash != q_hash or not has_q_vec
                embed_explanation = force or ex_expl_hash != expl_hash or (bool(expl_txt) and not has_expl_vec)
                is_uptodate = not embed_question and not embed_explanation and ex_ans_hash == ans_hash
            else:
                embed_question = embed_explanation = True
                is_uptodate = False

            candidates.append({
                "question_id": qid,
                "question_text": q_txt,
                "answer_text": ans_txt,
                "explanation_text": expl_txt,
                "question_hash": q_hash,
                "answer_hash": ans_hash,
                "explanation_hash": expl_hash,
                "embed_question": embed_question,
                "embed_explanation": embed_explanation,
                "is_uptodate": is_uptodate,
            })

        return candidates


_UPSERT_SQL = text("""
    INSERT INTO question_embeddings (
        question_id,
        question_dense_embedding,
        question_tsv,
        answer_tsv,
        explanation_dense_embedding,
        question_hash,
        answer_hash,
        explanation_hash,
        embedding_model,
        updated_at
    ) VALUES (
        :qid,
        CAST(:q_vec AS halfvec),
        to_tsvector('english', coalesce(CAST(:q_txt AS text), '')),
        CASE WHEN CAST(:ans_txt AS text) IS NOT NULL AND length(CAST(:ans_txt AS text)) > 0
             THEN to_tsvector('english', CAST(:ans_txt AS text))
             ELSE NULL
        END,
        CAST(:expl_vec AS halfvec),
        :q_hash,
        :ans_hash,
        :expl_hash,
        :model,
        NOW()
    )
    ON CONFLICT (question_id) DO UPDATE SET
        question_dense_embedding = CASE WHEN CAST(:set_q AS boolean)
            THEN EXCLUDED.question_dense_embedding ELSE question_embeddings.question_dense_embedding END,
        question_hash = CASE WHEN CAST(:set_q AS boolean)
            THEN EXCLUDED.question_hash ELSE question_embeddings.question_hash END,
        explanation_dense_embedding = CASE WHEN CAST(:set_expl AS boolean)
            THEN EXCLUDED.explanation_dense_embedding ELSE question_embeddings.explanation_dense_embedding END,
        explanation_hash = CASE WHEN CAST(:set_expl AS boolean)
            THEN EXCLUDED.explanation_hash ELSE question_embeddings.explanation_hash END,
        question_tsv = EXCLUDED.question_tsv,
        answer_tsv = EXCLUDED.answer_tsv,
        answer_hash = EXCLUDED.answer_hash,
        embedding_model = EXCLUDED.embedding_model,
        updated_at = NOW();
""")


def _vec_str(vec: Optional[List[float]]) -> Optional[str]:
    return f"[{','.join(str(x) for x in vec)}]" if vec else None


async def process_batch(
    batch: List[Dict[str, Any]],
    embedder: GeminiEmbedder,
    concurrency: int = 8,
) -> int:
    """Embed what changed in a batch (question and/or solution) and upsert into question_embeddings."""
    semaphore = asyncio.Semaphore(concurrency)

    async def _embed_single(text_val: Optional[str]) -> Optional[List[float]]:
        if not text_val:
            return None
        async with semaphore:
            return await embedder.embed_text(text_val)

    async def _skip() -> None:
        return None

    q_tasks = [_embed_single(item["question_text"]) if item.get("embed_question", True) else _skip() for item in batch]
    expl_tasks = [
        _embed_single(item.get("explanation_text")) if item.get("embed_explanation", True) else _skip()
        for item in batch
    ]
    q_vectors, expl_vectors = await asyncio.gather(asyncio.gather(*q_tasks), asyncio.gather(*expl_tasks))

    model_name = embedder.model
    saved = 0
    async with async_session_factory() as session:
        for item, q_vec, expl_vec in zip(batch, q_vectors, expl_vectors):
            set_q = bool(item.get("embed_question", True))
            set_expl = bool(item.get("embed_explanation", True))
            if set_q and not q_vec:
                logger.warning(f"Skipping Q#{item['question_id']}: failed to generate question vector.")
                continue
            if set_expl and item.get("explanation_text") and not expl_vec:
                # Keep the previous solution vector and hash, so the next run retries it
                logger.warning(f"Q#{item['question_id']}: failed to embed the solution; will retry next run.")
                set_expl = False

            await session.exec(
                _UPSERT_SQL,
                params={
                    "qid": item["question_id"],
                    "q_vec": _vec_str(q_vec),
                    "q_txt": item["question_text"],
                    "ans_txt": item["answer_text"],
                    "expl_vec": _vec_str(expl_vec),
                    "q_hash": item["question_hash"],
                    "ans_hash": item["answer_hash"],
                    "expl_hash": item.get("explanation_hash") if set_expl else None,
                    "set_q": set_q,
                    "set_expl": set_expl,
                    "model": model_name,
                },
            )
            saved += 1

        await session.commit()
    return saved


async def refresh_bm25_statistics() -> Dict[str, int]:
    async with async_session_factory() as session:
        return await refresh_bm25_stats(session)


async def main():
    parser = argparse.ArgumentParser(description="Backfill hybrid similar-question search representations")
    parser.add_argument("--all", action="store_true", help="Process all questions in the database")
    parser.add_argument("--exam-id", type=int, default=None, help="Process questions for a specific exam ID")
    parser.add_argument("--limit", type=int, default=None, help="Process at most N questions")
    parser.add_argument("--batch-size", type=int, default=10, help="Questions per batch (default: 10)")
    parser.add_argument("--concurrency", type=int, default=8, help="Concurrent normal API embed calls (default: 8)")
    parser.add_argument("--force", action="store_true", help="Force re-embedding even if content is unchanged")
    parser.add_argument("--dry-run", action="store_true", help="Show summary without making API calls or writing to DB")
    parser.add_argument("--refresh-bm25-only", action="store_true", help="Only recompute BM25 statistics")

    args = parser.parse_args()

    if args.refresh_bm25_only:
        print(f"BM25 statistics refreshed: {await refresh_bm25_statistics()}")
        return

    settings = get_settings()
    if not settings.GEMINI_API_KEY and not args.dry_run:
        print("ERROR: GEMINI_API_KEY is not set in .env. Exiting.")
        sys.exit(1)

    print(f"Connecting to database to analyze questions (exam_id={args.exam_id}, limit={args.limit})...")
    candidates = await fetch_question_candidates(exam_id=args.exam_id, limit=args.limit, force=args.force)

    if not candidates:
        print("No questions found matching criteria.")
        return

    to_process = [c for c in candidates if not c["is_uptodate"]]
    already_done = len(candidates) - len(to_process)
    q_embeds = sum(1 for c in to_process if c["embed_question"] and c["question_text"])
    expl_embeds = sum(1 for c in to_process if c["embed_explanation"] and c["explanation_text"])

    print("\n--- Hybrid Search Vectorization Analysis ---")
    print(f"Total Questions Found      : {len(candidates)}")
    print(f"Up to date                 : {already_done} (skipped)")
    print(f"To update                  : {len(to_process)}")
    print(f"  question embeddings      : {q_embeds}")
    print(f"  solution embeddings      : {expl_embeds}")
    print(f"Embedding Model            : {settings.GEMINI_EMBEDDING_MODEL} (dim={settings.GEMINI_EMBEDDING_DIM})")
    print("--------------------------------------------\n")

    if args.dry_run:
        print("[dry-run] No changes made.")
        return

    total_saved = 0
    if to_process:
        embedder = GeminiEmbedder()
        batch_size = args.batch_size
        print(f"Starting vectorization of {len(to_process)} questions in batches of {batch_size} (concurrency={args.concurrency})...\n")

        for i in range(0, len(to_process), batch_size):
            batch = to_process[i : i + batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (len(to_process) + batch_size - 1) // batch_size

            print(f"Processing Batch {batch_num}/{total_batches} ({len(batch)} questions: Q#{batch[0]['question_id']}..Q#{batch[-1]['question_id']})...")
            saved = await process_batch(batch, embedder, concurrency=args.concurrency)
            total_saved += saved
            print(f"  --> Saved {saved}/{len(batch)} questions in batch {batch_num}.\n")
    else:
        print("All questions are already up-to-date.")

    print(f"BM25 statistics refreshed: {await refresh_bm25_statistics()}")
    print(f"\nDONE: stored {total_saved} question representations into question_embeddings.")


if __name__ == "__main__":
    asyncio.run(main())
