from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, Text
from app.db.models.types import DateTimeTZ, BigIntPK
from app.db.models.enums import NotificationContentType, NotificationStatus

if TYPE_CHECKING:
    from app.db.models.user import User


class Notification(SQLModel, table=True):
    """
    Broadcast notification entity created and managed by administrators.
    Allows broadcasting announcements (YouTube links, PDFs, articles, or other content)
    to all users with a draft -> publish workflow.
    """
    __tablename__ = "broadcast_notifications"

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    title: str = Field(..., max_length=255)
    description: Optional[str] = Field(default=None, sa_column=Column(Text))
    content_type: str = Field(
        default="other",
        max_length=50,
        description="video, pdf, article, other - used to render icon/label"
    )
    link: Optional[str] = Field(default=None, max_length=1000)
    attachment: Optional[str] = Field(default=None, max_length=1000)
    status: str = Field(
        default="draft",
        max_length=50,
        index=True,
        description="draft, published, rejected"
    )
    created_by_id: Optional[int] = Field(
        default=None,
        foreign_key="users.id",
        ondelete="SET NULL",
        index=True
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
        index=True,
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
    published_at: Optional[datetime] = Field(
        default=None,
        sa_type=DateTimeTZ,
        index=True,
    )

    # Relationships
    created_by: Optional["User"] = Relationship()


# Alias for explicit naming
BroadcastNotification = Notification


class UserNotification(SQLModel, table=True):
    """
    User-specific notification record (e.g. personal daily study reminders).
    Maintained for backward compatibility with study scheduler and user in-app alerts.
    """
    __tablename__ = "notifications"

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    user_id: int = Field(foreign_key="users.id", index=True)
    title: str = Field(..., max_length=255)
    message: str = Field(...)
    notification_type: str = Field(default="GENERAL", max_length=50) # PENDING_TASKS, TEST_REPORT_READY, etc.
    action_url: Optional[str] = Field(default=None, max_length=255)
    is_read: bool = Field(default=False, index=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )


class UserNotificationRead(SQLModel, table=True):
    """
    Tracks read receipts per user for any notification (including broadcast announcements and personal alerts).
    Guarantees read state persistence across sessions and page refreshes.
    """
    __tablename__ = "user_notification_reads"

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    user_id: int = Field(foreign_key="users.id", index=True, ondelete="CASCADE")
    notification_id: str = Field(max_length=100, index=True)
    read_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

