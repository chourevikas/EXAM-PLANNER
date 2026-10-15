"""Admin dashboard "Recent Exam Paper Uploads" must agree with the admin exams list ("View All")."""
from datetime import datetime, timedelta, timezone

import pytest
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import StaticPool

from app.db.models.hierarchy import Exam
from app.db.models.pipeline_run import PipelineRun
from app.db.models.enums import ExamStatus
from app.services.admin_service import AdminService


@pytest.fixture
async def session():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    async with AsyncSession(engine, expire_on_commit=False) as s:
        yield s
    await engine.dispose()


@pytest.mark.anyio
async def test_recent_uploads_match_exams_list(session):
    now = datetime.now(timezone.utc)

    def exam(code, status, minutes_ago, extracted=0):
        return Exam(
            code=code, name=code, source_year=2024, status=status,
            extracted_questions_count=extracted, created_at=now - timedelta(minutes=minutes_ago),
        )

    exams = {
        # A student's subject-wise simulation, created ARCHIVED with no extracted questions exactly
        # like exam_session_service does. These rows used to show as "In Extraction" for days.
        "dyn": exam("DYN_student_sim", ExamStatus.ARCHIVED, 1),
        # A fresh upload mid-extraction: exams start as PENDING_HUMAN_REVIEW, the run is the live signal.
        "uploading": exam("NEW-UPLOAD", ExamStatus.PENDING_HUMAN_REVIEW, 2),
        "review": exam("READY-REVIEW", ExamStatus.PENDING_HUMAN_REVIEW, 3, extracted=100),
        # Published, but its questions aren't rows in this DB yet: the list still shows it as live.
        "published": exam("PUBLISHED", ExamStatus.PUBLISHED, 4, extracted=0),
        # Archived with no questions: previously guessed to be extracting.
        "archived": exam("ARCHIVED-EMPTY", ExamStatus.ARCHIVED, 5),
    }
    exams["published"].pdf_path = "papers/published.pdf"
    session.add_all(exams.values())
    await session.commit()
    session.add_all([
        PipelineRun(exam_id=exams["uploading"].id, pipeline_type="QUESTION_EXTRACTION", status="RUNNING"),
        PipelineRun(exam_id=exams["review"].id, pipeline_type="QUESTION_EXTRACTION", status="COMPLETED"),
    ])
    await session.commit()

    stats = await AdminService(session).get_admin_overview_stats()
    recent = {u.title: u for u in stats.recent_uploads}

    # Student simulations are not uploads.
    assert "DYN_student_sim" not in recent
    assert set(recent) == {"NEW-UPLOAD", "READY-REVIEW", "PUBLISHED", "ARCHIVED-EMPTY"}
    assert recent["PUBLISHED"].raw_status == "PUBLISHED"
    # Real paper details and a timezone-aware upload time for the row's subtitle and "Uploaded" column.
    pub = recent["PUBLISHED"]
    assert (pub.stage, pub.source_year, pub.paper_set_code) == ("prelims", 2024, "SET_A")
    assert datetime.fromisoformat(pub.created_at).utcoffset() == timedelta(0)
    assert recent["READY-REVIEW"].is_extracting is False
    assert recent["PUBLISHED"].is_extracting is False
    # An archived paper with no questions used to be guessed as "In Extraction".
    assert recent["ARCHIVED-EMPTY"].is_extracting is False
    # A RUNNING extraction run is live (stuck runs are marked INTERRUPTED at server start).
    assert recent["NEW-UPLOAD"].is_extracting is True

    # Every row says exactly what the admin exams list ("View All") says for that paper.
    from app.routers.admin import _compute_exam_pipeline_statuses

    pipeline = {p["code"]: p for p in await _compute_exam_pipeline_statuses(session)}
    assert "DYN_student_sim" not in pipeline
    for title, upload in recent.items():
        assert AdminService._shown_as_extracting(pipeline[title]) == upload.is_extracting, title
    # The raw backend flag says "extracting" for the published paper with no question rows,
    # but the exams list (and so the dashboard) shows it as live.
    assert pipeline["PUBLISHED"]["is_extracting"] is True
