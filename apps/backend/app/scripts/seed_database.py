import sys
import uuid
import asyncio
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Add project root (apps/backend) to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from sqlmodel import select
from app.core.security import get_password_hash
from app.db.session import async_session_factory, async_init_db
from app.db.models import (
    User,
    UserRole,
    UserStatus,
    Exam,
    SyllabusVersion,
    Subject,
    Topic,
    Subtopic,
    Passage,
    PassageTranslation,
    MemoryType,
    LanguageCode,
    Question,
    QuestionStatus,
    DifficultyLevel,
    QuestionSourceType,
    QuestionTranslation,
    QuestionOption,
    OptionTranslation,
    QuestionAsset,
    AssetType,
    QuestionMetadata,
    BloomsLevel,
    PlatformFeature,
    SubscriptionPlan,
    PlanFeatureLink,
    UserSubscription,
    BillingInterval,
    SubscriptionStatus,
    HumanReviewTask,
    UserConceptRetention,
)
from app.config.logger import setup_logger


logger = setup_logger("DatabaseSeeder")


async def seed_database():
    logger.info("Initializing database schemas before seeding...")
    await async_init_db()

    async with async_session_factory() as session:
        # Check if already seeded
        existing_user = await session.exec(select(User).limit(1))
        if existing_user.first():
            logger.info(
                "Database already contains seed data. Skipping duplicate seeding."
            )
            return

        logger.info(
            "Seeding realistic platform data into PostgreSQL / SQLite database..."
        )

        # 1. Seed Users (Super Admin, Admin, Student)
        admin_user = User(
            full_name="Dr. Ananya Sharma (Super Admin)",
            email="admin@exammentorship.com",
            password_hash=get_password_hash("SuperAdmin#2026!"),
            role=UserRole.SUPER_ADMIN,
            status=UserStatus.ACTIVE,
            is_verified=True,
        )
        student_user = User(
            full_name="Vikramaditya Singh (Student)",
            email="vikram@student.com",
            password_hash=get_password_hash("Student#2026!"),
            role=UserRole.STUDENT,
            status=UserStatus.ACTIVE,
            is_verified=True,
        )
        session.add_all([admin_user, student_user])
        await session.commit()
        await session.refresh(admin_user)
        await session.refresh(student_user)

        # 2. Seed Platform Features & Subscription Plans
        f_mock = PlatformFeature(
            feature_code="AI_MOCK_GENERATOR",
            name="AI Adaptive Mock Test Generator",
            description="Generates personalized mock tests tailored to target IRT difficulty.",
        )
        f_hitl = PlatformFeature(
            feature_code="ADMIN_QA_PORTAL",
            name="HITL Admin QA & Passage Review Portal",
            description="Allows verified admin review, passage context correction, and LLM re-extraction.",
        )
        f_analytics = PlatformFeature(
            feature_code="FSRS_RETENTION_ANALYTICS",
            name="FSRS-6 Spaced Repetition Analytics",
            description="Tracks concept memory decay and optimal review intervals.",
        )
        session.add_all([f_mock, f_hitl, f_analytics])
        await session.commit()
        await session.refresh(f_mock)
        await session.refresh(f_hitl)

        plan_free = SubscriptionPlan(
            plan_code="FREE_STUDENT",
            name="Student Starter Plan",
            description="Free access to basic PYQs and FSRS flashcards.",
            price_cents=0,
            currency="INR",
            billing_interval=BillingInterval.LIFETIME,
            display_order=1,
        )
        plan_pro = SubscriptionPlan(
            plan_code="PRO_MENTORSHIP",
            name="Pro Exam Mentorship Pass",
            description="Unlimited AI adaptive mock tests, passage breakdown, and FSRS-6 analytics.",
            price_cents=149900,  # ₹1499.00
            currency="INR",
            billing_interval=BillingInterval.MONTHLY,
            display_order=2,
        )
        session.add_all([plan_free, plan_pro])
        await session.commit()
        await session.refresh(plan_pro)

        # Feature Links
        session.add_all(
            [
                PlanFeatureLink(
                    plan_id=plan_free.id, feature_id=f_analytics.id, usage_limit=10
                ),
                PlanFeatureLink(
                    plan_id=plan_pro.id, feature_id=f_mock.id, usage_limit=None
                ),
                PlanFeatureLink(
                    plan_id=plan_pro.id, feature_id=f_analytics.id, usage_limit=None
                ),
            ]
        )

        # User Subscription
        user_sub = UserSubscription(
            user_id=student_user.id,
            plan_id=plan_pro.id,
            status=SubscriptionStatus.ACTIVE,
            current_period_start=datetime.now(timezone.utc),
            current_period_end=datetime.now(timezone.utc) + timedelta(days=30),
            payment_gateway="RAZORPAY",
            gateway_subscription_id="sub_test_887123",
        )
        session.add(user_sub)

        # 3. Seed Academic Hierarchy (Exam -> Syllabus -> Subject -> Topic -> Subtopic)
        exam = Exam(
            code="UPSC_CSE_2026",
            name="UPSC Civil Services Examination 2026",
            description="General Studies Paper 1 Preliminary Examination",
            pdf_path="exams/UPSC_CSE_2026/source_gs_paper1.pdf",
            total_pages=28,
        )
        session.add(exam)
        await session.commit()
        await session.refresh(exam)

        syllabus = SyllabusVersion(
            exam_id=exam.id,
            version_code="2026.1",
            title="UPSC 2026 GS Prelims Canonical Syllabus",
            effective_year=2026,
        )
        session.add(syllabus)
        await session.commit()
        await session.refresh(syllabus)

        subject = Subject(
            syllabus_version_id=syllabus.id,
            code="POLITY",
            name="Indian Polity & Governance",
        )
        session.add(subject)
        await session.commit()
        await session.refresh(subject)

        topic = Topic(
            subject_id=subject.id, code="CONSTITUTION", name="Constitutional Framework"
        )
        session.add(topic)
        await session.commit()
        await session.refresh(topic)

        subtopic = Subtopic(
            topic_id=topic.id,
            code="FUNDAMENTAL_RIGHTS",
            name="Fundamental Rights & Constitutional Remedies (Articles 12-35)",
        )
        session.add(subtopic)
        await session.commit()
        await session.refresh(subtopic)

        # 4. Seed Reading Passage
        passage = Passage(
            exam_id=exam.id,
            subtopic_id=subtopic.id,
            section_code="GS_1",
            memory_type=MemoryType.PASSAGE,
            is_complete=True,
            page_numbers_json=[4, 5],
        )
        session.add(passage)
        await session.commit()
        await session.refresh(passage)

        passage_trans = PassageTranslation(
            passage_id=passage.id,
            language=LanguageCode.ENGLISH,
            passage_text="Read the following excerpt regarding Constitutional Remedies: Constitutional remedies under Article 32 guarantee citizens the right to move the Supreme Court for enforcement of fundamental rights. The Supreme Court acts as the defender and guarantor of fundamental rights.",
        )
        session.add(passage_trans)

        # 5. Seed Questions, Translations, Options, Assets, and Psychometrics
        q1 = Question(
            exam_id=exam.id,
            subtopic_id=subtopic.id,
            passage_id=passage.id,
            section_code="GS_1",
            question_number_in_paper=1,
            difficulty=DifficultyLevel.HARD,
            marks=2.00,
            negative_marks=0.66,
            expected_time_seconds=75,
            source_type=QuestionSourceType.PYQ,
            source_year=2026,
            status=QuestionStatus.PUBLISHED,
            is_complete=True,
            has_image=True,
            page_numbers_json=[4],
            passage_page_numbers_json=[4],
        )
        session.add(q1)
        await session.commit()
        await session.refresh(q1)

        # Link passage question_ids
        passage.question_ids_json = [str(q1.id)]
        session.add(passage)

        q1_trans_en = QuestionTranslation(
            question_id=q1.id,
            language=LanguageCode.ENGLISH,
            question_text="With reference to Article 32 of the Constitution of India, consider the following statements:\n1. The Right to move the Supreme Court cannot be suspended under any circumstances.\n2. Both the Supreme Court and High Courts have concurrent jurisdiction to issue writs for the enforcement of Fundamental Rights.\nWhich of the statements given above is/are correct?",
        )
        q1_trans_hi = QuestionTranslation(
            question_id=q1.id,
            language=LanguageCode.HINDI,
            question_text="भारत के संविधान के अनुच्छेद 32 के संदर्भ में, निम्नलिखित कथनों पर विचार कीजिए:\n1. सर्वोच्च न्यायालय में जाने के अधिकार को किसी भी परिस्थिति में निलंबित नहीं किया जा सकता है।\n2. सर्वोच्च न्यायालय और उच्च न्यायालय दोनों के पास मौलिक अधिकारों के प्रवर्तन के लिए रिट जारी करने का समवर्ती क्षेत्राधिकार है।\nउपर्युक्त कथनों में से कौन-सा/से सही है/हैं?",
        )
        session.add_all([q1_trans_en, q1_trans_hi])

        # Options
        opt_a = QuestionOption(
            question_id=q1.id,
            option_label="A",
            display_order=1,
            is_correct=False,
            is_complete=True,
        )
        opt_b = QuestionOption(
            question_id=q1.id,
            option_label="B",
            display_order=2,
            is_correct=True,
            is_complete=True,
        )
        opt_c = QuestionOption(
            question_id=q1.id,
            option_label="C",
            display_order=3,
            is_correct=False,
            is_complete=True,
        )
        opt_d = QuestionOption(
            question_id=q1.id,
            option_label="D",
            display_order=4,
            is_correct=False,
            is_complete=True,
        )
        session.add_all([opt_a, opt_b, opt_c, opt_d])
        await session.commit()

        # Option Translations
        session.add_all(
            [
                OptionTranslation(
                    option_id=opt_a.id,
                    language=LanguageCode.ENGLISH,
                    option_text="1 only",
                ),
                OptionTranslation(
                    option_id=opt_b.id,
                    language=LanguageCode.ENGLISH,
                    option_text="2 only",
                ),
                OptionTranslation(
                    option_id=opt_c.id,
                    language=LanguageCode.ENGLISH,
                    option_text="Both 1 and 2",
                ),
                OptionTranslation(
                    option_id=opt_d.id,
                    language=LanguageCode.ENGLISH,
                    option_text="Neither 1 nor 2",
                ),
                OptionTranslation(
                    option_id=opt_b.id, language=LanguageCode.HINDI, option_text="केवल 2"
                ),
            ]
        )

        # Question Asset (Diagram/Map)
        asset = QuestionAsset(
            question_id=q1.id,
            asset_path=f"exams/UPSC_CSE_2026/assets/q001_article32_writs.png",
            asset_type=AssetType.DIAGRAM,
            caption="Writ Jurisdiction Comparison (Article 32 vs Article 226)",
            bounding_box_json=[120, 45, 380, 560],
        )
        session.add(asset)

        # Psychometric IRT Metadata
        meta = QuestionMetadata(
            question_id=q1.id,
            blooms_level=BloomsLevel.ANALYZE,
            cognitive_skill="Legal Analysis & Constitutional Interpretation",
            primary_concept_tag="Writs & Fundamental Rights",
            irt_discrimination=1.45,
            irt_difficulty=0.82,
            irt_guessing=0.25,
            fsrs_initial_stability=2.5,
            fsrs_initial_difficulty=6.2,
        )
        session.add(meta)

        # Human Review Task (Verified)
        review_task = HumanReviewTask(
            question_id=q1.id,
            exam_id=exam.id,
            assigned_admin_id=admin_user.id,
            review_status="VERIFIED",
            is_flagged_by_validator=False,
            failure_reasons_json=[],
            reviewer_notes="Verified against official UPSC answer key. Options and translations confirmed.",
            reviewed_at=datetime.now(timezone.utc),
        )
        session.add(review_task)

        # User Retention Telemetry (FSRS-6)
        retention = UserConceptRetention(
            user_id=student_user.id,
            subtopic_id=subtopic.id,
            fsrs_difficulty=5.8,
            fsrs_stability=4.2,
            fsrs_retrievability=0.89,
            total_reviews=3,
            lapses=0,
            last_reviewed_at=datetime.now(timezone.utc),
            next_scheduled_review=datetime.now(timezone.utc) + timedelta(days=4),
        )
        session.add(retention)

        await session.commit()
        logger.info(
            "✅ Database successfully seeded with rich, realistic production data!"
        )


if __name__ == "__main__":
    asyncio.run(seed_database())
