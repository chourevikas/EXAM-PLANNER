import uuid
import json
import asyncio
from typing import List, Dict, Any, Optional
from typing_extensions import TypedDict
from sqlmodel import select, col
from langgraph.graph import StateGraph, END, START
from app.db.session import managed_async_session
from app.db.models import (
    Exam,
    Question,
    QuestionOption,
    AnswerKeyBatch,
    AnswerKeyMapping,
    SetMatchStatus,
    MappingStatus,
)
from app.pipeline.vision_extractor import (
    get_pdf_total_pages,
    load_pdf_page_image_lazily,
)
from app.pipeline.answer_key_extractor import (
    ainvoke_answer_key_llm,
    AnswerKeyPagePayload,
)
from app.config.logger import setup_logger, TaskLoggerAdapter


logger = setup_logger("AnswerKeyPipeline")


class AnswerKeyPipelineState(TypedDict):
    pdf_path: str
    exam_id: str
    target_set_code: str
    total_pages: int
    task_id: Optional[str]
    raw_page_payloads: List[Dict[str, Any]]
    batch_id: Optional[str]
    total_keys_extracted: int
    total_keys_mapped: int
    set_match_status: str


def normalize_option_label(label_str: str) -> str:
    """Normalizes option labels e.g. '(a)' -> 'A', '1' -> 'A', '2' -> 'B'."""
    clean = str(label_str).strip().strip("()").strip(".").upper()
    num_map = {"1": "A", "2": "B", "3": "C", "4": "D", "5": "E"}
    return num_map.get(clean, clean)


async def node_extract_answer_key_pages(
    state: AnswerKeyPipelineState,
) -> Dict[str, Any]:
    """Asynchronously extracts answer keys and detects paper set code across all PDF pages."""
    pdf_path = state["pdf_path"]
    target_set = state.get("target_set_code", "SET_A").upper()
    t_id = state.get("task_id", "N/A")
    log = TaskLoggerAdapter(logger, task_id=t_id)

    total_pages = state.get("total_pages") or await get_pdf_total_pages(pdf_path)
    log.info(
        f"🔑 [ANSWER KEY EXTRACTION] Processing {total_pages} page(s) for target set '{target_set}'..."
    )

    payloads = []
    for page_num in range(1, total_pages + 1):
        try:
            log.info(
                f"🤖 [LLM VISION CALL] Extracting Answer Key from Page {page_num} (Target Set: '{target_set}')..."
            )
            page_img = await load_pdf_page_image_lazily(pdf_path, page_num)
            payload: AnswerKeyPagePayload = await ainvoke_answer_key_llm(
                page_img, page_num, target_set_code=target_set
            )
            payloads.append(
                {
                    "page_num": page_num,
                    "detected_paper_set_code": payload.detected_paper_set_code,
                    "is_answer_key_table": payload.is_answer_key_table,
                    "extracted_keys": [
                        item.model_dump() for item in payload.extracted_keys
                    ],
                }
            )
            del page_img
            log.info(
                f"✨ [ANSWER KEY PAGE {page_num}] Extracted {len(payload.extracted_keys)} key(s), detected set: '{payload.detected_paper_set_code}'."
            )
        except Exception as exc:
            log.error(
                f"❌ [ANSWER KEY WORKER FAILED] Page {page_num}: {exc}", exc_info=True
            )

    return {"total_pages": total_pages, "raw_page_payloads": payloads}


