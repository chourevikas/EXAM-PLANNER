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


async def _ensure_local_pdf(pdf_path_or_key: str, storage) -> Path:
    """Checks if PDF file is already cached locally in temp_pdf_cache to prevent redundant S3 downloads."""
    # 1. Direct path check
    p = Path(pdf_path_or_key).resolve()
    if p.exists() and p.is_file() and p.stat().st_size > 0:
        return p

    # 2. Cached in temp_pdf_cache check
    temp_dir = Path("./temp_pdf_cache").resolve()
    temp_dir.mkdir(parents=True, exist_ok=True)
    local_target = temp_dir / Path(pdf_path_or_key).name
    if local_target.exists() and local_target.is_file() and local_target.stat().st_size > 0:
        return local_target

    # 3. Download from Storage Provider (S3/Local)
    return await storage.download_file(pdf_path_or_key, local_target)


async def get_pdf_total_pages(pdf_path_or_key: str) -> int:
    """Asynchronously reads total page count, reusing local temp_pdf_cache if present."""
    storage = get_storage_provider()
    local_file = await _ensure_local_pdf(pdf_path_or_key, storage)

    def _read():
        from pypdf import PdfReader

        reader = PdfReader(str(local_file))
        return len(reader.pages)

    return await asyncio.to_thread(_read)


async def load_pdf_page_image_lazily(
    pdf_path_or_key: str, page_number_1_based: int
) -> Image.Image:
    """Asynchronously loads a single PDF page image lazily, reusing local temp_pdf_cache if present."""
    storage = get_storage_provider()
    local_file = await _ensure_local_pdf(pdf_path_or_key, storage)

    def _convert():
        try:
            import pypdfium2 as pdfium

            pdf = pdfium.PdfDocument(str(local_file))
            page = pdf[page_number_1_based - 1]
            image = page.render(scale=200 / 72).to_pil()
            pdf.close()
            return image
        except Exception as pypdfium_err:  # noqa: BLE001
            try:
                images = convert_from_path(
                    str(local_file),
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
    1. TABLES: Convert tables directly into standard Markdown tables (| Col 1 | Col 2 |). Do NOT crop tables.
    2. MATHEMATICAL EQUATIONS: Convert formulas into valid LaTeX syntax ($...$ or $$...$$). Do NOT crop math formulas.
    3. DIAGRAMS & FIGURES: ONLY return bounding boxes `[ymin, xmin, ymax, xmax]` for actual visual figures/maps/charts.
    4. COMPLETENESS FLAG (`is_complete`): Set `is_complete: false` on ANY question where the stem or options cut off at page seams.
    5. PASSAGE COMPLETENESS (`is_complete`): Set `is_complete: false` on any reading passage/case study that continues onto the next page.
    6. CONTINUATION FRAGMENTS: If Page {page_num} top starts with trailing options (C, D) or statements belonging to Q#{page_num - 1}, set `is_continuation_fragment: true`, `target_parent_question_number`, and `target_parent_section_code`.
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
