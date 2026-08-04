import uuid
import json
import aiofiles
from pathlib import Path
from typing import List, Dict, Tuple, Optional
from sqlmodel import select
from langgraph.graph import StateGraph, END, START
from langgraph.types import Send

from app.db.session import async_session_factory
from app.db.models import (
    Exam,
    Question,
    QuestionTranslation,
    QuestionOption,
    OptionTranslation,
    QuestionAsset,
    Passage,
    PassageTranslation,
    QuestionStatus,
    HumanReviewTask,
)
from app.storage.factory import get_storage_provider
from app.formatters.yaml_exporter import (
    async_export_question_to_yaml_string,
    get_canonical_question_filename_stem,
)
from app.formatters.markdown_exporter import async_export_question_to_markdown
from app.pipeline.state import (
    OverallPipelineState,
    ParallelWorkerInput,
    PageExtractionPayload,
)
from app.pipeline.vision_extractor import (
    load_pdf_page_image_lazily,
    ainvoke_extraction_llm,
)
from app.pipeline.dsu_stitcher import (
    resolve_transitive_passages_dsu,
    async_crop_and_save_asset,
)


from app.config.logger import setup_logger, TaskLoggerAdapter

logger = setup_logger("ExamPipeline")


def node_dispatch_parallel_map(state: OverallPipelineState):
    pdf_path = state["pdf_path"]
    total_pages = state["total_pages"]
    t_id = state.get("task_id", "N/A")
    return [
        Send(
            "parallel_extract_worker",
            {"page_num": p_num, "pdf_path": pdf_path, "task_id": t_id},
        )
        for p_num in range(1, total_pages + 1)
    ]


async def node_parallel_extract_worker(state: ParallelWorkerInput) -> dict:
    page_num = state["page_num"]
    pdf_path = state["pdf_path"]
    t_id = state.get("task_id", "N/A")
    log = TaskLoggerAdapter(logger, task_id=t_id)

    try:
        log.info(f"🤖 [LLM VISION CALL] Processing Page {page_num}...")
        page_img = await load_pdf_page_image_lazily(pdf_path, page_num)
        payload = await ainvoke_extraction_llm(page_img, page_num)
        del page_img
        log.info(
            f"✨ [PAGE {page_num} EXTRACTED] Found {len(payload.extracted_questions)} question(s)."
        )
        return {"raw_page_payloads": [(page_num, payload, None)]}
    except Exception as e:
        err_str = f"Worker failed on Page {page_num}: {str(e)}"
        log.error(f"❌ [PAGE WORKER FAILED] Page {page_num}: {e}", exc_info=True)
        return {"raw_page_payloads": [(page_num, None, err_str)]}


