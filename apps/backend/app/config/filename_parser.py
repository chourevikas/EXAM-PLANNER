import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional, Union

QP_FILENAME_REGEX = re.compile(
    r"^([a-zA-Z0-9_]+)-([a-zA-Z0-9_]+)-([a-zA-Z0-9_]+)-(\d{4})-([a-zA-Z0-9_]+)(?:\.[a-zA-Z0-9]+)?$"
)

AK_FILENAME_REGEX = re.compile(
    r"^([a-zA-Z0-9_]+)-([a-zA-Z0-9_]+)-([a-zA-Z0-9_]+)-(\d{4})(?:\.[a-zA-Z0-9]+)?$"
)

ALLOWED_SET_INPUTS = {
    "SET_A", "SET_B", "SET_C", "SET_D",
    "SET_1", "SET_2", "SET_3", "SET_4",
    "A", "B", "C", "D",
    "1", "2", "3", "4",
}


def sanitize_set_code(raw_set: Optional[str], default: str = "SET_A") -> str:
    """Validates and normalizes set code to standard SET_X format."""
    if not raw_set or not str(raw_set).strip():
        return default
    cleaned = str(raw_set).strip().upper()
    if cleaned not in ALLOWED_SET_INPUTS:
        return default
    return cleaned if cleaned.startswith("SET_") else f"SET_{cleaned}"


def _normalize_exam_name(exam_name: Optional[str], default: str = "UPSC") -> str:
    if not exam_name:
        return default
    cleaned = str(exam_name).strip().upper()
    if cleaned in ("USPC", "UPSC", "UPSE"):
        return "UPSC"
    return cleaned


def _validate_year(year: Optional[Union[int, str]], fallback_stem: str = "") -> int:
    if year is not None and str(year).strip() != "":
        try:
            val = int(year)
            if 1900 <= val <= 2100:
                return val
        except (ValueError, TypeError):
            pass

    # Extract 4-digit year from filename stem (e.g. 2024 in UPSC_CSE_2024_GS1_SET_A)
    year_match = re.search(r"(?:^|[^0-9])(19\d{2}|20\d{2})(?:[^0-9]|$)", fallback_stem)
    if year_match:
        return int(year_match.group(1))

    return datetime.now(timezone.utc).year


