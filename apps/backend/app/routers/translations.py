"""Admin: translation coverage per language, and running the translation jobs."""
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config.logger import setup_logger
from app.core.deps import require_admin_section
from app.db.models import Exam
from app.db.models.user import User
from app.db.session import get_async_session
from app.services import translation_coverage_service

logger = setup_logger("TranslationsAdmin")
router = APIRouter(prefix="/admin/translations", tags=["Admin: Translations"])
admin_only = require_admin_section("admin.translations")


@router.get("", summary="Translation coverage per exam and language")
async def get_translation_coverage(
    _admin: User = Depends(admin_only),
    session: AsyncSession = Depends(get_async_session),
):
    """Questions, options, explanations and option analyses in English, Hindi and Marathi, per exam."""
    return await translation_coverage_service.coverage(session)


async def _translate_exam(exam_id: int, force: bool = False) -> None:
    from app.config.settings import get_settings
    if not get_settings().ENABLE_TRANSLATION_PIPELINE:
        logger.info(f"🚫 [TRANSLATION DISABLED] Skipping _translate_exam for Exam #{exam_id}")
        return

    from app.db.session import async_session_factory
    from app.services.translation_service import QuestionTranslationService

    async with async_session_factory() as s:
        await QuestionTranslationService(s).translate_exam(exam_id, force_retranslate=force)


async def _translate_all() -> None:
    from app.config.settings import get_settings
    if not get_settings().ENABLE_TRANSLATION_PIPELINE:
        logger.info("🚫 [TRANSLATION DISABLED] Skipping _translate_all")
        return

    from app.db.session import async_session_factory
    from app.services.translation_service import QuestionTranslationService

    async with async_session_factory() as s:
        await QuestionTranslationService(s).reconcile_all_missing_translations()


@router.post("/exams/{exam_id}", status_code=status.HTTP_202_ACCEPTED, summary="Translate what's missing for one exam")
async def translate_exam_now(
    exam_id: int,
    background_tasks: BackgroundTasks,
    force: bool = False,
    _admin: User = Depends(admin_only),
    session: AsyncSession = Depends(get_async_session),
):
    """Translates the exam's missing questions, options, passages, explanations and analyses (Hindi, Marathi)."""
    exam = await session.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    if not force and await translation_coverage_service.is_translating(session, exam_id):
        raise HTTPException(status_code=409, detail="This exam is already being translated.")
    try:
        from app.tasks.celery_app import has_active_celery_workers
        from app.tasks.translation_tasks import translate_exam_questions_task

        if has_active_celery_workers():
            translate_exam_questions_task.delay(exam_id)
        else:
            background_tasks.add_task(_translate_exam, exam_id, force)
    except Exception as err:
        logger.warning(f"Celery dispatch failed ({err}); translating exam {exam_id} in the background")
        background_tasks.add_task(_translate_exam, exam_id, force)
    return {"status": "QUEUED", "exam_id": exam_id, "force": force}


@router.post("/run-all", status_code=status.HTTP_202_ACCEPTED, summary="Translate what's missing for every exam")
async def translate_everything_now(
    background_tasks: BackgroundTasks,
    _admin: User = Depends(admin_only),
    session: AsyncSession = Depends(get_async_session),
):
    """The same backfill the nightly job does, started now."""
    if await translation_coverage_service.is_translating(session):
        raise HTTPException(status_code=409, detail="A translation is already running. Try again when it finishes.")
    try:
        from app.tasks.celery_app import has_active_celery_workers
        from app.tasks.translation_tasks import reconcile_missing_translations_task

        if has_active_celery_workers():
            reconcile_missing_translations_task.delay()
        else:
            background_tasks.add_task(_translate_all)
    except Exception as err:
        logger.warning(f"Celery dispatch failed ({err}); translating all exams in the background")
        background_tasks.add_task(_translate_all)
    return {"status": "QUEUED"}
