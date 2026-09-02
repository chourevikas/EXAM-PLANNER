from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class SyllabusSubtopicItem(BaseModel):
    id: Optional[str] = None
    name: str
    code: str
    display_order: int = 1
    pyq_frequency: int = 0


class SyllabusTopicItem(BaseModel):
    id: Optional[str] = None
    name: str
    code: str
    display_order: int = 1
    subtopics_count: int = 0
    subtopics: List[SyllabusSubtopicItem] = []


class SyllabusSubjectItem(BaseModel):
    id: Optional[str] = None
    name: str
    code: str
    display_order: int = 1
    topics_count: int = 0
    subtopics_count: int = 0
    topics: List[SyllabusTopicItem] = []


class CompleteSyllabusResponse(BaseModel):
    version_code: str = "UPSC_PRELIMS_MASTER_V1"
    title: str = "UPSC Prelims Master Syllabus (GS Micro-Topics)"
    syllabus_version_id: Optional[str] = None
    exam_id: Optional[str] = None
    total_subjects: int = 0
    total_topics: int = 0
    total_subtopics: int = 0
    subjects: List[SyllabusSubjectItem] = []
    hierarchy: Dict[str, Dict[str, List[str]]] = {}
    flat_hierarchy: Dict[str, List[str]] = {}
    subjects_list: List[str] = []
    topics_list: List[str] = []
    subtopics_list: List[str] = []


class SyllabusVerifyRequest(BaseModel):
    subject: Optional[str] = None
    topic: Optional[str] = None
    subtopic: Optional[str] = None


class SyllabusVerifyResponse(BaseModel):
    is_valid: bool
    canonical_subject: Optional[str] = None
    canonical_topic: Optional[str] = None
    canonical_subtopic: Optional[str] = None
    is_canonical_exact_match: bool
    issue_reason: Optional[str] = None
