from typing import Dict, Any


def format_report_to_markdown(report_data: Dict[str, Any]) -> str:
    """
    Formats the compiled psychometric report into a beautiful, human and AI-readable Markdown document.
    """
    meta = report_data.get("metadata", {})
    cand = meta.get("candidate", {})
    att = meta.get("exam_attempt", {})
    prof = report_data.get("user_overall_skill_profile", {})
    macro = report_data.get("exam_macro_analytics", {})
    questions = report_data.get("per_question_diagnostic_report", [])

    lines = []

    # Title & Header
    lines.append(f"# 📊 {meta.get('report_title', 'Psychometric Diagnostic Report')}")
    lines.append(f"**Candidate**: {cand.get('full_name')} (`{cand.get('email')}`)")
    lines.append(f"**Exam**: {att.get('exam_name')} (`{att.get('canonical_code')}`)")
    lines.append(f"**Attempt Date**: {att.get('attempt_date')}")
    lines.append(
        f"**Score**: `{att.get('total_score_awarded')} / {att.get('max_possible_score')}` | **Time Spent**: `{round(att.get('time_spent_seconds', 0) / 60.0, 1)} mins`"
    )
    lines.append("\n---\n")

    # Executive Summary Alert
    icrs = macro.get("1_integrated_cognitive_readiness", {}).get("value", {})
    lines.append("> [!IMPORTANT]")
    lines.append(
        f"> **Integrated Cognitive Readiness Score (ICRS)**: **{icrs.get('icrs_score', 0)} / 100** (`{icrs.get('readiness_tier')}`)"
    )
    lines.append(
        "> Candidate demonstrates strong tactical elimination discipline with balanced pacing across exam sections."
    )
    lines.append("")

    # Section 1: User Overall Skill Profile & Taxonomy Mapping
    lines.append("## 🧠 Candidate Cumulative Psychometric Skill Profile")
    lines.append(f"_{prof.get('description')}_")
    lines.append("")
    lines.append(
        "| Metric / Skill Indicator | Cumulative Value | Target Benchmark | Status |"
    )
    lines.append("| :--- | :---: | :---: | :---: |")
    lines.append(
        f"| **Integrated Readiness (ICRS)** | `{prof.get('cumulative_icrs_score')}` | `75.0+` | {'✅ Optimal' if prof.get('cumulative_icrs_score', 0) >= 75 else '⚠️ In Progress'} |"
    )
    lines.append(
        f"| **IRT Latent Ability (Theta)** | `{prof.get('cumulative_irt_theta')}` | `+1.00+` | {'✅ Top Performer' if prof.get('cumulative_irt_theta', 0) >= 1.0 else '🟡 Moderate'} |"
    )
    lines.append(
        f"| **Impulsive Guessing Index (GTI)** | `{prof.get('cumulative_gti')}` | `< 0.30` | {'✅ Controlled' if prof.get('cumulative_gti', 0) < 0.30 else '❌ High Impulse'} |"
    )
    lines.append(
        f"| **Option Elimination Efficiency (OEEI)** | `{prof.get('cumulative_oeei')}` | `> 0.70` | {'✅ High Precision' if prof.get('cumulative_oeei', 0) >= 0.70 else '🟡 Moderate'} |"
    )
    lines.append(
        f"| **Cognitive Stamina (SATOI)** | `{prof.get('cumulative_satoi')}` | `> 85.0` | {'✅ High Stamina' if prof.get('cumulative_satoi', 0) >= 85 else '⚠️ Fatigue Risk'} |"
    )
    lines.append(
        f"| **Total Tests / Questions Tracked** | `{prof.get('total_tests_given')} tests` / `{prof.get('total_questions_answered')} Qs` | `-` | `Active Candidate` |"
    )
    lines.append("")

    # Taxonomy Breakdown Table
    lines.append("### 📚 Subject & Topic Mastery Breakdown")
    lines.append(
        "| Taxonomy Category | Code / Identifier | Name / Description | Attempts | Mastery % | Status |"
    )
    lines.append("| :--- | :--- | :--- | :---: | :---: | :---: |")
    for t_item in prof.get("taxonomy_mastery_breakdown", []):
        badge = (
            "🟢 Strong"
            if t_item.get("strength_status") == "STRONG"
            else (
                "🟡 Moderate"
                if t_item.get("strength_status") == "MODERATE"
                else "🔴 Urgent Revision"
            )
        )
        lines.append(
            f"| **{t_item.get('taxonomy_type')}** | `{t_item.get('code')}` | {t_item.get('name')} | `{t_item.get('total_attempts')}` | `{t_item.get('mastery_percentage')}%` | {badge} |"
        )
    lines.append("")

    # Section 2: Macro Exam Analytics
    lines.append("## 📈 Exam Macro Psychometric Analytics")
    lines.append("")

    for key, matrix in sorted(macro.items()):
        name = matrix.get("meaningful_name")
        desc = matrix.get("description")
        val = matrix.get("value")
        lines.append(f"### {name}")
        lines.append(f"*{desc}*")
        lines.append("```json")
        lines.append(str(val))
        lines.append("```")
        lines.append("")

    # Section 3: Per-Question Diagnostic Audit Table
    lines.append("## 🔬 Question-Wise Diagnostic Audit Report")
    lines.append(
        "_Detailed item-level breakdown tracking accuracy, distractor closeness, time tier pacing, and impulse guessing probability for each question attempted._"
    )
    lines.append("")

    lines.append(
        "| Q# | Question Title / Topic | Choice | Correct? | Closeness Classification | Time (s) | Pacing Tier | Score | GTI | Switch? |"
    )
    lines.append(
        "| :---: | :--- | :---: | :---: | :--- | :---: | :---: | :---: | :---: | :---: |"
    )

    for q_item in questions:
        corr_badge = "✅ Yes" if q_item.get("is_answer_correct") else "❌ No"
        switch_badge = "⚠️ Yes" if q_item.get("is_option_switched") else "No"
        lines.append(
            f"| `{q_item.get('question_number')}` | **{q_item.get('meaningful_name')}** | `{q_item.get('user_selected_option')}` | {corr_badge} | {q_item.get('closeness_classification')} | `{q_item.get('time_taken_seconds')}s` | `{q_item.get('time_pacing_window')}` | `{q_item.get('final_points_awarded')}` | `{q_item.get('item_guessing_probability_gti')}` | {switch_badge} |"
        )

    lines.append("")
    lines.append("---")
    lines.append("> [!TIP]")
    lines.append(
        "> **AI Mentorship Recommendation**: Focus immediate 1-on-1 revision on topics with retrievability $R(t) < 60\\%$ and practice 45-second elimination drills on High-Closeness distractors to eliminate residual guessing errors."
    )

    return "\n".join(lines)
