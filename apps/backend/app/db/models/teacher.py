from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from app.db.models.types import DateTimeTZ, BigIntPK
from app.db.models.enums import RedemptionStatus

if TYPE_CHECKING:
    from app.db.models.user import User


class TeacherProfile(SQLModel, table=True):
    __tablename__ = "teacher_profiles"

    user_id: int = Field(
        foreign_key="users.id", ondelete="CASCADE", primary_key=True, index=True
    )
    total_review_points: int = Field(default=0)
    reviews_completed_count: int = Field(default=0)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )


class ReviewPointsLog(SQLModel, table=True):
    __tablename__ = "review_points_logs"

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    review_task_id: Optional[int] = Field(
        default=None, foreign_key="human_review_tasks.id", ondelete="SET NULL"
    )
    question_id: Optional[int] = Field(
        default=None, foreign_key="questions.id", ondelete="SET NULL"
    )
    action: str = Field(max_length=20, description="APPROVE or REJECT")
    points: int
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )


class TeacherReward(SQLModel, table=True):
    __tablename__ = "teacher_rewards"

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    teacher_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    admin_id: Optional[int] = Field(
        default=None, foreign_key="users.id", ondelete="SET NULL"
    )
    title: str = Field(max_length=255)
    description: Optional[str] = Field(default=None)
    points_value: Optional[int] = Field(default=None)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )


class RedemptionRequest(SQLModel, table=True):
    __tablename__ = "redemption_requests"

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    points_redeemed: int = Field(default=0)
    cash_amount: float = Field(default=0.0)
    payment_details: Optional[str] = Field(default=None)
    status: RedemptionStatus = Field(
        default=RedemptionStatus.PENDING, index=True
    )
    processed_by_id: Optional[int] = Field(
        default=None, foreign_key="users.id", ondelete="SET NULL"
    )
    rejection_reason: Optional[str] = Field(default=None)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
    processed_at: Optional[datetime] = Field(
        default=None,
        sa_type=DateTimeTZ,
    )

