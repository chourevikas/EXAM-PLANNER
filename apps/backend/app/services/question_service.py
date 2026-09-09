import math
from typing import Optional, List, Dict, Any
from fastapi import HTTPException
from sqlalchemy import func, update
from sqlmodel import select, or_, col
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
    SyllabusVersion,
    Subject,
    Topic,
    Subtopic,
    QuestionHierarchyLink,
    QuestionOptionReasoning,
    QuestionStatus,
    QuestionSourceType,
    LanguageCode,
    BloomsLevel,
    DifficultyLevel,
)
from app.schemas.question import (
    QuestionUpdatePayload,
    QuestionCreatePayload,
    QuestionHierarchyLinkPayload,
    QuestionDetailResponse,
    QuestionPaginatedResponse,
    QuestionOptionDetail,
    QuestionExplanationDetail,
    QuestionMetadataDetail,
    HierarchyLinkDetail,
    ExamReviewQuestionsResponse,
)
from datetime import datetime, timezone
from app.services.exam_json_builder import ExamJsonBuilder
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
        subject_id: Optional[int] = None,
        subject_name: Optional[str] = None,
        subject_code: Optional[str] = None,
        topic_id: Optional[int] = None,
        topic_name: Optional[str] = None,
        topic_code: Optional[str] = None,
        subtopic_id: Optional[int] = None,
        subtopic_name: Optional[str] = None,
        subtopic_code: Optional[str] = None,
        exam_id: Optional[int] = None,
        exam_name: Optional[str] = None,
        exam_type: Optional[QuestionSourceType] = None,
        exam_year: Optional[int] = None,
        paper_set_code: Optional[str] = None,
        stage: Optional[str] = None,
        status: Optional[QuestionStatus] = None,
        language: LanguageCode = LanguageCode.ENGLISH,
        include_solutions: bool = False,
        exclude_ids: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
    ) -> QuestionPaginatedResponse:
        from app.cache import get_cache, build_cache_key
        cache = get_cache()
        cache_key = build_cache_key(
            "questions:list",
            subject_id=str(subject_id) if subject_id else None,
            subject_name=subject_name,
            subject_code=subject_code,
            topic_id=str(topic_id) if topic_id else None,
            topic_name=topic_name,
            topic_code=topic_code,
            subtopic_id=str(subtopic_id) if subtopic_id else None,
            subtopic_name=subtopic_name,
            subtopic_code=subtopic_code,
            exam_id=str(exam_id) if exam_id else None,
            exam_name=exam_name,
            exam_type=str(exam_type.value if hasattr(exam_type, "value") else exam_type) if exam_type else None,
            exam_year=exam_year,
            paper_set_code=paper_set_code,
            stage=stage,
            status=str(status.value if hasattr(status, "value") else status) if status else None,
            language=str(language.value if hasattr(language, "value") else language),
            include_solutions=include_solutions,
            exclude=exclude_ids.strip() if exclude_ids else None,
            page=page,
            limit=limit,
        )
        cached_data = await cache.get(cache_key)
        if cached_data is not None:
            return QuestionPaginatedResponse(**cached_data)

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
            exclude_ids=exclude_ids,
            skip=skip,
            limit=limit,
        )

        items = await self._build_batch_question_detail_responses(
            questions, target_lang=language, include_solutions=include_solutions
        )

        pages = math.ceil(total / limit) if limit > 0 else 1

        response = QuestionPaginatedResponse(
            items=items,
            total=total,
            page=page,
            limit=limit,
            pages=pages,
        )
        if response is not None:
            await cache.set(cache_key, response.model_dump(mode="json"), ttl_seconds=1800)
        return response

    async def list_recommended_questions(
        self,
        subject_name: Optional[str] = None,
        topic_name: Optional[str] = None,
        exam_name: Optional[str] = None,
        exclude_ids: Optional[str] = None,
        language: LanguageCode = LanguageCode.ENGLISH,
        limit: int = 15,
    ) -> Dict[str, Any]:
        """Lightweight recommended-questions listing — skips the caching,
        passages, metadata, hierarchy-link detail, and explanations that the
        general listing endpoint carries, since a recommendation card only
        ever renders question text + options + subject/topic/subtopic names."""
        limit = max(1, min(50, limit))

        questions, _ = await self.repo.list_questions_filtered(
            subject_name=subject_name,
            topic_name=topic_name,
            exam_name=exam_name,
            exclude_ids=exclude_ids,
            skip=0,
            limit=limit,
        )

        items = await self._build_light_recommendation_cards(questions, target_lang=language)
        return {"items": items, "total": len(items)}

    async def _build_light_recommendation_cards(
        self,
        questions: List[Question],
        target_lang: LanguageCode = LanguageCode.ENGLISH,
    ) -> List[Dict[str, Any]]:
        if not questions:
            return []

        q_ids = [q.id for q in questions]
        subtopic_ids = list(set(q.subtopic_id for q in questions if q.subtopic_id))

        # Wave 1: question translations, options, and subtopics (via each
        # question's direct subtopic_id FK). No metadata/hierarchy-links/
        # explanations/passages at all here, unlike the full detail-response
        # builder. Run sequentially on self.session — against a remote,
        # high-latency DB, a few round trips on one open connection beats
        # each query paying its own connection handshake.
        wave1_specs: List[tuple] = [
            ("qt", select(QuestionTranslation).where(QuestionTranslation.question_id.in_(q_ids))),
            ("opt", select(QuestionOption)
                .where(QuestionOption.question_id.in_(q_ids))
                .order_by(QuestionOption.question_id, QuestionOption.display_order)),
            ("subtopics", select(Subtopic).where(Subtopic.id.in_(subtopic_ids)) if subtopic_ids else None),
        ]
        active_wave1 = [(name, stmt) for name, stmt in wave1_specs if stmt is not None]
        wave1 = {}
        for name, stmt in active_wave1:
            res = await self.session.exec(stmt)
            wave1[name] = res.all()

        qt_map: Dict[int, Dict[str, str]] = {}
        for qt in wave1.get("qt", []):
            qt_map.setdefault(qt.question_id, {})[qt.language] = qt.question_text

        options = wave1.get("opt", [])
        opt_map: Dict[int, list] = {}
        opt_ids = []
        for opt in options:
            opt_map.setdefault(opt.question_id, []).append(opt)
            opt_ids.append(opt.id)

        subtopics_map = {st.id: st for st in wave1.get("subtopics", [])}
        topic_ids = list(set(st.topic_id for st in subtopics_map.values() if st.topic_id))

        # Wave 2: option translations (needs opt_ids from wave 1) and topics
        # (needs topic_ids from wave 1's subtopics) — sequential on self.session.
        wave2_specs: List[tuple] = [
            ("ot", select(OptionTranslation).where(OptionTranslation.option_id.in_(opt_ids)) if opt_ids else None),
            ("topics", select(Topic).where(Topic.id.in_(topic_ids)) if topic_ids else None),
        ]
        active_wave2 = [(name, stmt) for name, stmt in wave2_specs if stmt is not None]
        wave2 = {}
        for name, stmt in active_wave2:
            res = await self.session.exec(stmt)
            wave2[name] = res.all()

        ot_map: Dict[int, Dict[str, str]] = {}
        for ot in wave2.get("ot", []):
            ot_map.setdefault(ot.option_id, {})[ot.language] = ot.option_text

        topics_map = {t.id: t for t in wave2.get("topics", [])}
        subject_ids = list(set(t.subject_id for t in topics_map.values() if t.subject_id))
        subjects_map = {}
        if subject_ids:
            s_res = await self.session.exec(select(Subject).where(Subject.id.in_(subject_ids)))
            subjects_map = {s.id: s for s in s_res.all()}

        lang_key = target_lang.value if hasattr(target_lang, "value") else str(target_lang)

        results: List[Dict[str, Any]] = []
        for q in questions:
            q_trans = qt_map.get(q.id, {})
            text = q_trans.get(lang_key) or (next(iter(q_trans.values())) if q_trans else f"Question #{q.question_number_in_paper}")

            opt_list = []
            for opt in opt_map.get(q.id, []):
                opt_trans = ot_map.get(opt.id, {})
                opt_text = opt_trans.get(lang_key) or (next(iter(opt_trans.values())) if opt_trans else f"Option {opt.option_label}")
                opt_list.append({
                    "option_id": str(opt.id),
                    "option_label": opt.option_label,
                    "text": opt_text,
                    # Recommendation cards highlight correct/incorrect the moment
                    # the user picks an answer (no separate reveal step), so
                    # unlike the general listing endpoint this boolean travels
                    # with the initial fetch. It costs nothing extra — it's
                    # already a column on the same QuestionOption row being
                    # fetched, no additional query.
                    "is_correct": bool(opt.is_correct),
                })

            subtopic = subtopics_map.get(q.subtopic_id) if q.subtopic_id else None
            topic = topics_map.get(subtopic.topic_id) if subtopic and subtopic.topic_id else None
            subject = subjects_map.get(topic.subject_id) if topic and topic.subject_id else None

            results.append({
                "question_id": str(q.id),
                "question_number": q.question_number_in_paper,
                "question_text": text,
                "options": opt_list,
                "subject_name": subject.name if subject else None,
                "topic_name": topic.name if topic else None,
                "subtopic_name": subtopic.name if subtopic else None,
                "difficulty": q.difficulty.value if hasattr(q.difficulty, "value") else str(q.difficulty),
                "marks": q.marks,
                "negative_marks": q.negative_marks,
                "expected_time_seconds": q.expected_time_seconds,
            })
        return results

    async def get_exam_questions_for_review(
        self,
        exam_id: int,
        page: int = 1,
        limit: int = 10,
        language: LanguageCode = LanguageCode.ENGLISH,
        status: Optional[QuestionStatus] = None,
    ) -> ExamReviewQuestionsResponse:
        """
        Dedicated Admin/Reviewer endpoint returning complete questions, options,
        option explanations (distractor analysis), core concepts, detailed solutions,
        key takeaways, and points to remember.
        """
        # 1. Fast SQL aggregation query combining Exam fetch & review metrics across the exam in a single round-trip
        stmt = (
            select(
                Exam,
                func.count(Question.id).label("total"),
                func.count(Question.id).filter(Question.status == QuestionStatus.PUBLISHED).label("reviewed"),
                func.count(Question.id).filter(Question.status == QuestionStatus.PENDING_HUMAN_REVIEW).label("pending"),
                func.count(Question.id).filter(Question.status == QuestionStatus.REJECTED).label("rejected"),
            )
            .outerjoin(Question, Question.exam_id == Exam.id)
            .where(Exam.id == exam_id)
            .group_by(Exam.id)
        )
        res = await self.session.exec(stmt)
        row = res.first()
        if not row or not row[0]:
            raise HTTPException(status_code=404, detail=f"Exam with ID '{exam_id}' not found.")

        exam = row[0]
        total_questions = row[1] or 0
        reviewed_count = row[2] or 0
        pending_count = row[3] or 0
        rejected_count = row[4] or 0
        can_publish = (pending_count == 0 and rejected_count == 0 and total_questions > 0)

        # 2. Database-level pagination
        page = max(1, page)
        limit = max(1, min(100, limit))
        start_idx = (page - 1) * limit

        page_stmt = select(Question).where(Question.exam_id == exam_id)
        if status is not None:
            page_stmt = page_stmt.where(Question.status == status)
        page_stmt = page_stmt.order_by(Question.question_number_in_paper).offset(start_idx).limit(limit)

        paged_res = await self.session.exec(page_stmt)
        paged_qs = paged_res.all()

        # Always include solutions for review endpoint, reuse preloaded exam
        items = await self._build_batch_question_detail_responses(
            paged_qs, target_lang=language, include_solutions=True, preloaded_exam=exam
        )

        # 3. Fast corruption check
        is_corrupted = False
        corruption_reason = None
        if total_questions == 0 and (exam.extracted_questions_count or 0) > 0:
            is_corrupted = True
            corruption_reason = f"Exam '{exam.code}' has extracted question count recorded ({exam.extracted_questions_count}) but 0 questions exist in database."
        elif items:
            for it in items:
                if not (it.question_text and it.question_text.strip()):
                    is_corrupted = True
                    corruption_reason = f"Database Corrupted: Question #{it.question_number_in_paper} has blank or missing question statement text in database."
                    break
                if not it.options:
                    is_corrupted = True
                    corruption_reason = f"Database Corrupted: Question #{it.question_number_in_paper} has 0 answer options in database."
                    break

        exam_status_str = exam.status.value if hasattr(exam.status, "value") else str(exam.status)
        is_s3_published = exam_status_str == "PUBLISHED"
        publish_error = None
        can_retry = False
        if is_corrupted:
            publish_status = "CORRUPTED"
        elif is_s3_published:
            publish_status = "PUBLISHED"
        elif can_publish:
            publish_status = "READY_FOR_PUBLISH"
        else:
            publish_status = "PENDING_REVIEW"

        filtered_count = total_questions
        if status == QuestionStatus.PUBLISHED:
            filtered_count = reviewed_count
        elif status == QuestionStatus.PENDING_HUMAN_REVIEW:
            filtered_count = pending_count
        elif status == QuestionStatus.REJECTED:
            filtered_count = rejected_count
        pages = math.ceil(filtered_count / limit) if limit > 0 else 1
        is_syncing = False
        is_s3_out_of_sync = False

        return ExamReviewQuestionsResponse(
            exam_id=str(exam.id),
            exam_name=exam.name,
            exam_code=exam.code,
            stage=exam.stage,
            source_year=exam.source_year,
            paper_set_code=exam.paper_set_code,
            total_questions=total_questions,
            reviewed_count=reviewed_count,
            pending_count=pending_count,
            rejected_count=rejected_count,
            can_publish=can_publish,
            is_published=is_s3_published,
            publish_status=publish_status,
            can_retry=can_retry,
            is_corrupted=is_corrupted,
            publish_error=publish_error,
            corruption_reason=corruption_reason,
            questions_json_path=exam.questions_json_path,
            solutions_json_path=exam.solutions_json_path,
            questions_json_folder_path=exam.questions_json_folder_path,
            solutions_json_folder_path=exam.solutions_json_folder_path,
            last_synced_at=exam.last_synced_at,
            updated_at=exam.updated_at,
            is_s3_out_of_sync=is_s3_out_of_sync,
            is_syncing=is_syncing,
            items=items,
            page=page,
            limit=limit,
            pages=pages,
        )

    async def get_question_detail(
        self, question_id: int | str, language: LanguageCode = LanguageCode.ENGLISH
    ) -> QuestionDetailResponse:
        from app.cache import get_cache, build_cache_key
        try:
            q_id = int(question_id)
        except (ValueError, TypeError):
            raise HTTPException(status_code=404, detail=f"Question with ID '{question_id}' not found.")

        cache = get_cache()
        cache_key = build_cache_key(
            "questions:detail",
            str(q_id),
            lang=str(language.value if hasattr(language, "value") else language),
        )
        cached_data = await cache.get(cache_key)
        if cached_data is not None:
            return QuestionDetailResponse(**cached_data)

        q = await self.repo.get_by_id(q_id)
        if not q:
            raise HTTPException(status_code=404, detail=f"Question with ID '{question_id}' not found.")
        detail_res = await self._build_question_detail_response(q, target_lang=language)
        if detail_res is not None:
            await cache.set(cache_key, detail_res.model_dump(mode="json"), ttl_seconds=3600)
        return detail_res

    async def update_question_detail(
        self, question_id: int | str, payload: QuestionUpdatePayload
    ) -> QuestionDetailResponse:
        from app.cache import invalidate_question_cache
        try:
            q_id = int(question_id)
        except (ValueError, TypeError):
            raise HTTPException(status_code=404, detail=f"Question with ID '{question_id}' not found.")

        q = await self.repo.get_by_id(q_id)
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

        # Update question status if provided, else default to PUBLISHED
        if payload.status:
            q.status = payload.status
        else:
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

        # Update Passage Translation or Create Passage
        if payload.passage_text is not None:
            q_passage_id = getattr(q, "passage_id", None)
            if not q_passage_id and payload.passage_text.strip():
                new_passage = Passage(
                    exam_id=q.exam_id,
                    is_complete=True,
                )
                self.session.add(new_passage)
                await self.session.flush()
                if hasattr(q, "passage_id"):
                    q.passage_id = new_passage.id
                    self.session.add(q)
                q_passage_id = new_passage.id

            if q_passage_id:
                pt_stmt = select(PassageTranslation).where(
                    PassageTranslation.passage_id == q_passage_id,
                    PassageTranslation.language == target_lang,
                )
                pt = (await self.session.exec(pt_stmt)).first()
                if pt:
                    pt.passage_text = payload.passage_text
                    self.session.add(pt)
                else:
                    new_pt = PassageTranslation(
                        passage_id=q_passage_id,
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
                else:
                    new_opt = QuestionOption(
                        question_id=q.id,
                        option_label=opt_payload.option_label,
                        display_order=opt_payload.display_order,
                        is_correct=opt_payload.is_correct,
                        closeness_score=opt_payload.closeness_score,
                    )
                    self.session.add(new_opt)
                    await self.session.flush()

                    new_ot = OptionTranslation(
                        option_id=new_opt.id,
                        language=target_lang,
                        option_text=opt_payload.option_text,
                        distractor_analysis=opt_payload.distractor_analysis,
                    )
                    self.session.add(new_ot)

        # Update Explanation (All 4 Parameters: core_concept, detailed_solution, common_traps, key_takeaways)
        if any([payload.core_concept, payload.detailed_solution, payload.common_traps is not None, payload.key_takeaways is not None]):
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
                    blooms_level=payload.blooms_level or BloomsLevel.ANALYZE,
                    cognitive_skill=payload.cognitive_skill or "Conceptual Reasoning",
                    primary_concept_tag=payload.primary_concept_tag or "GENERAL",
                )
                self.session.add(new_qm)

        # Resolve Subject, Topic, Subtopic by name if provided
        if payload.subject_name or payload.topic_name or payload.subtopic_name:
            resolved_subj_id = payload.subject_id
            resolved_top_id = payload.topic_id
            resolved_subtop_id = payload.subtopic_id

            if payload.subject_name and payload.subject_name.strip():
                clean_sname = payload.subject_name.strip()
                s_stmt = select(Subject).where(func.lower(Subject.name) == clean_sname.lower())
                subj_obj = (await self.session.exec(s_stmt)).first()
                if not subj_obj:
                    syl_stmt = select(SyllabusVersion)
                    if q.exam_id:
                        syl_stmt = syl_stmt.where(SyllabusVersion.exam_id == q.exam_id)
                    syl_ver = (await self.session.exec(syl_stmt)).first()
                    if not syl_ver:
                        syl_ver = SyllabusVersion(
                            exam_id=q.exam_id,
                            version_code="DEFAULT_v1",
                            title="Default Syllabus",
                        )
                        self.session.add(syl_ver)
                        await self.session.flush()
                    subj_obj = Subject(
                        version_id=syl_ver.id,
                        name=clean_sname,
                        code=clean_sname[:10].upper().replace(" ", "_"),
                    )
                    self.session.add(subj_obj)
                    await self.session.flush()
                resolved_subj_id = subj_obj.id

            if payload.topic_name and payload.topic_name.strip():
                clean_tname = payload.topic_name.strip()
                t_stmt = select(Topic).where(func.lower(Topic.name) == clean_tname.lower())
                if resolved_subj_id:
                    t_stmt = t_stmt.where(Topic.subject_id == resolved_subj_id)
                top_obj = (await self.session.exec(t_stmt)).first()
                if not top_obj:
                    top_obj = Topic(
                        name=clean_tname,
                        code=clean_tname[:10].upper().replace(" ", "_"),
                        subject_id=resolved_subj_id,
                    )
                    self.session.add(top_obj)
                    await self.session.flush()
                resolved_top_id = top_obj.id

            if payload.subtopic_name and payload.subtopic_name.strip():
                clean_stname = payload.subtopic_name.strip()
                st_stmt = select(Subtopic).where(func.lower(Subtopic.name) == clean_stname.lower())
                if resolved_top_id:
                    st_stmt = st_stmt.where(Subtopic.topic_id == resolved_top_id)
                subtop_obj = (await self.session.exec(st_stmt)).first()
                if not subtop_obj:
                    subtop_obj = Subtopic(
                        name=clean_stname,
                        code=clean_stname[:10].upper().replace(" ", "_"),
                        topic_id=resolved_top_id,
                    )
                    self.session.add(subtop_obj)
                    await self.session.flush()
                resolved_subtop_id = subtop_obj.id

            if resolved_subtop_id:
                payload.subtopic_id = resolved_subtop_id

        # Update Hierarchy Links
        if payload.subtopic_id or payload.subtopic_ids or payload.hierarchy_links:
            await self._save_hierarchy_links(
                question_id=q.id,
                subtopic_id=payload.subtopic_id,
                subtopic_ids=payload.subtopic_ids,
                hierarchy_links=payload.hierarchy_links,
            )

        is_content_updated = any([
            payload.question_text is not None,
            payload.passage_text is not None,
            payload.options is not None,
            payload.core_concept is not None,
            payload.detailed_solution is not None,
            payload.common_traps is not None,
            payload.key_takeaways is not None,
            payload.subject_name is not None,
            payload.topic_name is not None,
            payload.subtopic_name is not None,
            payload.subtopic_id is not None,
            payload.subtopic_ids is not None,
            payload.hierarchy_links is not None,
        ])

        if is_content_updated:
            from app.services.syllabus_service import SyllabusService
            await SyllabusService(self.session).evaluate_and_persist_question_integrity(q)
            await self._recalculate_exam_metrics(q.exam_id, commit=False)

        await self._touch_exam_updated_at(q.exam_id, commit=False)

        await self.session.commit()
        await self.session.refresh(q)

        from app.cache import invalidate_question_cache
        await invalidate_question_cache(str(q.id), str(q.exam_id) if q.exam_id else None)

        batched_resps = await self._build_batch_question_detail_responses(
            [q], target_lang=target_lang, include_solutions=True
        )
        return batched_resps[0] if batched_resps else await self._build_question_detail_response(
            q, target_lang=target_lang, include_solutions=True
        )

    async def _touch_exam_updated_at(self, exam_id: Optional[int], commit: bool = True):
        if not exam_id:
            return
        exam = await self.session.get(Exam, exam_id)
        if exam:
            exam.updated_at = datetime.now(timezone.utc)
            self.session.add(exam)
            if commit:
                await self.session.commit()

    async def _recalculate_exam_metrics(self, exam_id: Optional[int], commit: bool = True):
        if not exam_id:
            return
        exam_obj = await self.session.get(Exam, exam_id)
        if exam_obj:
            all_qs_res = await self.session.exec(
                select(Question.question_number_in_paper).where(Question.exam_id == exam_id)
            )
            extracted_numbers = set(all_qs_res.all())
            tot_exp = exam_obj.total_questions or 100
            missing_nums = [num for num in range(1, tot_exp + 1) if num not in extracted_numbers]
            exam_obj.extracted_questions_count = len(extracted_numbers)
            exam_obj.missing_questions_count = len(missing_nums)
            exam_obj.missing_question_numbers_json = missing_nums
            self.session.add(exam_obj)
            if commit:
                await self.session.commit()

    async def create_question(self, payload: QuestionCreatePayload) -> QuestionDetailResponse:
        exam = await self.session.get(Exam, payload.exam_id)
        if not exam:
            raise HTTPException(status_code=404, detail=f"Exam with ID '{payload.exam_id}' not found.")

        target_lang = payload.language or LanguageCode.ENGLISH

        q = Question(
            exam_id=payload.exam_id,
            question_number_in_paper=payload.question_number_in_paper,
            paper_set_code=payload.paper_set_code or "SET_A",
            section_code=payload.section_code or "DEFAULT",
            question_type=payload.question_type or "SINGLE_CHOICE",
            difficulty=payload.difficulty or DifficultyLevel.MEDIUM,
            marks=payload.marks or 2.0,
            negative_marks=payload.negative_marks or 0.66,
            expected_time_seconds=payload.expected_time_seconds or 60,
            status=QuestionStatus.PUBLISHED,
            is_complete=True,
            is_mcq=True,
        )
        self.session.add(q)
        await self.session.flush()

        # Question Translation
        new_qt = QuestionTranslation(
            question_id=q.id,
            language=target_lang,
            question_text=payload.question_text,
        )
        self.session.add(new_qt)

        # Passage
        if payload.passage_text:
            passage = Passage(
                exam_id=exam.id,
                is_complete=True,
            )
            self.session.add(passage)
            await self.session.flush()
            if hasattr(q, "passage_id"):
                q.passage_id = passage.id
                self.session.add(q)

            pt = PassageTranslation(
                passage_id=passage.id,
                language=target_lang,
                passage_text=payload.passage_text,
            )
            self.session.add(pt)

        # Options
        if payload.options:
            for opt_payload in payload.options:
                opt_obj = QuestionOption(
                    question_id=q.id,
                    option_label=opt_payload.option_label,
                    display_order=opt_payload.display_order,
                    is_correct=opt_payload.is_correct,
                    closeness_score=opt_payload.closeness_score,
                )
                self.session.add(opt_obj)
                await self.session.flush()

                new_ot = OptionTranslation(
                    option_id=opt_obj.id,
                    language=target_lang,
                    option_text=opt_payload.option_text,
                    distractor_analysis=opt_payload.distractor_analysis,
                )
                self.session.add(new_ot)

        # Explanation
        if any([payload.core_concept, payload.detailed_solution, payload.common_traps, payload.key_takeaways]):
            new_expl = QuestionExplanation(
                question_id=q.id,
                language=target_lang,
                core_concept=payload.core_concept or "",
                detailed_solution=payload.detailed_solution or "",
                common_traps_json=payload.common_traps or [],
                key_takeaways_json=payload.key_takeaways or [],
            )
            self.session.add(new_expl)

        # Metadata
        new_qm = QuestionMetadata(
            question_id=q.id,
            blooms_level=payload.blooms_level or BloomsLevel.ANALYZE,
            cognitive_skill=payload.cognitive_skill or "Conceptual Reasoning",
            primary_concept_tag=payload.primary_concept_tag or "GENERAL",
        )
        self.session.add(new_qm)

        # Hierarchy
        if payload.subtopic_id or payload.subtopic_ids or payload.hierarchy_links:
            await self._save_hierarchy_links(
                question_id=q.id,
                subtopic_id=payload.subtopic_id,
                subtopic_ids=payload.subtopic_ids,
                hierarchy_links=payload.hierarchy_links,
            )

        await self.session.commit()
        await self.session.refresh(q)
        await self._touch_exam_updated_at(payload.exam_id)
        await self._recalculate_exam_metrics(payload.exam_id)

        from app.cache import invalidate_question_cache
        await invalidate_question_cache(str(q.id), str(payload.exam_id))

        return await self._build_question_detail_response(q, target_lang=target_lang, include_solutions=True)

    async def _save_hierarchy_links(
        self,
        question_id: int,
        subtopic_id: Optional[int] = None,
        subtopic_ids: Optional[List[int]] = None,
        hierarchy_links: Optional[List[QuestionHierarchyLinkPayload]] = None,
    ):
        # 1. Collect and deduplicate target hierarchy link definitions keyed by subtopic_id (int)
        target_links: Dict[int, Dict[str, Any]] = {}

        if hierarchy_links:
            for idx, link_p in enumerate(hierarchy_links):
                s_id = link_p.subtopic_id
                t_id = link_p.topic_id
                subj_id = link_p.subject_id

                if not s_id and (link_p.subtopic_name or link_p.topic_name or link_p.subject_name):
                    s_name = (link_p.subject_name or "").strip() or "General Science"
                    t_name = (link_p.topic_name or "").strip() or "General Concepts"
                    st_name = (link_p.subtopic_name or "").strip() or t_name

                    syl_stmt = select(SyllabusVersion)
                    q_rec = await self.session.get(Question, question_id)
                    if q_rec and q_rec.exam_id:
                        syl_stmt = syl_stmt.where(SyllabusVersion.exam_id == q_rec.exam_id)
                    syl_ver = (await self.session.exec(syl_stmt)).first()
                    if not syl_ver:
                        syl_ver = SyllabusVersion(
                            exam_id=q_rec.exam_id if q_rec else None,
                            version_code="DEFAULT_v1",
                            title="Default Syllabus",
                        )
                        self.session.add(syl_ver)
                        await self.session.flush()

                    # Upsert Subject
                    s_stmt = select(Subject).where(
                        Subject.version_id == syl_ver.id,
                        func.lower(Subject.name) == s_name.lower(),
                    )
                    subj = (await self.session.exec(s_stmt)).first()
                    if not subj:
                        subj = Subject(
                            version_id=syl_ver.id,
                            name=s_name,
                            code=s_name[:10].upper().replace(" ", "_"),
                        )
                        self.session.add(subj)
                        await self.session.flush()
                    subj_id = subj.id

                    # Upsert Topic
                    t_stmt = select(Topic).where(
                        Topic.subject_id == subj.id,
                        func.lower(Topic.name) == t_name.lower(),
                    )
                    top = (await self.session.exec(t_stmt)).first()
                    if not top:
                        top = Topic(
                            subject_id=subj.id,
                            name=t_name,
                            code=t_name[:10].upper().replace(" ", "_"),
                        )
                        self.session.add(top)
                        await self.session.flush()
                    t_id = top.id

                    # Upsert Subtopic
                    st_stmt = select(Subtopic).where(
                        Subtopic.topic_id == top.id,
                        func.lower(Subtopic.name) == st_name.lower(),
                    )
                    subtop = (await self.session.exec(st_stmt)).first()
                    if not subtop:
                        subtop = Subtopic(
                            topic_id=top.id,
                            name=st_name,
                            code=st_name[:10].upper().replace(" ", "_"),
                        )
                        self.session.add(subtop)
                        await self.session.flush()
                    s_id = subtop.id

                elif s_id and (not t_id or not subj_id):
                    subtop = await self.session.get(Subtopic, s_id)
                    if subtop:
                        if not t_id:
                            t_id = subtop.topic_id
                        if not subj_id and t_id:
                            top = await self.session.get(Topic, t_id)
                            if top:
                                subj_id = top.subject_id

                if s_id:
                    is_prim = link_p.is_primary or (len(target_links) == 0 and idx == 0)
                    if s_id in target_links:
                        # Safely merge duplicate subtopic references
                        target_links[s_id]["is_primary"] = target_links[s_id]["is_primary"] or is_prim
                        target_links[s_id]["relevance_weight"] = max(
                            target_links[s_id]["relevance_weight"],
                            link_p.relevance_weight if link_p.relevance_weight is not None else 1.0,
                        )
                        if link_p.concept_name:
                            target_links[s_id]["concept_name"] = link_p.concept_name
                    else:
                        target_links[s_id] = {
                            "topic_id": t_id,
                            "subject_id": subj_id,
                            "is_primary": is_prim,
                            "relevance_weight": link_p.relevance_weight if link_p.relevance_weight is not None else 1.0,
                            "concept_name": link_p.concept_name,
                        }

        if subtopic_ids:
            for idx, s_id in enumerate(subtopic_ids):
                if s_id and s_id not in target_links:
                    t_id = None
                    subj_id = None
                    subtop = await self.session.get(Subtopic, s_id)
                    if subtop:
                        t_id = subtop.topic_id
                        if t_id:
                            top = await self.session.get(Topic, t_id)
                            if top:
                                subj_id = top.subject_id
                    is_prim = (len(target_links) == 0 and idx == 0)
                    target_links[s_id] = {
                        "topic_id": t_id,
                        "subject_id": subj_id,
                        "is_primary": is_prim,
                        "relevance_weight": 1.0,
                        "concept_name": None,
                    }

        if subtopic_id and subtopic_id not in target_links:
            t_id = None
            subj_id = None
            subtop = await self.session.get(Subtopic, subtopic_id)
            if subtop:
                t_id = subtop.topic_id
                if t_id:
                    top = await self.session.get(Topic, t_id)
                    if top:
                        subj_id = top.subject_id
            is_prim = (len(target_links) == 0)
            target_links[subtopic_id] = {
                "topic_id": t_id,
                "subject_id": subj_id,
                "is_primary": is_prim,
                "relevance_weight": 1.0,
                "concept_name": None,
            }

        if not target_links:
            return

        # Ensure at least one primary hierarchy link exists
        if not any(item["is_primary"] for item in target_links.values()):
            first_key = next(iter(target_links))
            target_links[first_key]["is_primary"] = True

        # 2. Fetch existing QuestionHierarchyLink records for this question
        existing_stmt = select(QuestionHierarchyLink).where(
            QuestionHierarchyLink.question_id == question_id
        )
        existing_links = (await self.session.exec(existing_stmt)).all()
        existing_by_subtopic: Dict[int, QuestionHierarchyLink] = {
            link.subtopic_id: link for link in existing_links
        }

        # 3. Clean up obsolete links not present in target_links
        for existing_subtopic_id, existing_link in existing_by_subtopic.items():
            if existing_subtopic_id not in target_links:
                await self.session.delete(existing_link)

        # Flush pending deletes first to ensure clean state in DB unique index
        await self.session.flush()

        # 4. Upsert target hierarchy links in-place (updating existing, adding new)
        primary_subtopic_id = None
        for s_id, data in target_links.items():
            if data["is_primary"] and not primary_subtopic_id:
                primary_subtopic_id = s_id

            if s_id in existing_by_subtopic:
                # In-place update of existing link
                link = existing_by_subtopic[s_id]
                link.topic_id = data["topic_id"]
                link.subject_id = data["subject_id"]
                link.is_primary = data["is_primary"]
                link.relevance_weight = data["relevance_weight"]
                if data["concept_name"] is not None:
                    link.concept_name = data["concept_name"]
                self.session.add(link)
            else:
                # Add new link
                link = QuestionHierarchyLink(
                    question_id=question_id,
                    subtopic_id=s_id,
                    topic_id=data["topic_id"],
                    subject_id=data["subject_id"],
                    is_primary=data["is_primary"],
                    relevance_weight=data["relevance_weight"],
                    concept_name=data["concept_name"],
                )
                self.session.add(link)

        await self.session.flush()

        # 5. Synchronize primary subtopic_id on Question
        if primary_subtopic_id or target_links:
            q_obj = await self.session.get(Question, question_id)
            if q_obj:
                q_obj.subtopic_id = primary_subtopic_id or next(iter(target_links))
                self.session.add(q_obj)

    async def delete_question(self, question_id: int | str) -> bool:
        q_id = int(question_id)
        q = await self.repo.get_by_id(q_id)
        if not q:
            raise HTTPException(status_code=404, detail=f"Question with ID '{question_id}' not found.")
        exam_id = q.exam_id
        q_num = q.question_number_in_paper
        exam = await self.session.get(Exam, exam_id) if exam_id else None
        exam_code = exam.code if exam else None
        paper_set = exam.paper_set_code if exam else "SET_A"

        await self.session.delete(q)
        await self.session.commit()

        from app.cache import invalidate_question_cache
        await invalidate_question_cache(str(question_id), str(exam_id) if exam_id else None)

        if exam_id:
            await self._touch_exam_updated_at(exam_id)
            await self._recalculate_exam_metrics(exam_id)
        if exam_code:
            builder = ExamJsonBuilder(self.session)
            await builder.delete_single_question_artifacts(exam_code, paper_set, q_num)
        return True

    async def get_question_yaml_file(self, question_id: int | str) -> str:
        q = await self.repo.get_by_id(question_id)
        if not q:
            raise HTTPException(status_code=404, detail="Question not found")
        return await async_export_question_to_yaml_string(self.session, q)

    async def get_question_markdown_file(self, question_id: int | str) -> str:
        q = await self.repo.get_by_id(question_id)
        if not q:
            raise HTTPException(status_code=404, detail="Question not found")
        storage = get_storage_provider()
        return await async_export_question_to_markdown(self.session, q, storage=storage)

    # --- Internal Helper ---

    async def _build_question_detail_response(
        self,
        q: Question,
        target_lang: LanguageCode = LanguageCode.ENGLISH,
        include_solutions: bool = True,
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
        q_passage_id = getattr(q, "passage_id", None)
        if q_passage_id:
            pt_stmt = select(PassageTranslation).where(PassageTranslation.passage_id == q_passage_id)
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
            opt_trans_map = {}
            for ot in o_translations:
                l_str = ot.language.value if hasattr(ot.language, "value") else str(ot.language)
                opt_trans_map[l_str] = ot.option_text
                if ot.language == target_lang or not o_text:
                    o_text = ot.option_text
                    if include_solutions and ot.distractor_analysis:
                        o_distractor = ot.distractor_analysis
                elif include_solutions and ot.distractor_analysis and not o_distractor:
                    o_distractor = ot.distractor_analysis

            if include_solutions and not o_distractor:
                qr_stmt = select(QuestionOptionReasoning).where(QuestionOptionReasoning.question_option_id == opt.id)
                qr = (await self.session.exec(qr_stmt)).first()
                if qr:
                    why_t = (qr.why_tempting or "").strip()
                    whats_t = (qr.whats_actually_true or "").strip()
                    if why_t and whats_t:
                        o_distractor = f"Why it seems tempting — {why_t}\n\nWhat's actually true — {whats_t}"
                    elif whats_t:
                        o_distractor = whats_t
                    elif why_t:
                        o_distractor = why_t

            options_detail.append(
                QuestionOptionDetail(
                    option_id=str(opt.id),
                    option_label=opt.option_label,
                    display_order=opt.display_order,
                    is_correct=opt.is_correct,
                    option_text=o_text,
                    distractor_analysis=o_distractor if include_solutions else None,
                    closeness_score=opt.closeness_score,
                    translations=opt_trans_map,
                )
            )

        # Fetch Explanation
        explanation_detail = None
        if include_solutions:
            expl_stmt = select(QuestionExplanation).where(
                QuestionExplanation.question_id == q.id,
                QuestionExplanation.language == target_lang,
            )
            expl_res = await self.session.exec(expl_stmt)
            expl_obj = expl_res.first()
            if not expl_obj:
                expl_stmt_all = select(QuestionExplanation).where(QuestionExplanation.question_id == q.id)
                expl_obj = (await self.session.exec(expl_stmt_all)).first()

            if expl_obj:
                explanation_detail = QuestionExplanationDetail(
                    explanation_id=str(expl_obj.id),
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

            rel_pct = int(round((link.relevance_weight or 1.0) * 100))
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
                    relevance_percentage=rel_pct,
                    concept_name=link.concept_name,
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
            passage_id=str(getattr(q, "passage_id", None)) if getattr(q, "passage_id", None) else None,
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

    async def _build_batch_question_detail_responses(
        self,
        questions: List[Question],
        target_lang: LanguageCode = LanguageCode.ENGLISH,
        include_solutions: bool = False,
        preloaded_exam: Optional[Exam] = None,
    ) -> List[QuestionDetailResponse]:
        if not questions:
            return []

        q_ids = [q.id for q in questions]
        exam_ids = list(set(q.exam_id for q in questions if q.exam_id))
        passage_ids = list(set(getattr(q, "passage_id", None) for q in questions if getattr(q, "passage_id", None)))

        # Consolidated Batch Lookups:
        # 1. Options & OptionTranslations joined in a single pass
        opt_stmt = (
            select(QuestionOption, OptionTranslation)
            .outerjoin(OptionTranslation, QuestionOption.id == OptionTranslation.option_id)
            .where(QuestionOption.question_id.in_(q_ids))
            .order_by(QuestionOption.question_id, QuestionOption.display_order)
        )
        opt_res = await self.session.exec(opt_stmt)
        options = []
        opt_map = {}
        ot_map = {}
        seen_opts = set()
        for opt, ot in opt_res.all():
            if opt.id not in seen_opts:
                seen_opts.add(opt.id)
                options.append(opt)
                opt_map.setdefault(opt.question_id, []).append(opt)
            if ot is not None:
                ot_map.setdefault(opt.id, {})[ot.language] = (ot.option_text, ot.distractor_analysis)

        # 2. Hierarchy links joined with Subtopic, Topic, Subject in a single pass
        hier_stmt = (
            select(QuestionHierarchyLink, Subtopic, Topic, Subject)
            .outerjoin(Subtopic, QuestionHierarchyLink.subtopic_id == Subtopic.id)
            .outerjoin(Topic, or_(QuestionHierarchyLink.topic_id == Topic.id, Subtopic.topic_id == Topic.id))
            .outerjoin(Subject, or_(QuestionHierarchyLink.subject_id == Subject.id, Topic.subject_id == Subject.id))
            .where(QuestionHierarchyLink.question_id.in_(q_ids))
        )
        hier_res = await self.session.exec(hier_stmt)
        link_map = {}
        subtopics_map = {}
        topics_map = {}
        subjects_map = {}
        for l, st, top, subj in hier_res.all():
            link_map.setdefault(l.question_id, []).append(l)
            if st:
                subtopics_map[st.id] = st
            if top:
                topics_map[top.id] = top
            if subj:
                subjects_map[subj.id] = subj

        # 3. Direct subtopic fallback joined with Topic and Subject
        direct_subtopic_ids = list(set(q.subtopic_id for q in questions if q.subtopic_id and q.subtopic_id not in subtopics_map))
        if direct_subtopic_ids:
            direct_stmt = (
                select(Subtopic, Topic, Subject)
                .outerjoin(Topic, Subtopic.topic_id == Topic.id)
                .outerjoin(Subject, Topic.subject_id == Subject.id)
                .where(Subtopic.id.in_(direct_subtopic_ids))
            )
            d_res = await self.session.exec(direct_stmt)
            for st, top, subj in d_res.all():
                if st:
                    subtopics_map[st.id] = st
                if top:
                    topics_map[top.id] = top
                if subj:
                    subjects_map[subj.id] = subj

        # 4. Question Translations
        qt_res = await self.session.exec(select(QuestionTranslation).where(QuestionTranslation.question_id.in_(q_ids)))
        qt_map = {}
        for qt in qt_res.all():
            qt_map.setdefault(qt.question_id, {})[qt.language] = qt.question_text

        # 5. Explanations (only when include_solutions is True)
        expl_map = {}
        if include_solutions:
            expl_res = await self.session.exec(select(QuestionExplanation).where(QuestionExplanation.question_id.in_(q_ids)))
            for expl in expl_res.all():
                expl_map.setdefault(expl.question_id, {})[expl.language] = expl

        # 6. Metadata
        meta_res = await self.session.exec(select(QuestionMetadata).where(QuestionMetadata.question_id.in_(q_ids)))
        meta_map = {m.question_id: m for m in meta_res.all()}

        # 7. Exams & Passages
        exams_map = {}
        if preloaded_exam:
            exams_map[preloaded_exam.id] = preloaded_exam
        elif exam_ids:
            ex_res = await self.session.exec(select(Exam).where(Exam.id.in_(exam_ids)))
            exams_map = {e.id: e for e in ex_res.all()}

        pt_map = {}
        if passage_ids:
            pt_res = await self.session.exec(select(PassageTranslation).where(PassageTranslation.passage_id.in_(passage_ids)))
            for pt in pt_res.all():
                pt_map.setdefault(pt.passage_id, {})[pt.language] = pt.passage_text

        from app.core.languages import normalize_language
        target_iso, target_enum = normalize_language(
            str(target_lang.value if hasattr(target_lang, "value") else target_lang)
        )

        # Assemble QuestionDetailResponse for all questions in memory
        results = []
        for q in questions:
            exam = exams_map.get(q.exam_id)

            # Question Text
            q_text_dict = qt_map.get(q.id, {})
            q_text_dict_str = {
                (k.value if hasattr(k, "value") else str(k)): v
                for k, v in q_text_dict.items()
            }
            q_text = (
                q_text_dict_str.get(target_enum)
                or q_text_dict_str.get(target_iso)
                or q_text_dict_str.get("ENGLISH")
                or (next(iter(q_text_dict_str.values())) if q_text_dict_str else "")
            )

            # Passage Text
            p_text = None
            p_text_dict_str = {}
            q_passage_id = getattr(q, "passage_id", None)
            if q_passage_id:
                p_text_dict = pt_map.get(q_passage_id, {})
                p_text_dict_str = {
                    (k.value if hasattr(k, "value") else str(k)): v
                    for k, v in p_text_dict.items()
                }
                p_text = (
                    p_text_dict_str.get(target_enum)
                    or p_text_dict_str.get(target_iso)
                    or p_text_dict_str.get("ENGLISH")
                    or (next(iter(p_text_dict_str.values())) if p_text_dict_str else None)
                )

            # Options
            q_opts = opt_map.get(q.id, [])
            opts_detail = []
            for opt in q_opts:
                ot_dict = ot_map.get(opt.id, {})
                ot_dict_str = {
                    (k.value if hasattr(k, "value") else str(k)): v
                    for k, v in ot_dict.items()
                }
                ot_tuple = (
                    ot_dict_str.get(target_enum)
                    or ot_dict_str.get(target_iso)
                    or ot_dict_str.get("ENGLISH")
                    or (next(iter(ot_dict_str.values())) if ot_dict_str else ("", None))
                )
                opt_trans_map = {
                    k: v[0]
                    for k, v in ot_dict_str.items()
                }
                opts_detail.append(
                    QuestionOptionDetail(
                        option_id=str(opt.id),
                        option_label=opt.option_label,
                        display_order=opt.display_order,
                        is_correct=opt.is_correct,
                        option_text=ot_tuple[0] if ot_tuple else "",
                        distractor_analysis=ot_tuple[1] if (include_solutions and ot_tuple and ot_tuple[1]) else None,
                        closeness_score=opt.closeness_score,
                        translations=opt_trans_map,
                    )
                )

            # Explanation
            explanation_detail = None
            if include_solutions:
                expl_dict = expl_map.get(q.id, {})
                expl_obj = expl_dict.get(target_lang) or (next(iter(expl_dict.values())) if expl_dict else None)
                if expl_obj:
                    expl_translations = {
                        (k.value if hasattr(k, "value") else str(k)): {
                            "core_concept": e.core_concept,
                            "detailed_solution": e.detailed_solution,
                            "common_traps": e.common_traps_json or ([e.common_mistake] if e.common_mistake else []),
                            "key_takeaways": e.key_takeaways_json or [],
                        }
                        for k, e in expl_dict.items()
                    }
                    traps = expl_obj.common_traps_json or ([expl_obj.common_mistake] if expl_obj.common_mistake else [])
                    explanation_detail = QuestionExplanationDetail(
                        explanation_id=str(expl_obj.id),
                        language=expl_obj.language.value if hasattr(expl_obj.language, "value") else str(expl_obj.language),
                        core_concept=expl_obj.core_concept,
                        detailed_solution=expl_obj.detailed_solution,
                        common_traps=traps,
                        key_takeaways=expl_obj.key_takeaways_json or [],
                        translations=expl_translations,
                    )

            # Metadata
            qm = meta_map.get(q.id)
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

            # Hierarchy
            h_list = link_map.get(q.id, [])
            hierarchy_detail = []
            for l in h_list:
                st = subtopics_map.get(l.subtopic_id)
                top = topics_map.get(st.topic_id) if st else None
                subj = subjects_map.get(top.subject_id) if top else None
                rel_pct = int(round((l.relevance_weight or 1.0) * 100))
                hierarchy_detail.append(
                    HierarchyLinkDetail(
                        subject_id=str(subj.id) if subj else None,
                        subject_name=subj.name if subj else None,
                        subject_code=subj.code if subj else None,
                        topic_id=str(top.id) if top else None,
                        topic_name=top.name if top else None,
                        topic_code=top.code if top else None,
                        subtopic_id=str(st.id) if st else None,
                        subtopic_name=st.name if st else None,
                        subtopic_code=st.code if st else None,
                        is_primary=l.is_primary,
                        relevance_weight=l.relevance_weight,
                        relevance_percentage=rel_pct,
                        concept_name=l.concept_name,
                    )
                )

            if not hierarchy_detail and q.subtopic_id:
                subtop = subtopics_map.get(q.subtopic_id)
                if subtop:
                    top = topics_map.get(subtop.topic_id) if subtop.topic_id else None
                    subj = subjects_map.get(top.subject_id) if top and top.subject_id else None
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
                            relevance_percentage=100,
                            concept_name=top.name if top else None,
                        )
                    )

            results.append(
                QuestionDetailResponse(
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
                    passage_id=str(getattr(q, "passage_id", None)) if getattr(q, "passage_id", None) else None,
                    passage_text=p_text,
                    passage_translations=p_text_dict_str,
                    question_text=q_text,
                    translations=q_text_dict_str,
                    options=opts_detail,
                    explanation=explanation_detail,
                    metadata=metadata_detail,
                    hierarchy=hierarchy_detail,
                    assets=[],
                    created_at=q.created_at.isoformat() if q.created_at else None,
                    updated_at=q.updated_at.isoformat() if q.updated_at else None,
                )
            )

        return results

    async def approve_all_questions_for_exam(self, exam_id: str | int) -> Dict[str, Any]:
        """Approve all questions for a given exam."""
        try:
            # Validate exam_id
            try:
                exam_id_int = int(exam_id)
            except (ValueError, TypeError):
                raise ValueError(f"Invalid exam ID: {exam_id}")
            # Fetch questions for the exam
            statement = (
                update(Question)
                .where(col(Question.exam_id) == exam_id_int)
                .values(status=QuestionStatus.PUBLISHED, requires_human_review=False)
            )
            result = await self.session.execute(statement)
            await self.session.commit()

            from app.cache import invalidate_exam_cache
            await invalidate_exam_cache(str(exam_id_int))

            return {
                "status": "SUCCESS",
                "exam_id": exam_id_int,
                "message": f"All questions for exam {exam_id_int} have been marked as PUBLISHED.",
            }
        except Exception as e:
            await self.session.rollback()
            raise Exception(f"Error approving questions for exam {exam_id}: {str(e)}")