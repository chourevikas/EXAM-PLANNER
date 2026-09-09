"""
Dev-only seed script for exercising the Challenge + Share feature locally.

Idempotent: safe to re-run. Ensures the baseline seed_database() data exists,
then tops up:
  - a spread of ~16 additional PUBLISHED questions (with options/translations)
    across several distinct subjects/subtopics already in the syllabus tree,
    so "Create Challenge" has real variety to sample from per subject/difficulty
  - two more STUDENT users (with StudentProfile rows, FREE tier) alongside the
    existing seeded student, so invite-by-email and the leaderboard have more
    than one participant to show

Run with:  python -m app.scripts.seed_challenge_test_data
"""
import sys
import asyncio
import itertools
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from sqlmodel import select
from app.core.security import get_password_hash
from app.db.session import managed_async_session, async_init_db
from app.db.models import (
    User,
    UserRole,
    UserStatus,
    StudentProfile,
    SubscriptionTier,
    Subject,
    Subtopic,
    Question,
    QuestionStatus,
    DifficultyLevel,
    QuestionSourceType,
    QuestionTranslation,
    QuestionOption,
    OptionTranslation,
    LanguageCode,
)
from app.config.logger import setup_logger
from app.scripts.seed_database import seed_database

logger = setup_logger("ChallengeTestDataSeeder")

TEST_STUDENTS = [
    ("Priya Nair (Student)", "priya@student.com", "Student#2026!"),
    ("Rahul Verma (Student)", "rahul@student.com", "Student#2026!"),
]

DIFFICULTY_CYCLE = itertools.cycle([DifficultyLevel.EASY, DifficultyLevel.MEDIUM, DifficultyLevel.HARD])

# (question text template, 4 options with the correct one marked) — generic but
# distinct per subtopic, enough to exercise subject/difficulty filtering and a
# real multi-question challenge attempt end-to-end.
OPTION_TEMPLATES = [
    ["Only statement 1 is correct", "Only statement 2 is correct", "Both statements are correct", "Neither statement is correct"],
    ["1950", "1935", "1919", "1909"],
    ["Ministry of Home Affairs", "Ministry of External Affairs", "NITI Aayog", "Election Commission of India"],
    ["Northern Plains", "Deccan Plateau", "Western Ghats", "Indo-Gangetic Plain"],
]


async def _ensure_student_profile(session, user: User) -> None:
    existing = await session.exec(select(StudentProfile).where(StudentProfile.user_id == user.id))
    if existing.first():
        return
    session.add(StudentProfile(user_id=user.id, subscription_tier=SubscriptionTier.FREE))


async def seed_challenge_test_data():
    logger.info("Ensuring baseline platform seed data exists...")
    await async_init_db()
    await seed_database()

    async with managed_async_session() as session:
        # 1. Extra student users for multi-participant testing (invites/leaderboard)
        created_users = []
        for full_name, email, password in TEST_STUDENTS:
            existing = await session.exec(select(User).where(User.email == email))
            user = existing.first()
            if not user:
                user = User(
                    full_name=full_name,
                    email=email,
                    password_hash=get_password_hash(password),
                    role=UserRole.STUDENT,
                    status=UserStatus.ACTIVE,
                    is_verified=True,
                )
                session.add(user)
                await session.commit()
                await session.refresh(user)
                created_users.append(email)
            await _ensure_student_profile(session, user)

        # Also backfill a StudentProfile for the original seed_database.py student
        # (that script never creates one, so subscription_tier would silently
        # default to FREE via the property fallback — make it explicit).
        base_student = (await session.exec(select(User).where(User.email == "vikram@student.com"))).first()
        if base_student:
            await _ensure_student_profile(session, base_student)

        await session.commit()

        # 2. Top up published questions across a spread of existing subtopics
        existing_q_count = (await session.exec(select(Question))).all()
        if len(existing_q_count) >= 15:
            logger.info(f"Already have {len(existing_q_count)} questions seeded. Skipping question top-up.")
        else:
            # Pick one subtopic per distinct subject (via Topic -> Subject) for spread.
            from app.db.models import Topic

            rows = (
                await session.exec(
                    select(Subtopic, Topic, Subject)
                    .join(Topic, Subtopic.topic_id == Topic.id)
                    .join(Subject, Topic.subject_id == Subject.id)
                    .order_by(Subject.id, Topic.id, Subtopic.id)
                )
            ).all()

            seen_subjects = set()
            picks = []
            for subtop, top, subj in rows:
                if subj.id in seen_subjects:
                    continue
                seen_subjects.add(subj.id)
                picks.append(subtop)
                if len(picks) >= 16:
                    break

            existing_max = (
                await session.exec(select(Question.question_number_in_paper).order_by(Question.question_number_in_paper.desc()))
            ).first() or 0

            for i, subtop in enumerate(picks):
                difficulty = next(DIFFICULTY_CYCLE)
                q = Question(
                    exam_id=None,
                    subtopic_id=subtop.id,
                    section_code="GS_1",
                    question_number_in_paper=existing_max + i + 1,
                    difficulty=difficulty,
                    marks=2.00,
                    negative_marks=0.66,
                    expected_time_seconds=60,
                    source_type=QuestionSourceType.STATIC_MOCK,
                    status=QuestionStatus.PUBLISHED,
                    is_complete=True,
                )
                session.add(q)
                await session.commit()
                await session.refresh(q)

                session.add(
                    QuestionTranslation(
                        question_id=q.id,
                        language=LanguageCode.ENGLISH,
                        question_text=f"With reference to '{subtop.name}', which of the following statements is/are correct?",
                    )
                )

                labels = ["A", "B", "C", "D"]
                options_text = OPTION_TEMPLATES[i % len(OPTION_TEMPLATES)]
                correct_idx = i % 4
                for idx, (label, text) in enumerate(zip(labels, options_text)):
                    opt = QuestionOption(
                        question_id=q.id,
                        option_label=label,
                        display_order=idx + 1,
                        is_correct=(idx == correct_idx),
                        is_complete=True,
                    )
                    session.add(opt)
                    await session.commit()
                    await session.refresh(opt)
                    session.add(
                        OptionTranslation(option_id=opt.id, language=LanguageCode.ENGLISH, option_text=text)
                    )

                await session.commit()

            logger.info(f"Seeded {len(picks)} additional published questions across {len(seen_subjects)} subjects.")

        logger.info("✅ Challenge test data ready.")
        logger.info("Test accounts (all password: Student#2026!):")
        logger.info("  vikram@student.com / priya@student.com / rahul@student.com")


if __name__ == "__main__":
    asyncio.run(seed_challenge_test_data())
