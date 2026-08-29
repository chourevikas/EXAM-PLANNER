import json
import uuid
from typing import Dict, Any, Optional, List
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
    Subtopic,
)
from app.db.models.enums import LanguageCode


async def preload_questions_export_data(
    session: AsyncSession, questions: List[Question]
) -> Dict[str, Any]:
    """
    Preloads all child tables, options, translations, taxonomies, and hierarchies
    for a batch of questions in a minimal number of O(1) SQL roundtrips.
    """
    if not questions:
        return {}

    q_ids = [q.id for q in questions]

    # 1. Question Translations
    trans_res = await session.exec(
        select(QuestionTranslation).where(col(QuestionTranslation.question_id).in_(q_ids))
    )
    trans_map: Dict[uuid.UUID, List[QuestionTranslation]] = {}
    for t in trans_res.all():
        trans_map.setdefault(t.question_id, []).append(t)

    # 2. Options & Option Translations
    opt_res = await session.exec(
        select(QuestionOption)
        .where(col(QuestionOption.question_id).in_(q_ids))
        .order_by(col(QuestionOption.display_order).asc())
    )
    options_map: Dict[uuid.UUID, List[QuestionOption]] = {}
    opt_ids = []
    for opt in opt_res.all():
        options_map.setdefault(opt.question_id, []).append(opt)
        opt_ids.append(opt.id)

    opt_trans_map: Dict[uuid.UUID, List[OptionTranslation]] = {}
    if opt_ids:
        ot_res = await session.exec(
            select(OptionTranslation).where(col(OptionTranslation.option_id).in_(opt_ids))
        )
        for ot in ot_res.all():
            opt_trans_map.setdefault(ot.option_id, []).append(ot)

    # 3. Question Explanations
    expl_res = await session.exec(
        select(QuestionExplanation).where(
            col(QuestionExplanation.question_id).in_(q_ids),
            QuestionExplanation.language == LanguageCode.ENGLISH,
        )
    )
    expl_map: Dict[uuid.UUID, QuestionExplanation] = {
        e.question_id: e for e in expl_res.all()
    }

    # 4. Question Metadata
    meta_res = await session.exec(
        select(QuestionMetadata).where(col(QuestionMetadata.question_id).in_(q_ids))
    )
    meta_map: Dict[uuid.UUID, QuestionMetadata] = {
        m.question_id: m for m in meta_res.all()
    }

    # 5. Assets
    asset_res = await session.exec(
        select(QuestionAsset)
        .where(col(QuestionAsset.question_id).in_(q_ids))
        .order_by(col(QuestionAsset.display_order).asc())
    )
    assets_map: Dict[uuid.UUID, List[QuestionAsset]] = {}
    for a in asset_res.all():
        assets_map.setdefault(a.question_id, []).append(a)

    # 6. Hierarchy Links & Subtopics
    h_res = await session.exec(
        select(QuestionHierarchyLink).where(col(QuestionHierarchyLink.question_id).in_(q_ids))
    )
    h_map: Dict[uuid.UUID, List[QuestionHierarchyLink]] = {}
    subtopic_ids = set()
    for hl in h_res.all():
        h_map.setdefault(hl.question_id, []).append(hl)
        if hl.subtopic_id:
            subtopic_ids.add(hl.subtopic_id)

    subtopics_map: Dict[uuid.UUID, Subtopic] = {}
    if subtopic_ids:
        st_res = await session.exec(
            select(Subtopic).where(col(Subtopic.id).in_(subtopic_ids))
        )
        for st in st_res.all():
            subtopics_map[st.id] = st

    # 7. Passages & Passage Translations
    passage_ids = [q.passage_id for q in questions if q.passage_id]
    passages_map: Dict[uuid.UUID, Passage] = {}
    pass_trans_map: Dict[uuid.UUID, List[PassageTranslation]] = {}
    if passage_ids:
        p_res = await session.exec(
            select(Passage).where(col(Passage.id).in_(passage_ids))
        )
        for p in p_res.all():
            passages_map[p.id] = p
        pt_res = await session.exec(
            select(PassageTranslation).where(col(PassageTranslation.passage_id).in_(passage_ids))
        )
        for pt in pt_res.all():
            pass_trans_map.setdefault(pt.passage_id, []).append(pt)

    return {
        "trans_map": trans_map,
        "options_map": options_map,
        "opt_trans_map": opt_trans_map,
        "expl_map": expl_map,
        "meta_map": meta_map,
        "assets_map": assets_map,
        "h_map": h_map,
        "subtopics_map": subtopics_map,
        "passages_map": passages_map,
        "pass_trans_map": pass_trans_map,
    }


async def async_export_question_to_json_dict(
    session: AsyncSession,
    question: Question,
    exam: Optional[Exam] = None,
    preloaded: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Export a question record and all related entities into a clean, complete JSON dictionary
    designed for high-performance frontend rendering without expensive DB queries.
    """
    if not exam and question.exam_id:
        exam = await session.get(Exam, question.exam_id)

    # 1. Question Translations
    if preloaded is not None:
        trans_list = preloaded.get("trans_map", {}).get(question.id, [])
    else:
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
    if preloaded is not None:
        options_list = preloaded.get("options_map", {}).get(question.id, [])
    else:
        opt_stmt = select(QuestionOption).where(
            QuestionOption.question_id == question.id
        ).order_by(col(QuestionOption.display_order))
        options_list = (await session.exec(opt_stmt)).all()

    options_payload = []
    for opt in options_list:
        if preloaded is not None:
            o_translations = preloaded.get("opt_trans_map", {}).get(opt.id, [])
        else:
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
    if preloaded is not None:
        expl = preloaded.get("expl_map", {}).get(question.id)
    else:
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
    if preloaded is not None:
        q_meta = preloaded.get("meta_map", {}).get(question.id)
    else:
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
    if preloaded is not None:
        assets = preloaded.get("assets_map", {}).get(question.id, [])
    else:
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
    if preloaded is not None:
        h_links = preloaded.get("h_map", {}).get(question.id, [])
    else:
        h_stmt = select(QuestionHierarchyLink).where(
            QuestionHierarchyLink.question_id == question.id
        )
        h_links = (await session.exec(h_stmt)).all()

    hierarchy_payload = []
    for hl in h_links:
        subtop_freq = 0
        if hl.subtopic_id:
            if preloaded is not None:
                subtop = preloaded.get("subtopics_map", {}).get(hl.subtopic_id)
            else:
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
        if preloaded is not None:
            p_obj = preloaded.get("passages_map", {}).get(question.passage_id)
            p_trans = preloaded.get("pass_trans_map", {}).get(question.passage_id, [])
        else:
            p_obj = await session.get(Passage, question.passage_id)
            if p_obj:
                pt_stmt = select(PassageTranslation).where(
                    PassageTranslation.passage_id == p_obj.id
                )
                p_trans = (await session.exec(pt_stmt)).all()
            else:
                p_trans = []

        if p_obj:
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
    preloaded: Optional[Dict[str, Any]] = None,
) -> str:
    """Exports question entity into clean formatted JSON string."""
    data = await async_export_question_to_json_dict(session, question, exam, preloaded=preloaded)
    return json.dumps(data, indent=2, ensure_ascii=False)

