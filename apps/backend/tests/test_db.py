import unittest
import uuid
from sqlmodel import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import SQLModel
from app.db.models import (
    Exam,
    SyllabusVersion,
    Subject,
    Topic,
    Subtopic,
    Question,
    Passage,
    PassageTranslation,
    QuestionTranslation,
    QuestionOption,
    OptionTranslation,
    QuestionAsset,
    HumanReviewTask,
    QuestionStatus,
    LanguageCode,
    MemoryType,
)


class TestDatabase(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with self.engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)

        self.session_factory = async_sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def test_academic_hierarchy_relationships_async(self):
        async with self.session_factory() as session:
            exam = Exam(code="UPSC_2026", name="UPSC Civil Services 2026")
            session.add(exam)
            await session.commit()
            await session.refresh(exam)

            subtopic = Subtopic(name="Fundamental Rights", topic_id=uuid.uuid4())
            session.add(subtopic)
            await session.commit()
            await session.refresh(subtopic)

            passage = Passage(
                exam_id=exam.id,
                subtopic_id=subtopic.id,
                memory_type=MemoryType.PASSAGE,
                page_numbers_json="[1, 2]",
                question_ids_json='["' + str(uuid.uuid4()) + '"]',
            )
            session.add(passage)
            await session.commit()
            await session.refresh(passage)

            p_trans = PassageTranslation(
                passage_id=passage.id,
                language=LanguageCode.ENGLISH,
                passage_text="Read the following passage carefully...",
            )
            session.add(p_trans)

            question = Question(
                exam_id=exam.id,
                subtopic_id=subtopic.id,
                passage_id=passage.id,
                question_number_in_paper=1,
                status=QuestionStatus.PENDING_HUMAN_REVIEW,
            )
            session.add(question)
            await session.commit()
            await session.refresh(question)

            review_task = HumanReviewTask(
                question_id=question.id, exam_id=exam.id, review_status="PENDING_REVIEW"
            )
            session.add(review_task)
            await session.commit()

            q_res = await session.exec(
                select(Question).where(Question.id == question.id)
            )
            saved_q = q_res.first()
            self.assertIsNotNone(saved_q)
            self.assertEqual(saved_q.status, QuestionStatus.PENDING_HUMAN_REVIEW)
            self.assertEqual(saved_q.question_number_in_paper, 1)

            p_res = await session.exec(select(Passage).where(Passage.id == passage.id))
            saved_p = p_res.first()
            self.assertIsNotNone(saved_p)


if __name__ == "__main__":
    unittest.main()
