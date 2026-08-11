import re
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
    cleaned = str(exam_name).strip()
    if cleaned.upper() in ("USPC", "UPSC"):
        return "UPSC"
    return cleaned.upper()


def _validate_year(year: Union[int, str]) -> int:
    if year is None or str(year).strip() == "":
        raise ValueError("Year parameter is mandatory.")
    try:
        val = int(year)
        if 1900 <= val <= 2100:
            return val
        raise ValueError(f"Year out of valid range (1900-2100): {val}")
    except (ValueError, TypeError):
        raise ValueError(f"Invalid year value provided: '{year}'. Year must be a 4-digit integer.")


def parse_question_paper_filename(
    filename_or_code: str,
    year: Optional[Union[int, str]] = None,
    user_set_code: Optional[str] = None,
    exam_name: Optional[str] = None,
    stage: Optional[str] = None,
    subject_code: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Parses Question Paper filename or code. Accepts mandatory year metadata parameter.
    Normalizes 'uspc' typo to 'UPSC' and defaults stage to 'prelims'.
    Does not attempt regex year extraction from filename; uses mandatory year argument.
    """

    if year is None:
        raise ValueError("Year parameter is mandatory for Question Paper filenames.")
    
    normalized_path = str(filename_or_code).replace("\\", "/")
    clean_filename = Path(normalized_path).name
    stem = Path(normalized_path).stem.strip()

    norm_year = _validate_year(year)
    norm_exam_name = _normalize_exam_name(exam_name, default="UPSC")
    norm_stage = str(stage).strip() if stage else "PRELIMS"
    norm_subj = str(subject_code).strip().upper() if subject_code else "GS1"

    final_set_code = "SET_A"
    raw_set_token = "A"
    if user_set_code:
        u_set = str(user_set_code).strip().upper()
        if u_set.startswith("SET_"):
            final_set_code = u_set
            raw_set_token = u_set.replace("SET_", "")
        elif u_set.startswith("SET-"):
            final_set_code = f"SET_{u_set.replace('SET-', '')}"
            raw_set_token = u_set.replace("SET-", "")
        else:
            final_set_code = f"SET_{u_set}"
            raw_set_token = u_set

    # 1. Regex matching 5-token filename pattern for exam_name, stage, subject, set
    match = QP_FILENAME_REGEX.match(clean_filename)
    if match:
        m_exam_name, m_stage, m_subject_code, fn_year_str, set_token = match.groups()
        set_code = set_token.upper()
        if not set_code.startswith("SET_"):
            set_code = f"SET_{set_code}"

        parsed_exam = _normalize_exam_name(m_exam_name)
        canonical_code = f"{m_exam_name.lower()}-{m_stage.lower()}-{m_subject_code.lower()}-{norm_year}"
        return {
            "exam_name": parsed_exam if not exam_name else norm_exam_name,
            "stage": m_stage.upper() if not stage else norm_stage.upper(),
            "subject_code": m_subject_code.upper() if not subject_code else norm_subj,
            "year": norm_year,
            "set_code": set_code if not user_set_code else final_set_code,
            "raw_set_token": set_token.upper() if not user_set_code else raw_set_token,
            "canonical_code": canonical_code,
        }

    # 2. Canonical code from explicit or normalized metadata
    canonical_code = f"{norm_exam_name.lower()}-{norm_stage.lower()}-{norm_subj.lower()}-{norm_year}"
    return {
        "exam_name": norm_exam_name,
        "stage": norm_stage.upper(),
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
    Parses Answer Key filename or code. Requires mandatory year metadata parameter.
    Does not attempt regex year extraction from filename; uses mandatory year argument.
    """
    if year is None:
        raise ValueError("Year parameter is mandatory for Answer Key filenames.")
    normalized_path = str(filename_or_code).replace("\\", "/")
    clean_filename = Path(normalized_path).name
    stem = Path(normalized_path).stem.strip()

    norm_year = _validate_year(year)
    norm_exam_name = _normalize_exam_name(exam_name, default="UPSC")
    norm_stage = str(stage).strip() if stage else "PRELIMS"
    norm_subj = str(subject_code).strip().upper() if subject_code else "GS1"

    match = AK_FILENAME_REGEX.match(clean_filename)
    if match:
        m_exam_name, m_stage, m_subject_code, fn_year_str = match.groups()
        parsed_exam = _normalize_exam_name(m_exam_name)
        canonical_code = f"{m_exam_name.lower()}-{m_stage.lower()}-{m_subject_code.lower()}-{norm_year}"
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
