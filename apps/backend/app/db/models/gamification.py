from datetime import date, datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship, Index
from app.db.models.types import DateTimeTZ, BigIntPK

if TYPE_CHECKING:
    from app.db.models.user import User

class Badge(SQLModel, table=True):
    __tablename__ = "badges"

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    name: str = Field(max_length=255)
    description: str
    icon_url: Optional[str] = Field(default=None)
    required_xp: Optional[int] = Field(default=None)
    # Milestones (admin-managed): unlocked when the student's criteria_type count reaches threshold.
    # Badges without criteria_type are the older name-based badges.
    criteria_type: Optional[str] = Field(default=None, max_length=30)
    threshold: Optional[int] = Field(default=None)
    xp_reward: int = Field(default=100)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    user_badges: List["UserBadge"] = Relationship(back_populates="badge", cascade_delete=True)

class UserBadge(SQLModel, table=True):
    __tablename__ = "user_badges"
    
    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    user_id: int = Field(foreign_key="users.id", index=True, ondelete="CASCADE")
    badge_id: int = Field(foreign_key="badges.id", index=True, ondelete="CASCADE")
    unlocked_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    user: Optional["User"] = Relationship(back_populates="user_badges")
    badge: Optional[Badge] = Relationship(back_populates="user_badges")

class XPLog(SQLModel, table=True):
    """XP ledger; StudentProfile.total_xp is the sum of a student's rows.

    ref_key makes an award idempotent (e.g. "attempt:78", "day:2026-10-17"): a second award with the
    same key for the same user is ignored.
    """
    __tablename__ = "xp_logs"
    __table_args__ = (Index("ux_xp_logs_user_ref", "user_id", "ref_key", unique=True),)

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    user_id: int = Field(foreign_key="users.id", index=True, ondelete="CASCADE")
    amount: int
    source: str = Field(max_length=100)
    description: Optional[str] = Field(default=None)
    ref_key: Optional[str] = Field(default=None, max_length=100)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    user: Optional["User"] = Relationship(back_populates="xp_logs")


class LeaderboardSnapshot(SQLModel, table=True):
    """One student's standing on a given day: recalculated nightly per target exam, nationally and by state."""

    __tablename__ = "leaderboard_snapshots"
    __table_args__ = (
        Index("ix_leaderboard_national", "snapshot_date", "exam", "rank_national"),
        Index("ix_leaderboard_state", "snapshot_date", "exam", "state", "rank_state"),
        Index("ux_leaderboard_user_day", "snapshot_date", "user_id", unique=True),
    )

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    snapshot_date: date
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE")
    exam: str = Field(max_length=100)
    state: Optional[str] = Field(default=None, max_length=64)
    xp: int = Field(default=0)
    correct_answers: int = Field(default=0)
    rank_national: int
    rank_state: Optional[int] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_type=DateTimeTZ)

