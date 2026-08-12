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


def _normalize_exam_name(exam_name: Optional[str], default: str = "UPSC") -> str:
    if not exam_name:
        return default
    cleaned = str(exam_name).strip().upper()
    if cleaned in ("USPC", "UPSC"):
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
    Extracts year, exam name, stage, subject, and set code directly from uploaded filename or form inputs.
    Never hardcodes parameters or crashes if parameters are omitted.
    """
    normalized_path = str(filename_or_code).replace("\\", "/")
    clean_filename = Path(normalized_path).name
    stem = Path(normalized_path).stem.strip()

    norm_year = _validate_year(year, fallback_stem=stem)

    # 1. Dynamic Exam Name Extraction from stem
    extracted_exam = exam_name
    if not extracted_exam:
        exam_match = re.search(r"\b(UPSC|MPPSC|MPSC|BPSC|UPPCS|SSC|GATE|CAT|CDS|NDA)\b", stem, re.IGNORECASE)
        if exam_match:
            extracted_exam = exam_match.group(1)

    norm_exam_name = _normalize_exam_name(extracted_exam, default="UPSC")

    # 2. Dynamic Stage Extraction from stem
    extracted_stage = stage
    if not extracted_stage:
        if re.search(r"\b(MAINS|MAIN)\b", stem, re.IGNORECASE):
            extracted_stage = "MAINS"
        else:
            extracted_stage = "PRELIMS"
    norm_stage = str(extracted_stage).strip().upper()

    # 3. Dynamic Subject Extraction from stem
    extracted_subj = subject_code
    if not extracted_subj:
        subj_match = re.search(r"\b(GS1|GS2|GS3|GS4|GS-1|GS-2|CSAT|POLITY|HISTORY|ECONOMY|GEOGRAPHY|SCIENCE)\b", stem, re.IGNORECASE)
        if subj_match:
            extracted_subj = subj_match.group(1).replace("-", "")
        else:
            extracted_subj = "GS1"
    norm_subj = str(extracted_subj).strip().upper()

    # 4. Dynamic Set Code Extraction from stem
    final_set_code = "SET_A"
    raw_set_token = "A"

    extracted_set = user_set_code
    if not extracted_set:
        set_match = re.search(r"(?:SET[-_]?([A-D])|[-_]([A-D]))$", stem, re.IGNORECASE)
        if set_match:
            extracted_set = set_match.group(1) or set_match.group(2)

    if extracted_set:
        u_set = str(extracted_set).strip().upper()
        if u_set.startswith("SET_"):
            final_set_code = u_set
            raw_set_token = u_set.replace("SET_", "")
        elif u_set.startswith("SET-"):
            final_set_code = f"SET_{u_set.replace('SET-', '')}"
            raw_set_token = u_set.replace("SET-", "")
        else:
            final_set_code = f"SET_{u_set}"
            raw_set_token = u_set

    # 5. Regex matching 5-token filename pattern (e.g. upsc-prelims-gs1-2024-set_a.pdf)
    match = QP_FILENAME_REGEX.match(clean_filename)
    if match:
        m_exam_name, m_stage, m_subject_code, fn_year_str, set_token = match.groups()
        set_code = set_token.upper()
        if not set_code.startswith("SET_"):
            set_code = f"SET_{set_code}"

        parsed_exam = _normalize_exam_name(m_exam_name)
        canonical_code = f"{parsed_exam.lower()}-{m_stage.lower()}-{m_subject_code.lower()}-{norm_year}-{set_code.lower()}"
        return {
            "exam_name": parsed_exam if not exam_name else norm_exam_name,
            "stage": m_stage.upper() if not stage else norm_stage.upper(),
            "subject_code": m_subject_code.upper() if not subject_code else norm_subj,
            "year": norm_year,
            "set_code": set_code if not user_set_code else final_set_code,
            "raw_set_token": set_token.upper() if not user_set_code else raw_set_token,
            "canonical_code": canonical_code,
        }

    clean_code = stem.lower().replace(" ", "_")
    canonical_code = f"{norm_exam_name.lower()}-{norm_stage.lower()}-{norm_subj.lower()}-{norm_year}-{final_set_code.lower()}"

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
    exam_name: Optional[str] = None,
    stage: Optional[str] = None,
    subject_code: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Dynamically parses Answer Key filename or code.
    """
    normalized_path = str(filename_or_code).replace("\\", "/")
    clean_filename = Path(normalized_path).name
    stem = Path(normalized_path).stem.strip()

    norm_year = _validate_year(year, fallback_stem=stem)
    norm_exam_name = _normalize_exam_name(exam_name, default="UPSC")
    norm_stage = str(stage).strip() if stage else "PRELIMS"
    norm_subj = str(subject_code).strip().upper() if subject_code else "GS1"

    match = AK_FILENAME_REGEX.match(clean_filename)
    if match:
        m_exam_name, m_stage, m_subject_code, fn_year_str = match.groups()
        parsed_exam = _normalize_exam_name(m_exam_name)
        canonical_code = f"{parsed_exam.lower()}-{m_stage.lower()}-{m_subject_code.lower()}-{norm_year}"
        return {
            "exam_name": parsed_exam if not exam_name else norm_exam_name,
            "stage": m_stage.upper() if not stage else norm_stage.upper(),
            "subject_code": m_subject_code.upper() if not subject_code else norm_subj,
            "year": norm_year,
            "canonical_code": canonical_code,
        }

    canonical_code = f"{norm_exam_name.lower()}-{norm_stage.lower()}-{norm_subj.lower()}-{norm_year}"
    return {
        "exam_name": norm_exam_name,
        "stage": norm_stage.upper(),
        "subject_code": norm_subj,
        "year": norm_year,
        "canonical_code": canonical_code,
    }
