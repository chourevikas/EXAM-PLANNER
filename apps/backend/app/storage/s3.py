import io
import asyncio
from typing import Union, Optional
from pathlib import Path
from PIL import Image
import aioboto3
from app.storage.base import BaseStorageProvider
from app.config.settings import get_settings
from app.config.logger import setup_logger


logger = setup_logger("S3StorageProvider")


class S3StorageProvider(BaseStorageProvider):
    def __init__(
        self,
        bucket_name: Optional[str] = None,
        region_name: Optional[str] = None,
        aws_access_key_id: Optional[str] = None,
        aws_secret_access_key: Optional[str] = None,
        endpoint_url: Optional[str] = None,
    ):
        settings = get_settings()
        self.bucket_name = bucket_name or settings.S3_BUCKET_NAME
        self.region_name = region_name or settings.AWS_REGION
        self.aws_access_key_id = aws_access_key_id or settings.AWS_ACCESS_KEY_ID
        self.aws_secret_access_key = (
            aws_secret_access_key or settings.AWS_SECRET_ACCESS_KEY
        )
        self.endpoint_url = endpoint_url or settings.AWS_ENDPOINT_URL

        self.session = aioboto3.Session(
            aws_access_key_id=self.aws_access_key_id,
            aws_secret_access_key=self.aws_secret_access_key,
            region_name=self.region_name,
        )

    def _get_client_kwargs(self):
        kwargs = {}
        if self.endpoint_url:
            kwargs["endpoint_url"] = self.endpoint_url
        return kwargs

    async def upload_file(
        self, file_path: Union[str, Path], relative_destination: str
    ) -> str:
        src_path = Path(file_path).resolve()
        logger.info(
            f"Uploading file '{src_path}' to S3 s3://{self.bucket_name}/{relative_destination}"
        )
        async with self.session.client("s3", **self._get_client_kwargs()) as s3:
            await s3.upload_file(str(src_path), self.bucket_name, relative_destination)
        return relative_destination

    async def download_file(
        self, relative_path: str, local_destination: Union[str, Path]
    ) -> Path:
        dst_path = Path(local_destination).resolve()
        dst_path.parent.mkdir(parents=True, exist_ok=True)
        logger.info(
            f"Downloading S3 s3://{self.bucket_name}/{relative_path} to local '{dst_path}'"
        )
        async with self.session.client("s3", **self._get_client_kwargs()) as s3:
            await s3.download_file(self.bucket_name, relative_path, str(dst_path))
        return dst_path

    async def save_image(self, image: Image.Image, relative_destination: str) -> str:
        buffer = io.BytesIO()
        img_format = "PNG" if relative_destination.lower().endswith(".png") else "JPEG"
        image.save(buffer, format=img_format)
        buffer.seek(0)

        logger.info(
            f"Uploading PIL Image to S3 s3://{self.bucket_name}/{relative_destination}"
        )
        async with self.session.client("s3", **self._get_client_kwargs()) as s3:
            await s3.upload_fileobj(buffer, self.bucket_name, relative_destination)

        return relative_destination

    def get_public_url(self, relative_path: str) -> str:
        if self.endpoint_url:
            return f"{self.endpoint_url.rstrip('/')}/{self.bucket_name}/{relative_path}"
        return f"https://{self.bucket_name}.s3.{self.region_name}.amazonaws.com/{relative_path}"

    async def exists(self, relative_path: str) -> bool:
        async with self.session.client("s3", **self._get_client_kwargs()) as s3:
            try:
                await s3.head_object(Bucket=self.bucket_name, Key=relative_path)
                return True
            except Exception:
                return False
