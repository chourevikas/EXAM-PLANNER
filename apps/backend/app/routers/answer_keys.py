import uuid
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, UploadFile, File, Form, Depends, BackgroundTasks
from sqlmodel.ext.asyncio.session import AsyncSession
from app.db.session import get_async_session
from app.db.models import AnswerKeyBatch
from app.services.answer_key_service import AnswerKeyService


router = APIRouter(prefix="/exams", tags=["Answer Keys & Mapping"])


@router.post("/answer-key/upload")
async def upload_answer_key_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(
        ...,
        description="Uploaded Answer Key PDF filename following 4-token format e.g. 'upsc_cse-prelims-gs1-2023.pdf'",
    ),
    set_code: Optional[str] = Form(
        default="SET_A", description="Paper set code e.g. 'SET_A', 'SET_B', 'SET_C', 'SET_D'"
    ),
    run_mode: Optional[str] = Form(
        default="auto", description="'celery', 'background', or 'auto'"
    ),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Uploads an Answer Key PDF/image.
    Extracts and validates tokens directly from filename: 'exam_name-stage-subject-year'
    Example: 'upsc_cse-prelims-gs1-2023.pdf'
    """
    service = AnswerKeyService(session)
    return await service.handle_answer_key_upload(
        file=file, set_code=set_code, run_mode=run_mode, background_tasks=background_tasks
    )


@router.get("/answer-key/batches", response_model=List[AnswerKeyBatch])
async def list_answer_key_batches(session: AsyncSession = Depends(get_async_session)):
    """Fetches all answer key extraction batches."""
    service = AnswerKeyService(session)
    return await service.list_batches()


@router.get("/answer-key/batches/{batch_id}")
async def get_answer_key_batch_detail(
    batch_id: uuid.UUID, session: AsyncSession = Depends(get_async_session)
):
    """Fetches detailed answer key mapping log for a batch."""
    service = AnswerKeyService(session)
    return await service.get_batch_detail(batch_id)
