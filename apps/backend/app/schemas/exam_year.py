from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ExamYearItem(BaseModel):
    id: str
    code: str
    name: str
    source_year: Optional[int] = None
    stage: str = "prelims"
    subject_code: Optional[str] = "gs1"
    paper_set_code: Optional[str] = "SET_A"
    total_questions: Optional[int] = 100
    extracted_questions_count: Optional[int] = 0
    corrupted_questions_count: int = 0
    partially_corrupted_questions_count: int = 0
    missing_questions_count: int = 0
    is_published: bool = False
    pipeline_status: Optional[str] = "PENDING"
    created_at: Optional[str] = None


class ExamsByYearResponse(BaseModel):
    years: List[int] = Field(description="Sorted list of all available exam years in descending order")
    total_exams: int = Field(description="Total number of exams across all years")
    exams_by_year: Dict[str, List[ExamYearItem]] = Field(
        description="Dictionary mapping stringified year (e.g. '2024') to list of exams in that year"
    )
