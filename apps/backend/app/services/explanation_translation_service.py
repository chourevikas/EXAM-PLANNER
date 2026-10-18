"""Translates question explanations and option analyses from English into Hindi and Marathi.

Imported papers get their explanations (and each option's "why it's tempting" analysis) in English
only; question and option text are translated by the translation pipeline. This fills in the
explanations for the exam languages so a Hindi or Marathi session can show them.

- Only missing rows are added. An explanation that already exists in a language (entered by a
  reviewer, an admin or an earlier run) is never overwritten, and an option analysis is only
  filled in where the language's option row has none.
- A translation that comes back unchanged means the translator failed. Nothing is saved for it,
  so the English fallback keeps working and the next run retries it.
- Runs after a paper's questions are translated (QuestionTranslationService.translate_exam) and in
  the nightly translation job, which backfills everything else.
"""
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set, Tuple

from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config.logger import setup_logger
from app.core.languages import ACTIVE_TRANSLATION_LANGUAGE_CODES, normalize_language
from app.db.models import LanguageCode, OptionTranslation, QuestionOption
from app.db.models.explanation import QuestionExplanation

logger = setup_logger("ExplanationTranslation")

TEXT_FIELDS = ("core_concept", "detailed_solution", "common_mistake", "reverse_logic")
LIST_FIELDS = ("common_traps_json", "key_takeaways_json")
QUESTIONS_PER_CHUNK = 50


def _target_languages(target_languages: Optional[Iterable[str]]) -> List[Tuple[str, str]]:
    """(iso, enum) pairs for the exam languages other than English."""
    codes = target_languages or ACTIVE_TRANSLATION_LANGUAGE_CODES
    pairs = []
    for raw in codes:
        iso, enum = normalize_language(raw)
        if iso != "en" and iso in ACTIVE_TRANSLATION_LANGUAGE_CODES and (iso, enum) not in pairs:
            pairs.append((iso, enum))
    return pairs


