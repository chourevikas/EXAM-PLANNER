import unittest
from unittest.mock import MagicMock
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.languages import (
    normalize_language,
    get_all_supported_languages,
    get_22_indian_languages,
)
from app.services.google_translation_service import (
    TextProtectionHandler,
)
from app.db.models import (
    Exam,
    Question,
    QuestionOption,
    Passage,
    QuestionTranslation,
    OptionTranslation,
    PassageTranslation,
    LanguageCode,
    User,
    UserRole,
)
from app.services.translation_service import QuestionTranslationService
from app.services.exam_json_builder import ExamJsonBuilder
from httpx import AsyncClient, ASGITransport
from app.fastapi_server import app
from app.db.session import get_async_session


class TestLanguageCoreAndProtection(unittest.TestCase):
    def test_all_22_indian_languages_present(self):
        self.assertEqual(len(get_22_indian_languages()), 22)
        supported = get_all_supported_languages()
        # 22 Indian languages + English = 23
        self.assertEqual(len(supported), 23)

    def test_normalize_language(self):
        # Test English
        self.assertEqual(normalize_language("en"), ("en", "ENGLISH"))
        self.assertEqual(normalize_language("ENGLISH"), ("en", "ENGLISH"))
        self.assertEqual(normalize_language("english"), ("en", "ENGLISH"))

        # Test Hindi
        self.assertEqual(normalize_language("hi"), ("hi", "HINDI"))
        self.assertEqual(normalize_language("HINDI"), ("hi", "HINDI"))
        self.assertEqual(normalize_language("hindi"), ("hi", "HINDI"))

        # Test Tamil
        self.assertEqual(normalize_language("ta"), ("ta", "TAMIL"))
        self.assertEqual(normalize_language("TAMIL"), ("ta", "TAMIL"))

        # Test Telugu
        self.assertEqual(normalize_language("te"), ("te", "TELUGU"))

        # Test Bengali
        self.assertEqual(normalize_language("bn"), ("bn", "BENGALI"))

        # Test Marathi
        self.assertEqual(normalize_language("mr"), ("mr", "MARATHI"))

        # Test Gujarati
        self.assertEqual(normalize_language("gu"), ("gu", "GUJARATI"))

        # Test Malayalam
        self.assertEqual(normalize_language("ml"), ("ml", "MALAYALAM"))

        # Test Kannada
        self.assertEqual(normalize_language("kn"), ("kn", "KANNADA"))

        # Test Odia
        self.assertEqual(normalize_language("or"), ("or", "ODIA"))

        # Test Punjabi
        self.assertEqual(normalize_language("pa"), ("pa", "PUNJABI"))

        # Test Sanskrit
        self.assertEqual(normalize_language("sa"), ("sa", "SANSKRIT"))

        # Test Santali
        self.assertEqual(normalize_language("sat"), ("sat", "SANTALI"))

        # Test Maithili
        self.assertEqual(normalize_language("ma"), ("mai", "MAITHILI"))
        self.assertEqual(normalize_language("mai"), ("mai", "MAITHILI"))
        self.assertEqual(normalize_language("maithili"), ("mai", "MAITHILI"))

        # Test Unknown fallback
        self.assertEqual(normalize_language("unknown_lang"), ("en", "ENGLISH"))
        self.assertEqual(normalize_language(""), ("en", "ENGLISH"))
        self.assertEqual(normalize_language(None), ("en", "ENGLISH"))

    def test_text_protection_handler_markdown_image(self):
        handler = TextProtectionHandler()
        text = "Consider the following diagram: ![Monsoon Cycle](https://storage.googleapis.com/exam-bucket/monsoon.png) Which wind pattern is depicted?"
        masked, placeholders = handler.protect_blocks(text)
        self.assertIn("___EXAM_BLOCK_", masked)
        self.assertNotIn("![Monsoon Cycle]", masked)

        # Restore
        restored = handler.restore_blocks(masked, placeholders)
        self.assertEqual(restored, text)

    def test_text_protection_handler_html_image(self):
        handler = TextProtectionHandler()
        text = 'Look at the map below: <img src="https://example.com/map.svg" alt="Plate Tectonics" width="300" /> What boundary is shown?'
        masked, placeholders = handler.protect_blocks(text)
        self.assertIn("___EXAM_BLOCK_", masked)
        self.assertNotIn("<img", masked)

        restored = handler.restore_blocks(masked, placeholders)
        self.assertEqual(restored, text)

    def test_text_protection_handler_latex_math(self):
        handler = TextProtectionHandler()
        text = "Calculate the acceleration when $$F = m \\cdot a$$ where $m = 5\\text{ kg}$ and $F = 20\\text{ N}$."
        masked, placeholders = handler.protect_blocks(text)
        self.assertNotIn("$$F = m \\cdot a$$", masked)
        self.assertNotIn("$m = 5\\text{ kg}$", masked)

        restored = handler.restore_blocks(masked, placeholders)
        self.assertEqual(restored, text)

    def test_text_protection_handler_markdown_table(self):
        handler = TextProtectionHandler()
        text = (
            "Match the following pairs:\n\n"
            "| River | Origin |\n"
            "|---|---|\n"
            "| Ganga | Gangotri |\n"
            "| Yamuna | Yamunotri |\n\n"
            "Which of the pairs given above is/are correctly matched?"
        )
        masked, placeholders = handler.protect_blocks(text)
        self.assertIn("___EXAM_BLOCK_", masked)
        self.assertNotIn("| River | Origin |", masked)

        restored = handler.restore_blocks(masked, placeholders)
        self.assertEqual(restored, text)


