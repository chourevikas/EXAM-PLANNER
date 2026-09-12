import asyncio
import io
import json
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
        cleaned = relative_destination.lstrip("/\\")
        target = (self.base_dir / cleaned).resolve()
        if not target.is_relative_to(self.base_dir):
            raise ValueError(
                f"Path traversal detected: '{relative_destination}' escapes base directory '{self.base_dir}'"
            )
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

        if not src.exists() or not src.is_file():
            direct_p = Path(relative_path).resolve()
            if direct_p.exists() and direct_p.is_file():
                src = direct_p
            else:
                raise FileNotFoundError(
                    f"Storage file not found at '{src}' or direct path '{relative_path}'."
                )

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
        try:
            target = self._resolve_path(relative_path)
            return await aiofiles.os.path.exists(target)
        except ValueError:
            return False

    async def upload_json(self, data: dict, relative_destination: str) -> str:
        target = self._resolve_path(relative_destination)
        content = json.dumps(data, indent=2, ensure_ascii=False)
        async with aiofiles.open(target, mode="w", encoding="utf-8") as f:
            await f.write(content)
        return relative_destination

    async def download_json(self, relative_path: str) -> dict:
        try:
            target = self._resolve_path(relative_path)
            async with aiofiles.open(target, mode="r", encoding="utf-8") as f:
                content = await f.read()
            return json.loads(content)
        except FileNotFoundError:
            raise FileNotFoundError(f"JSON file not found at '{relative_path}'")

    async def generate_presigned_url(
        self, relative_path: str, expiration_seconds: int = 3600
    ) -> str:
        # In local storage, return public asset URL or path
        return self.get_public_url(relative_path)

    async def delete_file(self, relative_path: str) -> bool:
        try:
            target = self._resolve_path(relative_path)
            await aiofiles.os.remove(target)
            return True
        except (FileNotFoundError, ValueError):
            return False
        except Exception:
            return False



