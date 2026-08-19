import json
import uuid
from typing import Dict, Any, Optional
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession
from app.db.models import (
    Exam,
    Question,
    QuestionTranslation,
    QuestionOption,
    OptionTranslation,
    QuestionExplanation,
    QuestionMetadata,
    QuestionAsset,
    QuestionHierarchyLink,
    Passage,
    PassageTranslation,
)
from app.db.models.enums import LanguageCode


async def async_export_question_to_json_dict(
    session: AsyncSession,
    question: Question,
    exam: Optional[Exam] = None,
) -> Dict[str, Any]:
    """
    Export a question record and all related entities into a clean, complete JSON dictionary
    designed for high-performance frontend rendering without expensive DB queries.
    """
    if not exam and question.exam_id:
        exam = await session.get(Exam, question.exam_id)

    # 1. Question Translations
    trans_stmt = select(QuestionTranslation).where(
        QuestionTranslation.question_id == question.id
    )
    trans_list = (await session.exec(trans_stmt)).all()
    translations_dict = {}
    for t in trans_list:
        lang_str = t.language.value if hasattr(t.language, "value") else str(t.language)
        translations_dict[lang_str] = {
            "question_text": t.question_text,
            "parent_context_override": t.parent_context_override,
        }

    # 2. Options & Option Translations (including distractor analysis)
    opt_stmt = select(QuestionOption).where(
        QuestionOption.question_id == question.id
    ).order_by(col(QuestionOption.display_order))
    options_list = (await session.exec(opt_stmt)).all()
    options_payload = []

    for opt in options_list:
        ot_stmt = select(OptionTranslation).where(
            OptionTranslation.option_id == opt.id
        )
        o_translations = (await session.exec(ot_stmt)).all()
        opt_trans_dict = {}
        for ot in o_translations:
            lang_str = (
                ot.language.value if hasattr(ot.language, "value") else str(ot.language)
            )
            opt_trans_dict[lang_str] = {
                "option_text": ot.option_text,
                "distractor_analysis": ot.distractor_analysis,
            }

        options_payload.append(
            {
                "option_id": str(opt.id),
                "option_label": opt.option_label,
                "display_order": opt.display_order,
                "is_correct": opt.is_correct,
                "closeness_score": opt.closeness_score,
                "is_complete": opt.is_complete,
                "translations": opt_trans_dict,
            }
        )

    # 3. Question Explanation (English canonical)
    expl_stmt = select(QuestionExplanation).where(
        QuestionExplanation.question_id == question.id,
        QuestionExplanation.language == LanguageCode.ENGLISH,
    )
    expl = (await session.exec(expl_stmt)).first()
    explanation_payload = None
    if expl:
        explanation_payload = {
            "core_concept": expl.core_concept,
            "detailed_solution": expl.detailed_solution,
            "common_traps": expl.common_traps_json or [],
            "key_takeaways": expl.key_takeaways_json or [],
        }

    # 4. Question Metadata & IRT Parameters
    meta_stmt = select(QuestionMetadata).where(
        QuestionMetadata.question_id == question.id
    )
    q_meta = (await session.exec(meta_stmt)).first()
    metadata_payload = None
    if q_meta:
        metadata_payload = {
            "blooms_level": q_meta.blooms_level.value
            if hasattr(q_meta.blooms_level, "value")
            else str(q_meta.blooms_level),
            "cognitive_skill": q_meta.cognitive_skill,
            "primary_concept_tag": q_meta.primary_concept_tag,
            "irt_discrimination_a": q_meta.irt_discrimination_a,
            "irt_difficulty_b": q_meta.irt_difficulty_b,
            "irt_pseudo_guessing_c": q_meta.irt_pseudo_guessing_c,
        }

    # 5. Question Assets
    asset_stmt = select(QuestionAsset).where(
        QuestionAsset.question_id == question.id
    ).order_by(col(QuestionAsset.display_order))
    assets = (await session.exec(asset_stmt)).all()
    assets_payload = [
        {
            "asset_id": str(a.id),
            "asset_path": a.asset_path,
            "asset_type": a.asset_type.value
            if hasattr(a.asset_type, "value")
            else str(a.asset_type),
            "caption": a.caption,
            "display_order": a.display_order,
        }
        for a in assets
    ]

    # 6. Hierarchy Links & Concept PYQ Frequency
    h_stmt = select(QuestionHierarchyLink).where(
        QuestionHierarchyLink.question_id == question.id
    )
    h_links = (await session.exec(h_stmt)).all()
    hierarchy_payload = []
    for hl in h_links:
        subtop_freq = 0
        if hl.subtopic_id:
            from app.db.models import Subtopic
            subtop = await session.get(Subtopic, hl.subtopic_id)
            if subtop:
                subtop_freq = subtop.pyq_frequency

        hierarchy_payload.append(
            {
                "subject_id": str(hl.subject_id) if hl.subject_id else None,
                "topic_id": str(hl.topic_id) if hl.topic_id else None,
                "subtopic_id": str(hl.subtopic_id) if hl.subtopic_id else None,
                "is_primary": hl.is_primary,
                "relevance_weight": hl.relevance_weight,
                "concept_name": hl.concept_name,
                "subtopic_pyq_frequency": subtop_freq,
            }
        )

    # 7. Passage payload if linked
    passage_payload = None
    if question.passage_id:
        p_obj = await session.get(Passage, question.passage_id)
        if p_obj:
            pt_stmt = select(PassageTranslation).where(
                PassageTranslation.passage_id == p_obj.id
            )
            p_trans = (await session.exec(pt_stmt)).all()
            p_trans_dict = {}
            for pt in p_trans:
                lang_str = (
                    pt.language.value
                    if hasattr(pt.language, "value")
                    else str(pt.language)
                )
                p_trans_dict[lang_str] = pt.passage_text

            passage_payload = {
                "passage_id": str(p_obj.id),
                "section_code": p_obj.section_code,
                "memory_type": p_obj.memory_type.value
                if hasattr(p_obj.memory_type, "value")
                else str(p_obj.memory_type),
                "is_complete": p_obj.is_complete,
                "page_numbers": p_obj.page_numbers_json or [],
                "translations": p_trans_dict,
            }

    return {
        "question_id": str(question.id),
        "canonical_question_id": str(question.canonical_question_id)
        if question.canonical_question_id
        else str(question.id),
        "exam_id": str(question.exam_id) if question.exam_id else None,
        "exam_code": exam.code if exam else "EXAM",
        "exam_type": exam.exam_type.value if (exam and hasattr(exam.exam_type, "value")) else "PYQ",
        "paper_set_code": question.paper_set_code,
        "printed_question_number": question.question_number_in_paper,
        "section_code": question.section_code,
        "question_type": question.question_type,
        "difficulty": question.difficulty.value
        if hasattr(question.difficulty, "value")
        else str(question.difficulty),
        "marks": question.marks,
        "negative_marks": question.negative_marks,
        "expected_time_seconds": question.expected_time_seconds,
        "source_type": question.source_type.value
        if hasattr(question.source_type, "value")
        else str(question.source_type),
        "source_year": question.source_year,
        "status": question.status.value
        if hasattr(question.status, "value")
        else str(question.status),
        "is_complete": question.is_complete,
        "has_image": question.has_image,
        "page_numbers": question.page_numbers_json or [],
        "passage": passage_payload,
        "translations": translations_dict,
        "options": options_payload,
        "explanation": explanation_payload,
        "metadata": metadata_payload,
        "hierarchy": hierarchy_payload,
        "assets": assets_payload,
    }


async def async_export_question_to_json_string(
    session: AsyncSession,
    question: Question,
    exam: Optional[Exam] = None,
) -> str:
    """Exports question entity into clean formatted JSON string."""
    data = await async_export_question_to_json_dict(session, question, exam)
    return json.dumps(data, indent=2, ensure_ascii=False)
