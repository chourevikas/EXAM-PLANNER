import aiofiles
from pathlib import Path
from fastapi import UploadFile


async def save_upload_file_temp(file: UploadFile, temp_dir: Path) -> Path:
    """
    Asynchronously reads uploaded file content and saves it to the specified temporary directory.
    Returns the resolved Path of the temporary file.
    """
    temp_dir.mkdir(parents=True, exist_ok=True)
    temp_path = (temp_dir / file.filename).resolve()
    async with aiofiles.open(temp_path, "wb") as f:
        content = await file.read()
        await f.write(content)
    return temp_path
