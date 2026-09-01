import uuid
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import UploadFile, HTTPException, BackgroundTasks
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models import AnswerKeyBatch
from app.repositories.exam_repository import ExamRepository
from app.repositories.answer_key_repository import AnswerKeyRepository
from app.storage.factory import get_storage_provider
from app.tasks.answer_key_tasks import (
    process_answer_key_pdf_task,
    async_process_answer_key_pdf,
)
from app.tasks.celery_app import celery_app, has_active_celery_workers
from app.config.settings import get_settings
from app.config.logger import setup_logger
from app.config.filename_parser import parse_answer_key_filename
from app.utils.file_utils import save_upload_file_temp

logger = setup_logger("AnswerKeyService")


class AnswerKeyService:
    """Service handling business logic for Answer Key processing and mappings."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.exam_repo = ExamRepository(session)
        self.repo = AnswerKeyRepository(session)

    async def handle_answer_key_upload(
        self,
        file: UploadFile,
        set_code: Optional[str] = "SET_A",
        run_mode: Optional[str] = "auto",
        background_tasks: Optional[BackgroundTasks] = None,
    ) -> Dict[str, Any]:
        settings = get_settings()

        # 1. Automatically extract canonical code from filename
        parsed_tokens = parse_answer_key_filename(file.filename or "")
        canonical_code = parsed_tokens["canonical_code"]

        # 2. Look up matching Exam by canonical code first, then by token attributes
        target_exam = await self.exam_repo.get_by_code(canonical_code)
        if not target_exam:
            matching_exams = await self.exam_repo.find_matching_exams_for_answer_key(
                stage=parsed_tokens["stage"],
                subject_code=parsed_tokens["subject_code"],
                year=parsed_tokens["year"],
            )
            if matching_exams:
                target_exam = matching_exams[0]

        # 3. Save uploaded file to temp directory & upload to persistent storage provider
        temp_dir = Path("./temp_answer_keys").resolve()
        temp_path = await save_upload_file_temp(file, temp_dir)

        storage = get_storage_provider()
        rel_path = f"uploads/answer_keys/{canonical_code}/{canonical_code}.pdf"
        persistent_path = await storage.upload_file(temp_path, rel_path)
        logger.info(f"Saved persistent answer key file to '{persistent_path}'")

        chosen_set_code = set_code or parsed_tokens.get("set_code") or "SET_A"
        if not target_exam:
            from app.db.models import Exam
            target_exam = Exam(
                code=canonical_code,
                name=canonical_code,
                stage=parsed_tokens["stage"],
                subject_code=parsed_tokens["subject_code"],
                source_year=parsed_tokens["year"],
                paper_set_code=chosen_set_code,
                pdf_path=None,
                answer_key_pdf_path=persistent_path,
            )
            target_exam = await self.exam_repo.save(target_exam)
        else:
            target_exam.answer_key_pdf_path = persistent_path
            target_exam = await self.exam_repo.save(target_exam)

        # 4. Determine whether to use Celery Worker or FastAPI BackgroundTasks
        task_id = str(uuid.uuid4())
        mode = (run_mode or "auto").lower()

        if mode == "background":
            use_celery = False
        elif mode == "celery":
            use_celery = True
        else:  # "auto"
            use_celery = (
                settings.CELERY_TASK_ALWAYS_EAGER or has_active_celery_workers()
            )

        if use_celery:
            try:
                engine_name = "Celery Worker"
                task_res = process_answer_key_pdf_task.delay(
                    str(target_exam.id),
                    persistent_path,
                    target_exam.paper_set_code,
                    task_id,
                )
                task_id = task_res.id if hasattr(task_res, "id") else task_id
                execution_msg = (
                    f"Answer key task enqueued to {engine_name} (Task ID: {task_id})."
                )
            except Exception as exc:
                engine_name = "FastAPI BackgroundTasks (Fallback)"
                logger.warning(
                    f"Celery broker dispatch failed: {exc}. Falling back to BackgroundTasks...",
                    exc_info=True,
                )
                if background_tasks is not None:
                    background_tasks.add_task(
                        async_process_answer_key_pdf,
                        str(target_exam.id),
                        persistent_path,
                        target_exam.paper_set_code,
                        task_id,
                        "FastAPI BackgroundTasks (Fallback)",
                    )
                execution_msg = f"Celery broker unavailable; answer key extraction started via {engine_name} (Task ID: {task_id})."
        else:
            engine_name = "FastAPI BackgroundTasks"
            logger.info(
                f"Dispatching Answer Key extraction via {engine_name} (Task ID: {task_id})..."
            )
            if background_tasks is not None:
                background_tasks.add_task(
                    async_process_answer_key_pdf,
                    str(target_exam.id),
                    persistent_path,
                    target_exam.paper_set_code,
                    task_id,
                    "FastAPI BackgroundTasks",
                )
            execution_msg = f"Answer key extraction pipeline started via {engine_name} (Task ID: {task_id})."

        return {
            "message": execution_msg,
            "filename": file.filename,
            "answer_key_code": canonical_code,
            "matched_exams_count": len(matching_exams),
            "target_exam_id": str(target_exam.id),
            "task_id": task_id,
            "execution_engine": engine_name,
        }

    async def list_batches(self) -> List[AnswerKeyBatch]:
        from app.cache import get_cache, build_cache_key
        cache = get_cache()
        cache_key = build_cache_key("answer_keys:batches:list")
        cached_data = await cache.get(cache_key)
        if cached_data is not None:
            return [AnswerKeyBatch(**b) for b in cached_data]

        batches = await self.repo.list_batches()
        if batches:
            serialized = [b.dict() if hasattr(b, "dict") else b.model_dump(mode="json") for b in batches]
            await cache.set(cache_key, serialized, ttl_seconds=1800)
        return batches

    async def get_batch_detail(self, batch_id: int) -> Dict[str, Any]:
        from app.cache import get_cache, build_cache_key
        cache = get_cache()
        cache_key = build_cache_key("answer_keys:batch", str(batch_id))
        cached_data = await cache.get(cache_key)
        if cached_data is not None:
            return cached_data

        batch = await self.repo.get_batch_by_id(batch_id)
        if not batch:
            raise HTTPException(status_code=404, detail="Answer key batch not found.")

        mappings = await self.repo.get_mappings_for_batch(batch_id)

        res_data = {
            "batch_id": str(batch.id),
            "exam_id": str(batch.exam_id),
            "pdf_path": batch.pdf_path,
            "target_set_code": batch.target_set_code,
            "detected_set_code": batch.detected_set_code,
            "set_match_status": batch.set_match_status.value if hasattr(batch.set_match_status, "value") else str(batch.set_match_status),
            "total_extracted": batch.total_keys_extracted,
            "total_mapped": batch.total_keys_mapped,
            "created_at": batch.created_at.isoformat() if batch.created_at else None,
            "mappings": [
                {
                    "mapping_id": str(m.id),
                    "question_id": str(m.question_id) if m.question_id else None,
                    "question_number": m.printed_question_number,
                    "detected_option_label": m.detected_option_label,
                    "mapping_status": m.mapping_status.value if hasattr(m.mapping_status, "value") else str(m.mapping_status),
                    "notes": m.notes,
                }
                for m in mappings
            ],
        }
        await cache.set(cache_key, res_data, ttl_seconds=3600)
        return res_data

    async def map_stored_answers_from_db(self, exam_id: int) -> int:
        """
        Maps stored AnswerKeyMapping entries directly from the database to newly extracted questions.
        Performs 0 LLM vision calls and 0 PDF processing operations.
        """
        from sqlmodel import select, col
        from app.db.models import AnswerKeyMapping, Question, QuestionOption, MappingStatus
        from app.pipeline.answer_key_graph import normalize_option_label

        batch_stmt = select(AnswerKeyBatch).where(AnswerKeyBatch.exam_id == exam_id)
        batches = (await self.session.exec(batch_stmt)).all()
        if not batches:
            return 0

        total_newly_mapped = 0

        # Batch pre-fetch all questions and options for this exam to eliminate N+1 queries
        q_stmt = select(Question).where(Question.exam_id == exam_id)
        questions = (await self.session.exec(q_stmt)).all()
        q_by_num = {q.question_number_in_paper: q for q in questions if q.question_number_in_paper is not None}
        q_ids = [q.id for q in questions if q.id is not None]

        opts_by_qid: dict[int, list[QuestionOption]] = {}
        if q_ids:
            opts_stmt = select(QuestionOption).where(col(QuestionOption.question_id).in_(q_ids))
            for opt in (await self.session.exec(opts_stmt)).all():
                if opt.question_id:
                    opts_by_qid.setdefault(opt.question_id, []).append(opt)

        for batch in batches:
            mappings_stmt = select(AnswerKeyMapping).where(AnswerKeyMapping.batch_id == batch.id)
            mappings = (await self.session.exec(mappings_stmt)).all()

            for mapping in mappings:
                question = q_by_num.get(mapping.printed_question_number)
                if not question:
                    continue

                mapping.question_id = question.id
                norm_target_label = normalize_option_label(mapping.detected_option_label)

                options = opts_by_qid.get(question.id, [])

                found_opt = False
                for opt in options:
                    if normalize_option_label(opt.option_label) == norm_target_label:
                        opt.is_correct = True
                        found_opt = True
                    else:
                        opt.is_correct = False
                    self.session.add(opt)

                if found_opt:
                    mapping.mapping_status = MappingStatus.APPLIED
                    mapping.notes = f"Correct answer set to '{norm_target_label}'"
                    total_newly_mapped += 1
                else:
                    mapping.mapping_status = MappingStatus.CONFLICT_FLAGGED
                    mapping.notes = f"Option choice '{norm_target_label}' not found among options for Question #{mapping.printed_question_number}"

                self.session.add(mapping)

            # Recalculate total mapped keys for batch
            applied_count = sum(1 for m in mappings if m.mapping_status == MappingStatus.APPLIED)
            batch.total_keys_mapped = applied_count
            self.session.add(batch)

        await self.session.commit()

        from app.cache import get_cache, invalidate_exam_cache
        cache = get_cache()
        await cache.delete_pattern("ep:answer_keys:batches:*")
        await cache.delete_pattern("ep:answer_keys:batch:*")
        await invalidate_exam_cache(str(exam_id))

        logger.info(
            f"✅ [ANSWER KEY DB REMAP COMPLETE] Successfully mapped {total_newly_mapped} answer keys from DB for Exam ID {exam_id}"
        )
        return total_newly_mapped
