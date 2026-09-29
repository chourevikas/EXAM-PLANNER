"""Docling OCR Extractor for rasterized / Print-to-PDF exam documents.

Performs whole-document OCR and layout analysis in a single deterministic pass.
Extracts:
- full_markdown with explicit <!-- PAGE_BREAK p={n} --> sentinels
- pictures with bounding boxes and page provenance
- tables with markdown and bounding boxes
- page_images (PIL Images) for high-resolution asset cropping
"""
import re
from collections import Counter
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from PIL import Image

from app.config.logger import setup_logger

logger = setup_logger("DoclingOcrExtractor")

# Scale digital pages are rendered at; picture/table bboxes are stored in these pixel coordinates
DIGITAL_RENDER_SCALE = 1.5
# Embedded images smaller than this (PDF points, either side) are icons or bullets, not diagrams
MIN_PICTURE_SIDE_PT = 40
# Running header/footer: a first/last page line repeated on at least this share of pages
FURNITURE_MIN_PAGE_SHARE = 0.5
BARE_PAGE_NUMBER_PATTERN = re.compile(r"(?i)^\s*(?:page\s*)?\d{1,4}(?:\s*(?:/|of)\s*\d{1,4})?\s*$")


# WinAnsiEncoding maps its unused codes to the bullet (PDF 1.7, Annex D) and ReportLab draws "•" as
# code 127, which pypdf returns as DEL and pdfplumber as "(cid:127)"
UNDECODED_BULLET_PATTERN = re.compile(r"\x7f|\(cid:127\)")


def fix_undecoded_bullets(text: str) -> str:
    return UNDECODED_BULLET_PATTERN.sub("•", text)


def picture_marker(pic_id: int) -> str:
    """Placeholder left in the markdown where a picture sits, so it attaches to the right question."""
    return f"<!-- PICTURE id={pic_id} -->"


def table_marker(tbl_id: int) -> str:
    """Placeholder put just before an inline markdown table, recording which table it is."""
    return f"<!-- TABLE id={tbl_id} -->"


def rows_to_markdown(rows: List[List[Optional[str]]], header: bool = True) -> str:
    """GFM table from extracted cell rows (first row is the header); empty rows/columns dropped.

    With header=False only body rows are produced, for a table continued from the previous page.
    """
    def cell(v: Optional[str]) -> str:
        return re.sub(r"\s+", " ", (v or "")).strip().replace("|", "\\|")

    grid = [[cell(v) for v in row] for row in rows if row and any(cell(v) for v in row)]
    if not grid:
        return ""
    width = max(len(r) for r in grid)
    grid = [r + [""] * (width - len(r)) for r in grid]
    keep = [c for c in range(width) if any(r[c] for r in grid)]
    grid = [[r[c] for c in keep] for r in grid]
    if not keep:
        return ""
    body = ["| " + " | ".join(r) + " |" for r in grid]
    if not header:
        return "\n".join(body)
    return "\n".join([body[0], "|" + "---|" * len(keep)] + body[1:])


def _markdown_table_columns(md: str) -> int:
    first = md.split("\n", 1)[0].strip()
    return len(re.findall(r"(?<!\\)\|", first)) - 1


def _furniture_key(text: str, ignore_page_number: bool = True) -> str:
    key = re.sub(r"\s+", " ", text).strip().lower()
    # A trailing page number ("... Mentorship 9") must not make every page's header unique
    return re.sub(r"\d+\s*$", "#", key) if ignore_page_number else key


def _line_segments(line: Dict[str, Any], gap_pt: float = 20.0) -> List[str]:
    """Split a text line into its visually separate runs (e.g. a header's left and right halves)."""
    chars = [c for c in line.get("chars", []) if c.get("text")]
    if not chars:
        return [line["text"].strip()] if line.get("text", "").strip() else []
    segments: List[str] = []
    current = chars[0]["text"]
    for prev, ch in zip(chars, chars[1:]):
        if ch["x0"] - prev["x1"] > gap_pt:
            segments.append(current)
            current = ""
        elif ch["x0"] - prev["x1"] > 1.0 and not current.endswith(" ") and ch["text"] != " ":
            current += " "
        current += ch["text"]
    segments.append(current)
    return [re.sub(r"\s+", " ", s).strip() for s in segments if s.strip()]


def _edge_furniture_indexes(lines: List[Dict[str, Any]], furniture: set) -> set:
    """Indexes of header/footer lines: walking in from the top and bottom edge (at most two lines
    each way), every line that is a known running header/footer or a bare page number."""
    def is_furniture(i: int) -> bool:
        text = lines[i]["text"]
        return (
            _furniture_key(text) in furniture
            or _furniture_key(text, ignore_page_number=False) in furniture
            or bool(BARE_PAGE_NUMBER_PATTERN.match(text))
        )

    found = set()
    for order in (range(len(lines)), range(len(lines) - 1, -1, -1)):
        for step, i in enumerate(order):
            if step >= 2 or not is_furniture(i):
                break
            found.add(i)
    return found


