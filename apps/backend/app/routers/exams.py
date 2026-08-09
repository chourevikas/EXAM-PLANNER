import os
import uuid
from typing import Optional, List
from fastapi import APIRouter, UploadFile, File, Form, Depends, BackgroundTasks, Query
from fastapi.responses import FileResponse
from sqlmodel.ext.asyncio.session import AsyncSession
from app.db.session import get_async_session
from app.db.models import Exam
from app.services.exam_service import ExamService
from app.services.exam_export_service import ExamExportService


router = APIRouter(prefix="/exams", tags=["Exams & Document Ingestion"])


def _remove_temp_file(path_str: str):
    """Background cleanup task to delete temporary ZIP file after download."""
    try:
        if os.path.exists(path_str):
            os.remove(path_str)
    except Exception:
        pass


@router.post("/upload")
async def upload_exam_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(
        ...,
        description="Uploaded Question Paper PDF file. Filename stem is used as canonical exam code e.g. 'UPSC_CSE_2023_GS1.pdf'",
    ),
    set_code: Optional[str] = Form(
        default="SET_A", description="Paper set code e.g. 'SET_A', 'SET_B', 'a', 'b'"
    ),
    run_mode: Optional[str] = Form(
        default="auto", description="'celery', 'background', or 'auto'"
    ),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Uploads a Question Paper PDF and initiates Pipeline 1.
    Canonical exam code is extracted from filename stem.
    Requires set_code for paper set categorization.
    """
    service = ExamService(session)
    return await service.handle_pdf_upload(
        file=file, set_code=set_code, run_mode=run_mode, background_tasks=background_tasks
    )


@router.get("", response_model=List[Exam])
async def list_exams(session: AsyncSession = Depends(get_async_session)):
    """Lists all registered competitive exams."""
    service = ExamService(session)
    return await service.list_exams()


@router.get("/export-zip")
async def download_exam_export_zip(
    background_tasks: BackgroundTasks,
    exam_name: str = Query(
        ...,
        description="Exam name in the uploaded 5-token format e.g. 'upsc_cse-prelims-gs1-2023-A' or 'upsc_cse-prelims-gs1-2023-A.pdf'",
    ),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Generates and downloads a production ZIP bundle containing all Pipeline 1-3 extracted information:
    - Per-question Markdown files (statements, options, correct answers, metadata, explanations, key takeaways, option distractor analysis).
    - Master SUMMARY_WEIGHTAGE.md (answer key & Subject/Topic/Subtopic weightage distribution).
    """
    export_service = ExamExportService(session)
    zip_path, filename = await export_service.create_exam_export_zip(exam_name)

    background_tasks.add_task(_remove_temp_file, str(zip_path))

    return FileResponse(
        path=str(zip_path),
        filename=filename,
        media_type="application/zip",
    )


@router.get("/{exam_name:path}/export-zip")
async def download_exam_export_zip_path(
    exam_name: str,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_async_session),
):
    """Path parameter alias for downloading exam export ZIP archives."""
    export_service = ExamExportService(session)
    zip_path, filename = await export_service.create_exam_export_zip(exam_name)

    background_tasks.add_task(_remove_temp_file, str(zip_path))

    return FileResponse(
        path=str(zip_path),
        filename=filename,
        media_type="application/zip",
    )


@router.get("/{exam_id}", response_model=Exam)
async def get_exam_detail(
    exam_id: uuid.UUID, session: AsyncSession = Depends(get_async_session)
):
    """Fetches details of a specific exam by ID."""
    service = ExamService(session)
    return await service.get_exam_detail(exam_id)

