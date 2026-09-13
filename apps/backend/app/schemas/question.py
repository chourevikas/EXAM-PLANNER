from datetime import datetime
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field
from app.db.models.enums import (
    DifficultyLevel,
    LanguageCode,
    QuestionStatus,
    QuestionSourceType,
    BloomsLevel,
)


class QuestionOptionPayload(BaseModel):
    option_id: Optional[int | str] = None
    option_label: str = Field(description="'A', 'B', 'C', 'D'")
    display_order: int = 1
    option_text: str
    is_correct: bool = False
    distractor_analysis: Optional[str] = None
    closeness_score: float = 0.0


class QuestionHierarchyLinkPayload(BaseModel):
    subtopic_id: Optional[int | str] = None
    topic_id: Optional[int | str] = None
    subject_id: Optional[int | str] = None
    subject_name: Optional[str] = None
    topic_name: Optional[str] = None
    subtopic_name: Optional[str] = None
    is_primary: bool = False
    relevance_weight: float = 1.0
    concept_name: Optional[str] = None


class QuestionUpdatePayload(BaseModel):
    language: LanguageCode = Field(default=LanguageCode.ENGLISH)
    question_text: Optional[str] = None
    paper_set_code: Optional[str] = None
    section_code: Optional[str] = None
    difficulty: Optional[DifficultyLevel] = None
    marks: Optional[float] = None
    negative_marks: Optional[float] = None
    expected_time_seconds: Optional[int] = None
    options: Optional[List[QuestionOptionPayload]] = None
    passage_text: Optional[str] = None
    core_concept: Optional[str] = None
    detailed_solution: Optional[str] = None
    common_traps: Optional[List[str]] = None
    key_takeaways: Optional[List[str]] = None
    subject_name: Optional[str] = None
    topic_name: Optional[str] = None
    subtopic_name: Optional[str] = None
    subject_id: Optional[int | str] = None
    topic_id: Optional[int | str] = None
    subtopic_id: Optional[int | str] = None
    subtopic_ids: Optional[List[int | str]] = None
    hierarchy_links: Optional[List[QuestionHierarchyLinkPayload]] = None
    blooms_level: Optional[BloomsLevel] = None
    cognitive_skill: Optional[str] = None
    primary_concept_tag: Optional[str] = None
    status: Optional[QuestionStatus] = None


class QuestionCreatePayload(BaseModel):
    exam_id: int | str
    question_number_in_paper: int
    question_text: str
    paper_set_code: Optional[str] = "SET_A"
    section_code: Optional[str] = "DEFAULT"
    question_type: Optional[str] = "SINGLE_CHOICE"
    difficulty: Optional[DifficultyLevel] = DifficultyLevel.MEDIUM
    marks: Optional[float] = 2.0
    negative_marks: Optional[float] = 0.66
    expected_time_seconds: Optional[int] = 60
    options: Optional[List[QuestionOptionPayload]] = None
    passage_text: Optional[str] = None
    core_concept: Optional[str] = None
    detailed_solution: Optional[str] = None
    common_traps: Optional[List[str]] = None
    key_takeaways: Optional[List[str]] = None
    subject_name: Optional[str] = None
    topic_name: Optional[str] = None
    subtopic_name: Optional[str] = None
    subject_id: Optional[int | str] = None
    topic_id: Optional[int | str] = None
    subtopic_id: Optional[int | str] = None
    subtopic_ids: Optional[List[int | str]] = None
    hierarchy_links: Optional[List[QuestionHierarchyLinkPayload]] = None
    blooms_level: Optional[BloomsLevel] = None
    cognitive_skill: Optional[str] = None
    primary_concept_tag: Optional[str] = None
    language: LanguageCode = Field(default=LanguageCode.ENGLISH)


class QuestionOptionDetail(BaseModel):
    option_id: str | int
    option_label: str
    display_order: int
    is_correct: bool
    option_text: str
    distractor_analysis: Optional[str] = None
    why_tempting: Optional[str] = None
    whats_actually_true: Optional[str] = None
    closeness_score: float = 0.0
    translations: Dict[str, str] = {}


