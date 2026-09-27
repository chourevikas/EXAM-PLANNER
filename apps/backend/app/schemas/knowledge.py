from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class SimilarQuestionItem(BaseModel):
    question_id: int
    score: float = Field(description="Weighted match score; for ranking and debugging, not for display")
    similarity_score: Optional[float] = None
    tier: str = Field(description="exact | related | nano_theme | microtheme")
    match_reasons: List[str] = Field(default_factory=list, description='e.g. "Exact entity: Article 15"')
    question_number: Optional[int] = None
    exam_name: Optional[str] = None
    source_year: Optional[int] = None
    subject_name: Optional[str] = None
    topic_name: Optional[str] = None
    subtopic_name: Optional[str] = None
    question: Optional[Dict[str, Any]] = Field(
        default=None, description="Question card (text + options), same shape as /questions/recommended items; only with include_question=true"
    )


class SimilarQuestionsResponse(BaseModel):
    question_id: int
    results: List[SimilarQuestionItem]


class QuestionKnowledgeConcept(BaseModel):
    id: int
    name: str
    weight: float
    source: str
    status: str


class QuestionKnowledgeEntity(BaseModel):
    id: int
    name: str
    entity_type: str
    parent_name: Optional[str] = None
    relevance: float
    source: str
    status: str


class QuestionKnowledgeRelationship(BaseModel):
    source: str
    relation: str
    target: str


class QuestionKnowledgeResponse(BaseModel):
    question_id: int
    concepts: List[QuestionKnowledgeConcept]
    entities: List[QuestionKnowledgeEntity]
    relationships: List[QuestionKnowledgeRelationship]
