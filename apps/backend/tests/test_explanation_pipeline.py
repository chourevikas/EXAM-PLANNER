import unittest
import uuid
import json
from unittest.mock import AsyncMock, patch
from sqlmodel import SQLModel, select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models import (
    Exam,
    Question,
    QuestionTranslation,
    QuestionOption,
    OptionTranslation,
    QuestionExplanation,
    HumanReviewTask,
    LanguageCode,
    DifficultyLevel,
)
from app.pipeline.explanation_schema import QuestionExplanationSchema, OptionAnalysis
from app.pipeline.explanation_graph import (
    node_load_exam_questions,
    node_generate_and_save_explanations,
    node_explanation_validator_and_hitl,
)
from app.repositories.explanation_repository import ExplanationRepository


class TestExplanationPipeline(unittest.IsolatedAsyncioTestCase):
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

    def test_explanation_schema_validation(self):
        opt_a = OptionAnalysis(
            option_key="A",
            is_correct=False,
            explanation="Incorrect because of sign error in formula.",
        )
        opt_b = OptionAnalysis(
            option_key="B",
            is_correct=True,
            explanation="Correct application of Boyle's Law P1V1=P2V2.",
        )
        schema = QuestionExplanationSchema(
            core_concept="Boyle's Law states that pressure is inversely proportional to volume at constant temperature.",
            detailed_solution="P1V1 = P2V2. Given P1=2 atm, V1=4L, V2=2L => P2 = (2 * 4) / 2 = 4 atm.",
            options_breakdown=[opt_a, opt_b],
            common_traps=["Dividing pressure instead of multiplying"],
            key_takeaways=["P1V1 = P2V2 at constant temperature"],
            subject="Physics",
            topic="Thermodynamics",
            subtopic="Boyle's Law",
            difficulty="Medium",
        )
        self.assertEqual(schema.subject, "Physics")
        self.assertEqual(len(schema.options_breakdown), 2)
        self.assertTrue(schema.options_breakdown[1].is_correct)

    async def test_pipeline_saves_explanations_and_option_distractor_analysis(self):
        # 1. Seed Exam, Question, and Options in DB
        async with self.session_factory() as session:
            exam = Exam(code="PHYSICS_2026_TEST", name="Physics Paper", paper_set_code="SET_A")
            session.add(exam)
            await session.commit()

            q1 = Question(
                exam_id=exam.id,
                question_number_in_paper=1,
                paper_set_code="SET_A",
                difficulty=DifficultyLevel.MEDIUM,
            )
            session.add(q1)
            await session.commit()

            q1_trans = QuestionTranslation(
                question_id=q1.id,
                language=LanguageCode.ENGLISH,
                question_text="If initial pressure is 2 atm and volume is halved at constant temp, what is final pressure?",
            )
            session.add(q1_trans)

            opt_a = QuestionOption(
                question_id=q1.id, option_label="A", display_order=1, is_correct=False
            )
            opt_b = QuestionOption(
                question_id=q1.id, option_label="B", display_order=2, is_correct=True
            )
            session.add_all([opt_a, opt_b])
            await session.commit()

            opt_a_trans = OptionTranslation(
                option_id=opt_a.id, language=LanguageCode.ENGLISH, option_text="1 atm"
            )
            opt_b_trans = OptionTranslation(
                option_id=opt_b.id, language=LanguageCode.ENGLISH, option_text="4 atm"
            )
            session.add_all([opt_a_trans, opt_b_trans])
            await session.commit()

        # 2. Mock LLM call return
        mock_schema = QuestionExplanationSchema(
            core_concept="Boyle's Law P1V1=P2V2",
            detailed_solution="P2 = (2 * 4) / 2 = 4 atm.",
            options_breakdown=[
                OptionAnalysis(
                    option_key="A",
                    is_correct=False,
                    explanation="Incorrect because pressure increases when volume decreases.",
                ),
                OptionAnalysis(
                    option_key="B",
                    is_correct=True,
                    explanation="Correct application of P1V1=P2V2.",
                ),
            ],
            common_traps=["Halving pressure instead of doubling"],
            key_takeaways=["Pressure doubles when volume is halved"],
            subject="Physics",
            topic="Thermodynamics",
            subtopic="Boyle's Law",
            difficulty="Medium",
        )

        with patch("app.pipeline.explanation_graph.ainvoke_explanation_llm", new=AsyncMock(return_value=mock_schema)):
            state = {
                "exam_id": str(exam.id),
                "question_ids": None,
                "language": "ENGLISH",
                "task_id": "test_task_123",
            }

            res = await node_generate_and_save_explanations(state)
            self.assertEqual(res["total_explanations_generated"], 1)

            # Run HITL validator
            await node_explanation_validator_and_hitl(state)

        # 3. Verify DB Persistence & Repository Extraction
        async with self.session_factory() as session:
            repo = ExplanationRepository(session)
            kb = await repo.get_full_question_knowledge_base(q1.id, LanguageCode.ENGLISH)

            self.assertIsNotNone(kb)
            self.assertEqual(kb["core_concept"], "Boyle's Law P1V1=P2V2")
            self.assertEqual(kb["subject"], "Physics")
            self.assertEqual(len(kb["options_breakdown"]), 2)

            opt_b_info = next(o for o in kb["options_breakdown"] if o["option_key"] == "B")
            self.assertTrue(opt_b_info["is_correct"])
            self.assertEqual(opt_b_info["explanation"], "Correct application of P1V1=P2V2.")

    async def test_canonical_question_fallback(self):
        async with self.session_factory() as session:
            exam = Exam(code="CHEM_2026_TEST", name="Chemistry Paper", paper_set_code="SET_A")
            session.add(exam)
            await session.commit()

            primary_q = Question(exam_id=exam.id, question_number_in_paper=10)
            session.add(primary_q)
            await session.commit()

            variant_q = Question(
                exam_id=exam.id,
                question_number_in_paper=11,
                canonical_question_id=primary_q.id,
            )
            session.add(variant_q)
            await session.commit()

            expl = QuestionExplanation(
                question_id=primary_q.id,
                language=LanguageCode.ENGLISH,
                core_concept="Ideal Gas Law PV=nRT",
                detailed_solution="P = nRT / V",
            )
            session.add(expl)
            await session.commit()

            repo = ExplanationRepository(session)
            variant_kb = await repo.get_full_question_knowledge_base(variant_q.id, LanguageCode.ENGLISH)

            self.assertIsNotNone(variant_kb)
            self.assertEqual(variant_kb["core_concept"], "Ideal Gas Law PV=nRT")
            self.assertEqual(variant_kb["canonical_question_id"], str(primary_q.id))

    async def test_multilingual_explanation_generation_and_translation(self):
        async with self.session_factory() as session:
            exam = Exam(code="BIO_2026_TEST", name="Biology Paper", paper_set_code="SET_A")
            session.add(exam)
            await session.commit()

            q1 = Question(exam_id=exam.id, question_number_in_paper=5)
            session.add(q1)
            await session.commit()

            # Add two question translations: English and Hindi
            qt_eng = QuestionTranslation(
                question_id=q1.id, language=LanguageCode.ENGLISH, question_text="What is Photosynthesis?"
            )
            qt_hin = QuestionTranslation(
                question_id=q1.id, language=LanguageCode.HINDI, question_text="प्रकाश संश्लेषण क्या है?"
            )
            session.add_all([qt_eng, qt_hin])

            opt_a = QuestionOption(question_id=q1.id, option_label="A", display_order=1, is_correct=True)
            session.add(opt_a)
            await session.commit()

            ot_eng = OptionTranslation(option_id=opt_a.id, language=LanguageCode.ENGLISH, option_text="Light energy conversion")
            ot_hin = OptionTranslation(option_id=opt_a.id, language=LanguageCode.HINDI, option_text="प्रकाश ऊर्जा रूपांतरण")
            session.add_all([ot_eng, ot_hin])
            await session.commit()

        mock_eng_schema = QuestionExplanationSchema(
            core_concept="Photosynthesis converts light into chemical energy.",
            detailed_solution="6CO2 + 6H2O + light -> C6H12O6 + 6O2",
            options_breakdown=[
                OptionAnalysis(option_key="A", is_correct=True, explanation="Correct. Light energy is converted into glucose.")
            ],
            common_traps=["Confusing respiration with photosynthesis"],
            key_takeaways=["Occurs in chloroplasts"],
            subject="Biology",
            topic="Plant Physiology",
            subtopic="Photosynthesis",
            difficulty="Easy",
        )

        mock_hin_schema = QuestionExplanationSchema(
            core_concept="प्रकाश संश्लेषण प्रकाश को रासायनिक ऊर्जा में परिवर्तित करता है।",
            detailed_solution="6CO2 + 6H2O + प्रकाश -> C6H12O6 + 6O2",
            options_breakdown=[
                OptionAnalysis(option_key="A", is_correct=True, explanation="सही। प्रकाश ऊर्जा का ग्लूकोज में परिवर्तन।")
            ],
            common_traps=["श्वसन और प्रकाश संश्लेषण में भ्रम"],
            key_takeaways=["क्लोरोप्लास्ट में होता है"],
            subject="जीव विज्ञान",
            topic="पादप शरीर क्रिया विज्ञान",
            subtopic="प्रकाश संश्लेषण",
            difficulty="Easy",
        )

        with patch("app.pipeline.explanation_graph.ainvoke_explanation_llm", new=AsyncMock(return_value=mock_eng_schema)), \
             patch("app.pipeline.explanation_graph.ainvoke_translate_explanation_llm", new=AsyncMock(return_value=mock_hin_schema)):

            state = {
                "exam_id": str(exam.id),
                "question_ids": [str(q1.id)],
                "language": "ENGLISH",
                "task_id": "test_multi_lang_task",
            }
            res = await node_generate_and_save_explanations(state)
            self.assertEqual(res["total_explanations_generated"], 1)

        # Verify DB contains QuestionExplanation for BOTH English and Hindi
        async with self.session_factory() as session:
            repo = ExplanationRepository(session)
            eng_kb = await repo.get_full_question_knowledge_base(q1.id, LanguageCode.ENGLISH)
            hin_kb = await repo.get_full_question_knowledge_base(q1.id, LanguageCode.HINDI)

            self.assertIsNotNone(eng_kb)
            self.assertIsNotNone(hin_kb)

            self.assertEqual(eng_kb["core_concept"], "Photosynthesis converts light into chemical energy.")
            self.assertEqual(hin_kb["core_concept"], "प्रकाश संश्लेषण प्रकाश को रासायनिक ऊर्जा में परिवर्तित करता है।")

            self.assertEqual(eng_kb["options_breakdown"][0]["explanation"], "Correct. Light energy is converted into glucose.")
            self.assertEqual(hin_kb["options_breakdown"][0]["explanation"], "सही। प्रकाश ऊर्जा का ग्लूकोज में परिवर्तन।")


if __name__ == "__main__":
    unittest.main()
