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
    Builds and caches 2 standardized JSON artifacts in S3 / local storage for an Exam:
    1. `exams/{exam_code}/exam_questions.json` — For live exam-taking (NO answer keys or explanations).
       Contains full multilingual translations for question statements, passages, and options.
    2. `exams/{exam_code}/exam_solutions.json` — For answer reveal & post-submission psychometrics.
       Contains ALL parameters from the explanation pipeline & taxonomy hierarchy across all languages.
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self.storage = get_storage_provider()

    async def generate_and_upload(self, exam_id: uuid.UUID) -> Dict[str, str]:
        exam = await self.session.get(Exam, exam_id)
        if not exam:
            raise ValueError(f"Exam with ID '{exam_id}' not found.")

        # Fetch questions ordered by paper number
        stmt = (
            select(Question)
            .where(Question.exam_id == exam_id)
            .order_by(col(Question.question_number_in_paper).asc())
        )
        res = await self.session.exec(stmt)
        questions = res.all()

        if not questions:
            logger.warning(f"Exam '{exam.code}' has no questions yet. Skipping JSON caching.")
            return {}

        questions_payload = []
        solutions_payload = []

        for q in questions:
            # 1. Fetch Question Translations (all available languages)
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

            # 2. Fetch Passage Translations if attached
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

            # 3. Fetch Taxonomy (Subtopic → Topic → Subject)
            subtopic = await self.session.get(Subtopic, q.subtopic_id) if q.subtopic_id else None
            topic = await self.session.get(Topic, subtopic.topic_id) if subtopic and subtopic.topic_id else None
            subject = await self.session.get(Subject, topic.subject_id) if topic and topic.subject_id else None

            subj_name = subject.name if subject else "General Knowledge"
            top_name = topic.name if topic else "General Studies"
            sub_name = subtopic.name if subtopic else "Core Concepts"

            # 4. Fetch Multi-Concept Links (Hierarchy)
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

            # 5. Fetch Options & Option Translations
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

            # 6. Question Metadata & IRT Parameters
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

            # 7. Question Explanations (all available languages)
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

            # Build Public Question Card (SAFE for exam-taking, no answer key)
            questions_payload.append({
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
            })

            # Build Solutions Card (PROTECTED for reveal & evaluation with full parameters)
            solutions_payload.append({
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
            })

        # Master JSON structures
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
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "questions": questions_payload,
        }

        solutions_doc = {
            "exam_id": str(exam.id),
            "exam_code": exam.code,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "questions": solutions_payload,
        }

        # Save to S3 / Local storage at exams/{exam_code}/
        q_rel_path = f"exams/{exam.code}/exam_questions.json"
        s_rel_path = f"exams/{exam.code}/exam_solutions.json"

        saved_q_path = await self.storage.upload_json(questions_doc, q_rel_path)
        saved_s_path = await self.storage.upload_json(solutions_doc, s_rel_path)

        # Update Exam DB record with JSON paths
        exam.questions_json_path = saved_q_path
        exam.solutions_json_path = saved_s_path
        self.session.add(exam)
        await self.session.commit()

        logger.info(f"Successfully cached JSONs for exam '{exam.code}': '{saved_q_path}' & '{saved_s_path}'")
        return {
            "questions_json_path": saved_q_path,
            "solutions_json_path": saved_s_path,
        }
