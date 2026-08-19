from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import datetime as dt
import uuid
from app.db.models.enums import StudyActivityType, ActivitySource

class StudyActivityCreate(BaseModel):
    activity_type: StudyActivityType
    activity_source: ActivitySource = ActivitySource.UNPLANNED
    subject: Optional[str] = None
    topic: Optional[str] = None
    duration_minutes: int = 0
    questions_attempted: Optional[int] = None
    questions_correct: Optional[int] = None
    score: Optional[float] = None
    confidence_rating: Optional[int] = None
    notes: Optional[str] = None

class StudyActivityOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    date: dt.date
    activity_type: StudyActivityType
    activity_source: ActivitySource
    subject: Optional[str]
    topic: Optional[str]
    duration_minutes: int
    questions_attempted: Optional[int]
    questions_correct: Optional[int]
    score: Optional[float]
    confidence_rating: Optional[int]
    notes: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True
