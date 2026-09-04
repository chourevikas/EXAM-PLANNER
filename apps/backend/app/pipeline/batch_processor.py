import io
import json
import uuid
from typing import Dict, List, Optional, Tuple, Any
from sqlmodel import select, col
from PIL import Image

from app.config.logger import setup_logger
from app.db.models import (
    Exam,
    OptionTranslation,
    Question,
    QuestionAsset,
    QuestionMetadata,
    QuestionOption,
    QuestionStatus,
    QuestionTranslation,
    QuestionExplanation,
    QuestionOptionReasoning,
    HumanReviewTask,
    SyllabusVersion,
    Subject,
    Topic,
    Subtopic,
    QuestionHierarchyLink,
)
from app.db.models.enums import BloomsLevel, LanguageCode, AssetType
from app.config.settings import get_settings
from app.db.session import managed_async_session
from app.pipeline.batch_schema import BatchProcessingSummary
from app.pipeline.dsu_stitcher import async_crop_and_save_asset
from app.pipeline.regex_question_parser import QuestionRecord
from app.pipeline.state import PageExtractionPayload
from app.storage.base import BaseStorageProvider

logger = setup_logger("BatchProcessor")


def calculate_question_expected_time(
    q_type: str,
    has_image: bool,
    has_passage: bool,
    translations: dict,
) -> int:
    """Calculates baseline expected time in seconds for a question based on word counts and visual elements."""
    base_seconds = 54
    max_words = 0
    for t_info in translations.values():
        words = len(t_info.get("text", "").split())
        for opt in t_info.get("options", []):
            words += len(getattr(opt, "option_text", "").split())
        max_words = max(max_words, words)

    if max_words > 120:
        base_seconds += 30
    elif max_words > 60:
        base_seconds += 15

    if has_passage or has_image:
        base_seconds += 30

    if q_type in ("MATCH_PAIR", "STATEMENT_CHECK", "MULTI_CHOICE"):
        base_seconds += 20

    return min(max(base_seconds, 30), 180)


def _merge_question_item_into_registry(
    question_registry: dict, target_key: Tuple[str, int], p_num: int, q_item: Any
):
    """Helper to merge an unnumbered fragment or continuation item into an existing question record."""
    if p_num not in question_registry[target_key]["page_numbers"]:
        question_registry[target_key]["page_numbers"].append(p_num)
    question_registry[target_key]["assets"].extend(q_item.assets)

    for t in q_item.translations:
        lang = t.language.value if hasattr(t.language, "value") else str(t.language)
        if lang in question_registry[target_key]["translations"]:
            if (
                t.question_text
                and t.question_text not in question_registry[target_key]["translations"][lang]["text"]
            ):
                question_registry[target_key]["translations"][lang]["text"] += "\n" + t.question_text
            existing_opts = question_registry[target_key]["translations"][lang]["options"]
            for new_opt in t.options:
                if not any(o.display_order == new_opt.display_order for o in existing_opts):
                    existing_opts.append(new_opt)
        else:
            question_registry[target_key]["translations"][lang] = {
                "text": t.question_text,
                "context": t.parent_context_override or "",
                "options": t.options,
            }


