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

    async def _ensure_bucket_exists(self, s3_client):
        """Ensures target S3/MinIO bucket exists and has CORS enabled for frontend direct access."""
        try:
            await s3_client.head_bucket(Bucket=self.bucket_name)
        except Exception:
            logger.info(f"S3/MinIO bucket '{self.bucket_name}' does not exist. Creating automatically...")
            try:
                if self.region_name and self.region_name != "us-east-1":
                    await s3_client.create_bucket(
                        Bucket=self.bucket_name,
                        CreateBucketConfiguration={"LocationConstraint": self.region_name},
                    )
                else:
                    await s3_client.create_bucket(Bucket=self.bucket_name)
                logger.info(f"Successfully created bucket '{self.bucket_name}'.")
            except Exception as create_err:
                logger.warning(f"Could not auto-create bucket '{self.bucket_name}': {create_err}")

        # Auto-configure CORS for web frontend clients (e.g. localhost:3000, production origins)
        if not getattr(self, "_cors_configured", False):
            try:
                cors_config = {
                    "CORSRules": [
                        {
                            "AllowedHeaders": ["*"],
                            "AllowedMethods": ["GET", "HEAD", "PUT", "POST", "DELETE"],
                            "AllowedOrigins": ["*"],
                            "ExposeHeaders": ["ETag", "x-amz-request-id"],
                            "MaxAgeSeconds": 3600,
                        }
                    ]
                }
                await s3_client.put_bucket_cors(
                    Bucket=self.bucket_name, CORSConfiguration=cors_config
                )
                self._cors_configured = True
                logger.info(f"S3 CORS policy enabled for bucket '{self.bucket_name}'.")
            except Exception as cors_err:
                logger.debug(f"Could not set S3 CORS on '{self.bucket_name}': {cors_err}")

    async def upload_file(
        self, file_path: Union[str, Path], relative_destination: str
    ) -> str:
        src_path = Path(file_path).resolve()
        logger.info(
            f"Uploading file '{src_path}' to S3 s3://{self.bucket_name}/{relative_destination}"
        )
        async with self.session.client("s3", **self._get_client_kwargs()) as s3:
            await self._ensure_bucket_exists(s3)
            await s3.upload_file(str(src_path), self.bucket_name, relative_destination)
        return relative_destination

    async def download_file(
        self, relative_path: str, local_destination: Union[str, Path]
    ) -> Path:
        dst_path = Path(local_destination).resolve()
        if dst_path.exists() and dst_path.is_file() and dst_path.stat().st_size > 0:
            logger.info(f"Local file '{dst_path}' is already cached. Skipping redundant S3 download.")
            return dst_path

        dst_path.parent.mkdir(parents=True, exist_ok=True)
        logger.info(
            f"Downloading S3 s3://{self.bucket_name}/{relative_path} to local '{dst_path}'"
        )
        async with self.session.client("s3", **self._get_client_kwargs()) as s3:
            await self._ensure_bucket_exists(s3)
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
            await self._ensure_bucket_exists(s3)
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

    async def upload_json(self, data: dict, relative_destination: str) -> str:
        import json
        content = json.dumps(data, indent=2, ensure_ascii=False).encode("utf-8")
        buffer = io.BytesIO(content)
        logger.info(
            f"Uploading JSON dict to S3 s3://{self.bucket_name}/{relative_destination}"
        )
        async with self.session.client("s3", **self._get_client_kwargs()) as s3:
            await self._ensure_bucket_exists(s3)
            await s3.upload_fileobj(
                buffer,
                self.bucket_name,
                relative_destination,
                ExtraArgs={"ContentType": "application/json"},
            )
        return relative_destination

    async def download_json(self, relative_path: str) -> dict:
        import json
        logger.info(
            f"Downloading JSON dict from S3 s3://{self.bucket_name}/{relative_path}"
        )
        async with self.session.client("s3", **self._get_client_kwargs()) as s3:
            await self._ensure_bucket_exists(s3)
            res = await s3.get_object(Bucket=self.bucket_name, Key=relative_path)
            content = await res["Body"].read()
            return json.loads(content.decode("utf-8"))

    async def generate_presigned_url(
        self, relative_path: str, expiration_seconds: int = 3600
    ) -> str:
        async with self.session.client("s3", **self._get_client_kwargs()) as s3:
            try:
                url = await s3.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": self.bucket_name, "Key": relative_path},
                    ExpiresIn=expiration_seconds,
                )
                return url
            except Exception as e:
                logger.warning(
                    f"Failed generating presigned URL for '{relative_path}': {e}. Falling back to public URL."
                )
                return self.get_public_url(relative_path)


