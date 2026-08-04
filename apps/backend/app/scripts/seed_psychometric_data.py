"""
Psychometric Data Seeding Script.
Populates 1 target user, 3 competitive exams (UPSC CSE Prelims GS1 2023, 2024, 2025),
100 realistic questions with distractor closeness scores, IRT parameters, Bloom's levels,
3 detailed ExamAttempts with item-level responses, and FSRS topic memory states.
"""

import sys
import uuid
import random
import asyncio
from datetime import datetime, timedelta
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlmodel import select
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
    Question,
    QuestionTranslation,
    QuestionOption,
    OptionTranslation,
    QuestionStatus,
    QuestionSourceType,
    DifficultyLevel,
    LanguageCode,
    ExamAttempt,
    ExamQuestionResponse,
    UserMemoryState,
)
from app.engine.psychometrics import (
    ClosenessEvaluator,
    GuessingTendencyStrategy,
    TimeTieredScoringStrategy,
    FSRSEngine,
    ExamMacroTimeStrategy,
    OptionEliminationStrategy,
    BloomsMasteryStrategy,
    IRT3PLStrategy,
    OptionSwitchRegretStrategy,
    SATOIEngine,
    TopicFSRSDecayEngine,
    IntegratedCognitiveReadinessEngine,
)


TOPICS_DATA = [
    (
        "POLITY",
        "Indian Polity & Constitution",
        [
            "Preamble & Fundamental Rights",
            "Directive Principles",
            "Parliament & Executive",
        ],
    ),
    (
        "ECON",
        "Indian Economy & Development",
        ["Fiscal Policy & Budget", "Monetary Policy & RBI", "External Sector & Trade"],
    ),
    (
        "HIST",
        "Modern Indian History",
        [
            "Freedom Struggle 1857-1947",
            "Socio-Religious Movements",
            "Governor Generals & Reforms",
        ],
    ),
    (
        "GEOG",
        "Physical & Indian Geography",
        [
            "Climatology & Monsoons",
            "River Systems & Drainage",
            "Geomorphology & Minerals",
        ],
    ),
    (
        "ENV",
        "Environment & Ecology",
        [
            "Biodiversity & Conservation",
            "Climate Change & Conventions",
            "Pollution & Environmental Acts",
        ],
    ),
]

BLOOMS_LEVELS = ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE"]