def detect_page_furniture(pages_lines: List[List[Dict[str, Any]]]) -> set:
    """Normalized text of running headers/footers: page-edge lines repeated across most pages.

    Only the first and last line of a page count, plus the line next to them when that edge line
    is itself furniture (two-line headers). Text that also occurs mid-page is content.
    """
    if len(pages_lines) < 2:
        return set()
    needed = max(2, int(len(pages_lines) * FURNITURE_MIN_PAGE_SHARE + 0.999))

    # Text that also appears mid-page somewhere is content, never a running header/footer
    body_keys = set()
    for lines in pages_lines:
        for l in lines[2:-2]:
            body_keys |= {_furniture_key(l["text"]), _furniture_key(l["text"], ignore_page_number=False)}

    def repeated(keys_per_page: List[set]) -> set:
        counts: Counter = Counter(k for keys in keys_per_page for k in keys if k and k != "#")
        return {k for k, n in counts.items() if n >= needed and k not in body_keys}

    furniture = repeated([
        {_furniture_key(lines[0]["text"]), _furniture_key(lines[-1]["text"])} if lines else set()
        for lines in pages_lines
    ])
    inner = []
    for lines in pages_lines:
        edges = _edge_furniture_indexes(lines, furniture)
        keys = set()
        # The inner line of a two-line header must repeat exactly (page numbers sit on the edge line)
        if 0 in edges and len(lines) > 2:
            keys.add(_furniture_key(lines[1]["text"], ignore_page_number=False))
        if len(lines) - 1 in edges and len(lines) > 2:
            keys.add(_furniture_key(lines[-2]["text"], ignore_page_number=False))
        inner.append(keys)
    return furniture | repeated(inner)


def strip_furniture_from_text(text: str, segments: List[str], page_number_texts: List[str]) -> str:
    """Remove running header/footer runs from content-stream text, where they may be glued to content."""
    for seg in sorted(set(segments), key=len, reverse=True):
        if len(seg) >= 8:
            text = text.replace(seg, "\n")
    out_lines = [l for l in text.split("\n") if l.strip() not in page_number_texts]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(out_lines))


def _inside(obj: Dict[str, Any], bbox: Tuple[float, float, float, float]) -> bool:
    x0, top, x1, bottom = bbox
    cx = (obj["x0"] + obj["x1"]) / 2
    cy = (obj["top"] + obj["bottom"]) / 2
    return x0 <= cx <= x1 and top <= cy <= bottom