def build_question_registry(
    results: List[Tuple[int, Optional[PageExtractionPayload], Optional[str]]],
) -> Dict[Tuple[str, int], dict]:
    """
    Aggregates per-page extracted questions into a unified Question Registry,
    handling cross-page continuation fragments, translation merging, and sequence lookahead.
    """
    question_registry: Dict[Tuple[str, int], dict] = {}

    all_extracted_items: List[Tuple[int, Any]] = []
    for p_num, payload, err in sorted(results, key=lambda x: x[0]):
        if not payload or not payload.extracted_questions:
            continue
        for q_item in payload.extracted_questions:
            all_extracted_items.append((p_num, q_item))

    num_items = len(all_extracted_items)

    for idx, (p_num, q_item) in enumerate(all_extracted_items):
        sec_code = q_item.section_code or "DEFAULT"
        q_num = q_item.printed_question_number

        # 1. Continuation Fragment Stitching: merge if q_num matches target_parent_question_number
        if (
            q_item.is_continuation_fragment
            and q_item.target_parent_question_number is not None
            and (q_num is None or q_num == q_item.target_parent_question_number)
        ):
            parent_sec = q_item.target_parent_section_code or sec_code
            parent_q = q_item.target_parent_question_number
            target_key = (parent_sec, parent_q)

            if target_key in question_registry:
                _merge_question_item_into_registry(question_registry, target_key, p_num, q_item)
                continue

        # 2. Sequence Lookahead for Unnumbered Fragment (q_num is None)
        if q_num is None:
            last_known_q_num = None
            for prev_idx in range(idx - 1, -1, -1):
                if all_extracted_items[prev_idx][1].printed_question_number is not None:
                    last_known_q_num = all_extracted_items[prev_idx][1].printed_question_number
                    break

            next_known_q_num = None
            for next_idx in range(idx + 1, num_items):
                if all_extracted_items[next_idx][1].printed_question_number is not None:
                    next_known_q_num = all_extracted_items[next_idx][1].printed_question_number
                    break

            if last_known_q_num is not None and next_known_q_num is not None:
                # Check if item is a passage or direction header for the upcoming question (e.g. Q6)
                is_upcoming_passage = any(
                    bool(t.direction_header)
                    or (
                        t.question_text
                        and any(
                            kw in t.question_text.lower()[:80]
                            for kw in ("direction", "passage", "read the following", "comprehension", "context")
                        )
                    )
                    or (not t.options and bool(t.parent_context_override))
                    for t in q_item.translations
                )

                if is_upcoming_passage:
                    target_key = (sec_code, next_known_q_num)
                    logger.info(
                        f"📖 [PASSAGE ATTACHMENT] Page {p_num} unnumbered passage/direction header attached to upcoming Q#{next_known_q_num}."
                    )
                    if target_key in question_registry:
                        _merge_question_item_into_registry(question_registry, target_key, p_num, q_item)
                        continue
                    else:
                        q_num = next_known_q_num
                elif next_known_q_num == last_known_q_num + 1:
                    # If next question is last_known + 1 (e.g. Q50 -> trailing fragment -> Q51),
                    # this unnumbered fragment belongs to Q50!
                    target_key = (sec_code, last_known_q_num)
                    if target_key in question_registry:
                        logger.info(
                            f"🔄 [SEQUENCE LOOKAHEAD MERGE] Page {p_num} unnumbered fragment merged into Q#{last_known_q_num} "
                            f"(since next question is Q#{next_known_q_num})."
                        )
                        _merge_question_item_into_registry(question_registry, target_key, p_num, q_item)
                        continue
                    else:
                        q_num = last_known_q_num
                else:
                    # Next question is e.g. Q52 (where last was Q50), so this item is missing Q51!
                    q_num = last_known_q_num + 1
                    logger.warning(
                        f"⚠️ Page {p_num} unnumbered item between Q#{last_known_q_num} and Q#{next_known_q_num}. "
                        f"Auto-assigned Q#{q_num}."
                    )
            elif last_known_q_num is not None:
                target_key = (sec_code, last_known_q_num)
                if not q_item.is_complete and target_key in question_registry:
                    logger.info(
                        f"🔄 [END-OF-DOC MERGE] Page {p_num} uncomplete unnumbered fragment merged into Q#{last_known_q_num}."
                    )
                    _merge_question_item_into_registry(question_registry, target_key, p_num, q_item)
                    continue
                else:
                    q_num = last_known_q_num + 1
            else:
                existing_nums = [k[1] for k in question_registry.keys() if isinstance(k[1], int)]
                q_num = (max(existing_nums) + 1) if existing_nums else 1

        composite_key = (sec_code, q_num)
        if composite_key not in question_registry:
            question_registry[composite_key] = {
                "section_code": sec_code,
                "printed_question_number": q_num,
                "question_type": q_item.question_type.value,
                "is_complete": q_item.is_complete,
                "has_image": q_item.has_image_or_complex_layout,
                "page_numbers": [p_num],
                "assets": list(q_item.assets),
                "translations": {},
            }
        else:
            if p_num not in question_registry[composite_key]["page_numbers"]:
                question_registry[composite_key]["page_numbers"].append(p_num)
            question_registry[composite_key]["assets"].extend(q_item.assets)

        for t in q_item.translations:
            lang = (
                t.language.value
                if hasattr(t.language, "value")
                else str(t.language)
            )
            if lang not in question_registry[composite_key]["translations"]:
                question_registry[composite_key]["translations"][lang] = {
                    "text": t.question_text,
                    "context": t.parent_context_override or "",
                    "options": t.options,
                }
            else:
                if (
                    t.question_text
                    and t.question_text
                    not in question_registry[composite_key]["translations"][lang][
                        "text"
                    ]
                ):
                    question_registry[composite_key]["translations"][lang][
                        "text"
                    ] += "\n" + t.question_text
                existing_opts = question_registry[composite_key]["translations"][
                    lang
                ]["options"]
                for new_opt in t.options:
                    if not any(
                        o.display_order == new_opt.display_order
                        for o in existing_opts
                    ):
                        existing_opts.append(new_opt)

    return question_registry


import asyncio

_exam_commit_locks: Dict[int, asyncio.Lock] = {}


def _get_exam_lock(exam_id: int) -> asyncio.Lock:
    if exam_id not in _exam_commit_locks:
        _exam_commit_locks[exam_id] = asyncio.Lock()
    return _exam_commit_locks[exam_id]


