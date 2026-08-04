# Module Specification: Storage Abstraction Layer (`storage/`)

## Overview
The `storage` module provides a pluggable, asynchronous storage abstraction layer for storing source PDF papers, cropped visual diagram images, formatted `.yaml` files, and `.md` files across filesystem and AWS S3 storage.

## Interface Contract (`storage/base.py`)
- `async upload_file(file_path: Union[str, Path], relative_destination: str) -> str`
- `async download_file(relative_path: str, local_destination: Union[str, Path]) -> Path`
- `async save_image(image: PIL.Image.Image, relative_destination: str) -> str`
- `def get_public_url(relative_path: str) -> str`
- `async exists(relative_path: str) -> bool`

## Implementations
1. **`LocalStorageProvider` (`storage/local.py`)**:
   - Uses `aiofiles` and `asyncio.to_thread` for non-blocking disk operations.
   - Stores files in `LOCAL_STORAGE_PATH` (Default: `./storage_data`).
2. **`S3StorageProvider` (`storage/s3.py`)**:
   - Uses `aioboto3` for non-blocking AWS S3 API calls.
   - Generates persistent S3 URLs (`https://<bucket>.s3.<region>.amazonaws.com/<key>`).
3. **Factory (`storage/factory.py`)**:
   - `get_storage_provider()` returns singleton storage instance based on `settings.STORAGE_TYPE`.
