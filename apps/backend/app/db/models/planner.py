"""Study Planner v2: an admin-editable syllabus per planner exam, and each student's coverage, plan and settings.

Planner exams (UPSC Prelims, State PCS, CDS, Mains, optionals) are syllabi, not papers, so they live apart from
the `exams` table. A planner subtopic can point at a question-bank subtopic for Practice and weak-topic data.
"""
import datetime as dt
from datetime import datetime, timezone
from typing import Optional, Any, Dict
from sqlmodel import SQLModel, Field, Index, Column, UniqueConstraint
from app.db.models.types import DateTimeTZ, PortableJSON, BigIntPK


def _now() -> datetime:
    return datetime.now(timezone.utc)


class PlannerExam(SQLModel, table=True):
    """A study syllabus of an exam type: UPSC Prelims, UPSC Mains, UPSC Optional: Geography, MPSC Prelims…"""
    __tablename__ = "planner_exams"
    __table_args__ = (
        UniqueConstraint("exam_type_id", "stage", "name", name="uq_planner_exams_type_stage_name"),
        Index("ix_planner_exams_type_order", "exam_type_id", "sort_order"),
    )

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    # Practice opens this exam type's questions. An exam type with a syllabus can't be deleted.
    exam_type_id: int = Field(foreign_key="exam_types.id", ondelete="RESTRICT", index=True)
    stage: str = Field(default="prelims", max_length=20)  # prelims | mains | optional
    name: str = Field(max_length=120)  # "Prelims", "Mains", or the optional's subject
    answer_writing: bool = Field(default=False)  # Mains-style plans add a daily answer-writing block
    sort_order: int = Field(default=0)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=_now, sa_type=DateTimeTZ)


def syllabus_label(exam_type_code: str, stage: str, name: str) -> str:
    """What students see: "UPSC Prelims", "UPSC Optional: Geography"."""
    code = (exam_type_code or "").upper()
    return f"{code} Optional: {name}" if stage == "optional" else f"{code} {name}"


class PlannerSubject(SQLModel, table=True):
    __tablename__ = "planner_subjects"
    __table_args__ = (Index("ix_planner_subjects_exam_order", "exam_id", "sort_order"),)

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    exam_id: int = Field(foreign_key="planner_exams.id", ondelete="CASCADE", index=True)
    name: str = Field(max_length=200)
    sort_order: int = Field(default=0)


class PlannerTopic(SQLModel, table=True):
    __tablename__ = "planner_topics"
    __table_args__ = (Index("ix_planner_topics_subject_order", "subject_id", "sort_order"),)

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    subject_id: int = Field(foreign_key="planner_subjects.id", ondelete="CASCADE", index=True)
    name: str = Field(max_length=200)
    sort_order: int = Field(default=0)


class PlannerSubtopic(SQLModel, table=True):
    __tablename__ = "planner_subtopics"
    __table_args__ = (Index("ix_planner_subtopics_topic_order", "topic_id", "sort_order"),)

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    topic_id: int = Field(foreign_key="planner_topics.id", ondelete="CASCADE", index=True)
    name: str = Field(max_length=255)
    sort_order: int = Field(default=0)
    bank_subtopic_id: Optional[int] = Field(default=None, foreign_key="subtopics.id", ondelete="SET NULL", index=True)


class UserSyllabusCoverage(SQLModel, table=True):
    __tablename__ = "user_syllabus_coverage"

    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", primary_key=True)
    planner_subtopic_id: int = Field(foreign_key="planner_subtopics.id", ondelete="CASCADE", primary_key=True)
    covered_at: datetime = Field(default_factory=_now, sa_type=DateTimeTZ, index=True)


class StudyPlan(SQLModel, table=True):
    """The plan a student generated last; its options are the form they filled in."""
    __tablename__ = "study_plans"
    __table_args__ = (Index("ix_study_plans_user_active", "user_id", "is_active"),)

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    planner_exam_id: Optional[int] = Field(default=None, foreign_key="planner_exams.id", ondelete="SET NULL")
    start_date: dt.date
    days: int
    options: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(PortableJSON))
    last_auto_catchup: Optional[dt.date] = Field(default=None)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=_now, sa_type=DateTimeTZ)


class StudyPlanShare(SQLModel, table=True):
    __tablename__ = "study_plan_shares"

    token: str = Field(primary_key=True, max_length=32)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    payload: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(PortableJSON))
    created_at: datetime = Field(default_factory=_now, sa_type=DateTimeTZ)


class PlannerSettings(SQLModel, table=True):
    """Per-student planner settings, kept off student_profiles."""
    __tablename__ = "planner_settings"
    __table_args__ = (UniqueConstraint("user_id", name="uq_planner_settings_user"),)

    id: Optional[int] = Field(default=None, primary_key=True, sa_type=BigIntPK)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    daily_goal_topics: int = Field(default=3)
    weekly_coverage_target: int = Field(default=5)
    prefs: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(PortableJSON))  # last generate-form values
