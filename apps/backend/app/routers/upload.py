import uuid
from fastapi import APIRouter, File, UploadFile, Form, HTTPException, status
from app.services.s3_service import s3_service
from app.core.logging import logger

router = APIRouter(tags=["Exam Paper Upload"])

@router.post("/upload")
@router.post("/api/v1/upload")
@router.post("/api/v1/admin/upload-paper")
async def upload_exam_paper(
    file: UploadFile = File(...),
    exam_name: str = Form(...),
    year: str = Form(...),
    paper_type: str = Form("gs_1"),
):
    """
    Upload Exam PDF paper to AWS S3 Storage and register metadata.
    """
    if not file.filename.endswith(".pdf") and file.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF format files are supported for exam paper uploads.",
        )

    try:
        # Generate clean unique filename
        file_ext = file.filename.split(".")[-1]
        unique_filename = f"{exam_name}_{year}_{paper_type}_{uuid.uuid4().hex[:8]}.{file_ext}"

        # Upload file using S3 Service (S3 or local fallback)
        result = s3_service.upload_file(
            file_obj=file.file,
            filename=unique_filename,
            content_type=file.content_type or "application/pdf",
        )

        return {
            "success": True,
            "message": result["message"],
            "filename": unique_filename,
            "original_filename": file.filename,
            "s3_key": result["s3_key"],
            "s3_url": result["s3_url"],
            "storage_type": result["storage_type"],
            "exam_name": exam_name,
            "year": year,
            "paper_type": paper_type,
        }
    except Exception as e:
        logger.error(f"Upload error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process PDF upload: {str(e)}",
        )
