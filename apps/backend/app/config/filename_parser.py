import re
from pathlib import Path
from typing import Dict, Any

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


def parse_question_paper_filename(filename_or_code: str) -> Dict[str, Any]:
    """
    Validates and parses Question Paper filename or code.
    Required format: 'exam_name-stage-subject-year-set' (e.g. 'upsc_cse-prelims-gs1-2023-A').
    """
    stem = Path(filename_or_code).name
    match = QP_FILENAME_REGEX.match(stem)
    if not match:
        raise ValueError(
            f"Invalid Question Paper filename format: '{filename_or_code}'. "
            f"Required format is 'exam_name-stage-subject-year-set' e.g. 'upsc_cse-prelims-gs1-2023-A'."
        )

    exam_name, stage, subject_code, year_str, set_token = match.groups()
    set_code = set_token.upper()
    if not set_code.startswith("SET_"):
        set_code = f"SET_{set_code}"

    canonical_code = f"{exam_name.lower()}-{stage.lower()}-{subject_code.lower()}-{year_str}-{set_token.upper()}"

    return {
        "exam_name": exam_name.lower(),
        "stage": stage.lower(),
        "subject_code": subject_code.lower(),
        "year": int(year_str),
        "set_code": set_code,  # e.g. 'SET_A'
        "raw_set_token": set_token.upper(),  # e.g. 'A'
        "canonical_code": canonical_code,
    }


def parse_answer_key_filename(filename_or_code: str) -> Dict[str, Any]:
    """
    Validates and parses Answer Key filename or code.
    Required format: 'exam_name-stage-subject-year' (e.g. 'upsc_cse-prelims-gs1-2023').
    """
    stem = Path(filename_or_code).name
    match = AK_FILENAME_REGEX.match(stem)
    if not match:
        raise ValueError(
            f"Invalid Answer Key filename format: '{filename_or_code}'. "
            f"Required format is 'exam_name-stage-subject-year' e.g. 'upsc_cse-prelims-gs1-2023'."
        )

    exam_name, stage, subject_code, year_str = match.groups()
    canonical_code = (
        f"{exam_name.lower()}-{stage.lower()}-{subject_code.lower()}-{year_str}"
    )

    return {
        "exam_name": exam_name.lower(),
        "stage": stage.lower(),
        "subject_code": subject_code.lower(),
        "year": int(year_str),
        "canonical_code": canonical_code,
    }
