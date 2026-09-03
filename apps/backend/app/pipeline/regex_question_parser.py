"""Deterministic regex question parser for EXPLAINED_QA PDF formats.

Parses OCR-generated full markdown into structured QuestionRecord objects:
- Q_HEADER: [Subject: ...] [Topic: ...] [Sub-topic: ...] [Difficulty: ...]
- Stem (including numbered statements)
- Options (A)-(D)
- Answer line
- Solution text and bullets
- Common Mistake
- Reverse Logic Box per-option reasoning
- Cross-page stitching without repeated headers
- Picture and table disambiguation by vertical coordinates
"""
from typing import List, Dict, Optional, Any, Tuple
import re
from pydantic import BaseModel, Field

from app.db.models.enums import DifficultyLevel
from app.pipeline.patterns import (
    PAGE_BREAK_PATTERN,
    Q_HEADER_PATTERN,
    OPTION_LINE_PATTERN,
    ANSWER_LINE_PATTERN,
    SOLUTION_HEADER_PATTERN,
    SOLUTION_BULLET_PATTERN,
    COMMON_MISTAKE_HEADER_PATTERN,
    REVERSE_LOGIC_HEADER_PATTERN,
    REVERSE_LOGIC_OPTION_PATTERN,
    STATEMENT_LINE_PATTERN,
    SUBJECT_TAG_PATTERN,
    TOPIC_TAG_PATTERN,
    SUBTOPIC_TAG_PATTERN,
    DIFFICULTY_TAG_PATTERN,
    extract_header_tags,
)
from app.config.logger import setup_logger

logger = setup_logger("RegexQuestionParser")


class QuestionRecord(BaseModel):
    question_number: int
    subject_raw: Optional[str] = None
    topic_raw: Optional[str] = None
    subtopic_raw: Optional[str] = None
    difficulty_raw: Optional[str] = None
    difficulty: DifficultyLevel = Field(default=DifficultyLevel.MEDIUM)

    stem: str
    statement_lines: List[str] = Field(default_factory=list)
    options: Dict[str, str] = Field(default_factory=dict)
    answer_label: str = Field(default="")
    answer_text: Optional[str] = None

    solution_text: str = Field(default="")
    solution_bullets: List[str] = Field(default_factory=list)
    common_mistake: Optional[str] = None
    reverse_logic: Dict[str, Dict[str, str]] = Field(default_factory=dict)

    page_numbers: List[int] = Field(default_factory=list)
    pictures: List[Dict[str, Any]] = Field(default_factory=list)
    tables: List[Dict[str, Any]] = Field(default_factory=list)

    extraction_confidence: float = Field(default=1.0)
    extraction_issues: List[str] = Field(default_factory=list)


def map_difficulty(diff_str: Optional[str]) -> DifficultyLevel:
    """Maps raw difficulty string to DifficultyLevel enum."""
    if not diff_str:
        return DifficultyLevel.MEDIUM
    d = diff_str.strip().lower()
    if any(w in d for w in ("easy", "simple", "basic")):
        return DifficultyLevel.EASY
    if any(w in d for w in ("tough", "hard", "difficult", "advanced")):
        return DifficultyLevel.HARD
    return DifficultyLevel.MEDIUM


def detect_format(full_markdown: str) -> str:
    """Heuristic format detector: checks for repeated Answer and Solution lines."""
    ans_matches = len(ANSWER_LINE_PATTERN.findall(full_markdown))
    sol_matches = len(SOLUTION_HEADER_PATTERN.findall(full_markdown))

    if ans_matches >= 1 and sol_matches >= 1:
        return "EXPLAINED_QA"
    return "RAW_EXAM"


