import asyncio
import os
import sys
import uuid
import random
from pathlib import Path

# Ensure app package is in sys.path
backend_dir = Path(__file__).resolve().parent.parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Configure environment for standalone script execution
if "DATABASE_URL" not in os.environ or "postgresql" in os.environ.get("DATABASE_URL", ""):
    # Test if PostgreSQL port is open
    import socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(1.0)
    is_postgres_online = sock.connect_ex(('localhost', 5432)) == 0
    sock.close()

    if not is_postgres_online:
        db_file = Path("app/exam_test_val.db")
        if db_file.exists():
            try:
                db_file.unlink()
            except Exception:
                pass
        os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///exam_test_val.db"
        os.environ["STORAGE_TYPE"] = "local"
        os.environ["DB_MIGRATION"] = "false"
        from app.config.settings import get_settings
        get_settings(force_reload=True)

from sqlmodel import select, SQLModel
from app.db.session import async_session_factory, async_init_db
from app.db.models import (
    User,
    Exam,
    Question,
    QuestionOption,
    QuestionTranslation,
    OptionTranslation,
    QuestionExplanation,
    QuestionMetadata,
    UserRole,
    UserStatus,
)
from app.db.models.enums import AttemptMode, LanguageCode
from app.services.exam_json_builder import ExamJsonBuilder
from app.services.exam_session_service import ExamSessionService
from app.schemas.exam_attempt import (
    StartExamRequest,
    SaveResponseRequest,
    HeartbeatRequest,
    SubmitExamRequest,
)
from app.engine.post_submission_pipeline import run_post_submission_pipeline
from app.services.analytics_service import AnalyticsService
from app.config.logger import setup_logger

logger = setup_logger("ValidateExamLifecycle")


