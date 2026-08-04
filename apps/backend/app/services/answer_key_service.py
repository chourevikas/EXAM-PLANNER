import uuid
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import UploadFile, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AnswerKeyBatch
from app.repositories.exam_repository import ExamRepository
from app.repositories.answer_key_repository import AnswerKeyRepository
from app.storage.factory import get_storage_provider
from app.tasks.answer_key_tasks import process_answer_key_pdf_task, async_process_answer_key_pdf
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
        run_mode: Optional[str] = "auto",
        background_tasks: Optional[BackgroundTasks] = None
    ) -> Dict[str, Any]:
        settings = get_settings()

        # 1. Automatically extract and validate 4-token Answer Key filename format
        try:
            parsed_tokens = parse_answer_key_filename(file.filename)
        except ValueError as val_err:
            raise HTTPException(status_code=400, detail=str(val_err))

        canonical_code = parsed_tokens["canonical_code"]

        # 2. Look up matching Exams by (stage, subject_code, source_year)
        matching_exams = await self.exam_repo.find_matching_exams_for_answer_key(
            stage=parsed_tokens["stage"],
            subject_code=parsed_tokens["subject_code"],
            year=parsed_tokens["year"]
        )

        if not matching_exams:
            raise HTTPException(
                status_code=404,
                detail=f"No matching Question Paper exams found for Answer Key '{file.filename}' "
                       f"(Stage: '{parsed_tokens['stage']}', Subject: '{parsed_tokens['subject_code']}', Year: {parsed_tokens['year']}). "
                       f"Please upload Question Papers first!"
            )

        target_exam = matching_exams[0]

        # 3. Save uploaded file to temp directory & upload to persistent storage provider
        temp_dir = Path("./temp_answer_keys").resolve()
        temp_path = await save_upload_file_temp(file, temp_dir)

        storage = get_storage_provider()
        rel_path = f"answer_keys/{canonical_code}/{file.filename}"
        persistent_path = await storage.upload_file(temp_path, rel_path)
        logger.info(f"Saved persistent answer key file to '{persistent_path}'")

        # 4. Determine whether to use Celery Worker or FastAPI BackgroundTasks
        task_id = str(uuid.uuid4())
        mode = (run_mode or "auto").lower()

        if mode == "background":
            use_celery = False
        elif mode == "celery":
            use_celery = True
        else:  # "auto"
            use_celery = settings.CELERY_TASK_ALWAYS_EAGER or has_active_celery_workers()

        if use_celery:
            try:
                engine_name = "Celery Worker"
                task_res = process_answer_key_pdf_task.delay(str(target_exam.id), str(temp_path), target_exam.paper_set_code, task_id)
                task_id = task_res.id if hasattr(task_res, "id") else task_id
                execution_msg = f"Answer key task enqueued to {engine_name} (Task ID: {task_id})."
            except Exception as exc:
                engine_name = "FastAPI BackgroundTasks (Fallback)"
                logger.warning(f"Celery broker dispatch failed: {exc}. Falling back to BackgroundTasks...", exc_info=True)
                if background_tasks is not None:
                    background_tasks.add_task(async_process_answer_key_pdf, str(target_exam.id), str(temp_path), target_exam.paper_set_code, task_id, "FastAPI BackgroundTasks (Fallback)")
                execution_msg = f"Celery broker unavailable; answer key extraction started via {engine_name} (Task ID: {task_id})."
        else:
            engine_name = "FastAPI BackgroundTasks"
            logger.info(f"Dispatching Answer Key extraction via {engine_name} (Task ID: {task_id})...")
            if background_tasks is not None:
                background_tasks.add_task(async_process_answer_key_pdf, str(target_exam.id), str(temp_path), target_exam.paper_set_code, task_id, "FastAPI BackgroundTasks")
            execution_msg = f"Answer key extraction pipeline started via {engine_name} (Task ID: {task_id})."

        return {
            "message": execution_msg,
            "filename": file.filename,
            "answer_key_code": canonical_code,
            "matched_exams_count": len(matching_exams),
            "target_exam_id": str(target_exam.id),
            "task_id": task_id,
            "execution_engine": engine_name
        }

    async def list_batches(self) -> List[AnswerKeyBatch]:
        return await self.repo.list_batches()

    async def get_batch_detail(self, batch_id: uuid.UUID) -> Dict[str, Any]:
        batch = await self.repo.get_batch_by_id(batch_id)
        if not batch:
            raise HTTPException(status_code=404, detail="Answer key batch not found.")

        mappings = await self.repo.get_mappings_for_batch(batch_id)

        return {
            "batch_id": str(batch.id),
            "exam_id": str(batch.exam_id),
            "pdf_path": batch.pdf_path,
            "target_set_code": batch.target_set_code,
            "detected_set_code": batch.detected_set_code,
            "set_match_status": batch.set_match_status.value,
            "total_extracted": batch.total_keys_extracted,
            "total_mapped": batch.total_keys_mapped,
            "created_at": batch.created_at,
            "mappings": [
                {
                    "mapping_id": str(m.id),
                    "question_id": str(m.question_id) if m.question_id else None,
                    "question_number": m.printed_question_number,
                    "detected_option_label": m.detected_option_label,
                    "mapping_status": m.mapping_status.value,
                    "notes": m.notes
                } for m in mappings
            ]
        }