def split_into_question_blocks(full_markdown: str) -> List[Dict[str, Any]]:
    """Splits full document markdown into question blocks on Q_HEADER matches.
    
    Extracts page provenance from <!-- PAGE_BREAK p={n} --> sentinels
    while cleaning them out of the block text.
    """
    # Pre-normalize question headers:
    # 1. If Q<N> appears on the same line after punctuation, ensure it starts on a newline
    norm_md = re.sub(r'([^\n])\s+(Q\s*\d+\s*[\.:\-])', r'\1\n\2', full_markdown)
    # 2. If 'Q' is split across a newline before digits, join them onto a newline
    norm_md = re.sub(r'(?i)\bQ\s*[\.:\-]?\s*\n\s*(\d+)', r'\nQ\1', norm_md)

    matches = list(Q_HEADER_PATTERN.finditer(norm_md))
    if not matches:
        return []

    full_markdown = norm_md

    blocks = []
    num_matches = len(matches)

    # Initial page before any page breaks
    initial_page = 1
    first_break = PAGE_BREAK_PATTERN.search(full_markdown[: matches[0].start()])
    if first_break:
        initial_page = int(first_break.group(1))

    current_page = initial_page

    for i in range(num_matches):
        start_pos = matches[i].start()
        end_pos = matches[i + 1].start() if i + 1 < num_matches else len(full_markdown)

        raw_block = full_markdown[start_pos:end_pos]
        q_num = int(matches[i].group(1))
        header_remainder = matches[i].group(2)

        # Track page numbers that appear in or before this block
        block_pages = []
        # Check if there was a page break before this block
        pre_breaks = list(PAGE_BREAK_PATTERN.finditer(full_markdown[:start_pos]))
        if pre_breaks:
            current_page = int(pre_breaks[-1].group(1))
        block_pages.append(current_page)

        # Find all page breaks inside this block
        inner_breaks = list(PAGE_BREAK_PATTERN.finditer(raw_block))
        for ib in inner_breaks:
            p_num = int(ib.group(1))
            if p_num not in block_pages:
                block_pages.append(p_num)
            current_page = p_num

        # Clean PAGE_BREAK markers from block text
        clean_block = PAGE_BREAK_PATTERN.sub("", raw_block).strip()

        # Find first line of the block as the header line
        header_line = clean_block.split("\n")[0] if clean_block else ""

        blocks.append(
            {
                "question_number": q_num,
                "header_line": header_line,
                "header_remainder": header_remainder,
                "raw_text": raw_block,
                "clean_text": clean_block,
                "page_numbers": sorted(list(set(block_pages))),
                "start_page": block_pages[0] if block_pages else current_page,
            }
        )

    return blocks


def disambiguate_asset_question(
    asset_bbox: Optional[List[float]],
    asset_page: int,
    current_q_pages: List[int],
    next_q_start_page: Optional[int],
    next_q_header_y: Optional[float] = None,
) -> bool:
    """Explicit vertical tie-breaking for pictures/tables on pages shared between two questions.

    Returns True if the asset belongs to the current question, False if it belongs to the next.
    """
    # If the asset is on a page that the current question spans, but not the next question's start page:
    if next_q_start_page is None or asset_page < next_q_start_page:
        return asset_page in current_q_pages

    # If the asset is on a page where the next question begins:
    if asset_page == next_q_start_page:
        if asset_bbox is not None and next_q_header_y is not None:
            # Check bbox vertical coordinate (top or ymin).
            # If docling bbox is [l, t, r, b] or [ymin, xmin, ymax, xmax]:
            asset_top = asset_bbox[1] if len(asset_bbox) > 1 else 0
            # If asset is above the next question's header, it belongs to the current question
            return asset_top < next_q_header_y
        # Default tie-break: if page is shared, question continuation gets assets in top half
        return False

    return False


