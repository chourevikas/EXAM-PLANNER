import json
from langchain_core.messages import HumanMessage, SystemMessage
from app.llm.factory import get_vision_llm
from app.pipeline.state import MCQValidationResult


async def ainvoke_mcq_validator_llm(
    sec_code: str,
    q_num: int,
    q_text: str,
    options: list[str],
    passage_text: str,
    failure_reasons: list[str],
) -> MCQValidationResult:
    """Async read-only audit call evaluating extraction quality."""
    prompt = f"""
    Audit extracted Question '{sec_code}' Q#{q_num}:
    
    [FLAGGED REASONS]: {", ".join(failure_reasons)}
    [PASSAGE CONTEXT]: {passage_text if passage_text else "None"}
    [QUESTION TEXT]: {q_text}
    [EXTRACTED OPTIONS]: {json.dumps(options)}
    
    Evaluate structure and classify as:
    1. 'PUBLISHED': Valid complete MCQ (formatting differences are allowed).
    2. 'NON_MCQ_FALLBACK': Descriptive, essay, subjective, or fill-in-the-blank question format.
    3. 'INCOMPLETE_RETRY_NEEDED': Missing crucial question text, options, or context.
    """
    llm = get_vision_llm().with_structured_output(MCQValidationResult)
    return await llm.ainvoke(
        [
            SystemMessage(
                content="You are a strict read-only audit evaluator for exam extraction quality."
            ),
            HumanMessage(content=prompt),
        ]
    )
