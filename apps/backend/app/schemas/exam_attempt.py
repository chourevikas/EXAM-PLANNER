import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field
from app.db.models.enums import AttemptMode, QuestionResponseStatus, AttemptStatus


# --- Request Schemas ---

class StartExamRequest(BaseModel):
    exam_id: uuid.UUID | str
    mode: AttemptMode = AttemptMode.EXAM


class SaveResponseRequest(BaseModel):
    question_id: uuid.UUID | str
    selected_option_id: Optional[uuid.UUID | str] = None
    is_marked_for_review: bool = False
    time_spent_seconds: float = 0.0
    option_switch_count: int = 0


class BatchSaveItem(BaseModel):
    question_id: uuid.UUID | str
    selected_option_id: Optional[uuid.UUID | str] = None
    is_marked_for_review: bool = False
    time_spent_seconds: float = 0.0
    option_switch_count: int = 0
    client_timestamp: Optional[datetime] = None


class BatchSaveResponseRequest(BaseModel):
    batch_id: uuid.UUID | str = Field(default_factory=uuid.uuid4)
    responses: List[BatchSaveItem]


class ResponseSummary(BaseModel):
    answered_count: int = 0
    marked_for_review_count: int = 0
    unattempted_count: int = 0
    total: int = 0


class BatchSaveResponseAck(BaseModel):
    batch_id: str
    status: str = "ACCEPTED"
    received_count: int
    response_summary: Optional[ResponseSummary] = None


class BatchStatusResponse(BaseModel):
    batch_id: str
    status: str  # "ACCEPTED", "PROCESSED", "FAILED"
    processed_count: int
    error: Optional[str] = None
    updated_at: datetime


class SubmitExamRequest(BaseModel):
    submission_reason: str = "USER_CLICKED_SUBMIT"


class HeartbeatRequest(BaseModel):
    remaining_time_seconds: int
    active_question_id: Optional[uuid.UUID | str] = None



# --- Response Schemas ---

class OptionOut(BaseModel):
    option_id: uuid.UUID | str
    option_label: str
    text: str
    display_order: int = 1


class QuestionOut(BaseModel):
    question_id: uuid.UUID | str
    question_number: int
    text: str
    options: List[OptionOut]
    subject: str = "General Knowledge"
    topic: str = "General Studies"
    subtopic: str = "Core Concepts"
    difficulty: str = "MEDIUM"
    marks: float = 2.0
    negative_marks: float = 0.66
    expected_time_seconds: int = 60
    section_code: str = "DEFAULT"
    has_image: bool = False
    assets: List[Dict[str, Any]] = []
    passage_text: Optional[str] = None


class NavigationMeta(BaseModel):
    current: int
    total: int
    has_next: bool
    has_prev: bool


class ResponseState(BaseModel):
    selected_option_id: Optional[uuid.UUID | str] = None
    is_marked_for_review: bool = False
    time_spent_seconds: float = 0.0
    question_status: QuestionResponseStatus = QuestionResponseStatus.UNVISITED
    answer_revealed: bool = False


class QuestionNavResponse(BaseModel):
    question: QuestionOut
    navigation: NavigationMeta
    response_state: ResponseState
    presigned_url: Optional[str] = None


class QuestionPaletteItem(BaseModel):
    question_number: int
    question_id: uuid.UUID | str
    question_status: QuestionResponseStatus
    total: int = 0


class StartExamResponse(BaseModel):
    attempt_id: uuid.UUID | str
    exam_id: uuid.UUID | str
    status: AttemptStatus
    mode: AttemptMode
    started_at: datetime
    max_duration_seconds: int
    total_questions: int
    first_question: QuestionNavResponse
    palette: List[QuestionPaletteItem]
    questions_presigned_url: Optional[str] = None
    questions_folder_url: Optional[str] = None


class SaveResponseResponse(BaseModel):
    status: str = "SAVED"
    saved_at: datetime
    response_summary: ResponseSummary


class RevealAnswerResponse(BaseModel):
    question_id: uuid.UUID | str
    question_number: int
    correct_option_id: uuid.UUID | str
    correct_option_label: str
    is_user_correct: bool
    user_selected_option_id: Optional[uuid.UUID | str] = None
    user_selected_label: Optional[str] = None
    marks_awarded: float = 0.0
    closeness_score: float = 0.0
    closeness_classification: str
    explanation: Dict[str, Any]
    distractor_scores: Dict[str, Any]


class SubmitExamResponse(BaseModel):
    attempt_id: uuid.UUID | str
    status: AttemptStatus
    submitted_at: datetime
    submission_reason: str
    raw_score: float
    max_score: float
    accuracy_percentage: float
    correct_count: int
    incorrect_count: int
    unattempted_count: int
    time_taken_seconds: float
    max_duration_seconds: int
    evaluation_status: str = "PROCESSING"
    evaluation_message: str = (
        "Psychometric analysis is being computed in the background. "
        "Full report will be available shortly."
    )


class ExamStatusResponse(BaseModel):
    attempt_id: uuid.UUID | str
    exam_id: uuid.UUID | str
    exam_name: str
    status: AttemptStatus
    mode: AttemptMode
    started_at: datetime
    max_duration_seconds: int
    remaining_seconds: int
    current_question_index: int
    total_questions: int
    response_summary: ResponseSummary
    palette: List[QuestionPaletteItem]


class HeartbeatResponse(BaseModel):
    server_time: datetime
    remaining_time_seconds: int
    status: AttemptStatus
    auto_submitted: bool = False
    submission_summary: Optional[SubmitExamResponse] = None
