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
        run_mode: Optional[str] = "auto",
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

        # 2. Check if exam with canonical code already exists
        exam = await self.repo.get_by_code(canonical_code)

        # 3. Save uploaded file to temp directory & upload to persistent storage provider
        temp_dir = Path("./temp_uploads").resolve()
        temp_path = await save_upload_file_temp(file, temp_dir)

        storage = get_storage_provider()
        rel_path = f"uploads/question_papers/{canonical_code}/{clean_set}/{canonical_code}.pdf"
        persistent_path = await storage.upload_file(temp_path, rel_path)
        logger.info(f"Saved persistent PDF to '{persistent_path}'")
        cleanup_file(temp_path)

        # 4. Save/update Exam record in DB
        if not exam:
            exam = Exam(
                code=canonical_code,
                name=exam_name_title,
                stage=parsed_tokens["stage"],
                subject_code=parsed_tokens["subject_code"],
                source_year=parsed_tokens["year"],
                paper_set_code=clean_set,
                pdf_path=persistent_path,
                canonical_question_id_prefix=canonical_code,
            )
        else:
            exam.paper_set_code = clean_set
            exam.pdf_path = persistent_path

        exam = await self.repo.save(exam)

        # Sync/create canonical SyllabusVersion for this exam
        try:
            from app.services.syllabus_service import SyllabusService
            await SyllabusService(self.session).sync_or_create_exam_syllabus(exam.id)
        except Exception as syl_err:
            logger.warning(f"Could not auto-sync syllabus for exam '{exam.code}': {syl_err}")

        from app.cache import invalidate_exam_cache
        await invalidate_exam_cache(str(exam.id))


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
