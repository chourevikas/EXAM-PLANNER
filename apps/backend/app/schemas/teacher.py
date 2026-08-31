from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class ReviewPointsLogOut(BaseModel):
    id: int
    action: str
    points: int
    question_id: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TeacherPointsSummaryOut(BaseModel):
    total_review_points: int
    reviews_completed_count: int
    recent_logs: List[ReviewPointsLogOut] = []


class TeacherRewardOut(BaseModel):
    id: int
    teacher_id: int
    admin_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    points_value: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GrantRewardPayload(BaseModel):
    title: str
    description: Optional[str] = None
    points_value: Optional[int] = None


class TeacherLeaderboardEntryOut(BaseModel):
    teacher_id: int
    full_name: str
    email: str
    total_review_points: int
    reviews_completed_count: int
