"""Docling OCR Extractor for rasterized / Print-to-PDF exam documents.

Performs whole-document OCR and layout analysis in a single deterministic pass.
Extracts:
- full_markdown with explicit <!-- PAGE_BREAK p={n} --> sentinels
- pictures with bounding boxes and page provenance
- tables with markdown and bounding boxes
- page_images (PIL Images) for high-resolution asset cropping
"""
from pathlib import Path
from typing import Dict, Any, List, Optional
from PIL import Image

from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions, RapidOcrOptions
from app.config.logger import setup_logger

logger = setup_logger("DoclingOcrExtractor")


class DoclingOcrExtractor:
    """Deterministic OCR and layout extractor using Docling."""

    def __init__(self):
        pipeline_options = PdfPipelineOptions()
        pipeline_options.do_ocr = True
        pipeline_options.ocr_options = RapidOcrOptions()
        pipeline_options.do_table_structure = True
        pipeline_options.generate_page_images = True

        format_options = {
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
        }
        self.converter = DocumentConverter(format_options=format_options)

    def extract(self, pdf_path: str | Path) -> Dict[str, Any]:
        """Converts whole PDF into markdown, pictures, tables, and page images."""
        p = Path(pdf_path).resolve()
        if not p.is_file():
            raise FileNotFoundError(f"PDF file not found: {p}")

        page_images: Dict[int, Image.Image] = {}
        pictures: List[Dict[str, Any]] = []
        tables: List[Dict[str, Any]] = []

        # Check if PDF has embedded digital text layer
        has_digital_text = False
        digital_chunks: List[str] = []
        try:
            import pypdf
            reader = pypdf.PdfReader(str(p))
            digital_pages = 0
            total_p = len(reader.pages)
            for idx, page in enumerate(reader.pages):
                txt = page.extract_text() or ""
                if txt.strip():
                    digital_pages += 1
                digital_chunks.append(f"\n\n<!-- PAGE_BREAK p={idx+1} -->\n\n" + txt)

            has_digital_text = (digital_pages / max(1, total_p)) >= 0.5
        except Exception as e:
            logger.warning(f"Could not inspect digital text layer via pypdf: {e}")

        if has_digital_text:
            full_markdown = "\n\n".join(digital_chunks).strip()
            logger.info(
                f"📄 [DIGITAL TEXT LAYER DETECTED] Extracted {len(full_markdown)} chars directly across {digital_pages}/{total_p} pages."
            )
            try:
                import pdf2image
                images = pdf2image.convert_from_path(str(p), dpi=150)
                for idx, img in enumerate(images):
                    page_images[idx + 1] = img
            except Exception as e:
                logger.warning(f"Could not render page images via pdf2image: {e}")
        else:
            logger.info(f"📄 [DOCLING OCR] Rasterized PDF detected. Starting whole-document OCR conversion on {p.name}...")
            conv_res = self.converter.convert(str(p))
            doc = conv_res.document

            # 1. Page Images
            if hasattr(doc, "pages") and isinstance(doc.pages, dict):
                for page_no, page_item in doc.pages.items():
                    if hasattr(page_item, "image") and page_item.image is not None:
                        pil_img = getattr(page_item.image, "pil_image", None)
                        if pil_img:
                            page_images[int(page_no)] = pil_img

            # 2. Pictures
            if hasattr(doc, "pictures"):
                for pic in doc.pictures:
                    page_no = 1
                    bbox_coords = None
                    if hasattr(pic, "prov") and pic.prov:
                        prov = pic.prov[0]
                        page_no = getattr(prov, "page_no", 1)
                        if hasattr(prov, "bbox") and prov.bbox is not None:
                            bbox = prov.bbox
                            if hasattr(bbox, "as_tuple"):
                                bbox_coords = list(bbox.as_tuple())
                            else:
                                bbox_coords = [
                                    getattr(bbox, "l", 0.0),
                                    getattr(bbox, "t", 0.0),
                                    getattr(bbox, "r", 0.0),
                                    getattr(bbox, "b", 0.0),
                                ]
                    ref_str = pic.get_ref().cref if hasattr(pic, "get_ref") else ""
                    pictures.append(
                        {
                            "page_no": int(page_no),
                            "bbox": bbox_coords,
                            "self_ref": ref_str,
                        }
                    )

            # 3. Tables
            if hasattr(doc, "tables"):
                for tbl in doc.tables:
                    page_no = 1
                    bbox_coords = None
                    if hasattr(tbl, "prov") and tbl.prov:
                        prov = tbl.prov[0]
                        page_no = getattr(prov, "page_no", 1)
                        if hasattr(prov, "bbox") and prov.bbox is not None:
                            bbox = prov.bbox
                            if hasattr(bbox, "as_tuple"):
                                bbox_coords = list(bbox.as_tuple())
                            else:
                                bbox_coords = [
                                    getattr(bbox, "l", 0.0),
                                    getattr(bbox, "t", 0.0),
                                    getattr(bbox, "r", 0.0),
                                    getattr(bbox, "b", 0.0),
                                ]
                    tbl_md = tbl.export_to_markdown() if hasattr(tbl, "export_to_markdown") else ""
                    ref_str = tbl.get_ref().cref if hasattr(tbl, "get_ref") else ""
                    tables.append(
                        {
                            "page_no": int(page_no),
                            "bbox": bbox_coords,
                            "markdown": tbl_md,
                            "self_ref": ref_str,
                        }
                    )

            # 4. Full Markdown with Page Break Sentinels from Docling OCR
            markdown_chunks: List[str] = []
            last_page_seen: Optional[int] = None

            for item, _ in doc.iterate_items():
                item_page = None
                if hasattr(item, "prov") and item.prov:
                    item_page = getattr(item.prov[0], "page_no", None)

                if item_page is not None and item_page != last_page_seen:
                    markdown_chunks.append(f"\n\n<!-- PAGE_BREAK p={item_page} -->\n\n")
                    last_page_seen = item_page

                if hasattr(item, "export_to_markdown"):
                    chunk_text = item.export_to_markdown()
                elif hasattr(item, "text"):
                    chunk_text = item.text
                else:
                    chunk_text = str(item)

                if chunk_text and chunk_text.strip():
                    markdown_chunks.append(chunk_text.strip())

            full_markdown = "\n\n".join(markdown_chunks).strip()
            if not full_markdown:
                full_markdown = doc.export_to_markdown()

        # Normalize any Q-headers wrapped across newlines or following sentence punctuation
        import re
        full_markdown = re.sub(r'([^\n])\s+(Q\s*\d+\s*[\.:\-])', r'\1\n\2', full_markdown)
        full_markdown = re.sub(r'(?i)\bQ\s*[\.:\-]?\s*\n\s*(\d+)', r'\nQ\1', full_markdown)

        logger.info(
            f"✅ [DOCLING EXTRACTION COMPLETE] Extracted {len(full_markdown)} chars markdown, "
            f"{len(pictures)} pictures, {len(tables)} tables, {len(page_images)} page images."
        )

        return {
            "full_markdown": full_markdown,
            "pictures": pictures,
            "tables": tables,
            "page_images": page_images,
        }
