from typing import Optional
from datetime import datetime, timezone
import datetime as dt
from sqlmodel import SQLModel, Field
from app.db.models.types import DateTimeTZ, BigIntPK

class CurrentAffair(SQLModel, table=True):
    __tablename__ = "current_affairs"

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    title: str = Field(max_length=255)
    content: str  # Markdown content
    
    topic: Optional[str] = Field(default=None, index=True)
    subtopic: Optional[str] = Field(default=None, index=True)
    
    date: dt.date = Field(default_factory=lambda: datetime.now(timezone.utc).date(), index=True)
    
    is_published: bool = Field(default=True, index=True)
    
    created_by_id: Optional[int] = Field(default=None, foreign_key="users.id", ondelete="SET NULL")
    
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
