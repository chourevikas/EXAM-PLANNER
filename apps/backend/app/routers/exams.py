import uuid
from typing import Optional, List
from fastapi import APIRouter, UploadFile, File, Form, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_async_session
from app.db.models import Exam
from app.services.exam_service import ExamService


router = APIRouter(prefix="/exams", tags=["Exams & Document Ingestion"])


@router.post("/upload")
async def upload_exam_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Uploaded Question Paper PDF filename following 5-token format e.g. 'upsc_cse-prelims-gs1-2023-A.pdf'"),
    run_mode: Optional[str] = Form(default="auto", description="'celery', 'background', or 'auto'"),
    session: AsyncSession = Depends(get_async_session)
):
    """
    Uploads a Question Paper PDF.
    Extracts and validates tokens directly from filename: 'exam_name-stage-subject-year-set'
    Example: 'upsc_cse-prelims-gs1-2023-A.pdf'
    """
    service = ExamService(session)
    return await service.handle_pdf_upload(file=file, run_mode=run_mode, background_tasks=background_tasks)


@router.get("", response_model=List[Exam])
async def list_exams(session: AsyncSession = Depends(get_async_session)):
    """Lists all registered competitive exams."""
    service = ExamService(session)
    return await service.list_exams()


@router.get("/{exam_id}", response_model=Exam)
async def get_exam_detail(exam_id: uuid.UUID, session: AsyncSession = Depends(get_async_session)):
    """Fetches details of a specific exam by ID."""
    service = ExamService(session)
    return await service.get_exam_detail(exam_id)
