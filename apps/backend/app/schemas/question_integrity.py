from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from app.db.models.enums import QuestionStatus, DifficultyLevel


class QuestionIssueDetail(BaseModel):
    question_id: Optional[str] = None
    question_number_in_paper: int
    status: Optional[str] = "PENDING_HUMAN_REVIEW"
    issue_category: str = Field(
        description="'CORRUPTED', 'PARTIALLY_CORRUPTED', 'MISSING_IN_PAPER', or 'VALID'"
    )
    issues: List[str] = []
    has_statement: bool = True
    has_options: bool = True
    has_correct_option: bool = True
    has_explanation: bool = True
    has_valid_syllabus: bool = True
    subject: Optional[str] = None
    topic: Optional[str] = None
    subtopic: Optional[str] = None
    question_text_preview: Optional[str] = None
    options_count: int = 0
    correct_option_label: Optional[str] = None
    difficulty: Optional[str] = "MEDIUM"
    is_complete: bool = True
    requires_human_review: bool = True


class ExamIntegrityQuestionsResponse(BaseModel):
    exam_id: str
    exam_code: Optional[str] = None
    exam_name: Optional[str] = None
    paper_set_code: str = "SET_A"
    total_expected_questions: int = 0
    total_extracted_questions: int = 0
    corrupted_count: int = 0
    partially_corrupted_count: int = 0
    missing_count: int = 0
    valid_count: int = 0
    missing_question_numbers: List[int] = []
    page: int = 1
    limit: int = 10
    total_items: int = 0
    pages: int = 1
    items: List[QuestionIssueDetail] = []
