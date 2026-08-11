import uuid
import math
from typing import Optional, List, Dict, Any
from fastapi import HTTPException
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Exam,
    Question,
    QuestionTranslation,
    QuestionOption,
    OptionTranslation,
    QuestionExplanation,
    QuestionMetadata,
    QuestionAsset,
    Passage,
    PassageTranslation,
    Subject,
    Topic,
    Subtopic,
    QuestionHierarchyLink,
    QuestionStatus,
    QuestionSourceType,
    LanguageCode,
)
from app.schemas.question import (
    QuestionUpdatePayload,
    QuestionDetailResponse,
    QuestionPaginatedResponse,
    QuestionOptionDetail,
    QuestionExplanationDetail,
    QuestionMetadataDetail,
    HierarchyLinkDetail,
)
from app.repositories.question_repository import QuestionRepository
from app.storage.factory import get_storage_provider
from app.formatters.yaml_exporter import async_export_question_to_yaml_string
from app.formatters.markdown_exporter import async_export_question_to_markdown


class QuestionService:
    """Service handling business logic, CRUD, filtering, and exports for Question entities."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = QuestionRepository(session)

    async def list_questions_paginated(
        self,
        subject_id: Optional[uuid.UUID] = None,
        subject_name: Optional[str] = None,
        subject_code: Optional[str] = None,
        topic_id: Optional[uuid.UUID] = None,
        topic_name: Optional[str] = None,
        topic_code: Optional[str] = None,
        subtopic_id: Optional[uuid.UUID] = None,
        subtopic_name: Optional[str] = None,
        subtopic_code: Optional[str] = None,
        exam_id: Optional[uuid.UUID] = None,
        exam_name: Optional[str] = None,
        exam_type: Optional[QuestionSourceType] = None,
        exam_year: Optional[int] = None,
        paper_set_code: Optional[str] = None,
        stage: Optional[str] = None,
        status: Optional[QuestionStatus] = None,
        language: LanguageCode = LanguageCode.ENGLISH,
        page: int = 1,
        limit: int = 20,
    ) -> QuestionPaginatedResponse:
        page = max(1, page)
        limit = max(1, min(100, limit))
        skip = (page - 1) * limit

        questions, total = await self.repo.list_questions_filtered(
            subject_id=subject_id,
            subject_name=subject_name,
            subject_code=subject_code,
            topic_id=topic_id,
            topic_name=topic_name,
            topic_code=topic_code,
            subtopic_id=subtopic_id,
            subtopic_name=subtopic_name,
            subtopic_code=subtopic_code,
            exam_id=exam_id,
            exam_name=exam_name,
            exam_type=exam_type,
            exam_year=exam_year,
            paper_set_code=paper_set_code,
            stage=stage,
            status=status,
            skip=skip,
            limit=limit,
        )

        items = []
        for q in questions:
            detail = await self._build_question_detail_response(q, target_lang=language)
            items.append(detail)

        pages = math.ceil(total / limit) if limit > 0 else 1

        return QuestionPaginatedResponse(
            items=items,
            total=total,
            page=page,
            limit=limit,
            pages=pages,
        )

    async def get_question_detail(
        self, question_id: uuid.UUID, language: LanguageCode = LanguageCode.ENGLISH
    ) -> QuestionDetailResponse:
        q = await self.repo.get_by_id(question_id)
        if not q:
            raise HTTPException(status_code=404, detail=f"Question with ID '{question_id}' not found.")
        return await self._build_question_detail_response(q, target_lang=language)

    async def update_question_detail(
        self, question_id: uuid.UUID, payload: QuestionUpdatePayload
    ) -> QuestionDetailResponse:
        q = await self.repo.get_by_id(question_id)
        if not q:
            raise HTTPException(status_code=404, detail=f"Question with ID '{question_id}' not found.")

        target_lang = payload.language or LanguageCode.ENGLISH

        # Update core question attributes
        if payload.paper_set_code:
            q.paper_set_code = payload.paper_set_code
        if payload.section_code:
            q.section_code = payload.section_code
        if payload.difficulty:
            q.difficulty = payload.difficulty
        if payload.marks is not None:
            q.marks = payload.marks
        if payload.negative_marks is not None:
            q.negative_marks = payload.negative_marks
        if payload.expected_time_seconds is not None:
            q.expected_time_seconds = payload.expected_time_seconds
        if payload.subtopic_id:
            q.subtopic_id = payload.subtopic_id

        # Update question status to PUBLISHED upon saving
        q.status = QuestionStatus.PUBLISHED
        self.session.add(q)

        # Update Question Translation
        if payload.question_text is not None:
            qt_stmt = select(QuestionTranslation).where(
                QuestionTranslation.question_id == q.id,
                QuestionTranslation.language == target_lang,
            )
            qt = (await self.session.exec(qt_stmt)).first()
            if qt:
                qt.question_text = payload.question_text
                self.session.add(qt)
            else:
                new_qt = QuestionTranslation(
                    question_id=q.id,
                    language=target_lang,
                    question_text=payload.question_text,
                )
                self.session.add(new_qt)

        # Update Passage Translation
        if payload.passage_text is not None and q.passage_id:
            pt_stmt = select(PassageTranslation).where(
                PassageTranslation.passage_id == q.passage_id,
                PassageTranslation.language == target_lang,
            )
            pt = (await self.session.exec(pt_stmt)).first()
            if pt:
                pt.passage_text = payload.passage_text
                self.session.add(pt)
            else:
                new_pt = PassageTranslation(
                    passage_id=q.passage_id,
                    language=target_lang,
                    passage_text=payload.passage_text,
                )
                self.session.add(new_pt)

        # Update Options
        if payload.options is not None:
            for opt_payload in payload.options:
                opt_obj = None
                if opt_payload.option_id:
                    opt_obj = await self.session.get(QuestionOption, opt_payload.option_id)
                if not opt_obj:
                    opt_stmt = select(QuestionOption).where(
                        QuestionOption.question_id == q.id,
                        QuestionOption.option_label == opt_payload.option_label,
                    )
                    opt_obj = (await self.session.exec(opt_stmt)).first()

                if opt_obj:
                    opt_obj.is_correct = opt_payload.is_correct
                    opt_obj.display_order = opt_payload.display_order
                    opt_obj.closeness_score = opt_payload.closeness_score
                    self.session.add(opt_obj)

                    ot_stmt = select(OptionTranslation).where(
                        OptionTranslation.option_id == opt_obj.id,
                        OptionTranslation.language == target_lang,
                    )
                    ot = (await self.session.exec(ot_stmt)).first()
                    if ot:
                        ot.option_text = opt_payload.option_text
                        ot.distractor_analysis = opt_payload.distractor_analysis
                        self.session.add(ot)
                    else:
                        new_ot = OptionTranslation(
                            option_id=opt_obj.id,
                            language=target_lang,
                            option_text=opt_payload.option_text,
                            distractor_analysis=opt_payload.distractor_analysis,
                        )
                        self.session.add(new_ot)

        # Update Explanation
        if any([payload.core_concept, payload.detailed_solution, payload.common_traps, payload.key_takeaways]):
            expl_stmt = select(QuestionExplanation).where(
                QuestionExplanation.question_id == q.id,
                QuestionExplanation.language == target_lang,
            )
            expl = (await self.session.exec(expl_stmt)).first()
            if expl:
                if payload.core_concept is not None:
                    expl.core_concept = payload.core_concept
                if payload.detailed_solution is not None:
                    expl.detailed_solution = payload.detailed_solution
                if payload.common_traps is not None:
                    expl.common_traps_json = payload.common_traps
                if payload.key_takeaways is not None:
                    expl.key_takeaways_json = payload.key_takeaways
                self.session.add(expl)
            else:
                new_expl = QuestionExplanation(
                    question_id=q.id,
                    language=target_lang,
                    core_concept=payload.core_concept or "",
                    detailed_solution=payload.detailed_solution or "",
                    common_traps_json=payload.common_traps or [],
                    key_takeaways_json=payload.key_takeaways or [],
                )
                self.session.add(new_expl)

        # Update Metadata
        if any([payload.blooms_level, payload.cognitive_skill, payload.primary_concept_tag]):
            meta_stmt = select(QuestionMetadata).where(QuestionMetadata.question_id == q.id)
            qm = (await self.session.exec(meta_stmt)).first()
            if qm:
                if payload.blooms_level:
                    qm.blooms_level = payload.blooms_level
                if payload.cognitive_skill:
                    qm.cognitive_skill = payload.cognitive_skill
                if payload.primary_concept_tag:
                    qm.primary_concept_tag = payload.primary_concept_tag
                self.session.add(qm)
            else:
                new_qm = QuestionMetadata(
                    question_id=q.id,
                    blooms_level=payload.blooms_level or "ANALYZE",
                    cognitive_skill=payload.cognitive_skill or "Conceptual Reasoning",
                    primary_concept_tag=payload.primary_concept_tag or "GENERAL",
                )
                self.session.add(new_qm)

        await self.session.commit()
        await self.session.refresh(q)
        return await self._build_question_detail_response(q, target_lang=target_lang)

    async def delete_question(self, question_id: uuid.UUID) -> bool:
        q = await self.repo.get_by_id(question_id)
        if not q:
            raise HTTPException(status_code=404, detail=f"Question with ID '{question_id}' not found.")
        await self.session.delete(q)
        await self.session.commit()
        return True

    async def get_question_yaml_file(self, question_id: uuid.UUID) -> str:
        q = await self.repo.get_by_id(question_id)
        if not q:
            raise HTTPException(status_code=404, detail="Question not found")
        return await async_export_question_to_yaml_string(self.session, q)

    async def get_question_markdown_file(self, question_id: uuid.UUID) -> str:
        q = await self.repo.get_by_id(question_id)
        if not q:
            raise HTTPException(status_code=404, detail="Question not found")
        storage = get_storage_provider()
        return await async_export_question_to_markdown(self.session, q, storage=storage)

    # --- Internal Helper ---

    async def _build_question_detail_response(
        self, q: Question, target_lang: LanguageCode = LanguageCode.ENGLISH
    ) -> QuestionDetailResponse:
        exam = await self.session.get(Exam, q.exam_id) if q.exam_id else None

        # Fetch translations
        qt_stmt = select(QuestionTranslation).where(QuestionTranslation.question_id == q.id)
        qt_res = await self.session.exec(qt_stmt)
        q_translations = qt_res.all()

        trans_map = {}
        q_text = ""
        for t in q_translations:
            lang_str = t.language.value if hasattr(t.language, "value") else str(t.language)
            trans_map[lang_str] = t.question_text
            if t.language == target_lang or not q_text:
                q_text = t.question_text

        # Fetch Passage
        passage_text = None
        if q.passage_id:
            pt_stmt = select(PassageTranslation).where(PassageTranslation.passage_id == q.passage_id)
            pt_res = await self.session.exec(pt_stmt)
            p_translations = pt_res.all()
            for pt in p_translations:
                if pt.language == target_lang or not passage_text:
                    passage_text = pt.passage_text

        # Fetch Options
        opt_stmt = (
            select(QuestionOption)
            .where(QuestionOption.question_id == q.id)
            .order_by(QuestionOption.display_order)
        )
        opt_res = await self.session.exec(opt_stmt)
        options_list = opt_res.all()

        options_detail = []
        for opt in options_list:
            ot_stmt = select(OptionTranslation).where(OptionTranslation.option_id == opt.id)
            ot_res = await self.session.exec(ot_stmt)
            o_translations = ot_res.all()

            o_text = ""
            o_distractor = None
            for ot in o_translations:
                if ot.language == target_lang or not o_text:
                    o_text = ot.option_text
                    if ot.distractor_analysis:
                        o_distractor = ot.distractor_analysis

            options_detail.append(
                QuestionOptionDetail(
                    option_id=str(opt.id),
                    option_label=opt.option_label,
                    display_order=opt.display_order,
                    is_correct=opt.is_correct,
                    option_text=o_text,
                    distractor_analysis=o_distractor,
                    closeness_score=opt.closeness_score,
                )
            )

        # Fetch Explanation
        expl_stmt = select(QuestionExplanation).where(
            QuestionExplanation.question_id == q.id,
            QuestionExplanation.language == target_lang,
        )
        expl_res = await self.session.exec(expl_stmt)
        expl_obj = expl_res.first()
        if not expl_obj:
            # Fallback to any explanation
            expl_stmt_all = select(QuestionExplanation).where(QuestionExplanation.question_id == q.id)
            expl_obj = (await self.session.exec(expl_stmt_all)).first()

        explanation_detail = None
        if expl_obj:
            explanation_detail = QuestionExplanationDetail(
                language=expl_obj.language.value if hasattr(expl_obj.language, "value") else str(expl_obj.language),
                core_concept=expl_obj.core_concept,
                detailed_solution=expl_obj.detailed_solution,
                common_traps=expl_obj.common_traps_json or [],
                key_takeaways=expl_obj.key_takeaways_json or [],
            )

        # Fetch Metadata
        meta_stmt = select(QuestionMetadata).where(QuestionMetadata.question_id == q.id)
        qm = (await self.session.exec(meta_stmt)).first()
        metadata_detail = None
        if qm:
            metadata_detail = QuestionMetadataDetail(
                blooms_level=qm.blooms_level.value if hasattr(qm.blooms_level, "value") else str(qm.blooms_level),
                cognitive_skill=qm.cognitive_skill,
                primary_concept_tag=qm.primary_concept_tag,
                irt_discrimination_a=qm.irt_discrimination_a,
                irt_difficulty_b=qm.irt_difficulty_b,
                irt_pseudo_guessing_c=qm.irt_pseudo_guessing_c,
            )

        # Fetch Hierarchy Links
        hierarchy_detail = []
        links_stmt = select(QuestionHierarchyLink).where(QuestionHierarchyLink.question_id == q.id)
        links = (await self.session.exec(links_stmt)).all()

        for link in links:
            subj = await self.session.get(Subject, link.subject_id) if link.subject_id else None
            top = await self.session.get(Topic, link.topic_id) if link.topic_id else None
            subtop = await self.session.get(Subtopic, link.subtopic_id) if link.subtopic_id else None

            hierarchy_detail.append(
                HierarchyLinkDetail(
                    subject_id=str(link.subject_id) if link.subject_id else None,
                    subject_name=subj.name if subj else None,
                    subject_code=subj.code if subj else None,
                    topic_id=str(link.topic_id) if link.topic_id else None,
                    topic_name=top.name if top else None,
                    topic_code=top.code if top else None,
                    subtopic_id=str(link.subtopic_id) if link.subtopic_id else None,
                    subtopic_name=subtop.name if subtop else None,
                    subtopic_code=subtop.code if subtop else None,
                    is_primary=link.is_primary,
                    relevance_weight=link.relevance_weight,
                )
            )

        if not hierarchy_detail and q.subtopic_id:
            subtop = await self.session.get(Subtopic, q.subtopic_id)
            if subtop:
                top = await self.session.get(Topic, subtop.topic_id) if subtop.topic_id else None
                subj = await self.session.get(Subject, top.subject_id) if top and top.subject_id else None
                hierarchy_detail.append(
                    HierarchyLinkDetail(
                        subject_id=str(subj.id) if subj else None,
                        subject_name=subj.name if subj else None,
                        subject_code=subj.code if subj else None,
                        topic_id=str(top.id) if top else None,
                        topic_name=top.name if top else None,
                        topic_code=top.code if top else None,
                        subtopic_id=str(subtop.id),
                        subtopic_name=subtop.name,
                        subtopic_code=subtop.code,
                        is_primary=True,
                        relevance_weight=1.0,
                    )
                )

        # Fetch Assets
        asset_stmt = select(QuestionAsset).where(QuestionAsset.question_id == q.id)
        assets = (await self.session.exec(asset_stmt)).all()
        assets_list = [
            {
                "asset_id": str(a.id),
                "asset_path": a.asset_path,
                "asset_type": a.asset_type.value if hasattr(a.asset_type, "value") else str(a.asset_type),
                "caption": a.caption,
            }
            for a in assets
        ]

        return QuestionDetailResponse(
            question_id=str(q.id),
            exam_id=str(q.exam_id) if q.exam_id else None,
            exam_name=exam.name if exam else None,
            exam_code=exam.code if exam else None,
            exam_type=exam.exam_type.value if exam and hasattr(exam.exam_type, "value") else (str(exam.exam_type) if exam else "PYQ"),
            stage=exam.stage if exam else "prelims",
            source_year=q.source_year or (exam.source_year if exam else None),
            paper_set_code=q.paper_set_code,
            section_code=q.section_code,
            question_number_in_paper=q.question_number_in_paper,
            question_type=q.question_type,
            difficulty=q.difficulty.value if hasattr(q.difficulty, "value") else str(q.difficulty),
            marks=q.marks,
            negative_marks=q.negative_marks,
            expected_time_seconds=q.expected_time_seconds,
            status=q.status.value if hasattr(q.status, "value") else str(q.status),
            is_mcq=q.is_mcq,
            is_complete=q.is_complete,
            has_image=q.has_image,
            page_numbers=q.page_numbers_json or [],
            passage_id=str(q.passage_id) if q.passage_id else None,
            passage_text=passage_text,
            question_text=q_text,
            translations=trans_map,
            options=options_detail,
            explanation=explanation_detail,
            metadata=metadata_detail,
            hierarchy=hierarchy_detail,
            assets=assets_list,
            created_at=q.created_at.isoformat() if q.created_at else None,
            updated_at=q.updated_at.isoformat() if q.updated_at else None,
        )
