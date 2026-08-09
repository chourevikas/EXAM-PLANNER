import json
from typing import Optional, List, Any
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession
from app.storage.base import BaseStorageProvider
from app.storage.factory import get_storage_provider
from app.db.models import (
    Question,
    QuestionTranslation,
    QuestionOption,
    OptionTranslation,
    QuestionAsset,
    Passage,
    PassageTranslation,
    Exam,
    QuestionExplanation,
    QuestionMetadata,
    QuestionHierarchyLink,
    Subject,
    Topic,
    Subtopic,
)
from app.formatters.yaml_exporter import get_canonical_question_filename_stem


def _parse_json_list(val: Any) -> List[str]:
    if not val:
        return []
    if isinstance(val, list):
        return [str(x) for x in val]
    if isinstance(val, str):
        try:
            res = json.loads(val)
            return [str(x) for x in res] if isinstance(res, list) else [val]
        except Exception:
            return [val]
    return []


async def async_export_question_to_markdown(
    session: AsyncSession,
    question: Question,
    storage: Optional[BaseStorageProvider] = None,
) -> str:
    """
    Asynchronously generates a production-ready Markdown string matching all
    extracted information after Pipeline 3 completion (Metadata, Explanations,
    Correct Answers, Option Analysis, Key Takeaways, Common Traps, and Taxonomy Links).
    """
    if storage is None:
        storage = get_storage_provider()

    exam = await session.get(Exam, question.exam_id) if question.exam_id else None
    q_stem = get_canonical_question_filename_stem(session, question, exam)

    sec_code = question.section_code or "DEFAULT"
    q_num = question.question_number_in_paper
    status_str = (
        question.status.value
        if hasattr(question.status, "value")
        else str(question.status)
    )

    lines = []
    lines.append(f"# Question {q_num:03d} - `{q_stem}`")
    lines.append("")
    lines.append(
        f"**Canonical ID:** `{q_stem}` | **Section:** `{sec_code}` | **Status:** `{status_str}` | "
        f"**Is MCQ:** `{question.is_mcq}` | **Question Pages:** `{question.page_numbers_json}` | **Passage Pages:** `{question.passage_page_numbers_json or '[]'}`"
    )
    lines.append("")

    # Fetch Question Metadata (Pipeline 3)
    meta_stmt = select(QuestionMetadata).where(QuestionMetadata.question_id == question.id)
    q_meta = (await session.exec(meta_stmt)).first()
    if q_meta:
        b_level = q_meta.blooms_level.value if hasattr(q_meta.blooms_level, "value") else str(q_meta.blooms_level)
        lines.append("## 📊 Psychometric & Question Metadata")
        lines.append(
            f"- **Bloom's Taxonomy Level:** `{b_level}`\n"
            f"- **Cognitive Skill:** `{q_meta.cognitive_skill or 'N/A'}`\n"
            f"- **Primary Concept Tag:** `{q_meta.primary_concept_tag}`\n"
            f"- **IRT 3PL Parameters:** Discrimination ($a$) = `{q_meta.irt_discrimination_a:.2f}`, Difficulty ($b$) = `{q_meta.irt_difficulty_b:.2f}`, Pseudo-guessing ($c$) = `{q_meta.irt_pseudo_guessing_c:.2f}`\n"
            f"- **Historical Accuracy:** `{q_meta.historical_accuracy:.1f}%` | **PYQ Frequency:** `{q_meta.pyq_frequency}x`"
        )
        lines.append("")

    # Fetch Taxonomy & Multi-Concept Links
    links_stmt = select(QuestionHierarchyLink).where(QuestionHierarchyLink.question_id == question.id)
    hierarchy_links = (await session.exec(links_stmt)).all()
    if hierarchy_links:
        lines.append("## 🏷️ Concept Taxonomy & Syllabus Links")
        for link in hierarchy_links:
            subtop = await session.get(Subtopic, link.subtopic_id)
            top = await session.get(Topic, link.topic_id)
            subj = await session.get(Subject, link.subject_id)
            subj_name = subj.name if subj else "N/A"
            top_name = top.name if top else "N/A"
            subtop_name = subtop.name if subtop else "N/A"
            primary_badge = "⭐ Primary" if link.is_primary else "🔗 Related"
            lines.append(
                f"- **{primary_badge}**: `{subj_name}` ➔ `{top_name}` ➔ `{subtop_name}` "
                f"(Concept: *{link.concept_name or top_name}*, Relevance Weight: `{link.relevance_weight:.2f}`)"
            )
        lines.append("")

    lines.append("---")
    lines.append("")

    # Fetch Translations
    q_trans_res = await session.exec(
        select(QuestionTranslation).where(
            QuestionTranslation.question_id == question.id
        )
    )
    q_translations = q_trans_res.all()

    # Fetch Assets
    assets_res = await session.exec(
        select(QuestionAsset)
        .where(QuestionAsset.question_id == question.id)
        .order_by(col(QuestionAsset.display_order))
    )
    assets = assets_res.all()

    # Fetch Passage if linked
    passage = (
        await session.get(Passage, question.passage_id) if question.passage_id else None
    )

    for q_trans in q_translations:
        lang_enum = q_trans.language
        lang_str = (
            lang_enum.value
            if hasattr(lang_enum, "value")
            else str(lang_enum)
        )
        lines.append(f"## Language: [{lang_str}]")
        lines.append("")

        # Context / Reading Passage
        context_text = q_trans.parent_context_override
        if not context_text and passage:
            p_trans_res = await session.exec(
                select(PassageTranslation).where(
                    PassageTranslation.passage_id == passage.id,
                    PassageTranslation.language == q_trans.language,
                )
            )
            p_trans = p_trans_res.first()
            if p_trans:
                context_text = p_trans.passage_text

        if context_text:
            lines.append("> **Context / Reading Passage:**")
            for p_line in context_text.split("\n"):
                lines.append(f"> {p_line}")
            lines.append("")

        # Embedded Visual Assets
        if assets:
            lines.append("### Visual Diagrams / Figures")
            for asset in assets:
                asset_url = storage.get_public_url(asset.asset_path)
                asset_type_str = (
                    asset.asset_type.value
                    if hasattr(asset.asset_type, "value")
                    else str(asset.asset_type)
                )
                caption_str = f" - *{asset.caption}*" if asset.caption else ""
                lines.append(f"![{asset_type_str}]({asset_url}){caption_str}")
                lines.append("")

        # Question Statement
        lines.append("### Question Statement")
        lines.append(q_trans.question_text)
        lines.append("")

        # Options & Option Distractor Analysis
        lines.append("### Options & Option Analysis")
        options_res = await session.exec(
            select(QuestionOption)
            .where(QuestionOption.question_id == question.id)
            .order_by(col(QuestionOption.display_order))
        )
        options = options_res.all()

        correct_opt_label = None
        for opt in options:
            if opt.is_correct:
                correct_opt_label = opt.option_label

            opt_trans_res = await session.exec(
                select(OptionTranslation).where(
                    OptionTranslation.option_id == opt.id,
                    OptionTranslation.language == q_trans.language,
                )
            )
            opt_trans = opt_trans_res.first()
            opt_text = opt_trans.option_text if opt_trans else ""
            distractor = opt_trans.distractor_analysis if opt_trans else None

            correct_tag = "✅ **[CORRECT ANSWER]**" if opt.is_correct else "❌ [Distractor]"
            lines.append(f"- **Option {opt.option_label}**: {opt_text} — {correct_tag}")
            if distractor:
                lines.append(f"  > *Option Analysis:* {distractor}")

        lines.append("")
        if correct_opt_label:
            lines.append(f"**Correct Option:** `{correct_opt_label}`")
            lines.append("")

        # Fetch Explanation for this language
        expl_stmt = select(QuestionExplanation).where(
            QuestionExplanation.question_id == question.id,
            QuestionExplanation.language == lang_enum,
        )
        expl = (await session.exec(expl_stmt)).first()

        if expl:
            lines.append("### 💡 Core Concept & Detailed Explanation")
            lines.append(f"**Core Concept:** {expl.core_concept}")
            lines.append("")
            lines.append("**Detailed Step-by-Step Solution:**")
            lines.append(expl.detailed_solution)
            lines.append("")

            takeaways = _parse_json_list(expl.key_takeaways_json)
            if takeaways:
                lines.append("#### 📌 Key Takeaways")
                for tk in takeaways:
                    lines.append(f"- {tk}")
                lines.append("")

            traps = _parse_json_list(expl.common_traps_json)
            if traps:
                lines.append("#### ⚠️ Common Misconceptions & Traps")
                for tr in traps:
                    lines.append(f"- {tr}")
                lines.append("")

        lines.append("---")
        lines.append("")

    return "\n".join(lines)

