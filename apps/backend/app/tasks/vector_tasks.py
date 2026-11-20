"""
Background task for vectorizing exam questions into the 4-channel representation
(Question dense, Question lexical, Answer dense, Answer lexical) after PDF extraction.
"""
import asyncio
from app.config.logger import setup_logger
from app.tasks.celery_app import celery_app

logger = setup_logger("VectorizationTasks")


@celery_app.task(name="vectorize_exam_questions_task")
def vectorize_exam_questions_task(exam_id_str: str):
    """Celery entry point for vectorizing questions of one exam."""
    return asyncio.run(async_vectorize_exam(exam_id_str))


async def async_vectorize_exam(exam_id_str: str) -> dict:
    from app.scripts.backfill_question_embeddings import (
        fetch_question_candidates,
        process_batch,
        refresh_bm25_statistics,
    )
    from app.services.vector.gemini_embedder import GeminiEmbedder

    exam_id = int(exam_id_str)
    try:
        logger.info(f"🚀 Starting background 4-channel vectorization for Exam #{exam_id}...")
        candidates = await fetch_question_candidates(exam_id=exam_id)
        to_process = [c for c in candidates if not c.get("is_uptodate")]

        if not to_process:
            logger.info(f"All questions for Exam #{exam_id} already vectorized.")
            return {"exam_id": exam_id, "vectorized": 0, "status": "UP_TO_DATE"}

        embedder = GeminiEmbedder()
        saved = await process_batch(to_process, embedder, concurrency=8)
        logger.info(f"✅ Successfully vectorized {saved}/{len(to_process)} questions for Exam #{exam_id}.")
        # New questions change document frequencies and average lengths for BM25
        await refresh_bm25_statistics()
        return {"exam_id": exam_id, "vectorized": saved, "status": "SUCCESS"}
    except Exception as err:
        logger.error(f"❌ Error vectorizing questions for Exam #{exam_id}: {err}", exc_info=True)
        return {"exam_id": exam_id, "error": str(err), "status": "FAILED"}


def dispatch_exam_vectorization(exam_id: int, log=logger) -> None:
    """Queue vectorization on a Celery worker when running, otherwise as an asyncio background task."""
    try:
        from app.tasks.celery_app import has_active_celery_workers

        if has_active_celery_workers():
            vectorize_exam_questions_task.delay(str(exam_id))
            log.info(f"🧠 Dispatched 4-channel vectorization to Celery for Exam #{exam_id}.")
        else:
            asyncio.create_task(async_vectorize_exam(str(exam_id)))
            log.info(f"🧠 Dispatched 4-channel vectorization via asyncio for Exam #{exam_id}.")
    except Exception as err:
        log.warning(f"Could not trigger vectorization for Exam #{exam_id}: {err}")

