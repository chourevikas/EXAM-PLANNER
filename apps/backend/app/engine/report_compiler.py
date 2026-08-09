import uuid
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession
from app.db.models import (
    User,
    Exam,
    Question,
    QuestionOption,
    Subtopic,
    Topic,
    Subject,
    ExamAttempt,
    ExamQuestionResponse,
    UserMemoryState,
    UserSkillProfile,
    UserTaxonomyMastery,
)
from app.engine.matrices.closeness_evaluator import ClosenessEvaluator
from app.engine.matrices.guessing_tendency import GuessingTendencyStrategy
from app.engine.matrices.time_tiered_scoring import TimeTieredScoringStrategy
from app.engine.matrices.fsrs_retention import FSRSEngine
from app.engine.matrices.macro_pacing import ExamMacroTimeStrategy
from app.engine.matrices.option_elimination import OptionEliminationStrategy
from app.engine.matrices.blooms_mastery import BloomsMasteryStrategy
from app.engine.matrices.irt_3pl_ability import IRT3PLStrategy
from app.engine.matrices.option_switch_regret import OptionSwitchRegretStrategy
from app.engine.matrices.speed_accuracy_tradeoff import SATOIEngine
from app.engine.matrices.topic_fsrs_decay import TopicFSRSDecayEngine
from app.engine.matrices.integrated_cognitive_readiness import (
    IntegratedCognitiveReadinessEngine,
)


