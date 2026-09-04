import asyncio
from pathlib import Path
from typing import Optional
from app.storage.factory import get_storage_provider
from app.config.logger import setup_logger

logger = setup_logger("PdfUtils")


def is_valid_pdf(file_path: Path) -> bool:
    """Validates that a PDF file exists, is non-empty, and can be opened."""
    if not file_path.exists() or not file_path.is_file() or file_path.stat().st_size <= 0:
        return False
    try:
        import pypdfium2 as pdfium
        pdf = pdfium.PdfDocument(str(file_path))
        num_pages = len(pdf)
        pdf.close()
        return num_pages > 0
    except Exception:
        try:
            from pypdf import PdfReader
            reader = PdfReader(str(file_path))
            return len(reader.pages) > 0
        except Exception:
            return False


_download_locks: dict[str, asyncio.Lock] = {}
_pdf_bytes_cache: dict[str, bytes] = {}


def get_cache_key(pdf_path_or_key: str) -> str:
    clean = str(pdf_path_or_key).replace("\\", "/").strip("/").replace("/", "_")
    if not clean.lower().endswith(".pdf"):
        clean = f"{clean}.pdf"
    return clean


def clear_pdf_cache(pdf_path_or_key: str) -> None:
    """Removes cached in-memory bytes and download locks for a PDF to release memory."""
    key = get_cache_key(pdf_path_or_key)
    _pdf_bytes_cache.pop(key, None)
    _download_locks.pop(key, None)


def seed_pdf_cache(pdf_path_or_key: str, source_path: Path) -> Path:
    """Copies source_path into temp_pdf_cache under the cache key for pdf_path_or_key to avoid re-downloading."""
    try:
        temp_dir = Path("./temp_pdf_cache").resolve()
        temp_dir.mkdir(parents=True, exist_ok=True)
        clean_name = get_cache_key(pdf_path_or_key)
        local_target = temp_dir / clean_name
        src = Path(source_path).resolve()
        if src.exists() and src != local_target:
            import shutil
            shutil.copy2(src, local_target)
        return local_target
    except Exception as e:
        logger.warning(f"Failed to seed PDF cache for {pdf_path_or_key}: {e}")
        return Path(source_path).resolve()


async def ensure_local_pdf(pdf_path_or_key: str, storage=None) -> Path:
    """Checks if PDF file is already cached locally in temp_pdf_cache to prevent redundant downloads."""
    p = Path(pdf_path_or_key)
    if p.is_file() and is_valid_pdf(p):
        return p.resolve()

    temp_dir = Path("./temp_pdf_cache").resolve()
    temp_dir.mkdir(parents=True, exist_ok=True)
    clean_name = get_cache_key(pdf_path_or_key)
    local_target = temp_dir / clean_name
    if is_valid_pdf(local_target):
        return local_target

    if clean_name not in _download_locks:
        _download_locks[clean_name] = asyncio.Lock()

    async with _download_locks[clean_name]:
        if is_valid_pdf(local_target):
            return local_target

        if local_target.exists():
            try:
                local_target.unlink()
            except Exception:
                pass

        s3_key = str(pdf_path_or_key).replace("\\", "/").strip("/")
        if "/uploads/" in s3_key:
            s3_key = "uploads/" + s3_key.split("/uploads/", 1)[1]
        elif "/temp_uploads/" in s3_key:
            local_fallback = Path(pdf_path_or_key)
            if local_fallback.is_file() and is_valid_pdf(local_fallback):
                return local_fallback.resolve()

        if storage is None:
            storage = get_storage_provider()
        downloaded = await storage.download_file(s3_key, local_target)
        downloaded_path = Path(downloaded).resolve()
        if not is_valid_pdf(downloaded_path):
            raise RuntimeError(
                f"Downloaded PDF file '{s3_key}' to '{downloaded_path}' is corrupted or empty."
            )
        return downloaded_path


async def get_pdf_bytes(pdf_path_or_key: str) -> bytes:
    """Returns in-memory bytes of the PDF file, caching globally."""
    key = get_cache_key(pdf_path_or_key)
    if key in _pdf_bytes_cache:
        return _pdf_bytes_cache[key]

    local_file = await ensure_local_pdf(pdf_path_or_key)
    pdf_bytes = local_file.read_bytes()
    _pdf_bytes_cache[key] = pdf_bytes
    return pdf_bytes


async def get_pdf_total_pages(pdf_path_or_key: str) -> int:
    """Asynchronously reads total page count from PDF."""
    try:
        local_path = await ensure_local_pdf(pdf_path_or_key)
        import pypdfium2 as pdfium
        pdf = pdfium.PdfDocument(str(local_path))
        count = len(pdf)
        pdf.close()
        return count
    except Exception:
        pdf_bytes = await get_pdf_bytes(pdf_path_or_key)
        from pypdf import PdfReader
        import io
        reader = PdfReader(io.BytesIO(pdf_bytes))
        return len(reader.pages)


async def load_pdf_page_image_lazily(pdf_path_or_key: str, page_number: int):
    """Loads and renders a single PDF page image on demand using pypdfium2."""
    local_path = await ensure_local_pdf(pdf_path_or_key)
    import pypdfium2 as pdfium
    pdf = pdfium.PdfDocument(str(local_path))
    if page_number < 1 or page_number > len(pdf):
        pdf.close()
        raise ValueError(f"Page number {page_number} out of range (1..{len(pdf)})")
    page = pdf[page_number - 1]
    pil_image = page.render(scale=2.0).to_pil()
    pdf.close()
    return pil_image
