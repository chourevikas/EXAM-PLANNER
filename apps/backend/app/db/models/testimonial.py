import uuid
from datetime import datetime, timezone
from typing import Optional
from enum import Enum
from sqlmodel import SQLModel, Field


class TestimonialStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class Testimonial(SQLModel, table=True):
    __tablename__ = "testimonials"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id", nullable=True)
    user_name: str
    user_exam: str
    user_photo: Optional[str] = None
    rating: int = Field(default=5, ge=1, le=5)
    quote: str
    status: TestimonialStatus = Field(default=TestimonialStatus.PENDING)
    rejection_reason: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