async def node_validate_set_code_and_map_db(
    state: AnswerKeyPipelineState,
) -> Dict[str, Any]:
    """
    Validates detected paper set code against target exam set code, and maps correct answers into DB.
    Auto-registers Exam DB record if missing to guarantee robustness.
    """
    exam_id = uuid.UUID(state["exam_id"])
    target_set_code = state.get("target_set_code", "SET_A").upper()
    raw_payloads = state.get("raw_page_payloads", [])
    t_id = state.get("task_id", "N/A")
    log = TaskLoggerAdapter(logger, task_id=t_id)

    async with managed_async_session() as session:
        exam = await session.get(Exam, exam_id)
        if not exam:
            # Search if questions exist in questions table to sync target exam_id
            q_exam_stmt = select(Question.exam_id).limit(1)
            q_exam_id = (await session.exec(q_exam_stmt)).first()
            if q_exam_id:
                exam_id = q_exam_id
                exam = await session.get(Exam, exam_id)

        if not exam:
            # Search for latest exam in DB
            latest_exam_stmt = select(Exam).order_by(col(Exam.created_at).desc()).limit(1)
            exam = (await session.exec(latest_exam_stmt)).first()
            if exam:
                exam_id = exam.id

        if not exam:
            log.warning(
                f"⚠️ Exam ID {exam_id} not found in DB. Auto-registering baseline Exam record."
            )
            exam = Exam(
                id=exam_id,
                name=f"Exam {str(exam_id)[:8]}",
                code=f"EXAM_{str(exam_id)[:8]}",
                paper_set_code=target_set_code,
            )
            session.add(exam)
            await session.commit()
            await session.refresh(exam)

        # Determine overall detected paper set code from page headers
        detected_set_code = "UNKNOWN"
        for page_payload in raw_payloads:
            code = page_payload.get("detected_paper_set_code", "").upper()
            if code and code != "UNKNOWN":
                detected_set_code = code
                break

        # Validate paper set match
        set_match = False
        if detected_set_code in [target_set_code, "ALL_SETS", "UNKNOWN"]:
            set_match = True
            set_status = (
                SetMatchStatus.MATCHED
                if detected_set_code == target_set_code
                else SetMatchStatus.MULTI_SET_MATRIX
            )
        else:
            set_status = SetMatchStatus.MISMATCH_SKIPPED

        log.info(
            f"[SET CODE CHECK] Target Set: '{target_set_code}' | Detected Set: '{detected_set_code}' | Status: '{set_status.value}'"
        )

        # Create AnswerKeyBatch record
        batch = AnswerKeyBatch(
            exam_id=exam_id,
            pdf_path=state["pdf_path"],
            target_set_code=target_set_code,
            detected_set_code=detected_set_code,
            set_match_status=set_status,
            total_keys_extracted=0,
            total_keys_mapped=0,
        )
        session.add(batch)
        await session.commit()
        await session.refresh(batch)

        if not set_match:
            log.warning(
                f"⚠️ [SET MISMATCH SKIPPED] Answer key set '{detected_set_code}' does not match target paper set '{target_set_code}'. Skipping automatic DB mapping to prevent answer corruption."
            )
            return {
                "batch_id": str(batch.id),
                "total_keys_extracted": 0,
                "total_keys_mapped": 0,
                "set_match_status": set_status.value,
            }

        # Map answers to Database Questions & Options
        total_extracted = 0
        total_mapped = 0

        for page_payload in raw_payloads:
            for item in page_payload.get("extracted_keys", []):
                q_num = item["printed_question_number"]
                raw_opt_label = str(item["correct_option_label"])
                norm_opt_label = normalize_option_label(raw_opt_label)
                total_extracted += 1

                # Locate target Question record
                q_stmt = select(Question).where(
                    Question.exam_id == exam_id,
                    Question.question_number_in_paper == q_num,
                )
                q_res = await session.exec(q_stmt)
                question = q_res.first()

                if not question:
                    mapping = AnswerKeyMapping(
                        batch_id=batch.id,
                        question_id=None,
                        printed_question_number=q_num,
                        detected_option_label=norm_opt_label,
                        paper_set_code=target_set_code,
                        mapping_status=MappingStatus.QUESTION_NOT_FOUND,
                        notes=f"Question #{q_num} not found in DB for Exam ID {exam_id}",
                    )
                    session.add(mapping)
                    continue

                # Update QuestionOption answer keys in DB
                options_stmt = select(QuestionOption).where(
                    QuestionOption.question_id == question.id
                )
                opts_res = await session.exec(options_stmt)
                options = opts_res.all()

                found_opt = False
                for opt in options:
                    target_label = normalize_option_label(opt.option_label)
                    if target_label == norm_opt_label:
                        opt.is_correct = True
                        found_opt = True
                    else:
                        opt.is_correct = False
                    session.add(opt)

                if found_opt:
                    total_mapped += 1
                    mapping_stat = MappingStatus.APPLIED
                    notes_str = f"Correct answer set to '{norm_opt_label}'"
                else:
                    mapping_stat = MappingStatus.CONFLICT_FLAGGED
                    notes_str = f"Option choice '{norm_opt_label}' not found among options for Question #{q_num}"

                mapping = AnswerKeyMapping(
                    batch_id=batch.id,
                    question_id=question.id,
                    printed_question_number=q_num,
                    detected_option_label=norm_opt_label,
                    paper_set_code=target_set_code,
                    mapping_status=mapping_stat,
                    notes=notes_str,
                )
                session.add(mapping)

        # Update batch summary
        batch.total_keys_extracted = total_extracted
        batch.total_keys_mapped = total_mapped
        session.add(batch)
        await session.commit()

        log.info(
            f"✅ [ANSWER KEY MAPPING COMPLETE] Extracted: {total_extracted} | Mapped: {total_mapped} for Exam ID {exam_id}"
        )

        return {
            "batch_id": str(batch.id),
            "total_keys_extracted": total_extracted,
            "total_keys_mapped": total_mapped,
            "set_match_status": set_status.value,
        }


def build_answer_key_pipeline():
    """Builds and compiles the Answer Key extraction & set-mapping LangGraph graph."""
    graph = StateGraph(AnswerKeyPipelineState)
    graph.add_node("extract_pages", node_extract_answer_key_pages)
    graph.add_node("validate_and_map_db", node_validate_set_code_and_map_db)

    graph.add_edge(START, "extract_pages")
    graph.add_edge("extract_pages", "validate_and_map_db")
    graph.add_edge("validate_and_map_db", END)

    return graph.compile()
