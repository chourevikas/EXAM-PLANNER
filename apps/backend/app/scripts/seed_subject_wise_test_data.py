"""
Dev-only seed script for exercising Subject-wise PYQ simulations locally.

Adds three clearly labelled test papers (UPSC CSE 2021, UPSC CSE 2022, BPSC 2023)
and, for each, PUBLISHED questions spread across every subject in the syllabus
tree (up to 4 subtopics per subject, round-robin over its topics). This gives the
subject / topic / subtopic / exam / year filters real variety to select from.

Each question has English text, four options with one correct answer, an
English explanation and a primary hierarchy link.

Idempotent: a paper that already exists is skipped, so re-running adds nothing.

Run with:  python -m app.scripts.seed_subject_wise_test_data
"""
import sys
import asyncio
import itertools
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from sqlmodel import select
from app.db.session import managed_async_session
from app.db.models import (
    Exam,
    ExamStatus,
    Subject,
    Topic,
    Subtopic,
    Question,
    QuestionStatus,
    DifficultyLevel,
    QuestionSourceType,
    QuestionTranslation,
    QuestionOption,
    OptionTranslation,
    QuestionExplanation,
    QuestionHierarchyLink,
    LanguageCode,
)
from app.db.models.exam_type import ExamType
from app.config.logger import setup_logger

logger = setup_logger("SubjectWiseTestDataSeeder")

# (code, name, year, exam type code)
SEED_EXAMS = [
    ("seed-upsc_cse-prelims-gs1-2021-A", "UPSC CSE Prelims 2021 (Test Seed)", 2021, "upsc"),
    ("seed-upsc_cse-prelims-gs1-2022-A", "UPSC CSE Prelims 2022 (Test Seed)", 2022, "upsc"),
    ("seed-bpsc-prelims-gs1-2023-A", "BPSC Prelims 2023 (Test Seed)", 2023, "bpsc"),
]
SUBTOPICS_PER_SUBJECT = 4
QUESTIONS_PER_SUBTOPIC_PER_EXAM = 2

QUESTION_TEMPLATES = [
    (
        "With reference to '{subtopic}' ({topic}), consider the following statements:\n"
        "1. It is covered under the {subject} section of the syllabus.\n"
        "2. It has appeared in previous year papers of {exam}.\n"
        "Which of the statements given above is/are correct?",
        ["1 only", "2 only", "Both 1 and 2", "Neither 1 nor 2"],
    ),
    (
        "Which one of the following best describes the significance of '{subtopic}' within {topic}?",
        [
            "It is a foundational concept examined almost every year",
            "It is relevant only for the Mains examination",
            "It was removed from the syllabus after {year}",
            "It is examined only in state-level papers",
        ],
    ),
    (
        "Consider the following pairs related to {subject}:\n"
        "1. {subtopic} : {topic}\n"
        "2. {topic} : {subject}\n"
        "How many of the above pairs are correctly matched?",
        ["Only one pair", "Both pairs", "None of the pairs", "Cannot be determined"],
    ),
]
DIFFICULTY_CYCLE = [DifficultyLevel.EASY, DifficultyLevel.MEDIUM, DifficultyLevel.HARD]


async def _pick_subtopics(session) -> list[tuple[Subject, Topic, Subtopic]]:
    """Up to SUBTOPICS_PER_SUBJECT subtopics per subject, taking one topic at a time for spread."""
    rows = (
        await session.exec(
            select(Subject, Topic, Subtopic)
            .join(Topic, Topic.subject_id == Subject.id)
            .join(Subtopic, Subtopic.topic_id == Topic.id)
            .order_by(Subject.id, Topic.display_order, Topic.id, Subtopic.display_order, Subtopic.id)
        )
    ).all()

    by_subject: dict[int, dict[int, list]] = {}
    for subj, top, sub in rows:
        by_subject.setdefault(subj.id, {}).setdefault(top.id, []).append((subj, top, sub))

    picks = []
    for topics in by_subject.values():
        chosen = []
        for group in itertools.zip_longest(*topics.values()):
            chosen.extend(item for item in group if item)
            if len(chosen) >= SUBTOPICS_PER_SUBJECT:
                break
        picks.extend(chosen[:SUBTOPICS_PER_SUBJECT])
    return picks


