import operator
import uuid
from typing import TypedDict, List, Tuple, Optional, Annotated
from pydantic import BaseModel, Field, ConfigDict
import enum



class LanguageCodeEnum(str, enum.Enum):
    ENGLISH = "ENGLISH"
    HINDI = "HINDI"
    MARATHI = "MARATHI"
    TAMIL = "TAMIL"
    BILINGUAL = "BILINGUAL"


class MemoryTypeEnum(str, enum.Enum):
    PASSAGE = "PASSAGE"
    CASE_STUDY = "CASE_STUDY"
    SHARED_TABLE = "SHARED_TABLE"
    GENERAL_INSTRUCTION = "GENERAL_INSTRUCTION"


class AssetTypeEnum(str, enum.Enum):
    DIAGRAM = "DIAGRAM"
    FIGURE = "FIGURE"


class LayoutTypeEnum(str, enum.Enum):
    SINGLE_COLUMN = "SINGLE_COLUMN"
    DUAL_COLUMN_VERTICAL = "DUAL_COLUMN_VERTICAL"
    MIXED_INSTRUCTION_TOP_DUAL_BOTTOM = "MIXED_INSTRUCTION_TOP_DUAL_BOTTOM"


class SeamBlockTypeEnum(str, enum.Enum):
    PASSAGE = "PASSAGE"
    GENERAL_INSTRUCTION = "GENERAL_INSTRUCTION"
    QUESTION_STATEMENT = "QUESTION_STATEMENT"
    OPTIONS = "OPTIONS"
    CASE_STUDY = "CASE_STUDY"
    NONE = "NONE"


class QuestionTypeEnum(str, enum.Enum):
    SINGLE_CHOICE = "SINGLE_CHOICE"
    MULTIPLE_CHOICE = "MULTIPLE_CHOICE"


class CropAssetSchema(BaseModel):
    asset_type: AssetTypeEnum = Field(default=AssetTypeEnum.DIAGRAM)
    caption: Optional[str] = Field(default=None)
    associated_section_code: str = Field(default="DEFAULT")
    associated_question_number: Optional[int] = Field(default=None)
    bounding_box: List[int] = Field(description="Normalized coordinates [ymin, xmin, ymax, xmax] scaled 0 to 1000.")


class OptionTranslationSchema(BaseModel):
    display_label: str
    display_order: int
    option_text: str


class QuestionTranslationSchema(BaseModel):
    language: LanguageCodeEnum
    parent_context_override: Optional[str] = Field(default=None)
    direction_header: Optional[str] = Field(default=None)
    question_text: str
    options: List[OptionTranslationSchema] = Field(default_factory=list)


class ExtractedQuestionSchema(BaseModel):
    section_code: str = Field(default="DEFAULT")
    printed_question_number: Optional[int] = Field(default=None)
    is_complete: bool = Field(description="Set False if statement, choices, or attached passage are cut off at page seams.")
    
    is_continuation_fragment: bool = Field(default=False)
    target_parent_section_code: Optional[str] = Field(default=None)
    target_parent_question_number: Optional[int] = Field(default=None)

    question_type: QuestionTypeEnum = Field(default=QuestionTypeEnum.SINGLE_CHOICE)
    has_image_or_complex_layout: bool = Field(default=False)
    assets: List[CropAssetSchema] = Field(default_factory=list)
    initial_tags: List[str] = Field(default_factory=list)
    translations: List[QuestionTranslationSchema]


class ContextMemoryTranslationSchema(BaseModel):
    language: LanguageCodeEnum
    context_text: str


class ContextMemoryItem(BaseModel):
    memory_id: str = Field(default_factory=lambda: "mem_" + str(uuid.uuid4())[:8])
    section_code: str = Field(default="DEFAULT")
    memory_type: MemoryTypeEnum = Field(default=MemoryTypeEnum.PASSAGE)
    target_question_range: str = Field(description="Literal printed range e.g. 'Directions for Q.6 to Q.10'")
    target_question_numbers: List[int] = Field(default_factory=list)
    min_question_number: int = Field(default=1)
    max_question_number: int = Field(default=1)
    is_complete: bool = Field(description="Set False if passage/case study continues onto the next page.")
    translations: List[ContextMemoryTranslationSchema]


class PageExtractionPayload(BaseModel):
    page_languages: List[LanguageCodeEnum]
    detected_layout_type: LayoutTypeEnum = Field(description="Dynamic layout mode detected for THIS page.")
    page_start_seam: SeamBlockTypeEnum = Field(default=SeamBlockTypeEnum.NONE)
    page_end_seam: SeamBlockTypeEnum = Field(default=SeamBlockTypeEnum.NONE)
    new_context_memories: List[ContextMemoryItem] = Field(default_factory=list)
    extracted_questions: List[ExtractedQuestionSchema]


class MCQValidationResult(BaseModel):
    status: str = Field(description="'PUBLISHED', 'NON_MCQ_FALLBACK', or 'INCOMPLETE_RETRY_NEEDED'")
    is_mcq: bool = Field(description="True if question is valid MCQ format.")
    reasoning: str = Field(description="Reason for decision.")


class ParallelWorkerInput(TypedDict):
    page_num: int
    pdf_path: str
    task_id: str


class OverallPipelineState(TypedDict):
    pdf_path: str
    exam_title: str
    exam_id: str
    output_dir: str
    total_pages: int
    task_id: str
    execution_pass: int
    retry_count: int
    target_retry_pages: List[int]
    raw_page_payloads: Annotated[List[Tuple[int, Optional[PageExtractionPayload], Optional[str]]], operator.add]
    processed_question_keys: List[str]

