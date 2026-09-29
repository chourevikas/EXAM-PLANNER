from typing import Dict, Any, Optional
from datetime import datetime, timezone
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models import (
    Exam,
    Question,
    QuestionOption,
    QuestionTranslation,
    OptionTranslation,
    QuestionExplanation,
    QuestionMetadata,
    QuestionHierarchyLink,
    Passage,
    PassageTranslation,
    Subtopic,
    Topic,
    Subject,
    QuestionAsset,
)
from app.storage.factory import get_storage_provider
from app.services.question_assets import serialize_question_asset
from app.config.logger import setup_logger

logger = setup_logger("ExamJsonBuilder")


class ExamJsonBuilder:
    """
    Builds and uploads standardized JSON artifacts in S3 / local storage for an Exam:
    1. Consolidated `exam_questions.json` and `exam_solutions.json`.
    2. Individual per-question JSON files in dedicated folder paths:
       - `questions_json_folder_path`: `artifacts/{exam_code}/{set}/json/questions/Q001.json`, etc.
       - `solutions_json_folder_path`: `artifacts/{exam_code}/{set}/json/solutions/Q001.json`, etc.
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self.storage = get_storage_provider()

    async def preload_batch_question_data(
        self,
        questions: list[Question],
        include_solution_data: bool = True,
        target_language: Optional[str] = "ENGLISH",
    ) -> Dict[str, Any]:
        """
        Preloads all child tables, options, translations, taxonomies, and hierarchies
        for a batch of questions in a minimal number of O(1) SQL roundtrips to eliminate N+1 queries.

        `include_solution_data=False` skips QuestionMetadata/QuestionExplanation/
        QuestionHierarchyLink entirely — these are only consumed by the `sol_card`
        half of build_single_question_cards, so callers that only need the
        question-facing `q_card` (e.g. the no-solutions bulk questions endpoint)
        can avoid those round trips altogether.
        """
        if not questions:
            return {}

        q_ids = [q.id for q in questions]

        # 1. Question Translations
        trans_res = await self.session.exec(
            select(QuestionTranslation).where(col(QuestionTranslation.question_id).in_(q_ids))
        )
        trans_map: Dict[int, list[QuestionTranslation]] = {}
        for t in trans_res.all():
            trans_map.setdefault(t.question_id, []).append(t)

        # 2. Options & Option Translations
        opt_res = await self.session.exec(
            select(QuestionOption)
            .where(col(QuestionOption.question_id).in_(q_ids))
            .order_by(col(QuestionOption.display_order).asc())
        )
        options_list = opt_res.all()
        options_map: Dict[int, list[QuestionOption]] = {}
        opt_ids = []
        for opt in options_list:
            options_map.setdefault(opt.question_id, []).append(opt)
            opt_ids.append(opt.id)

        opt_trans_map: Dict[int, list[OptionTranslation]] = {}
        if opt_ids:
            ot_res = await self.session.exec(
                select(OptionTranslation).where(col(OptionTranslation.option_id).in_(opt_ids))
            )
            for ot in ot_res.all():
                opt_trans_map.setdefault(ot.option_id, []).append(ot)

        # On-Demand Translation for Exam Attempt Questions
        from app.core.languages import normalize_language
        target_iso, target_enum = normalize_language(target_language)
        if target_enum != "ENGLISH":
            try:
                from app.db.models import LanguageCode
                from app.services.google_translation_service import GoogleTranslationService
                try:
                    lang_db_enum = LanguageCode[target_enum]
                except (KeyError, AttributeError):
                    lang_db_enum = target_enum

                missing_q = []
                for q in questions:
                    t_langs = {
                        (t.language.value if hasattr(t.language, "value") else str(t.language))
                        for t in trans_map.get(q.id, [])
                    }
                    if target_enum not in t_langs and target_iso not in t_langs:
                        eng_t = next((t for t in trans_map.get(q.id, []) if (t.language.value if hasattr(t.language, "value") else str(t.language)) == "ENGLISH"), None) or (trans_map.get(q.id, [])[0] if trans_map.get(q.id) else None)
                        text = eng_t.question_text if eng_t else (getattr(q, "question_text", None) or getattr(q, "text", ""))
                        if text and str(text).strip():
                            missing_q.append((q, str(text).strip()))

                missing_o = []
                for opt in options_list:
                    ot_langs = {
                        (ot.language.value if hasattr(ot.language, "value") else str(ot.language))
                        for ot in opt_trans_map.get(opt.id, [])
                    }
                    if target_enum not in ot_langs and target_iso not in ot_langs:
                        eng_ot = next((ot for ot in opt_trans_map.get(opt.id, []) if (ot.language.value if hasattr(ot.language, "value") else str(ot.language)) == "ENGLISH"), None) or (opt_trans_map.get(opt.id, [])[0] if opt_trans_map.get(opt.id) else None)
                        text = eng_ot.option_text if eng_ot else getattr(opt, "option_text", "")
                        if text and str(text).strip():
                            missing_o.append((opt, str(text).strip()))

                if missing_q or missing_o:
                    # Prioritize first 20 questions synchronously for instant response;
                    # offload the rest to a background task (same cap as
                    # QuestionService._ensure_translations_on_demand) so a full exam paper
                    # in a not-yet-cached language doesn't translate ~100+ texts inline.
                    if len(missing_q) > 20:
                        import asyncio
                        from app.services.question_service import QuestionService

                        sync_q_set = {q.id for q, _ in missing_q[:20]}
                        bg_q = missing_q[20:]
                        missing_q = missing_q[:20]

                        bg_o = [item for item in missing_o if item[0].question_id not in sync_q_set]
                        missing_o = [item for item in missing_o if item[0].question_id in sync_q_set]

                        if bg_q or bg_o:
                            asyncio.create_task(
                                QuestionService._bg_translate_and_persist(
                                    bg_q, bg_o, [], target_iso, lang_db_enum
                                )
                            )

                    translator = GoogleTranslationService()
                    to_persist_qt = []
                    to_persist_ot = []

                    if missing_q:
                        trans_q_texts = await translator.translate_batch(
                            [txt for _, txt in missing_q], target_language=target_iso, source_language="en"
                        )
                        for (q, _), t_txt in zip(missing_q, trans_q_texts):
                            new_qt = QuestionTranslation(
                                question_id=q.id,
                                language=lang_db_enum,
                                question_text=t_txt,
                            )
                            to_persist_qt.append(new_qt)
                            trans_map.setdefault(q.id, []).append(new_qt)

                    if missing_o:
                        trans_o_texts = await translator.translate_batch(
                            [txt for _, txt in missing_o], target_language=target_iso, source_language="en"
                        )
                        for (opt, _), t_txt in zip(missing_o, trans_o_texts):
                            new_ot = OptionTranslation(
                                option_id=opt.id,
                                language=lang_db_enum,
                                option_text=t_txt,
                            )
                            to_persist_ot.append(new_ot)
                            opt_trans_map.setdefault(opt.id, []).append(new_ot)

                    # Persist translations in an isolated database session with idempotent conflict handling
                    if to_persist_qt or to_persist_ot:
                        try:
                            from app.db.session import async_session_factory
                            from app.db.upsert import bulk_insert_on_conflict_do_nothing
                            async with async_session_factory() as trans_session:
                                if to_persist_qt:
                                    await bulk_insert_on_conflict_do_nothing(
                                        trans_session, QuestionTranslation, to_persist_qt, ["question_id", "language"]
                                    )
                                if to_persist_ot:
                                    await bulk_insert_on_conflict_do_nothing(
                                        trans_session, OptionTranslation, to_persist_ot, ["option_id", "language"]
                                    )
                                await trans_session.commit()
                        except Exception as ce:
                            logger.warning(f"Failed to persist exam on-demand translations: {ce}", exc_info=True)
            except Exception as te:
                logger.error(f"Exam on-demand translation failed: {te}", exc_info=True)

        meta_map: Dict[int, QuestionMetadata] = {}
        expl_map: Dict[int, list[QuestionExplanation]] = {}
        h_map: Dict[int, list[QuestionHierarchyLink]] = {}
        subtopic_ids = set()
        topic_ids = set()
        subject_ids = set()

        if include_solution_data:
            # 3. Question Metadata
            meta_res = await self.session.exec(
                select(QuestionMetadata).where(col(QuestionMetadata.question_id).in_(q_ids))
            )
            meta_map = {m.question_id: m for m in meta_res.all()}

            # 4. Question Explanations
            expl_res = await self.session.exec(
                select(QuestionExplanation).where(col(QuestionExplanation.question_id).in_(q_ids))
            )
            for e in expl_res.all():
                expl_map.setdefault(e.question_id, []).append(e)

            # 5. Question Hierarchy Links
            h_res = await self.session.exec(
                select(QuestionHierarchyLink).where(col(QuestionHierarchyLink.question_id).in_(q_ids))
            )
            h_links = h_res.all()

            for hl in h_links:
                h_map.setdefault(hl.question_id, []).append(hl)
                if hl.subtopic_id:
                    subtopic_ids.add(hl.subtopic_id)
                if hl.topic_id:
                    topic_ids.add(hl.topic_id)
                if hl.subject_id:
                    subject_ids.add(hl.subject_id)

        for q in questions:
            if q.subtopic_id:
                subtopic_ids.add(q.subtopic_id)

        # Diagram/picture assets (only questions flagged has_image have any)
        assets_map: Dict[int, list[QuestionAsset]] = {}
        image_q_ids = [q.id for q in questions if q.has_image]
        if image_q_ids:
            asset_res = await self.session.exec(
                select(QuestionAsset)
                .where(col(QuestionAsset.question_id).in_(image_q_ids))
                .order_by(QuestionAsset.display_order, QuestionAsset.id)
            )
            for a in asset_res.all():
                assets_map.setdefault(a.question_id, []).append(a)

        # 6. Passages & Passage Translations
        passage_ids = [getattr(q, "passage_id", None) for q in questions if getattr(q, "passage_id", None)]
        question_passage_map: Dict[int, int] = {}
        exam_ids = list(set(q.exam_id for q in questions if q.exam_id))
        if exam_ids:
            pass_res = await self.session.exec(select(Passage).where(col(Passage.exam_id).in_(exam_ids)))
            for p in pass_res.all():
                if p.question_ids_json:
                    for qid in p.question_ids_json:
                        question_passage_map[qid] = p.id
                        passage_ids.append(p.id)
        passage_ids = list(set(passage_ids))

        pass_trans_map: Dict[int, list[PassageTranslation]] = {}
        if passage_ids:
            pt_res = await self.session.exec(
                select(PassageTranslation).where(col(PassageTranslation.passage_id).in_(passage_ids))
            )
            for pt in pt_res.all():
                pass_trans_map.setdefault(pt.passage_id, []).append(pt)

        # 7. Preload Subtopics, Topics, Subjects
        subtopics_map: Dict[int, Subtopic] = {}
        if subtopic_ids:
            st_res = await self.session.exec(
                select(Subtopic).where(col(Subtopic.id).in_(subtopic_ids))
            )
            for st in st_res.all():
                subtopics_map[st.id] = st
                if st.topic_id:
                    topic_ids.add(st.topic_id)

        topics_map: Dict[int, Topic] = {}
        if topic_ids:
            top_res = await self.session.exec(
                select(Topic).where(col(Topic.id).in_(topic_ids))
            )
            for top in top_res.all():
                topics_map[top.id] = top
                if top.subject_id:
                    subject_ids.add(top.subject_id)

        subjects_map: Dict[int, Subject] = {}
        if subject_ids:
            sb_res = await self.session.exec(
                select(Subject).where(col(Subject.id).in_(subject_ids))
            )
            for sb in sb_res.all():
                subjects_map[sb.id] = sb

        return {
            "trans_map": trans_map,
            "options_map": options_map,
            "opt_trans_map": opt_trans_map,
            "meta_map": meta_map,
            "expl_map": expl_map,
            "h_map": h_map,
            "pass_trans_map": pass_trans_map,
            "question_passage_map": question_passage_map,
            "subtopics_map": subtopics_map,
            "topics_map": topics_map,
            "subjects_map": subjects_map,
            "assets_map": assets_map,
        }

    async def build_single_question_cards(
        self,
        q: Question,
        preloaded: Optional[Dict[str, Any]] = None,
        include_solution_data: bool = True,
        target_language: Optional[str] = "ENGLISH",
    ) -> tuple[Dict[str, Any], Dict[str, Any]]:
        """Constructs standardized q_card and sol_card payloads for a single Question.

        `include_solution_data=False` skips building `sol_card` (and the
        QuestionMetadata/QuestionExplanation/QuestionHierarchyLink lookups behind
        it) entirely, returning `{}` for it — for callers that only need `q_card`.
        """
        from app.core.languages import normalize_language
        target_iso, target_enum = normalize_language(target_language)

        # 1. Question Translations
        if preloaded is not None:
            trans_list = preloaded.get("trans_map", {}).get(q.id, [])
        else:
            trans_res = await self.session.exec(
                select(QuestionTranslation).where(QuestionTranslation.question_id == q.id)
            )
            trans_list = trans_res.all()

        question_translations = {}
        for t in trans_list:
            lang_str = t.language.value if hasattr(t.language, "value") else str(t.language)
            q_trans_item = {
                "question_text": t.question_text,
                "parent_context_override": t.parent_context_override,
            }
            question_translations[lang_str] = q_trans_item
            iso_c, _ = normalize_language(lang_str)
            if iso_c:
                question_translations[iso_c] = q_trans_item

        chosen_trans = next(
            (t for t in trans_list if (t.language.value if hasattr(t.language, "value") else str(t.language)) in (target_enum, target_iso)), None
        ) or next(
            (t for t in trans_list if (t.language.value if hasattr(t.language, "value") else str(t.language)) == "ENGLISH"), None
        ) or (trans_list[0] if trans_list else None)
        q_text = chosen_trans.question_text if chosen_trans else f"Question #{q.question_number_in_paper}"

        # 2. Passage Translations
        passage_text = None
        passage_translations = {}
        q_pass_id = getattr(q, "passage_id", None)
        if not q_pass_id and q.id:
            if preloaded is not None and "question_passage_map" in preloaded:
                q_pass_id = preloaded["question_passage_map"].get(q.id)
            elif q.exam_id:
                pass_res = await self.session.exec(
                    select(Passage).where(Passage.exam_id == q.exam_id)
                )
                for p in pass_res.all():
                    if p.question_ids_json and q.id in p.question_ids_json:
                        q_pass_id = p.id
                        break
        if q_pass_id:
            if preloaded is not None:
                pass_trans_list = preloaded.get("pass_trans_map", {}).get(q_pass_id, [])
            else:
                pass_res = await self.session.exec(
                    select(PassageTranslation).where(PassageTranslation.passage_id == q_pass_id)
                )
                pass_trans_list = pass_res.all()

            for pt in pass_trans_list:
                lang_str = pt.language.value if hasattr(pt.language, "value") else str(pt.language)
                passage_translations[lang_str] = pt.passage_text

            chosen_pt = next(
                (pt for pt in pass_trans_list if (pt.language.value if hasattr(pt.language, "value") else str(pt.language)) in (target_enum, target_iso)), None
            ) or next(
                (pt for pt in pass_trans_list if (pt.language.value if hasattr(pt.language, "value") else str(pt.language)) == "ENGLISH"), None
            ) or (pass_trans_list[0] if pass_trans_list else None)
            if chosen_pt:
                passage_text = chosen_pt.passage_text

        # 3. Taxonomy
        if preloaded is not None:
            subtopic = preloaded.get("subtopics_map", {}).get(q.subtopic_id) if q.subtopic_id else None
            topic = preloaded.get("topics_map", {}).get(subtopic.topic_id) if subtopic and subtopic.topic_id else None
            subject = preloaded.get("subjects_map", {}).get(topic.subject_id) if topic and topic.subject_id else None
        else:
            subtopic = await self.session.get(Subtopic, q.subtopic_id) if q.subtopic_id else None
            topic = await self.session.get(Topic, subtopic.topic_id) if subtopic and subtopic.topic_id else None
            subject = await self.session.get(Subject, topic.subject_id) if topic and topic.subject_id else None

        subj_name = subject.name if subject else "General Knowledge"
        top_name = topic.name if topic else "General Studies"
        sub_name = subtopic.name if subtopic else "Core Concepts"

        # 4. Multi-Concept Hierarchy (sol_card only — skipped when include_solution_data=False)
        hierarchy_concepts = []
        if include_solution_data:
            if preloaded is not None:
                h_links = preloaded.get("h_map", {}).get(q.id, [])
            else:
                h_stmt = select(QuestionHierarchyLink).where(
                    QuestionHierarchyLink.question_id == q.id
                )
                h_links = (await self.session.exec(h_stmt)).all()

            for hl in h_links:
                subtop_freq = 0
                subtop_name = None
                topic_name = None
                subj_name_l = None
                if hl.subtopic_id:
                    if preloaded is not None:
                        subtop = preloaded.get("subtopics_map", {}).get(hl.subtopic_id)
                        if subtop:
                            subtop_name = subtop.name
                            subtop_freq = subtop.pyq_frequency
                            top = preloaded.get("topics_map", {}).get(subtop.topic_id) if subtop.topic_id else None
                            if top:
                                topic_name = top.name
                                subj = preloaded.get("subjects_map", {}).get(top.subject_id) if top.subject_id else None
                                if subj:
                                    subj_name_l = subj.name
                    else:
                        subtop = await self.session.get(Subtopic, hl.subtopic_id)
                        if subtop:
                            subtop_name = subtop.name
                            subtop_freq = subtop.pyq_frequency
                            top = await self.session.get(Topic, subtop.topic_id)
                            if top:
                                topic_name = top.name
                                subj = await self.session.get(Subject, top.subject_id)
                                if subj:
                                    subj_name_l = subj.name

                hierarchy_concepts.append({
                    "subject": subj_name_l or subj_name,
                    "topic": topic_name or top_name,
                    "subtopic": subtop_name or sub_name,
                    "subject_id": str(hl.subject_id) if hl.subject_id else None,
                    "topic_id": str(hl.topic_id) if hl.topic_id else None,
                    "subtopic_id": str(hl.subtopic_id) if hl.subtopic_id else None,
                    "is_primary": hl.is_primary,
                    "relevance_weight": hl.relevance_weight,
                    "concept_name": hl.concept_name,
                    "subtopic_pyq_frequency": subtop_freq,
                })

        # 5. Options
        if preloaded is not None:
            options = preloaded.get("options_map", {}).get(q.id, [])
        else:
            opt_res = await self.session.exec(
                select(QuestionOption)
                .where(QuestionOption.question_id == q.id)
                .order_by(col(QuestionOption.display_order).asc())
            )
            options = opt_res.all()

        public_options = []
        correct_option_id = None
        correct_option_label = "A"
        distractor_scores = {}

        for opt in options:
            if preloaded is not None:
                opt_trans_list = preloaded.get("opt_trans_map", {}).get(opt.id, [])
            else:
                opt_trans_res = await self.session.exec(
                    select(OptionTranslation).where(OptionTranslation.option_id == opt.id)
                )
                opt_trans_list = opt_trans_res.all()

            opt_translations = {}
            opt_distractor_analyses = {}
            for ot in opt_trans_list:
                lang_str = ot.language.value if hasattr(ot.language, "value") else str(ot.language)
                opt_translations[lang_str] = ot.option_text
                iso_c, _ = normalize_language(lang_str)
                if iso_c:
                    opt_translations[iso_c] = ot.option_text
                if ot.distractor_analysis:
                    opt_distractor_analyses[lang_str] = ot.distractor_analysis

            chosen_opt_trans = next(
                (t for t in opt_trans_list if (t.language.value if hasattr(t.language, "value") else str(t.language)) in (target_enum, target_iso)), None
            ) or next(
                (t for t in opt_trans_list if (t.language.value if hasattr(t.language, "value") else str(t.language)) == "ENGLISH"), None
            ) or (opt_trans_list[0] if opt_trans_list else None)

            opt_text = chosen_opt_trans.option_text if chosen_opt_trans else f"Option {opt.option_label}"
            eng_analysis = chosen_opt_trans.distractor_analysis if chosen_opt_trans else None

            hi_opt_txt = opt_translations.get("HINDI") or opt_translations.get("hi")
            public_options.append({
                "option_id": str(opt.id),
                "option_label": opt.option_label,
                "text": opt_text,
                "text_hindi": hi_opt_txt,
                "translations": opt_translations,
                "display_order": opt.display_order,
            })

            if opt.is_correct:
                correct_option_id = str(opt.id)
                correct_option_label = opt.option_label

            distractor_scores[str(opt.id)] = {
                "label": opt.option_label,
                "closeness_score": opt.closeness_score,
                "is_correct": opt.is_correct,
                "distractor_analysis": eng_analysis,
                "distractor_analysis_translations": opt_distractor_analyses,
            }

        # 6 & 7. Metadata & Explanations (sol_card only — skipped when include_solution_data=False)
        blooms_level = "ANALYZE"
        cognitive_skill = "Conceptual Reasoning"
        primary_concept_tag = None
        irt_a, irt_b, irt_c = 1.50, 0.00, 0.25
        explanation_translations = {}
        default_expl_dict = {
            "core_concept": "Core concept analysis",
            "detailed_solution": "Detailed solution breakdown",
            "common_traps": [],
            "key_takeaways": [],
        }

        if include_solution_data:
            if preloaded is not None:
                q_meta = preloaded.get("meta_map", {}).get(q.id)
            else:
                meta_res = await self.session.exec(
                    select(QuestionMetadata).where(QuestionMetadata.question_id == q.id)
                )
                q_meta = meta_res.first()

            blooms_level = (q_meta.blooms_level.value if hasattr(q_meta.blooms_level, "value") else str(q_meta.blooms_level)) if (q_meta and q_meta.blooms_level) else "ANALYZE"
            cognitive_skill = q_meta.cognitive_skill if q_meta and q_meta.cognitive_skill else "Conceptual Reasoning"
            primary_concept_tag = q_meta.primary_concept_tag if q_meta and q_meta.primary_concept_tag else None
            irt_a = q_meta.irt_discrimination_a if (q_meta and q_meta.irt_discrimination_a is not None) else 1.50
            irt_b = q_meta.irt_difficulty_b if (q_meta and q_meta.irt_difficulty_b is not None) else 0.00
            irt_c = q_meta.irt_pseudo_guessing_c if (q_meta and q_meta.irt_pseudo_guessing_c is not None) else 0.25

            if preloaded is not None:
                expl_list = preloaded.get("expl_map", {}).get(q.id, [])
            else:
                expl_res = await self.session.exec(
                    select(QuestionExplanation).where(QuestionExplanation.question_id == q.id)
                )
                expl_list = expl_res.all()

            for q_expl in expl_list:
                lang_str = q_expl.language.value if hasattr(q_expl.language, "value") else str(q_expl.language)
                explanation_translations[lang_str] = {
                    "core_concept": q_expl.core_concept,
                    "detailed_solution": q_expl.detailed_solution,
                    "common_traps": q_expl.common_traps_json or [],
                    "key_takeaways": q_expl.key_takeaways_json or [],
                }

            eng_expl = next(
                (e for e in expl_list if (e.language.value if hasattr(e.language, "value") else str(e.language)) == "ENGLISH"), None
            ) or (expl_list[0] if expl_list else None)

            default_expl_dict = {
                "core_concept": eng_expl.core_concept if eng_expl else "Core concept analysis",
                "detailed_solution": eng_expl.detailed_solution if eng_expl else "Detailed solution breakdown",
                "common_traps": eng_expl.common_traps_json if (eng_expl and eng_expl.common_traps_json) else [],
                "key_takeaways": eng_expl.key_takeaways_json if (eng_expl and eng_expl.key_takeaways_json) else [],
            }

        hindi_item = question_translations.get("HINDI") or question_translations.get("hi")
        q_hi_text = hindi_item.get("question_text") if isinstance(hindi_item, dict) else (hindi_item if isinstance(hindi_item, str) else None)

        if preloaded is not None:
            q_assets = preloaded.get("assets_map", {}).get(q.id, [])
        elif q.has_image:
            q_assets = (await self.session.exec(
                select(QuestionAsset)
                .where(QuestionAsset.question_id == q.id)
                .order_by(QuestionAsset.display_order, QuestionAsset.id)
            )).all()
        else:
            q_assets = []

        q_card = {
            "question_id": str(q.id),
            "question_number": q.question_number_in_paper,
            "section_code": q.section_code,
            "text": q_text,
            "text_hindi": q_hi_text,
            "translations": question_translations,
            "difficulty": q.difficulty.value if hasattr(q.difficulty, 'value') else str(q.difficulty),
            "marks": q.marks,
            "negative_marks": q.negative_marks,
            "expected_time_seconds": q.expected_time_seconds,
            "question_type": q.question_type,
            "has_image": q.has_image,
            "assets": [serialize_question_asset(a) for a in q_assets if a.asset_path],
            "passage_text": passage_text,
            "passage_translations": passage_translations,
            "subject": subj_name,
            "topic": top_name,
            "subtopic": sub_name,
            "options": public_options,
        }

        sol_card = {} if not include_solution_data else {
            "question_id": str(q.id),
            "question_number": q.question_number_in_paper,
            "correct_option_id": correct_option_id,
            "correct_option_label": correct_option_label,
            "difficulty": q.difficulty.value if hasattr(q.difficulty, 'value') else str(q.difficulty),
            "blooms_level": blooms_level,
            "cognitive_skill": cognitive_skill,
            "primary_concept_tag": primary_concept_tag,
            "irt_params": {
                "a": irt_a,
                "b": irt_b,
                "c": irt_c,
            },
            "subject": subj_name,
            "topic": top_name,
            "subtopic": sub_name,
            "concepts": hierarchy_concepts,
            "explanation": default_expl_dict,
            "explanation_translations": explanation_translations,
            "distractor_scores": distractor_scores,
        }

        return q_card, sol_card

    async def delete_single_question_artifacts(
        self, exam_code: str, paper_set_code: Optional[str], question_number: int
    ) -> bool:
        """
        Deletes the individual question and solution artifact references in real-time.
        """
        try:
            logger.info(
                f"[DB_DIRECT_DELETE] Deleted question & solution #{question_number} "
                f"references for exam '{exam_code}'."
            )
            return True
        except Exception as err:
            logger.warning(f"[DB_DIRECT_DELETE] Failed deleting question #{question_number} references: {err}")
            return False

    async def generate_and_upload(
        self,
        exam_id: int,
        sync_all: bool = False,
        sync_target: str = "MASTERS_ONLY",
    ) -> Dict[str, Any]:
        """
        Consolidated generation & upload:
        - sync_target == "QUESTIONS_MASTER": Generates and uploads only master exam_questions.json.
        - sync_target == "SOLUTIONS_MASTER": Generates and uploads only master exam_solutions.json.
        - sync_target == "MASTERS_ONLY": Generates and uploads both master exam_questions.json and exam_solutions.json (default).
        - sync_target == "FULL_ALL" or sync_all=True: Generates and uploads both master JSONs + all individual Q{num}.json files.
        """
        import time
        start_time = time.perf_counter()

        if sync_all:
            sync_target = "FULL_ALL"

        scope_name = (
            "Full S3 Sync (Master + All Individual Q Files)"
            if sync_target == "FULL_ALL"
            else "Master Solutions JSON Sync"
            if sync_target == "SOLUTIONS_MASTER"
            else "Master Questions JSON Sync"
            if sync_target == "QUESTIONS_MASTER"
            else "Master Questions & Solutions Sync"
        )

        exam = await self.session.get(Exam, exam_id)
        if not exam:
            logger.error(f"[S3_SYNC] Exam with ID '{exam_id}' not found in database.")
            raise ValueError(f"Exam with ID '{exam_id}' not found.")

        logger.info(
            f"🔄 [S3_SYNC_START] Starting '{scope_name}' for exam '{exam.code}' (ID: {exam_id}, Year: {exam.source_year}, Set: {exam.paper_set_code})"
        )

        # Fetch questions ordered by paper number
        stmt = (
            select(Question)
            .where(Question.exam_id == exam_id, Question.status != "REJECTED")
            .order_by(col(Question.question_number_in_paper))
        )
        res = await self.session.exec(stmt)
        questions = res.all()

        if not questions:
            logger.warning(f"[S3_SYNC] Exam '{exam.code}' has 0 questions in database. Skipping JSON generation.")
            return {}

        total_q = len(questions)
        logger.info(f"📋 [S3_SYNC] Loaded {total_q} questions from database for exam '{exam.code}'")

        exam_code = exam.code
        paper_set = exam.paper_set_code or "SET_A"
        clean_set = str(paper_set).strip().lower().replace("_", "-")

        questions_folder_rel = f"artifacts/{exam_code}/{clean_set}/json/questions"
        solutions_folder_rel = f"artifacts/{exam_code}/{clean_set}/json/solutions"

        questions_payload = []
        solutions_payload = []

        card_build_start = time.perf_counter()
        preloaded_data = await self.preload_batch_question_data(questions)
        for idx, q in enumerate(questions, start=1):
            q_card, sol_card = await self.build_single_question_cards(q, preloaded=preloaded_data)
            questions_payload.append(q_card)
            solutions_payload.append(sol_card)


        card_build_duration = time.perf_counter() - card_build_start
        logger.info(
            f"📦 [DB_JSON_BUILDER] Generated {len(questions_payload)} question & solution cards in {card_build_duration:.2f}s"
        )

        now_utc = datetime.now(timezone.utc)
        result_payload: Dict[str, Any] = {
            "exam_id": str(exam.id),
            "exam_code": exam.code,
            "sync_target": sync_target,
            "last_synced_at": now_utc.isoformat(),
            "total_questions": total_q,
        }

        # 1. Master Questions JSON & Database Sync
        if sync_target in ("MASTERS_ONLY", "QUESTIONS_MASTER", "FULL_ALL", "ALL"):
            exam.questions_json_folder_path = questions_folder_rel
            result_payload["questions_json_folder_path"] = questions_folder_rel

        # 2. Master Solutions JSON & In-Memory Sliding Cache Priming
        if sync_target in ("MASTERS_ONLY", "SOLUTIONS_MASTER", "FULL_ALL", "ALL"):
            solutions_doc = {
                "exam_id": str(exam.id),
                "exam_code": exam.code,
                "generated_at": now_utc.isoformat(),
                "questions": solutions_payload,
            }
            exam.solutions_json_folder_path = solutions_folder_rel
            result_payload["solutions_json_folder_path"] = solutions_folder_rel

            # Prime sliding memory cache directly from DB
            from app.engine.post_submission_pipeline import set_cached_solutions_data
            set_cached_solutions_data(exam.code, solutions_doc)
            logger.info(f"   - DB Solutions Master: '{exam.code}' (Sliding Cache Primed with {len(solutions_payload)} questions)")

        exam.last_synced_at = now_utc
        self.session.add(exam)
        await self.session.commit()

        total_duration = time.perf_counter() - start_time
        result_payload["duration_seconds"] = round(total_duration, 2)
        logger.info(
            f"✅ [S3_SYNC_COMPLETE] Successfully executed '{scope_name}' for exam '{exam.code}' in {total_duration:.2f}s!"
        )
        return result_payload