def parse_question_paper_filename(
    filename_or_code: str,
    year: Optional[Union[int, str]] = None,
    user_set_code: Optional[str] = None,
    exam_name: Optional[str] = None,
    stage: Optional[str] = None,
    subject_code: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Dynamically parses Question Paper filename or code.
    Strictly guarantees that canonical_code is always formatted in all lowercase.
    """
    normalized_path = str(filename_or_code).replace("\\", "/")
    clean_filename = Path(normalized_path).name
    stem = Path(normalized_path).stem.strip()

    # 1. Year Validation
    norm_year = _validate_year(year, fallback_stem=stem)

    # 2. Exam Name & Stage Normalization
    extracted_exam = exam_name
    if not extracted_exam:
        exam_match = re.search(r"\b(UPSC|MPPSC|MPSC|BPSC|UPPCS|SSC|GATE|CAT|CDS|NDA)\b", stem, re.IGNORECASE)
        if exam_match:
            extracted_exam = exam_match.group(1)

    norm_exam_name = _normalize_exam_name(extracted_exam, default="UPSC")

    extracted_stage = stage
    if not extracted_stage:
        if re.search(r"\b(MAINS|MAIN)\b", stem, re.IGNORECASE):
            extracted_stage = "MAINS"
        else:
            extracted_stage = "PRELIMS"
    norm_stage = str(extracted_stage).strip().upper()

    # 3. Dynamic Subject Extraction
    extracted_subj = subject_code
    if not extracted_subj:
        subj_match = re.search(r"\b(GS1|GS2|GS3|GS4|GS-1|GS-2|CSAT|POLITY|ECONOMY|GEOGRAPHY|SCIENCE)\b", stem, re.IGNORECASE)
        if subj_match:
            extracted_subj = subj_match.group(1).replace("-", "")
        else:
            extracted_subj = "GS1"
    norm_subj = str(extracted_subj).strip().upper()

    # 4. Dynamic Set Code Extraction
    final_set_code = sanitize_set_code(user_set_code, default="SET_A")
    if not user_set_code:
        set_match = re.search(r"(?:SET[-_]?([A-D1-4])|[-_]([A-D1-4]))$", stem, re.IGNORECASE)
        if set_match:
            st = set_match.group(1) or set_match.group(2)
            final_set_code = sanitize_set_code(st, default="SET_A")

    raw_set_token = final_set_code.replace("SET_", "")

    # 5. Regex matching 5-token filename pattern (e.g. upsc-prelims-gs1-2024-set_a.pdf)
    match = QP_FILENAME_REGEX.match(clean_filename)
    if match:
        m_exam_name, m_stage, m_subject_code, fn_year_str, set_token = match.groups()
        fn_set_code = sanitize_set_code(set_token, default=final_set_code)
        effective_set = fn_set_code if not user_set_code else final_set_code
        parsed_exam = _normalize_exam_name(m_exam_name)
        
        final_exam = parsed_exam if not exam_name else norm_exam_name
        final_stage = m_stage.upper() if not stage else norm_stage.upper()
        final_subject = m_subject_code.upper() if not subject_code else norm_subj
        
        canonical_code = f"{final_exam}-{final_stage}-{final_subject}-{norm_year}-{effective_set}".lower()
        return {
            "exam_name": final_exam,
            "stage": final_stage,
            "subject_code": final_subject,
            "year": norm_year,
            "set_code": effective_set,
            "raw_set_token": effective_set.replace("SET_", ""),
            "canonical_code": canonical_code,
        }

    canonical_code = f"{norm_exam_name}-{norm_stage}-{norm_subj}-{norm_year}-{final_set_code}".lower()

    return {
        "exam_name": norm_exam_name,
        "stage": norm_stage,
        "subject_code": norm_subj,
        "year": norm_year,
        "set_code": final_set_code,
        "raw_set_token": raw_set_token,
        "canonical_code": canonical_code,
    }


def parse_answer_key_filename(
    filename_or_code: str,
    year: Optional[Union[int, str]] = None,
    user_set_code: Optional[str] = None,
    exam_name: Optional[str] = None,
    stage: Optional[str] = None,
    subject_code: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Dynamically parses Answer Key filename or code.
    Strictly guarantees that canonical_code is always formatted in all lowercase.
    """
    normalized_path = str(filename_or_code).replace("\\", "/")
    clean_filename = Path(normalized_path).name
    stem = Path(normalized_path).stem.strip()

    norm_year = _validate_year(year, fallback_stem=stem)
    norm_exam_name = _normalize_exam_name(exam_name, default="UPSC")
    norm_stage = str(stage).strip() if stage else "PRELIMS"
    norm_subj = str(subject_code).strip().upper() if subject_code else "GS1"

    set_token = sanitize_set_code(user_set_code, default="SET_A")
    if not user_set_code:
        set_match = re.search(r"(?:SET[-_]?([A-D1-4])|[-_]([A-D1-4]))$", stem, re.IGNORECASE)
        if set_match:
            st = set_match.group(1) or set_match.group(2)
            set_token = sanitize_set_code(st, default="SET_A")

    match = AK_FILENAME_REGEX.match(clean_filename)
    if match:
        m_exam_name, m_stage, m_subject_code, fn_year_str = match.groups()
        parsed_exam = _normalize_exam_name(m_exam_name)
        canonical_code = f"{parsed_exam}-{m_stage}-{m_subject_code}-{norm_year}-{set_token}".lower()
        return {
            "exam_name": parsed_exam if not exam_name else norm_exam_name,
            "stage": m_stage.upper() if not stage else norm_stage.upper(),
            "subject_code": m_subject_code.upper() if not subject_code else norm_subj,
            "year": norm_year,
            "set_code": set_token,
            "canonical_code": canonical_code,
        }

    canonical_code = f"{norm_exam_name}-{norm_stage}-{norm_subj}-{norm_year}-{set_token}".lower()
    return {
        "exam_name": norm_exam_name,
        "stage": norm_stage.upper(),
        "subject_code": norm_subj,
        "year": norm_year,
        "set_code": set_token,
        "canonical_code": canonical_code,
    }