def extract_digital_layout(pdf_path: str, pypdf_texts: List[str]) -> Tuple[str, List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Markdown for a PDF with a text layer, keeping tables (as GFM) and pictures (as markers) in place.

    Pages without tables or pictures keep their content-stream text (`pypdf_texts`), which follows
    the author's reading order (multi-column layouts included). Pages with tables or pictures are
    rebuilt top-to-bottom from positioned lines, with each table/picture inserted at its position.
    Running headers/footers and bare page numbers are removed from every page.
    """
    import pdfplumber

    pictures: List[Dict[str, Any]] = []
    tables: List[Dict[str, Any]] = []
    chunks: List[str] = []

    # Table that ended the previous page: a page that opens with a table of the same width
    # continues it, so its rows join that table (same entry, no new header or marker)
    prev_page_table_id: Optional[int] = None

    with pdfplumber.open(pdf_path) as pdf:
        pages_lines = [page.extract_text_lines(return_chars=True) for page in pdf.pages]
        furniture = detect_page_furniture(pages_lines)

        for idx, page in enumerate(pdf.pages):
            page_no = idx + 1
            lines = pages_lines[idx]
            furniture_idx = _edge_furniture_indexes(lines, furniture)

            found_tables = []
            for tbl in page.find_tables():
                rows = tbl.extract()
                # A bordered box (callout, question header) is a 1-column "table"; only real grids count
                if len(rows) >= 2 and max((len(r) for r in rows), default=0) >= 2:
                    md = rows_to_markdown(rows)
                    if md:
                        found_tables.append((tbl.bbox, md, rows))

            found_pictures = []
            for img in page.images:
                w, h = img["x1"] - img["x0"], img["bottom"] - img["top"]
                if w >= MIN_PICTURE_SIDE_PT and h >= MIN_PICTURE_SIDE_PT:
                    found_pictures.append((img["x0"], img["top"], img["x1"], img["bottom"]))

            if not found_tables and not found_pictures:
                segments = [s for i in furniture_idx for s in _line_segments(lines[i])]
                page_numbers = [lines[i]["text"].strip() for i in furniture_idx if BARE_PAGE_NUMBER_PATTERN.match(lines[i]["text"])]
                page_text = pypdf_texts[idx] if idx < len(pypdf_texts) else ""
                chunks.append(f"\n\n<!-- PAGE_BREAK p={page_no} -->\n\n" + strip_furniture_from_text(page_text, segments, page_numbers))
                prev_page_table_id = None
                continue

            # (top, text) items sorted top-to-bottom; tables/pictures replace the text they cover
            items: List[Tuple] = []
            table_boxes = [bbox for bbox, _, _ in found_tables]
            for i, line in enumerate(lines):
                if i in furniture_idx:
                    continue
                if any(_inside(line, box) for box in table_boxes):
                    continue
                items.append((line["top"], line["text"]))

            scaled = lambda b: [round(v * DIGITAL_RENDER_SCALE, 1) for v in b]
            first_text_top = min((top for top, _ in items), default=float("inf"))
            for bbox, md, rows in found_tables:
                continues = (
                    prev_page_table_id is not None
                    and bbox[1] < first_text_top
                    and _markdown_table_columns(md) == _markdown_table_columns(tables[prev_page_table_id]["markdown"])
                )
                if continues:
                    md = rows_to_markdown(rows, header=False)
                    tables[prev_page_table_id]["markdown"] += "\n" + md
                    items.append((bbox[1], f"\n{md}\n", prev_page_table_id))
                    continue
                tbl_id = len(tables)
                tables.append({"id": tbl_id, "page_no": page_no, "bbox": scaled(bbox), "markdown": md, "self_ref": ""})
                items.append((bbox[1], f"\n{table_marker(tbl_id)}\n{md}\n", tbl_id))
            for bbox in found_pictures:
                pic_id = len(pictures)
                pictures.append({"id": pic_id, "page_no": page_no, "bbox": scaled(bbox), "self_ref": ""})
                items.append((bbox[1], picture_marker(pic_id), None))

            items = [it if len(it) == 3 else (it[0], it[1], None) for it in items]
            items.sort(key=lambda it: it[0])
            prev_page_table_id = items[-1][2] if items else None
            chunks.append(f"\n\n<!-- PAGE_BREAK p={page_no} -->\n\n" + "\n".join(text for _, text, _ in items))

    return "\n\n".join(chunks).strip(), pictures, tables


class DoclingOcrExtractor:
    """Deterministic OCR and layout extractor using Docling."""

    def __init__(self):
        self._converter = None

    def _get_converter(self):
        if self._converter is None:
            logger.info("📄 [DOCLING OCR] Initializing DocumentConverter for rasterized document...")
            from docling.document_converter import DocumentConverter, PdfFormatOption
            from docling.datamodel.base_models import InputFormat
            from docling.datamodel.pipeline_options import PdfPipelineOptions, RapidOcrOptions, TableFormerMode

            pipeline_options = PdfPipelineOptions()
            pipeline_options.do_ocr = True
            pipeline_options.ocr_options = RapidOcrOptions()
            # Match-the-list and data questions carry tables; FAST TableFormer keeps their rows/columns
            pipeline_options.do_table_structure = True
            pipeline_options.table_structure_options.mode = TableFormerMode.FAST
            pipeline_options.generate_page_images = True

            format_options = {
                InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
            }
            self._converter = DocumentConverter(format_options=format_options)
        return self._converter

    @staticmethod
    def _docling_markdown_and_assets(doc, page_images: Dict[int, Image.Image]) -> Tuple[str, List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Reading-order markdown plus picture/table records, with bboxes in top-left page-image pixels."""
        from docling_core.types.doc import PictureItem, TableItem

        def bbox_in_image(item) -> Tuple[int, Optional[List[float]]]:
            if not getattr(item, "prov", None):
                return 1, None
            prov = item.prov[0]
            page_no = int(getattr(prov, "page_no", 1))
            if prov.bbox is None:
                return page_no, None
            page = doc.pages.get(page_no) if isinstance(getattr(doc, "pages", None), dict) else None
            if page is None or page.size is None:
                return page_no, list(prov.bbox.as_tuple())
            # Docling bboxes are PDF points, usually with a bottom-left origin; images are top-left pixels
            box = prov.bbox.to_top_left_origin(page_height=page.size.height)
            img = page_images.get(page_no)
            scale = (img.size[0] / page.size.width) if img is not None and page.size.width else 1.0
            return page_no, [round(v * scale, 1) for v in (box.l, box.t, box.r, box.b)]

        pictures: List[Dict[str, Any]] = []
        tables: List[Dict[str, Any]] = []
        chunks: List[str] = []
        last_page_seen: Optional[int] = None

        for item, _ in doc.iterate_items():
            item_page = None
            if getattr(item, "prov", None):
                item_page = getattr(item.prov[0], "page_no", None)
            if item_page is not None and item_page != last_page_seen:
                chunks.append(f"\n\n<!-- PAGE_BREAK p={item_page} -->\n\n")
                last_page_seen = item_page

            ref_str = item.get_ref().cref if hasattr(item, "get_ref") else ""
            if isinstance(item, PictureItem):
                page_no, bbox = bbox_in_image(item)
                pic_id = len(pictures)
                pictures.append({"id": pic_id, "page_no": page_no, "bbox": bbox, "self_ref": ref_str})
                chunks.append(picture_marker(pic_id))
                continue
            if isinstance(item, TableItem):
                page_no, bbox = bbox_in_image(item)
                tbl_md = item.export_to_markdown(doc=doc).strip()
                if not tbl_md:
                    continue
                tbl_id = len(tables)
                tables.append({"id": tbl_id, "page_no": page_no, "bbox": bbox, "markdown": tbl_md, "self_ref": ref_str})
                chunks.append(f"{table_marker(tbl_id)}\n{tbl_md}")
                continue

            if hasattr(item, "export_to_markdown"):
                chunk_text = item.export_to_markdown()
            elif hasattr(item, "text"):
                chunk_text = item.text
            else:
                chunk_text = str(item)
            if chunk_text and chunk_text.strip():
                chunks.append(chunk_text.strip())

        full_markdown = "\n\n".join(chunks).strip()
        if not full_markdown:
            full_markdown = doc.export_to_markdown()
        return full_markdown, pictures, tables

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
        digital_texts: List[str] = []
        try:
            import pypdf
            reader = pypdf.PdfReader(str(p))
            digital_pages = 0
            total_p = len(reader.pages)
            for idx, page in enumerate(reader.pages):
                txt = page.extract_text() or ""
                if txt.strip():
                    digital_pages += 1
                digital_texts.append(txt)
                digital_chunks.append(f"\n\n<!-- PAGE_BREAK p={idx+1} -->\n\n" + txt)

            has_digital_text = (digital_pages / max(1, total_p)) >= 0.5
        except Exception as e:
            logger.warning(f"Could not inspect digital text layer via pypdf: {e}")

        if has_digital_text:
            try:
                full_markdown, pictures, tables = extract_digital_layout(str(p), digital_texts)
            except Exception as e:
                logger.warning(f"Layout-aware digital extraction failed ({e}); using plain text layer without tables/pictures.")
                full_markdown = "\n\n".join(digital_chunks).strip()
                pictures, tables = [], []
            full_markdown = fix_undecoded_bullets(full_markdown)
            for tbl in tables:
                tbl["markdown"] = fix_undecoded_bullets(tbl["markdown"])
            logger.info(
                f"📄 [DIGITAL TEXT LAYER DETECTED] Extracted {len(full_markdown)} chars, {len(tables)} tables, "
                f"{len(pictures)} pictures across {digital_pages}/{total_p} pages."
            )
            try:
                import pypdfium2 as pdfium
                pdf = pdfium.PdfDocument(str(p))
                for idx, page in enumerate(pdf):
                    page_images[idx + 1] = page.render(scale=DIGITAL_RENDER_SCALE).to_pil()
            except Exception as e:
                logger.warning(f"Could not render page images via pypdfium2: {e}, falling back to pdf2image...")
                try:
                    import pdf2image
                    images = pdf2image.convert_from_path(str(p), dpi=int(72 * DIGITAL_RENDER_SCALE))
                    for idx, img in enumerate(images):
                        page_images[idx + 1] = img
                except Exception as e2:
                    logger.warning(f"Could not render page images via pdf2image: {e2}")
        else:
            logger.info(f"📄 [DOCLING OCR] Rasterized PDF detected. Starting whole-document OCR conversion on {p.name}...")
            converter = self._get_converter()
            conv_res = converter.convert(str(p))
            doc = conv_res.document

            # 1. Page Images
            if hasattr(doc, "pages") and isinstance(doc.pages, dict):
                for page_no, page_item in doc.pages.items():
                    if hasattr(page_item, "image") and page_item.image is not None:
                        pil_img = getattr(page_item.image, "pil_image", None)
                        if pil_img:
                            page_images[int(page_no)] = pil_img

            # 2-4. Pictures, tables and reading-order markdown. Tables stay inline as GFM markdown;
            # pictures leave a marker where they sit so they attach to the question around them.
            full_markdown, pictures, tables = self._docling_markdown_and_assets(doc, page_images)

        # Normalize any Q-headers wrapped across newlines or following sentence punctuation
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