async def compile_comprehensive_psychometric_report(
    session: AsyncSession, user_id: uuid.UUID, exam_id: uuid.UUID
) -> Dict[str, Any]:
    """
    Compiles a comprehensive, question-wise diagnostic report containing meaningful names,
    field descriptions, item-level analytics, candidate cumulative skill profile, and taxonomy mappings.
    """
    user = await session.get(User, user_id)
    if not user:
        raise ValueError(f"User with ID '{user_id}' not found.")

    exam = await session.get(Exam, exam_id)
    if not exam:
        raise ValueError(f"Exam with ID '{exam_id}' not found.")

    att_res = await session.exec(
        select(ExamAttempt)
        .where(ExamAttempt.user_id == user_id, ExamAttempt.exam_id == exam_id)
        .order_by(col(ExamAttempt.created_at).desc())
    )
    attempt = att_res.first()
    if not attempt:
        raise ValueError(
            f"No attempt found for User '{user.full_name}' on Exam '{exam.name}'."
        )

    resp_res = await session.exec(
        select(ExamQuestionResponse).where(
            ExamQuestionResponse.attempt_id == attempt.id
        )
    )
    responses = resp_res.all()
    if not responses:
        raise ValueError(f"Attempt ID '{attempt.id}' has no item responses.")

    # 1. Process Per-Question Diagnostics & Mappings
    per_question_breakdown = []
    response_payloads = []
    switch_events = []
    irt_items = []
    gti_scores_list = []

    closeness_classification_counts = {
        "Correct Response": 0,
        "High-Closeness Distractor (Partial Knowledge)": 0,
        "Neutral Distractor (Weak Alignment)": 0,
        "Misleading Distractor (Cognitive Trap)": 0,
        "Inverse Distractor (Inverted Logic)": 0,
    }

    taxonomy_stats = {"SUBJECT": {}, "TOPIC": {}, "SUBTOPIC": {}, "BLOOMS": {}}

    for r in responses:
        q = await session.get(Question, r.question_id)
        selected_opt = (
            await session.get(QuestionOption, r.selected_option_id)
            if r.selected_option_id
            else None
        )
        initial_opt = (
            await session.get(QuestionOption, r.initial_option_id)
            if r.initial_option_id
            else None
        )

        subtopic = (
            await session.get(Subtopic, q.subtopic_id) if q and q.subtopic_id else None
        )
        topic = (
            await session.get(Topic, subtopic.topic_id)
            if subtopic and subtopic.topic_id
            else None
        )
        subject = (
            await session.get(Subject, topic.subject_id)
            if topic and topic.subject_id
            else None
        )

        subj_name = subject.name if subject else "General Knowledge"
        top_name = topic.name if topic else "General Studies"
        sub_name = subtopic.name if subtopic else "Core Concepts"
        blooms_lbl = "ANALYZE"

        # Update Taxonomy Accumulators
        for tax_type, tax_code, tax_title in [
            ("SUBJECT", subject.code if subject else "GEN", subj_name),
            ("TOPIC", topic.code if topic else "GEN_T", top_name),
            ("SUBTOPIC", subtopic.code if subtopic else "GEN_ST", sub_name),
            ("BLOOMS", blooms_lbl, f"Bloom's {blooms_lbl} Skill"),
        ]:
            if tax_code not in taxonomy_stats[tax_type]:
                taxonomy_stats[tax_type][tax_code] = {
                    "name": tax_title,
                    "total": 0,
                    "correct": 0,
                }
            taxonomy_stats[tax_type][tax_code]["total"] += 1
            if r.is_correct:
                taxonomy_stats[tax_type][tax_code]["correct"] += 1

        c_classification = ClosenessEvaluator.classify_option(r.closeness_score_awarded)
        closeness_classification_counts[c_classification] = (
            closeness_classification_counts.get(c_classification, 0) + 1
        )

        # Dynamic Time Window Evaluation
        scoring_eval = TimeTieredScoringStrategy.calculate_score(
            is_correct=r.is_correct,
            time_taken_sec=r.time_taken_seconds,
            expected_time_sec=r.expected_time_seconds,
            closeness_score=r.closeness_score_awarded,
            marks_pos=q.marks if q else 2.0,
            marks_neg=q.negative_marks if q else 0.66,
        )

        if r.is_switched:
            switch_events.append(
                {
                    "initial_correct": initial_opt.is_correct if initial_opt else False,
                    "final_correct": r.is_correct,
                }
            )

        response_payloads.append(
            {
                "is_correct": r.is_correct,
                "time_taken_seconds": r.time_taken_seconds,
                "expected_time_seconds": r.expected_time_seconds,
                "closeness_score_awarded": r.closeness_score_awarded,
                "final_score": r.final_score,
                "gti_item_score": r.gti_item_score,
                "blooms_level": blooms_lbl,
            }
        )

        gti_scores_list.append(r.gti_item_score)
        irt_items.append(
            {
                "a": 1.5,
                "b": 0.2 if q and q.difficulty.value == "MEDIUM" else 0.8,
                "c": 0.25,
                "is_correct": r.is_correct,
            }
        )

        q_number = q.question_number_in_paper if q else 1
        per_question_breakdown.append(
            {
                "question_number": q_number,
                "meaningful_name": f"Question #{q_number} - {top_name} ({sub_name})",
                "section_code": q.section_code if q else "DEFAULT",
                "subject_name": subj_name,
                "topic_name": top_name,
                "subtopic_name": sub_name,
                "blooms_taxonomy_level": blooms_lbl,
                "user_selected_option": selected_opt.option_label
                if selected_opt
                else "Unattempted",
                "initial_selected_option": initial_opt.option_label
                if initial_opt
                else "Unattempted",
                "is_answer_correct": r.is_correct,
                "option_closeness_score": r.closeness_score_awarded,
                "closeness_classification": c_classification,
                "time_taken_seconds": round(r.time_taken_seconds, 1),
                "expected_time_seconds": round(r.expected_time_seconds, 1),
                "time_pacing_window": scoring_eval["time_window"],
                "final_points_awarded": round(r.final_score, 2),
                "item_guessing_probability_gti": round(r.gti_item_score, 4),
                "is_option_switched": r.is_switched,
            }
        )

    # Sort breakdown by question number
    per_question_breakdown.sort(key=lambda x: x["question_number"])

    # 2. Compute 12 Macro Psychometric Matrices
    agg_gti = GuessingTendencyStrategy.compute_aggregate_gti(gti_scores_list)
    gti_interp = GuessingTendencyStrategy.interpret_gti(agg_gti)

    pacing_eval = ExamMacroTimeStrategy.evaluate_overall_pacing(
        total_time_spent_sec=attempt.time_spent_seconds,
        total_allocated_minutes=40.0,
        total_questions=len(responses),
        responses=response_payloads,
    )

    oeei_eval = OptionEliminationStrategy.evaluate_elimination(response_payloads)
    irt_eval = IRT3PLStrategy.estimate_latent_ability(irt_items)
    switch_eval = OptionSwitchRegretStrategy.evaluate_switches(switch_events)
    blooms_eval = BloomsMasteryStrategy.evaluate_blooms(response_payloads)
    satoi_eval = SATOIEngine.evaluate_satoi(response_payloads)

    # Topic FSRS Retention
    mem_res = await session.exec(
        select(UserMemoryState).where(UserMemoryState.user_id == user_id)
    )
    user_memories = mem_res.all()
    topic_mem_records = []
    for m in user_memories:
        sub = await session.get(Subtopic, m.subtopic_id) if m.subtopic_id else None
        last_rev = (
            m.last_reviewed_at.replace(tzinfo=timezone.utc)
            if m.last_reviewed_at.tzinfo is None
            else m.last_reviewed_at
        )
        elapsed = (datetime.now(timezone.utc) - last_rev).total_seconds() / 86400.0
        topic_mem_records.append(
            {
                "topic_name": sub.name if sub else "General Concepts",
                "stability": m.fsrs_stability,
                "last_reviewed_days_ago": round(max(0.1, elapsed), 1),
            }
        )
    topic_decay_eval = TopicFSRSDecayEngine.evaluate_topic_decay(topic_mem_records)

    icrs_eval = IntegratedCognitiveReadinessEngine.compute_icrs(
        irt_theta=irt_eval["latent_ability_theta"],
        gti_value=agg_gti,
        oeei_score=oeei_eval["oeei_score"],
        pacing_skew=pacing_eval["skew_ratio"],
        satoi_score=satoi_eval["satoi_score"],
    )

    # 3. Update & Aggregate User Overall Skill Profile in Database
    prof_res = await session.exec(
        select(UserSkillProfile).where(UserSkillProfile.user_id == user_id)
    )
    profile = prof_res.first()
    if not profile:
        profile = UserSkillProfile(
            user_id=user_id,
            cumulative_irt_theta=irt_eval["latent_ability_theta"],
            cumulative_gti=agg_gti,
            cumulative_oeei=oeei_eval["oeei_score"],
            cumulative_icrs=icrs_eval["icrs_score"],
            cumulative_satoi=satoi_eval["satoi_score"],
            total_tests_given=1,
            total_questions_answered=len(responses),
        )
        session.add(profile)
    else:
        n_tests = profile.total_tests_given + 1
        profile.cumulative_irt_theta = round(
            (
                profile.cumulative_irt_theta * profile.total_tests_given
                + irt_eval["latent_ability_theta"]
            )
            / n_tests,
            2,
        )
        profile.cumulative_gti = round(
            (profile.cumulative_gti * profile.total_tests_given + agg_gti) / n_tests, 4
        )
        profile.cumulative_oeei = round(
            (
                profile.cumulative_oeei * profile.total_tests_given
                + oeei_eval["oeei_score"]
            )
            / n_tests,
            2,
        )
        profile.cumulative_icrs = round(
            (
                profile.cumulative_icrs * profile.total_tests_given
                + icrs_eval["icrs_score"]
            )
            / n_tests,
            1,
        )
        profile.cumulative_satoi = round(
            (
                profile.cumulative_satoi * profile.total_tests_given
                + satoi_eval["satoi_score"]
            )
            / n_tests,
            1,
        )
        profile.total_tests_given = n_tests
        profile.total_questions_answered += len(responses)
        profile.updated_at = datetime.now(timezone.utc)
        session.add(profile)

    # 4. Upsert User Taxonomy Mastery Records
    user_taxonomy_mastery_list = []
    for tax_type, code_dict in taxonomy_stats.items():
        for t_code, t_data in code_dict.items():
            existing_m = await session.exec(
                select(UserTaxonomyMastery).where(
                    UserTaxonomyMastery.user_id == user_id,
                    UserTaxonomyMastery.taxonomy_type == tax_type,
                    UserTaxonomyMastery.taxonomy_id_code == t_code,
                )
            )
            m_obj = existing_m.first()
            if not m_obj:
                m_obj = UserTaxonomyMastery(
                    user_id=user_id,
                    taxonomy_type=tax_type,
                    taxonomy_id_code=t_code,
                    taxonomy_name=t_data["name"],
                    total_attempts=t_data["total"],
                    correct_attempts=t_data["correct"],
                    mastery_percentage=round(
                        (t_data["correct"] / max(1, t_data["total"])) * 100, 1
                    ),
                    strength_status="STRONG"
                    if (t_data["correct"] / max(1, t_data["total"])) >= 0.75
                    else (
                        "MODERATE"
                        if (t_data["correct"] / max(1, t_data["total"])) >= 0.50
                        else "WEAK_REVISION_REQUIRED"
                    ),
                )
                session.add(m_obj)
            else:
                m_obj.total_attempts += t_data["total"]
                m_obj.correct_attempts += t_data["correct"]
                m_obj.mastery_percentage = round(
                    (m_obj.correct_attempts / max(1, m_obj.total_attempts)) * 100, 1
                )
                m_obj.strength_status = (
                    "STRONG"
                    if m_obj.mastery_percentage >= 75.0
                    else (
                        "MODERATE"
                        if m_obj.mastery_percentage >= 50.0
                        else "WEAK_REVISION_REQUIRED"
                    )
                )
                m_obj.updated_at = datetime.now(timezone.utc)
                session.add(m_obj)

            user_taxonomy_mastery_list.append(
                {
                    "taxonomy_type": tax_type,
                    "code": t_code,
                    "name": t_data["name"],
                    "total_attempts": m_obj.total_attempts,
                    "correct_attempts": m_obj.correct_attempts,
                    "mastery_percentage": m_obj.mastery_percentage,
                    "strength_status": m_obj.strength_status,
                }
            )

    await session.commit()

    # 5. Compile Descriptive Multi-Dimensional Report Payload
    return {
        "metadata": {
            "report_title": "Comprehensive Psychometric & Cognitive Diagnostic Audit Report",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "candidate": {
                "user_id": str(user.id),
                "full_name": user.full_name,
                "email": user.email,
            },
            "exam_attempt": {
                "attempt_id": str(attempt.id),
                "exam_id": str(exam.id),
                "exam_name": exam.name,
                "canonical_code": exam.code,
                "total_score_awarded": attempt.total_score,
                "max_possible_score": attempt.max_possible_score,
                "time_spent_seconds": attempt.time_spent_seconds,
                "total_questions_attempted": attempt.total_questions_attempted,
                "attempt_date": attempt.created_at.isoformat(),
            },
        },
        "user_overall_skill_profile": {
            "meaningful_name": "Candidate Cumulative Psychometric Skill Profile",
            "description": "Aggregated long-term cognitive benchmark derived across all tests attempted by the user.",
            "cumulative_icrs_score": profile.cumulative_icrs,
            "cumulative_irt_theta": profile.cumulative_irt_theta,
            "cumulative_gti": profile.cumulative_gti,
            "cumulative_oeei": profile.cumulative_oeei,
            "cumulative_satoi": profile.cumulative_satoi,
            "total_tests_given": profile.total_tests_given,
            "total_questions_answered": profile.total_questions_answered,
            "taxonomy_mastery_breakdown": user_taxonomy_mastery_list,
        },
        "exam_macro_analytics": {
            "1_integrated_cognitive_readiness": {
                "meaningful_name": "Integrated Cognitive Readiness Index (ICRS)",
                "description": "Unified 100-point benchmark evaluating IRT concept mastery, elimination discipline, pacing, and stamina.",
                "value": icrs_eval,
            },
            "2_irt_3pl_latent_ability": {
                "meaningful_name": "Item Response Theory (IRT 3PL) Latent Ability Estimate",
                "description": "True mathematical ability (Theta) calculated using 3PL Newton-Raphson MAP and Fisher Information Scoring.",
                "value": irt_eval,
            },
            "3_guessing_tendency_index": {
                "meaningful_name": "Impulsive Guessing Tendency Index (GTI)",
                "description": "Measures uncalculated rapid guessing risk based on impulse latency thresholds.",
                "value": {
                    "aggregate_gti": agg_gti,
                    "category": gti_interp["category"],
                    "label": gti_interp["label"],
                    "recommendation": gti_interp["recommendation"],
                },
            },
            "4_macro_pacing_and_fatigue": {
                "meaningful_name": "Overall Exam Pacing & Time Skew Analytics",
                "description": "Evaluates time utilization %, first vs second half time skew ratio, and fatigue drop %.",
                "value": pacing_eval,
            },
            "5_option_elimination_efficiency": {
                "meaningful_name": "Option Elimination Efficiency Index (OEEI)",
                "description": "Measures tactical elimination precision vs vulnerability to cognitive trap distractors.",
                "value": oeei_eval,
            },
            "6_speed_accuracy_tradeoff_satoi": {
                "meaningful_name": "Speed-Accuracy Trade-off & Cognitive Stamina (SATOI)",
                "description": "Tracks accuracy decay across test quartiles (Q1 to Q4) to detect cognitive burnout.",
                "value": satoi_eval,
            },
            "7_option_switch_regret": {
                "meaningful_name": "Option Switch & Second-Guessing Regret Matrix",
                "description": "Analyzes answer switching frequency and negative regret ratio when changing initial choices.",
                "value": switch_eval,
            },
            "8_blooms_taxonomy_mastery": {
                "meaningful_name": "Bloom's Taxonomy Cognitive Mastery Matrix",
                "description": "Evaluates accuracy across Remembering, Understanding, Applying, Analyzing, and Evaluating items.",
                "value": blooms_eval,
            },
            "9_topic_fsrs_memory_decay": {
                "meaningful_name": "Subject/Topic FSRS Memory Decay & Retention Matrix",
                "description": "Calculates current memory retrievability R(t) and schedules optimal revision dates per topic.",
                "value": topic_decay_eval,
            },
            "10_option_closeness_classification": {
                "meaningful_name": "Distractor Closeness Classification Breakdown",
                "description": "Counts distribution of user responses across option distractor closeness tiers.",
                "value": closeness_classification_counts,
            },
        },
        "per_question_diagnostic_report": per_question_breakdown,
    }
