import unittest
import uuid
from sqlmodel import SQLModel, select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession
from app.db.models import (
    Exam,
    Question,
    QuestionOption,
    AnswerKeyBatch,
    AnswerKeyMapping,
    SetMatchStatus,
    MappingStatus,
)
from app.pipeline.answer_key_graph import (
    node_validate_set_code_and_map_db,
    AnswerKeyPipelineState,
)


class TestAnswerKeyPipeline(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with self.engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)

        self.session_factory = async_sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )
        import app.db.session

        app.db.session.async_session_factory = self.session_factory

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def test_set_code_match_applies_correct_answer(self):
        async with self.session_factory() as session:
            exam = Exam(
                code="UPSC_2026_TEST", name="UPSC Test Paper", paper_set_code="SET_A"
            )
            session.add(exam)
            await session.commit()

            q1 = Question(
                exam_id=exam.id, question_number_in_paper=1, paper_set_code="SET_A"
            )
            session.add(q1)
            await session.commit()

            opt_a = QuestionOption(
                question_id=q1.id, option_label="A", display_order=1, is_correct=False
            )
            opt_b = QuestionOption(
                question_id=q1.id, option_label="B", display_order=2, is_correct=False
            )
            session.add_all([opt_a, opt_b])
            await session.commit()

        # Simulate extracted raw payload matching SET_A
        state: AnswerKeyPipelineState = {
            "pdf_path": "answer_keys/set_a.pdf",
            "exam_id": str(exam.id),
            "target_set_code": "SET_A",
            "total_pages": 1,
            "task_id": None,
            "raw_page_payloads": [
                {
                    "page_num": 1,
                    "detected_paper_set_code": "SET_A",
                    "is_answer_key_table": True,
                    "extracted_keys": [
                        {
                            "printed_question_number": 1,
                            "correct_option_label": "B",
                            "confidence_score": 1.0,
                        }
                    ],
                }
            ],
            "batch_id": None,
            "total_keys_extracted": 0,
            "total_keys_mapped": 0,
            "set_match_status": "PENDING",
        }

        res = await node_validate_set_code_and_map_db(state)
        self.assertEqual(res["set_match_status"], "MATCHED")
        self.assertEqual(res["total_keys_mapped"], 1)

        async with self.session_factory() as session:
            saved_opt_b = await session.get(QuestionOption, opt_b.id)
            self.assertIsNotNone(saved_opt_b)
            if saved_opt_b:
                self.assertTrue(saved_opt_b.is_correct)

    async def test_set_code_mismatch_skips_mapping(self):
        async with self.session_factory() as session:
            exam = Exam(
                code="UPSC_2026_TEST_2", name="UPSC Test Paper", paper_set_code="SET_A"
            )
            session.add(exam)
            await session.commit()

            q1 = Question(
                exam_id=exam.id, question_number_in_paper=1, paper_set_code="SET_A"
            )
            session.add(q1)
            await session.commit()

            opt_a = QuestionOption(
                question_id=q1.id, option_label="A", display_order=1, is_correct=False
            )
            session.add(opt_a)
            await session.commit()

        # Simulate extracted raw payload for SET_C when target is SET_A
        state: AnswerKeyPipelineState = {
            "pdf_path": "answer_keys/set_c.pdf",
            "exam_id": str(exam.id),
            "target_set_code": "SET_A",
            "total_pages": 1,
            "task_id": None,
            "raw_page_payloads": [
                {
                    "page_num": 1,
                    "detected_paper_set_code": "SET_C",
                    "is_answer_key_table": True,
                    "extracted_keys": [
                        {
                            "printed_question_number": 1,
                            "correct_option_label": "A",
                            "confidence_score": 1.0,
                        }
                    ],
                }
            ],
            "batch_id": None,
            "total_keys_extracted": 0,
            "total_keys_mapped": 0,
            "set_match_status": "PENDING",
        }


        res = await node_validate_set_code_and_map_db(state)
        self.assertEqual(res["set_match_status"], "MISMATCH_SKIPPED")
        self.assertEqual(res["total_keys_mapped"], 0)


if __name__ == "__main__":
    unittest.main()