async def seed_psychometric_environment():
    print("=" * 80)
    print("🌱 [SEEDING PSYCHOMETRIC ENVIRONMENT STARTED]")
    print("=" * 80)

    await async_init_db()

    async with async_session_factory() as session:
        # 1. Create or fetch target user
        user_res = await session.exec(
            select(User).where(User.email == "student@examplatform.com")
        )
        user = user_res.first()
        if not user:
            user = User(
                id=uuid.uuid4(),
                full_name="Aarav Sharma",
                email="student@examplatform.com",
                password_hash="pbkdf2_sha256$hashed_secure_pass",
                role=UserRole.STUDENT,
                status=UserStatus.ACTIVE,
                is_verified=True,
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            print(
                f"👤 Created Target User: '{user.full_name}' ({user.email}) -> ID: {user.id}"
            )
        else:
            print(
                f"👤 Found Existing Target User: '{user.full_name}' ({user.email}) -> ID: {user.id}"
            )

        # 2. Create Syllabus & Topics Structure
        syll_res = await session.exec(select(SyllabusVersion).limit(1))
        syll = syll_res.first()
        if not syll:
            dummy_exam_for_syll = Exam(
                code="upsc_cse_master",
                name="UPSC Civil Services Master Syllabus",
                stage="prelims",
                subject_code="gs1",
                source_year=2023,
                paper_set_code="SET_A",
            )
            session.add(dummy_exam_for_syll)
            await session.commit()

            syll = SyllabusVersion(
                exam_id=dummy_exam_for_syll.id,
                version_code="UPSC_2023_V1",
                title="UPSC CSE Prelims Standard Syllabus",
            )
            session.add(syll)
            await session.commit()

        subtopic_objs = []
        for subj_code, subj_name, topics in TOPICS_DATA:
            subj_res = await session.exec(
                select(Subject).where(Subject.code == subj_code)
            )
            subj = subj_res.first()
            if not subj:
                kwargs = {
                    "syllabus_version_id": syll.id,
                    "code": subj_code,
                    "name": subj_name,
                }
                if hasattr(Subject, "is_optional_subject"):
                    kwargs["is_optional_subject"] = False
                subj = Subject(**kwargs)
                session.add(subj)
                await session.commit()

            for top_idx, top_name in enumerate(topics, 1):
                top_res = await session.exec(
                    select(Topic).where(Topic.name == top_name)
                )
                top = top_res.first()
                if not top:
                    top = Topic(
                        subject_id=subj.id,
                        code=f"{subj_code}_T{top_idx}",
                        name=top_name,
                    )
                    session.add(top)
                    await session.commit()

                sub_res = await session.exec(
                    select(Subtopic).where(Subtopic.topic_id == top.id)
                )
                sub = sub_res.first()
                if not sub:
                    sub = Subtopic(
                        topic_id=top.id,
                        code=f"{subj_code}_ST{top_idx}",
                        name=f"{top_name} Core Concepts",
                    )
                    session.add(sub)
                    await session.commit()
                subtopic_objs.append(sub)

        print(f"📚 Verified Syllabus Hierarchy with {len(subtopic_objs)} Subtopics.")

        # 3. Create 3 Test Exams
        exams_config = [
            ("upsc_cse-prelims-gs1-2023-A", "UPSC_CSE Prelims (2023) - Set A", 2023),
            ("upsc_cse-prelims-gs1-2024-A", "UPSC_CSE Prelims (2024) - Set A", 2024),
            ("upsc_cse-prelims-gs1-2025-A", "UPSC_CSE Prelims (2025) - Set A", 2025),
        ]

        exam_entities = []
        for code, title, year in exams_config:
            e_res = await session.exec(select(Exam).where(Exam.code == code))
            exam = e_res.first()
            if not exam:
                exam = Exam(
                    code=code,
                    name=title,
                    stage="prelims",
                    subject_code="gs1",
                    source_year=year,
                    paper_set_code="SET_A",
                    total_pages=32,
                )
                session.add(exam)
                await session.commit()
                await session.refresh(exam)
                print(f"📄 Created Exam: '{exam.name}' -> ID: {exam.id}")
            else:
                print(f"📄 Found Exam: '{exam.name}' -> ID: {exam.id}")
            exam_entities.append(exam)

        # 4. Generate 100 Questions spread across 3 Exams
        print(
            "\n⚙️ Generating 100 Psychometric Questions with Options & Closeness Scores..."
        )
        all_created_questions = []

        total_q_target = 100
        qs_per_exam = [34, 33, 33]

        question_counter = 1
        for exam_idx, exam in enumerate(exam_entities):
            target_count = qs_per_exam[exam_idx]

            existing_q = await session.exec(
                select(Question).where(Question.exam_id == exam.id)
            )
            q_existing_list = existing_q.all()
            if len(q_existing_list) >= target_count:
                all_created_questions.extend(q_existing_list)
                print(
                    f"   ⏩ Skipping generation for Exam '{exam.code}' (Already has {len(q_existing_list)} questions)"
                )
                continue

            for q_num in range(1, target_count + 1):
                subtopic = random.choice(subtopic_objs)
                blooms = random.choice(BLOOMS_LEVELS)
                diff = random.choice(
                    [DifficultyLevel.EASY, DifficultyLevel.MEDIUM, DifficultyLevel.HARD]
                )

                irt_a = round(random.uniform(0.9, 2.2), 2)
                irt_b = round(random.uniform(-1.2, 1.8), 2)
                irt_c = 0.25

                q = Question(
                    exam_id=exam.id,
                    subtopic_id=subtopic.id,
                    section_code="DEFAULT",
                    paper_set_code="SET_A",
                    question_number_in_paper=q_num,
                    question_type="SINGLE_CHOICE",
                    difficulty=diff,
                    marks=2.00,
                    negative_marks=0.66,
                    expected_time_seconds=60,
                    source_type=QuestionSourceType.PYQ,
                    source_year=exam.source_year,
                    status=QuestionStatus.PUBLISHED,
                    is_complete=True,
                )
                session.add(q)
                await session.commit()
                await session.refresh(q)

                q_text = f"Q{q_num} [{exam.source_year}]: Evaluate statement validity regarding {subtopic.name} under Constitutional provisions."
                q_trans = QuestionTranslation(
                    question_id=q.id,
                    language=LanguageCode.ENGLISH,
                    question_text=q_text,
                )
                session.add(q_trans)

                closeness_tuples = [
                    (
                        "A",
                        1,
                        True,
                        1.00,
                        f"Statement 1 and 2 are correct regarding {subtopic.name}.",
                    ),
                    (
                        "B",
                        2,
                        False,
                        0.65,
                        f"Statement 1 only is correct (High-closeness distractor).",
                    ),
                    (
                        "C",
                        3,
                        False,
                        0.15,
                        f"Neither statement 1 nor 2 is correct (Neutral distractor).",
                    ),
                    (
                        "D",
                        4,
                        False,
                        -0.40,
                        f"Statement 2 only is correct (Cognitive trap distractor).",
                    ),
                ]

                for label, order, is_corr, c_score, opt_txt in closeness_tuples:
                    opt = QuestionOption(
                        question_id=q.id,
                        option_label=label,
                        display_order=order,
                        is_correct=is_corr,
                        closeness_score=c_score,
                    )
                    session.add(opt)
                    await session.commit()
                    await session.refresh(opt)

                    opt_trans = OptionTranslation(
                        option_id=opt.id,
                        language=LanguageCode.ENGLISH,
                        option_text=opt_txt,
                    )
                    session.add(opt_trans)
                await session.commit()
                all_created_questions.append(q)
                question_counter += 1

            print(
                f"   ✅ Seeded {target_count} questions with options for Exam '{exam.name}'."
            )

        print(f"Total Psychometric Questions Ready: {len(all_created_questions)}")

        # 5. Create 3 Exam Attempts with realistic performance profiles
        print("\n📊 Generating 3 Exam Attempts & Item Responses for User...")

        attempt_profiles = [
            {
                "exam": exam_entities[0],
                "pacing_type": "BALANCED",
                "accuracy_rate": 0.65,
                "switches_pct": 0.10,
                "created_days_ago": 14,
            },
            {
                "exam": exam_entities[1],
                "pacing_type": "IMPULSIVE_LATE_PANIC",
                "accuracy_rate": 0.72,
                "switches_pct": 0.20,
                "created_days_ago": 7,
            },
            {
                "exam": exam_entities[2],
                "pacing_type": "METHODICAL_TOP_PERFORMER",
                "accuracy_rate": 0.88,
                "switches_pct": 0.05,
                "created_days_ago": 1,
            },
        ]

        for prof in attempt_profiles:
            exam = prof["exam"]
            existing_att = await session.exec(
                select(ExamAttempt).where(
                    ExamAttempt.user_id == user.id, ExamAttempt.exam_id == exam.id
                )
            )
            att = existing_att.first()
            if not att:
                created_dt = datetime.utcnow() - timedelta(
                    days=prof["created_days_ago"]
                )
                att = ExamAttempt(
                    user_id=user.id,
                    exam_id=exam.id,
                    max_possible_score=68.0,
                    created_at=created_dt,
                )
                session.add(att)
                await session.commit()
                await session.refresh(att)

                q_list = (
                    await session.exec(
                        select(Question).where(Question.exam_id == exam.id)
                    )
                ).all()

                item_responses_data = []
                total_time = 0.0
                total_score = 0.0
                item_gti_scores = []
                switches_list = []
                response_records = []

                for idx, q in enumerate(q_list, 1):
                    opts = (
                        await session.exec(
                            select(QuestionOption).where(
                                QuestionOption.question_id == q.id
                            )
                        )
                    ).all()
                    correct_opt = next(o for o in opts if o.is_correct)
                    distractors = [o for o in opts if not o.is_correct]

                    is_correct = random.random() < prof["accuracy_rate"]

                    if is_correct:
                        selected_opt = correct_opt
                        initial_opt = correct_opt
                        is_switched = False
                    else:
                        selected_opt = random.choice(distractors)
                        if random.random() < prof["switches_pct"]:
                            initial_opt = correct_opt
                            is_switched = True
                        else:
                            initial_opt = selected_opt
                            is_switched = False

                    exp_time = q.expected_time_seconds or 60.0
                    if (
                        prof["pacing_type"] == "IMPULSIVE_LATE_PANIC"
                        and idx > len(q_list) * 0.7
                    ):
                        time_taken = random.uniform(12.0, 22.0)
                    elif prof["pacing_type"] == "METHODICAL_TOP_PERFORMER":
                        time_taken = random.uniform(45.0, 70.0)
                    else:
                        time_taken = random.uniform(30.0, 85.0)

                    total_time += time_taken

                    score_dict = TimeTieredScoringStrategy.calculate_score(
                        is_correct=is_correct,
                        time_taken_sec=time_taken,
                        expected_time_sec=exp_time,
                        closeness_score=selected_opt.closeness_score,
                        marks_pos=q.marks,
                        marks_neg=q.negative_marks,
                    )
                    final_q_score = score_dict["closeness_weighted_score"]
                    total_score += final_q_score

                    gti_item = GuessingTendencyStrategy.compute_item_guessing(
                        time_taken_sec=time_taken,
                        expected_time_sec=exp_time,
                        option_closeness=selected_opt.closeness_score,
                        is_correct=is_correct,
                        irt_difficulty_b=0.5,
                        irt_pseudo_guessing_c=0.25,
                    )
                    item_gti_scores.append(gti_item)

                    switches_list.append(
                        {
                            "initial_correct": initial_opt.is_correct,
                            "final_correct": selected_opt.is_correct,
                        }
                    )

                    item_responses_data.append(
                        {
                            "a": 1.5,
                            "b": 0.2,
                            "c": 0.25,
                            "is_correct": is_correct,
                            "time_taken_seconds": time_taken,
                            "closeness_score_awarded": selected_opt.closeness_score,
                            "blooms_level": "ANALYZE",
                        }
                    )

                    q_resp = ExamQuestionResponse(
                        attempt_id=att.id,
                        question_id=q.id,
                        selected_option_id=selected_opt.id,
                        initial_option_id=initial_opt.id,
                        is_correct=is_correct,
                        time_taken_seconds=time_taken,
                        expected_time_seconds=exp_time,
                        closeness_score_awarded=selected_opt.closeness_score,
                        final_score=final_q_score,
                        is_switched=is_switched,
                        gti_item_score=gti_item,
                    )
                    session.add(q_resp)
                    response_records.append(
                        {
                            "is_correct": is_correct,
                            "time_taken_seconds": time_taken,
                            "closeness_score_awarded": selected_opt.closeness_score,
                        }
                    )

                await session.commit()

                pacing_eval = ExamMacroTimeStrategy.evaluate_overall_pacing(
                    total_time_spent_sec=total_time,
                    total_allocated_minutes=40.0,
                    total_questions=len(q_list),
                    responses=response_records,
                )
                gti_eval = GuessingTendencyStrategy.compute_aggregate_gti(
                    item_gti_scores
                )
                irt_eval = IRT3PLStrategy.estimate_latent_ability(item_responses_data)
                oeei_eval = OptionEliminationStrategy.evaluate_elimination(
                    response_records
                )
                satoi_eval = SATOIEngine.evaluate_satoi(response_records)

                icrs_eval = IntegratedCognitiveReadinessEngine.compute_icrs(
                    irt_theta=irt_eval["latent_ability_theta"],
                    gti_value=gti_eval,
                    oeei_score=oeei_eval["oeei_score"],
                    pacing_skew=pacing_eval["skew_ratio"],
                    satoi_score=satoi_eval["satoi_score"],
                )

                att.total_score = round(total_score, 2)
                att.time_spent_seconds = round(total_time, 1)
                att.total_questions_attempted = len(q_list)
                att.pacing_status = pacing_eval["pacing_status"]
                att.gti_score = gti_eval
                att.irt_theta = irt_eval["latent_ability_theta"]
                att.percentile_rank = irt_eval["percentile_rank"]
                att.oeei_score = oeei_eval["oeei_score"]
                att.satoi_score = satoi_eval["satoi_score"]
                att.icrs_score = icrs_eval["icrs_score"]

                session.add(att)
                await session.commit()
                print(
                    f"   🏆 Seeded Attempt for '{exam.code}': Score={att.total_score}, Theta={att.irt_theta}, GTI={att.gti_score}, ICRS={att.icrs_score}"
                )

        # 6. Seed FSRS Topic Memory States
        print("\n🧠 Generating FSRS Topic Memory States for User...")
        for sub in subtopic_objs:
            mem_res = await session.exec(
                select(UserMemoryState).where(
                    UserMemoryState.user_id == user.id,
                    UserMemoryState.subtopic_id == sub.id,
                )
            )
            mem = mem_res.first()
            if not mem:
                diff = round(random.uniform(2.5, 7.5), 2)
                stab = round(random.uniform(1.5, 14.0), 2)
                elapsed_days = random.uniform(1.0, 10.0)
                r_val = FSRSEngine.calculate_retrievability(elapsed_days, stab)

                next_review = datetime.utcnow() + timedelta(
                    days=max(1, int(stab * 1.5))
                )

                mem = UserMemoryState(
                    user_id=user.id,
                    subtopic_id=sub.id,
                    fsrs_difficulty=diff,
                    fsrs_stability=stab,
                    retrievability=round(r_val, 4),
                    last_reviewed_at=datetime.utcnow() - timedelta(days=elapsed_days),
                    next_scheduled_review=next_review,
                )
                session.add(mem)
        await session.commit()
        print("   ✅ FSRS Memory States Seeded.")

    print("=" * 80)
    print("✨ [PSYCHOMETRIC DATA SEEDING COMPLETE SUCCESS]")
    print(f"User ID: '{user.id}' | Email: '{user.email}'")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(seed_psychometric_environment())
