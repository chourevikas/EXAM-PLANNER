from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class ExamTypeBase(BaseModel):
    type: str = Field(
        ...,
        min_length=2,
        max_length=50,
        description="Exam type identifier code (e.g. upsc, mpsc)",
    )
    name: str = Field(
        ...,
        min_length=2,
        max_length=200,
        description="Full human-readable name of the examination",
    )
    total_duration: int = Field(
        default=120,
        ge=1,
        description="Total duration in minutes (e.g. 120)",
    )
    number_of_questions: int = Field(
        default=100,
        ge=1,
        description="Total number of questions in examination paper (e.g. 100)",
    )
    total_marks: float = Field(
        default=200.0,
        ge=0.0,
        description="Total paper marks (e.g. 200.0)",
    )
    negative_marks: float = Field(
        default=0.66,
        ge=0.0,
        description="Marks deducted for incorrect answer (e.g. 0.66)",
    )
    positive_marks: float = Field(
        default=2.0,
        gt=0.0,
        description="Marks awarded for correct answer (e.g. 2.0)",
    )
    description: Optional[str] = Field(
        default=None,
        description="Optional description or details",
    )
    is_active: bool = Field(
        default=True,
        description="Whether this exam type is active for ingestion and practice",
    )


class ExamTypeCreate(ExamTypeBase):
    pass


class ExamTypeUpdate(BaseModel):
    type: Optional[str] = Field(default=None, min_length=2, max_length=50)
    name: Optional[str] = Field(default=None, min_length=2, max_length=200)
    total_duration: Optional[int] = Field(default=None, ge=1)
    number_of_questions: Optional[int] = Field(default=None, ge=1)
    total_marks: Optional[float] = Field(default=None, ge=0.0)
    negative_marks: Optional[float] = Field(default=None, ge=0.0)
    positive_marks: Optional[float] = Field(default=None, gt=0.0)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ExamTypeResponse(ExamTypeBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
    exams_count: int = 0


class ExamTypeListResponse(BaseModel):
    items: List[ExamTypeResponse]
    total: int