async def _add_question(session, exam: Exam, number: int, subj: Subject, top: Topic, sub: Subtopic, variant: int) -> None:
    template, options = QUESTION_TEMPLATES[variant % len(QUESTION_TEMPLATES)]
    fields = {"subtopic": sub.name, "topic": top.name, "subject": subj.name, "exam": exam.name, "year": exam.source_year}
    correct_idx = (number + variant) % 4

    q = Question(
        exam_id=exam.id,
        subtopic_id=sub.id,
        section_code="GS_1",
        question_number_in_paper=number,
        difficulty=DIFFICULTY_CYCLE[(number + variant) % 3],
        marks=2.00,
        negative_marks=0.66,
        expected_time_seconds=72,
        source_type=QuestionSourceType.PYQ,
        source_year=exam.source_year,
        status=QuestionStatus.PUBLISHED,
        is_complete=True,
    )
    session.add(q)
    await session.flush()

    session.add(QuestionTranslation(question_id=q.id, language=LanguageCode.ENGLISH, question_text=template.format(**fields)))
    session.add(QuestionHierarchyLink(question_id=q.id, subtopic_id=sub.id, topic_id=top.id, subject_id=subj.id, is_primary=True))

    for idx, text in enumerate(options):
        opt = QuestionOption(
            question_id=q.id,
            option_label="ABCD"[idx],
            display_order=idx + 1,
            is_correct=(idx == correct_idx),
            is_complete=True,
        )
        session.add(opt)
        await session.flush()
        session.add(OptionTranslation(option_id=opt.id, language=LanguageCode.ENGLISH, option_text=text.format(**fields)))

    session.add(
        QuestionExplanation(
            question_id=q.id,
            language=LanguageCode.ENGLISH,
            core_concept=f"{sub.name} — {top.name} ({subj.name})",
            detailed_solution=(
                f"Test seed question. The correct answer is option {'ABCD'[correct_idx]}. "
                f"Revise '{sub.name}' under {top.name} before attempting similar questions."
            ),
            common_traps_json=["Confusing closely related subtopics within the same topic"],
            key_takeaways_json=[f"Know the scope of '{sub.name}' within {subj.name}"],
        )
    )


async def seed_subject_wise_test_data() -> None:
    async with managed_async_session() as session:
        picks = await _pick_subtopics(session)
        if not picks:
            logger.error("No subjects/topics/subtopics found. Run seed_database / sync_syllabus_hierarchy first.")
            return

        total_added = 0
        for code, name, year, type_code in SEED_EXAMS:
            if (await session.exec(select(Exam).where(Exam.code == code))).first():
                logger.info(f"'{name}' already seeded. Skipping.")
                continue

            exam_type = (await session.exec(select(ExamType).where(ExamType.type == type_code))).first()
            exam = Exam(
                code=code,
                name=name,
                exam_type_id=exam_type.id if exam_type else None,
                exam_type=QuestionSourceType.PYQ,
                status=ExamStatus.PUBLISHED,
                source_year=year,
                total_questions=len(picks) * QUESTIONS_PER_SUBTOPIC_PER_EXAM,
                total_duration_minutes=120,
                is_active=True,
            )
            session.add(exam)
            await session.flush()

            number = 0
            for subj, top, sub in picks:
                for variant in range(QUESTIONS_PER_SUBTOPIC_PER_EXAM):
                    number += 1
                    await _add_question(session, exam, number, subj, top, sub, variant + year)
            exam.extracted_questions_count = number
            await session.commit()
            total_added += number
            logger.info(f"Seeded '{name}' with {number} questions.")

        subjects = len({s.id for s, _, _ in picks})
        logger.info(f"✅ Subject-wise test data ready: {total_added} new questions across {subjects} subjects.")


if __name__ == "__main__":
    asyncio.run(seed_subject_wise_test_data())
