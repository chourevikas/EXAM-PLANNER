import json
import uuid
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone

from app.schemas.report_llm_schemas import (
    CognitiveDiagnosticInsight,
    ActionableStudyTask,
    PriorityEnum,
    ActivityTypeEnum,
)
from app.config.logger import setup_logger

logger = setup_logger("ReportAISynthesizer")


class ReportAISynthesizer:
    """
    Synthesizes expert cognitive & psychometric diagnostic reports from pre-calculated metrics
    using Structured Output LLM generation with zero mathematical hallucination and zero jargon.
    """

    SYSTEM_PROMPT = """You are the Chief Mentor and Academic Coach at RankEdge for UPSC and Competitive Exam Aspirants.
You are provided with a complete, 100% pre-calculated mathematical metrics matrix of a candidate's exam performance.

YOUR MANDATE:
1. Do NOT recalculate or hallucinate any numbers, percentages, or scores. Rely strictly on the pre-computed metrics provided.
2. Provide a sharp, professional, highly encouraging, and prescriptive diagnostic evaluation.
3. ABSOLUTELY NO EMOJIS in your output. Your tone must be human, empathetic, and mentorship-oriented, NOT sounding like an AI or robotic system.
4. NEVER refer to yourself or your analysis as "AI". Act strictly as a human mentor guiding the aspirant.
5. NEVER USE ACADEMIC PSYCHOMETRIC JARGON in descriptions, insights, or tasks (NEVER mention 'IRT 3PL', 'theta', 'latent ability', 'GTI', 'OEEI', 'SATOI', 'OSRI', 'ICRS', 'FSRS', 'alpha/beta parameters').
   Instead use intuitive, natural, encouraging concepts:
   - "Knowledge Depth & Mastery" (instead of IRT latent theta)
   - "Guessing Risk & Confidence" (instead of GTI)
   - "Pacing & Speed Management" (instead of Time-Tiered Pacing)
   - "Option Elimination Skill" (instead of OEEI)
   - "Cognitive Stamina & Endurance" (instead of SATOI)
   - "Decision Consistency & Changing Answers" (instead of OSRI / Switch Regret)
   - "Overall Exam Readiness" (instead of ICRS)
   - "Thinking Levels" (Fact Recall, Conceptual Analysis, Critical Judgment)
   - "Trap Resistance" (instead of Distractor Closeness)
   - "Memory Retention & Spaced Review" (instead of FSRS decay)
6. For EACH of the 11 diagnostic points listed in the schema, generate a concise, crisp 1-2 sentence contextual interpretation explaining what the candidate's specific number means for their preparation and what tactical adjustment to make.
7. Generate EXACTLY 4 concrete, prioritized, TIME-ALLOCATED study tasks (ActionableStudyTask) for the aspirant's study calendar.
   - Each task MUST have a realistic duration (e.g. 30, 45, 60 mins), specific activity type (CONCEPT_REVISION, TARGETED_MCQ_PRACTICE, ERROR_LOG_AUDIT, FLASHCARD_SPACED_REVIEW, PACING_DRILL), priority, due timeframe, and a 3-step action checklist.
8. Return the result matching the required schema exactly.
"""

    @classmethod
    async def generate_diagnostic_insight(
        cls,
        candidate_info: Dict[str, Any],
        exam_info: Dict[str, Any],
        precalculated_metrics: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Executes Structured LLM call to synthesize the diagnostic report.
        Falls back to high-fidelity deterministic synthesis if LLM provider is offline.
        """
        payload = {
            "candidate": candidate_info,
            "exam_metadata": exam_info,
            "precalculated_metrics": precalculated_metrics,
        }

        try:
            from app.llm.factory import get_vision_llm
            from app.config.settings import get_settings

            settings = get_settings()
            # Fail fast: this call has a deterministic fallback below, so a degraded/slow provider
            # should not block report generation for minutes via long retries/timeouts.
            is_cumulative = exam_info.get("attempt_id") == "CUMULATIVE_ALL"
            chat_model = get_vision_llm(
                timeout=settings.REPORT_LLM_TIMEOUT_SECONDS,
                max_retries=settings.REPORT_LLM_MAX_RETRIES,
                rate_limit_rps=settings.REPORT_LLM_RATE_LIMIT_RPS,
                feature="cumulative_report" if is_cumulative else "attempt_report",
                usage_context={
                    "exam_id": exam_info.get("exam_id"),
                    "attempt_id": exam_info.get("attempt_id"),
                    "user_id": candidate_info.get("user_id"),
                },
            )

            # Use with_structured_output if supported
            if hasattr(chat_model, "with_structured_output"):
                structured_llm = chat_model.with_structured_output(CognitiveDiagnosticInsight)
                prompt_messages = [
                    {"role": "system", "content": cls.SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": f"Analyze this candidate exam performance matrix and generate the structured diagnostic insight, all 11 dimension insights, and actionable study tasks:\n\n{json.dumps(payload, indent=2)}",
                    },
                ]
                logger.info(f"Invoking LLM structured output for Exam Attempt '{exam_info.get('attempt_id')}'...")
                res: CognitiveDiagnosticInsight = await structured_llm.ainvoke(prompt_messages)
                if isinstance(res, CognitiveDiagnosticInsight):
                    return res.model_dump()
                elif isinstance(res, dict):
                    return CognitiveDiagnosticInsight(**res).model_dump()
        except Exception as llm_err:
            err_str = str(llm_err)
            is_perm_err = "403" in err_str or "PERMISSION_DENIED" in err_str or "permission" in err_str.lower()
            if is_perm_err:
                logger.error(
                    f"❌ [VERTEX AI PERMISSION DENIED] 403 Forbidden invoking model '{getattr(settings, 'GEMINI_MODEL_NAME', 'gemini-2.5-flash')}': {llm_err}. "
                    f"Check GCP project '{getattr(settings, 'GCP_PROJECT_ID', None)}' / region '{getattr(settings, 'GCP_LOCATION', None)}' "
                    f"and ensure the service account has 'roles/aiplatform.user' (aiplatform.endpoints.predict). "
                    "Engaging deterministic diagnostic synthesizer fallback.",
                    exc_info=True,
                )
            else:
                logger.error(
                    f"❌ [VERTEX AI LLM ERROR] Structured LLM invocation failed ({llm_err}). "
                    "Engaging deterministic high-fidelity diagnostic synthesizer fallback.",
                    exc_info=True,
                )

        # High-fidelity deterministic fallback conforming strictly to CognitiveDiagnosticInsight schema
        return cls._generate_deterministic_fallback(payload)

    @classmethod
    def _generate_deterministic_fallback(cls, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Generates schema-compliant, data-grounded diagnostic insight deterministically without jargon."""
        metrics = payload.get("precalculated_metrics", {})
        exam_meta = payload.get("exam_metadata", {})
        scoring = metrics.get("scoring", {})
        psy = metrics.get("psychometrics", {})
        unatt = metrics.get("unattempted_analysis", {})
        weak_tax = metrics.get("weak_taxonomy_areas", [])
        strong_tax = metrics.get("strong_taxonomy_areas", [])
        dist_traps = metrics.get("distractor_vulnerability", {})
        blooms = metrics.get("blooms_mastery", {})

        net_score = float(scoring.get("net_score", 0.0))
        max_score = float(scoring.get("max_score", 200.0))
        cutoff = float(scoring.get("qualifying_cutoff", 92.0))
        margin = round(net_score - cutoff, 2)
        acc_pct = float(scoring.get("accuracy_percentage", 50.0))
        pos_marks = float(scoring.get("gross_positive_marks", 0.0))
        neg_marks = float(scoring.get("negative_marks_lost", 0.0))
        attempted_count = int(scoring.get("attempted_count", 0))
        pacing_status = psy.get("pacing_status", "BALANCED_PACING")

        # 1. Executive Summary & Verdict
        if margin >= 10.0:
            verdict = f"Well Above Qualifying Cutoff (+{margin:.2f} Marks) - Top Contender Trajectory"
            summary = f"Exceptional performance securing {net_score:.2f} net marks with {acc_pct:.1f}% accuracy across {attempted_count} attempted questions. High tactical discipline and strong conceptual stability demonstrated throughout the test."
        elif margin >= 0:
            verdict = f"Qualifying Cutoff Benchmark Cleared (+{margin:.2f} Marks) - Competitive Trajectory"
            summary = f"Solid test execution achieving {net_score:.2f} net marks, successfully clearing the qualifying benchmark by {margin:.2f} marks. Continued focus on reducing unforced distractor errors will solidify your rank buffer."
        elif margin >= -15.0:
            verdict = f"Near Cutoff Margin ({margin:.2f} Marks) - High Recovery Potential"
            summary = f"Scored {net_score:.2f} net marks ({abs(margin):.2f} marks below target benchmark). Analysis indicates this deficit was primarily driven by {neg_marks:.2f} negative marks lost to distractor traps and unattempted bottleneck questions."
        else:
            verdict = f"Below Cutoff Benchmark ({margin:.2f} Marks) - Foundation & Pacing Focus Needed"
            summary = f"Completed the test with {net_score:.2f} net marks. Performance data indicates conceptual gaps in high-yield topics alongside early time bottlenecks that constrained attempt volume."

        # 2. Tactical Strengths
        strengths = []
        if strong_tax:
            top_s = [s.get("subject") or s.get("topic") for s in strong_tax[:2] if s.get("subject") or s.get("topic")]
            if top_s:
                strengths.append(f"Demonstrated solid concept command and high accuracy in {', '.join(top_s)}.")
        if psy.get("gti_category") in ("HIGH_CONFIDENCE_METHODICAL", "CONTROLLED_CALCULATED_RISK"):
            strengths.append("Disciplined gut-instinct with minimal impulsive guessing errors under pressure.")
        if psy.get("oeei_score_pct", 0) >= 65.0:
            strengths.append(f"Tactical option elimination conversion at {psy.get('oeei_score_pct'):.1f}%, effectively filtering out weak distractors.")
        if not strengths:
            strengths.append(f"Maintained active engagement across {attempted_count} questions.")

        # 3. Critical Vulnerabilities
        vulnerabilities = []
        if weak_tax:
            top_w = [w.get("topic") or w.get("subject") for w in weak_tax[:2] if w.get("topic") or w.get("subject")]
            if top_w:
                vulnerabilities.append(f"Accuracy dropped below target threshold in {', '.join(top_w)}.")
        if dist_traps.get("high_closeness_traps_fallen", 0) >= 4:
            vulnerabilities.append(f"Fell for {dist_traps.get('high_closeness_traps_fallen')} near-miss distractor traps.")
        if psy.get("negative_switches_count", 0) >= 2:
            vulnerabilities.append(f"Second-guessing penalty: switched {psy.get('negative_switches_count')} answers from correct to incorrect, costing marks.")
        if "BOTTLENECK" in pacing_status or "OVERTHINK" in pacing_status:
            vulnerabilities.append("Early-exam overthinking bottlenecks created severe time starvation in the final quarter.")
        if not vulnerabilities:
            vulnerabilities.append("Minor accuracy drop on multi-statement analytical questions.")

        # 4. Pacing & Unattempted Diagnosis
        time_starved = unatt.get("time_starved", 0)
        hesitated = unatt.get("hesitated_abandoned", 0)
        strategic = unatt.get("strategic_skip", 0)
        wasted_sec = unatt.get("wasted_time_on_abandoned_sec", 0)

        pacing_diag = (
            f"Overall Pacing Profile: {pacing_status.replace('_', ' ').title()} averaging {psy.get('avg_seconds_per_question', 60.0):.1f}s/question. "
            f"Of the {scoring.get('unattempted_count', 0)} unattempted questions, {time_starved} were Time-Starved (ran out of time before reading), "
            f"{hesitated} were Hesitated & Abandoned ({round(wasted_sec/60.0, 1)} minutes spent reading without reaching an elimination decision), "
            f"and {strategic} were Strategic Safe Skips."
        )

        # 5. Distractor Trap Critique
        dist_critique = (
            f"Trap Resistance: Fallen for {dist_traps.get('high_closeness_traps_fallen', 0)} near-miss traps and "
            f"{dist_traps.get('inverse_fact_traps_fallen', 0)} inverted-fact statements. "
            f"Second-guessing index reflects {psy.get('positive_switches_count', 0)} rewarding switches vs {psy.get('negative_switches_count', 0)} costly switches. "
            f"Recommendation: Implement a mandatory 15-second keyword verification check on statement options before confirming."
        )

        # 6. Generate 11 Dedicated Jargon-Free Metric Insights
        score_insight = (
            f"Net score of {net_score:.2f}/{max_score:.2f} ({acc_pct:.1f}% accuracy). "
            f"Earned +{pos_marks:.2f} marks from accurate answers while conceding -{neg_marks:.2f} marks to negative penalty."
        )

        perc = float(psy.get("percentile_rank", 50.0))
        knowledge_insight = (
            f"Knowledge mastery sits at the {perc:.1f}th percentile benchmark. "
            f"Strong command demonstrated on standard questions, with room to sharpen nuanced analytical applications."
        )

        gti_pct = float(psy.get("gti_aggregate", 0.15)) * 100.0
        guessing_insight = (
            f"Guessing risk measured at {gti_pct:.1f}%. "
            f"Reflects thoughtful question selection with minimal blind impulsive choices under exam pressure."
        )

        avg_sec = float(psy.get("avg_seconds_per_question", 60.0))
        pacing_insight = (
            f"Pacing profile is {pacing_status.replace('_', ' ').title()} averaging {avg_sec:.1f}s per question. "
            f"Balanced time distribution across rounds prevented severe end-of-test time crunches."
        )

        oeei_val = float(psy.get("oeei_score_pct", 70.0))
        elimination_insight = (
            f"Option elimination efficiency reached {oeei_val:.1f}%. "
            f"Effective tactical pruning of unlikely distractors converted 50:50 dilemmas into positive score gains."
        )

        satoi_val = float(psy.get("satoi_score", 85.0))
        stamina_insight = (
            f"Cognitive stamina rating is {satoi_val:.0f}/100. "
            f"Maintained steady focus and decision clarity across the full duration with minimal late-stage fatigue."
        )

        pos_sw = int(psy.get("positive_switches_count", 0))
        neg_sw = int(psy.get("negative_switches_count", 0))
        decision_insight = (
            f"Answer review pattern: {pos_sw} switches gained marks while {neg_sw} switches proved costly. "
            f"Trust calibrated initial instincts when reviewing flagged multi-statement questions."
        )

        icrs_val = float(psy.get("icrs_score", 65.0))
        readiness_insight = (
            f"Overall exam readiness scored {icrs_val:.0f}/100. "
            f"Synthesizes attempt volume, accuracy, and tactical discipline relative to competitive qualification benchmarks."
        )

        fact_acc = float(blooms.get("fact_recall_accuracy", 70.0))
        anal_acc = float(blooms.get("conceptual_analysis_accuracy", 60.0))
        crit_acc = float(blooms.get("critical_evaluation_accuracy", 50.0))
        thinking_insight = (
            f"Cognitive thinking profile: {fact_acc:.1f}% Fact Recall accuracy, {anal_acc:.1f}% Conceptual Analysis accuracy, "
            f"and {crit_acc:.1f}% Critical Evaluation accuracy."
        )

        traps_fallen = int(dist_traps.get("high_closeness_traps_fallen", 0))
        trap_insight = (
            f"Encountered {traps_fallen} near-miss traps. "
            f"Carefully scrutinizing qualifier keywords (e.g. 'all', 'only', 'primarily') will safeguard against subtle distractor lures."
        )

        memory_insight = (
            f"Concept stability indicates {len(weak_tax)} high-priority topic areas entering their optimal revision window for spaced review."
        )

        # 7. Actionable Study Plan Tasks (Exactly 4 high-yield tasks)
        study_tasks = []
        for idx, wt in enumerate(weak_tax[:4], start=1):
            t_subj = wt.get("subject", "General Studies")
            t_name = wt.get("topic", "Core Concepts")
            t_sub = wt.get("subtopic")
            t_acc = wt.get("accuracy", 35.0)
            missed_qs = wt.get("missed_questions", [])

            study_tasks.append(
                ActionableStudyTask(
                    task_id=f"task_{idx}_{uuid.uuid4().hex[:6]}",
                    title=f"Targeted Concept Revision: {t_name}",
                    subject=t_subj,
                    topic=t_name,
                    subtopic=t_sub,
                    activity_type=ActivityTypeEnum.CONCEPT_REVISION if t_acc < 45.0 else ActivityTypeEnum.TARGETED_MCQ_PRACTICE,
                    priority=PriorityEnum.CRITICAL if t_acc < 40.0 else PriorityEnum.HIGH,
                    allocated_time_minutes=45 if t_acc < 40.0 else 30,
                    due_in_days=min(7, idx + 1),
                    reasoning=f"Accuracy was {t_acc:.1f}% in this exam with {len(missed_qs)} missed/trapped questions.",
                    action_checklist=[
                        f"Review core textbook notes & syllabus chapter for {t_name}",
                        f"Examine step-by-step solution breakdowns for missed exam items",
                        f"Practice 15 timed MCQs focusing strictly on option elimination in {t_name}",
                    ],
                    linked_question_numbers=missed_qs,
                    is_added_to_plan=False,
                )
            )

        fallback_templates = [
            (
                "Mock Error Log Consolidation & Review",
                "General Studies",
                "Comprehensive Review",
                "Distractor Traps",
                ActivityTypeEnum.ERROR_LOG_AUDIT,
                PriorityEnum.HIGH,
                30,
                2,
                "Consolidate learning from switched and near-miss questions before the next test.",
                [
                    "Review step-by-step solutions for all incorrect questions",
                    "Log high-closeness distractor traps in your personal revision diary",
                    "Verify key takeaway concepts for recurring question patterns",
                ],
            ),
            (
                "Option Elimination & 50:50 Dilemma Drill",
                "General Studies",
                "Tactical MCQ Strategy",
                "Elimination Precision",
                ActivityTypeEnum.TARGETED_MCQ_PRACTICE,
                PriorityEnum.HIGH,
                40,
                3,
                "Sharpen tactical elimination skills to convert 50:50 choices into consistent score gains.",
                [
                    "Identify and eliminate 2 clearly implausible options before analyzing remaining choices",
                    "Watch out for absolute qualifiers like 'always', 'all', 'never'",
                    "Complete a 15-question speed drill under strict 45-second timer constraints",
                ],
            ),
            (
                "High-Yield Concept Spaced Retention Booster",
                "General Studies",
                "Core Syllabus Mastery",
                "Spaced Review",
                ActivityTypeEnum.FLASHCARD_SPACED_REVIEW,
                PriorityEnum.MEDIUM,
                30,
                4,
                "Prevent memory decay in high-frequency exam syllabus themes.",
                [
                    "Run through active recall summaries for weak topic areas",
                    "Re-attempt previously missed questions without looking at solutions",
                    "Create condensed 1-page formula/concept summary sheets",
                ],
            ),
            (
                "First-Pass Pacing & Speed Management Drill",
                "General Studies",
                "Exam Temperament",
                "Time Allocation",
                ActivityTypeEnum.PACING_DRILL,
                PriorityEnum.MEDIUM,
                35,
                5,
                "Calibrate time per question to prevent late-stage exam time bottlenecks.",
                [
                    "Practice 25 questions in a single unbroken 25-minute sprint",
                    "Mark tough 3-statement questions for round 2 within 15 seconds",
                    "Review time-efficiency ratio to maintain < 55s average per question",
                ],
            ),
        ]

        while len(study_tasks) < 4:
            tmpl_idx = len(study_tasks)
            t_title, t_sub, t_top, t_subtop, t_act, t_pri, t_dur, t_due, t_rea, t_chk = fallback_templates[tmpl_idx % len(fallback_templates)]
            study_tasks.append(
                ActionableStudyTask(
                    task_id=f"task_{tmpl_idx + 1}_{uuid.uuid4().hex[:6]}",
                    title=t_title,
                    subject=t_sub,
                    topic=t_top,
                    subtopic=t_subtop,
                    activity_type=t_act,
                    priority=t_pri,
                    allocated_time_minutes=t_dur,
                    due_in_days=t_due,
                    reasoning=t_rea,
                    action_checklist=t_chk,
                    linked_question_numbers=[],
                    is_added_to_plan=False,
                )
            )

        study_tasks = study_tasks[:4]

        # 8. Closing Mentorship Advice
        closing = (
            "Remember that test series scores are diagnostic stepping stones, not final verdicts. "
            "By executing these targeted revision tasks and managing your first-pass pacing, you will steadily expand your rank buffer!"
        )

        insight_obj = CognitiveDiagnosticInsight(
            executive_summary=summary,
            benchmark_verdict=verdict,
            tactical_strengths=strengths,
            critical_vulnerabilities=vulnerabilities,
            pacing_and_unattempted_diagnosis=pacing_diag,
            distractor_trap_critique=dist_critique,
            score_and_accuracy_insight=score_insight,
            knowledge_depth_insight=knowledge_insight,
            guessing_and_confidence_insight=guessing_insight,
            pacing_and_time_insight=pacing_insight,
            elimination_skill_insight=elimination_insight,
            stamina_and_consistency_insight=stamina_insight,
            decision_confidence_insight=decision_insight,
            exam_readiness_insight=readiness_insight,
            thinking_levels_insight=thinking_insight,
            trap_resistance_insight=trap_insight,
            memory_retention_insight=memory_insight,
            study_plan_tasks=study_tasks,
            closing_mentorship_advice=closing,
        )
        return insight_obj.model_dump()

