import asyncio
import io
import shutil
import aiofiles
import aiofiles.os
from pathlib import Path
from typing import Union
from PIL import Image
from app.storage.base import BaseStorageProvider


class LocalStorageProvider(BaseStorageProvider):
    def __init__(self, base_dir: Union[str, Path] = "./storage_data"):
        self.base_dir = Path(base_dir).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _resolve_path(self, relative_destination: str) -> Path:
        target = self.base_dir / relative_destination
        target.parent.mkdir(parents=True, exist_ok=True)
        return target

    async def upload_file(
        self, file_path: Union[str, Path], relative_destination: str
    ) -> str:
        src = Path(file_path).resolve()
        dst = self._resolve_path(relative_destination)
        if src != dst:
            await asyncio.to_thread(shutil.copy2, src, dst)
        return relative_destination

    async def download_file(
        self, relative_path: str, local_destination: Union[str, Path]
    ) -> Path:
        src = self._resolve_path(relative_path)
        dst = Path(local_destination).resolve()
        dst.parent.mkdir(parents=True, exist_ok=True)
        if src != dst:
            await asyncio.to_thread(shutil.copy2, src, dst)
        return dst

    async def save_image(self, image: Image.Image, relative_destination: str) -> str:
        target = self._resolve_path(relative_destination)
        fmt = "PNG" if target.suffix.lower() == ".png" else "JPEG"

        def _save():
            image.save(target, format=fmt)

        await asyncio.to_thread(_save)
        return relative_destination

    def get_public_url(self, relative_path: str) -> str:
        return str(self._resolve_path(relative_path))

    async def exists(self, relative_path: str) -> bool:
        target = self.base_dir / relative_path
        return await aiofiles.os.path.exists(target)
