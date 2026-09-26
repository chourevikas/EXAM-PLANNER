"""Mixed question banks: uploads whose questions carry their own exam and year ("[MPSC Mains 2017]")."""
import unittest

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models import Exam, Question, QuestionStatus
from app.repositories.question_repository import QuestionRepository
from app.services.exam_service import mixed_bank_tokens
from app.services.syllabus_service import SyllabusService


class TestMixedBankTokens(unittest.TestCase):
    def test_named_after_the_file(self):
        tokens = mixed_bank_tokens("MPSC_Test4_Q1-100-2.pdf")
        self.assertEqual(tokens["exam_name"], "MPSC Test4 Q1-100-2")
        self.assertEqual(tokens["canonical_code"], "bank-mpsc-test4-q1-100-2")
        self.assertIn("mpsc", tokens["name_tokens"])
        self.assertEqual(mixed_bank_tokens(None)["canonical_code"], "bank-question-bank")


class TestMixedBankYears(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with self.engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        self.session_factory = async_sessionmaker(self.engine, class_=AsyncSession, expire_on_commit=False)
        async with self.session_factory() as s:
            # A single-year paper (questions without their own year) and a bank dated with a placeholder year
            paper = Exam(code="upsc-2023", name="UPSC", source_year=2023)
            bank = Exam(code="bank-mpsc-test4", name="MPSC Test4", source_year=2023, is_mixed_bank=True)
            s.add_all([paper, bank])
            await s.flush()
            self.paper_q = Question(exam_id=paper.id, question_number_in_paper=1, status=QuestionStatus.PUBLISHED)
            self.bank_2017 = Question(exam_id=bank.id, question_number_in_paper=1, source_year=2017, status=QuestionStatus.PUBLISHED)
            self.bank_2023 = Question(exam_id=bank.id, question_number_in_paper=2, source_year=2023, status=QuestionStatus.PUBLISHED)
            self.bank_untagged = Question(exam_id=bank.id, question_number_in_paper=3, status=QuestionStatus.PUBLISHED)
            s.add_all([self.paper_q, self.bank_2017, self.bank_2023, self.bank_untagged])
            await s.commit()
            self.bank_id = bank.id

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def years(self, year):
        async with self.session_factory() as s:
            questions, _ = await QuestionRepository(s).list_questions_filtered(exam_year=year, limit=100)
            return sorted(q.id for q in questions)

    async def test_question_year_wins_and_bank_year_is_ignored(self):
        # 2023: the paper's untagged question (paper year applies) and the bank question tagged 2023,
        # but not the bank's untagged question nor its 2017 one
        self.assertEqual(await self.years("2023"), sorted([self.paper_q.id, self.bank_2023.id]))
        self.assertEqual(await self.years("2017"), [self.bank_2017.id])
        self.assertEqual(await self.years("2017,2023"), sorted([self.paper_q.id, self.bank_2017.id, self.bank_2023.id]))

    async def test_banks_are_grouped_apart_with_their_question_years(self):
        async with self.session_factory() as s:
            res = await SyllabusService(s).get_exams_by_year()
        self.assertEqual(res.years, [2023])  # the bank's placeholder year adds nothing
        self.assertEqual([e.code for e in res.exams_by_year["2023"]], ["upsc-2023"])
        bank, = res.exams_by_year["MIXED"]
        self.assertTrue(bank.is_mixed_bank)
        self.assertEqual(bank.question_years, [2023, 2017])


if __name__ == "__main__":
    unittest.main()