class QuestionExplanationDetail(BaseModel):
    explanation_id: Optional[str | int] = None
    language: str
    core_concept: Optional[str] = None
    detailed_solution: Optional[str] = None
    common_traps: List[str] = []
    key_takeaways: List[str] = []
    translations: Dict[str, Any] = {}


class QuestionMetadataDetail(BaseModel):
    blooms_level: Optional[str] = None
    cognitive_skill: Optional[str] = None
    primary_concept_tag: Optional[str] = None
    irt_discrimination_a: float = 1.50
    irt_difficulty_b: float = 0.00
    irt_pseudo_guessing_c: float = 0.25


class HierarchyLinkDetail(BaseModel):
    subject_id: Optional[str | int] = None
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    topic_id: Optional[str | int] = None
    topic_name: Optional[str] = None
    topic_code: Optional[str] = None
    subtopic_id: Optional[str | int] = None
    subtopic_name: Optional[str] = None
    subtopic_code: Optional[str] = None
    is_primary: bool = True
    relevance_weight: float = 1.0
    relevance_percentage: int = 100
    concept_name: Optional[str] = None


class QuestionDetailResponse(BaseModel):
    question_id: str | int
    exam_id: Optional[str | int] = None
    exam_name: Optional[str] = None
    exam_code: Optional[str] = None
    exam_type: Optional[str] = None
    stage: str = "prelims"
    source_year: Optional[int] = None
    paper_set_code: str = "SET_A"
    section_code: str = "DEFAULT"
    question_number_in_paper: int
    question_type: str = "SINGLE_CHOICE"
    difficulty: str = "MEDIUM"
    marks: float = 2.0
    negative_marks: float = 0.66
    expected_time_seconds: int = 60
    status: str = "PENDING_HUMAN_REVIEW"
    is_mcq: bool = True
    is_complete: bool = True
    has_image: bool = False
    page_numbers: List[int] = []
    passage_id: Optional[str | int] = None
    passage_text: Optional[str] = None
    passage_translations: Dict[str, str] = {}
    question_text: str = ""
    translations: Dict[str, str] = {}
    options: List[QuestionOptionDetail] = []
    explanation: Optional[QuestionExplanationDetail] = None
    metadata: Optional[QuestionMetadataDetail] = None
    hierarchy: List[HierarchyLinkDetail] = []
    assets: List[Dict[str, Any]] = []
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class QuestionPaginatedResponse(BaseModel):
    items: List[QuestionDetailResponse]
    total: int
    page: int
    limit: int
    pages: int


class ExamReviewQuestionsResponse(BaseModel):
    exam_id: str | int
    exam_name: Optional[str] = None
    exam_code: Optional[str] = None
    stage: str = "prelims"
    source_year: Optional[int] = None
    paper_set_code: str = "SET_A"
    total_questions: int
    reviewed_count: int
    pending_count: int
    rejected_count: int
    can_publish: bool
    is_published: bool = False
    publish_status: str = "PENDING_REVIEW"
    can_retry: bool = False
    is_corrupted: bool = False
    publish_error: Optional[str] = None
    corruption_reason: Optional[str] = None
    questions_json_path: Optional[str] = None
    solutions_json_path: Optional[str] = None
    questions_json_folder_path: Optional[str] = None
    solutions_json_folder_path: Optional[str] = None
    last_synced_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    is_s3_out_of_sync: bool = False
    is_syncing: bool = False
    items: List[QuestionDetailResponse]
    page: int
    limit: int
    pages: int
    target_index: Optional[int] = None
    target_question_id: Optional[Union[str, int]] = None
    target_question_number: Optional[int] = None


class QuestionCatalogSubjectItemOut(BaseModel):
    id: str
    name: str
    code: str
    query_name: str
    description: str
    questions_count: int
    pending_count: int
    subtopics_count: int
    icon: Optional[str] = None


class QuestionCatalogSubjectsResponseOut(BaseModel):
    total_subjects: int
    total_questions: int
    total_subtopics: int
    total_pending: int
    subjects: List[QuestionCatalogSubjectItemOut]
