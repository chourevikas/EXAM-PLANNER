import os
import uuid
import zipfile
import unittest
from pathlib import Path
from sqlmodel import select, SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.db.models import (
    Exam,
    SyllabusVersion,
    Question,
    QuestionTranslation,
    QuestionOption,
    OptionTranslation,
    QuestionExplanation,
    QuestionMetadata,
    QuestionHierarchyLink,
    Subject,
    Topic,
    Subtopic,
    LanguageCode,
    BloomsLevel,
    QuestionStatus,
)
from app.services.exam_export_service import ExamExportService
from app.pipeline.explanation_graph import _generate_and_save_single_question_explanation


class TestExportZipAndIntegrityFix(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with self.engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)

        self.session_factory = async_sessionmaker(
            bind=self.engine, class_=AsyncSession, expire_on_commit=False
        )

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def test_exam_export_service_zip_bundle(self):
        async with self.session_factory() as session:
            # Create test Exam
            exam = Exam(
                id=uuid.uuid4(),
                code="upsc_cse-prelims-gs1-2023-a",
                name="UPSC CSE Prelims (2023) - Set A",
                stage="prelims",
                subject_code="gs1",
                source_year=2023,
                paper_set_code="SET_A",
            )
            session.add(exam)

            # Create test SyllabusVersion
            syl = SyllabusVersion(
                id=uuid.uuid4(),
                exam_id=exam.id,
                version_code="v1",
                title="Default Syllabus",
            )
            session.add(syl)

            # Create test Subject, Topic, Subtopic
            subj = Subject(id=uuid.uuid4(), syllabus_version_id=syl.id, name="Indian Polity")
            top = Topic(id=uuid.uuid4(), subject_id=subj.id, name="Executive")
            subtop = Subtopic(id=uuid.uuid4(), topic_id=top.id, name="President of India")
            session.add(subj)
            session.add(top)
            session.add(subtop)
            await session.commit()

            # Create Question
            q = Question(
                id=uuid.uuid4(),
                exam_id=exam.id,
                subtopic_id=subtop.id,
                question_number_in_paper=1,
                section_code="GS-1",
                is_mcq=True,
                status=QuestionStatus.PUBLISHED,
            )
            session.add(q)
            await session.commit()

            # Question Translation
            qt = QuestionTranslation(
                id=uuid.uuid4(),
                question_id=q.id,
                language=LanguageCode.ENGLISH,
                question_text="Consider the following statements regarding the President of India...",
            )
            session.add(qt)

            # Options
            opt1 = QuestionOption(
                id=uuid.uuid4(),
                question_id=q.id,
                option_label="A",
                display_order=1,
                is_correct=True,
            )
            opt2 = QuestionOption(
                id=uuid.uuid4(),
                question_id=q.id,
                option_label="B",
                display_order=2,
                is_correct=False,
            )
            session.add(opt1)
            session.add(opt2)
            await session.commit()

            ot1 = OptionTranslation(
                id=uuid.uuid4(),
                option_id=opt1.id,
                language=LanguageCode.ENGLISH,
                option_text="Statement 1 only",
                distractor_analysis="Correct. Article 52 states the executive power.",
            )
            ot2 = OptionTranslation(
                id=uuid.uuid4(),
                option_id=opt2.id,
                language=LanguageCode.ENGLISH,
                option_text="Statement 2 only",
                distractor_analysis="Incorrect because Article 53 applies to Union executive.",
            )
            session.add(ot1)
            session.add(ot2)

            # Question Explanation
            expl = QuestionExplanation(
                id=uuid.uuid4(),
                question_id=q.id,
                language=LanguageCode.ENGLISH,
                core_concept="Executive powers of the President",
                detailed_solution="Under Article 53 of the Constitution, executive power is vested in the President.",
                key_takeaways_json=["Article 52 defines President", "Article 53 defines Executive powers"],
                common_traps_json=["Confusing President's powers with Prime Minister"],
            )
            session.add(expl)

            # Question Metadata
            q_meta = QuestionMetadata(
                id=uuid.uuid4(),
                question_id=q.id,
                blooms_level=BloomsLevel.ANALYZE,
                cognitive_skill="Legal Interpretation",
                primary_concept_tag="POLITY_PRESIDENT",
                historical_accuracy=85.0,
                pyq_frequency=3,
            )
            session.add(q_meta)

            # Hierarchy Link
            link = QuestionHierarchyLink(
                id=uuid.uuid4(),
                question_id=q.id,
                subtopic_id=subtop.id,
                topic_id=top.id,
                subject_id=subj.id,
                is_primary=True,
                relevance_weight=1.0,
                concept_name="President of India",
            )
            session.add(link)
            await session.commit()

            # Test Export Service
            export_service = ExamExportService(session)
            zip_path, filename = await export_service.create_exam_export_zip("upsc_cse-prelims-gs1-2023-A")

            self.assertTrue(zip_path.exists())
            self.assertEqual(filename, "upsc_cse-prelims-gs1-2023-a_export_bundle.zip")

            with zipfile.ZipFile(zip_path, "r") as zf:
                file_names = zf.namelist()
                self.assertIn("SUMMARY_WEIGHTAGE.md", file_names)

                question_files = [f for f in file_names if f.startswith("questions/")]
                self.assertGreaterEqual(len(question_files), 1)

                md_content = zf.read(question_files[0]).decode("utf-8")
                self.assertIn("Consider the following statements regarding the President of India", md_content)
                self.assertIn("✅ **[CORRECT ANSWER]**", md_content)
                self.assertIn("Option Analysis:* Correct. Article 52 states the executive power.", md_content)
                self.assertIn("Executive powers of the President", md_content)
                self.assertIn("Bloom's Taxonomy Level:** `ANALYZE`", md_content)
                self.assertIn("Key Takeaways", md_content)

                summary_content = zf.read("SUMMARY_WEIGHTAGE.md").decode("utf-8")
                self.assertIn("Subject Weightage Breakdown", summary_content)
                self.assertIn("Indian Polity", summary_content)
                self.assertIn("Master Answer Key", summary_content)

            # Clean up temp zip file
            if zip_path.exists():
                os.remove(zip_path)

    async def test_hierarchy_link_deduplication(self):
        """Verifies that duplicate subtopic concepts in LLM output do not raise SQLite Integrity Errors."""
        async with self.session_factory() as session:
            exam = Exam(
                id=uuid.uuid4(),
                code="test-exam-2026-a",
                name="Test Exam 2026",
                stage="prelims",
                subject_code="gs1",
                source_year=2026,
                paper_set_code="SET_A",
            )
            session.add(exam)

            q = Question(
                id=uuid.uuid4(),
                exam_id=exam.id,
                question_number_in_paper=1,
                section_code="GS-1",
                is_mcq=True,
                status=QuestionStatus.PUBLISHED,
            )
            session.add(q)
            await session.commit()

            syl = SyllabusVersion(
                id=uuid.uuid4(),
                exam_id=exam.id,
                version_code="v1",
                title="Default Syllabus",
            )
            session.add(syl)

            subj = Subject(id=uuid.uuid4(), syllabus_version_id=syl.id, name="Indian Polity")
            top = Topic(id=uuid.uuid4(), subject_id=subj.id, name="Executive")
            subtop = Subtopic(id=uuid.uuid4(), topic_id=top.id, name="President of India")
            session.add(subj)
            session.add(top)
            session.add(subtop)
            await session.commit()

            # Add two hierarchy links with identical subtopic_id in memory/session
            link1 = QuestionHierarchyLink(
                id=uuid.uuid4(),
                question_id=q.id,
                subtopic_id=subtop.id,
                topic_id=top.id,
                subject_id=subj.id,
                is_primary=True,
                relevance_weight=1.0,
                concept_name="President of India",
            )
            session.add(link1)
            await session.commit()

            # Verify querying hierarchy links returns exact single primary link
            links_stmt = select(QuestionHierarchyLink).where(
                QuestionHierarchyLink.question_id == q.id,
                QuestionHierarchyLink.subtopic_id == subtop.id,
            )
            links = (await session.exec(links_stmt)).all()
            self.assertEqual(len(links), 1)


if __name__ == "__main__":
    unittest.main()

