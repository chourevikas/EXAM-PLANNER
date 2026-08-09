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
    Passage,
    PassageTranslation,
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
)
from app.pipeline.vision_extractor import (
    load_pdf_page_image_lazily,
    ainvoke_extraction_llm,
)
from app.pipeline.dsu_stitcher import (
    resolve_transitive_passages_dsu,
)
from app.pipeline.batch_processor import (
    build_question_registry,
    BatchQuestionRegistrar,
)
from app.config.logger import setup_logger, TaskLoggerAdapter

logger = setup_logger("ExamPipeline")


def node_dispatch_map_entry(state: OverallPipelineState):
    return state


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

    # 1. Resolve Transitive Passages using DSU
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

    # 2. Build Question Registry via BatchProcessor
    question_registry = build_question_registry(results)

    # 3. Commit questions and initial metadata in batches via BatchQuestionRegistrar
    registrar = BatchQuestionRegistrar(batch_size=10)
    summary = await registrar.commit_questions_in_batches(
        exam_id=exam_id,
        pdf_path=pdf_path,
        question_registry=question_registry,
        passage_id_map=passage_id_map,
        storage=storage,
        load_pdf_page_image_fn=load_pdf_page_image_lazily,
    )

    return {"processed_question_keys": summary.processed_question_keys}


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

            # 2. Async Export Markdown
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

    workflow.add_node("dispatch_map_entry", node_dispatch_map_entry)
    workflow.add_node("parallel_extract_worker", node_parallel_extract_worker)
    workflow.add_node("python_reduce_and_stitch", node_python_reduce_and_stitch)
    workflow.add_node("mcq_validator_and_hitl", node_mcq_validator_and_hitl)
    workflow.add_node("export_artifacts", node_export_artifacts)

    workflow.add_edge(START, "dispatch_map_entry")
    workflow.add_conditional_edges(
        "dispatch_map_entry", node_dispatch_parallel_map, ["parallel_extract_worker"]
    )
    workflow.add_edge("parallel_extract_worker", "python_reduce_and_stitch")
    workflow.add_edge("python_reduce_and_stitch", "mcq_validator_and_hitl")
    workflow.add_edge("mcq_validator_and_hitl", "export_artifacts")
    workflow.add_edge("export_artifacts", END)

    return workflow.compile()
