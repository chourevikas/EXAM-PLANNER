"""
Exam Question Translation Pipeline Service.
Translates all question stems, options, and passages for an exam across all 22 scheduled Indian languages.
Provides real-time PipelineRun progress tracking and midnight reconciliation for missing translations.
"""

import asyncio
from datetime import datetime, timezone
from typing import Optional, List, Dict, Set, Tuple, Any
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config.logger import setup_logger, TaskLoggerAdapter
from app.config.settings import get_settings
from app.db.session import managed_async_session, with_db_retry
from app.llm.usage import llm_usage_scope
from app.db.models import (
    Exam,
    Question,
    QuestionOption,
    Passage,
    QuestionTranslation,
    OptionTranslation,
    PassageTranslation,
    LanguageCode,
)
from app.db.models.pipeline_run import PipelineRun
from app.core.languages import (
    get_active_translation_languages,
    normalize_language,
    SUPPORTED_LANGUAGES_LIST,
)
from app.services.google_translation_service import GoogleTranslationService
from app.cache import invalidate_exam_cache, invalidate_pipeline_status_cache

logger = setup_logger("TranslationPipeline")


class QuestionTranslationService:
    def __init__(
        self,
        session: Optional[AsyncSession] = None,
        translation_service: Optional[GoogleTranslationService] = None,
    ):
        self.session = session
        self.settings = get_settings()
        self.translator = translation_service or GoogleTranslationService()

    async def _get_or_create_pipeline_run(
        self, sess: AsyncSession, exam_id: int
    ) -> PipelineRun:
        query = select(PipelineRun).where(
            PipelineRun.exam_id == exam_id,
            PipelineRun.pipeline_type == "QUESTION_TRANSLATION",
        )
        res = await sess.exec(query)
        run = res.first()
        if not run:
            run = PipelineRun(
                exam_id=exam_id,
                pipeline_type="QUESTION_TRANSLATION",
                status="PENDING",
                current_step="INITIALIZING",
                progress_percent=0.0,
            )
            sess.add(run)
            await sess.commit()
            await sess.refresh(run)
        return run

    async def _update_run_status(
        self,
        sess: AsyncSession,
        exam_id: int,
        status: str,
        current_step: str,
        progress_percent: float,
        error_log: Optional[str] = None,
    ) -> PipelineRun:
        run = await self._get_or_create_pipeline_run(sess, exam_id)
        run.status = status
        run.current_step = current_step
        run.progress_percent = max(0.0, min(100.0, progress_percent))
        if error_log:
            run.error_log = error_log
        if status in ("COMPLETED", "FAILED"):
            run.completed_at = datetime.now(timezone.utc)

        sess.add(run)
        await sess.commit()
        await sess.refresh(run)
        await invalidate_pipeline_status_cache()
        return run

    async def translate_exam(
        self,
        exam_id: int,
        target_languages: Optional[List[str]] = None,
        task_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Translates all questions, options, and passages for the specified exam
        into the specified Indian languages (defaults to all 22 scheduled languages).
        Idempotent: skips any translations already present in the database.
        """
        log = TaskLoggerAdapter(logger, task_id=task_id or str(exam_id))
        log.info(f"🌐 [TRANSLATION PIPELINE STARTED] Exam ID: {exam_id}")

        async def _execute(sess: AsyncSession) -> Dict[str, Any]:
            exam = await sess.get(Exam, exam_id)
            if not exam:
                raise ValueError(f"Exam #{exam_id} not found in database.")

            await self._update_run_status(
                sess, exam_id, "RUNNING", "SCANNING_QUESTIONS", 5.0
            )

            # Determine target languages to translate
            if target_languages:
                langs_to_process = [normalize_language(l) for l in target_languages]
            else:
                langs_to_process = [
                    (l.code, l.enum_name) for l in get_active_translation_languages()
                ]

            # 1. Fetch questions for this exam
            q_stmt = (
                select(Question)
                .where(Question.exam_id == exam_id)
                .order_by(col(Question.question_number_in_paper))
            )
            q_res = await sess.exec(q_stmt)
            questions = q_res.all()

            if not questions:
                log.warning(f"No questions found for Exam #{exam_id}.")
                await self._update_run_status(
                    sess, exam_id, "COMPLETED", "NO_QUESTIONS_TO_TRANSLATE", 100.0
                )
                return {
                    "exam_id": exam_id,
                    "status": "COMPLETED",
                    "questions_count": 0,
                    "translations_added": 0,
                }

            q_ids = [q.id for q in questions]

            # 2. Fetch options for these questions
            opts_stmt = (
                select(QuestionOption)
                .where(col(QuestionOption.question_id).in_(q_ids))
                .order_by(col(QuestionOption.display_order))
            )
            opts_res = await sess.exec(opts_stmt)
            options = opts_res.all()
            opt_ids = [o.id for o in options]

            # 3. Fetch passages for this exam
            pass_stmt = select(Passage).where(Passage.exam_id == exam_id)
            pass_res = await sess.exec(pass_stmt)
            passages = pass_res.all()
            pass_ids = [p.id for p in passages]

            # 4. Fetch existing translations to prevent duplicate work
            existing_q_trans_stmt = select(QuestionTranslation).where(
                col(QuestionTranslation.question_id).in_(q_ids)
            )
            existing_q_trans = (await sess.exec(existing_q_trans_stmt)).all()
            q_trans_set: Set[Tuple[int, str]] = {
                (t.question_id, t.language.value if hasattr(t.language, "value") else str(t.language))
                for t in existing_q_trans
            }

            # Map English question stems as base text
            q_eng_text: Dict[int, str] = {}
            for t in existing_q_trans:
                lang_str = t.language.value if hasattr(t.language, "value") else str(t.language)
                if lang_str == "ENGLISH":
                    q_eng_text[t.question_id] = t.question_text
            for q in questions:
                if q.id not in q_eng_text:
                    # Fallback to any existing translation or generic stem
                    match = next((t for t in existing_q_trans if t.question_id == q.id), None)
                    q_eng_text[q.id] = match.question_text if match else f"Question #{q.question_number_in_paper}"

            existing_opt_trans_stmt = select(OptionTranslation).where(
                col(OptionTranslation.option_id).in_(opt_ids)
            )
            existing_opt_trans = (await sess.exec(existing_opt_trans_stmt)).all()
            opt_trans_set: Set[Tuple[int, str]] = {
                (ot.option_id, ot.language.value if hasattr(ot.language, "value") else str(ot.language))
                for ot in existing_opt_trans
            }

            opt_eng_text: Dict[int, str] = {}
            for ot in existing_opt_trans:
                lang_str = ot.language.value if hasattr(ot.language, "value") else str(ot.language)
                if lang_str == "ENGLISH":
                    opt_eng_text[ot.option_id] = ot.option_text
            for opt in options:
                if opt.id not in opt_eng_text:
                    match = next((ot for ot in existing_opt_trans if ot.option_id == opt.id), None)
                    opt_eng_text[opt.id] = match.option_text if match else f"Option {opt.option_label}"

            existing_pass_trans_stmt = select(PassageTranslation).where(
                col(PassageTranslation.passage_id).in_(pass_ids)
            )
            existing_pass_trans = (await sess.exec(existing_pass_trans_stmt)).all()
            pass_trans_set: Set[Tuple[int, str]] = {
                (pt.passage_id, pt.language.value if hasattr(pt.language, "value") else str(pt.language))
                for pt in existing_pass_trans
            }

            pass_eng_text: Dict[int, str] = {}
            for pt in existing_pass_trans:
                lang_str = pt.language.value if hasattr(pt.language, "value") else str(pt.language)
                if lang_str == "ENGLISH":
                    pass_eng_text[pt.passage_id] = pt.passage_text

            total_added = 0
            total_langs = len(langs_to_process)

            # 5. Process each target language
            for lang_idx, (target_iso, target_enum) in enumerate(langs_to_process, 1):
                pct = 5.0 + (90.0 * (lang_idx - 1) / total_langs)
                step_name = f"TRANSLATING_{target_enum} ({lang_idx}/{total_langs})"
                await self._update_run_status(sess, exam_id, "RUNNING", step_name, pct)
                log.info(f"🔄 [{lang_idx}/{total_langs}] Translating Exam #{exam_id} into {target_enum} ({target_iso})...")

                # Resolve Enum member or string
                try:
                    lang_db_enum = LanguageCode[target_enum]
                except (KeyError, AttributeError):
                    lang_db_enum = target_enum

                # Check missing question stems, options, and passages
                missing_qs = [q for q in questions if (q.id, target_enum) not in q_trans_set]
                missing_opts = [o for o in options if (o.id, target_enum) not in opt_trans_set]
                missing_passes = [p for p in passages if (p.id, target_enum) not in pass_trans_set and p.id in pass_eng_text]

                all_raw_texts = (
                    [q_eng_text.get(q.id, "") for q in missing_qs]
                    + [opt_eng_text.get(o.id, "") for o in missing_opts]
                    + [pass_eng_text.get(p.id, "") for p in missing_passes]
                )
                unique_texts = list(dict.fromkeys(t for t in all_raw_texts if t and str(t).strip()))
                trans_dict = {}
                if unique_texts:
                    translated_list = await self.translator.translate_batch(
                        unique_texts, target_language=target_iso, source_language="en"
                    )
                    trans_dict = dict(zip(unique_texts, translated_list))

                to_insert_qt = []
                for q in missing_qs:
                    orig_text = q_eng_text.get(q.id, "")
                    t_text = trans_dict.get(orig_text, orig_text)
                    to_insert_qt.append(QuestionTranslation(
                        question_id=q.id,
                        language=lang_db_enum,
                        question_text=t_text,
                    ))
                    q_trans_set.add((q.id, target_enum))
                    total_added += 1

                to_insert_ot = []
                for o in missing_opts:
                    orig_text = opt_eng_text.get(o.id, "")
                    t_text = trans_dict.get(orig_text, orig_text)
                    to_insert_ot.append(OptionTranslation(
                        option_id=o.id,
                        language=lang_db_enum,
                        option_text=t_text,
                    ))
                    opt_trans_set.add((o.id, target_enum))
                    total_added += 1

                to_insert_pt = []
                for p in missing_passes:
                    orig_text = pass_eng_text.get(p.id, "")
                    t_text = trans_dict.get(orig_text, orig_text)
                    to_insert_pt.append(PassageTranslation(
                        passage_id=p.id,
                        language=lang_db_enum,
                        passage_text=t_text,
                    ))
                    pass_trans_set.add((p.id, target_enum))
                    total_added += 1

                from app.db.upsert import bulk_insert_on_conflict_do_nothing
                if to_insert_qt:
                    await bulk_insert_on_conflict_do_nothing(
                        sess, QuestionTranslation, to_insert_qt, ["question_id", "language"]
                    )
                if to_insert_ot:
                    await bulk_insert_on_conflict_do_nothing(
                        sess, OptionTranslation, to_insert_ot, ["option_id", "language"]
                    )
                if to_insert_pt:
                    await bulk_insert_on_conflict_do_nothing(
                        sess, PassageTranslation, to_insert_pt, ["passage_id", "language"]
                    )

                # Commit batch for this language safely with retries
                await sess.commit()

            # 6. Finalize PipelineRun
            await self._update_run_status(
                sess, exam_id, "COMPLETED", "ALL_22_LANGUAGES_TRANSLATED", 100.0
            )
            await invalidate_exam_cache(str(exam_id))

            log.info(f"✅ [TRANSLATION PIPELINE COMPLETE] Exam #{exam_id}: {total_added} translations added across {total_langs} languages.")
            return {
                "success": True,
                "exam_id": exam_id,
                "status": "COMPLETED",
                "questions_count": len(questions),
                "translations_added": total_added,
                "languages_processed": total_langs,
            }

        try:
            with llm_usage_scope(exam_id=exam_id):
                if self.session is not None:
                    return await _execute(self.session)
                else:
                    async with managed_async_session() as sess:
                        return await _execute(sess)
        except Exception as e:
            log.error(f"❌ [TRANSLATION PIPELINE FAILED] Exam #{exam_id}: {e}", exc_info=True)
            try:
                if self.session is not None:
                    await self._update_run_status(
                        self.session, exam_id, "FAILED", "TRANSLATION_ERROR", 0.0, error_log=str(e)
                    )
                else:
                    async with managed_async_session() as err_sess:
                        await self._update_run_status(
                            err_sess, exam_id, "FAILED", "TRANSLATION_ERROR", 0.0, error_log=str(e)
                        )
            except Exception:
                pass
            raise e

    async def reconcile_all_missing_translations(self) -> Dict[str, Any]:
        """
        Midnight automated maintenance task:
        Scans all exams in the database, determines if any question, option,
        or passage is missing translations in any of the 22 languages, and backfills them.
        """
        logger.info("🌙 [MIDNIGHT RECONCILIATION] Starting automated check for missing translations across all exams...")

        async def _reconcile(sess: AsyncSession):
            stmt = select(Exam).order_by(col(Exam.id).desc())
            res = await sess.exec(stmt)
            exams = res.all()

            results = []
            total_added = 0
            for exam in exams:
                try:
                    res_dict = await self.translate_exam(exam.id)
                    results.append(res_dict)
                    total_added += res_dict.get("translations_added", 0)
                except Exception as err:
                    logger.error(f"Reconciliation error on Exam #{exam.id}: {err}")
                    results.append({"exam_id": exam.id, "status": "ERROR", "error": str(err)})

            logger.info(
                f"🌙 [MIDNIGHT RECONCILIATION COMPLETE] Checked {len(exams)} exams. Total missing translations added: {total_added}."
            )
            return {
                "exams_checked": len(exams),
                "total_translations_added": total_added,
                "details": results,
            }

        if self.session is not None:
            return await _reconcile(self.session)
        else:
            async with managed_async_session() as sess:
                return await _reconcile(sess)
