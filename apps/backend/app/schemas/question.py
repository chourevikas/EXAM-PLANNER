import uuid
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from app.db.models.enums import (
    DifficultyLevel,
    LanguageCode,
    QuestionStatus,
    QuestionSourceType,
    BloomsLevel,
)


class QuestionOptionPayload(BaseModel):
    option_id: Optional[uuid.UUID] = None
    option_label: str = Field(description="'A', 'B', 'C', 'D'")
    display_order: int = 1
    option_text: str
    is_correct: bool = False
    distractor_analysis: Optional[str] = None
    closeness_score: float = 0.0


class QuestionHierarchyLinkPayload(BaseModel):
    subtopic_id: uuid.UUID
    topic_id: Optional[uuid.UUID] = None
    subject_id: Optional[uuid.UUID] = None
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
    subtopic_id: Optional[uuid.UUID] = None
    subtopic_ids: Optional[List[uuid.UUID]] = None
    hierarchy_links: Optional[List[QuestionHierarchyLinkPayload]] = None
    blooms_level: Optional[BloomsLevel] = None
    cognitive_skill: Optional[str] = None
    primary_concept_tag: Optional[str] = None
    status: Optional[QuestionStatus] = None


class QuestionCreatePayload(BaseModel):
    exam_id: uuid.UUID
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
    subtopic_id: Optional[uuid.UUID] = None
    subtopic_ids: Optional[List[uuid.UUID]] = None
    hierarchy_links: Optional[List[QuestionHierarchyLinkPayload]] = None
    blooms_level: Optional[BloomsLevel] = None
    cognitive_skill: Optional[str] = None
    primary_concept_tag: Optional[str] = None
    language: LanguageCode = Field(default=LanguageCode.ENGLISH)


class QuestionOptionDetail(BaseModel):
    option_id: str
    option_label: str
    display_order: int
    is_correct: bool
    option_text: str
    distractor_analysis: Optional[str] = None
    closeness_score: float = 0.0


class QuestionExplanationDetail(BaseModel):
    language: str
    core_concept: Optional[str] = None
    detailed_solution: Optional[str] = None
    common_traps: List[str] = []
    key_takeaways: List[str] = []


class QuestionMetadataDetail(BaseModel):
    blooms_level: Optional[str] = None
    cognitive_skill: Optional[str] = None
    primary_concept_tag: Optional[str] = None
    irt_discrimination_a: float = 1.50
    irt_difficulty_b: float = 0.00
    irt_pseudo_guessing_c: float = 0.25


class HierarchyLinkDetail(BaseModel):
    subject_id: Optional[str] = None
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    topic_id: Optional[str] = None
    topic_name: Optional[str] = None
    topic_code: Optional[str] = None
    subtopic_id: Optional[str] = None
    subtopic_name: Optional[str] = None
    subtopic_code: Optional[str] = None
    is_primary: bool = True
    relevance_weight: float = 1.0


class QuestionDetailResponse(BaseModel):
    question_id: str
    exam_id: Optional[str] = None
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
    passage_id: Optional[str] = None
    passage_text: Optional[str] = None
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
