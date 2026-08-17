import asyncio
import base64
import io
from pathlib import Path
from typing import Optional

from langchain_core.messages import HumanMessage, SystemMessage
from pdf2image import convert_from_path
from PIL import Image

from app.llm.factory import get_vision_llm
from app.pipeline.state import PageExtractionPayload
from app.storage.factory import get_storage_provider
from app.config.logger import setup_logger

logger = setup_logger("VisionExtractor")


def _is_valid_pdf(file_path: Path) -> bool:
    """Validates that a PDF file exists, is non-empty, and can be successfully opened by PyPDFium2."""
    if not file_path.exists() or not file_path.is_file() or file_path.stat().st_size <= 0:
        return False
    try:
        import pypdfium2 as pdfium
        pdf = pdfium.PdfDocument(str(file_path))
        num_pages = len(pdf)
        pdf.close()
        return num_pages > 0
    except Exception:
        return False


_download_locks: dict[str, asyncio.Lock] = {}
_pdf_bytes_cache: dict[str, bytes] = {}


def _get_cache_key(pdf_path_or_key: str) -> str:
    clean = str(pdf_path_or_key).replace("\\", "/").strip("/").replace("/", "_")
    if not clean.lower().endswith(".pdf"):
        clean = f"{clean}.pdf"
    return clean


def clear_pdf_cache(pdf_path_or_key: str) -> None:
    """Removes cached in-memory bytes for a PDF to release memory."""
    key = _get_cache_key(pdf_path_or_key)
    _pdf_bytes_cache.pop(key, None)
    _download_locks.pop(key, None)


async def _ensure_local_pdf(pdf_path_or_key: str, storage) -> Path:
    """Checks if PDF file is already cached locally in temp_pdf_cache to prevent redundant S3 downloads."""
    # 1. Direct local path check
    p = Path(pdf_path_or_key)
    if p.is_file() and _is_valid_pdf(p):
        return p.resolve()

    # 2. Cached in temp_pdf_cache check with unique storage-path-derived filename
    temp_dir = Path("./temp_pdf_cache").resolve()
    temp_dir.mkdir(parents=True, exist_ok=True)
    clean_name = _get_cache_key(pdf_path_or_key)
    local_target = temp_dir / clean_name
    if _is_valid_pdf(local_target):
        return local_target

    # Acquire per-file download lock to avoid race conditions between parallel page workers
    if clean_name not in _download_locks:
        _download_locks[clean_name] = asyncio.Lock()

    async with _download_locks[clean_name]:
        # Double check after acquiring lock
        if _is_valid_pdf(local_target):
            return local_target

        if local_target.exists():
            try:
                local_target.unlink()
            except Exception:
                pass

        # 3. Clean S3 Key
        s3_key = str(pdf_path_or_key).replace("\\", "/").strip("/")
        if "/uploads/" in s3_key:
            s3_key = "uploads/" + s3_key.split("/uploads/", 1)[1]
        elif "/temp_uploads/" in s3_key:
            local_fallback = Path(pdf_path_or_key)
            if local_fallback.is_file() and _is_valid_pdf(local_fallback):
                return local_fallback.resolve()

        # 4. Download from Storage Provider (S3/Local)
        downloaded = await storage.download_file(s3_key, local_target)
        downloaded_path = Path(downloaded).resolve()
        if not _is_valid_pdf(downloaded_path):
            raise RuntimeError(
                f"Downloaded PDF file '{s3_key}' to '{downloaded_path}' is corrupted or empty."
            )
        return downloaded_path


async def get_pdf_bytes(pdf_path_or_key: str) -> bytes:
    """Returns in-memory bytes of the PDF file, caching globally so S3 download occurs exactly ONCE."""
    key = _get_cache_key(pdf_path_or_key)
    if key in _pdf_bytes_cache:
        return _pdf_bytes_cache[key]

    storage = get_storage_provider()
    local_file = await _ensure_local_pdf(pdf_path_or_key, storage)
    pdf_bytes = local_file.read_bytes()
    _pdf_bytes_cache[key] = pdf_bytes
    return pdf_bytes


async def get_pdf_total_pages(pdf_path_or_key: str) -> int:
    """Asynchronously reads total page count from in-memory cached PDF bytes."""
    pdf_bytes = await get_pdf_bytes(pdf_path_or_key)

    def _read():
        from pypdf import PdfReader
        import io

        reader = PdfReader(io.BytesIO(pdf_bytes))
        return len(reader.pages)

    return await asyncio.to_thread(_read)


import threading

_pdf_render_lock = threading.Lock()


