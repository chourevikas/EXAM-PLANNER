import io
import base64
import asyncio
from typing import List, Optional
from PIL import Image
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage, SystemMessage
from app.llm.factory import get_vision_llm


class ExtractedAnswerKeyItem(BaseModel):
    printed_question_number: int = Field(
        description="Question number as printed in the answer key grid e.g. 1, 2, 3"
    )
    correct_option_label: str = Field(
        description="Correct choice option label e.g. 'A', 'B', 'C', 'D'"
    )
    confidence_score: float = Field(
        default=1.0, description="Extraction confidence score 0.0 to 1.0"
    )


class AnswerKeyPagePayload(BaseModel):
    detected_paper_set_code: str = Field(
        default="UNKNOWN",
        description="Detected Question Paper Set / Series Code from page header e.g. 'SET_A', 'SET_B', 'SET_C', 'SET_D', 'ALL_SETS'",
    )
    is_answer_key_table: bool = Field(
        default=True, description="True if page contains an answer key grid or table"
    )
    extracted_keys: List[ExtractedAnswerKeyItem] = Field(
        default=[], description="List of extracted question answer keys"
    )


def encode_pil_image(img: Image.Image) -> str:
    buffered = io.BytesIO()
    img.save(buffered, format="JPEG", quality=90)
    return base64.b64encode(buffered.getvalue()).decode("utf-8")


async def ainvoke_answer_key_llm(
    image: Image.Image, page_num: int, target_set_code: str = "SET_A"
) -> AnswerKeyPagePayload:
    """Asynchronously invokes Vision LLM to extract Answer Key table & detect Paper Set Code (Set A, B, C, D)."""
    base64_img = await asyncio.to_thread(encode_pil_image, image)

    system_prompt = f"""
    You are an expert Document AI Engine specializing in Competitive Exam Answer Key Parsing. Processing Page {page_num}.
    TARGET PAPER SET CODE: '{target_set_code}'

    PAPER SET IDENTIFICATION & EXTRACTION LAWS:
    1. Inspect the top header, title, or table column headers to identify the Question Paper Set Code:
       - Examples: "SET A", "BOOKLET SERIES A", "CODE 01", "SET B", "SERIES C", "SET D".
       - Normalize detected set codes into uppercase tokens e.g. 'SET_A', 'SET_B', 'SET_C', 'SET_D'.
    2. TARGET SET FILTERING:
       - If the page clearly specifies a paper set code that is DIFFERENT from target '{target_set_code}' (and not 'ALL_SETS'), set `detected_paper_set_code` to the detected set (e.g. 'SET_B') and return empty `extracted_keys` list [].
    3. KEY EXTRACTION:
       - Extract question numbers and their corresponding correct option letters (A, B, C, D).
       - Normalize option letters to uppercase ('A', 'B', 'C', 'D').
    """

    message = HumanMessage(
        content=[
            {
                "type": "text",
                "text": f"Inspect Page {page_num} for target paper set '{target_set_code}' and extract answer keys.",
            },
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{base64_img}",
                    "detail": "high",
                },
            },
        ]
    )

    llm = get_vision_llm().with_structured_output(AnswerKeyPagePayload)
    return await llm.ainvoke([SystemMessage(content=system_prompt), message])
