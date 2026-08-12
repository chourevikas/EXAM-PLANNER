from abc import ABC, abstractmethod
from pathlib import Path
from typing import Union
from PIL import Image


class BaseStorageProvider(ABC):
    @abstractmethod
    async def upload_file(
        self, file_path: Union[str, Path], relative_destination: str
    ) -> str:
        """Asynchronously uploads a file to storage and returns reference key."""
        pass

    @abstractmethod
    async def download_file(
        self, relative_path: str, local_destination: Union[str, Path]
    ) -> Path:
        """Asynchronously downloads a file from storage to local path."""
        pass

    @abstractmethod
    async def save_image(self, image: Image.Image, relative_destination: str) -> str:
        """Asynchronously saves a PIL Image directly into storage."""
        pass

    @abstractmethod
    def get_public_url(self, relative_path: str) -> str:
        """Returns accessible URL or path for a file reference."""
        pass

    @abstractmethod
    async def exists(self, relative_path: str) -> bool:
        """Asynchronously checks if a file exists in storage."""
        pass

    @abstractmethod
    async def upload_json(self, data: dict, relative_destination: str) -> str:
        """Asynchronously uploads a JSON dictionary directly into storage."""
        pass

    @abstractmethod
    async def download_json(self, relative_path: str) -> dict:
        """Asynchronously downloads and parses a JSON file from storage."""
        pass



# Alias for backward compatibility
StorageProvider = BaseStorageProvider
