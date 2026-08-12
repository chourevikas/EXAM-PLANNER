import uuid
import asyncio
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models.pipeline_run import PipelineRun
from app.db.models.review import HumanReviewTask
from app.db.models.question import Question, QuestionStatus
from app.config.logger import setup_logger

logger = setup_logger("PipelineManagementService")


class PipelineManagementService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_or_create_pipeline_run(
        self, exam_id: uuid.UUID, pipeline_type: str
    ) -> PipelineRun:
        """Retrieves or creates a PipelineRun tracking record for an exam."""
        query = select(PipelineRun).where(
            PipelineRun.exam_id == exam_id,
            PipelineRun.pipeline_type == pipeline_type,
        )
        res = await self.session.exec(query)
        run = res.first()
        if not run:
            run = PipelineRun(
                exam_id=exam_id,
                pipeline_type=pipeline_type,
                status="RUNNING",
                current_step="INITIALIZING",
                progress_percent=0.0,
            )
            self.session.add(run)
            await self.session.commit()
            await self.session.refresh(run)
        return run

    async def update_pipeline_status(
        self,
        exam_id: uuid.UUID,
        pipeline_type: str,
        status: str,
        current_step: str,
        progress_percent: float,
        error_log: Optional[str] = None,
    ) -> PipelineRun:
        """Updates real-time step, status, progress percentage, and error logs for the frontend UI."""
        run = await self.get_or_create_pipeline_run(exam_id, pipeline_type)
        run.status = status
        run.current_step = current_step
        run.progress_percent = max(0.0, min(100.0, progress_percent))
        if error_log:
            run.error_log = error_log

        if status in ("COMPLETED", "FAILED"):
            run.completed_at = datetime.now(timezone.utc)

        self.session.add(run)
        await self.session.commit()
        await self.session.refresh(run)
        return run

    async def on_pipeline_1_completed(self, exam_id: uuid.UUID) -> PipelineRun:
        """Called when Pipeline 1 (Question Extraction) finishes."""
        # Check if any questions failed completeness validation
        flagged_res = await self.session.exec(
            select(Question).where(
                Question.exam_id == exam_id, Question.is_complete == False
            )
        )
        flagged_questions = flagged_res.all()

        if flagged_questions:
            # Create HITL review tasks for incomplete questions
            for q in flagged_questions:
                task_query = select(HumanReviewTask).where(
                    HumanReviewTask.question_id == q.id
                )
                existing = (await self.session.exec(task_query)).first()
                if not existing:
                    task = HumanReviewTask(
                        exam_id=exam_id,
                        question_id=q.id,
                        review_status="PENDING_REVIEW",
                        is_flagged_by_validator=True,
                        failure_reasons_json=["INCOMPLETE_QUESTION_SEAM_CUT"],
                    )
                    self.session.add(task)
            await self.session.commit()

            return await self.update_pipeline_status(
                exam_id=exam_id,
                pipeline_type="QUESTION_EXTRACTION",
                status="WAITING_FOR_HITL",
                current_step="FLAGGED_QUESTIONS_REQUIRE_ADMIN_REVIEW",
                progress_percent=100.0,
            )

        run = await self.update_pipeline_status(
            exam_id=exam_id,
            pipeline_type="QUESTION_EXTRACTION",
            status="WAITING_FOR_ANSWER_KEY" if not flagged_questions else "WAITING_FOR_HITL",
            current_step="EXTRACTION_COMPLETE_AWAITING_ANSWER_KEY_UPLOAD" if not flagged_questions else "FLAGGED_QUESTIONS_REQUIRE_ADMIN_REVIEW",
            progress_percent=100.0,
        )

        # Check if Answer Key was uploaded previously and needs mapping against newly extracted questions from DB
        from app.db.models import AnswerKeyBatch
        ak_batch_res = await self.session.exec(
            select(AnswerKeyBatch).where(AnswerKeyBatch.exam_id == exam_id)
        )
        ak_batches = ak_batch_res.all()
        if ak_batches:
            logger.info(
                f"🔄 [AUTO-MAP FROM DB] Found existing AnswerKeyBatch for Exam {exam_id}. Mapping stored DB answer keys to newly extracted questions..."
            )
            from app.services.answer_key_service import AnswerKeyService
            ak_service = AnswerKeyService(self.session)
            await ak_service.map_stored_answers_from_db(exam_id)
            await self.on_pipeline_2_completed(exam_id=exam_id, auto_trigger_pipeline_3=True)
        else:
            await self.check_and_trigger_pipeline_3_if_ready(exam_id)
        return run

    async def on_pipeline_2_completed(
        self, exam_id: uuid.UUID, auto_trigger_pipeline_3: bool = True
    ) -> PipelineRun:
        """Called when Pipeline 2 (Answer Key Matching) finishes."""
        run = await self.update_pipeline_status(
            exam_id=exam_id,
            pipeline_type="ANSWER_KEY",
            status="COMPLETED",
            current_step="ANSWER_KEY_MATCHING_COMPLETE",
            progress_percent=100.0,
        )

        if auto_trigger_pipeline_3:
            await self.check_and_trigger_pipeline_3_if_ready(exam_id)

        return run

    async def check_and_trigger_pipeline_3_if_ready(self, exam_id: uuid.UUID) -> bool:
        """
        Checks if both Pipeline 1 (Question Extraction) AND Pipeline 2 (Answer Key Matching)
        have completed for the exam. If both are complete and Pipeline 3 has not run yet,
        automatically dispatches Pipeline 3!
        """
        p1_query = select(PipelineRun).where(
            PipelineRun.exam_id == exam_id,
            PipelineRun.pipeline_type == "QUESTION_EXTRACTION",
        )
        p1_run = (await self.session.exec(p1_query)).first()

        p2_query = select(PipelineRun).where(
            PipelineRun.exam_id == exam_id,
            PipelineRun.pipeline_type == "ANSWER_KEY",
        )
        p2_run = (await self.session.exec(p2_query)).first()

        p1_ready = p1_run is not None and p1_run.status in ("COMPLETED", "WAITING_FOR_ANSWER_KEY", "WAITING_FOR_HITL")
        p2_ready = p2_run is not None and p2_run.status in ("COMPLETED", "MATCHED")

        if p1_ready and p2_ready:
            p3_query = select(PipelineRun).where(
                PipelineRun.exam_id == exam_id,
                PipelineRun.pipeline_type == "EXPLANATION_INDEXING",
            )
            p3_run = (await self.session.exec(p3_query)).first()

            if not p3_run or p3_run.status in ("PENDING", "FAILED"):
                logger.info(
                    f"🚀 [AUTO-ORCHESTRATION] Both Questions (P1) and Answer Keys (P2) are COMPLETE for Exam {exam_id}. Automatically triggering Pipeline 3!"
                )
                await self.update_pipeline_status(
                    exam_id=exam_id,
                    pipeline_type="EXPLANATION_INDEXING",
                    status="RUNNING",
                    current_step="AUTO_DISPATCHED_EXPLANATION_AND_INDEXING",
                    progress_percent=0.0,
                )
                from app.tasks.explanation_tasks import async_process_exam_explanations, process_exam_explanations_task
                from app.tasks.celery_app import has_active_celery_workers
                from app.services.task_registry import task_registry

                key = str(exam_id)
                if has_active_celery_workers():
                    celery_res = process_exam_explanations_task.delay(str(exam_id))
                    task_registry.register_celery_task(key, celery_res.id)
                else:
                    task = asyncio.create_task(async_process_exam_explanations(str(exam_id)))
                    task_registry.register_async_task(key, task)
                return True
        return False

    async def get_exam_pipeline_overview(self, exam_id: uuid.UUID) -> Dict[str, Any]:
        """Provides full pipeline status overview for frontend dashboard."""
        query = select(PipelineRun).where(PipelineRun.exam_id == exam_id)
        runs = (await self.session.exec(query)).all()

        run_dict = {r.pipeline_type: r for r in runs}

        q_count_res = await self.session.exec(
            select(Question).where(Question.exam_id == exam_id)
        )
        questions = q_count_res.all()

        incomplete_count = sum(1 for q in questions if not q.is_complete)
        published_count = sum(1 for q in questions if q.status == QuestionStatus.PUBLISHED)

        return {
            "exam_id": str(exam_id),
            "total_questions_extracted": len(questions),
            "published_questions_count": published_count,
            "flagged_incomplete_count": incomplete_count,
            "pipelines": {
                "question_extraction": {
                    "status": run_dict["QUESTION_EXTRACTION"].status
                    if "QUESTION_EXTRACTION" in run_dict
                    else "PENDING",
                    "current_step": run_dict["QUESTION_EXTRACTION"].current_step
                    if "QUESTION_EXTRACTION" in run_dict
                    else "NOT_STARTED",
                    "progress_percent": run_dict["QUESTION_EXTRACTION"].progress_percent
                    if "QUESTION_EXTRACTION" in run_dict
                    else 0.0,
                    "error_log": run_dict["QUESTION_EXTRACTION"].error_log
                    if "QUESTION_EXTRACTION" in run_dict
                    else None,
                },
                "answer_key": {
                    "status": run_dict["ANSWER_KEY"].status
                    if "ANSWER_KEY" in run_dict
                    else "PENDING",
                    "current_step": run_dict["ANSWER_KEY"].current_step
                    if "ANSWER_KEY" in run_dict
                    else "WAITING_FOR_UPLOAD",
                    "progress_percent": run_dict["ANSWER_KEY"].progress_percent
                    if "ANSWER_KEY" in run_dict
                    else 0.0,
                    "error_log": run_dict["ANSWER_KEY"].error_log
                    if "ANSWER_KEY" in run_dict
                    else None,
                },
                "explanation_indexing": {
                    "status": run_dict["EXPLANATION_INDEXING"].status
                    if "EXPLANATION_INDEXING" in run_dict
                    else "PENDING",
                    "current_step": run_dict["EXPLANATION_INDEXING"].current_step
                    if "EXPLANATION_INDEXING" in run_dict
                    else "WAITING_FOR_PIPELINE_2",
                    "progress_percent": run_dict["EXPLANATION_INDEXING"].progress_percent
                    if "EXPLANATION_INDEXING" in run_dict
                    else 0.0,
                    "error_log": run_dict["EXPLANATION_INDEXING"].error_log
                    if "EXPLANATION_INDEXING" in run_dict
                    else None,
                },
            },
        }
