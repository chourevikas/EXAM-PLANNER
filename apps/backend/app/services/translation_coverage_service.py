"""Translation coverage per exam and language (English, Hindi, Marathi) for the admin Translations view.

For each exam it counts how many questions, options, explanations and option analyses exist in each
language. English is the source. A Hindi/Marathi question or option text identical to the English
counts as untranslated when it contains English words (a failed translation saved as a copy); numbers,
sequences like "3, 4, 1, 2" and formulas rightly stay the same and count as translated. Explanations
and analyses are measured against how many exist in English.
"""
import re
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, func
from sqlalchemy.orm import aliased
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.languages import get_active_translation_languages
from app.db.models import Exam, LanguageCode, OptionTranslation, Question, QuestionOption, QuestionTranslation
from app.db.models.enums import QuestionStatus
from app.db.models.explanation import QuestionExplanation
from app.db.models.pipeline_run import PipelineRun

KINDS = ("questions", "options", "explanations", "analyses")
# An ordinary English word: three or more lowercase letters in a row ("only", "Sarkar"), which a
# number, a sequence or a formula like NaHCO3 / SARS-CoV-2 doesn't have
_ENGLISH_WORD = re.compile(r"[a-z]{3,}")
TRANSLATION_PIPELINE = "QUESTION_TRANSLATION"


def _lang_key(lang: Any) -> str:
    return lang.value if hasattr(lang, "value") else str(lang)


def _live_question():
    """Questions that count: not rejected, in a real paper (not a generated subject-wise test)."""
    return and_(col(Question.status) != QuestionStatus.REJECTED, ~col(Exam.code).like("DYN_%"))


def _subtract_copies(counts: Dict[Tuple[int, str], int], copies) -> None:
    """Takes out rows that are an untranslated copy of the English (they contain English words)."""
    for exam_id, lang, text in copies:
        if text and _ENGLISH_WORD.search(text):
            key = (exam_id, _lang_key(lang))
            counts[key] = max(0, counts.get(key, 0) - 1)


async def _grouped(session: AsyncSession, stmt) -> Dict[Tuple[int, str], int]:
    return {(exam_id, _lang_key(lang)): int(n or 0) for exam_id, lang, n in (await session.exec(stmt)).all()}


