import unittest
from httpx import AsyncClient, ASGITransport
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine

from app.fastapi_server import app
from app.db.session import get_async_session
from app.db.models import Exam, SyllabusVersion, Subject, Topic, Subtopic, QuestionSourceType, ExamStatus
from app.cache import get_cache


class TestGlobalSearchEndpoint(unittest.IsolatedAsyncioTestCase):
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

        # Clear cache before each test
        cache = get_cache()
        await cache.clear()

        # Seed sample data
        async with self.session_factory() as session:
            exam_pyq = Exam(
                code="upsc-cse-prelims-2023-gs1",
                name="UPSC CSE Prelims 2023 GS Paper I",
                exam_type=QuestionSourceType.PYQ,
                status=ExamStatus.PUBLISHED,
                stage="prelims",
                subject_code="gs1",
                source_year=2023,
                is_active=True,
            )
            exam_mock = Exam(
                code="upsc-prelims-mock-01",
                name="Polity Full Mock Test #1",
                exam_type=QuestionSourceType.STATIC_MOCK,
                status=ExamStatus.PUBLISHED,
                stage="prelims",
                subject_code="gs1",
                source_year=2024,
                is_active=True,
            )
            session.add_all([exam_pyq, exam_mock])
            await session.commit()
            await session.refresh(exam_pyq)
            await session.refresh(exam_mock)

            syl_ver = SyllabusVersion(
                exam_id=exam_pyq.id,
                version_code="UPSC_V1",
                is_active=True,
            )
            session.add(syl_ver)
            await session.commit()
            await session.refresh(syl_ver)

            subj = Subject(name="Indian Polity", code="POLITY", display_order=1, version_id=syl_ver.id)
            session.add(subj)
            await session.commit()
            await session.refresh(subj)
            topic = Topic(name="Fundamental Rights", subject_id=subj.id, display_order=1)
            session.add(topic)
            await session.commit()
            await session.refresh(topic)

            subtopic = Subtopic(name="Right to Equality", topic_id=topic.id, display_order=1)
            session.add(subtopic)
            await session.commit()

    async def asyncTearDown(self):
        app.dependency_overrides.clear()
        await self.engine.dispose()
        cache = get_cache()
        await cache.clear()

    async def test_search_pyq_and_mock(self):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            res = await ac.get("/api/v1/search?q=Polity")
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertIn("mocks", data)
            self.assertIn("pyqs", data)
            self.assertIn("topics", data)

            # Mock test should match
            mock_titles = [m["title"] for m in data["mocks"]]
            self.assertTrue(any("Polity" in t for t in mock_titles))

    async def test_search_topic_and_subtopic(self):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            res = await ac.get("/api/v1/search?q=Equality")
            self.assertEqual(res.status_code, 200)
            data = res.json()
            topic_titles = [t["title"] for t in data["topics"]]
            self.assertIn("Right to Equality", topic_titles)

    async def test_search_caching(self):
        cache = get_cache()
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            # First request populates cache
            res1 = await ac.get("/api/v1/search?q=Fundamental")
            self.assertEqual(res1.status_code, 200)

            # Check cache directly
            cached = await cache.get("ep:search:fundamental")
            self.assertIsNotNone(cached)

            # Second request uses cache
            res2 = await ac.get("/api/v1/search?q=Fundamental")
            self.assertEqual(res2.status_code, 200)
            self.assertEqual(res1.json(), res2.json())

    async def test_search_empty_or_fallback(self):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            res = await ac.get("/api/v1/search?q=NonExistentTermXYZ")
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertEqual(len(data["mocks"]), 0)
            self.assertEqual(len(data["pyqs"]), 0)
            self.assertEqual(len(data["topics"]), 1)
            self.assertIn("Explore Study Planner", data["topics"][0]["title"])
