import uuid
from pathlib import Path
from typing import Optional, List, Dict, Any, Union
from fastapi import UploadFile, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Exam
from app.repositories.exam_repository import ExamRepository
from app.storage.factory import get_storage_provider
from app.tasks.celery_app import celery_app, has_active_celery_workers
from app.config.settings import get_settings
from app.config.logger import setup_logger
from app.config.filename_parser import parse_question_paper_filename
from app.utils.file_utils import save_upload_file_temp
from app.core.cleanup import cleanup_file

logger = setup_logger("ExamService")


class ExamService:
    """Service handling business logic for Exam question papers and uploads."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = ExamRepository(session)

    async def handle_pdf_upload(
        self,
        file: UploadFile,
        year: Optional[Union[int, str]] = None,
        set_code: Optional[str] = None,
        exam_name: Optional[str] = None,
        stage: Optional[str] = None,
        subject_code: Optional[str] = None,
        exam_type: Optional[str] = None,
        exam_type_id: Optional[int] = None,
        run_mode: Optional[str] = "auto",
        conflict_resolution: Optional[str] = "CHECK",
        background_tasks: Optional[BackgroundTasks] = None,
    ) -> Dict[str, Any]:
        from app.tasks.exam_tasks import process_exam_pdf_task, async_process_exam_pdf

        settings = get_settings()

        # 1. Automatically extract canonical code from uploaded filename stem and form inputs
        parsed_tokens = parse_question_paper_filename(
            filename_or_code=file.filename,
            year=year,
            user_set_code=set_code,
            exam_name=exam_name,
            stage=stage,
            subject_code=subject_code,
        )
        canonical_code = parsed_tokens["canonical_code"]
        clean_set = parsed_tokens["set_code"]
        exam_name_title = f"{parsed_tokens['exam_name']} ({parsed_tokens['year']}) - Set {parsed_tokens['raw_set_token']}"

        # Resolve ExamType as single source of truth for exam configuration
        from app.repositories.exam_type_repository import ExamTypeRepository
        et_repo = ExamTypeRepository(self.session)
        resolved_et = None
        if exam_type_id:
            resolved_et = await et_repo.get_by_id(exam_type_id)
        if not resolved_et and exam_type:
            resolved_et = await et_repo.get_by_type(exam_type)
        if not resolved_et and exam_name:
            resolved_et = await et_repo.get_by_type(exam_name)
        if not resolved_et:
            resolved_et = await et_repo.get_by_type("upse")

        et_id = resolved_et.id if resolved_et else None
        tot_q = resolved_et.number_of_questions if resolved_et else 100
        dur_mins = resolved_et.total_duration if resolved_et else 120
        tot_marks = resolved_et.total_marks if resolved_et else 200.0

        # 2. Check if matching canonical exam already exists
        existing_matches = await self.repo.get_all_matching_canonical_exams(
            code=canonical_code,
            year=parsed_tokens["year"],
            stage=parsed_tokens["stage"],
            subject_code=parsed_tokens["subject_code"],
            paper_set_code=clean_set,
        )
        exam = existing_matches[0] if existing_matches else None

        resolution = (conflict_resolution or "CHECK").strip().upper()
        if existing_matches and resolution == "CHECK":
            raise HTTPException(
                status_code=409,
                detail={
                    "requires_confirmation": True,
                    "conflict_type": "EXAM_EXISTS",
                    "title": "Existing Exam Paper Detected",
                    "message": (
                        f"An exam paper matching '{exam.name}' ({exam.code}) already exists in the system. "
                        f"Would you like to overwrite it or skip this upload?"
                    ),
                    "options": ["OVERWRITE", "SKIP"],
                    "exam_id": str(exam.id),
                    "canonical_code": exam.code,
                },
            )

        if existing_matches and resolution == "SKIP":
            return {
                "status": "SKIPPED",
                "message": f"Upload skipped. Existing exam '{exam.code}' (ID: {exam.id}) was preserved without modification.",
                "exam_id": str(exam.id),
                "canonical_code": exam.code,
                "s3_path": exam.pdf_path,
            }

        # If OVERWRITE: delete all matching duplicate exams completely from DB and cache before re-ingestion!
        if resolution == "OVERWRITE" and existing_matches:
            for old_exam in existing_matches:
                logger.info(
                    f"Conflict resolution OVERWRITE: deleting existing exam ID {old_exam.id} ({old_exam.code}) and all related data before re-ingestion..."
                )
                await self.delete_exam(old_exam.id)
            exam = None

        # 3. Save uploaded file to temp directory & upload to persistent storage provider
        temp_dir = Path("./temp_uploads").resolve()
        temp_path = await save_upload_file_temp(file, temp_dir)

        storage = get_storage_provider()
        rel_path = f"uploads/question_papers/{canonical_code}/{clean_set}/{canonical_code}.pdf"
        persistent_path = await storage.upload_file(temp_path, rel_path)
        logger.info(f"Saved persistent PDF to '{persistent_path}'")
        from app.utils.pdf_utils import seed_pdf_cache
        seed_pdf_cache(persistent_path, temp_path)
        cleanup_file(temp_path)

        # 4. Save fresh Exam record in DB
        exam = Exam(
            code=canonical_code,
            name=exam_name_title,
            stage=parsed_tokens["stage"],
            subject_code=parsed_tokens["subject_code"],
            source_year=parsed_tokens["year"],
            paper_set_code=clean_set,
            pdf_path=persistent_path,
            canonical_question_id_prefix=canonical_code,
            exam_type_id=et_id,
            total_questions=tot_q,
            total_duration_minutes=dur_mins,
            total_marks=tot_marks,
        )
        exam = await self.repo.save(exam)

        from app.services.task_registry import task_registry
        task_registry.register_current_task(str(exam.id))
        task_registry.register_current_task(f"qp_{exam.id}")

        from app.cache import invalidate_exam_cache, invalidate_pipeline_status_cache
        await invalidate_exam_cache(str(exam.id))
        await invalidate_pipeline_status_cache()


        # 5. Determine whether to use Celery Worker or FastAPI BackgroundTasks
        task_id = str(uuid.uuid4())
        mode = (run_mode or "auto").lower()

        if mode == "background":
            use_celery = False
        elif mode == "celery":
            use_celery = True
        else:  # "auto"
            # Use Celery if Celery eager mode is enabled OR active workers are online
            use_celery = (
                settings.CELERY_TASK_ALWAYS_EAGER or has_active_celery_workers()
            )

        if use_celery:
            try:
                engine_name = "Celery Worker"
                task_res = process_exam_pdf_task.delay(
                    str(exam.id), persistent_path, exam.name, task_id
                )
                task_id = task_res.id if hasattr(task_res, "id") else task_id
                execution_msg = f"PDF upload accepted. Task enqueued to {engine_name} (Task ID: {task_id})."
            except Exception as exc:
                engine_name = "FastAPI BackgroundTasks (Fallback)"
                logger.warning(
                    f"Celery broker dispatch failed: {exc}. Falling back to BackgroundTasks...",
                    exc_info=True,
                )
                if background_tasks is not None:
                    background_tasks.add_task(
                        async_process_exam_pdf,
                        str(exam.id),
                        persistent_path,
                        exam.name,
                        task_id,
                        "FastAPI BackgroundTasks (Fallback)",
                    )
                execution_msg = f"PDF upload accepted. Celery unavailable; processing via FastAPI BackgroundTasks (Task ID: {task_id})."
        else:
            engine_name = "FastAPI BackgroundTasks"
            logger.info(
                f"Dispatching Vision Extraction Pipeline via {engine_name} (Task ID: {task_id})..."
            )
            if background_tasks is not None:
                background_tasks.add_task(
                    async_process_exam_pdf,
                    str(exam.id),
                    persistent_path,
                    exam.name,
                    task_id,
                    "FastAPI BackgroundTasks",
                )
            execution_msg = "PDF upload accepted. Question extraction pipeline is now processing in the background."

        return {
            "message": execution_msg,
            "exam_id": str(exam.id),
            "filename": file.filename,
            "code": canonical_code,
            "paper_set_code": parsed_tokens["set_code"],
            "task_id": task_id,
            "execution_engine": engine_name,
        }

    async def list_exams(
        self, status: Optional[str] = None, is_active: Optional[bool] = None
    ) -> List[Exam]:
        return await self.repo.list_all(status=status, is_active=is_active)


    async def get_exam_detail(self, exam_id: int) -> Exam:
        exam = await self.repo.get_by_id(exam_id)
        if not exam:
            raise HTTPException(
                status_code=404, detail=f"Exam with ID {exam_id} not found."
            )
        return exam

    async def delete_exam(self, exam_id: int | str) -> bool:
        """
        Permanently deletes an exam and all cascading child data from DB,
        cancels active tasks, and clears all related cache entries.
        """
        from sqlmodel import select, delete
        from app.db.models import (
            Exam,
            Question,
            QuestionOption,
            OptionTranslation,
            QuestionOptionReasoning,
            QuestionTranslation,
            QuestionExplanation,
            QuestionAsset,
            QuestionHierarchyLink,
            QuestionMetadata,
            AnswerKeyBatch,
            AnswerKeyMapping,
            HumanReviewTask,
            Passage,
            PassageTranslation,
            PipelineRun,
            SyllabusVersion,
            Subject,
            Topic,
            Subtopic,
            ExamAttempt,
            ExamQuestionResponse,
            ExamQuestionReport,
            ExamAttemptReport,
            UserSkillProgressionReport,
            Test,
            TestQuestion,
            UserTestAttempt,
            UserQuestionResponse,
            QuestionSwitchLog,
            QuestionBookmark,
        )
        from app.db.models.challenge import ChallengeQuestion, ChallengeResponse
        from app.db.models.teacher import ReviewPointsLog
        from app.db.models.telemetry import UserConceptRetention

        try:
            parsed_id = int(exam_id)
        except (ValueError, TypeError):
            logger.warning(f"delete_exam called with invalid exam_id: {exam_id}")
            return False

        exam = await self.repo.get_by_id(parsed_id)
        if not exam:
            logger.warning(f"Exam with ID {parsed_id} does not exist. Nothing to delete.")
            return False

        pdf_path = exam.pdf_path
        exam_code = exam.code

        # 1. Cancel and unregister all running background tasks
        from app.services.task_registry import task_registry
        for tid in [str(parsed_id), f"qp_{parsed_id}", f"ak_{parsed_id}"]:
            try:
                task_registry.cancel_task(tid)
                task_registry.unregister(tid)
            except Exception as exc:
                logger.debug(f"Error cancelling task {tid}: {exc}")

        # 2. Cascading deletion of question-level child entities
        try:
            # A. Collect questions
            q_res = await self.session.exec(
                select(Question.id).where(Question.exam_id == parsed_id)
            )
            question_ids = [q for q in q_res.all() if q is not None]

            if question_ids:
                # B. Collect question options
                opt_res = await self.session.exec(
                    select(QuestionOption.id).where(
                        QuestionOption.question_id.in_(question_ids)
                    )
                )
                option_ids = [o for o in opt_res.all() if o is not None]

                if option_ids:
                    await self.session.exec(
                        delete(OptionTranslation).where(
                            OptionTranslation.option_id.in_(option_ids)
                        )
                    )
                    await self.session.exec(
                        delete(QuestionOptionReasoning).where(
                            QuestionOptionReasoning.question_option_id.in_(option_ids)
                        )
                    )
                    await self.session.exec(
                        delete(ChallengeResponse).where(
                            ChallengeResponse.selected_option_id.in_(option_ids)
                        )
                    )
                    await self.session.exec(
                        delete(UserQuestionResponse).where(
                            UserQuestionResponse.selected_option_id.in_(option_ids)
                        )
                    )
                    await self.session.exec(
                        delete(QuestionSwitchLog).where(
                            (QuestionSwitchLog.from_option_id.in_(option_ids))
                            | (QuestionSwitchLog.to_option_id.in_(option_ids))
                        )
                    )
                    await self.session.exec(
                        delete(ExamQuestionResponse).where(
                            (ExamQuestionResponse.selected_option_id.in_(option_ids))
                            | (ExamQuestionResponse.initial_option_id.in_(option_ids))
                        )
                    )
                    await self.session.exec(
                        delete(QuestionOption).where(
                            QuestionOption.id.in_(option_ids)
                        )
                    )

                # Delete direct question-level children
                await self.session.exec(
                    delete(QuestionTranslation).where(
                        QuestionTranslation.question_id.in_(question_ids)
                    )
                )
                await self.session.exec(
                    delete(QuestionExplanation).where(
                        QuestionExplanation.question_id.in_(question_ids)
                    )
                )
                await self.session.exec(
                    delete(QuestionAsset).where(
                        QuestionAsset.question_id.in_(question_ids)
                    )
                )
                await self.session.exec(
                    delete(QuestionHierarchyLink).where(
                        QuestionHierarchyLink.question_id.in_(question_ids)
                    )
                )
                await self.session.exec(
                    delete(QuestionMetadata).where(
                        QuestionMetadata.question_id.in_(question_ids)
                    )
                )
                await self.session.exec(
                    delete(AnswerKeyMapping).where(
                        AnswerKeyMapping.question_id.in_(question_ids)
                    )
                )
                await self.session.exec(
                    delete(HumanReviewTask).where(
                        HumanReviewTask.question_id.in_(question_ids)
                    )
                )
                await self.session.exec(
                    delete(QuestionBookmark).where(
                        QuestionBookmark.question_id.in_(question_ids)
                    )
                )
                # Delete responses and logs linked to questions
                uqr_res = await self.session.exec(
                    select(UserQuestionResponse.id).where(
                        UserQuestionResponse.question_id.in_(question_ids)
                    )
                )
                uqr_ids = [u for u in uqr_res.all() if u is not None]
                if uqr_ids:
                    await self.session.exec(
                        delete(QuestionSwitchLog).where(
                            QuestionSwitchLog.response_id.in_(uqr_ids)
                        )
                    )

                eqr_res = await self.session.exec(
                    select(ExamQuestionResponse.id).where(
                        ExamQuestionResponse.question_id.in_(question_ids)
                    )
                )
                eqr_ids = [e for e in eqr_res.all() if e is not None]
                if eqr_ids:
                    await self.session.exec(
                        delete(QuestionSwitchLog).where(
                            QuestionSwitchLog.exam_response_id.in_(eqr_ids)
                        )
                    )

                await self.session.exec(
                    delete(ExamQuestionResponse).where(
                        ExamQuestionResponse.question_id.in_(question_ids)
                    )
                )
                await self.session.exec(
                    delete(ExamQuestionReport).where(
                        ExamQuestionReport.question_id.in_(question_ids)
                    )
                )
                await self.session.exec(
                    delete(TestQuestion).where(
                        TestQuestion.question_id.in_(question_ids)
                    )
                )
                await self.session.exec(
                    delete(ChallengeQuestion).where(
                        ChallengeQuestion.question_id.in_(question_ids)
                    )
                )
                await self.session.exec(
                    delete(ChallengeResponse).where(
                        ChallengeResponse.question_id.in_(question_ids)
                    )
                )
                await self.session.exec(
                    delete(UserQuestionResponse).where(
                        UserQuestionResponse.question_id.in_(question_ids)
                    )
                )
                await self.session.exec(
                    delete(ReviewPointsLog).where(
                        ReviewPointsLog.question_id.in_(question_ids)
                    )
                )
                await self.session.exec(
                    delete(Question).where(
                        Question.id.in_(question_ids)
                    )
                )

            # 3. Exam-level child entities
            await self.session.exec(
                delete(HumanReviewTask).where(HumanReviewTask.exam_id == parsed_id)
            )

            # Answer Key Batches and Mappings
            ak_res = await self.session.exec(
                select(AnswerKeyBatch.id).where(AnswerKeyBatch.exam_id == parsed_id)
            )
            ak_batch_ids = [b for b in ak_res.all() if b is not None]
            if ak_batch_ids:
                await self.session.exec(
                    delete(AnswerKeyMapping).where(
                        AnswerKeyMapping.batch_id.in_(ak_batch_ids)
                    )
                )
                await self.session.exec(
                    delete(AnswerKeyBatch).where(AnswerKeyBatch.id.in_(ak_batch_ids))
                )

            # Passages and PassageTranslations
            p_res = await self.session.exec(
                select(Passage.id).where(Passage.exam_id == parsed_id)
            )
            passage_ids = [p for p in p_res.all() if p is not None]
            if passage_ids:
                await self.session.exec(
                    delete(PassageTranslation).where(
                        PassageTranslation.passage_id.in_(passage_ids)
                    )
                )
                await self.session.exec(
                    delete(Passage).where(Passage.id.in_(passage_ids))
                )

            # PipelineRuns
            await self.session.exec(
                delete(PipelineRun).where(PipelineRun.exam_id == parsed_id)
            )

            # Exam Attempts, Reports & User Test Attempts
            att_res = await self.session.exec(
                select(ExamAttempt.id).where(ExamAttempt.exam_id == parsed_id)
            )
            attempt_ids = [a for a in att_res.all() if a is not None]
            if attempt_ids:
                uta_res = await self.session.exec(
                    select(UserTestAttempt.id).where(
                        UserTestAttempt.exam_attempt_id.in_(attempt_ids)
                    )
                )
                uta_ids = [u for u in uta_res.all() if u is not None]
                if uta_ids:
                    uta_uqr_res = await self.session.exec(
                        select(UserQuestionResponse.id).where(
                            UserQuestionResponse.attempt_id.in_(uta_ids)
                        )
                    )
                    uta_uqr_ids = [u for u in uta_uqr_res.all() if u is not None]
                    if uta_uqr_ids:
                        await self.session.exec(
                            delete(QuestionSwitchLog).where(
                                QuestionSwitchLog.response_id.in_(uta_uqr_ids)
                            )
                        )
                    await self.session.exec(
                        delete(UserQuestionResponse).where(
                            UserQuestionResponse.attempt_id.in_(uta_ids)
                        )
                    )
                    await self.session.exec(
                        delete(UserTestAttempt).where(UserTestAttempt.id.in_(uta_ids))
                    )

                att_eqr_res = await self.session.exec(
                    select(ExamQuestionResponse.id).where(
                        ExamQuestionResponse.attempt_id.in_(attempt_ids)
                    )
                )
                att_eqr_ids = [e for e in att_eqr_res.all() if e is not None]
                if att_eqr_ids:
                    await self.session.exec(
                        delete(QuestionSwitchLog).where(
                            QuestionSwitchLog.exam_response_id.in_(att_eqr_ids)
                        )
                    )

                await self.session.exec(
                    delete(ExamQuestionResponse).where(
                        ExamQuestionResponse.attempt_id.in_(attempt_ids)
                    )
                )
                await self.session.exec(
                    delete(ExamQuestionReport).where(
                        ExamQuestionReport.attempt_id.in_(attempt_ids)
                    )
                )
                await self.session.exec(
                    delete(ExamAttemptReport).where(
                        ExamAttemptReport.attempt_id.in_(attempt_ids)
                    )
                )
                await self.session.exec(
                    delete(UserSkillProgressionReport).where(
                        UserSkillProgressionReport.attempt_id.in_(attempt_ids)
                    )
                )
                await self.session.exec(
                    delete(ExamAttempt).where(ExamAttempt.id.in_(attempt_ids))
                )

            await self.session.exec(
                delete(ExamAttemptReport).where(ExamAttemptReport.exam_id == parsed_id)
            )

            # Delete linked Test (created with exam.id in ExamSessionService) and its test questions & user attempts
            await self.session.exec(
                delete(TestQuestion).where(TestQuestion.test_id == parsed_id)
            )
            await self.session.exec(
                delete(UserTestAttempt).where(UserTestAttempt.test_id == parsed_id)
            )
            await self.session.exec(
                delete(Test).where(Test.id == parsed_id)
            )

            # Syllabus Versions and hierarchy
            s_ver_res = await self.session.exec(
                select(SyllabusVersion.id).where(SyllabusVersion.exam_id == parsed_id)
            )
            s_ver_ids = [s for s in s_ver_res.all() if s is not None]
            if s_ver_ids:
                sub_res = await self.session.exec(
                    select(Subject.id).where(Subject.version_id.in_(s_ver_ids))
                )
                subject_ids = [s for s in sub_res.all() if s is not None]
                if subject_ids:
                    top_res = await self.session.exec(
                        select(Topic.id).where(Topic.subject_id.in_(subject_ids))
                    )
                    topic_ids = [t for t in top_res.all() if t is not None]
                    if topic_ids:
                        subt_res = await self.session.exec(
                            select(Subtopic.id).where(Subtopic.topic_id.in_(topic_ids))
                        )
                        subtopic_ids = [st for st in subt_res.all() if st is not None]
                        if subtopic_ids:
                            await self.session.exec(
                                delete(UserConceptRetention).where(
                                    UserConceptRetention.subtopic_id.in_(subtopic_ids)
                                )
                            )
                            await self.session.exec(
                                delete(Subtopic).where(Subtopic.id.in_(subtopic_ids))
                            )
                        await self.session.exec(
                            delete(Topic).where(Topic.id.in_(topic_ids))
                        )
                    await self.session.exec(
                        delete(Subject).where(Subject.id.in_(subject_ids))
                    )
                await self.session.exec(
                    delete(SyllabusVersion).where(SyllabusVersion.id.in_(s_ver_ids))
                )

            # Finally, delete the Exam record
            await self.session.delete(exam)
            await self.session.commit()
            logger.info(f"Successfully deleted exam ID {parsed_id} ({exam_code}) from database.")
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Failed to delete exam ID {parsed_id} from database: {e}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Database error while deleting exam {parsed_id}: {str(e)}",
            )

        # 4. Cache Purge
        try:
            from app.cache import (
                invalidate_exam_cache,
                invalidate_pipeline_status_cache,
                get_cache,
            )
            await invalidate_exam_cache(str(parsed_id))
            await invalidate_pipeline_status_cache()

            cache = get_cache()
            settings = get_settings()
            prefix = settings.CACHE_KEY_PREFIX or "ep"
            extra_patterns = [
                f"{prefix}:exams:*",
                f"{prefix}:questions:*",
                f"{prefix}:syllabus:*",
                f"{prefix}:analytics:*",
                f"{prefix}:admin:*",
            ]
            for pat in extra_patterns:
                try:
                    await cache.delete_pattern(pat)
                except Exception as exc:
                    logger.debug(f"Pattern purge '{pat}' error: {exc}")

            if pdf_path:
                from app.utils.pdf_utils import clear_pdf_cache
                clear_pdf_cache(pdf_path)
        except Exception as cache_exc:
            logger.warning(f"Error purging cache during exam deletion for ID {parsed_id}: {cache_exc}")

        return True