async def coverage(session: AsyncSession) -> Dict[str, Any]:
    languages = get_active_translation_languages()
    enums = [LanguageCode[l.enum_name] for l in languages]
    enum_to_code = {l.enum_name: l.code for l in languages}

    exams = (await session.exec(
        select(Exam.id, Exam.name, Exam.code, func.count(Question.id))
        .join(Question, col(Question.exam_id) == col(Exam.id))
        .where(_live_question())
        .group_by(Exam.id, Exam.name, Exam.code)
    )).all()
    options_total = dict((await session.exec(
        select(Question.exam_id, func.count(QuestionOption.id))
        .join(QuestionOption, col(QuestionOption.question_id) == col(Question.id))
        .join(Exam, col(Exam.id) == col(Question.exam_id))
        .where(_live_question())
        .group_by(Question.exam_id)
    )).all())

    # Question text: English rows count as is; other languages only when the text differs from English
    q_rows = await _grouped(session, (
        select(Question.exam_id, QuestionTranslation.language, func.count(func.distinct(QuestionTranslation.question_id)))
        .join(Question, col(Question.id) == col(QuestionTranslation.question_id))
        .join(Exam, col(Exam.id) == col(Question.exam_id))
        .where(
            _live_question(),
            col(QuestionTranslation.language).in_(enums),
            func.length(func.trim(QuestionTranslation.question_text)) > 0,
        )
        .group_by(Question.exam_id, QuestionTranslation.language)
    ))
    q_en = aliased(QuestionTranslation)
    _subtract_copies(q_rows, (await session.exec(
        select(Question.exam_id, QuestionTranslation.language, QuestionTranslation.question_text)
        .join(Question, col(Question.id) == col(QuestionTranslation.question_id))
        .join(Exam, col(Exam.id) == col(Question.exam_id))
        .join(q_en, and_(col(q_en.question_id) == col(QuestionTranslation.question_id), col(q_en.language) == LanguageCode.ENGLISH))
        .where(
            _live_question(),
            col(QuestionTranslation.language).in_([e for e in enums if e != LanguageCode.ENGLISH]),
            col(QuestionTranslation.question_text) == col(q_en.question_text),
        )
    )).all())
    o_rows = await _grouped(session, (
        select(Question.exam_id, OptionTranslation.language, func.count(func.distinct(OptionTranslation.option_id)))
        .join(QuestionOption, col(QuestionOption.id) == col(OptionTranslation.option_id))
        .join(Question, col(Question.id) == col(QuestionOption.question_id))
        .join(Exam, col(Exam.id) == col(Question.exam_id))
        .where(
            _live_question(),
            col(OptionTranslation.language).in_(enums),
            func.length(func.trim(OptionTranslation.option_text)) > 0,
        )
        .group_by(Question.exam_id, OptionTranslation.language)
    ))
    o_en = aliased(OptionTranslation)
    _subtract_copies(o_rows, (await session.exec(
        select(Question.exam_id, OptionTranslation.language, OptionTranslation.option_text)
        .join(QuestionOption, col(QuestionOption.id) == col(OptionTranslation.option_id))
        .join(Question, col(Question.id) == col(QuestionOption.question_id))
        .join(Exam, col(Exam.id) == col(Question.exam_id))
        .join(o_en, and_(col(o_en.option_id) == col(OptionTranslation.option_id), col(o_en.language) == LanguageCode.ENGLISH))
        .where(
            _live_question(),
            col(OptionTranslation.language).in_([e for e in enums if e != LanguageCode.ENGLISH]),
            col(OptionTranslation.option_text) == col(o_en.option_text),
        )
    )).all())
    e_rows = await _grouped(session, (
        select(Question.exam_id, QuestionExplanation.language, func.count(func.distinct(QuestionExplanation.question_id)))
        .join(Question, col(Question.id) == col(QuestionExplanation.question_id))
        .join(Exam, col(Exam.id) == col(Question.exam_id))
        .where(
            _live_question(),
            col(QuestionExplanation.language).in_(enums),
            func.length(func.trim(QuestionExplanation.detailed_solution)) > 0,
        )
        .group_by(Question.exam_id, QuestionExplanation.language)
    ))
    a_rows = await _grouped(session, (
        select(Question.exam_id, OptionTranslation.language, func.count(func.distinct(OptionTranslation.option_id)))
        .join(QuestionOption, col(QuestionOption.id) == col(OptionTranslation.option_id))
        .join(Question, col(Question.id) == col(QuestionOption.question_id))
        .join(Exam, col(Exam.id) == col(Question.exam_id))
        .where(
            _live_question(),
            col(OptionTranslation.language).in_(enums),
            func.length(func.trim(OptionTranslation.distractor_analysis)) > 0,
        )
        .group_by(Question.exam_id, OptionTranslation.language)
    ))

    runs: Dict[int, PipelineRun] = {
        r.exam_id: r for r in (await session.exec(
            select(PipelineRun).where(PipelineRun.pipeline_type == TRANSLATION_PIPELINE)
        )).all()
    }

    def counts_for(exam_id: int) -> Dict[str, Dict[str, int]]:
        out = {}
        for enum_name, code in enum_to_code.items():
            out[code] = {
                "questions": q_rows.get((exam_id, enum_name), 0),
                "options": o_rows.get((exam_id, enum_name), 0),
                "explanations": e_rows.get((exam_id, enum_name), 0),
                "analyses": a_rows.get((exam_id, enum_name), 0),
            }
        return out

    rows: List[Dict[str, Any]] = []
    totals = {"questions": 0, "options": 0, "by_language": {code: {k: 0 for k in KINDS} for code in enum_to_code.values()}}
    for exam_id, name, code, n_questions in exams:
        n_options = int(options_total.get(exam_id, 0) or 0)
        by_language = counts_for(exam_id)
        missing = _missing(n_questions, n_options, by_language)
        run = runs.get(exam_id)
        rows.append({
            "exam_id": exam_id,
            "name": name,
            "code": code,
            "questions": int(n_questions),
            "options": n_options,
            "by_language": by_language,
            "missing": missing,
            "translation_run": {
                "status": run.status,
                "step": run.current_step,
                "progress_percent": run.progress_percent,
                "error": run.error_log if run.status == "FAILED" else None,
                "completed_at": run.completed_at.isoformat() if run.completed_at else None,
            } if run else None,
        })
        totals["questions"] += int(n_questions)
        totals["options"] += n_options
        for lang_code, kinds in by_language.items():
            for k, v in kinds.items():
                totals["by_language"][lang_code][k] += v

    rows.sort(key=lambda r: (-r["missing"], r["name"] or ""))
    totals["missing"] = sum(r["missing"] for r in rows)
    return {
        "languages": [{"code": l.code, "name": l.name, "native_name": l.native_name} for l in languages],
        "totals": totals,
        "exams": rows,
    }


def _missing(n_questions: int, n_options: int, by_language: Dict[str, Dict[str, int]]) -> int:
    """How many items are still to translate into the non-English languages."""
    en = by_language.get("en", {})
    gap = 0
    for code, kinds in by_language.items():
        if code == "en":
            continue
        gap += max(0, n_questions - kinds["questions"])
        gap += max(0, n_options - kinds["options"])
        gap += max(0, en.get("explanations", 0) - kinds["explanations"])
        gap += max(0, en.get("analyses", 0) - kinds["analyses"])
    return gap


async def is_translating(session: AsyncSession, exam_id: Optional[int] = None) -> bool:
    stmt = select(func.count(PipelineRun.id)).where(
        PipelineRun.pipeline_type == TRANSLATION_PIPELINE, PipelineRun.status == "RUNNING"
    )
    if exam_id is not None:
        stmt = stmt.where(PipelineRun.exam_id == exam_id)
    return bool((await session.exec(stmt)).one())