def _has_text(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


async def translate_explanations(
    session: AsyncSession,
    translator: Any,
    question_ids: Optional[Sequence[int]] = None,
    target_languages: Optional[Iterable[str]] = None,
) -> Dict[str, int]:
    """Adds missing Hindi/Marathi explanations and option analyses for `question_ids` (default: all).

    `translator` needs `translate_batch(texts, target_language=, source_language=)`, like
    GoogleTranslationService. Returns counts: explanations_added, analyses_added, failed.
    """
    targets = _target_languages(target_languages)
    totals = {"explanations_added": 0, "analyses_added": 0, "failed": 0}
    if not targets:
        return totals

    stmt = select(QuestionExplanation).where(QuestionExplanation.language == LanguageCode.ENGLISH)
    if question_ids is not None:
        if not question_ids:
            return totals
        stmt = stmt.where(col(QuestionExplanation.question_id).in_(list(question_ids)))
    english_rows = list((await session.exec(stmt.order_by(col(QuestionExplanation.question_id)))).all())
    english_by_q = {e.question_id: e for e in english_rows if _has_text(e.detailed_solution)}

    # Questions that have option analyses but maybe no explanation are covered too
    a_stmt = (
        select(QuestionOption.question_id)
        .join(OptionTranslation, col(OptionTranslation.option_id) == col(QuestionOption.id))
        .where(OptionTranslation.language == LanguageCode.ENGLISH, col(OptionTranslation.distractor_analysis).is_not(None))
    )
    if question_ids is not None:
        a_stmt = a_stmt.where(col(QuestionOption.question_id).in_(list(question_ids)))
    analysis_q_ids = set((await session.exec(a_stmt.distinct())).all())

    all_q_ids = sorted(set(english_by_q) | analysis_q_ids)
    touched: Set[int] = set()
    for start in range(0, len(all_q_ids), QUESTIONS_PER_CHUNK):
        chunk = all_q_ids[start:start + QUESTIONS_PER_CHUNK]
        counts = await _translate_chunk(session, translator, chunk, english_by_q, targets, touched)
        for key, value in counts.items():
            totals[key] += value

    if touched:
        await _forget_cached_solutions(touched, targets)
    if totals["explanations_added"] or totals["analyses_added"] or totals["failed"]:
        logger.info(
            f"🌐 Explanations translated: {totals['explanations_added']} explanations, "
            f"{totals['analyses_added']} option analyses, {totals['failed']} failed (retried next run)."
        )
    return totals


async def _translate_chunk(
    session: AsyncSession,
    translator: Any,
    q_ids: List[int],
    english_by_q: Dict[int, QuestionExplanation],
    targets: List[Tuple[str, str]],
    touched: Set[int],
) -> Dict[str, int]:
    from app.db.upsert import bulk_insert_on_conflict_do_nothing

    counts = {"explanations_added": 0, "analyses_added": 0, "failed": 0}
    target_enums = [LanguageCode[enum] for _, enum in targets]

    existing: Set[Tuple[int, LanguageCode]] = {
        (qid, lang) for qid, lang in (await session.exec(
            select(QuestionExplanation.question_id, QuestionExplanation.language).where(
                col(QuestionExplanation.question_id).in_(q_ids),
                col(QuestionExplanation.language).in_(target_enums),
            )
        )).all()
    }

    # English option rows with an analysis, and the same options' rows in the target languages
    en_options = (await session.exec(
        select(OptionTranslation, QuestionOption.question_id)
        .join(QuestionOption, col(QuestionOption.id) == col(OptionTranslation.option_id))
        .where(
            col(QuestionOption.question_id).in_(q_ids),
            OptionTranslation.language == LanguageCode.ENGLISH,
            col(OptionTranslation.distractor_analysis).is_not(None),
        )
    )).all()
    en_options = [(ot, qid) for ot, qid in en_options if _has_text(ot.distractor_analysis)]
    target_option_rows: Dict[Tuple[int, LanguageCode], OptionTranslation] = {}
    if en_options:
        for row in (await session.exec(
            select(OptionTranslation).where(
                col(OptionTranslation.option_id).in_([ot.option_id for ot, _ in en_options]),
                col(OptionTranslation.language).in_(target_enums),
            )
        )).all():
            target_option_rows[(row.option_id, row.language)] = row

    for iso, enum in targets:
        lang = LanguageCode[enum]
        missing = [english_by_q[qid] for qid in q_ids if qid in english_by_q and (qid, lang) not in existing]
        # Only fill an analysis where the option text is already translated and has none yet
        pending_analyses = [
            (en_ot, target_option_rows[(en_ot.option_id, lang)], qid)
            for en_ot, qid in en_options
            if (en_ot.option_id, lang) in target_option_rows
            and not _has_text(target_option_rows[(en_ot.option_id, lang)].distractor_analysis)
        ]
        if not missing and not pending_analyses:
            continue

        texts: List[str] = []
        for e in missing:
            texts += [getattr(e, f) for f in TEXT_FIELDS if _has_text(getattr(e, f))]
            for f in LIST_FIELDS:
                texts += [item for item in (getattr(e, f) or []) if _has_text(item)]
        texts += [en_ot.distractor_analysis for en_ot, _, _ in pending_analyses]
        unique = list(dict.fromkeys(texts))
        try:
            translated = await translator.translate_batch(unique, target_language=iso, source_language="en")
        except Exception as err:
            logger.warning(f"Explanation translation into {enum} failed: {err}")
            counts["failed"] += len(missing) + len(pending_analyses)
            continue
        found = dict(zip(unique, translated or []))

        def done(source: str) -> Optional[str]:
            """The translation, or None when the translator returned nothing new (it failed)."""
            result = found.get(source)
            if not _has_text(result) or result.strip() == source.strip():
                return None
            return result

        def keep(source: Any) -> Any:
            """Short fields (names, numbers) can legitimately stay the same; keep the original then."""
            return (done(source) or source) if _has_text(source) else source

        new_rows = []
        for e in missing:
            solution = done(e.detailed_solution)
            if solution is None:
                counts["failed"] += 1
                continue
            new_rows.append(QuestionExplanation(
                question_id=e.question_id,
                language=lang,
                detailed_solution=solution,
                core_concept=keep(e.core_concept),
                common_mistake=keep(e.common_mistake),
                reverse_logic=keep(e.reverse_logic),
                common_traps_json=[keep(item) for item in (e.common_traps_json or [])],
                key_takeaways_json=[keep(item) for item in (e.key_takeaways_json or [])],
            ))
            touched.add(e.question_id)
        if new_rows:
            # A row saved meanwhile (e.g. by a reviewer) wins: never overwritten
            await bulk_insert_on_conflict_do_nothing(session, QuestionExplanation, new_rows, ["question_id", "language"])
            counts["explanations_added"] += len(new_rows)

        for en_ot, target_row, qid in pending_analyses:
            analysis = done(en_ot.distractor_analysis)
            if analysis is None:
                counts["failed"] += 1
                continue
            target_row.distractor_analysis = analysis
            session.add(target_row)
            counts["analyses_added"] += 1
            touched.add(qid)

        await session.commit()
    return counts


async def _forget_cached_solutions(question_ids: Iterable[int], targets: List[Tuple[str, str]]) -> None:
    from app.cache import build_cache_key, get_cache

    cache = get_cache()
    for qid in question_ids:
        for _, enum in targets:
            try:
                await cache.delete(build_cache_key("questions:solution", str(qid), enum))
            except Exception:
                pass
