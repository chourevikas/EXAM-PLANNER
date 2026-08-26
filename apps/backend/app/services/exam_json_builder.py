import uuid
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models import (
    Exam,
    Question,
    QuestionOption,
    QuestionTranslation,
    OptionTranslation,
    QuestionExplanation,
    QuestionMetadata,
    QuestionHierarchyLink,
    Passage,
    PassageTranslation,
    Subtopic,
    Topic,
    Subject,
)
from app.storage.factory import get_storage_provider
from app.config.logger import setup_logger

logger = setup_logger("ExamJsonBuilder")


class ExamJsonBuilder:
    """
    Builds and uploads standardized JSON artifacts in S3 / local storage for an Exam:
    1. Consolidated `exam_questions.json` and `exam_solutions.json`.
    2. Individual per-question JSON files in dedicated folder paths:
       - `questions_json_folder_path`: `artifacts/{exam_code}/{set}/json/questions/Q001.json`, etc.
       - `solutions_json_folder_path`: `artifacts/{exam_code}/{set}/json/solutions/Q001.json`, etc.
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self.storage = get_storage_provider()

    async def build_single_question_cards(
        self, q: Question
    ) -> tuple[Dict[str, Any], Dict[str, Any]]:
        """Constructs standardized q_card and sol_card payloads for a single Question."""
        # 1. Question Translations
        trans_res = await self.session.exec(
            select(QuestionTranslation).where(QuestionTranslation.question_id == q.id)
        )
        trans_list = trans_res.all()

        question_translations = {}
        for t in trans_list:
            lang_str = t.language.value if hasattr(t.language, "value") else str(t.language)
            question_translations[lang_str] = {
                "question_text": t.question_text,
                "parent_context_override": t.parent_context_override,
            }

        eng_trans = next(
            (t for t in trans_list if (t.language.value if hasattr(t.language, "value") else str(t.language)) == "ENGLISH"), None
        ) or (trans_list[0] if trans_list else None)
        q_text = eng_trans.question_text if eng_trans else f"Question #{q.question_number_in_paper}"

        # 2. Passage Translations
        passage_text = None
        passage_translations = {}
        if q.passage_id:
            pass_res = await self.session.exec(
                select(PassageTranslation).where(PassageTranslation.passage_id == q.passage_id)
            )
            pass_trans_list = pass_res.all()
            for pt in pass_trans_list:
                lang_str = pt.language.value if hasattr(pt.language, "value") else str(pt.language)
                passage_translations[lang_str] = pt.passage_text

            eng_pt = next(
                (pt for pt in pass_trans_list if (pt.language.value if hasattr(pt.language, "value") else str(pt.language)) == "ENGLISH"), None
            ) or (pass_trans_list[0] if pass_trans_list else None)
            if eng_pt:
                passage_text = eng_pt.passage_text

        # 3. Taxonomy
        subtopic = await self.session.get(Subtopic, q.subtopic_id) if q.subtopic_id else None
        topic = await self.session.get(Topic, subtopic.topic_id) if subtopic and subtopic.topic_id else None
        subject = await self.session.get(Subject, topic.subject_id) if topic and topic.subject_id else None

        subj_name = subject.name if subject else "General Knowledge"
        top_name = topic.name if topic else "General Studies"
        sub_name = subtopic.name if subtopic else "Core Concepts"

        # 4. Multi-Concept Hierarchy
        h_stmt = select(QuestionHierarchyLink).where(
            QuestionHierarchyLink.question_id == q.id
        )
        h_links = (await self.session.exec(h_stmt)).all()
        hierarchy_concepts = []
        for hl in h_links:
            subtop_freq = 0
            subtop_name = None
            topic_name = None
            subj_name_l = None
            if hl.subtopic_id:
                subtop = await self.session.get(Subtopic, hl.subtopic_id)
                if subtop:
                    subtop_name = subtop.name
                    subtop_freq = subtop.pyq_frequency
                    top = await self.session.get(Topic, subtop.topic_id)
                    if top:
                        topic_name = top.name
                        subj = await self.session.get(Subject, top.subject_id)
                        if subj:
                            subj_name_l = subj.name
            hierarchy_concepts.append({
                "subject": subj_name_l or subj_name,
                "topic": topic_name or top_name,
                "subtopic": subtop_name or sub_name,
                "subject_id": str(hl.subject_id) if hl.subject_id else None,
                "topic_id": str(hl.topic_id) if hl.topic_id else None,
                "subtopic_id": str(hl.subtopic_id) if hl.subtopic_id else None,
                "is_primary": hl.is_primary,
                "relevance_weight": hl.relevance_weight,
                "concept_name": hl.concept_name,
                "subtopic_pyq_frequency": subtop_freq,
            })

        # 5. Options
        opt_res = await self.session.exec(
            select(QuestionOption)
            .where(QuestionOption.question_id == q.id)
            .order_by(col(QuestionOption.display_order).asc())
        )
        options = opt_res.all()

        public_options = []
        correct_option_id = None
        correct_option_label = "A"
        distractor_scores = {}

        for opt in options:
            opt_trans_res = await self.session.exec(
                select(OptionTranslation).where(OptionTranslation.option_id == opt.id)
            )
            opt_trans_list = opt_trans_res.all()

            opt_translations = {}
            opt_distractor_analyses = {}
            for ot in opt_trans_list:
                lang_str = ot.language.value if hasattr(ot.language, "value") else str(ot.language)
                opt_translations[lang_str] = ot.option_text
                if ot.distractor_analysis:
                    opt_distractor_analyses[lang_str] = ot.distractor_analysis

            eng_opt_trans = next(
                (t for t in opt_trans_list if (t.language.value if hasattr(t.language, "value") else str(t.language)) == "ENGLISH"), None
            ) or (opt_trans_list[0] if opt_trans_list else None)

            opt_text = eng_opt_trans.option_text if eng_opt_trans else f"Option {opt.option_label}"
            eng_analysis = eng_opt_trans.distractor_analysis if eng_opt_trans else None

            public_options.append({
                "option_id": str(opt.id),
                "option_label": opt.option_label,
                "text": opt_text,
                "translations": opt_translations,
                "display_order": opt.display_order,
            })

            if opt.is_correct:
                correct_option_id = str(opt.id)
                correct_option_label = opt.option_label

            distractor_scores[str(opt.id)] = {
                "label": opt.option_label,
                "closeness_score": opt.closeness_score,
                "is_correct": opt.is_correct,
                "distractor_analysis": eng_analysis,
                "distractor_analysis_translations": opt_distractor_analyses,
            }

        # 6. Metadata
        meta_res = await self.session.exec(
            select(QuestionMetadata).where(QuestionMetadata.question_id == q.id)
        )
        q_meta = meta_res.first()
        blooms_level = (q_meta.blooms_level.value if hasattr(q_meta.blooms_level, "value") else str(q_meta.blooms_level)) if (q_meta and q_meta.blooms_level) else "ANALYZE"
        cognitive_skill = q_meta.cognitive_skill if q_meta and q_meta.cognitive_skill else "Conceptual Reasoning"
        primary_concept_tag = q_meta.primary_concept_tag if q_meta and q_meta.primary_concept_tag else None
        irt_a = q_meta.irt_discrimination_a if (q_meta and q_meta.irt_discrimination_a is not None) else 1.50
        irt_b = q_meta.irt_difficulty_b if (q_meta and q_meta.irt_difficulty_b is not None) else 0.00
        irt_c = q_meta.irt_pseudo_guessing_c if (q_meta and q_meta.irt_pseudo_guessing_c is not None) else 0.25

        # 7. Explanations
        expl_res = await self.session.exec(
            select(QuestionExplanation).where(QuestionExplanation.question_id == q.id)
        )
        expl_list = expl_res.all()

        explanation_translations = {}
        for q_expl in expl_list:
            lang_str = q_expl.language.value if hasattr(q_expl.language, "value") else str(q_expl.language)
            explanation_translations[lang_str] = {
                "core_concept": q_expl.core_concept,
                "detailed_solution": q_expl.detailed_solution,
                "common_traps": q_expl.common_traps_json or [],
                "key_takeaways": q_expl.key_takeaways_json or [],
            }

        eng_expl = next(
            (e for e in expl_list if (e.language.value if hasattr(e.language, "value") else str(e.language)) == "ENGLISH"), None
        ) or (expl_list[0] if expl_list else None)

        default_expl_dict = {
            "core_concept": eng_expl.core_concept if eng_expl else "Core concept analysis",
            "detailed_solution": eng_expl.detailed_solution if eng_expl else "Detailed solution breakdown",
            "common_traps": eng_expl.common_traps_json if (eng_expl and eng_expl.common_traps_json) else [],
            "key_takeaways": eng_expl.key_takeaways_json if (eng_expl and eng_expl.key_takeaways_json) else [],
        }

        q_card = {
            "question_id": str(q.id),
            "question_number": q.question_number_in_paper,
            "section_code": q.section_code,
            "text": q_text,
            "translations": question_translations,
            "difficulty": q.difficulty.value if hasattr(q.difficulty, 'value') else str(q.difficulty),
            "marks": q.marks,
            "negative_marks": q.negative_marks,
            "expected_time_seconds": q.expected_time_seconds,
            "question_type": q.question_type,
            "has_image": q.has_image,
            "assets": [],
            "passage_text": passage_text,
            "passage_translations": passage_translations,
            "subject": subj_name,
            "topic": top_name,
            "subtopic": sub_name,
            "options": public_options,
        }

        sol_card = {
            "question_id": str(q.id),
            "question_number": q.question_number_in_paper,
            "correct_option_id": correct_option_id,
            "correct_option_label": correct_option_label,
            "difficulty": q.difficulty.value if hasattr(q.difficulty, 'value') else str(q.difficulty),
            "blooms_level": blooms_level,
            "cognitive_skill": cognitive_skill,
            "primary_concept_tag": primary_concept_tag,
            "irt_params": {
                "a": irt_a,
                "b": irt_b,
                "c": irt_c,
            },
            "subject": subj_name,
            "topic": top_name,
            "subtopic": sub_name,
            "concepts": hierarchy_concepts,
            "explanation": default_expl_dict,
            "explanation_translations": explanation_translations,
            "distractor_scores": distractor_scores,
        }

        return q_card, sol_card

    async def sync_single_question_artifacts(self, question_id: uuid.UUID) -> Optional[Dict[str, str]]:
        """
        Uploads or updates the individual Q{num}.json question and solution artifacts to S3 in real-time.
        """
        try:
            q = await self.session.get(Question, question_id)
            if not q or not q.exam_id:
                return None

            exam = await self.session.get(Exam, q.exam_id)
            if not exam:
                return None

            paper_set = exam.paper_set_code or "SET_A"
            clean_set = str(paper_set).strip().lower().replace("_", "-")
            questions_folder_rel = exam.questions_json_folder_path or f"artifacts/{exam.code}/{clean_set}/json/questions"
            solutions_folder_rel = exam.solutions_json_folder_path or f"artifacts/{exam.code}/{clean_set}/json/solutions"

            q_card, sol_card = await self.build_single_question_cards(q)

            q_filename = f"Q{q.question_number_in_paper:03d}.json"
            q_indiv_rel = f"{questions_folder_rel}/{q_filename}"
            s_indiv_rel = f"{solutions_folder_rel}/{q_filename}"

            await self.storage.upload_json(q_card, q_indiv_rel)
            await self.storage.upload_json(sol_card, s_indiv_rel)

            logger.info(
                f"[REALTIME_S3_SYNC] Uploaded individual question & solution #{q.question_number_in_paper} "
                f"artifacts for exam '{exam.code}' to S3."
            )
            return {
                "question_artifact_path": q_indiv_rel,
                "solution_artifact_path": s_indiv_rel,
            }
        except Exception as err:
            logger.warning(f"[REALTIME_S3_SYNC] Failed syncing single question #{question_id} to S3: {err}")
            return None

    async def delete_single_question_artifacts(
        self, exam_code: str, paper_set_code: Optional[str], question_number: int
    ) -> bool:
        """
        Deletes the individual Q{num}.json question and solution artifacts from S3 in real-time.
        """
        try:
            clean_set = str(paper_set_code or "SET_A").strip().lower().replace("_", "-")
            questions_folder_rel = f"artifacts/{exam_code}/{clean_set}/json/questions"
            solutions_folder_rel = f"artifacts/{exam_code}/{clean_set}/json/solutions"

            q_filename = f"Q{question_number:03d}.json"
            q_indiv_rel = f"{questions_folder_rel}/{q_filename}"
            s_indiv_rel = f"{solutions_folder_rel}/{q_filename}"

            await self.storage.delete_file(q_indiv_rel)
            await self.storage.delete_file(s_indiv_rel)

            logger.info(
                f"[REALTIME_S3_DELETE] Deleted individual question & solution #{question_number} "
                f"artifacts for exam '{exam_code}' from S3."
            )
            return True
        except Exception as err:
            logger.warning(f"[REALTIME_S3_DELETE] Failed deleting question #{question_number} artifacts from S3: {err}")
            return False

    async def generate_and_upload(
        self,
        exam_id: uuid.UUID,
        sync_all: bool = False,
        sync_target: str = "MASTERS_ONLY",
    ) -> Dict[str, Any]:
        """
        Consolidated generation & upload:
        - sync_target == "QUESTIONS_MASTER": Generates and uploads only master exam_questions.json.
        - sync_target == "SOLUTIONS_MASTER": Generates and uploads only master exam_solutions.json.
        - sync_target == "MASTERS_ONLY": Generates and uploads both master exam_questions.json and exam_solutions.json (default).
        - sync_target == "FULL_ALL" or sync_all=True: Generates and uploads both master JSONs + all individual Q{num}.json files.
        """
        import time
        start_time = time.perf_counter()

        if sync_all:
            sync_target = "FULL_ALL"

        scope_name = (
            "Full S3 Sync (Master + All Individual Q Files)"
            if sync_target == "FULL_ALL"
            else "Master Solutions JSON Sync"
            if sync_target == "SOLUTIONS_MASTER"
            else "Master Questions JSON Sync"
            if sync_target == "QUESTIONS_MASTER"
            else "Master Questions & Solutions Sync"
        )

        exam = await self.session.get(Exam, exam_id)
        if not exam:
            logger.error(f"[S3_SYNC] Exam with ID '{exam_id}' not found in database.")
            raise ValueError(f"Exam with ID '{exam_id}' not found.")

        logger.info(
            f"🔄 [S3_SYNC_START] Starting '{scope_name}' for exam '{exam.code}' (ID: {exam_id}, Year: {exam.source_year}, Set: {exam.paper_set_code})"
        )

        # Fetch questions ordered by paper number
        stmt = (
            select(Question)
            .where(Question.exam_id == exam_id)
            .order_by(col(Question.question_number_in_paper))
        )
        res = await self.session.exec(stmt)
        questions = res.all()

        if not questions:
            logger.warning(f"[S3_SYNC] Exam '{exam.code}' has 0 questions in database. Skipping JSON generation.")
            return {}

        total_q = len(questions)
        logger.info(f"📋 [S3_SYNC] Loaded {total_q} questions from database for exam '{exam.code}'")

        exam_code = exam.code
        paper_set = exam.paper_set_code or "SET_A"
        clean_set = str(paper_set).strip().lower().replace("_", "-")

        questions_folder_rel = f"artifacts/{exam_code}/{clean_set}/json/questions"
        solutions_folder_rel = f"artifacts/{exam_code}/{clean_set}/json/solutions"

        questions_payload = []
        solutions_payload = []

        card_build_start = time.perf_counter()
        for idx, q in enumerate(questions, start=1):
            q_card, sol_card = await self.build_single_question_cards(q)
            questions_payload.append(q_card)
            solutions_payload.append(sol_card)

            if sync_target == "FULL_ALL":
                # Upload individual Question JSON & Solution JSON to dedicated folder
                q_filename = f"Q{q.question_number_in_paper:03d}.json"
                q_indiv_rel = f"{questions_folder_rel}/{q_filename}"
                s_indiv_rel = f"{solutions_folder_rel}/{q_filename}"

                await self.storage.upload_json(q_card, q_indiv_rel)
                await self.storage.upload_json(sol_card, s_indiv_rel)

                if idx % 25 == 0 or idx == total_q:
                    pct = round((idx / total_q) * 100)
                    logger.info(
                        f"  ⬆️  [S3_SYNC_PROGRESS] Uploaded individual question files: {idx}/{total_q} ({pct}%)"
                    )

        card_build_duration = time.perf_counter() - card_build_start
        logger.info(
            f"📦 [S3_SYNC] Generated {len(questions_payload)} question & solution cards in {card_build_duration:.2f}s"
        )

        now_utc = datetime.now(timezone.utc)
        result_payload: Dict[str, Any] = {
            "exam_id": str(exam.id),
            "exam_code": exam.code,
            "sync_target": sync_target,
            "last_synced_at": now_utc.isoformat(),
            "total_questions": total_q,
        }

        # 1. Master Questions JSON
        if sync_target in ("MASTERS_ONLY", "QUESTIONS_MASTER", "FULL_ALL", "ALL"):
            questions_doc = {
                "exam_id": str(exam.id),
                "exam_code": exam.code,
                "exam_name": exam.name,
                "stage": exam.stage,
                "subject_code": exam.subject_code,
                "source_year": exam.source_year,
                "paper_set_code": exam.paper_set_code,
                "total_questions": len(questions_payload),
                "total_duration_minutes": exam.total_duration_minutes or 120,
                "total_marks": exam.total_marks or 200.0,
                "generated_at": now_utc.isoformat(),
                "questions": questions_payload,
            }
            q_rel_path = f"exams/{exam.code}/exam_questions.json"
            saved_q_path = await self.storage.upload_json(questions_doc, q_rel_path)
            exam.questions_json_path = saved_q_path
            exam.questions_json_folder_path = questions_folder_rel
            result_payload["questions_json_path"] = saved_q_path
            result_payload["questions_json_folder_path"] = questions_folder_rel
            logger.info(f"   - Questions Master: '{saved_q_path}'")

        # 2. Master Solutions JSON
        if sync_target in ("MASTERS_ONLY", "SOLUTIONS_MASTER", "FULL_ALL", "ALL"):
            solutions_doc = {
                "exam_id": str(exam.id),
                "exam_code": exam.code,
                "generated_at": now_utc.isoformat(),
                "questions": solutions_payload,
            }
            s_rel_path = f"exams/{exam.code}/exam_solutions.json"
            saved_s_path = await self.storage.upload_json(solutions_doc, s_rel_path)
            exam.solutions_json_path = saved_s_path
            exam.solutions_json_folder_path = solutions_folder_rel
            result_payload["solutions_json_path"] = saved_s_path
            result_payload["solutions_json_folder_path"] = solutions_folder_rel

            # Also prime sliding cache in memory
            from app.engine.post_submission_pipeline import set_cached_solutions_data
            set_cached_solutions_data(exam.code, solutions_doc)
            logger.info(f"   - Solutions Master: '{saved_s_path}' (Sliding Cache Primed)")

        exam.last_synced_at = now_utc
        self.session.add(exam)
        await self.session.commit()

        total_duration = time.perf_counter() - start_time
        result_payload["duration_seconds"] = round(total_duration, 2)
        logger.info(
            f"✅ [S3_SYNC_COMPLETE] Successfully executed '{scope_name}' for exam '{exam.code}' in {total_duration:.2f}s!"
        )
        return result_payload
