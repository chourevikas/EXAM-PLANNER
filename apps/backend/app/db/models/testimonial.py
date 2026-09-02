from datetime import datetime, timezone
from typing import Optional
from enum import Enum
from sqlmodel import SQLModel, Field
from app.db.models.types import BigIntPK, DateTimeTZ


class TestimonialStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class Testimonial(SQLModel, table=True):
    __tablename__ = "testimonials"

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id", nullable=True, index=True)
    user_name: str
    user_exam: str
    user_photo: Optional[str] = None
    rating: int = Field(default=5, ge=1, le=5)
    quote: str
    status: TestimonialStatus = Field(default=TestimonialStatus.PENDING)
    rejection_reason: Optional[str] = None
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
