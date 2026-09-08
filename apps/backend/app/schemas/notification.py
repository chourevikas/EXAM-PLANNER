from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, model_validator, ConfigDict
from app.db.models.enums import NotificationContentType, NotificationStatus


class NotificationCreatePayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: str = Field(..., min_length=1, max_length=255, description="Notification title")
    description: Optional[str] = Field(default=None, description="Short summary or rich body content")
    body: Optional[str] = Field(default=None, description="Alias for description")
    content_type: NotificationContentType = Field(
        default=NotificationContentType.OTHER,
        alias="contentType",
        description="video, pdf, article, other"
    )
    link: Optional[str] = Field(default=None, max_length=1000, description="Optional external/internal URL")
    attachment: Optional[str] = Field(default=None, max_length=1000, description="Optional uploaded file path or URL")

    @model_validator(mode="after")
    def validate_content_and_destination(self) -> "NotificationCreatePayload":
        # Resolve body alias if description not provided
        if not self.description and self.body:
            self.description = self.body

        # Validate title
        if not self.title or not self.title.strip():
            raise ValueError("Title is required and cannot be blank.")

        # Validate at least one of link or attachment is present
        has_link = bool(self.link and self.link.strip())
        has_attachment = bool(self.attachment and self.attachment.strip())
        if not has_link and not has_attachment:
            raise ValueError("At least one of 'link' or 'attachment' must be provided (content must point somewhere).")

        return self


class NotificationUpdatePayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    body: Optional[str] = None
    content_type: Optional[NotificationContentType] = Field(default=None, alias="contentType")
    link: Optional[str] = Field(default=None, max_length=1000)
    attachment: Optional[str] = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def resolve_aliases(self) -> "NotificationUpdatePayload":
        if self.description is None and self.body is not None:
            self.description = self.body
        if self.title is not None and not self.title.strip():
            raise ValueError("Title cannot be blank if provided.")
        return self


class NotificationResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: int
    title: str
    description: Optional[str] = None
    content_type: str = Field(alias="contentType")
    link: Optional[str] = None
    attachment: Optional[str] = None
    status: str
    created_by_id: Optional[int] = Field(default=None, alias="createdById")
    created_by: Optional[str] = Field(default=None, alias="createdBy")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    published_at: Optional[datetime] = Field(default=None, alias="publishedAt")

    @property
    def contentType(self) -> str:
        return self.content_type

    @property
    def publishedAt(self) -> Optional[datetime]:
        return self.published_at

    @property
    def createdAt(self) -> datetime:
        return self.created_at

    @property
    def updatedAt(self) -> datetime:
        return self.updated_at

    @property
    def createdBy(self) -> Optional[str]:
        return self.created_by


class NotificationListResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    items: List[NotificationResponse]
    total: int
    page: int
    page_size: int = Field(alias="pageSize")
    total_pages: int = Field(alias="totalPages")
