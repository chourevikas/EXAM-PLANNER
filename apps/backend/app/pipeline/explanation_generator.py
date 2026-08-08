import asyncio
from typing import Dict, Any, List, Optional
from langchain_core.messages import SystemMessage, HumanMessage
from app.llm.factory import get_vision_llm
from app.pipeline.explanation_schema import QuestionExplanationSchema
from app.db.models.enums import LanguageCode


async def ainvoke_explanation_llm(
    question_text: str,
    options: List[Dict[str, Any]],
    correct_option_label: Optional[str] = None,
    passage_text: Optional[str] = None,
    language: LanguageCode = LanguageCode.ENGLISH,
) -> QuestionExplanationSchema:
    """Invokes LLM agent to generate static Question Knowledge Base & Option Distractor Analysis."""

    formatted_options = "\n".join(
        [
            f"- Option {opt['option_label']}: {opt['option_text']}"
            + (" (Marked as Correct Answer in DB)" if opt.get("is_correct") else "")
            for opt in options
        ]
    )

    correct_key_str = (
        f"Correct Answer Option: '{correct_option_label}'"
        if correct_option_label
        else "Identify the correct option based on standard domain principles."
    )

    passage_str = (
        f"\nCONTEXT / PASSAGE:\n{passage_text}\n" if passage_text else ""
    )

    system_prompt = f"""
    You are an elite Academic Subject Matter Expert and Pedagogical AI Engine for Competitive Examinations.
    Generate a high-yield, comprehensive Question Knowledge Base and Option-by-Option Distractor Analysis in {language.value}.

    EXPLANATION LAWS:
    1. CORE CONCEPT: Identify the single primary law, theorem, formula, or principle tested in 1 clear sentence.
    2. DETAILED SOLUTION: Provide step-by-step mathematical derivation, logical deduction, or textual proof showing exactly how the problem is solved. Use LaTeX math ($...$ or $$...$$) where applicable.
    3. OPTIONS BREAKDOWN: Analyze EVERY option choice:
       - For the correct option: Explain the precise mathematical or conceptual reason why it is right.
       - For incorrect options (distractors): Pinpoint the exact cognitive trap, formula misapplication, sign error, or misconception that leads a student to select it.
    4. COMMON TRAPS: List common mistakes or calculation errors students make on this question.
    5. KEY TAKEAWAYS: Provide 1-2 bullet points for last-minute exam revision.
    6. TAXONOMY TAGS: Infer Subject (e.g. Physics, History, Quantitative Aptitude), Topic, Subtopic, and Difficulty (Easy, Medium, Hard).
    """

    user_content = f"""
    {passage_str}
    QUESTION STATEMENT:
    {question_text}

    OPTIONS:
    {formatted_options}

    {correct_key_str}
    """

    message = HumanMessage(content=user_content)
    llm = get_vision_llm().with_structured_output(QuestionExplanationSchema)

    return await llm.ainvoke([SystemMessage(content=system_prompt), message])


async def ainvoke_translate_explanation_llm(
    english_schema: QuestionExplanationSchema,
    target_language: LanguageCode,
) -> QuestionExplanationSchema:
    """Translates an English QuestionExplanationSchema into target_language (e.g. HINDI, TAMIL, MARATHI)."""
    if target_language == LanguageCode.ENGLISH:
        return english_schema

    system_prompt = f"""
    You are an expert Academic Translator for Competitive Exam Content.
    Translate the provided English Question Knowledge Base & Option Distractor Analysis into {target_language.value}.

    TRANSLATION LAWS:
    1. Preserve all mathematical formulas, numbers, LaTeX syntax ($...$, $$...$$), and chemical symbols exactly.
    2. Translate technical terms, explanations, traps, takeaways, and subject/topic taxonomy accurately into {target_language.value}.
    3. Ensure option_key ('A', 'B', 'C', 'D') and is_correct flags remain identical.
    """

    user_content = f"""
    EXPLANATION TO TRANSLATE INTO {target_language.value}:
    {english_schema.model_dump_json(indent=2)}
    """

    message = HumanMessage(content=user_content)
    llm = get_vision_llm().with_structured_output(QuestionExplanationSchema)

    return await llm.ainvoke([SystemMessage(content=system_prompt), message])