class TestTranslationServiceAsync(unittest.IsolatedAsyncioTestCase):
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

    async def test_user_preferred_language_default_and_custom(self):
        async with self.session_factory() as session:
            user_default = User(
                full_name="Default User",
                email="default@test.com",
                password_hash="hashed_pwd",
                role=UserRole.STUDENT,
            )
            user_hindi = User(
                full_name="Hindi User",
                email="hindi@test.com",
                password_hash="hashed_pwd",
                role=UserRole.STUDENT,
                preferred_language="hi",
            )
            session.add(user_default)
            session.add(user_hindi)
            await session.commit()
            await session.refresh(user_default)
            await session.refresh(user_hindi)

            self.assertEqual(user_default.preferred_language, "en")
            self.assertEqual(user_hindi.preferred_language, "hi")

    async def test_question_translation_service_translate_exam(self):
        async with self.session_factory() as session:
            # 1. Setup Exam, Passage, Question, Options with English base translations
            exam = Exam(
                code="test-upsc-prelims-2023",
                name="UPSC Prelims 2023 Test",
                source_year=2023,
                stage="prelims",
            )
            session.add(exam)
            await session.commit()
            await session.refresh(exam)

            passage = Passage(
                exam_id=exam.id,
                section_code="DEFAULT",
            )
            session.add(passage)
            await session.commit()
            await session.refresh(passage)

            pass_en = PassageTranslation(
                passage_id=passage.id,
                language=LanguageCode.ENGLISH,
                passage_text="Climate change is one of the greatest global challenges of our time.",
            )
            session.add(pass_en)

            question = Question(
                exam_id=exam.id,
                question_number_in_paper=1,
                passage_id=passage.id,
            )
            session.add(question)
            await session.commit()
            await session.refresh(question)

            passage.question_ids_json = [question.id]
            session.add(passage)

            q_en = QuestionTranslation(
                question_id=question.id,
                language=LanguageCode.ENGLISH,
                question_text="What is the primary driver of anthropogenic climate change?",
            )
            session.add(q_en)

            opt1 = QuestionOption(
                question_id=question.id,
                option_label="A",
                display_order=1,
                is_correct=True,
            )
            opt2 = QuestionOption(
                question_id=question.id,
                option_label="B",
                display_order=2,
                is_correct=False,
            )
            session.add(opt1)
            session.add(opt2)
            await session.commit()
            await session.refresh(opt1)
            await session.refresh(opt2)

            o1_en = OptionTranslation(
                option_id=opt1.id,
                language=LanguageCode.ENGLISH,
                option_text="Greenhouse gas emissions from fossil fuels",
            )
            o2_en = OptionTranslation(
                option_id=opt2.id,
                language=LanguageCode.ENGLISH,
                option_text="Solar flares",
            )
            session.add(o1_en)
            session.add(o2_en)
            await session.commit()

            # 2. Create mock translation client returning translated text
            mock_gt_service = MagicMock()

            async def mock_batch_translate(texts, target_language, source_language="en"):
                return [f"[{target_language}] {t}" for t in texts]

            mock_gt_service.translate_batch = mock_batch_translate
            mock_gt_service.batch_translate_texts = mock_batch_translate

            service = QuestionTranslationService(session, translation_service=mock_gt_service)

            # Test targeting just Hindi and Tamil for fast verification
            target_langs = [
                LanguageCode.HINDI,
                LanguageCode.TAMIL,
            ]
            result = await service.translate_exam(exam.id, target_languages=target_langs)
            self.assertTrue(result["success"])
            self.assertEqual(result["translations_added"], 8)  # (1 question + 2 options + 1 passage) * 2 langs

            # 3. Verify translations in DB
            q_trans = (
                await session.exec(
                    select(QuestionTranslation).where(
                        QuestionTranslation.question_id == question.id
                    )
                )
            ).all()
            # 1 English original + 2 Indian language translations = 3
            self.assertEqual(len(q_trans), 3)
            trans_langs = {t.language for t in q_trans}
            self.assertIn(LanguageCode.HINDI, trans_langs)
            self.assertIn(LanguageCode.TAMIL, trans_langs)
            self.assertIn(LanguageCode.ENGLISH, trans_langs)

            opt_trans = (
                await session.exec(
                    select(OptionTranslation).where(
                        OptionTranslation.option_id == opt1.id
                    )
                )
            ).all()
            self.assertEqual(len(opt_trans), 3)

            pas_trans = (
                await session.exec(
                    select(PassageTranslation).where(
                        PassageTranslation.passage_id == passage.id
                    )
                )
            ).all()
            self.assertEqual(len(pas_trans), 3)

            # 4. Test Idempotency: Running translation again should skip already translated items
            idempotent_res = await service.translate_exam(exam.id, target_languages=target_langs)
            self.assertTrue(idempotent_res["success"])
            self.assertEqual(idempotent_res["translations_added"], 0)

    async def test_exam_json_builder_serving_with_target_language(self):
        async with self.session_factory() as session:
            exam = Exam(
                code="test-lang-serving-exam",
                name="Test Serving Exam",
                source_year=2024,
                stage="prelims",
            )
            session.add(exam)
            await session.commit()
            await session.refresh(exam)

            passage = Passage(
                exam_id=exam.id,
                section_code="DEFAULT",
            )
            session.add(passage)
            await session.commit()
            await session.refresh(passage)

            # Add English and Hindi Passage Translations
            p_en = PassageTranslation(
                passage_id=passage.id,
                language=LanguageCode.ENGLISH,
                passage_text="English passage text about astronomy.",
            )
            p_hi = PassageTranslation(
                passage_id=passage.id,
                language=LanguageCode.HINDI,
                passage_text="खगोल विज्ञान के बारे में गद्यांश।",
            )
            session.add(p_en)
            session.add(p_hi)

            question = Question(
                exam_id=exam.id,
                question_number_in_paper=1,
                passage_id=passage.id,
            )
            session.add(question)
            await session.commit()
            await session.refresh(question)

            passage.question_ids_json = [question.id]
            session.add(passage)

            # Add English and Hindi Question Translations
            q_en = QuestionTranslation(
                question_id=question.id,
                language=LanguageCode.ENGLISH,
                question_text="Which planet is closest to the Sun?",
            )
            q_hi = QuestionTranslation(
                question_id=question.id,
                language=LanguageCode.HINDI,
                question_text="सूर्य के सबसे निकट कौन सा ग्रह है?",
            )
            session.add(q_en)
            session.add(q_hi)

            opt1 = QuestionOption(
                question_id=question.id,
                option_label="A",
                display_order=1,
                is_correct=True,
            )
            opt2 = QuestionOption(
                question_id=question.id,
                option_label="B",
                display_order=2,
                is_correct=False,
            )
            session.add(opt1)
            session.add(opt2)
            await session.commit()
            await session.refresh(opt1)
            await session.refresh(opt2)

            o1_en = OptionTranslation(
                option_id=opt1.id,
                language=LanguageCode.ENGLISH,
                option_text="Mercury",
            )
            o1_hi = OptionTranslation(
                option_id=opt1.id,
                language=LanguageCode.HINDI,
                option_text="बुध",
            )
            o2_en = OptionTranslation(
                option_id=opt2.id,
                language=LanguageCode.ENGLISH,
                option_text="Venus",
            )
            o2_hi = OptionTranslation(
                option_id=opt2.id,
                language=LanguageCode.HINDI,
                option_text="शुक्र",
            )
            session.add(o1_en)
            session.add(o1_hi)
            session.add(o2_en)
            session.add(o2_hi)
            await session.commit()

            # Test serving with target_language="HINDI"
            builder = ExamJsonBuilder(session)
            q_card, sol_card = await builder.build_single_question_cards(
                q=question,
                target_language="HINDI",
            )

            # Check that the primary text is translated into Hindi
            self.assertEqual(q_card["text"], "सूर्य के सबसे निकट कौन सा ग्रह है?")
            self.assertEqual(q_card["passage_text"], "खगोल विज्ञान के बारे में गद्यांश।")
            self.assertEqual(q_card["options"][0]["text"], "बुध")
            self.assertEqual(q_card["options"][1]["text"], "शुक्र")

            # Check that all translations are also present for instant client toggle
            self.assertIn("HINDI", q_card["translations"])
            self.assertEqual(q_card["translations"]["HINDI"]["question_text"], "सूर्य के सबसे निकट कौन सा ग्रह है?")
            self.assertIn("HINDI", q_card["passage_translations"])
            self.assertEqual(q_card["options"][0]["translations"]["HINDI"], "बुध")

            # Test fallback to English when requested language is not translated
            q_card_ta, _ = await builder.build_single_question_cards(
                q=question,
                target_language="TAMIL",
            )
            self.assertEqual(q_card_ta["text"], "Which planet is closest to the Sun?")
            self.assertEqual(q_card_ta["passage_text"], "English passage text about astronomy.")
            self.assertEqual(q_card_ta["options"][0]["text"], "Mercury")

    async def test_auth_languages_endpoint(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get("/api/v1/auth/languages")
            self.assertEqual(res.status_code, 200)
            data = res.json()
            # 22 Indian languages + English = 23
            self.assertEqual(len(data), 23)
            hi = next((l for l in data if l["code"] == "hi"), None)
            self.assertIsNotNone(hi)
            self.assertEqual(hi["enum_name"], "HINDI")
            self.assertEqual(hi["name"], "Hindi")
            self.assertEqual(hi["native_name"], "हिन्दी")


if __name__ == "__main__":
    unittest.main()
