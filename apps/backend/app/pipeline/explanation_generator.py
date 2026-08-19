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
    """Invokes LLM agent to generate static Question Knowledge Base & Option Distractor Analysis strictly in English."""

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

    system_prompt = """
    You are an elite Academic Subject Matter Expert and Psychometric Analysis AI Engine for Competitive Examinations.
    Analyze the provided question statement and option choices (which may be in English or a non-English language like Hindi/Marathi/Tamil).
    
    CRITICAL MANDATE: ALL YOUR OUTPUT FIELDS MUST BE STRICTLY IN ENGLISH.
    Do not output explanations in non-English languages. Read and comprehend the question in whatever language it is written in, but output all analyses, derivations, breakdown text, and taxonomy tags strictly in ENGLISH.

    EXPLANATION LAWS:
    1. CORE CONCEPT: Identify the single primary law, theorem, formula, or principle tested in 1 clear English sentence.
    2. DETAILED SOLUTION: Provide step-by-step mathematical derivation, logical deduction, or textual proof in English showing exactly how the problem is solved. Use LaTeX math ($...$ or $$...$$) where applicable.
    3. OPTIONS BREAKDOWN & CLOSENESS SCORES: Analyze EVERY option choice (A, B, C, D):
       - For the correct option: Set is_correct=True, closeness_score=1.00, and explain the precise reason why it is right.
       - For incorrect options (distractors): Set closeness_score between 0.00 and 0.90 based on distractor plausibility (0.65-0.90 for strong/deceptive distractors, 0.35-0.60 for moderate distractors, 0.10-0.30 for weak distractors). Pinpoint the exact conceptual error or trap leading a student to select it.
    4. COMMON TRAPS: List common calculation mistakes or conceptual pitfalls students fall into.
    5. KEY TAKEAWAYS: Provide 1-2 bullet points in English for last-minute exam revision.
    6. TAXONOMY & PSYCHOMETRIC IRT METRICS:
       - Infer Subject, Topic, Subtopic, and Difficulty (Easy, Medium, Hard).
       - Infer Bloom's Taxonomy Level: REMEMBER, UNDERSTAND, APPLY, ANALYZE, or EVALUATE.
       - Estimate 3PL IRT Discrimination parameter 'irt_discrimination_a' (0.5 to 2.5).
       - Estimate 3PL IRT Difficulty parameter 'irt_difficulty_b' (-3.0 to +3.0).
       - Estimate 3PL IRT Pseudo-guessing parameter 'irt_pseudo_guessing_c' (0.05 to 0.25) derived from distractor plausibility.
    """

    user_content = f"""
    {passage_str}
    QUESTION STATEMENT (read in original language, produce output strictly in English):
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
