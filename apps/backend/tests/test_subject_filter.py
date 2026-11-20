"""Question-list subject filter (practice sessions, recommendations): exact subject names only."""
import unittest

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models import (
    Exam, Question, QuestionHierarchyLink, QuestionStatus, Subject, Subtopic, SyllabusVersion, Topic,
)
from app.repositories.question_repository import QuestionRepository


class TestExactSubjectFilter(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with self.engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        self.session_factory = async_sessionmaker(self.engine, class_=AsyncSession, expire_on_commit=False)
        self.ids = {}
        async with self.session_factory() as s:
            exam = Exam(code="upsc-2023", name="UPSC", source_year=2023)
            s.add(exam)
            await s.flush()
            version = SyllabusVersion(exam_id=exam.id, version_code="v1")
            s.add(version)
            await s.flush()
            subtopic_ids = {}
            for n, subject_name in enumerate(
                ["History", "Modern History", "History & Culture", "History / CA",
                 "Indian Polity & Governance", "Science & Tech", "Science & Technology",
                 "International Relations"],
                start=1,
            ):
                subject = Subject(version_id=version.id, name=subject_name)
                s.add(subject)
                await s.flush()
                topic = Topic(subject_id=subject.id, name=f"{subject_name} topic")
                s.add(topic)
                await s.flush()
                subtopic = Subtopic(topic_id=topic.id, name=f"{subject_name} subtopic")
                s.add(subtopic)
                await s.flush()
                q = Question(exam_id=exam.id, question_number_in_paper=n, subtopic_id=subtopic.id,
                             status=QuestionStatus.PUBLISHED)
                s.add(q)
                await s.flush()
                self.ids[subject_name] = q.id
                subtopic_ids[subject_name] = subtopic.id
                s.add(QuestionHierarchyLink(question_id=q.id, subtopic_id=subtopic.id, is_primary=True))

            # The old AI pipeline also linked some questions to extra concepts in other subjects:
            # the International Relations question carries a secondary link to History
            s.add(QuestionHierarchyLink(
                question_id=self.ids["International Relations"], subtopic_id=subtopic_ids["History"],
                is_primary=False, concept_name="Arab Peace Initiative",
            ))
            # A question known only by its PDF subject tag (no syllabus subtopic yet)
            tagged = Question(exam_id=exam.id, question_number_in_paper=99, subject_raw="Modern History",
                              status=QuestionStatus.PUBLISHED)
            s.add(tagged)
            await s.flush()
            self.ids["Modern History (PDF tag only)"] = tagged.id

            # An admin moved this question from the PDF's "History" to an Art & Culture subtopic
            art = Subject(version_id=version.id, name="Art & Culture")
            s.add(art)
            await s.flush()
            art_topic = Topic(subject_id=art.id, name="Architecture")
            s.add(art_topic)
            await s.flush()
            art_subtopic = Subtopic(topic_id=art_topic.id, name="Temples")
            s.add(art_subtopic)
            await s.flush()
            corrected = Question(exam_id=exam.id, question_number_in_paper=100, subject_raw="History",
                                 subtopic_id=art_subtopic.id, status=QuestionStatus.PUBLISHED)
            s.add(corrected)
            await s.flush()
            self.ids["Art & Culture (corrected from History)"] = corrected.id
            await s.commit()

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def subjects(self, subject_name):
        async with self.session_factory() as s:
            questions, total = await QuestionRepository(s).list_questions_filtered(subject_name=subject_name, limit=100)
        by_id = {v: k for k, v in self.ids.items()}
        return sorted(by_id[q.id] for q in questions)

    async def test_history_does_not_include_other_history_subjects(self):
        self.assertEqual(await self.subjects("History"), ["History"])
        self.assertEqual(await self.subjects("Modern History"), ["Modern History", "Modern History (PDF tag only)"])

    async def test_corrected_syllabus_subject_wins_over_pdf_tag(self):
        self.assertEqual(await self.subjects("Art & Culture"), ["Art & Culture (corrected from History)"])
        self.assertNotIn("Art & Culture (corrected from History)", await self.subjects("History"))

    async def test_only_the_main_subject_counts(self):
        # The International Relations question's secondary History link does not put it in History
        self.assertNotIn("International Relations", await self.subjects("History"))
        self.assertEqual(await self.subjects("International Relations"), ["International Relations"])

    async def test_case_spacing_and_ampersand_are_ignored(self):
        self.assertEqual(await self.subjects("indian polity and governance"), ["Indian Polity & Governance"])
        self.assertEqual(await self.subjects("  HISTORY   &  culture "), ["History & Culture"])
        self.assertEqual(await self.subjects("History/CA"), ["History / CA"])

    async def test_spelling_variants_are_different_subjects(self):
        self.assertEqual(await self.subjects("Science & Tech"), ["Science & Tech"])

    async def test_multi_select_still_works(self):
        self.assertEqual(
            await self.subjects("History;;Modern History"),
            ["History", "Modern History", "Modern History (PDF tag only)"],
        )

    async def test_partial_names_no_longer_match(self):
        self.assertEqual(await self.subjects("Hist"), [])
