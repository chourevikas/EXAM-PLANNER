import uuid
import unittest
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine

from app.db.models import Exam, Question, QuestionStatus, ExamStatus, LanguageCode
from app.schemas.question import (
    QuestionCreatePayload,
    QuestionUpdatePayload,
    QuestionOptionPayload,
)
from app.services.question_service import QuestionService
from app.services.exam_service import ExamService
from app.cache.factory import get_cache, reset_cache_client


class TestCacheEndpointsAndServices(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        reset_cache_client()
        self.cache = get_cache()
        await self.cache.clear()

        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with self.engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)

        self.session_factory = sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )

    async def asyncTearDown(self):
        await self.cache.clear()
        reset_cache_client()
        await self.engine.dispose()

    async def test_question_service_list_and_detail_caching_and_invalidation(self):
        async with self.session_factory() as session:
            exam = Exam(
                code="upsc-prelims-2024",
                name="UPSC Prelims 2024",
                stage="PRELIMS",
                subject_code="GS1",
                source_year=2024,
                paper_set_code="SET_A",
                status=ExamStatus.PUBLISHED,
                is_active=True,
            )
            session.add(exam)
            await session.commit()

            q_service = QuestionService(session)
            created_q = await q_service.create_question(
                QuestionCreatePayload(
                    exam_id=exam.id,
                    question_number_in_paper=1,
                    question_text="What is the capital of India?",
                    options=[
                        QuestionOptionPayload(option_label="A", option_text="New Delhi", is_correct=True),
                        QuestionOptionPayload(option_label="B", option_text="Mumbai", is_correct=False),
                    ],
                )
            )
            q_id = int(created_q.question_id)

            # 1. Fetch Question Detail -> Populates Cache
            res1 = await q_service.get_question_detail(q_id, language=LanguageCode.ENGLISH)
            self.assertEqual(res1.marks, 2.0)

            # Check that cache has the item
            from app.cache.helpers import build_cache_key
            expected_key = build_cache_key("questions:detail", str(q_id), lang=str(LanguageCode.ENGLISH.value))
            cache_val = await self.cache.get(expected_key)
            self.assertIsNotNone(cache_val)

            # 2. Update Question Marks -> Invalidates Cache
            await q_service.update_question_detail(
                q_id,
                payload=QuestionUpdatePayload(marks=5.0),
            )

            # Check that cache was invalidated
            cache_val_after = await self.cache.get(expected_key)
            self.assertIsNone(cache_val_after)

            # 3. Read again -> Returns updated marks
            res2 = await q_service.get_question_detail(q_id, language=LanguageCode.ENGLISH)
            self.assertEqual(res2.marks, 5.0)

    async def test_question_service_list_caching(self):
        async with self.session_factory() as session:
            exam = Exam(
                code="upsc-prelims-2023",
                name="UPSC Prelims 2023",
                stage="PRELIMS",
                subject_code="GS1",
                source_year=2023,
                paper_set_code="SET_A",
                status=ExamStatus.PUBLISHED,
            )
            session.add(exam)
            await session.commit()

            q_service = QuestionService(session)
            created_q = await q_service.create_question(
                QuestionCreatePayload(
                    exam_id=exam.id,
                    question_number_in_paper=1,
                    question_text="Sample Question 1",
                )
            )

            # 1. List questions -> Cache Miss -> Cached
            res1 = await q_service.list_questions_paginated(exam_id=exam.id, page=1, limit=10)
            self.assertEqual(res1.total, 1)

            # 2. Second list call -> Hits Cache
            res2 = await q_service.list_questions_paginated(exam_id=exam.id, page=1, limit=10)
            self.assertEqual(res2.total, 1)
            self.assertEqual(len(res2.items), 1)

            # 3. Delete question -> Invalidates list cache
            await q_service.delete_question(int(created_q.question_id))

            # 4. List questions -> Fresh query with 0 items
            res3 = await q_service.list_questions_paginated(exam_id=exam.id, page=1, limit=10)
            self.assertEqual(res3.total, 0)
            self.assertEqual(len(res3.items), 0)
