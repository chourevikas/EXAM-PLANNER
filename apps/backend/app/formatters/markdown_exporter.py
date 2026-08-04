from typing import Optional
from sqlmodel import select
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
)
from app.formatters.yaml_exporter import get_canonical_question_filename_stem


async def async_export_question_to_markdown(
    session: AsyncSession,
    question: Question,
    storage: Optional[BaseStorageProvider] = None,
) -> str:
    """Asynchronously generates Markdown string matching the exact filename stem as the YAML file."""
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
        .order_by(QuestionAsset.display_order)
    )
    assets = assets_res.all()

    # Fetch Passage if linked
    passage = (
        await session.get(Passage, question.passage_id) if question.passage_id else None
    )

    for q_trans in q_translations:
        lang_str = (
            q_trans.language.value
            if hasattr(q_trans.language, "value")
            else str(q_trans.language)
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

        # Options
        lines.append("### Options")
        options_res = await session.exec(
            select(QuestionOption)
            .where(QuestionOption.question_id == question.id)
            .order_by(QuestionOption.display_order)
        )
        options = options_res.all()

        for opt in options:
            opt_trans_res = await session.exec(
                select(OptionTranslation).where(
                    OptionTranslation.option_id == opt.id,
                    OptionTranslation.language == q_trans.language,
                )
            )
            opt_trans = opt_trans_res.first()
            opt_text = opt_trans.option_text if opt_trans else ""
            lines.append(f"- **{opt.option_label}**: {opt_text}")

        lines.append("")
        lines.append("---")
        lines.append("")

    return "\n".join(lines)