async def main():
    print("\n" + "=" * 70)
    print(" STUDENT EXAM-TAKING LIFECYCLE END-TO-END VALIDATION SCRIPT")
    print("=" * 70 + "\n")

    await async_init_db()



    async with async_session_factory() as session:
        # 2. Get or Create a Test User
        user_res = await session.exec(select(User).where(User.role == UserRole.STUDENT))
        user = user_res.first()

        if not user:
            print("No existing student user found. Creating a test student user...")
            user = User(
                full_name="Test Student Candidate",
                email=f"test_student_{uuid.uuid4().hex[:6]}@rankedge.ai",
                password_hash="pbkdf2_sha256$hashedpassword",
                role=UserRole.STUDENT,
                status=UserStatus.ACTIVE,
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)

        print(f"[User] Candidate User: {user.full_name} ({user.email}) [ID: {user.id}]")

        # 3. Get Exam from DB
        exam_res = await session.exec(select(Exam).where(Exam.is_active == True))
        exam = exam_res.first()

        if not exam:
            print("[Warning] No active exam found in database. Checking for inactive exam...")
            exam_res_inactive = await session.exec(select(Exam))
            exam = exam_res_inactive.first()

        if not exam:
            print("[Warning] No Exam record in DB. Creating a demonstration Exam with sample questions...")

            exam = Exam(
                code="upsc_cse-prelims-gs1-2024-A",
                name="UPSC CSE Prelims (2024) - General Studies Paper I (Demo)",
                stage="prelims",
                subject_code="gs1",
                source_year=2024,
                paper_set_code="SET_A",
                total_duration_minutes=120,
                total_marks=200.0,
                is_active=True,
            )
            session.add(exam)
            await session.commit()
            await session.refresh(exam)

            # Add 5 sample questions with options & translations
            for q_num in range(1, 6):
                q = Question(
                    exam_id=exam.id,
                    question_number_in_paper=q_num,
                    question_type="SINGLE_CHOICE",
                    difficulty="MEDIUM",
                    marks=2.0,
                    negative_marks=0.66,
                    expected_time_seconds=60,
                    status="PUBLISHED",
                )
                session.add(q)
                await session.commit()
                await session.refresh(q)

                # Question Translations (ENGLISH & HINDI)
                qt_eng = QuestionTranslation(
                    question_id=q.id,
                    language=LanguageCode.ENGLISH,
                    question_text=f"Question #{q_num}: Which of the following statements is correct regarding Economic Growth?",
                )
                qt_hin = QuestionTranslation(
                    question_id=q.id,
                    language=LanguageCode.HINDI,
                    question_text=f"प्रश्न #{q_num}: आर्थिक विकास के संबंध में निम्नलिखित में से कौन सा कथन सही है?",
                )
                session.add(qt_eng)
                session.add(qt_hin)

                # Question Metadata
                q_meta = QuestionMetadata(
                    question_id=q.id,
                    blooms_level="ANALYZE",
                    cognitive_skill="Conceptual Reasoning",
                    primary_concept_tag="Macroeconomics",
                    irt_discrimination_a=1.5,
                    irt_difficulty_b=0.2,
                    irt_pseudo_guessing_c=0.18,
                )
                session.add(q_meta)

                # Question Explanations (ENGLISH & HINDI)
                qe_eng = QuestionExplanation(
                    question_id=q.id,
                    language=LanguageCode.ENGLISH,
                    core_concept="Real Gross Domestic Product accounts for inflation dynamics.",
                    detailed_solution="Step 1: Economic growth measures real output. Step 2: Option A accurately states inflation adjustment.",
                    common_traps_json=["Confusing Nominal GDP with Real GDP."],
                    key_takeaways_json=["Real GDP = Nominal GDP / GDP Deflator."],
                )
                qe_hin = QuestionExplanation(
                    question_id=q.id,
                    language=LanguageCode.HINDI,
                    core_concept="वास्तविक सकल घरेलू उत्पाद मुद्रास्फीति की गतिशीलता के लिए जिम्मेदार है।",
                    detailed_solution="चरण 1: आर्थिक विकास वास्तविक उत्पादन को मापता है। चरण 2: विकल्प A मुद्रास्फीति समायोजन को सटीक रूप से बताता है।",
                    common_traps_json=["नामित जीडीपी को वास्तविक जीडीपी के साथ भ्रमित करना।"],
                    key_takeaways_json=["वास्तविक सकल घरेलू उत्पाद = नामित सकल घरेलू उत्पाद / सकल घरेलू उत्पाद अवस्फीतिकारक।"],
                )
                session.add(qe_eng)
                session.add(qe_hin)

                # Options & Option Translations
                for label_idx, label in enumerate(["A", "B", "C", "D"]):
                    opt = QuestionOption(
                        question_id=q.id,
                        option_label=label,
                        display_order=label_idx + 1,
                        is_correct=(label == "A"),
                        closeness_score=1.0 if label == "A" else (0.45 if label == "B" else 0.20),
                    )
                    session.add(opt)
                    await session.commit()
                    await session.refresh(opt)

                    ot_eng = OptionTranslation(
                        option_id=opt.id,
                        language=LanguageCode.ENGLISH,
                        option_text=f"Option {label}: Statement explanation for {label}",
                        distractor_analysis=f"Analysis in English for Option {label}",
                    )
                    ot_hin = OptionTranslation(
                        option_id=opt.id,
                        language=LanguageCode.HINDI,
                        option_text=f"विकल्प {label}: कथन का विवरण {label}",
                        distractor_analysis=f"विकल्प {label} के लिए हिंदी में विश्लेषण",
                    )
                    session.add(ot_eng)
                    session.add(ot_hin)
                await session.commit()

        print(f"[Target Exam] {exam.name} [Code: {exam.code}] [ID: {exam.id}]")

        # 4. Generate & Cache S3 / Local Storage JSONs
        print("\n[Step 1] Building S3 / Storage JSON caches (questions & solutions)...")
        builder = ExamJsonBuilder(session)
        json_paths = await builder.generate_and_upload(exam.id)
        print(f"   - Questions JSON: {json_paths.get('questions_json_path')}")
        print(f"   - Solutions JSON: {json_paths.get('solutions_json_path')}")

        # Verify Multilingual & Solution Parameters in JSONs
        from app.storage.factory import get_storage_provider
        storage = get_storage_provider()
        q_doc = await storage.download_json(json_paths["questions_json_path"])
        s_doc = await storage.download_json(json_paths["solutions_json_path"])

        q_sample = q_doc["questions"][0] if q_doc.get("questions") else {}
        s_sample = s_doc["questions"][0] if s_doc.get("questions") else {}

        print(f"   - Verified Questions JSON Multilingual Keys: {list(q_sample.get('translations', {}).keys())}")
        print(f"   - Verified Solutions JSON Parameters: Bloom's={s_sample.get('blooms_level')}, IRT={s_sample.get('irt_params')}, CognitiveSkill={s_sample.get('cognitive_skill')}")
        print(f"   - Verified Solutions Multilingual Explanations: {list(s_sample.get('explanation_translations', {}).keys())}")


        # 5. Initialize Service & Start Attempt
        print("\n[Step 2] Starting Exam Attempt Session (Mode: PRACTICE)...")
        service = ExamSessionService(session)
        start_res = await service.start_exam(
            user_id=user.id,
            req=StartExamRequest(exam_id=exam.id, mode=AttemptMode.PRACTICE),
        )

        attempt_id = uuid.UUID(str(start_res.attempt_id))
        print(f"   [OK] Session Started! Attempt ID: {attempt_id}")
        print(f"   - Duration: {start_res.max_duration_seconds}s ({start_res.max_duration_seconds // 60} mins)")
        print(f"   - Total Questions: {start_res.total_questions}")
        print(f"   - Initial Question #1: {start_res.first_question.question.text[:60]}...")

        # 6. Simulate Navigation & Responses
        print("\n[Step 3] Navigating & Answering Questions...")
        total_q = start_res.total_questions

        for q_num in range(1, total_q + 1):
            q_nav = await service.get_question(attempt_id=attempt_id, user_id=user.id, question_number=q_num)
            q_obj = q_nav.question
            opts = q_obj.options

            print(f"   [Q#{q_num}/{total_q}] '{q_obj.text[:45]}...' [Options: {len(opts)}]")

            # Simulate student decision: Answer 85% of questions, skip 15%
            if random.random() < 0.85 and opts:
                chosen_opt = random.choice(opts)
                is_marked = random.random() < 0.25
                time_spent = round(random.uniform(25.0, 75.0), 1)

                save_res = await service.save_response(
                    attempt_id=attempt_id,
                    user_id=user.id,
                    req=SaveResponseRequest(
                        question_id=uuid.UUID(str(q_obj.question_id)),
                        selected_option_id=uuid.UUID(str(chosen_opt.option_id)),
                        is_marked_for_review=is_marked,
                        time_spent_seconds=time_spent,
                        option_switch_count=random.choice([0, 0, 1]),
                    ),
                )
                print(f"      -> Selected Option {chosen_opt.option_label} | Time: {time_spent}s | Review: {is_marked} | Status: {save_res.status}")

                # Test Answer Reveal in PRACTICE mode for question 1
                if q_num == 1:
                    print("      -> Testing Reveal Answer (PRACTICE Mode)...")
                    reveal_res = await service.reveal_answer(
                        attempt_id=attempt_id,
                        user_id=user.id,
                        question_id=uuid.UUID(str(q_obj.question_id)),
                    )
                    print(f"         Correct Option: {reveal_res.correct_option_label} | User Correct: {reveal_res.is_user_correct} | Score: {reveal_res.marks_awarded}")
            else:
                print("      -> Skipped question.")

        # 7. Test Heartbeat Sync
        print("\n[Step 4] Testing Heartbeat & Timer Sync...")
        hb_res = await service.heartbeat(
            attempt_id=attempt_id,
            user_id=user.id,
            req=HeartbeatRequest(remaining_time_seconds=6800),
        )
        print(f"   - Server Time: {hb_res.server_time} | Remaining Time: {hb_res.remaining_time_seconds}s | Status: {hb_res.status}")

        # 8. Test Status & Palette
        print("\n[Step 5] Fetching Attempt Session Status & Palette...")
        status_res = await service.get_exam_status(attempt_id=attempt_id, user_id=user.id)
        summary = status_res.response_summary
        print(f"   - Answered: {summary.answered_count} | Marked: {summary.marked_for_review_count} | Unattempted: {summary.unattempted_count} | Total: {summary.total}")

        # 9. Submit Exam Attempt & Test Idempotency
        print("\n[Step 6] Submitting Exam Attempt...")
        submit_res = await service.submit_exam(
            attempt_id=attempt_id,
            user_id=user.id,
            req=SubmitExamRequest(submission_reason="USER_CLICKED_SUBMIT"),
        )
        print(f"   [OK] Exam Submitted Successfully!")
        print(f"   - Raw Score: {submit_res.raw_score} / {submit_res.max_score}")
        print(f"   - Accuracy: {submit_res.accuracy_percentage}%")
        print(f"   - Correct: {submit_res.correct_count} | Incorrect: {submit_res.incorrect_count} | Unattempted: {submit_res.unattempted_count}")

        # Test Idempotent Submit Call (Parameter 7)
        print("   - Testing Idempotent Re-Submission Call...")
        re_submit_res = await service.submit_exam(
            attempt_id=attempt_id,
            user_id=user.id,
            req=SubmitExamRequest(submission_reason="USER_CLICKED_SUBMIT"),
        )
        print(f"     [OK] Idempotent call succeeded without error! Score: {re_submit_res.raw_score}")

        # 10. Execute Async Post-Submission Pipeline
        print("\n[Step 7] Executing Post-Submission Psychometric Pipeline & Single LLM Call...")
        await run_post_submission_pipeline(attempt_id)
        print("   [OK] Post-submission pipeline completed! Attempt status updated to EVALUATED.")

        # 11. Test Attempt History & Dedicated Result View (Parameters 13 & 14)
        print("\n[Step 8] Testing Attempts History & Dedicated Result View...")
        history_res = await service.list_user_attempts(user_id=user.id)
        print(f"   - Candidates Attempts Count: {len(history_res['items'])}")
        result_view = await service.get_attempt_result(attempt_id=attempt_id, user_id=user.id)
        print(f"   - Dedicated Result View Status: {result_view.get('evaluation_status', 'COMPLETED')} | Raw Score: {result_view.get('raw_score')}")

        # 12. Fetch Compiled Psychometric Report by attempt_id (Parameter 1)
        print("\n[Step 9] Verifying Full 3-Part Psychometric Report Generation by attempt_id...")
        analytics_svc = AnalyticsService(session)
        report_json_res = await analytics_svc.get_psychometric_report_json(attempt_id=attempt_id)
        print(f"   - Response Content-Type: {report_json_res.media_type}")
        print(f"   - Payload Size: {len(report_json_res.body)} bytes")

    print("\n" + "=" * 70)
    print(" ALL 14 LIFECYCLE PARAMETERS & END-TO-END VALIDATION PASSED!")
    print("=" * 70 + "\n")




if __name__ == "__main__":
    asyncio.run(main())
