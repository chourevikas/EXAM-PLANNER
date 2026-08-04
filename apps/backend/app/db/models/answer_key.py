import uuid
from enum import Enum
from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship, Column, Index
from app.db.models.types import PortableJSON


class SetMatchStatus(str, Enum):
    MATCHED = "MATCHED"
    MISMATCH_SKIPPED = "MISMATCH_SKIPPED"
    MULTI_SET_MATRIX = "MULTI_SET_MATRIX"
    UNDETECTED = "UNDETECTED"


class MappingStatus(str, Enum):
    APPLIED = "APPLIED"
    QUESTION_NOT_FOUND = "QUESTION_NOT_FOUND"
    CONFLICT_FLAGGED = "CONFLICT_FLAGGED"
    SKIPPED_SET_MISMATCH = "SKIPPED_SET_MISMATCH"


class AnswerKeyBatch(SQLModel, table=True):
    __tablename__ = "answer_key_batches"
    __table_args__ = (Index("ix_ak_batch_exam_status", "exam_id", "set_match_status"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    exam_id: uuid.UUID = Field(foreign_key="exams.id", ondelete="CASCADE", index=True)
    pdf_path: str = Field(description="Path or S3 key of uploaded answer key PDF/image")
    target_set_code: str = Field(
        default="SET_A",
        max_length=20,
        index=True,
        description="Expected paper set e.g. SET_A",
    )
    detected_set_code: Optional[str] = Field(
        default=None,
        max_length=20,
        index=True,
        description="Set code detected by LLM from image header",
    )
    set_match_status: SetMatchStatus = Field(
        default=SetMatchStatus.UNDETECTED, index=True
    )
    total_keys_extracted: int = Field(default=0)
    total_keys_mapped: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    mappings: List["AnswerKeyMapping"] = Relationship(
        back_populates="batch", cascade_delete=True
    )


class AnswerKeyMapping(SQLModel, table=True):
    __tablename__ = "answer_key_mappings"
    __table_args__ = (
        Index("ix_ak_mapping_batch_q", "batch_id", "question_id"),
        Index("ix_ak_mapping_status", "mapping_status"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    batch_id: uuid.UUID = Field(
        foreign_key="answer_key_batches.id", ondelete="CASCADE", index=True
    )
    question_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="questions.id", ondelete="SET NULL", index=True
    )
    printed_question_number: int = Field(index=True)
    detected_option_label: str = Field(max_length=10, description="'A', 'B', 'C', 'D'")
    paper_set_code: str = Field(default="SET_A", max_length=20, index=True)
    mapping_status: MappingStatus = Field(default=MappingStatus.APPLIED, index=True)
    notes: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    batch: Optional[AnswerKeyBatch] = Relationship(back_populates="mappings")
