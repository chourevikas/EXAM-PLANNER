"""Knowledge Layer enrichment, run in the background after an exam's extraction completes.

Never blocks or fails extraction: questions are already stored when this runs, and any error
only marks the KNOWLEDGE_ENRICHMENT pipeline run FAILED.
"""
import asyncio

from app.config.logger import setup_logger
from app.db.session import async_session_factory, managed_async_session
from app.tasks.celery_app import celery_app

logger = setup_logger("KnowledgeEnrichmentTask")
PIPELINE_TYPE = "KNOWLEDGE_ENRICHMENT"


@celery_app.task(name="enrich_exam_knowledge_task")
def enrich_exam_knowledge_task(exam_id_str: str):
    """Celery entry point for Knowledge Layer enrichment of one exam."""
    return asyncio.run(async_enrich_exam(exam_id_str))


async def _set_status(exam_id: int, status: str, step: str, progress: float, error: str | None = None) -> None:
    from app.services.pipeline_management_service import PipelineManagementService

    async with managed_async_session() as session:
        await PipelineManagementService(session).update_pipeline_status(
            exam_id=exam_id, pipeline_type=PIPELINE_TYPE, status=status,
            current_step=step, progress_percent=progress, error_log=error,
        )


async def async_enrich_exam(exam_id_str: str) -> dict:
    from app.cache import get_cache, build_cache_key
    from app.knowledge.enrichment_service import KnowledgeEnrichmentService

    exam_id = int(exam_id_str)
    try:
        await _set_status(exam_id, "RUNNING", "Extracting concepts, entities and relationships", 5.0)
        results = await KnowledgeEnrichmentService(async_session_factory).enrich_exam(exam_id)
        failed = [r for r in results if any(i.startswith("ENRICHMENT_FAILED") for i in r.issues)]
        summary = {
            "questions": len(results),
            "with_knowledge": sum(1 for r in results if r.entities or r.concepts),
            "failed": len(failed),
        }
        await get_cache().delete_pattern(f"{build_cache_key('questions:similar')}*")
        await _set_status(
            exam_id, "COMPLETED",
            f"Enriched {summary['with_knowledge']}/{summary['questions']} questions"
            + (f", {summary['failed']} failed" if failed else ""),
            100.0,
        )
        logger.info(f"🧠 [KNOWLEDGE] Exam #{exam_id} enrichment complete: {summary}")
        return summary
    except Exception as err:
        logger.error(f"🧠 [KNOWLEDGE] Exam #{exam_id} enrichment failed: {err}")
        try:
            await _set_status(exam_id, "FAILED", "Knowledge enrichment failed", 0.0, str(err))
        except Exception:
            pass
        return {"error": str(err)}


def dispatch_exam_enrichment(exam_id: int, log=logger) -> None:
    """Queue enrichment on a Celery worker when one is running, otherwise as an asyncio task."""
    try:
        from app.tasks.celery_app import has_active_celery_workers

        if has_active_celery_workers():
            enrich_exam_knowledge_task.delay(str(exam_id))
            log.info(f"🧠 Dispatched Knowledge Layer enrichment to Celery for Exam #{exam_id}.")
        else:
            asyncio.create_task(async_enrich_exam(str(exam_id)))
            log.info(f"🧠 Dispatched Knowledge Layer enrichment via asyncio for Exam #{exam_id}.")
    except Exception as err:
        log.warning(f"Could not trigger Knowledge Layer enrichment for Exam #{exam_id}: {err}")
