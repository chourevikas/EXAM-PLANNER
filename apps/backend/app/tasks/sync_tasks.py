import uuid
import time
import asyncio
from datetime import datetime, timezone
from typing import Optional, Any
from app.tasks.celery_app import celery_app
from app.config.logger import setup_logger, TaskLoggerAdapter
from app.db.session import managed_async_session

logger = setup_logger("SyncTaskRunner")


@celery_app.task(name="sync_exam_s3_task")
def sync_exam_s3_task(
    exam_id_str: str,
    run_id_str: str,
    sync_all: bool = False,
    task_id: Optional[str] = None,
    execution_engine: str = "Celery Worker",
):
    """Celery background task to sync an exam's questions and solutions to S3."""
    t_id = task_id or str(uuid.uuid4())
    log = TaskLoggerAdapter(logger, task_id=t_id)
    scope_str = "Full (Master + All Questions)" if sync_all else "Master Only (Fast)"
    log.info(
        f"⚡ [CELERY WORKER DISPATCH] Syncing Exam '{exam_id_str}' to S3 [{scope_str}] (Run ID: '{run_id_str}', Task ID: '{t_id}')"
    )
    return asyncio.run(
        async_sync_exam_s3(
            exam_id_str=exam_id_str,
            run_id_str=run_id_str,
            sync_all=sync_all,
            task_id=t_id,
            execution_engine="Celery Worker",
        )
    )


async def async_sync_exam_s3(
    exam_id_str: str,
    run_id_str: str,
    sync_all: bool = False,
    task_id: Optional[str] = None,
    execution_engine: str = "FastAPI BackgroundTasks",
    session: Optional[Any] = None,
):
    """Core async runner to generate consolidated & individual JSON artifacts and sync to AWS S3."""
    t_id = task_id or str(uuid.uuid4())
    log = TaskLoggerAdapter(logger, task_id=t_id)
    scope_str = "Full (Master + All Questions)" if sync_all else "Master Only (Fast)"
    start_time = time.perf_counter()

    log.info("=" * 75)
    log.info(
        f"⚡ [S3 SYNC PIPELINE STARTED] Engine: {execution_engine} | Scope: {scope_str}\n"
        f"   Exam ID: '{exam_id_str}' | Run ID: '{run_id_str}' | Task ID: '{t_id}'"
    )
    log.info("=" * 75)

    from app.services.exam_json_builder import ExamJsonBuilder
    from app.db.models.pipeline_run import PipelineRun
    from app.services.task_registry import task_registry

    exam_uuid = uuid.UUID(exam_id_str)
    run_uuid = uuid.UUID(run_id_str)

    task_registry.register_current_task(str(exam_uuid))
    task_registry.register_current_task(f"sync_{exam_uuid}")

    async def _do_sync(sess):
        # Step 1: Initialize status to RUNNING
        run = await sess.get(PipelineRun, run_uuid)
        if run:
            run.status = "RUNNING"
            run.current_step = f"GENERATING_JSON_ARTIFACTS_({scope_str.upper()})"
            run.progress_percent = 25.0
            sess.add(run)
            await sess.commit()
            log.info(f"📊 [PIPELINE_RUN] Progress updated -> 25% ({run.current_step})")

        # Step 2: Run JSON build & S3 uploads
        builder = ExamJsonBuilder(sess)
        sync_res = await builder.generate_and_upload(exam_uuid, sync_all=sync_all)

        # Step 3: Record completion in PipelineRun
        run = await sess.get(PipelineRun, run_uuid)
        if run:
            run.status = "COMPLETED"
            run.current_step = "PUBLISHED_TO_S3"
            run.progress_percent = 100.0
            run.completed_at = datetime.now(timezone.utc)
            run.error_log = None
            sess.add(run)
            await sess.commit()

        elapsed = time.perf_counter() - start_time
        log.info(
            f"✅ [S3 SYNC PIPELINE SUCCESS] Exam: '{exam_id_str}' in {elapsed:.2f}s | "
            f"Scope: {scope_str} | Questions: {sync_res.get('questions_count', 0)}\n"
            f"   Master Questions: {sync_res.get('questions_json_path')}\n"
            f"   Master Solutions: {sync_res.get('solutions_json_path')}\n"
            f"   Last Synced At: {sync_res.get('last_synced_at')}"
        )
        return {
            "status": "COMPLETED",
            "exam_id": exam_id_str,
            "pipeline_run_id": run_id_str,
            "elapsed_seconds": round(elapsed, 2),
            **sync_res,
        }

    try:
        if session is not None:
            return await _do_sync(session)
        else:
            async with managed_async_session() as sess:
                return await _do_sync(sess)
    except Exception as e:
        elapsed = time.perf_counter() - start_time
        log.error(
            f"❌ [S3 SYNC PIPELINE FAILED] Exam: {exam_id_str} (after {elapsed:.2f}s): {e}",
            exc_info=True,
        )
        try:
            async with managed_async_session() as session:
                run = await session.get(PipelineRun, run_uuid)
                if run:
                    run.status = "FAILED"
                    run.current_step = "S3_SYNC_FAILED"
                    run.error_log = str(e)
                    run.completed_at = datetime.now(timezone.utc)
                    session.add(run)
                    await session.commit()
                    log.info(f"📊 [PIPELINE_RUN] Recorded failure state in PipelineRun {run_uuid}")
        except Exception as inner_e:
            log.error(f"Failed to record failure for exam {exam_id_str}: {inner_e}")
        raise e