class BatchQuestionRegistrar:
    """
    Handles chunked DB batch insertion for questions, options, assets, and initial metadata.
    Idempotently updates existing DB records without unique constraint crashes.
    """

    def __init__(self, batch_size: Optional[int] = None, session_factory: Optional[Any] = None):
        self.batch_size = batch_size or get_settings().PIPELINE_BATCH_SIZE
        self.session_factory = session_factory

    async def commit_questions_in_batches(
        self,
        exam_id: int,
        pdf_path: str,
        question_registry: Dict[Tuple[str, int], dict],
        passage_id_map: Dict[str, Tuple[int, List[int]]],
        storage: BaseStorageProvider,
        load_pdf_page_image_fn: Any,
    ) -> BatchProcessingSummary:
        async with _get_exam_lock(exam_id):
            summary = BatchProcessingSummary()
            registry_items = sorted(
                question_registry.items(), key=lambda x: (x[0][0], x[0][1])
            )

            logger.info(
                f"📦 [BATCH REGISTRAR] Total questions to commit: {len(registry_items)} in chunks of {self.batch_size}"
            )

            async with managed_async_session() as session:
                exam = await session.get(Exam, exam_id)
                exam_code = exam.code if exam else "EXAM"
                source_year = exam.source_year if exam else None
                paper_set_code = exam.paper_set_code if exam else "SET_A"

            for i in range(0, len(registry_items), self.batch_size):
                batch = registry_items[i : i + self.batch_size]
                async with managed_async_session() as session:
                    try:
                        for (sec_code, q_num), q_data in batch:
                            key_str = f"{sec_code}::{q_num}"
                            summary.processed_question_keys.append(key_str)

                            # Lookup existing question by exam_id and question_number_in_paper
                            existing_q_res = await session.exec(
                                select(Question).where(
                                    Question.exam_id == exam_id,
                                    Question.question_number_in_paper == q_num,
                                )
                            )
                            existing_q = existing_q_res.first()

                            q_passage_id = None
                            q_passage_pages = []

                            if sec_code in passage_id_map:
                                q_passage_id, q_passage_pages = passage_id_map[sec_code]

                            has_passage = bool(q_passage_id)
                            marks = 2.0
                            neg_rate = getattr(exam, "negative_marking_rate", None) if exam else None
                            if neg_rate is not None and isinstance(neg_rate, (int, float)):
                                neg_marks = round(marks * float(neg_rate), 2)
                            else:
                                neg_marks = round(marks / 3.0, 2)

                            expected_time = calculate_question_expected_time(
                                q_data["question_type"],
                                q_data["has_image"],
                                has_passage,
                                q_data["translations"],
                            )

                            if not existing_q:
                                q_obj = Question(
                                    exam_id=exam_id,
                                    section_code=sec_code,
                                    paper_set_code=paper_set_code,
                                    passage_id=q_passage_id,
                                    question_number_in_paper=q_num,
                                    question_type=q_data["question_type"],
                                    marks=marks,
                                    negative_marks=neg_marks,
                                    expected_time_seconds=expected_time,
                                    source_year=source_year,
                                    is_complete=q_data["is_complete"],
                                    has_image=q_data["has_image"],
                                    page_numbers_json=q_data["page_numbers"],
                                    passage_page_numbers_json=q_passage_pages
                                    if q_passage_pages
                                    else [],
                                    status=QuestionStatus.PENDING_HUMAN_REVIEW,
                                )
                                session.add(q_obj)
                                await session.flush()
                                question_id = q_obj.id

                                # Create Baseline QuestionMetadata (Pipeline 1 initial setup)
                                meta_res = await session.exec(
                                    select(QuestionMetadata).where(
                                        QuestionMetadata.question_id == question_id
                                    )
                                )
                                if not meta_res.first():
                                    q_meta = QuestionMetadata(
                                        question_id=question_id,
                                        blooms_level=BloomsLevel.ANALYZE,
                                        cognitive_skill="Extraction Stage Initialized",
                                        primary_concept_tag="GENERAL",
                                        irt_discrimination_a=1.50,
                                        irt_difficulty_b=0.00,
                                        irt_pseudo_guessing_c=0.25,
                                    )
                                    session.add(q_meta)
                            else:
                                question_id = existing_q.id
                                existing_q.is_complete = q_data["is_complete"]
                                existing_q.has_image = q_data["has_image"]
                                existing_q.page_numbers_json = q_data["page_numbers"]
                                if q_passage_id:
                                    existing_q.passage_id = q_passage_id
                                    existing_q.passage_page_numbers_json = q_passage_pages
                                session.add(existing_q)

                            # Stage Assets
                            for asset in q_data["assets"]:
                                first_page = q_data["page_numbers"][0]
                                page_img = await load_pdf_page_image_fn(pdf_path, first_page)
                                asset_rel_path = await async_crop_and_save_asset(
                                    page_img, storage, exam_code, paper_set_code, sec_code, q_num, asset
                                )
                                del page_img

                                if asset_rel_path:
                                    q_asset = QuestionAsset(
                                        question_id=question_id,
                                        asset_path=asset_rel_path,
                                        asset_type=asset.asset_type.value,
                                        caption=asset.caption,
                                    )
                                    session.add(q_asset)

                            # Stage Translations & Options Idempotently
                            existing_opts_res = await session.exec(
                                select(QuestionOption).where(QuestionOption.question_id == question_id)
                            )
                            opts_by_label: Dict[str, QuestionOption] = {
                                opt.option_label: opt for opt in existing_opts_res.all()
                            }

                            for lang, t_data in q_data["translations"].items():
                                trans_res = await session.exec(
                                    select(QuestionTranslation).where(
                                        QuestionTranslation.question_id == question_id,
                                        QuestionTranslation.language == lang,
                                    )
                                )
                                q_trans = trans_res.first()
                                if not q_trans:
                                    q_trans = QuestionTranslation(
                                        question_id=question_id,
                                        language=lang,
                                        question_text=t_data["text"],
                                        parent_context_override=t_data["context"]
                                        if t_data["context"]
                                        else None,
                                    )
                                    session.add(q_trans)
                                else:
                                    q_trans.question_text = t_data["text"]
                                    if t_data["context"]:
                                        q_trans.parent_context_override = t_data["context"]
                                    session.add(q_trans)

                                for opt in t_data["options"]:
                                    opt_label = str(opt.display_label)
                                    if opt_label not in opts_by_label:
                                        q_opt = QuestionOption(
                                            question_id=question_id,
                                            option_label=opt_label,
                                            display_order=opt.display_order,
                                            is_correct=False,
                                        )
                                        session.add(q_opt)
                                        await session.flush()
                                        opts_by_label[opt_label] = q_opt
                                    else:
                                        q_opt = opts_by_label[opt_label]
                                        q_opt.display_order = opt.display_order
                                        session.add(q_opt)

                                    opt_trans_res = await session.exec(
                                        select(OptionTranslation).where(
                                            OptionTranslation.option_id == q_opt.id,
                                            OptionTranslation.language == lang,
                                        )
                                    )
                                    opt_trans = opt_trans_res.first()
                                    if not opt_trans:
                                        opt_trans = OptionTranslation(
                                            option_id=q_opt.id,
                                            language=lang,
                                            option_text=opt.option_text,
                                        )
                                        session.add(opt_trans)
                                    else:
                                        opt_trans.option_text = opt.option_text
                                        session.add(opt_trans)

                        await session.commit()
                        summary.successful_batches += 1
                        summary.total_processed_questions += len(batch)
                        logger.info(
                            f"Successfully committed DB batch {summary.successful_batches} of {len(batch)} question(s) (Total committed: {summary.total_processed_questions}/{len(registry_items)})."
                        )
                    except Exception as batch_err:
                        await session.rollback()
                        summary.failed_batches += 1
                        summary.errors.append(str(batch_err))
                        logger.error(
                            f"❌ Failed to commit DB batch starting at index {i}: {batch_err}",
                            exc_info=True,
                        )

            total_translations_count = 0
            async with managed_async_session() as session:
                exam_obj = await session.get(Exam, exam_id)
                if exam_obj:
                    all_qs_res = await session.exec(
                        select(Question.question_number_in_paper).where(Question.exam_id == exam_id)
                    )
                    extracted_numbers = set(all_qs_res.all())
                    tot_exp = exam_obj.total_questions or 100
                    missing_nums = [num for num in range(1, tot_exp + 1) if num not in extracted_numbers]
                    exam_obj.extracted_questions_count = len(extracted_numbers)
                    exam_obj.missing_questions_count = len(missing_nums)
                    exam_obj.missing_question_numbers_json = missing_nums
                    session.add(exam_obj)

                    from sqlmodel import col
                    q_ids_stmt = select(Question.id).where(Question.exam_id == exam_id)
                    q_trans_res = await session.exec(
                        select(QuestionTranslation).where(col(QuestionTranslation.question_id).in_(q_ids_stmt))
                    )
                    total_translations_count = len(q_trans_res.all())
                    await session.commit()

            logger.info(
                f"🎉 [BATCH REGISTRAR COMPLETE] Total committed: {summary.total_processed_questions} canonical question(s) ({total_translations_count} question translations across languages in DB)."
            )
            return summary

    async def commit_question_records_in_batches(
        self,
        exam_id: int,
        records: List[QuestionRecord],
        page_images: Optional[Dict[int, Image.Image]] = None,
        storage: Optional[BaseStorageProvider] = None,
    ) -> BatchProcessingSummary:
        """
        Commits QuestionRecord instances extracted from the single deterministic docling+regex pipeline.
        Writes:
        - questions (with raw subject/topic/subtopic/difficulty tags, extraction metadata)
        - question_translations (English stem)
        - question_options & option_translations (with is_correct computed directly from answer line)
        - question_option_reasoning (Reverse Logic Box why_tempting / whats_actually_true)
        - question_explanations (detailed solution and common mistake from PDF)
        - question_assets (pictures cropped from page_images, tables stored as markdown)
        - human_review_tasks (flagged if extraction_confidence < 0.8 or issues exist)
        Leaves 3PL IRT psychometrics and taxonomy hierarchy links NULL.
        """
        async with _get_exam_lock(exam_id):
            summary = BatchProcessingSummary()
            logger.info(
                f"📦 [DETERMINISTIC REGISTRAR] Total QuestionRecords to commit: {len(records)} in chunks of {self.batch_size}"
            )

            def _get_session():
                return self.session_factory() if self.session_factory else managed_async_session()

            # 1. Fetch Exam & Setup Syllabus Version
            async with _get_session() as session:
                exam = await session.get(Exam, exam_id)
                exam_code = exam.code if exam else "EXAM"
                exam_name = exam.name if exam else "Exam"
                source_year = exam.source_year if exam else None
                paper_set_code = exam.paper_set_code if exam else "SET_A"
                neg_rate = getattr(exam, "negative_marking_rate", None) if exam else None

                s_ver_res = await session.exec(
                    select(SyllabusVersion).where(
                        SyllabusVersion.exam_id == exam_id,
                        SyllabusVersion.is_active == True,
                    )
                )
                s_ver = s_ver_res.first()
                if not s_ver:
                    s_ver = SyllabusVersion(
                        exam_id=exam_id,
                        version_code=f"{exam_code}_V1",
                        title=f"{exam_name} Syllabus",
                        is_active=True,
                    )
                    session.add(s_ver)
                    await session.commit()
                    await session.refresh(s_ver)
                s_ver_id = s_ver.id

                # Preload existing hierarchy in memory
                subj_res = await session.exec(select(Subject).where(Subject.version_id == s_ver_id))
                subjects_by_name = {s.name.strip().lower(): s for s in subj_res.all()}

                topics_by_key = {}
                if subjects_by_name:
                    s_ids = [s.id for s in subjects_by_name.values()]
                    top_res = await session.exec(select(Topic).where(Topic.subject_id.in_(s_ids)))
                    for t in top_res.all():
                        topics_by_key[(t.subject_id, t.name.strip().lower())] = t

                subtopics_by_key = {}
                if topics_by_key:
                    t_ids = [t.id for t in topics_by_key.values()]
                    sub_res = await session.exec(select(Subtopic).where(Subtopic.topic_id.in_(t_ids)))
                    for st in sub_res.all():
                        subtopics_by_key[(st.topic_id, st.name.strip().lower())] = st

            marks = 2.0
            if neg_rate is not None and isinstance(neg_rate, (int, float)):
                neg_marks = round(marks * float(neg_rate), 2)
            else:
                neg_marks = round(marks / 3.0, 2)

            for i in range(0, len(records), self.batch_size):
                batch = records[i : i + self.batch_size]
                async with _get_session() as session:
                    try:
                        q_nums = [rec.question_number for rec in batch]
                        for q_num in q_nums:
                            summary.processed_question_keys.append(f"DEFAULT::{q_num}")

                        # Bulk fetch existing questions for this batch
                        existing_qs_res = await session.exec(
                            select(Question).where(
                                Question.exam_id == exam_id,
                                Question.question_number_in_paper.in_(q_nums),
                            )
                        )
                        existing_qs = {q.question_number_in_paper: q for q in existing_qs_res.all()}
                        existing_q_ids = [q.id for q in existing_qs.values()]

                        # Bulk fetch related records for existing questions
                        trans_by_qid = {}
                        opts_by_qid_label = {}
                        ot_by_optid = {}
                        rl_by_optid = {}
                        expl_by_qid = {}
                        links_by_qid = {}
                        hr_by_qid = {}

                        if existing_q_ids:
                            qt_res = await session.exec(
                                select(QuestionTranslation).where(
                                    QuestionTranslation.question_id.in_(existing_q_ids),
                                    QuestionTranslation.language == LanguageCode.ENGLISH,
                                )
                            )
                            trans_by_qid = {t.question_id: t for t in qt_res.all()}

                            opt_res = await session.exec(
                                select(QuestionOption).where(QuestionOption.question_id.in_(existing_q_ids))
                            )
                            existing_opts = opt_res.all()
                            for opt in existing_opts:
                                opts_by_qid_label[(opt.question_id, opt.option_label.upper())] = opt
                            opt_ids = [opt.id for opt in existing_opts]

                            if opt_ids:
                                ot_res = await session.exec(
                                    select(OptionTranslation).where(
                                        OptionTranslation.option_id.in_(opt_ids),
                                        OptionTranslation.language == LanguageCode.ENGLISH,
                                    )
                                )
                                ot_by_optid = {ot.option_id: ot for ot in ot_res.all()}

                                rl_res = await session.exec(
                                    select(QuestionOptionReasoning).where(
                                        QuestionOptionReasoning.question_option_id.in_(opt_ids)
                                    )
                                )
                                rl_by_optid = {rl.question_option_id: rl for rl in rl_res.all()}

                            exp_res = await session.exec(
                                select(QuestionExplanation).where(
                                    QuestionExplanation.question_id.in_(existing_q_ids),
                                    QuestionExplanation.language == LanguageCode.ENGLISH,
                                )
                            )
                            expl_by_qid = {e.question_id: e for e in exp_res.all()}

                            link_res = await session.exec(
                                select(QuestionHierarchyLink).where(
                                    QuestionHierarchyLink.question_id.in_(existing_q_ids),
                                    QuestionHierarchyLink.is_primary == True,
                                )
                            )
                            links_by_qid = {l.question_id: l for l in link_res.all()}

                            hr_res = await session.exec(
                                select(HumanReviewTask).where(
                                    HumanReviewTask.question_id.in_(existing_q_ids)
                                )
                            )
                            hr_by_qid = {hr.question_id: hr for hr in hr_res.all()}

                        # 1. Resolve all subjects, topics, and subtopics for this batch in bulk
                        new_subjs = []
                        for rec in batch:
                            s_name = (rec.subject_raw or exam_name).strip()
                            s_key = s_name.lower()
                            if s_key not in subjects_by_name:
                                new_subj = Subject(
                                    version_id=s_ver_id,
                                    name=s_name,
                                    code=s_name[:10].upper().replace(" ", "_"),
                                    display_order=len(subjects_by_name) + len(new_subjs) + 1,
                                )
                                session.add(new_subj)
                                subjects_by_name[s_key] = new_subj
                                new_subjs.append(new_subj)
                        if new_subjs:
                            await session.flush()

                        new_tops = []
                        for rec in batch:
                            s_name = (rec.subject_raw or exam_name).strip()
                            subj = subjects_by_name[s_name.lower()]
                            t_name = (rec.topic_raw or s_name).strip()
                            t_key = (subj.id, t_name.lower())
                            if t_key not in topics_by_key:
                                new_top = Topic(
                                    subject_id=subj.id,
                                    name=t_name,
                                    code=t_name[:10].upper().replace(" ", "_"),
                                    display_order=len(topics_by_key) + len(new_tops) + 1,
                                )
                                session.add(new_top)
                                topics_by_key[t_key] = new_top
                                new_tops.append(new_top)
                        if new_tops:
                            await session.flush()

                        new_subs = []
                        for rec in batch:
                            s_name = (rec.subject_raw or exam_name).strip()
                            subj = subjects_by_name[s_name.lower()]
                            t_name = (rec.topic_raw or s_name).strip()
                            top = topics_by_key[(subj.id, t_name.lower())]
                            st_name = (rec.subtopic_raw or t_name).strip()
                            st_key = (top.id, st_name.lower())
                            if st_key not in subtopics_by_key:
                                new_sub = Subtopic(
                                    topic_id=top.id,
                                    name=st_name,
                                    code=st_name[:10].upper().replace(" ", "_"),
                                    display_order=len(subtopics_by_key) + len(new_subs) + 1,
                                )
                                session.add(new_sub)
                                subtopics_by_key[st_key] = new_sub
                                new_subs.append(new_sub)
                        if new_subs:
                            await session.flush()

                        # 2. Stage/update all Question objects for this batch
                        new_qs = []
                        for rec in batch:
                            q_num = rec.question_number
                            s_name = (rec.subject_raw or exam_name).strip()
                            subj = subjects_by_name[s_name.lower()]
                            t_name = (rec.topic_raw or s_name).strip()
                            top = topics_by_key[(subj.id, t_name.lower())]
                            st_name = (rec.subtopic_raw or t_name).strip()
                            subtopic_obj = subtopics_by_key[(top.id, st_name.lower())]

                            is_complete = rec.extraction_confidence >= 0.8 and not any(
                                "MISSING_OPTION" in is_str for is_str in rec.extraction_issues
                            )

                            if q_num not in existing_qs:
                                q_obj = Question(
                                    exam_id=exam_id,
                                    subtopic_id=subtopic_obj.id,
                                    section_code="DEFAULT",
                                    paper_set_code=paper_set_code,
                                    question_number_in_paper=q_num,
                                    question_type="SINGLE_CHOICE",
                                    difficulty=rec.difficulty,
                                    marks=marks,
                                    negative_marks=neg_marks,
                                    expected_time_seconds=60,
                                    source_year=source_year,
                                    is_complete=is_complete,
                                    has_image=bool(rec.pictures),
                                    page_numbers_json=rec.page_numbers,
                                    subject_raw=rec.subject_raw,
                                    topic_raw=rec.topic_raw,
                                    subtopic_raw=rec.subtopic_raw,
                                    difficulty_raw=rec.difficulty_raw,
                                    extraction_confidence=rec.extraction_confidence,
                                    extraction_issues_json=rec.extraction_issues,
                                    status=QuestionStatus.PENDING_HUMAN_REVIEW,
                                    requires_human_review=(rec.extraction_confidence < 0.8 or bool(rec.extraction_issues)),
                                )
                                session.add(q_obj)
                                existing_qs[q_num] = q_obj
                                new_qs.append(q_obj)
                            else:
                                q_obj = existing_qs[q_num]
                                q_obj.subtopic_id = subtopic_obj.id
                                q_obj.difficulty = rec.difficulty
                                q_obj.is_complete = is_complete
                                q_obj.has_image = bool(rec.pictures)
                                q_obj.page_numbers_json = rec.page_numbers
                                q_obj.subject_raw = rec.subject_raw
                                q_obj.topic_raw = rec.topic_raw
                                q_obj.subtopic_raw = rec.subtopic_raw
                                q_obj.difficulty_raw = rec.difficulty_raw
                                q_obj.extraction_confidence = rec.extraction_confidence
                                q_obj.extraction_issues_json = rec.extraction_issues
                                q_obj.requires_human_review = (rec.extraction_confidence < 0.8 or bool(rec.extraction_issues))
                                session.add(q_obj)

                        # Single bulk flush for new questions to populate IDs
                        if new_qs:
                            await session.flush()

                        # 3. Stage Hierarchy Links, Translations, and Options
                        new_opts = []
                        for rec in batch:
                            q_num = rec.question_number
                            q_obj = existing_qs[q_num]
                            question_id = q_obj.id

                            # Hierarchy Link
                            q_link = links_by_qid.get(question_id)
                            if not q_link:
                                q_link = QuestionHierarchyLink(
                                    question_id=question_id,
                                    subtopic_id=q_obj.subtopic_id,
                                    is_primary=True,
                                    relevance_weight=1.0,
                                )
                                session.add(q_link)
                                links_by_qid[question_id] = q_link
                            else:
                                q_link.subtopic_id = q_obj.subtopic_id
                                session.add(q_link)

                            # Translation (Stem)
                            q_trans = trans_by_qid.get(question_id)
                            if not q_trans:
                                q_trans = QuestionTranslation(
                                    question_id=question_id,
                                    language=LanguageCode.ENGLISH,
                                    question_text=rec.stem,
                                )
                                session.add(q_trans)
                                trans_by_qid[question_id] = q_trans
                            else:
                                q_trans.question_text = rec.stem
                                session.add(q_trans)

                            # Options
                            for label, opt_text in rec.options.items():
                                norm_label = label.upper()
                                is_correct = norm_label == rec.answer_label.upper()
                                display_order = ord(norm_label) - ord("A") + 1 if len(norm_label) == 1 else 1

                                opt_key = (question_id, norm_label)
                                q_opt = opts_by_qid_label.get(opt_key)
                                if not q_opt:
                                    q_opt = QuestionOption(
                                        question_id=question_id,
                                        option_label=norm_label,
                                        display_order=display_order,
                                        is_correct=is_correct,
                                    )
                                    session.add(q_opt)
                                    opts_by_qid_label[opt_key] = q_opt
                                    new_opts.append(q_opt)
                                else:
                                    q_opt.is_correct = is_correct
                                    q_opt.display_order = display_order
                                    session.add(q_opt)

                        # Single bulk flush for new options to populate IDs
                        if new_opts:
                            await session.flush()

                        # 4. Stage Option Translations, Reasonings, Explanations, and Assets
                        for rec in batch:
                            q_num = rec.question_number
                            q_obj = existing_qs[q_num]
                            question_id = q_obj.id

                            for label, opt_text in rec.options.items():
                                norm_label = label.upper()
                                is_correct = norm_label == rec.answer_label.upper()
                                opt_key = (question_id, norm_label)
                                q_opt = opts_by_qid_label[opt_key]

                                # Format Distractor Analysis
                                if is_correct:
                                    distractor_text = rec.solution_text or ""
                                else:
                                    rl_data = rec.reverse_logic.get(norm_label)
                                    if rl_data:
                                        why_t = rl_data.get("why_tempting", "").strip()
                                        whats_t = rl_data.get("whats_actually_true", "").strip()
                                        distractor_text = f"Why it seems tempting — {why_t}\n\nWhat's actually true — {whats_t}"
                                    else:
                                        distractor_text = None

                                # Option translation
                                opt_trans = ot_by_optid.get(q_opt.id)
                                if not opt_trans:
                                    opt_trans = OptionTranslation(
                                        option_id=q_opt.id,
                                        language=LanguageCode.ENGLISH,
                                        option_text=opt_text,
                                        distractor_analysis=distractor_text,
                                    )
                                    session.add(opt_trans)
                                    ot_by_optid[q_opt.id] = opt_trans
                                else:
                                    opt_trans.option_text = opt_text
                                    opt_trans.distractor_analysis = distractor_text
                                    session.add(opt_trans)

                                # Question Option Reasoning
                                if norm_label in rec.reverse_logic:
                                    rl_data = rec.reverse_logic[norm_label]
                                    q_reason = rl_by_optid.get(q_opt.id)
                                    if not q_reason:
                                        q_reason = QuestionOptionReasoning(
                                            question_option_id=q_opt.id,
                                            why_tempting=rl_data.get("why_tempting", ""),
                                            whats_actually_true=rl_data.get("whats_actually_true", ""),
                                        )
                                        session.add(q_reason)
                                        rl_by_optid[q_opt.id] = q_reason
                                    else:
                                        q_reason.why_tempting = rl_data.get("why_tempting", "")
                                        q_reason.whats_actually_true = rl_data.get("whats_actually_true", "")
                                        session.add(q_reason)

                            # Question Explanation
                            q_expl = expl_by_qid.get(question_id)
                            core_concept_val = rec.subtopic_raw or rec.topic_raw or None
                            traps_list = [rec.common_mistake] if rec.common_mistake else []
                            if not q_expl:
                                q_expl = QuestionExplanation(
                                    question_id=question_id,
                                    language=LanguageCode.ENGLISH,
                                    core_concept=core_concept_val,
                                    detailed_solution=rec.solution_text,
                                    common_mistake=rec.common_mistake,
                                    common_traps_json=traps_list,
                                    key_takeaways_json=[],
                                )
                                session.add(q_expl)
                                expl_by_qid[question_id] = q_expl
                            else:
                                q_expl.detailed_solution = rec.solution_text
                                q_expl.common_mistake = rec.common_mistake
                                q_expl.common_traps_json = traps_list
                                if core_concept_val:
                                    q_expl.core_concept = core_concept_val
                                session.add(q_expl)

                            # Assets
                            for pic in rec.pictures:
                                pic_page = pic.get("page_no", 1)
                                bbox = pic.get("bbox")
                                rel_path = None
                                if page_images and pic_page in page_images and bbox and storage:
                                    try:
                                        p_img = page_images[pic_page]
                                        img_w, img_h = p_img.size
                                        left = max(0, min(img_w, bbox[0]))
                                        top = max(0, min(img_h, bbox[1]))
                                        right = max(left + 1, min(img_w, bbox[2]))
                                        bottom = max(top + 1, min(img_h, bbox[3]))
                                        cropped = p_img.crop((left, top, right, bottom))
                                        dest_path = f"cropped_assets/{exam_code}_{paper_set_code}_q{q_num}_p{pic_page}_{uuid.uuid4().hex[:6]}.png"
                                        rel_path = await storage.save_image(cropped, dest_path)
                                    except Exception as crop_err:
                                        logger.warning(f"Failed to crop/save picture for Q{q_num}: {crop_err}")

                                q_asset = QuestionAsset(
                                    question_id=question_id,
                                    asset_path=rel_path,
                                    asset_type=AssetType.DIAGRAM,
                                    bounding_box_json=bbox,
                                )
                                session.add(q_asset)

                            for tbl in rec.tables:
                                q_tbl_asset = QuestionAsset(
                                    question_id=question_id,
                                    asset_path=None,
                                    table_markdown=tbl.get("markdown", ""),
                                    asset_type=AssetType.DIAGRAM,
                                    bounding_box_json=tbl.get("bbox"),
                                )
                                session.add(q_tbl_asset)

                            # Human Review Task
                            if rec.extraction_confidence < 0.8 or rec.extraction_issues:
                                hr_task = hr_by_qid.get(question_id)
                                if not hr_task:
                                    hr_task = HumanReviewTask(
                                        exam_id=exam_id,
                                        question_id=question_id,
                                        review_status="PENDING_REVIEW",
                                        is_flagged_by_validator=True,
                                        failure_reasons_json=rec.extraction_issues or ["Low extraction confidence"],
                                    )
                                    session.add(hr_task)
                                    hr_by_qid[question_id] = hr_task
                                else:
                                    hr_task.failure_reasons_json = rec.extraction_issues or ["Low extraction confidence"]
                                    session.add(hr_task)

                        await session.commit()
                        summary.successful_batches += 1
                        summary.total_processed_questions += len(batch)
                        logger.info(
                            f"Successfully committed deterministic DB batch {summary.successful_batches} of {len(batch)} question(s)."
                        )
                    except Exception as batch_err:
                        await session.rollback()
                        summary.failed_batches += 1
                        summary.errors.append(str(batch_err))
                        logger.error(
                            f"❌ Failed to commit deterministic DB batch starting at index {i}: {batch_err}",
                            exc_info=True,
                        )

            # Update Exam question counts
            async with _get_session() as session:
                exam_obj = await session.get(Exam, exam_id)
                if exam_obj:
                    all_qs_res = await session.exec(
                        select(Question.question_number_in_paper).where(Question.exam_id == exam_id)
                    )
                    extracted_numbers = set(all_qs_res.all())
                    tot_exp = exam_obj.total_questions or len(records)
                    missing_nums = [num for num in range(1, tot_exp + 1) if num not in extracted_numbers]
                    exam_obj.extracted_questions_count = len(extracted_numbers)
                    exam_obj.missing_questions_count = len(missing_nums)
                    exam_obj.missing_question_numbers_json = missing_nums
                    session.add(exam_obj)
                    await session.commit()

            return summary
