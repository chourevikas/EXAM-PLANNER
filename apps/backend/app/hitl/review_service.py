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
from app.utils.pdf_utils import load_pdf_page_image_lazily
from app.pipeline.dsu_stitcher import async_crop_and_save_asset
from app.services.review_points_service import ReviewPointsService
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
        self, exam_id: Optional[int | str] = None, only_flagged: bool = False
    ) -> List[HumanReviewTask]:
        """Asynchronously fetches pending human review tasks for Admin review."""
        parsed_exam_id = None
        if exam_id is not None:
            try:
                parsed_exam_id = int(exam_id)
            except (ValueError, TypeError):
                return []

        from app.cache import get_cache, build_cache_key
        cache = get_cache()
        cache_key = build_cache_key(
            "review:tasks",
            str(parsed_exam_id) if parsed_exam_id else "all",
            only_flagged=only_flagged,
        )
        cached_data = await cache.get(cache_key)
        if cached_data is not None:
            return [HumanReviewTask(**t) for t in cached_data]

        # Join Question so tasks left behind by the legacy admin publish/reject
        # path (which updates Question.status directly without touching
        # HumanReviewTask) don't linger in the queue as already-finalized work.
        query = (
            select(HumanReviewTask)
            .join(Question, Question.id == HumanReviewTask.question_id)
            .where(
                HumanReviewTask.review_status == "PENDING_REVIEW",
                Question.status == QuestionStatus.PENDING_HUMAN_REVIEW,
            )
        )
        if parsed_exam_id:
            query = query.where(HumanReviewTask.exam_id == parsed_exam_id)
        if only_flagged:
            query = query.where(HumanReviewTask.is_flagged_by_validator == True)

        result = await self.session.exec(query.order_by(col(HumanReviewTask.created_at)))
        tasks = list(result.all())
        if tasks:
            serialized = [t.model_dump(mode="json") if hasattr(t, "model_dump") else t.dict() for t in tasks]
            await cache.set(cache_key, serialized, ttl_seconds=1800)
        return tasks

    async def get_question_review_detail(
        self, question_id: int | str
    ) -> Dict[str, Any]:
        """Asynchronously fetches full question details, passage context, translations, options, and audit flags."""
        try:
            q_id = int(question_id)
        except (ValueError, TypeError):
            raise ValueError(f"Question with ID {question_id} not found.")

        question = await self.session.get(Question, q_id)
        if not question:
            raise ValueError(f"Question with ID {question_id} not found.")

        review_task_res = await self.session.exec(
            select(HumanReviewTask).where(HumanReviewTask.question_id == q_id)
        )
        review_task = review_task_res.first()

        translations_res = await self.session.exec(
            select(QuestionTranslation).where(
                QuestionTranslation.question_id == q_id
            )
        )
        translations = translations_res.all()

        options_res = await self.session.exec(
            select(QuestionOption)
            .where(QuestionOption.question_id == q_id)
            .order_by(col(QuestionOption.display_order))
        )
        options = options_res.all()

        # Fetch linked passage if exists
        passage_detail = None
        q_passage_id = getattr(question, "passage_id", None)
        if q_passage_id:
            passage = await self.session.get(Passage, q_passage_id)
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

        # Batch load all OptionTranslations for these options in a single roundtrip query
        opt_ids = [opt.id for opt in options]
        trans_by_opt_id: Dict[int, List[OptionTranslation]] = {oid: [] for oid in opt_ids}
        if opt_ids:
            all_opt_trans_res = await self.session.exec(
                select(OptionTranslation).where(OptionTranslation.option_id.in_(opt_ids))
            )
            for ot in all_opt_trans_res.all():
                trans_by_opt_id.setdefault(ot.option_id, []).append(ot)

        opt_details = []
        for opt in options:
            opt_trans = trans_by_opt_id.get(opt.id, [])
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
                            "language": t.language.value if hasattr(t.language, "value") else str(t.language),
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

        # Fetch Hierarchy Links in bulk queries
        hierarchy_detail = []
        links_res = await self.session.exec(
            select(QuestionHierarchyLink).where(QuestionHierarchyLink.question_id == question_id)
        )
        links = links_res.all()
        if links:
            subj_ids = {l.subject_id for l in links if l.subject_id}
            topic_ids = {l.topic_id for l in links if l.topic_id}
            subtopic_ids = {l.subtopic_id for l in links if l.subtopic_id}

            subj_map = {}
            if subj_ids:
                s_res = await self.session.exec(select(Subject).where(Subject.id.in_(subj_ids)))
                subj_map = {s.id: s for s in s_res.all()}

            top_map = {}
            if topic_ids:
                t_res = await self.session.exec(select(Topic).where(Topic.id.in_(topic_ids)))
                top_map = {t.id: t for t in t_res.all()}

            subtop_map = {}
            if subtopic_ids:
                st_res = await self.session.exec(select(Subtopic).where(Subtopic.id.in_(subtopic_ids)))
                subtop_map = {st.id: st for st in st_res.all()}

            for link in links:
                subj = subj_map.get(link.subject_id)
                top = top_map.get(link.topic_id)
                subtop = subtop_map.get(link.subtopic_id)
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
        question_id: int | str,
        admin_id: Optional[int | str] = None,
        updated_passage_text: Optional[str] = None,
        updated_question_text: Optional[str] = None,
        updated_options: Optional[List[Dict[str, Any]]] = None,
        correct_option_label: Optional[str] = None,
        reviewer_notes: Optional[str] = None,
    ) -> Question:
        """Allows Admin to update passage context, question text, options, and publish the question."""
        try:
            q_id = int(question_id)
        except (ValueError, TypeError):
            raise ValueError(f"Question with ID {question_id} not found.")

        parsed_admin_id = None
        if admin_id is not None:
            try:
                parsed_admin_id = int(admin_id)
            except (ValueError, TypeError):
                parsed_admin_id = None

        question = await self.session.get(Question, q_id)
        if not question:
            raise ValueError(f"Question with ID {question_id} not found.")

        # 1. Update Passage Text if provided
        q_pass_id = getattr(question, "passage_id", None)
        if updated_passage_text and q_pass_id:
            p_trans_res = await self.session.exec(
                select(PassageTranslation).where(
                    PassageTranslation.passage_id == q_pass_id
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
                    QuestionTranslation.question_id == q_id
                )
            )
            trans = trans_res.first()
            if trans:
                trans.question_text = updated_question_text
                self.session.add(trans)

        # 3. Update Options if provided (text, correctness & distractor analysis) in bulk queries
        if updated_options or correct_option_label:
            options_res = await self.session.exec(
                select(QuestionOption).where(QuestionOption.question_id == q_id)
            )
            all_options = list(options_res.all())
            opts_by_label = {opt.option_label.upper(): opt for opt in all_options}

            if updated_options:
                opt_ids = [opt.id for opt in all_options]
                opt_trans_by_opt_id = {}
                if opt_ids:
                    all_ot_res = await self.session.exec(
                        select(OptionTranslation).where(OptionTranslation.option_id.in_(opt_ids))
                    )
                    for ot in all_ot_res.all():
                        opt_trans_by_opt_id[ot.option_id] = ot

                for opt_data in updated_options:
                    opt_label = (opt_data.get("option_label") or "").upper()
                    opt_text = opt_data.get("option_text")
                    is_corr = opt_data.get("is_correct", False)
                    d_analysis = opt_data.get("distractor_analysis")

                    opt = opts_by_label.get(opt_label)
                    if opt:
                        opt.is_correct = is_corr
                        self.session.add(opt)

                        opt_trans = opt_trans_by_opt_id.get(opt.id)
                        if opt_trans:
                            if opt_text:
                                opt_trans.option_text = opt_text
                            if d_analysis:
                                opt_trans.distractor_analysis = d_analysis
                            self.session.add(opt_trans)

            if correct_option_label:
                for opt in all_options:
                    opt.is_correct = (opt.option_label.upper() == correct_option_label.upper())
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
            select(HumanReviewTask).where(HumanReviewTask.question_id == q_id)
        )
        review_task = review_task_res.first()
        if review_task:
            review_task.review_status = "VERIFIED"
            review_task.assigned_admin_id = parsed_admin_id
            review_task.reviewer_notes = reviewer_notes
            review_task.reviewed_at = datetime.now(timezone.utc)
            self.session.add(review_task)

        await self.session.flush()
        await self.session.commit()
        await self.session.refresh(question)

        await ReviewPointsService(self.session).award_for_review_action(
            reviewer_id=parsed_admin_id,
            action="APPROVE",
            review_task_id=review_task.id if review_task else None,
            question_id=question.id,
        )

        from app.cache import invalidate_question_cache
        await invalidate_question_cache(str(question.id), str(question.exam_id) if question.exam_id else None)

        # Touch parent Exam.updated_at
        if question.exam_id:
            exam = await self.session.get(Exam, question.exam_id)
            if exam:
                exam.updated_at = datetime.now(timezone.utc)
                self.session.add(exam)
                await self.session.commit()

        return question

    async def trigger_llm_reextraction_for_question(
        self, question_id: int | str, admin_id: Optional[int | str] = None
    ) -> Dict[str, Any]:
        """Triggers sequential LLM re-extraction retry targeting the specific pages of the question and passage."""
        try:
            q_id = int(question_id)
        except (ValueError, TypeError):
            raise ValueError(f"Question with ID {question_id} not found.")

        question = await self.session.get(Question, q_id)
        if not question:
            raise ValueError(f"Question with ID {question_id} not found.")

        exam = await self.session.get(Exam, question.exam_id)
        if not exam or not exam.pdf_path:
            raise ValueError("Exam PDF path is missing or inaccessible.")

        target_pages = set(parse_json_field(question.page_numbers_json))
        re_pass_id = getattr(question, "passage_id", None)
        if re_pass_id:
            passage = await self.session.get(Passage, re_pass_id)
            if passage:
                target_pages.update(parse_json_field(passage.page_numbers_json))

        logger.info(
            f"[HITL RE-EXTRACTION] Running sequential LLM re-extraction retry for Question {question.question_number_in_paper} on Pages {sorted(list(target_pages))}"
        )

        # Execute Deterministic Re-Extraction Pass
        import asyncio
        from app.pipeline.docling_ocr_extractor import DoclingOcrExtractor
        from app.pipeline.regex_question_parser import split_into_question_blocks, parse_question_block
        extractor = DoclingOcrExtractor()
        loop = asyncio.get_running_loop()
        res = await loop.run_in_executor(None, extractor.extract, exam.pdf_path)
        blocks = split_into_question_blocks(res["full_markdown"])
        target_rec = None
        for b in blocks:
            if b["question_number"] == question.question_number_in_paper:
                target_rec = parse_question_block(b, pictures=res["pictures"], tables=res["tables"])
                break

        if target_rec:
            question.is_complete = target_rec.extraction_confidence >= 0.8
            question.has_image = bool(target_rec.pictures)
            question.difficulty = target_rec.difficulty
            if target_rec.subject_raw:
                question.subject_raw = target_rec.subject_raw
            if target_rec.topic_raw:
                question.topic_raw = target_rec.topic_raw
            if target_rec.subtopic_raw:
                question.subtopic_raw = target_rec.subtopic_raw
            self.session.add(question)

            # Update English translation
            q_trans_res = await self.session.exec(
                select(QuestionTranslation).where(
                    QuestionTranslation.question_id == question.id,
                )
            )
            q_trans = q_trans_res.first()
            if q_trans:
                q_trans.question_text = target_rec.stem
                self.session.add(q_trans)

            # Re-bind options
            for label, opt_text in target_rec.options.items():
                opt_res = await self.session.exec(
                    select(QuestionOption).where(
                        QuestionOption.question_id == question.id,
                        QuestionOption.option_label == label.upper(),
                    )
                )
                opt = opt_res.first()
                if opt:
                    opt.is_correct = (label.upper() == target_rec.answer_label.upper())
                    self.session.add(opt)
                    opt_trans_res = await self.session.exec(
                        select(OptionTranslation).where(
                            OptionTranslation.option_id == opt.id
                        )
                    )
                    opt_trans = opt_trans_res.first()
                    if opt_trans:
                        opt_trans.option_text = opt_text
                        self.session.add(opt_trans)
            updated_count = 1

        await self.session.commit()
        return {
            "status": "RE_EXTRACTION_SUCCESS",
            "question_id": str(question_id),
            "target_pages": sorted(list(target_pages)),
            "updated_records": updated_count,
        }

    async def reject_question(
        self,
        question_id: int | str,
        rejection_reason: str,
        reviewer_notes: Optional[str] = None,
        admin_id: Optional[int | str] = None,
    ) -> Question:
        """Flags question as REJECTED and records reviewer failure reason."""
        try:
            q_id = int(question_id)
        except (ValueError, TypeError):
            raise ValueError(f"Question with ID {question_id} not found.")

        parsed_admin_id = None
        if admin_id is not None:
            try:
                parsed_admin_id = int(admin_id)
            except (ValueError, TypeError):
                parsed_admin_id = None

        question = await self.session.get(Question, q_id)
        if not question:
            raise ValueError(f"Question with ID {question_id} not found.")

        question.status = QuestionStatus.REJECTED
        self.session.add(question)

        task_stmt = select(HumanReviewTask).where(HumanReviewTask.question_id == q_id)
        task = (await self.session.exec(task_stmt)).first()

        reasons = [rejection_reason]
        if task:
            task.review_status = "REJECTED"
            task.is_flagged_by_validator = True
            task.reviewer_notes = reviewer_notes
            task.failure_reasons_json = reasons
            task.reviewed_at = datetime.now(timezone.utc)
            if parsed_admin_id is not None:
                task.assigned_admin_id = parsed_admin_id
            self.session.add(task)

        await self.session.commit()
        await self.session.refresh(question)

        await ReviewPointsService(self.session).award_for_review_action(
            reviewer_id=parsed_admin_id,
            action="REJECT",
            review_task_id=task.id if task else None,
            question_id=question.id,
        )

        if question.exam_id:
            exam = await self.session.get(Exam, question.exam_id)
            if exam:
                exam.updated_at = datetime.now(timezone.utc)
                self.session.add(exam)
                await self.session.commit()
        return question

    async def update_question_explanation(
        self,
        question_id: int | str,
        core_concept: Optional[str] = None,
        detailed_solution: Optional[str] = None,
        common_traps: Optional[List[str]] = None,
        key_takeaways: Optional[List[str]] = None,
        language: str = "ENGLISH",
    ) -> Any:
        """Allows QA reviewers to manually edit and save question explanations."""
        try:
            q_id = int(question_id)
        except (ValueError, TypeError):
            raise ValueError(f"Question with ID {question_id} not found.")

        from app.db.models.enums import LanguageCode
        from app.db.models.explanation import QuestionExplanation

        try:
            lang_enum = LanguageCode(language.upper())
        except ValueError:
            lang_enum = LanguageCode.ENGLISH

        expl_stmt = select(QuestionExplanation).where(
            QuestionExplanation.question_id == q_id,
            QuestionExplanation.language == lang_enum,
        )
        expl = (await self.session.exec(expl_stmt)).first()

        if not expl:
            expl = QuestionExplanation(
                question_id=q_id,
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

        # Touch parent Exam.updated_at
        q = await self.session.get(Question, q_id)
        if q and q.exam_id:
            exam = await self.session.get(Exam, q.exam_id)
            if exam:
                exam.updated_at = datetime.now(timezone.utc)
                self.session.add(exam)
                await self.session.commit()

        return expl
