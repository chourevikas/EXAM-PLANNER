import uuid
import unittest
from httpx import AsyncClient, ASGITransport
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine

from app.fastapi_server import app
from app.db.session import get_async_session
from app.db.models import Exam, SyllabusVersion, Subject, Topic, Subtopic
from app.services.syllabus_service import SyllabusService
from app.schemas.syllabus_literals import (
    SYLLABUS_HIERARCHY,
    is_valid_subject,
    is_valid_topic,
    is_valid_subtopic,
    verify_syllabus_node,
)


class TestSyllabusHierarchyEndpoints(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with self.engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)

        self.session_factory = sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )

        async def override_get_session():
            async with self.session_factory() as session:
                yield session

        app.dependency_overrides[get_async_session] = override_get_session

    async def asyncTearDown(self):
        app.dependency_overrides.clear()
        await self.engine.dispose()

    async def test_complete_syllabus_endpoint(self):
        """Tests GET /api/v1/syllabus returns the complete 8-subject, 55-topic, 298-subtopic hierarchy."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            response = await ac.get("/api/v1/syllabus")
            self.assertEqual(response.status_code, 200)
            data = response.json()

            self.assertEqual(data["version_code"], "UPSC_PRELIMS_MASTER_V1")
            self.assertEqual(data["total_subjects"], 8)
            self.assertEqual(data["total_topics"], 55)
            self.assertEqual(data["total_subtopics"], 298)
            self.assertEqual(len(data["subjects"]), 8)

            # Verify subjects have nested topics and subtopics
            history_subj = next((s for s in data["subjects"] if s["name"] == "History"), None)
            self.assertIsNotNone(history_subj)
            self.assertEqual(history_subj["code"], "HISTORY")
            self.assertEqual(history_subj["topics_count"], 3)
            self.assertEqual(history_subj["subtopics_count"], 50)

            ancient_top = next((t for t in history_subj["topics"] if t["name"] == "Ancient History"), None)
            self.assertIsNotNone(ancient_top)
            self.assertEqual(ancient_top["subtopics_count"], 12)
            self.assertEqual(len(ancient_top["subtopics"]), 12)

            # Verify flat hierarchy
            self.assertIn("Ancient History", data["flat_hierarchy"])
            self.assertIn("Pre Historic Times", data["flat_hierarchy"]["Ancient History"])

            # Verify direct hierarchy mapping
            self.assertIn("History", data["hierarchy"])
            self.assertIn("Ancient History", data["hierarchy"]["History"])
            self.assertIn("Pre Historic Times", data["hierarchy"]["History"]["Ancient History"])

    async def test_syllabus_verify_endpoint(self):
        """Tests POST /api/v1/syllabus/verify endpoint with exact and non-canonical nodes."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            # 1. Exact valid node
            res_exact = await ac.post(
                "/api/v1/syllabus/verify",
                json={
                    "subject": "History",
                    "topic": "Ancient History",
                    "subtopic": "Pre Historic Times",
                },
            )
            self.assertEqual(res_exact.status_code, 200)
            data_exact = res_exact.json()
            self.assertTrue(data_exact["is_valid"])
            self.assertTrue(data_exact["is_canonical_exact_match"])
            self.assertEqual(data_exact["canonical_subject"], "History")
            self.assertEqual(data_exact["canonical_topic"], "Ancient History")
            self.assertEqual(data_exact["canonical_subtopic"], "Pre Historic Times")
            self.assertIsNone(data_exact["issue_reason"])

            # 2. Non-canonical subtopic requiring auto-repair
            res_fuzzy = await ac.post(
                "/api/v1/syllabus/verify",
                json={
                    "subject": "History",
                    "topic": "Ancient History",
                    "subtopic": "Random Quantum Physics Concept",
                },
            )
            self.assertEqual(res_fuzzy.status_code, 200)
            data_fuzzy = res_fuzzy.json()
            self.assertTrue(data_fuzzy["is_valid"])
            self.assertFalse(data_fuzzy["is_canonical_exact_match"])
            self.assertIsNotNone(data_fuzzy["issue_reason"])

    async def test_exam_syllabus_sync_and_endpoint(self):
        """Tests SyllabusService.sync_or_create_exam_syllabus and GET /api/v1/exams/{exam_id}/syllabus."""
        syl_ver_id = None
        async with self.session_factory() as session:
            exam = Exam(
                code=f"test-syllabus-exam-{uuid.uuid4().hex[:6]}",
                name="Test Syllabus Exam",
                source_year=2024,
                stage="prelims",
                subject_code="gs1",
                paper_set_code="SET_A",
            )
            session.add(exam)
            await session.commit()
            await session.refresh(exam)
            exam_id = exam.id

            service = SyllabusService(session)
            syl_ver = await service.sync_or_create_exam_syllabus(exam.id)
            self.assertIsNotNone(syl_ver)
            self.assertEqual(syl_ver.exam_id, exam.id)
            self.assertEqual(syl_ver.version_code, "UPSC_PRELIMS_MASTER_V1")
            syl_ver_id = syl_ver.id

            # Verify DB records created
            subjs = (await session.exec(select(Subject).where(Subject.version_id == syl_ver.id))).all()
            self.assertEqual(len(subjs), 8)

        # Call endpoint with overridden dependency session
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            res = await ac.get(f"/api/v1/exams/{exam_id}/syllabus")
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertEqual(str(data["exam_id"]), str(exam_id))
            self.assertEqual(str(data["syllabus_version_id"]), str(syl_ver_id))
            self.assertEqual(len(data["subjects"]), 8)
            self.assertIsNotNone(data["subjects"][0]["id"])