async def node_python_reduce_and_stitch(state: OverallPipelineState) -> dict:
    exam_id = (
        uuid.UUID(state["exam_id"])
        if isinstance(state["exam_id"], str)
        else state["exam_id"]
    )
    pdf_path = state["pdf_path"]
    storage = get_storage_provider()

    results = sorted(state["raw_page_payloads"], key=lambda x: x[0])
    valid_payloads = [r for r in results if r[1] is not None]
    failed_payloads = [r for r in results if r[2] is not None]

    if failed_payloads:
        logger.warning(
            f"⚠️ {len(failed_payloads)} out of {len(results)} page workers encountered errors."
        )
        for p_num, _, err in failed_payloads:
            logger.error(f"   - Page {p_num} Error: {err}")

    if not valid_payloads:
        sample_err = (
            failed_payloads[0][2] if failed_payloads else "No page payloads produced"
        )
        raise RuntimeError(
            f"Vision extraction failed for ALL pages. Sample error: {sample_err}"
        )

    async with async_session_factory() as session:
        exam = await session.get(Exam, exam_id)
        exam_code = exam.code if exam else "EXAM"

    unified_passages = resolve_transitive_passages_dsu(results)
    passage_id_map = {}

    async with async_session_factory() as session:
        for p_data in unified_passages:
            p_id = uuid.uuid4()
            sec_code = p_data.get("section_code", "DEFAULT")
            pages_json = json.dumps(p_data["page_numbers"])

            passage = Passage(
                id=p_id,
                exam_id=exam_id,
                section_code=sec_code,
                memory_type=p_data.get("memory_type", "PASSAGE"),
                is_complete=p_data.get("is_complete", True),
                page_numbers_json=pages_json,
                question_ids_json="[]",
            )
            session.add(passage)
            await session.commit()

            for trans in p_data.get("translations", []):
                lang_str = (
                    trans["language"].value
                    if hasattr(trans["language"], "value")
                    else str(trans["language"])
                )
                p_trans = PassageTranslation(
                    passage_id=p_id,
                    language=lang_str,
                    passage_text=trans["context_text"],
                )
                session.add(p_trans)
            await session.commit()

            passage_id_map[sec_code] = (p_id, p_data["page_numbers"])

    # Register Questions
    question_registry: Dict[Tuple[str, int], dict] = {}

    for p_num, payload, err in results:
        if not payload:
            continue

        for q_item in payload.extracted_questions:
            sec_code = q_item.section_code or "DEFAULT"
            q_num = q_item.printed_question_number

            if (
                q_item.is_continuation_fragment
                and q_item.target_parent_question_number is not None
            ):
                parent_sec = q_item.target_parent_section_code or sec_code
                parent_q = q_item.target_parent_question_number
                target_key = (parent_sec, parent_q)

                if target_key in question_registry:
                    if p_num not in question_registry[target_key]["page_numbers"]:
                        question_registry[target_key]["page_numbers"].append(p_num)

                    for t in q_item.translations:
                        lang = (
                            t.language.value
                            if hasattr(t.language, "value")
                            else str(t.language)
                        )
                        if lang in question_registry[target_key]["translations"]:
                            if (
                                t.question_text
                                and t.question_text
                                not in question_registry[target_key]["translations"][
                                    lang
                                ]["text"]
                            ):
                                question_registry[target_key]["translations"][lang][
                                    "text"
                                ] += "\n" + t.question_text
                            existing_opts = question_registry[target_key][
                                "translations"
                            ][lang]["options"]
                            for new_opt in t.options:
                                if not any(
                                    o.display_order == new_opt.display_order
                                    for o in existing_opts
                                ):
                                    existing_opts.append(new_opt)
                    continue

            if q_num is None:
                continue

            composite_key = (sec_code, q_num)
            if composite_key not in question_registry:
                question_registry[composite_key] = {
                    "section_code": sec_code,
                    "printed_question_number": q_num,
                    "question_type": q_item.question_type.value,
                    "is_complete": q_item.is_complete,
                    "has_image": q_item.has_image_or_complex_layout,
                    "page_numbers": [p_num],
                    "assets": q_item.assets,
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

    processed_keys = []

    async with async_session_factory() as session:
        for (sec_code, q_num), q_data in sorted(
            question_registry.items(), key=lambda x: (x[0][0], x[0][1])
        ):
            key_str = f"{sec_code}::{q_num}"
            processed_keys.append(key_str)

            existing_q_res = await session.exec(
                select(Question).where(
                    Question.exam_id == exam_id,
                    Question.section_code == sec_code,
                    Question.question_number_in_paper == q_num,
                )
            )
            existing_q = existing_q_res.first()

            question_id = existing_q.id if existing_q else uuid.uuid4()
            q_passage_id = None
            q_passage_pages = []

            if sec_code in passage_id_map:
                q_passage_id, q_passage_pages = passage_id_map[sec_code]

            if not existing_q:
                q_obj = Question(
                    id=question_id,
                    exam_id=exam_id,
                    section_code=sec_code,
                    passage_id=q_passage_id,
                    question_number_in_paper=q_num,
                    question_type=q_data["question_type"],
                    is_complete=q_data["is_complete"],
                    has_image=q_data["has_image"],
                    page_numbers_json=json.dumps(q_data["page_numbers"]),
                    passage_page_numbers_json=json.dumps(q_passage_pages)
                    if q_passage_pages
                    else None,
                    status=QuestionStatus.PENDING_HUMAN_REVIEW,
                )
                session.add(q_obj)
                await session.commit()

            # Process Assets asynchronously
            for asset in q_data["assets"]:
                first_page = q_data["page_numbers"][0]
                page_img = await load_pdf_page_image_lazily(pdf_path, first_page)
                asset_rel_path = await async_crop_and_save_asset(
                    page_img, storage, exam_code, sec_code, q_num, asset
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
            await session.commit()

            # Process Translations & Options asynchronously
            for lang, t_data in q_data["translations"].items():
                q_trans = QuestionTranslation(
                    question_id=question_id,
                    language=lang,
                    question_text=t_data["text"],
                    parent_context_override=t_data["context"]
                    if t_data["context"]
                    else None,
                )
                session.add(q_trans)
                await session.commit()

                for opt in t_data["options"]:
                    q_opt = QuestionOption(
                        question_id=question_id,
                        option_label=opt.display_label,
                        display_order=opt.display_order,
                        is_correct=False,
                    )
                    session.add(q_opt)
                    await session.commit()

                    opt_trans = OptionTranslation(
                        option_id=q_opt.id, language=lang, option_text=opt.option_text
                    )
                    session.add(opt_trans)
            await session.commit()

    return {"processed_question_keys": processed_keys}


async def node_mcq_validator_and_hitl(state: OverallPipelineState) -> dict:
    exam_id = (
        uuid.UUID(state["exam_id"])
        if isinstance(state["exam_id"], str)
        else state["exam_id"]
    )
    processed_keys = state["processed_question_keys"]

    async with async_session_factory() as session:
        for key_str in processed_keys:
            sec_code, q_num_str = key_str.split("::")
            q_num = int(q_num_str)

            q_res = await session.exec(
                select(Question).where(
                    Question.exam_id == exam_id,
                    Question.section_code == sec_code,
                    Question.question_number_in_paper == q_num,
                )
            )
            q = q_res.first()
            if not q:
                continue

            failure_reasons = []
            if not q.is_complete:
                failure_reasons.append(
                    "Question statement/options is_complete is False"
                )

            task_res = await session.exec(
                select(HumanReviewTask).where(HumanReviewTask.question_id == q.id)
            )
            existing_task = task_res.first()

            if not existing_task:
                review_task = HumanReviewTask(
                    question_id=q.id,
                    exam_id=exam_id,
                    review_status="PENDING_REVIEW",
                    is_flagged_by_validator=bool(failure_reasons),
                    failure_reasons_json=json.dumps(failure_reasons),
                )
                session.add(review_task)
                await session.commit()

    return {}


async def node_export_artifacts(state: OverallPipelineState) -> dict:
    exam_id = (
        uuid.UUID(state["exam_id"])
        if isinstance(state["exam_id"], str)
        else state["exam_id"]
    )
    storage = get_storage_provider()

    async with async_session_factory() as session:
        exam = await session.get(Exam, exam_id)
        exam_code = exam.code if exam else "EXAM"

        questions_res = await session.exec(
            select(Question).where(Question.exam_id == exam_id)
        )
        questions = questions_res.all()

        for q in questions:
            q_stem = get_canonical_question_filename_stem(session, q, exam)

            # 1. Async Export YAML
            yaml_str = await async_export_question_to_yaml_string(session, q)
            yaml_filename = f"{q_stem}.yaml"
            yaml_rel_path = f"exams/{exam_code}/output_files/{yaml_filename}"

            temp_yaml = Path(state["output_dir"]) / yaml_filename
            async with aiofiles.open(temp_yaml, mode="w", encoding="utf-8") as f:
                await f.write(yaml_str)
            await storage.upload_file(temp_yaml, yaml_rel_path)

            # 2. Async Export Markdown (MATCHING FILENAME STEM)
            md_str = await async_export_question_to_markdown(
                session, q, storage=storage
            )
            md_filename = f"{q_stem}.md"
            md_rel_path = f"exams/{exam_code}/output_files/{md_filename}"

            temp_md = Path(state["output_dir"]) / md_filename
            async with aiofiles.open(temp_md, mode="w", encoding="utf-8") as f:
                await f.write(md_str)
            await storage.upload_file(temp_md, md_rel_path)

    return {}


def build_langgraph_pipeline():
    workflow = StateGraph(OverallPipelineState)

    workflow.add_node("parallel_extract_worker", node_parallel_extract_worker)
    workflow.add_node("python_reduce_and_stitch", node_python_reduce_and_stitch)
    workflow.add_node("mcq_validator_and_hitl", node_mcq_validator_and_hitl)
    workflow.add_node("export_artifacts", node_export_artifacts)

    workflow.add_conditional_edges(
        START, node_dispatch_parallel_map, ["parallel_extract_worker"]
    )
    workflow.add_edge("parallel_extract_worker", "python_reduce_and_stitch")
    workflow.add_edge("python_reduce_and_stitch", "mcq_validator_and_hitl")
    workflow.add_edge("mcq_validator_and_hitl", "export_artifacts")
    workflow.add_edge("export_artifacts", END)

    return workflow.compile()
