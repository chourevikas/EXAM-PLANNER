from app.config.settings import get_settings
from app.storage.base import BaseStorageProvider
from app.storage.local import LocalStorageProvider
from app.storage.s3 import S3StorageProvider


_storage_instance: BaseStorageProvider = None


def get_storage_provider() -> BaseStorageProvider:
    global _storage_instance
    if _storage_instance is None:
        settings = get_settings()
        if settings.STORAGE_TYPE == "s3":
            _storage_instance = S3StorageProvider(
                bucket_name=settings.S3_BUCKET_NAME,
                region_name=settings.AWS_REGION,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                endpoint_url=settings.AWS_ENDPOINT_URL
            )
        else:
            _storage_instance = LocalStorageProvider(base_dir=settings.LOCAL_STORAGE_PATH)
    return _storage_instance
