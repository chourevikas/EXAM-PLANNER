import os
import shutil
from typing import Dict, Any
from app.config import settings
from app.config.logger import setup_logger

logger = setup_logger("S3Service")


try:
    import boto3
    from botocore.exceptions import BotoCoreError, ClientError

    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False


class S3Service:
    def __init__(self):
        self.bucket_name = getattr(
            settings, "AWS_S3_BUCKET_NAME", "examplanner-pdf-storage"
        )
        self.region = getattr(settings, "AWS_REGION", "ap-southeast-2")
        self.access_key = getattr(settings, "AWS_ACCESS_KEY_ID", "")
        self.secret_key = getattr(settings, "AWS_SECRET_ACCESS_KEY", "")

        self.s3_client = None
        if BOTO3_AVAILABLE and self.access_key and self.secret_key:
            try:
                self.s3_client = boto3.client(
                    "s3",
                    aws_access_key_id=self.access_key,
                    aws_secret_access_key=self.secret_key,
                    region_name=self.region,
                )
            except Exception as e:
                logger.warning(f"Failed to initialize boto3 S3 client: {e}")

    def upload_file(
        self, file_obj, filename: str, content_type: str = "application/pdf"
    ) -> Dict[str, Any]:
        """
        Uploads file to AWS S3 if credentials exist; falls back to local uploads directory if S3 is unconfigured.
        """
        s3_key = f"question-papers/{filename}"

        # 1. Attempt AWS S3 Upload if client is initialized
        if self.s3_client:
            try:
                file_obj.seek(0)
                self.s3_client.upload_fileobj(
                    file_obj,
                    self.bucket_name,
                    s3_key,
                    ExtraArgs={"ContentType": content_type},
                )
                s3_url = f"https://{self.bucket_name}.s3.{self.region}.amazonaws.com/{s3_key}"
                logger.info(
                    f"Successfully uploaded file {filename} to AWS S3: {s3_url}"
                )
                return {
                    "storage_type": "s3",
                    "s3_key": s3_key,
                    "s3_url": s3_url,
                    "bucket": self.bucket_name,
                    "message": "Exam paper uploaded successfully to Amazon S3 Storage!",
                }
            except Exception as e:
                logger.error(
                    f"S3 upload error for {filename}: {e}. Falling back to local storage."
                )

        # 2. Local Fallback Storage
        upload_dir = os.path.join(os.getcwd(), "uploads", "question_papers")
        os.makedirs(upload_dir, exist_ok=True)
        local_path = os.path.join(upload_dir, filename)

        file_obj.seek(0)
        with open(local_path, "wb") as buffer:
            shutil.copyfileobj(file_obj, buffer)

        logger.info(f"Saved PDF locally to {local_path}")
        return {
            "storage_type": "local",
            "s3_key": s3_key,
            "s3_url": f"http://localhost:8000/static/uploads/{filename}",
            "bucket": self.bucket_name,
            "message": "Exam paper uploaded & stored successfully!",
        }


s3_service = S3Service()
