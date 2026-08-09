import re
from pathlib import Path
from typing import Dict, Any, Optional, Union

# Question Paper Filename Pattern: exam_name-stage-subject-year-set
# Example: "upsc_cse-prelims-gs1-2023-A" or "upsc_cse-prelims-gs1-2023-A.pdf"
QP_FILENAME_REGEX = re.compile(
    r"^([a-zA-Z0-9_]+)-([a-zA-Z0-9_]+)-([a-zA-Z0-9_]+)-(\d{4})-([a-zA-Z0-9_]+)(?:\.[a-zA-Z0-9]+)?$"
)

# Answer Key Filename Pattern: exam_name-stage-subject-year
# Example: "upsc_cse-prelims-gs1-2023" or "upsc_cse-prelims-gs1-2023.pdf"
AK_FILENAME_REGEX = re.compile(
    r"^([a-zA-Z0-9_]+)-([a-zA-Z0-9_]+)-([a-zA-Z0-9_]+)-(\d{4})(?:\.[a-zA-Z0-9]+)?$"
)


def parse_question_paper_filename(
    filename_or_code: str,
    user_set_code: Optional[str] = None,
    exam_name: Optional[str] = None,
    stage: Optional[str] = None,
    subject_code: Optional[str] = None,
    year: Optional[Union[int, str]] = None,
) -> Dict[str, Any]:
    """
    Parses Question Paper filename or code. Accepts explicit 5 metadata fields
    (exam_name, stage, subject_code, year, set_code) to support arbitrary user filenames,
    or falls back to 5-token filename pattern / custom stem parsing.
    """
    normalized_path = str(filename_or_code).replace("\\", "/")
    clean_filename = Path(normalized_path).name
    stem = Path(normalized_path).stem.strip()

    # Normalize user-provided set_code if passed
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

    # 1. Direct explicit metadata parameters passed in request
    if exam_name and stage and subject_code and year:
        e_name = str(exam_name).strip().upper()
        stg = str(stage).strip().upper()
        subj = str(subject_code).strip().upper()
        yr = int(year)
        canonical_code = f"{e_name.lower()}-{stg.lower()}-{subj.lower()}-{yr}"
        return {
            "exam_name": e_name,
            "stage": stg,
            "subject_code": subj,
            "year": yr,
            "set_code": final_set_code,
            "raw_set_token": raw_set_token,
            "canonical_code": canonical_code,
        }

    # 2. Regex matching 5-token filename pattern
    match = QP_FILENAME_REGEX.match(clean_filename)
    if match:
        m_exam_name, m_stage, m_subject_code, year_str, set_token = match.groups()
        set_code = set_token.upper()
        if not set_code.startswith("SET_"):
            set_code = f"SET_{set_code}"

        canonical_code = f"{m_exam_name.lower()}-{m_stage.lower()}-{m_subject_code.lower()}-{year_str}"
        return {
            "exam_name": m_exam_name.upper(),
            "stage": m_stage.upper(),
            "subject_code": m_subject_code.upper(),
            "year": int(year_str),
            "set_code": set_code,
            "raw_set_token": set_token.upper(),
            "canonical_code": canonical_code,
        }

    # 3. Flexible Fallback for arbitrary custom filenames
    canonical_code = stem.lower().replace("_", "-")
    return {
        "exam_name": stem.upper(),
        "stage": "PRELIMS",
        "subject_code": "GENERAL",
        "year": 2024,
        "set_code": final_set_code,
        "raw_set_token": raw_set_token,
        "canonical_code": canonical_code,
    }


def parse_answer_key_filename(
    filename_or_code: str,
    exam_name: Optional[str] = None,
    stage: Optional[str] = None,
    subject_code: Optional[str] = None,
    year: Optional[Union[int, str]] = None,
) -> Dict[str, Any]:
    """
    Parses Answer Key filename or code. Accepts explicit metadata parameters
    or falls back to 4-token pattern / custom stem parsing.
    """
    normalized_path = str(filename_or_code).replace("\\", "/")
    clean_filename = Path(normalized_path).name
    stem = Path(normalized_path).stem.strip()

    # 1. Direct explicit metadata parameters
    if exam_name and stage and subject_code and year:
        e_name = str(exam_name).strip().upper()
        stg = str(stage).strip().upper()
        subj = str(subject_code).strip().upper()
        yr = int(year)
        canonical_code = f"{e_name.lower()}-{stg.lower()}-{subj.lower()}-{yr}"
        return {
            "exam_name": e_name,
            "stage": stg,
            "subject_code": subj,
            "year": yr,
            "canonical_code": canonical_code,
        }

    # 2. Regex matching 4-token filename pattern
    match = AK_FILENAME_REGEX.match(clean_filename)
    if match:
        m_exam_name, m_stage, m_subject_code, year_str = match.groups()
        canonical_code = f"{m_exam_name.lower()}-{m_stage.lower()}-{m_subject_code.lower()}-{year_str}"
        return {
            "exam_name": m_exam_name.upper(),
            "stage": m_stage.upper(),
            "subject_code": m_subject_code.upper(),
            "year": int(year_str),
            "canonical_code": canonical_code,
        }

    # 3. Flexible Fallback for custom answer key filenames
    canonical_code = stem.lower().replace("_", "-")
    for suffix in ["-answer-key", "-answerkey", "-ak"]:
        if canonical_code.endswith(suffix):
            canonical_code = canonical_code[:-len(suffix)]

    return {
        "exam_name": stem.upper(),
        "stage": "PRELIMS",
        "subject_code": "GENERAL",
        "year": 2024,
        "canonical_code": canonical_code,
    }
