import re
from pathlib import Path
from typing import Dict, Any, Optional

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


def parse_question_paper_filename(filename_or_code: str, user_set_code: Optional[str] = None) -> Dict[str, Any]:
    """
    Parses Question Paper filename or code. Accepts standard 5-token pattern
    or flexible custom filenames (e.g. 'UPSC_CSE_2023_GS1.pdf').
    Normalizes Windows backslashes for cross-platform compatibility (Linux/WSL worker support).
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

    match = QP_FILENAME_REGEX.match(clean_filename)
    if match:
        exam_name, stage, subject_code, year_str, set_token = match.groups()
        set_code = set_token.upper()
        if not set_code.startswith("SET_"):
            set_code = f"SET_{set_code}"

        canonical_code = f"{exam_name.upper()}_{stage.upper()}_{subject_code.upper()}_{year_str}_{set_token.upper()}"
        return {
            "exam_name": exam_name.upper(),
            "stage": stage.upper(),
            "subject_code": subject_code.upper(),
            "year": int(year_str),
            "set_code": set_code,
            "raw_set_token": set_token.upper(),
            "canonical_code": canonical_code,
        }

    # Flexible Fallback for custom file names (e.g. UPSC_CSE_2023_GS1)
    canonical_code = stem.upper().replace("-", "_")
    return {
        "exam_name": canonical_code,
        "stage": "PRELIMS",
        "subject_code": "GENERAL",
        "year": 2024,
        "set_code": final_set_code,
        "raw_set_token": raw_set_token,
        "canonical_code": canonical_code,
    }


def parse_answer_key_filename(filename_or_code: str) -> Dict[str, Any]:
    """
    Parses Answer Key filename or code. Accepts standard 4-token pattern
    or flexible custom filenames (e.g. 'UPSC_CSE_2023_GS1_AK.pdf').
    Normalizes Windows backslashes for cross-platform compatibility (Linux/WSL worker support).
    """
    normalized_path = str(filename_or_code).replace("\\", "/")
    clean_filename = Path(normalized_path).name
    stem = Path(normalized_path).stem.strip()

    match = AK_FILENAME_REGEX.match(clean_filename)
    if match:
        exam_name, stage, subject_code, year_str = match.groups()
        canonical_code = f"{exam_name.upper()}_{stage.upper()}_{subject_code.upper()}_{year_str}"
        return {
            "exam_name": exam_name.upper(),
            "stage": stage.upper(),
            "subject_code": subject_code.upper(),
            "year": int(year_str),
            "canonical_code": canonical_code,
        }

    # Flexible Fallback for custom answer key filenames
    canonical_code = stem.upper().replace("-", "_")
    # Clean suffix like _ANSWER_KEY or _AK if present
    for suffix in ["_ANSWER_KEY", "_ANSWERKEY", "_AK"]:
        if canonical_code.endswith(suffix):
            canonical_code = canonical_code[:-len(suffix)]

    return {
        "exam_name": canonical_code,
        "stage": "PRELIMS",
        "subject_code": "GENERAL",
        "year": 2024,
        "canonical_code": canonical_code,
    }
