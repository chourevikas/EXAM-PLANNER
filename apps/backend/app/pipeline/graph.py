import asyncio
from pathlib import Path
from typing import List, Dict, Tuple, Optional, Any
from sqlmodel import select
from langgraph.graph import StateGraph, END, START

from app.db.session import managed_async_session
from app.db.models import (
    Exam,
    Question,
    QuestionStatus,
)
from app.storage.factory import get_storage_provider
from app.pipeline.state import OverallPipelineState
from app.pipeline.docling_ocr_extractor import DoclingOcrExtractor
from app.pipeline.regex_question_parser import (
    detect_format,
    split_into_question_blocks,
    parse_question_block,
    QuestionRecord,
)
from app.pipeline.batch_processor import BatchQuestionRegistrar
from app.config.logger import setup_logger, TaskLoggerAdapter

logger = setup_logger("ExamPipeline")


async def node_ocr_convert(state: OverallPipelineState) -> dict:
    """Performs whole-document OCR conversion via Docling in a single pass."""
    t_id = state.get("task_id", "N/A")
    log = TaskLoggerAdapter(logger, task_id=t_id)

    # If full_markdown was already provided (e.g. testing or pre-converted), preserve it
    if state.get("full_markdown"):
        log.info("📄 [OCR CONVERT] Using pre-populated markdown and assets.")
        return {
            "full_markdown": state["full_markdown"],
            "docling_pictures": state.get("docling_pictures") or [],
            "docling_tables": state.get("docling_tables") or [],
            "docling_page_images": state.get("docling_page_images") or {},
        }

    from app.utils.pdf_utils import ensure_local_pdf

    raw_pdf_path = state["pdf_path"]
    local_pdf = await ensure_local_pdf(raw_pdf_path)
    log.info(f"📄 [DOCLING OCR] Extracting full document from {local_pdf}...")
    extractor = DoclingOcrExtractor()

    # Run blocking conversion in threadpool executor to keep event loop responsive
    loop = asyncio.get_running_loop()
    ocr_result = await loop.run_in_executor(None, extractor.extract, str(local_pdf))

    log.info(
        f"✅ [DOCLING OCR COMPLETED] Markdown size: {len(ocr_result['full_markdown'])} chars, "
        f"{len(ocr_result['pictures'])} pictures, {len(ocr_result['tables'])} tables."
    )

    return {
        "full_markdown": ocr_result["full_markdown"],
        "docling_pictures": ocr_result["pictures"],
        "docling_tables": ocr_result["tables"],
        "docling_page_images": ocr_result["page_images"],
    }


async def node_regex_parse_and_stitch(state: OverallPipelineState) -> dict:
    """Parses markdown into questions, options, explanations, and reverse logic, then commits to DB."""
    t_id = state.get("task_id", "N/A")
    log = TaskLoggerAdapter(logger, task_id=t_id)
    exam_id = (
        int(state["exam_id"])
        if isinstance(state["exam_id"], (str, int))
        else state["exam_id"]
    )

    full_md = state.get("full_markdown") or ""
    detected_fmt = detect_format(full_md)
    log.info(f"🔍 [FORMAT DETECTION] Detected format: '{detected_fmt}'")

    if detected_fmt != "EXPLAINED_QA":
        log.warning(
            f"⚠️ [NON-EXPLAINED_QA FORMAT] Detected format '{detected_fmt}' does not contain embedded solutions. "
            "Questions will be parsed with basic fallback."
        )

    # Split document on Q<N> headers
    blocks = split_into_question_blocks(full_md)
    log.info(f"🧩 [QUESTION BLOCKS] Found {len(blocks)} question block(s).")

    pictures = state.get("docling_pictures") or []
    tables = state.get("docling_tables") or []
    page_images = state.get("docling_page_images") or {}

    records: List[QuestionRecord] = []
    num_blocks = len(blocks)

    for idx, block in enumerate(blocks):
        next_block = blocks[idx + 1] if idx + 1 < num_blocks else None
        next_q_start_page = next_block["start_page"] if next_block else None

        rec = parse_question_block(
            block=block,
            pictures=pictures,
            tables=tables,
            next_q_start_page=next_q_start_page,
        )
        records.append(rec)

    # Commit records in chunks of 10
    storage = get_storage_provider()
    registrar = BatchQuestionRegistrar(batch_size=10)
    summary = await registrar.commit_question_records_in_batches(
        exam_id=exam_id,
        records=records,
        page_images=page_images,
        storage=storage,
    )

    log.info(
        f"💾 [STITCH & COMMIT COMPLETE] Successfully processed {summary.total_processed_questions} questions for Exam {exam_id}."
    )

    return {
        "detected_format": detected_fmt,
        "question_records": records,
        "processed_question_keys": summary.processed_question_keys,
    }


async def node_mcq_validator_and_hitl(state: OverallPipelineState) -> dict:
    """Marks committed questions with human review status where appropriate."""
    exam_id = (
        int(state["exam_id"])
        if isinstance(state["exam_id"], (str, int))
        else state["exam_id"]
    )
    processed_keys = state.get("processed_question_keys") or []

    async with managed_async_session() as session:
        for key_str in processed_keys:
            if "::" in key_str:
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
                if q and q.status != QuestionStatus.PENDING_HUMAN_REVIEW:
                    q.status = QuestionStatus.PENDING_HUMAN_REVIEW
                    session.add(q)
        await session.commit()

    return {}


async def node_export_artifacts(state: OverallPipelineState) -> dict:
    """Final pipeline stage for logging artifacts export and completion."""
    t_id = state.get("task_id", "N/A")
    log = TaskLoggerAdapter(logger, task_id=t_id)
    log.info("🎉 [DOCUMENT EXTRACTION COMPLETE] All questions, options, explanations, and assets successfully registered.")
    return {}


def build_langgraph_pipeline():
    """Builds the single deterministic document extraction LangGraph workflow."""
    workflow = StateGraph(OverallPipelineState)

    workflow.add_node("ocr_convert", node_ocr_convert)
    workflow.add_node("regex_parse_and_stitch", node_regex_parse_and_stitch)
    workflow.add_node("mcq_validator_and_hitl", node_mcq_validator_and_hitl)
    workflow.add_node("export_artifacts", node_export_artifacts)

    workflow.add_edge(START, "ocr_convert")
    workflow.add_edge("ocr_convert", "regex_parse_and_stitch")
    workflow.add_edge("regex_parse_and_stitch", "mcq_validator_and_hitl")
    workflow.add_edge("mcq_validator_and_hitl", "export_artifacts")
    workflow.add_edge("export_artifacts", END)

    return workflow.compile()
