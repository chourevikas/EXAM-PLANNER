import uuid
from typing import Optional, List, Dict, Any
from fastapi import BackgroundTasks, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models import LanguageCode
from app.repositories.explanation_repository import ExplanationRepository
from app.tasks.explanation_tasks import (
    process_exam_explanations_task,
    async_process_exam_explanations,
)
from app.tasks.celery_app import has_active_celery_workers
from app.config.settings import get_settings
from app.services.task_registry import task_registry


class ExplanationService:
    """Service handling business logic for Phase 3 Question Knowledge Bases and Explanations."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = ExplanationRepository(session)

    async def generate_explanations_for_exam(
        self,
        exam_id: int,
        question_ids: Optional[List[int | str]] = None,
        language: str = "ENGLISH",
        run_mode: Optional[str] = "auto",
        background_tasks: Optional[BackgroundTasks] = None,
    ) -> Dict[str, Any]:
        settings = get_settings()
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
                task_res = process_exam_explanations_task.delay(
                    str(exam_id),
                    question_ids=[str(q) for q in question_ids] if question_ids else None,
                    language=language,
                    task_id=task_id,
                )
                task_registry.register_celery_task(str(exam_id), task_res.id)
            except Exception:
                engine_name = "FastAPI BackgroundTasks (Fallback)"
                if background_tasks:
                    background_tasks.add_task(
                        async_process_exam_explanations,
                        exam_id_str=str(exam_id),
                        question_ids_str=[str(q) for q in question_ids]
                        if question_ids
                        else None,
                        language=language,
                        task_id=task_id,
                        execution_engine=engine_name,
                    )
                else:
                    import asyncio

                    t = asyncio.create_task(
                        async_process_exam_explanations(
                            exam_id_str=str(exam_id),
                            question_ids_str=[str(q) for q in question_ids]
                            if question_ids
                            else None,
                            language=language,
                            task_id=task_id,
                            execution_engine=engine_name,
                        )
                    )
                    task_registry.register_async_task(str(exam_id), t)
        else:
            engine_name = "FastAPI BackgroundTasks"
            if background_tasks:
                background_tasks.add_task(
                    async_process_exam_explanations,
                    exam_id_str=str(exam_id),
                    question_ids_str=[str(q) for q in question_ids]
                    if question_ids
                    else None,
                    language=language,
                    task_id=task_id,
                    execution_engine=engine_name,
                )
            else:
                import asyncio

                t = asyncio.create_task(
                    async_process_exam_explanations(
                        exam_id_str=str(exam_id),
                        question_ids_str=[str(q) for q in question_ids]
                        if question_ids
                        else None,
                        language=language,
                        task_id=task_id,
                        execution_engine=engine_name,
                    )
                )
                task_registry.register_async_task(str(exam_id), t)

        return {
            "status": "PROCESSING_STARTED",
            "exam_id": str(exam_id),
            "language": language,
            "task_id": task_id,
            "execution_engine": engine_name,
        }

    async def get_question_explanation_report(
        self, question_id: int, language: str = "ENGLISH"
    ) -> Dict[str, Any]:
        try:
            lang_enum = LanguageCode(language.upper())
        except ValueError:
            lang_enum = LanguageCode.ENGLISH

        from app.cache import get_cache, build_cache_key
        cache = get_cache()
        cache_key = build_cache_key("explanations:detail", str(question_id), lang=lang_enum.value)
        cached_data = await cache.get(cache_key)
        if cached_data is not None:
            return cached_data

        kb = await self.repo.get_full_question_knowledge_base(question_id, lang_enum)
        if not kb:
            raise HTTPException(status_code=404, detail="Question knowledge base not found.")
        await cache.set(cache_key, kb, ttl_seconds=3600)
        return kb

    async def set_canonical_question_link(
        self, question_id: int, canonical_question_id: int
    ) -> Dict[str, Any]:
        success = await self.repo.set_canonical_question(question_id, canonical_question_id)
        if not success:
            raise HTTPException(status_code=404, detail="Target question not found.")

        from app.cache import get_cache, invalidate_question_cache
        cache = get_cache()
        await cache.delete_pattern(f"ep:explanations:detail:{question_id}*")
        await invalidate_question_cache(str(question_id))

        return {
            "message": "Canonical question link updated successfully.",
            "question_id": str(question_id),
            "canonical_question_id": str(canonical_question_id),
        }
