import uuid
from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship, Index


class Exam(SQLModel, table=True):
    __tablename__ = "exams"
    __table_args__ = (
        Index("ix_exams_active_order", "is_active", "display_order"),
        Index("ix_exams_canonical_match", "stage", "subject_code", "source_year", "paper_set_code"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    code: str = Field(unique=True, index=True, max_length=100, description="Canonical code e.g. upsc_cse-prelims-gs1-2023-A")
    name: str = Field(max_length=200)
    
    # Standardized Filename Tokens
    stage: str = Field(default="prelims", index=True, max_length=50, description="Stage e.g. prelims, mains")
    subject_code: str = Field(default="gs1", index=True, max_length=50, description="Subject e.g. gs1, csat")
    source_year: int = Field(default=2023, index=True, description="Year e.g. 2023")
    paper_set_code: str = Field(default="SET_A", index=True, max_length=20, description="Paper Set e.g. SET_A, SET_B")
    
    description: Optional[str] = Field(default=None)
    pdf_path: Optional[str] = Field(default=None)
    total_pages: Optional[int] = Field(default=None)
    display_order: int = Field(default=1)
    is_active: bool = Field(default=True, index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    syllabus_versions: List["SyllabusVersion"] = Relationship(back_populates="exam", cascade_delete=True)


class SyllabusVersion(SQLModel, table=True):
    __tablename__ = "syllabus_versions"
    __table_args__ = (
        Index("ix_syllabus_exam_version", "exam_id", "version_code", unique=True),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    exam_id: uuid.UUID = Field(foreign_key="exams.id", ondelete="CASCADE", index=True)
    version_code: str = Field(max_length=50)
    title: Optional[str] = Field(default=None)
    effective_from: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = Field(default=True, index=True)

    exam: Optional[Exam] = Relationship(back_populates="syllabus_versions")
    subjects: List["Subject"] = Relationship(back_populates="syllabus_version", cascade_delete=True)


class Subject(SQLModel, table=True):
    __tablename__ = "subjects"
    __table_args__ = (
        Index("ix_subjects_syllabus_order", "syllabus_version_id", "display_order"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    syllabus_version_id: uuid.UUID = Field(foreign_key="syllabus_versions.id", ondelete="CASCADE", index=True)
    code: str = Field(default="DEFAULT", max_length=50)
    name: str = Field(max_length=200)
    display_order: int = Field(default=1)

    syllabus_version: Optional[SyllabusVersion] = Relationship(back_populates="subjects")
    topics: List["Topic"] = Relationship(back_populates="subject", cascade_delete=True)


class Topic(SQLModel, table=True):
    __tablename__ = "topics"
    __table_args__ = (
        Index("ix_topics_subject_order", "subject_id", "display_order"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    subject_id: uuid.UUID = Field(foreign_key="subjects.id", ondelete="CASCADE", index=True)
    code: str = Field(default="DEFAULT", max_length=50)
    name: str = Field(max_length=200)
    display_order: int = Field(default=1)

    subject: Optional[Subject] = Relationship(back_populates="topics")
    subtopics: List["Subtopic"] = Relationship(back_populates="topic", cascade_delete=True)


class Subtopic(SQLModel, table=True):
    __tablename__ = "subtopics"
    __table_args__ = (
        Index("ix_subtopics_topic_order", "topic_id", "display_order"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    topic_id: uuid.UUID = Field(foreign_key="topics.id", ondelete="CASCADE", index=True)
    code: str = Field(default="DEFAULT", max_length=50)
    name: str = Field(max_length=200)
    display_order: int = Field(default=1)

    topic: Optional[Topic] = Relationship(back_populates="subtopics")
