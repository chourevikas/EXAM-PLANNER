from pydantic import BaseModel
from typing import List, Optional


class SummaryStripOut(BaseModel):
    total_attempts: int
    avg_accuracy: float
    mom_accuracy_delta: float
    ai_precision: float
    active_test_takers: int


class SubjectDiagnosticItemOut(BaseModel):
    subject: str
    total_questions: int
    attempted: int
    accuracy: str
    target: str
    status: str


class AIPipelinePrecisionItemOut(BaseModel):
    label: str
    value: str
    description: str


class PlatformAnalyticsResponse(BaseModel):
    time_range: str
    exam_filter: str
    summary: SummaryStripOut
    subject_accuracy: List[SubjectDiagnosticItemOut]
    ai_precision_metrics: List[AIPipelinePrecisionItemOut]
    generated_at: str
