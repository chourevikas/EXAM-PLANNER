import uuid
import json
import aiofiles
from pathlib import Path
from typing import List, Dict, Tuple, Optional
from sqlmodel import select
from langgraph.graph import StateGraph, END, START
from langgraph.types import Send

from app.db.session import managed_async_session
from app.db.models import (
    Exam,
    Question,
    QuestionStatus,
    Passage,
    PassageTranslation,
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
    exam_id = state.get("exam_id")
    return [
        Send(
            "parallel_extract_worker",
            {
                "page_num": p_num,
                "pdf_path": pdf_path,
                "exam_id": str(exam_id) if exam_id else "",
                "task_id": t_id,
            },
        )
        for p_num in range(1, total_pages + 1)
    ]


async def node_parallel_extract_worker(state: ParallelWorkerInput) -> dict:
    page_num = state["page_num"]
    pdf_path = state["pdf_path"]
    exam_id_str = state.get("exam_id", "")
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
        int(state["exam_id"])
        if isinstance(state["exam_id"], (str, int))
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

    async with managed_async_session() as session:
        for p_data in unified_passages:
            p_id = uuid.uuid4()
            sec_code = p_data.get("section_code", "DEFAULT")

            passage = Passage(
                id=p_id,
                exam_id=exam_id,
                section_code=sec_code,
                memory_type=p_data.get("memory_type", "PASSAGE"),
                is_complete=p_data.get("is_complete", True),
                page_numbers_json=p_data["page_numbers"],
                question_ids_json=[],
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
        int(state["exam_id"])
        if isinstance(state["exam_id"], (str, int))
        else state["exam_id"]
    )
    processed_keys = state["processed_question_keys"]

    async with managed_async_session() as session:
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
            if q:
                q.status = QuestionStatus.PENDING_HUMAN_REVIEW
                session.add(q)
        await session.commit()

    return {}


async def node_export_artifacts(state: OverallPipelineState) -> dict:
    t_id = state.get("task_id", "N/A")
    log = TaskLoggerAdapter(logger, task_id=t_id)
    log.info("🎉 [PIPELINE 1 COMPLETE] All extracted questions and assets successfully registered.")
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
