import json
import uuid
from typing import Dict, List, Optional, Tuple, Any
from sqlmodel import select

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
)
from app.db.models.enums import BloomsLevel
from app.config.settings import get_settings
from app.db.session import managed_async_session
from app.pipeline.batch_schema import BatchProcessingSummary
from app.pipeline.dsu_stitcher import async_crop_and_save_asset
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

_exam_commit_locks: Dict[uuid.UUID, asyncio.Lock] = {}


def _get_exam_lock(exam_id: uuid.UUID) -> asyncio.Lock:
    if exam_id not in _exam_commit_locks:
        _exam_commit_locks[exam_id] = asyncio.Lock()
    return _exam_commit_locks[exam_id]


class BatchQuestionRegistrar:
    """
    Handles chunked DB batch insertion for questions, options, assets, and initial metadata.
    Idempotently updates existing DB records without unique constraint crashes.
    """

    def __init__(self, batch_size: Optional[int] = None):
        self.batch_size = batch_size or get_settings().PIPELINE_BATCH_SIZE

    async def commit_questions_in_batches(
        self,
        exam_id: uuid.UUID,
        pdf_path: str,
        question_registry: Dict[Tuple[str, int], dict],
        passage_id_map: Dict[str, Tuple[uuid.UUID, List[int]]],
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

                            question_id = existing_q.id if existing_q else uuid.uuid4()
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
                                    id=question_id,
                                    exam_id=exam_id,
                                    canonical_question_id=question_id,
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
                                            id=uuid.uuid4(),
                                            question_id=question_id,
                                            option_label=opt_label,
                                            display_order=opt.display_order,
                                            is_correct=False,
                                        )
                                        session.add(q_opt)
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