def parse_question_block(
    block: Dict[str, Any],
    pictures: Optional[List[Dict[str, Any]]] = None,
    tables: Optional[List[Dict[str, Any]]] = None,
    next_q_start_page: Optional[int] = None,
    next_q_header_y: Optional[float] = None,
) -> QuestionRecord:
    """Parses a single cleaned question block into a structured QuestionRecord."""
    clean_text = block.get("clean_text") or block.get("raw_text", "")
    q_num = block["question_number"]
    header_line = block["header_line"]
    page_numbers = block["page_numbers"]

    issues: List[str] = []
    confidence = 1.0

    # 2. Split Block into Sections:
    # Stem + Options | Answer | Solution | Common Mistake | Reverse Logic Box
    lines = clean_text.split("\n")

    # Find boundaries
    first_opt_idx = None
    ans_idx = None
    sol_idx = None
    mistake_idx = None
    reverse_idx = None

    for idx, line in enumerate(lines):
        line_str = line.strip()
        if idx == 0:
            continue

        if first_opt_idx is None and OPTION_LINE_PATTERN.match(line_str):
            first_opt_idx = idx

        if ans_idx is None and ANSWER_LINE_PATTERN.match(line_str):
            ans_idx = idx

        if sol_idx is None and SOLUTION_HEADER_PATTERN.match(line_str):
            sol_idx = idx

        if mistake_idx is None and COMMON_MISTAKE_HEADER_PATTERN.match(line_str):
            mistake_idx = idx

        if reverse_idx is None and REVERSE_LOGIC_HEADER_PATTERN.match(line_str):
            reverse_idx = idx

    # 1. Extract Tags from Header Line and any subsequent tag lines before stem
    stem_end = first_opt_idx if first_opt_idx is not None else (ans_idx if ans_idx is not None else len(lines))
    header_block = [header_line]
    clean_stem_lines = []

    for l in lines[1:stem_end]:
        l_str = l.strip()
        if not l_str:
            continue
        # Check if line contains metadata tags
        has_tag = any(
            p.search(l_str)
            for p in (SUBJECT_TAG_PATTERN, TOPIC_TAG_PATTERN, SUBTOPIC_TAG_PATTERN, DIFFICULTY_TAG_PATTERN)
        )
        if has_tag:
            header_block.append(l_str)
        else:
            clean_stem_lines.append(l_str)

    full_header_text = " ".join(header_block)
    tags = extract_header_tags(full_header_text)
    subject_raw = tags["subject_raw"]
    topic_raw = tags["topic_raw"]
    subtopic_raw = tags["subtopic_raw"]
    difficulty_raw = tags["difficulty_raw"]
    difficulty = map_difficulty(difficulty_raw)

    # 3. Stem Extraction
    stem = "\n".join(clean_stem_lines).strip()

    statement_lines = []
    for sl in clean_stem_lines:
        sm = STATEMENT_LINE_PATTERN.match(sl.strip())
        if sm:
            statement_lines.append(sm.group(1).strip())

    if not stem:
        issues.append("EMPTY_STEM")
        confidence -= 0.35

    # 4. Options Extraction (A)-(D)
    options: Dict[str, str] = {}
    if first_opt_idx is not None:
        opts_end = ans_idx if ans_idx is not None else (sol_idx if sol_idx is not None else len(lines))
        current_opt_label = None
        current_opt_text: List[str] = []

        for line in lines[first_opt_idx:opts_end]:
            om = OPTION_LINE_PATTERN.match(line.strip())
            if om:
                if current_opt_label:
                    options[current_opt_label] = " ".join(current_opt_text).strip()
                current_opt_label = om.group(1).upper()
                current_opt_text = [om.group(2).strip()]
            elif current_opt_label and line.strip():
                current_opt_text.append(line.strip())

        if current_opt_label:
            options[current_opt_label] = " ".join(current_opt_text).strip()

    # Validate options presence
    for req_opt in ("A", "B", "C", "D"):
        if req_opt not in options or not options[req_opt]:
            issues.append(f"MISSING_OPTION_{req_opt}")
            confidence -= 0.20

    # 5. Answer Extraction
    answer_label = ""
    answer_text = None
    if ans_idx is not None:
        ans_match = ANSWER_LINE_PATTERN.match(lines[ans_idx].strip())
        if ans_match:
            answer_label = ans_match.group(1).upper()
            answer_text = ans_match.group(2).strip() or None
    else:
        # Fallback search for Answer in text
        for line in lines:
            ans_match = ANSWER_LINE_PATTERN.match(line.strip())
            if ans_match:
                answer_label = ans_match.group(1).upper()
                answer_text = ans_match.group(2).strip() or None
                break

    if not answer_label:
        issues.append("NO_ANSWER_LINE")
        confidence -= 0.40
    elif answer_label not in ("A", "B", "C", "D") or answer_label not in options:
        issues.append("ANSWER_LABEL_NOT_IN_OPTIONS")
        confidence -= 0.25

    # 6. Solution Extraction (text and bullets)
    solution_text = ""
    solution_bullets: List[str] = []
    if sol_idx is not None:
        sol_end = mistake_idx if mistake_idx is not None else (reverse_idx if reverse_idx is not None else len(lines))
        sol_raw_lines = lines[sol_idx:sol_end]
        first_line = sol_raw_lines[0].strip()
        sh_match = SOLUTION_HEADER_PATTERN.match(first_line)

        body_lines = []
        if sh_match and sh_match.group(1).strip():
            body_lines.append(sh_match.group(1).strip())
        for l in sol_raw_lines[1:]:
            if l.strip():
                body_lines.append(l.strip())

        for bl in body_lines:
            bm = SOLUTION_BULLET_PATTERN.match(bl)
            if bm:
                solution_bullets.append(bm.group(2).strip())
            else:
                solution_bullets.append(bl)

        solution_text = "\n\n".join(solution_bullets).strip()

    if not solution_text:
        issues.append("EMPTY_SOLUTION")
        confidence -= 0.20

    # 7. Common Mistake Extraction
    common_mistake = None
    if mistake_idx is not None:
        mistake_end = reverse_idx if reverse_idx is not None else len(lines)
        first_m_line = lines[mistake_idx].strip()
        mm = COMMON_MISTAKE_HEADER_PATTERN.match(first_m_line)
        mistake_parts = [mm.group(1).strip()] if mm and mm.group(1).strip() else []
        for l in lines[mistake_idx + 1 : mistake_end]:
            if l.strip():
                mistake_parts.append(l.strip())
        if mistake_parts:
            common_mistake = " ".join(mistake_parts).strip()

    # 8. Reverse Logic Box Extraction
    reverse_logic: Dict[str, Dict[str, str]] = {}
    if reverse_idx is not None:
        rev_text = "\n".join(lines[reverse_idx:])
        for rm in REVERSE_LOGIC_OPTION_PATTERN.finditer(rev_text):
            opt_letter = rm.group(1).upper()
            why_tempting = rm.group(2).strip()
            whats_true = rm.group(3).strip()

            # Clean trailing punctuation and markdown
            why_tempting = re.sub(r"^[-–—:]\s*", "", why_tempting).strip()
            whats_true = re.sub(r"^[-–—:]\s*", "", whats_true).strip()

            reverse_logic[opt_letter] = {
                "why_tempting": why_tempting,
                "whats_actually_true": whats_true,
            }

    # 9. Matched Pictures and Tables with Vertical Disambiguation
    matched_pictures = []
    if pictures:
        for pic in pictures:
            pic_page = pic.get("page_no", 1)
            pic_bbox = pic.get("bbox")
            if pic_page in page_numbers:
                if disambiguate_asset_question(
                    pic_bbox,
                    pic_page,
                    page_numbers,
                    next_q_start_page,
                    next_q_header_y,
                ):
                    matched_pictures.append(pic)

    matched_tables = []
    if tables:
        for tbl in tables:
            tbl_page = tbl.get("page_no", 1)
            tbl_bbox = tbl.get("bbox")
            if tbl_page in page_numbers:
                if disambiguate_asset_question(
                    tbl_bbox,
                    tbl_page,
                    page_numbers,
                    next_q_start_page,
                    next_q_header_y,
                ):
                    matched_tables.append(tbl)

    confidence = round(max(0.0, min(1.0, confidence)), 3)

    return QuestionRecord(
        question_number=q_num,
        subject_raw=subject_raw,
        topic_raw=topic_raw,
        subtopic_raw=subtopic_raw,
        difficulty_raw=difficulty_raw,
        difficulty=difficulty,
        stem=stem,
        statement_lines=statement_lines,
        options=options,
        answer_label=answer_label,
        answer_text=answer_text,
        solution_text=solution_text,
        solution_bullets=solution_bullets,
        common_mistake=common_mistake,
        reverse_logic=reverse_logic,
        page_numbers=page_numbers,
        pictures=matched_pictures,
        tables=matched_tables,
        extraction_confidence=confidence,
        extraction_issues=issues,
    )
