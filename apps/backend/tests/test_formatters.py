import unittest
import tempfile
import yaml
from pathlib import Path
from sqlmodel import SQLModel, select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession
from app.db.models import (
    Exam, Question, QuestionTranslation, QuestionOption, OptionTranslation,
    QuestionAsset, LanguageCode, QuestionStatus, AssetType
)
from app.storage.local import LocalStorageProvider
from app.formatters.yaml_exporter import async_export_question_to_yaml_string, get_canonical_question_filename_stem
from app.formatters.markdown_exporter import async_export_question_to_markdown



class TestFormatters(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.tmp_path = Path(self.temp_dir.name)
        self.storage = LocalStorageProvider(base_dir=self.tmp_path)

        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with self.engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
            
        self.session_factory = async_sessionmaker(self.engine, class_=AsyncSession, expire_on_commit=False)

    async def asyncTearDown(self):
        await self.engine.dispose()
        self.temp_dir.cleanup()

    async def test_yaml_and_markdown_formatters_matching_filenames(self):
        async with self.session_factory() as session:
            exam = Exam(code="UPSC_CSE_2026", name="UPSC Civil Services 2026")
            session.add(exam)
            await session.commit()

            q = Question(
                exam_id=exam.id,
                section_code="GS_1",
                question_number_in_paper=1,
                source_year=2026,
                status=QuestionStatus.PENDING_HUMAN_REVIEW
            )
            session.add(q)
            await session.commit()

            qt = QuestionTranslation(
                question_id=q.id,
                language=LanguageCode.ENGLISH,
                question_text="Which of the following statements is correct regarding the Constitution?"
            )
            session.add(qt)

            opt_a = QuestionOption(question_id=q.id, option_label="A", display_order=1, is_correct=False)
            opt_b = QuestionOption(question_id=q.id, option_label="B", display_order=2, is_correct=True)
            session.add_all([opt_a, opt_b])
            await session.commit()

            opt_a_trans = OptionTranslation(option_id=opt_a.id, language=LanguageCode.ENGLISH, option_text="Option A Text")
            opt_b_trans = OptionTranslation(option_id=opt_b.id, language=LanguageCode.ENGLISH, option_text="Option B Text")
            session.add_all([opt_a_trans, opt_b_trans])

            asset = QuestionAsset(
                question_id=q.id,
                asset_path="assets/q001_diagram.png",
                asset_type=AssetType.DIAGRAM,
                caption="Map of India"
            )
            session.add(asset)
            await session.commit()

            # Verify matching filename stem
            stem = get_canonical_question_filename_stem(session, q, exam)
            self.assertEqual(stem, "upsc-cse-2026-2026-gs-1-001")
            yaml_filename = f"{stem}.yaml"
            md_filename = f"{stem}.md"
            self.assertEqual(yaml_filename.replace(".yaml", ""), md_filename.replace(".md", ""))

            # Test Async YAML Exporter
            yaml_str = await async_export_question_to_yaml_string(session, q)
            parsed_yaml = yaml.safe_load(yaml_str)
            self.assertEqual(parsed_yaml["id"], "upsc-cse-2026-2026-gs-1-001")
            self.assertEqual(parsed_yaml["correct_answer"], "B")

            # Test Async Markdown Exporter
            md_str = await async_export_question_to_markdown(session, q, storage=self.storage)
            self.assertIn("# Question 001 - `upsc-cse-2026-2026-gs-1-001`", md_str)
            self.assertIn("Which of the following statements is correct", md_str)


if __name__ == "__main__":
    unittest.main()
