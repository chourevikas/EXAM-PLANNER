from typing import Any
from pydantic import BaseModel, Field


class QuestionRegistryItem(BaseModel):
    section_code: str = Field(default="DEFAULT")
    printed_question_number: int
    question_type: str = Field(default="SINGLE_CHOICE")
    is_complete: bool = Field(default=True)
    has_image: bool = Field(default=False)
    page_numbers: list[int] = Field(default_factory=list)
    assets: list[Any] = Field(default_factory=list)
    translations: dict[str, Any] = Field(default_factory=dict)


class BatchProcessingSummary(BaseModel):
    total_processed_questions: int = Field(default=0)
    processed_question_keys: list[str] = Field(default_factory=list)
    successful_batches: int = Field(default=0)
    failed_batches: int = Field(default=0)
    errors: list[str] = Field(default_factory=list)
