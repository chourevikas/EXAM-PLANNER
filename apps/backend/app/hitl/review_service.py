import uuid
import json
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession
from app.db.models import (
    Exam,
    Question,
    QuestionTranslation,
    QuestionOption,
    OptionTranslation,
    QuestionAsset,
    Passage,
    PassageTranslation,
    HumanReviewTask,
    QuestionStatus,
)
from app.storage.factory import get_storage_provider
from app.services.exam_json_builder import ExamJsonBuilder
from app.pipeline.vision_extractor import (
    load_pdf_page_image_lazily,
    ainvoke_extraction_llm,
)
from app.pipeline.dsu_stitcher import async_crop_and_save_asset
from app.config.logger import setup_logger

logger = setup_logger("HITLService")


def parse_json_field(val: Any) -> list:
    """Helper to safely parse PortableJSON fields whether returned as a list or string."""
    if isinstance(val, list):
        return val
    if isinstance(val, str):
        try:
            parsed = json.loads(val)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []
    return []


class HumanReviewService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_pending_review_tasks(
        self, exam_id: Optional[uuid.UUID] = None, only_flagged: bool = False
    ) -> List[HumanReviewTask]:
        """Asynchronously fetches pending human review tasks for Admin review."""
        from app.cache import get_cache, build_cache_key
        cache = get_cache()
        cache_key = build_cache_key(
            "review:tasks",
            str(exam_id) if exam_id else "all",
            only_flagged=only_flagged,
        )
        cached_data = await cache.get(cache_key)
        if cached_data is not None:
            return [HumanReviewTask(**t) for t in cached_data]

        query = select(HumanReviewTask).where(
            HumanReviewTask.review_status == "PENDING_REVIEW"
        )
        if exam_id:
            query = query.where(HumanReviewTask.exam_id == exam_id)
        if only_flagged:
            query = query.where(HumanReviewTask.is_flagged_by_validator == True)

        result = await self.session.exec(query.order_by(col(HumanReviewTask.created_at)))
        tasks = list(result.all())
        if tasks:
            serialized = [t.dict() if hasattr(t, "dict") else t.model_dump(mode="json") for t in tasks]
            await cache.set(cache_key, serialized, ttl_seconds=1800)
        return tasks

    async def get_question_review_detail(
        self, question_id: uuid.UUID
    ) -> Dict[str, Any]:
        """Asynchronously fetches full question details, passage context, translations, options, and audit flags."""
        question = await self.session.get(Question, question_id)
        if not question:
            raise ValueError(f"Question with ID {question_id} not found.")

        review_task_res = await self.session.exec(
            select(HumanReviewTask).where(HumanReviewTask.question_id == question_id)
        )
        review_task = review_task_res.first()

        translations_res = await self.session.exec(
            select(QuestionTranslation).where(
                QuestionTranslation.question_id == question_id
            )
        )
        translations = translations_res.all()

        options_res = await self.session.exec(
            select(QuestionOption)
            .where(QuestionOption.question_id == question_id)
            .order_by(col(QuestionOption.display_order))
        )
        options = options_res.all()

        # Fetch linked passage if exists
        passage_detail = None
        if question.passage_id:
            passage = await self.session.get(Passage, question.passage_id)
            if passage:
                p_trans_res = await self.session.exec(
                    select(PassageTranslation).where(
                        PassageTranslation.passage_id == passage.id
                    )
                )
                p_trans = p_trans_res.all()
                passage_detail = {
                    "passage_id": str(passage.id),
                    "memory_type": passage.memory_type.value
                    if hasattr(passage.memory_type, "value")
                    else str(passage.memory_type),
                    "is_complete": passage.is_complete,
                    "page_numbers": parse_json_field(passage.page_numbers_json),
                    "translations": [
                        {"language": t.language.value, "passage_text": t.passage_text}
                        for t in p_trans
                    ],
                }

        assets_res = await self.session.exec(
            select(QuestionAsset).where(QuestionAsset.question_id == question_id)
        )
        assets = assets_res.all()

        opt_details = []
        for opt in options:
            opt_trans_res = await self.session.exec(
                select(OptionTranslation).where(OptionTranslation.option_id == opt.id)
            )
            opt_trans = opt_trans_res.all()
            distractor_text = next((t.distractor_analysis for t in opt_trans if t.distractor_analysis), None)
            opt_details.append(
                {
                    "option_id": str(opt.id),
                    "option_label": opt.option_label,
                    "display_order": opt.display_order,
                    "is_correct": opt.is_correct,
                    "closeness_score": opt.closeness_score,
                    "distractor_analysis": distractor_text,
                    "translations": [
                        {
                            "language": t.language.value,
                            "text": t.option_text,
                            "distractor_analysis": t.distractor_analysis,
                        }
                        for t in opt_trans
                    ],
                }
            )

        # Fetch Explanation
        from app.db.models.explanation import QuestionExplanation
        from app.db.models.metadata import QuestionMetadata
        from app.db.models.hierarchy import Subject, Topic, Subtopic
        from app.db.models.hierarchy_link import QuestionHierarchyLink

        expl_res = await self.session.exec(
            select(QuestionExplanation).where(QuestionExplanation.question_id == question_id)
        )
        expl_list = expl_res.all()
        expl_detail = None
        if expl_list:
            e0 = expl_list[0]
            expl_detail = {
                "explanation_id": str(e0.id),
                "language": e0.language.value if hasattr(e0.language, "value") else str(e0.language),
                "core_concept": e0.core_concept,
                "detailed_solution": e0.detailed_solution,
                "common_traps": parse_json_field(e0.common_traps_json),
                "key_takeaways": parse_json_field(e0.key_takeaways_json),
                "translations": {
                    (e.language.value if hasattr(e.language, "value") else str(e.language)): {
                        "core_concept": e.core_concept,
                        "detailed_solution": e.detailed_solution,
                        "common_traps": parse_json_field(e.common_traps_json),
                        "key_takeaways": parse_json_field(e.key_takeaways_json),
                    }
                    for e in expl_list
                },
            }

        # Fetch Metadata
        meta_res = await self.session.exec(
            select(QuestionMetadata).where(QuestionMetadata.question_id == question_id)
        )
        qm = meta_res.first()
        metadata_detail = None
        if qm:
            metadata_detail = {
                "blooms_level": qm.blooms_level.value if hasattr(qm.blooms_level, "value") else str(qm.blooms_level),
                "cognitive_skill": qm.cognitive_skill,
                "primary_concept_tag": qm.primary_concept_tag,
                "irt_discrimination_a": qm.irt_discrimination_a,
                "irt_difficulty_b": qm.irt_difficulty_b,
                "irt_pseudo_guessing_c": qm.irt_pseudo_guessing_c,
            }

        # Fetch Hierarchy Links
        hierarchy_detail = []
        links_res = await self.session.exec(
            select(QuestionHierarchyLink).where(QuestionHierarchyLink.question_id == question_id)
        )
        links = links_res.all()
        for link in links:
            subj = await self.session.get(Subject, link.subject_id) if link.subject_id else None
            top = await self.session.get(Topic, link.topic_id) if link.topic_id else None
            subtop = await self.session.get(Subtopic, link.subtopic_id) if link.subtopic_id else None
            hierarchy_detail.append({
                "subject_id": str(subj.id) if subj else None,
                "subject_name": subj.name if subj else None,
                "topic_id": str(top.id) if top else None,
                "topic_name": top.name if top else None,
                "subtopic_id": str(subtop.id) if subtop else None,
                "subtopic_name": subtop.name if subtop else None,
                "is_primary": link.is_primary,
            })

        if not hierarchy_detail and question.subtopic_id:
            subtop = await self.session.get(Subtopic, question.subtopic_id)
            if subtop:
                top = await self.session.get(Topic, subtop.topic_id) if subtop.topic_id else None
                subj = await self.session.get(Subject, top.subject_id) if top and top.subject_id else None
                hierarchy_detail.append({
                    "subject_id": str(subj.id) if subj else None,
                    "subject_name": subj.name if subj else None,
                    "topic_id": str(top.id) if top else None,
                    "topic_name": top.name if top else None,
                    "subtopic_id": str(subtop.id),
                    "subtopic_name": subtop.name,
                    "is_primary": True,
                })

        return {
            "question_id": str(question.id),
            "exam_id": str(question.exam_id),
            "section_code": question.section_code,
            "question_number": question.question_number_in_paper,
            "status": question.status.value,
            "difficulty": question.difficulty.value if hasattr(question.difficulty, "value") else str(question.difficulty),
            "marks": question.marks,
            "negative_marks": question.negative_marks,
            "expected_time_seconds": question.expected_time_seconds,
            "is_complete": question.is_complete,
            "has_image": question.has_image,
            "page_numbers": parse_json_field(question.page_numbers_json),
            "passage": passage_detail,
            "audit_flagged": review_task.is_flagged_by_validator if review_task else False,
            "failure_reasons": parse_json_field(review_task.failure_reasons_json) if review_task else [],
            "translations": [
                {
                    "language": t.language.value,
                    "question_text": t.question_text,
                    "context": t.parent_context_override,
                }
                for t in translations
            ],
            "options": opt_details,
            "explanation": expl_detail,
            "metadata": metadata_detail,
            "hierarchy": hierarchy_detail,
            "assets": [
                {
                    "asset_id": str(a.id),
                    "asset_path": a.asset_path,
                    "asset_type": a.asset_type.value,
                    "caption": a.caption,
                }
                for a in assets
            ],
        }

    async def update_and_approve_question(
        self,
        question_id: uuid.UUID,
        admin_id: Optional[uuid.UUID] = None,
        updated_passage_text: Optional[str] = None,
        updated_question_text: Optional[str] = None,
        updated_options: Optional[List[Dict[str, Any]]] = None,
        correct_option_label: Optional[str] = None,
        reviewer_notes: Optional[str] = None,
    ) -> Question:
        """Allows Admin to update passage context, question text, options, and publish the question."""
        question = await self.session.get(Question, question_id)
        if not question:
            raise ValueError(f"Question with ID {question_id} not found.")

        # 1. Update Passage Text if provided
        if updated_passage_text and question.passage_id:
            p_trans_res = await self.session.exec(
                select(PassageTranslation).where(
                    PassageTranslation.passage_id == question.passage_id
                )
            )
            p_trans = p_trans_res.first()
            if p_trans:
                p_trans.passage_text = updated_passage_text
                self.session.add(p_trans)

        # 2. Update Question Text if provided
        if updated_question_text:
            trans_res = await self.session.exec(
                select(QuestionTranslation).where(
                    QuestionTranslation.question_id == question_id
                )
            )
            trans = trans_res.first()
            if trans:
                trans.question_text = updated_question_text
                self.session.add(trans)

        # 3. Update Options if provided (text, correctness & distractor analysis)
        if updated_options:
            for opt_data in updated_options:
                opt_label = opt_data.get("option_label")
                opt_text = opt_data.get("option_text")
                is_corr = opt_data.get("is_correct", False)
                d_analysis = opt_data.get("distractor_analysis")

                opt_res = await self.session.exec(
                    select(QuestionOption).where(
                        QuestionOption.question_id == question_id,
                        QuestionOption.option_label == opt_label,
                    )
                )
                opt = opt_res.first()
                if opt:
                    opt.is_correct = is_corr
                    self.session.add(opt)

                    opt_trans_res = await self.session.exec(
                        select(OptionTranslation).where(
                            OptionTranslation.option_id == opt.id
                        )
                    )
                    opt_trans = opt_trans_res.first()
                    if opt_trans:
                        if opt_text:
                            opt_trans.option_text = opt_text
                        if d_analysis:
                            opt_trans.distractor_analysis = d_analysis
                        self.session.add(opt_trans)

        # Update Correct Answer explicitly if label specified
        if correct_option_label:
            options_res = await self.session.exec(
                select(QuestionOption).where(QuestionOption.question_id == question_id)
            )
            for opt in options_res.all():
                opt.is_correct = opt.option_label == correct_option_label
                self.session.add(opt)

        # Transition Question Status to PUBLISHED
        question.status = QuestionStatus.PUBLISHED
        question.is_complete = True
        question.updated_at = datetime.now(timezone.utc)
        self.session.add(question)

        # Re-evaluate & persist question integrity directly in DB table
        from app.services.syllabus_service import SyllabusService
        await SyllabusService(self.session).evaluate_and_persist_question_integrity(question)

        # Update Review Task
        review_task_res = await self.session.exec(
            select(HumanReviewTask).where(HumanReviewTask.question_id == question_id)
        )
        review_task = review_task_res.first()
        if review_task:
            review_task.review_status = "VERIFIED"
            review_task.assigned_admin_id = admin_id
            review_task.reviewer_notes = reviewer_notes
            review_task.reviewed_at = datetime.now(timezone.utc)
            self.session.add(review_task)

        await self.session.flush()
        await self.session.commit()
        await self.session.refresh(question)


        from app.cache import invalidate_question_cache
        await invalidate_question_cache(str(question.id), str(question.exam_id) if question.exam_id else None)

        # Touch parent Exam.updated_at & Real-time S3 individual question/solution sync
        if question.exam_id:
            exam = await self.session.get(Exam, question.exam_id)
            if exam:
                exam.updated_at = datetime.now(timezone.utc)
                self.session.add(exam)
                await self.session.commit()
        builder = ExamJsonBuilder(self.session)
        await builder.sync_single_question_artifacts(question.id)

        return question

    async def trigger_llm_reextraction_for_question(
        self, question_id: uuid.UUID, admin_id: Optional[uuid.UUID] = None
    ) -> Dict[str, Any]:
        """Triggers sequential LLM re-extraction retry targeting the specific pages of the question and passage."""
        question = await self.session.get(Question, question_id)
        if not question:
            raise ValueError(f"Question with ID {question_id} not found.")

        exam = await self.session.get(Exam, question.exam_id)
        if not exam or not exam.pdf_path:
            raise ValueError("Exam PDF path is missing or inaccessible.")

        target_pages = set(parse_json_field(question.page_numbers_json))
        if question.passage_id:
            passage = await self.session.get(Passage, question.passage_id)
            if passage:
                target_pages.update(parse_json_field(passage.page_numbers_json))

        logger.info(
            f"[HITL RE-EXTRACTION] Running sequential LLM re-extraction retry for Question {question.question_number_in_paper} on Pages {sorted(list(target_pages))}"
        )

        # Execute Sequential Re-Extraction Pass for Target Pages
        reextracted_payloads = []
        for p_num in sorted(list(target_pages)):
            page_img = await load_pdf_page_image_lazily(exam.pdf_path, p_num)
            payload = await ainvoke_extraction_llm(page_img, p_num)
            reextracted_payloads.append((p_num, payload))
            del page_img

        # Re-update Question Stem and Options from re-extracted payload
        updated_count = 0
        for p_num, payload in reextracted_payloads:
            for extracted_q in payload.extracted_questions:
                if (
                    extracted_q.printed_question_number
                    == question.question_number_in_paper
                ):
                    question.is_complete = extracted_q.is_complete
                    question.has_image = extracted_q.has_image_or_complex_layout
                    self.session.add(question)

                    for trans in extracted_q.translations:
                        lang_str = (
                            trans.language.value
                            if hasattr(trans.language, "value")
                            else str(trans.language)
                        )
                        q_trans_res = await self.session.exec(
                            select(QuestionTranslation).where(
                                QuestionTranslation.question_id == question_id,
                                QuestionTranslation.language == lang_str,
                            )
                        )
                        q_trans = q_trans_res.first()
                        if q_trans:
                            q_trans.question_text = trans.question_text
                            q_trans.parent_context_override = (
                                trans.parent_context_override
                            )
                            self.session.add(q_trans)

                        # Re-bind options
                        for opt_schema in trans.options:
                            opt_res = await self.session.exec(
                                select(QuestionOption).where(
                                    QuestionOption.question_id == question_id,
                                    QuestionOption.option_label
                                    == opt_schema.display_label,
                                )
                            )
                            opt = opt_res.first()
                            if opt:
                                opt_trans_res = await self.session.exec(
                                    select(OptionTranslation).where(
                                        OptionTranslation.option_id == opt.id
                                    )
                                )
                                opt_trans = opt_trans_res.first()
                                if opt_trans:
                                    opt_trans.option_text = opt_schema.option_text
                                    self.session.add(opt_trans)
                    updated_count += 1

        await self.session.commit()
        return {
            "status": "RE_EXTRACTION_SUCCESS",
            "question_id": str(question_id),
            "target_pages": sorted(list(target_pages)),
            "updated_records": updated_count,
        }

    async def reject_question(
        self, question_id: uuid.UUID, rejection_reason: str, reviewer_notes: Optional[str] = None
    ) -> Question:
        """Flags question as REJECTED and records reviewer failure reason."""
        question = await self.session.get(Question, question_id)
        if not question:
            raise ValueError(f"Question with ID {question_id} not found.")

        question.status = QuestionStatus.REJECTED
        self.session.add(question)

        task_stmt = select(HumanReviewTask).where(HumanReviewTask.question_id == question_id)
        task = (await self.session.exec(task_stmt)).first()

        reasons = [rejection_reason]
        if task:
            task.review_status = "REJECTED"
            task.is_flagged_by_validator = True
            task.reviewer_notes = reviewer_notes
            task.failure_reasons_json = reasons
            task.reviewed_at = datetime.now(timezone.utc)
            self.session.add(task)

        await self.session.commit()
        await self.session.refresh(question)
        if question.exam_id:
            exam = await self.session.get(Exam, question.exam_id)
            if exam:
                exam.updated_at = datetime.now(timezone.utc)
                self.session.add(exam)
                await self.session.commit()
        return question

    async def update_question_explanation(
        self,
        question_id: uuid.UUID,
        core_concept: Optional[str] = None,
        detailed_solution: Optional[str] = None,
        common_traps: Optional[List[str]] = None,
        key_takeaways: Optional[List[str]] = None,
        language: str = "ENGLISH",
    ) -> Any:
        """Allows QA reviewers to manually edit and save question explanations."""
        from app.db.models.enums import LanguageCode
        from app.db.models.explanation import QuestionExplanation

        try:
            lang_enum = LanguageCode(language.upper())
        except ValueError:
            lang_enum = LanguageCode.ENGLISH

        expl_stmt = select(QuestionExplanation).where(
            QuestionExplanation.question_id == question_id,
            QuestionExplanation.language == lang_enum,
        )
        expl = (await self.session.exec(expl_stmt)).first()

        if not expl:
            expl = QuestionExplanation(
                question_id=question_id,
                language=lang_enum,
                core_concept=core_concept or "Reviewer Provided Concept",
                detailed_solution=detailed_solution or "Reviewer Provided Solution",
                common_traps_json=common_traps or [],
                key_takeaways_json=key_takeaways or [],
            )
        else:
            if core_concept:
                expl.core_concept = core_concept
            if detailed_solution:
                expl.detailed_solution = detailed_solution
            if common_traps is not None:
                expl.common_traps_json = common_traps
            if key_takeaways is not None:
                expl.key_takeaways_json = key_takeaways

        self.session.add(expl)
        await self.session.commit()
        await self.session.refresh(expl)

        # Touch parent Exam.updated_at & Real-time S3 individual question/solution sync
        q = await self.session.get(Question, question_id)
        if q and q.exam_id:
            exam = await self.session.get(Exam, q.exam_id)
            if exam:
                exam.updated_at = datetime.now(timezone.utc)
                self.session.add(exam)
                await self.session.commit()
            builder = ExamJsonBuilder(self.session)
            await builder.sync_single_question_artifacts(question_id)

        return expl