async def load_pdf_page_image_lazily(
    pdf_path_or_key: str, page_number_1_based: int
) -> Image.Image:
    """Asynchronously loads a single PDF page image lazily using the cached in-memory PDF bytes."""
    pdf_bytes = await get_pdf_bytes(pdf_path_or_key)

    last_err = None
    for attempt in range(1, 4):
        try:
            def _convert():
                with _pdf_render_lock:
                    try:
                        import pypdfium2 as pdfium

                        pdf = pdfium.PdfDocument(pdf_bytes)
                        try:
                            page = pdf[page_number_1_based - 1]
                            image = page.render(scale=200 / 72).to_pil()
                            return image
                        finally:
                            pdf.close()
                    except Exception as pypdfium_err:  # noqa: BLE001
                        try:
                            storage = get_storage_provider()
                            local_file = Path("./temp_pdf_cache") / _get_cache_key(pdf_path_or_key)
                            images = convert_from_path(
                                str(local_file.resolve()),
                                dpi=200,
                                first_page=page_number_1_based,
                                last_page=page_number_1_based,
                            )
                            if not images:
                                raise ValueError(
                                    f"Could not load page {page_number_1_based} from {pdf_path_or_key}"
                                )
                            return images[0]
                        except Exception as poppler_err:  # noqa: BLE001
                            raise RuntimeError(
                                f"Failed to render page {page_number_1_based} of '{pdf_path_or_key}'. "
                                f"pypdfium2 error: {pypdfium_err}; poppler error: {poppler_err}"
                            ) from poppler_err

            return await asyncio.to_thread(_convert)
        except Exception as exc:
            last_err = exc
            logger.warning(
                f"⚠️ Page {page_number_1_based} rendering attempt {attempt}/3 failed: {exc}. Retrying..."
            )
            await asyncio.sleep(0.3)

    raise RuntimeError(
        f"Failed to load PDF page {page_number_1_based} after 3 attempts: {last_err}"
    )


def encode_pil_image(img: Image.Image) -> str:
    buffered = io.BytesIO()
    img.save(buffered, format="JPEG", quality=90)
    return base64.b64encode(buffered.getvalue()).decode("utf-8")


async def ainvoke_extraction_llm(
    image: Image.Image,
    page_num: int,
    active_context_memory: Optional[str] = None,
) -> PageExtractionPayload:
    base64_img = await asyncio.to_thread(encode_pil_image, image)
    
    context_str = ""
    if active_context_memory:
        context_str = (
            f"\n    ACTIVE MEMORY CONTEXT FROM PRECEDING PAGE (Page {page_num - 1}):\n"
            f"    {active_context_memory}\n"
            f"    Use this active memory context to identify reading passages, case studies, or trailing questions spanning from Page {page_num - 1}.\n"
        )

    system_prompt = f"""
    You are an expert Document AI Vision Engine for competitive exam papers. Processing PDF Page {page_num}.
    {context_str}
    PER-PAGE LAYOUT INSTRUCTION:
    1. Inspect Page {page_num}'s structural layout (`detected_layout_type`):
       - SINGLE_COLUMN: Read top to bottom across full page width.
       - DUAL_COLUMN_VERTICAL: Read LEFT column top-to-bottom FIRST, then RIGHT column top-to-bottom.
       - MIXED_INSTRUCTION_TOP_DUAL_BOTTOM: Read full-width top header FIRST, then split into vertical columns.
    
    EXTRACTION & COMPLETENESS LAWS:
    1. PRINTED QUESTION NUMBERS: You MUST extract the exact integer printed on the page for every question (e.g. "Q. 15", "15.", "(15)" -> `printed_question_number: 15`). NEVER set `printed_question_number: null` if a question number is visible!
    2. PASSAGES & DIRECTIONS: Extract reading passages, case studies, or direction headers ("Directions for Q. 6 to 10") into `new_context_memories` with `target_question_range`. Do NOT model standalone passages as questions!
    3. BILINGUAL EXTRACTION: For bilingual exam papers (e.g. English & Hindi), create one entry under `translations` for ENGLISH and one entry under `translations` for HINDI for every question!
    4. TABLES: Convert tables directly into standard Markdown tables (| Col 1 | Col 2 |). Do NOT crop tables.
    5. MATHEMATICAL EQUATIONS: Convert formulas into valid LaTeX syntax ($...$ or $$...$$). Do NOT crop math formulas.
    6. DIAGRAMS & FIGURES: ONLY return bounding boxes `[ymin, xmin, ymax, xmax]` for actual visual figures/maps/charts.
    7. COMPLETENESS FLAG (`is_complete`): Set `is_complete: false` on ANY question where the stem or options cut off at page seams.
    8. PASSAGE COMPLETENESS (`is_complete`): Set `is_complete: false` on any reading passage/case study that continues onto the next page.
    9. CONTINUATION FRAGMENTS: If Page {page_num} top starts with trailing options (C, D) or statements belonging to a question from Page {page_num - 1}, set `is_continuation_fragment: true`, `target_parent_question_number`, and `target_parent_section_code`.
    """

    message = HumanMessage(
        content=[
            {
                "type": "text",
                "text": f"Extract all questions, section keys, LaTeX math, and diagram coordinates for Page {page_num}.",
            },
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{base64_img}",
                    "detail": "high",
                },
            },
        ]
    )

    llm = get_vision_llm().with_structured_output(PageExtractionPayload)
    return await llm.ainvoke([SystemMessage(content=system_prompt), message])
