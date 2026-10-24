import math
import asyncio
from typing import Optional, List, Dict, Any, Tuple, Union
from fastapi import HTTPException
from sqlalchemy import case, func, update
from sqlmodel import select, or_, col
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.question_assets import serialize_question_asset
from app.config.logger import setup_logger

logger = setup_logger("QuestionService")

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
from app.core.languages import parse_language
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
        exam_year: Optional[Union[int, str]] = None,
        paper_set_code: Optional[str] = None,
        stage: Optional[str] = None,
        status: Optional[QuestionStatus] = None,
        language: LanguageCode | str = LanguageCode.ENGLISH,
        include_solutions: bool = False,
        exclude_ids: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
        difficulty: Optional[str] = None,
    ) -> QuestionPaginatedResponse:
        language = parse_language(language)
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
            difficulty=difficulty,
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
            difficulty=difficulty,
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
        subtopic_name: Optional[str] = None,
        exam_name: Optional[str] = None,
        difficulty: Optional[str] = None,
        exclude_ids: Optional[str] = None,
        language: LanguageCode | str = LanguageCode.ENGLISH,
        limit: int = 15,
    ) -> Dict[str, Any]:
        """Lightweight recommended-questions listing — skips the caching,
        passages, metadata, hierarchy-link detail, and explanations that the
        general listing endpoint carries, since a recommendation card only
        ever renders question text + options + subject/topic/subtopic names."""
        language = parse_language(language)
        limit = max(1, min(50, limit))

        questions, _ = await self.repo.list_questions_filtered(
            subject_name=subject_name,
            topic_name=topic_name,
            subtopic_name=subtopic_name,
            exam_name=exam_name,
            difficulty=difficulty,
            exclude_ids=exclude_ids,
            skip=0,
            limit=limit,
            status=QuestionStatus.PUBLISHED,
        )

        # Fallback 1: Relax subtopic filter if 0 questions found
        if not questions and subtopic_name:
            questions, _ = await self.repo.list_questions_filtered(
                subject_name=subject_name,
                topic_name=topic_name,
                exam_name=exam_name,
                exclude_ids=exclude_ids,
                skip=0,
                limit=limit,
                status=QuestionStatus.PUBLISHED,
            )

        # Fallback 2: Relax topic filter if 0 questions found (fetches questions from same subject)
        if not questions and topic_name:
            questions, _ = await self.repo.list_questions_filtered(
                subject_name=subject_name,
                exam_name=exam_name,
                exclude_ids=exclude_ids,
                skip=0,
                limit=limit,
                status=QuestionStatus.PUBLISHED,
            )

        # Only relax exam filter if the user did NOT specify an explicit exam_name filter
        if not questions and subject_name and not exam_name:
            questions, _ = await self.repo.list_questions_filtered(
                subject_name=subject_name,
                exclude_ids=exclude_ids,
                skip=0,
                limit=limit,
                status=QuestionStatus.PUBLISHED,
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
        exam_ids = list(set(q.exam_id for q in questions if q.exam_id))

        # Wave 1: question translations, options, subtopics, and exams (via each
        # question's direct FK). No metadata/hierarchy-links/
        # explanations/passages at all here, unlike the full detail-response
        # builder. Run sequentially on self.session.
        wave1_specs: List[tuple] = [
            ("qt", select(QuestionTranslation).where(QuestionTranslation.question_id.in_(q_ids))),
            ("opt", select(QuestionOption)
                .where(QuestionOption.question_id.in_(q_ids))
                .order_by(QuestionOption.question_id, QuestionOption.display_order)),
            ("subtopics", select(Subtopic).where(Subtopic.id.in_(subtopic_ids)) if subtopic_ids else None),
            ("exams", select(Exam).where(Exam.id.in_(exam_ids)) if exam_ids else None),
        ]
        active_wave1 = [(name, stmt) for name, stmt in wave1_specs if stmt is not None]
        wave1 = {}
        for name, stmt in active_wave1:
            res = await self.session.exec(stmt)
            wave1[name] = res.all()

        exams_map = {e.id: e for e in wave1.get("exams", [])}
        from app.services.exam_session_service import exam_badge_label, load_exam_type_codes
        type_codes = await load_exam_type_codes(self.session) if exams_map else set()

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

        from app.core.languages import normalize_language
        target_iso, target_enum = normalize_language(
            str(target_lang.value if hasattr(target_lang, "value") else target_lang)
        )

        # Ensure translations exist on-demand for target language
        await self._ensure_translations_on_demand(
            questions=questions,
            options=options,
            passages=[],
            target_iso=target_iso,
            target_enum=target_enum,
            qt_map=qt_map,
            ot_map=ot_map,
            pt_map={},
        )

        results: List[Dict[str, Any]] = []
        for q in questions:
            q_trans = qt_map.get(q.id, {})
            q_trans_str: Dict[str, str] = {}
            for k, v in q_trans.items():
                key_str = k.value if hasattr(k, "value") else str(k)
                q_trans_str[key_str] = v
                iso, enum_name = normalize_language(key_str)
                q_trans_str[iso] = v
                q_trans_str[enum_name] = v

            text = (
                q_trans_str.get(target_enum)
                or q_trans_str.get(target_iso)
                or q_trans_str.get("ENGLISH")
                or (next(iter(q_trans_str.values())) if q_trans_str else f"Question #{q.question_number_in_paper}")
            )

            opt_list = []
            for opt in opt_map.get(q.id, []):
                opt_trans = ot_map.get(opt.id, {})
                opt_trans_str: Dict[str, str] = {}
                for k, v in opt_trans.items():
                    val = v[0] if isinstance(v, (tuple, list)) else v
                    key_str = k.value if hasattr(k, "value") else str(k)
                    opt_trans_str[key_str] = val
                    iso, enum_name = normalize_language(key_str)
                    opt_trans_str[iso] = val
                    opt_trans_str[enum_name] = val

                opt_text = (
                    opt_trans_str.get(target_enum)
                    or opt_trans_str.get(target_iso)
                    or opt_trans_str.get("ENGLISH")
                    or (next(iter(opt_trans_str.values())) if opt_trans_str else f"Option {opt.option_label}")
                )
                opt_list.append({
                    "option_id": str(opt.id),
                    "option_label": opt.option_label,
                    "text": opt_text,
                    "translations": opt_trans_str,
                    # No is_correct here: the answer would be readable in the
                    # network tab before the student attempts the card. Cards
                    # learn the key from GET /questions/{id}/solution, which
                    # they fetch once an option is picked.
                })

            subtopic = subtopics_map.get(q.subtopic_id) if q.subtopic_id else None
            topic = topics_map.get(subtopic.topic_id) if subtopic and subtopic.topic_id else None
            subject = subjects_map.get(topic.subject_id) if topic and topic.subject_id else None

            exam_obj = exams_map.get(q.exam_id) if q.exam_id else None
            raw_exam_name = exam_obj.name if exam_obj else None
            # Badge by the paper's exam type code, so a renamed code shows up here too
            clean_exam_badge = exam_badge_label(raw_exam_name, type_codes) or "UPSC"

            results.append({
                "question_id": str(q.id),
                "question_number": q.question_number_in_paper,
                "question_text": text,
                "text": text,
                "translations": q_trans_str,
                "options": opt_list,
                "subject_name": subject.name if subject else None,
                "topic_name": topic.name if topic else None,
                "subtopic_name": subtopic.name if subtopic else None,
                "exam_name": clean_exam_badge,
                "exam_full_name": raw_exam_name,
                "source_year": q.source_year or (exam_obj.source_year if exam_obj else None),
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
        target_question_number: Optional[int] = None,
        target_question_id: Optional[Union[int, str]] = None,
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

        # 2. Database-level pagination & targeting
        limit = max(1, min(100, limit))
        target_index: Optional[int] = None
        matched_target_id: Optional[Union[str, int]] = None
        matched_target_num: Optional[int] = None

        if target_question_id or target_question_number:
            t_stmt = select(Question.id, Question.question_number_in_paper).where(Question.exam_id == exam_id)
            if target_question_id:
                try:
                    t_stmt = t_stmt.where(Question.id == int(target_question_id))
                except (ValueError, TypeError):
                    t_stmt = t_stmt.where(Question.id == target_question_id)
            elif target_question_number:
                t_stmt = t_stmt.where(Question.question_number_in_paper == target_question_number)

            t_res = await self.session.exec(t_stmt)
            target_row = t_res.first()
            if target_row:
                matched_target_id = target_row[0]
                matched_target_num = target_row[1]
                count_stmt = select(func.count(Question.id)).where(
                    Question.exam_id == exam_id,
                    Question.question_number_in_paper < matched_target_num,
                )
                if status is not None:
                    count_stmt = count_stmt.where(Question.status == status)
                c_res = await self.session.exec(count_stmt)
                count_before = c_res.one() or 0
                page = (count_before // limit) + 1
                target_index = count_before % limit

        page = max(1, page)
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
            target_index=target_index,
            target_question_id=str(matched_target_id) if matched_target_id is not None else None,
            target_question_number=matched_target_num,
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
        if not q or q.status == QuestionStatus.REJECTED:
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

        # Update Explanation (core_concept, detailed_solution, reverse_logic, common_traps, key_takeaways)
        if any([
            payload.core_concept,
            payload.detailed_solution,
            payload.reverse_logic is not None,
            payload.common_traps is not None,
            payload.key_takeaways is not None,
        ]):
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
                if payload.reverse_logic is not None:
                    expl.reverse_logic = payload.reverse_logic
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
                    reverse_logic=payload.reverse_logic,
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
            payload.reverse_logic is not None,
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
        if any([payload.core_concept, payload.detailed_solution, payload.reverse_logic, payload.common_traps, payload.key_takeaways]):
            new_expl = QuestionExplanation(
                question_id=q.id,
                language=target_lang,
                core_concept=payload.core_concept or "",
                detailed_solution=payload.detailed_solution or "",
                reverse_logic=payload.reverse_logic,
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
        hierarchy_links = payload.hierarchy_links
        if (
            not (payload.subtopic_id or payload.subtopic_ids or hierarchy_links)
            and (payload.subject_name or payload.topic_name or payload.subtopic_name)
        ):
            # Name-only mapping (e.g. the admin "Add Missing Question" form): resolve by name.
            hierarchy_links = [
                QuestionHierarchyLinkPayload(
                    subject_name=payload.subject_name,
                    topic_name=payload.topic_name,
                    subtopic_name=payload.subtopic_name,
                    is_primary=True,
                )
            ]
        if payload.subtopic_id or payload.subtopic_ids or hierarchy_links:
            await self._save_hierarchy_links(
                question_id=q.id,
                subtopic_id=payload.subtopic_id,
                subtopic_ids=payload.subtopic_ids,
                hierarchy_links=hierarchy_links,
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
            q_rec = await self.session.get(Question, question_id)
            syl_stmt = select(SyllabusVersion)
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

            for idx, link_p in enumerate(hierarchy_links):
                s_id = link_p.subtopic_id
                t_id = link_p.topic_id
                subj_id = link_p.subject_id

                if not s_id and (link_p.subtopic_name or link_p.topic_name or link_p.subject_name):
                    s_name = (link_p.subject_name or "").strip() or "General Science"
                    t_name = (link_p.topic_name or "").strip() or "General Concepts"
                    st_name = (link_p.subtopic_name or "").strip() or t_name

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

        # Manually delete dependent responses to prevent ForeignKeyViolationError on question_options cascade
        from sqlalchemy import text
        await self.session.execute(text("DELETE FROM user_question_responses WHERE question_id = :qid"), {"qid": q_id})
        await self.session.execute(text("DELETE FROM exam_question_responses WHERE question_id = :qid"), {"qid": q_id})

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
        from app.cache import get_cache, build_cache_key
        cache = get_cache()
        cache_key = build_cache_key("questions:yaml", str(question_id))
        cached = await cache.get(cache_key)
        if cached:
            return cached

        q = await self.repo.get_by_id(question_id)
        if not q:
            raise HTTPException(status_code=404, detail="Question not found")
        content = await async_export_question_to_yaml_string(self.session, q)
        if content:
            await cache.set(cache_key, content, ttl_seconds=3600)
        return content

    async def get_question_markdown_file(self, question_id: int | str) -> str:
        from app.cache import get_cache, build_cache_key
        cache = get_cache()
        cache_key = build_cache_key("questions:markdown", str(question_id))
        cached = await cache.get(cache_key)
        if cached:
            return cached

        q = await self.repo.get_by_id(question_id)
        if not q:
            raise HTTPException(status_code=404, detail="Question not found")
        storage = get_storage_provider()
        content = await async_export_question_to_markdown(self.session, q, storage=storage)
        if content:
            await cache.set(cache_key, content, ttl_seconds=3600)
        return content

    # --- Internal Helper ---

    async def _build_question_detail_response(
        self,
        q: Question,
        target_lang: LanguageCode = LanguageCode.ENGLISH,
        include_solutions: bool = True,
    ) -> QuestionDetailResponse:
        exam = await self.session.get(Exam, q.exam_id) if q.exam_id else None

        from app.core.languages import normalize_language
        target_iso, target_enum = normalize_language(
            str(target_lang.value if hasattr(target_lang, "value") else target_lang)
        )

        # Fetch translations
        qt_stmt = select(QuestionTranslation).where(QuestionTranslation.question_id == q.id)
        qt_res = await self.session.exec(qt_stmt)
        q_translations = qt_res.all()

        trans_map = {}
        q_text = ""
        for t in q_translations:
            lang_str = t.language.value if hasattr(t.language, "value") else str(t.language)
            trans_map[lang_str] = t.question_text
            iso_c, _ = normalize_language(lang_str)
            if iso_c:
                trans_map[iso_c] = t.question_text
            if (lang_str in (target_enum, target_iso)) or not q_text:
                q_text = t.question_text

        # Fetch Passage
        passage_text = None
        q_passage_id = getattr(q, "passage_id", None)
        if q_passage_id:
            pt_stmt = select(PassageTranslation).where(PassageTranslation.passage_id == q_passage_id)
            pt_res = await self.session.exec(pt_stmt)
            p_translations = pt_res.all()
            for pt in p_translations:
                p_lang_str = pt.language.value if hasattr(pt.language, "value") else str(pt.language)
                if (p_lang_str in (target_enum, target_iso)) or not passage_text:
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
        opt_ids = [opt.id for opt in options_list]
        ot_by_opt: Dict[int, list[OptionTranslation]] = {}
        qr_by_opt: Dict[int, QuestionOptionReasoning] = {}
        if opt_ids:
            all_ots = (await self.session.exec(
                select(OptionTranslation).where(col(OptionTranslation.option_id).in_(opt_ids))
            )).all()
            for ot in all_ots:
                ot_by_opt.setdefault(ot.option_id, []).append(ot)

            if include_solutions:
                all_qrs = (await self.session.exec(
                    select(QuestionOptionReasoning).where(col(QuestionOptionReasoning.question_option_id).in_(opt_ids))
                )).all()
                for qr in all_qrs:
                    qr_by_opt[qr.question_option_id] = qr

        for opt in options_list:
            o_translations = ot_by_opt.get(opt.id, [])

            o_text = ""
            o_distractor = None
            opt_trans_map = {}
            for ot in o_translations:
                l_str = ot.language.value if hasattr(ot.language, "value") else str(ot.language)
                opt_trans_map[l_str] = ot.option_text
                iso_c, _ = normalize_language(l_str)
                if iso_c:
                    opt_trans_map[iso_c] = ot.option_text
                if (l_str in (target_enum, target_iso)) or not o_text:
                    o_text = ot.option_text
                    if include_solutions and ot.distractor_analysis:
                        o_distractor = ot.distractor_analysis
                elif include_solutions and ot.distractor_analysis and not o_distractor:
                    o_distractor = ot.distractor_analysis

            if include_solutions and not o_distractor:
                qr = qr_by_opt.get(opt.id)
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

        # If target language is non-English and missing from existing translations, dynamically translate this single question on-demand
        from app.core.languages import normalize_language
        target_iso, target_enum = normalize_language(
            str(target_lang.value if hasattr(target_lang, "value") else target_lang)
        )
        if target_enum != "ENGLISH" and target_enum not in trans_map and target_iso not in trans_map:
            ot_map_single = {opt.id: {k: (v, None) for k, v in opt_det.translations.items()} for opt, opt_det in zip(options_list, options_detail)}
            pt_map_single = {q_passage_id: {}} if q_passage_id else {}
            await self._ensure_translations_on_demand(
                questions=[q],
                options=options_list,
                passages=[q_passage_id] if q_passage_id else [],
                target_iso=target_iso,
                target_enum=target_enum,
                qt_map={q.id: trans_map},
                ot_map=ot_map_single,
                pt_map=pt_map_single,
            )
            q_text = trans_map.get(target_enum) or trans_map.get(target_iso) or q_text
            for opt_det in options_detail:
                opt_dict = ot_map_single.get(int(opt_det.option_id), {})
                cand = opt_dict.get(target_enum) or opt_dict.get(target_iso)
                if cand:
                    cand_text = cand[0] if isinstance(cand, (tuple, list)) else cand
                    opt_det.option_text = cand_text
                    opt_det.translations[target_enum] = cand_text
                    opt_det.translations[target_iso] = cand_text

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
                # Not in the requested language yet: English, else any
                expl_stmt_all = (
                    select(QuestionExplanation)
                    .where(QuestionExplanation.question_id == q.id)
                    .order_by(case((col(QuestionExplanation.language) == LanguageCode.ENGLISH, 0), else_=1), col(QuestionExplanation.id))
                )
                expl_obj = (await self.session.exec(expl_stmt_all)).first()

            if expl_obj:
                explanation_detail = QuestionExplanationDetail(
                    explanation_id=str(expl_obj.id),
                    language=expl_obj.language.value if hasattr(expl_obj.language, "value") else str(expl_obj.language),
                    core_concept=expl_obj.core_concept,
                    detailed_solution=expl_obj.detailed_solution,
                    reverse_logic=expl_obj.reverse_logic,
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

        subj_ids = list({link.subject_id for link in links if link.subject_id})
        top_ids = list({link.topic_id for link in links if link.topic_id})
        subtop_ids = list({link.subtopic_id for link in links if link.subtopic_id})

        subjs_map = {}
        if subj_ids:
            subjs_res = await self.session.exec(select(Subject).where(Subject.id.in_(subj_ids)))
            subjs_map = {s.id: s for s in subjs_res.all()}

        tops_map = {}
        if top_ids:
            tops_res = await self.session.exec(select(Topic).where(Topic.id.in_(top_ids)))
            tops_map = {t.id: t for t in tops_res.all()}

        subtops_map = {}
        if subtop_ids:
            subtops_res = await self.session.exec(select(Subtopic).where(Subtopic.id.in_(subtop_ids)))
            subtops_map = {st.id: st for st in subtops_res.all()}

        for link in links:
            subj = subjs_map.get(link.subject_id) if link.subject_id else None
            top = tops_map.get(link.topic_id) if link.topic_id else None
            subtop = subtops_map.get(link.subtopic_id) if link.subtopic_id else None

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
        assets_list = [serialize_question_asset(a) for a in assets]

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

    @staticmethod
    async def _bg_translate_and_persist(
        missing_stems: List[Tuple[Any, str]],
        missing_options: List[Tuple[Any, str]],
        missing_passages: List[Tuple[int, str]],
        target_iso: str,
        lang_db_enum: Any,
    ) -> None:
        """Background worker to translate large question batches without blocking the caller."""
        try:
            from app.db.models import QuestionTranslation, OptionTranslation, PassageTranslation
            from app.services.google_translation_service import GoogleTranslationService
            from app.db.session import async_session_factory
            from app.db.upsert import bulk_insert_on_conflict_do_nothing

            translator = GoogleTranslationService()

            # Batch and deduplicate all texts across stems, options, and passages into 1 call
            raw_texts = (
                [t for _, t in missing_stems]
                + [t for _, t in missing_options]
                + [t for _, t in missing_passages]
            )
            unique_texts = list(dict.fromkeys(t for t in raw_texts if t and str(t).strip()))
            trans_dict = {}
            if unique_texts:
                translated_list = await translator.translate_batch(
                    unique_texts, target_language=target_iso, source_language="en"
                )
                trans_dict = dict(zip(unique_texts, translated_list))

            bg_q_records = []
            for q, text in missing_stems:
                t_text = trans_dict.get(text, text)
                bg_q_records.append(QuestionTranslation(question_id=q.id, language=lang_db_enum, question_text=t_text))

            bg_opt_records = []
            for opt, text in missing_options:
                t_text = trans_dict.get(text, text)
                bg_opt_records.append(OptionTranslation(option_id=opt.id, language=lang_db_enum, option_text=t_text))

            bg_pass_records = []
            for p_id, text in missing_passages:
                t_text = trans_dict.get(text, text)
                bg_pass_records.append(PassageTranslation(passage_id=p_id, language=lang_db_enum, passage_text=t_text))

            total_records = len(bg_q_records) + len(bg_opt_records) + len(bg_pass_records)
            if total_records > 0:
                async with async_session_factory() as s:
                    if bg_q_records:
                        await bulk_insert_on_conflict_do_nothing(
                            s, QuestionTranslation, bg_q_records, ["question_id", "language"]
                        )
                    if bg_opt_records:
                        await bulk_insert_on_conflict_do_nothing(
                            s, OptionTranslation, bg_opt_records, ["option_id", "language"]
                        )
                    if bg_pass_records:
                        await bulk_insert_on_conflict_do_nothing(
                            s, PassageTranslation, bg_pass_records, ["passage_id", "language"]
                        )
                    await s.commit()
                logger.info(f"⚡ Background translation persisted {total_records} records for {target_iso}.")
        except Exception as e:
            logger.warning(f"Background translation task failed: {e}", exc_info=True)

    async def _ensure_translations_on_demand(
        self,
        questions: List[Question],
        options: List[QuestionOption],
        passages: List[Any],
        target_iso: str,
        target_enum: str,
        qt_map: Dict[int, Dict[Any, str]],
        ot_map: Dict[int, Dict[Any, Any]],
        pt_map: Dict[int, Dict[Any, str]],
    ) -> None:
        """Dynamically translates any missing question stems, options, and passages on-the-fly and persists to DB."""
        if target_enum == "ENGLISH":
            return

        try:
            from app.db.models import LanguageCode, QuestionTranslation, OptionTranslation, PassageTranslation
            from app.services.google_translation_service import GoogleTranslationService

            try:
                lang_db_enum = LanguageCode[target_enum]
            except (KeyError, AttributeError):
                lang_db_enum = target_enum

            def _get_stored_q_trans(q_id: int, key_enum: str, key_iso: str) -> str:
                """Returns the stored translated text for a question, or empty string if not found."""
                qmap = qt_map.get(q_id, {})
                for k in (key_enum, key_iso):
                    v = qmap.get(k)
                    if v:
                        return v.get("question_text") if isinstance(v, dict) else str(v)
                return ""

            def _get_stored_opt_trans(opt_id: int, key_enum: str, key_iso: str) -> str:
                """Returns the stored translated text for an option, or empty string if not found."""
                omap = ot_map.get(opt_id, {})
                for k in (key_enum, key_iso):
                    v = omap.get(k)
                    if v:
                        return (v[0] if isinstance(v, (tuple, list)) else str(v))
                return ""

            # 1. Identify missing OR incorrectly-stored (same as English) question stems
            missing_q_stems: List[Tuple[Question, str]] = []
            for q in questions:
                existing_langs = {
                    (k.value if hasattr(k, "value") else str(k))
                    for k in qt_map.get(q.id, {}).keys()
                }
                # Fetch English source text first
                eng_text = qt_map.get(q.id, {}).get("ENGLISH") or qt_map.get(q.id, {}).get(LanguageCode.ENGLISH)
                if not eng_text:
                    eng_text = next(iter(qt_map.get(q.id, {}).values()), "")
                if not eng_text:
                    eng_text = getattr(q, "question_text", None) or getattr(q, "text", "")
                if not eng_text or not str(eng_text).strip():
                    continue
                eng_text = str(eng_text).strip()
                # Check if translation is missing OR stored value == English source (un-translated)
                stored = _get_stored_q_trans(q.id, target_enum, target_iso)
                is_missing = target_enum not in existing_langs and target_iso not in existing_langs
                is_same_as_english = stored and stored.strip() == eng_text.strip()
                if is_missing or is_same_as_english:
                    missing_q_stems.append((q, eng_text))

            # 2. Identify missing OR incorrectly-stored options
            missing_opts: List[Tuple[QuestionOption, str]] = []
            for opt in options:
                opt_existing = {
                    (k.value if hasattr(k, "value") else str(k))
                    for k in ot_map.get(opt.id, {}).keys()
                }
                val = ot_map.get(opt.id, {}).get("ENGLISH") or ot_map.get(opt.id, {}).get(LanguageCode.ENGLISH)
                eng_opt_text = (val[0] if isinstance(val, (tuple, list)) else val) if val else ""
                if not eng_opt_text:
                    first_val = next(iter(ot_map.get(opt.id, {}).values()), "")
                    eng_opt_text = (first_val[0] if isinstance(first_val, (tuple, list)) else first_val) if first_val else ""
                if not eng_opt_text:
                    eng_opt_text = getattr(opt, "option_text", "")
                if not eng_opt_text or not str(eng_opt_text).strip():
                    continue
                eng_opt_text = str(eng_opt_text).strip()
                stored_opt = _get_stored_opt_trans(opt.id, target_enum, target_iso)
                is_opt_missing = target_enum not in opt_existing and target_iso not in opt_existing
                is_opt_same_as_english = stored_opt and stored_opt.strip() == eng_opt_text.strip()
                if is_opt_missing or is_opt_same_as_english:
                    missing_opts.append((opt, eng_opt_text))

            # 3. Identify missing passages
            missing_pass: List[Tuple[int, str]] = []
            for p_id in passages:
                if not p_id:
                    continue
                p_existing = {
                    (k.value if hasattr(k, "value") else str(k))
                    for k in pt_map.get(p_id, {}).keys()
                }
                if target_enum not in p_existing and target_iso not in p_existing:
                    eng_p_text = pt_map.get(p_id, {}).get("ENGLISH") or pt_map.get(p_id, {}).get(LanguageCode.ENGLISH)
                    if not eng_p_text:
                        eng_p_text = next(iter(pt_map.get(p_id, {}).values()), "")
                    if eng_p_text and str(eng_p_text).strip():
                        missing_pass.append((p_id, str(eng_p_text).strip()))

            if not missing_q_stems and not missing_opts and not missing_pass:
                return

            # Prioritize first 20 questions synchronously for instant response; offload remaining to background task
            if len(missing_q_stems) > 20:
                sync_q_set = {q.id for q, _ in missing_q_stems[:20]}
                sync_stems = missing_q_stems[:20]
                bg_stems = missing_q_stems[20:]

                sync_opts = [item for item in missing_opts if item[0].question_id in sync_q_set]
                bg_opts = [item for item in missing_opts if item[0].question_id not in sync_q_set]

                missing_q_stems = sync_stems
                missing_opts = sync_opts

                if bg_stems or bg_opts:
                    asyncio.create_task(
                        QuestionService._bg_translate_and_persist(
                            bg_stems, bg_opts, [], target_iso, lang_db_enum
                        )
                    )

            translator = GoogleTranslationService()

            # Batch and deduplicate all texts across stems, options, and passages into a single call
            raw_texts = (
                [text for _, text in missing_q_stems]
                + [text for _, text in missing_opts]
                + [text for _, text in missing_pass]
            )
            unique_texts = list(dict.fromkeys(t for t in raw_texts if t and str(t).strip()))
            trans_dict = {}
            if unique_texts:
                translated_list = await translator.translate_batch(
                    unique_texts, target_language=target_iso, source_language="en"
                )
                trans_dict = dict(zip(unique_texts, translated_list))

            new_q_records = []
            for (q, text) in missing_q_stems:
                t_text = trans_dict.get(text, text)
                qt_map.setdefault(q.id, {})[target_enum] = t_text
                qt_map[q.id][lang_db_enum] = t_text
                qt_map[q.id][target_iso] = t_text
                new_q_records.append(QuestionTranslation(
                    question_id=q.id,
                    language=lang_db_enum,
                    question_text=t_text,
                ))

            new_opt_records = []
            for (opt, text) in missing_opts:
                t_text = trans_dict.get(text, text)
                ot_map.setdefault(opt.id, {})[target_enum] = (t_text, None)
                ot_map[opt.id][lang_db_enum] = (t_text, None)
                ot_map[opt.id][target_iso] = (t_text, None)
                new_opt_records.append(OptionTranslation(
                    option_id=opt.id,
                    language=lang_db_enum,
                    option_text=t_text,
                ))

            new_pass_records = []
            for (p_id, text) in missing_pass:
                t_text = trans_dict.get(text, text)
                pt_map.setdefault(p_id, {})[target_enum] = t_text
                pt_map[p_id][lang_db_enum] = t_text
                pt_map[p_id][target_iso] = t_text
                new_pass_records.append(PassageTranslation(
                    passage_id=p_id,
                    language=lang_db_enum,
                    passage_text=t_text,
                ))

            # Persist translations using upsert (ON CONFLICT UPDATE) to correct any previously wrong translations
            if new_q_records or new_opt_records or new_pass_records:
                try:
                    from app.db.session import async_session_factory
                    from app.db.upsert import bulk_upsert_translations
                    async with async_session_factory() as trans_session:
                        if new_q_records:
                            await bulk_upsert_translations(
                                trans_session, QuestionTranslation, new_q_records,
                                ["question_id", "language"], update_cols=["question_text"]
                            )
                        if new_opt_records:
                            await bulk_upsert_translations(
                                trans_session, OptionTranslation, new_opt_records,
                                ["option_id", "language"], update_cols=["option_text"]
                            )
                        if new_pass_records:
                            await bulk_upsert_translations(
                                trans_session, PassageTranslation, new_pass_records,
                                ["passage_id", "language"], update_cols=["passage_text"]
                            )
                        await trans_session.commit()
                        logger.info(f"✅ On-demand upserted {len(new_q_records)} Q + {len(new_opt_records)} opt + {len(new_pass_records)} passage translations for {target_enum}.")
                except Exception as commit_err:
                    logger.warning(f"Failed to persist on-demand translations: {commit_err}", exc_info=True)
        except Exception as err:
            logger.error(f"On-demand translation failed: {err}", exc_info=True)

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

        # Diagram/picture assets, only for questions that have any
        assets_by_qid: Dict[int, List[Dict[str, Any]]] = {}
        image_q_ids = [q.id for q in questions if q.has_image]
        if image_q_ids:
            asset_rows = (await self.session.exec(
                select(QuestionAsset)
                .where(col(QuestionAsset.question_id).in_(image_q_ids))
                .order_by(QuestionAsset.display_order, QuestionAsset.id)
            )).all()
            for a in asset_rows:
                assets_by_qid.setdefault(a.question_id, []).append(serialize_question_asset(a))

        qr_by_optid = {}
        if include_solutions and options:
            all_opt_ids = [opt.id for opt in options]
            all_qrs = (await self.session.exec(
                select(QuestionOptionReasoning).where(col(QuestionOptionReasoning.question_option_id).in_(all_opt_ids))
            )).all()
            for qr in all_qrs:
                qr_by_optid[qr.question_option_id] = qr

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

        # Ensure translations exist on-demand for target language
        await self._ensure_translations_on_demand(
            questions=questions,
            options=options,
            passages=passage_ids,
            target_iso=target_iso,
            target_enum=target_enum,
            qt_map=qt_map,
            ot_map=ot_map,
            pt_map=pt_map,
        )

        # Assemble QuestionDetailResponse for all questions in memory
        results = []
        for q in questions:
            exam = exams_map.get(q.exam_id)

            # Question Text
            q_text_dict = qt_map.get(q.id, {})
            q_text_dict_str = {}
            for k, v in q_text_dict.items():
                k_str = k.value if hasattr(k, "value") else str(k)
                q_text_dict_str[k_str] = v
                iso_c, _ = normalize_language(k_str)
                if iso_c:
                    q_text_dict_str[iso_c] = v
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
                for k, v in p_text_dict.items():
                    k_str = k.value if hasattr(k, "value") else str(k)
                    p_text_dict_str[k_str] = v
                    iso_c, _ = normalize_language(k_str)
                    if iso_c:
                        p_text_dict_str[iso_c] = v
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
                ot_dict_str = {}
                for k, v in ot_dict.items():
                    k_str = k.value if hasattr(k, "value") else str(k)
                    ot_dict_str[k_str] = v
                    iso_c, _ = normalize_language(k_str)
                    if iso_c:
                        ot_dict_str[iso_c] = v
                ot_tuple = (
                    ot_dict_str.get(target_enum)
                    or ot_dict_str.get(target_iso)
                    or ot_dict_str.get("ENGLISH")
                    or (next(iter(ot_dict_str.values())) if ot_dict_str else ("", None))
                )
                cand_text = ot_tuple[0] if isinstance(ot_tuple, (tuple, list)) else ot_tuple
                opt_trans_map = {
                    k: (v[0] if isinstance(v, (tuple, list)) else v)
                    for k, v in ot_dict_str.items()
                }
                opt_distractor = (
                    ot_tuple[1]
                    if (include_solutions and isinstance(ot_tuple, (tuple, list)) and len(ot_tuple) > 1 and ot_tuple[1])
                    else None
                )
                qr = qr_by_optid.get(opt.id) if include_solutions else None
                why_t = qr.why_tempting.strip() if (qr and qr.why_tempting) else None
                whats_t = qr.whats_actually_true.strip() if (qr and qr.whats_actually_true) else None
                if include_solutions and not opt_distractor and qr:
                    if why_t and whats_t:
                        opt_distractor = f"Why it seems tempting — {why_t} What's actually true — {whats_t}"
                    elif whats_t:
                        opt_distractor = whats_t
                    elif why_t:
                        opt_distractor = why_t

                opts_detail.append(
                    QuestionOptionDetail(
                        option_id=str(opt.id),
                        option_label=opt.option_label,
                        display_order=opt.display_order,
                        is_correct=opt.is_correct,
                        option_text=cand_text or "",
                        distractor_analysis=opt_distractor,
                        why_tempting=why_t,
                        whats_actually_true=whats_t,
                        closeness_score=opt.closeness_score,
                        translations=opt_trans_map,
                    )
                )

            # Explanation
            explanation_detail = None
            if include_solutions:
                expl_dict = expl_map.get(q.id, {})
                # The requested language, else English, else any
                expl_obj = (
                    expl_dict.get(target_lang)
                    or expl_dict.get(LanguageCode.ENGLISH)
                    or (next(iter(expl_dict.values())) if expl_dict else None)
                )
                if expl_obj:
                    expl_translations = {
                        (k.value if hasattr(k, "value") else str(k)): {
                            "core_concept": e.core_concept,
                            "detailed_solution": e.detailed_solution,
                            "reverse_logic": e.reverse_logic,
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
                        reverse_logic=expl_obj.reverse_logic,
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
                    assets=assets_by_qid.get(q.id, []),
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

    async def get_similar_questions(self, question_id: int, limit: int = 5) -> List[Dict[str, Any]]:
        """Calculate and return similar questions based on AI knowledge tags (Jaccard Similarity)."""
        from app.db.models.question import Question, QuestionTranslation
        from sqlmodel import select

        target_q = await self.session.get(Question, question_id)
        if not target_q or not target_q.knowledge_tags_ai:
            return []

        # Find candidates within the same subtopic (or subject) that have AI tags
        statement = select(Question).where(
            Question.id != question_id,
            Question.knowledge_tags_ai.is_not(None)
        )
        if target_q.subtopic_id:
            statement = statement.where(Question.subtopic_id == target_q.subtopic_id)
        elif target_q.subject_raw:
            statement = statement.where(Question.subject_raw == target_q.subject_raw)
            
        candidates = (await self.session.exec(statement)).all()
        
        def _norm(tags):
            return {str(t).strip().lower() for t in (tags.get("concepts", []) + tags.get("entities", [])) if t}

        target_tags = target_q.knowledge_tags_ai
        target_all = _norm(target_tags)
        if not target_all:
            return []

        # Original-cased labels, tagged by kind, for human-readable match reasons
        labels = {}
        for kind, key in (("Entity", "entities"), ("Concept", "concepts")):
            for t in target_tags.get(key, []) or []:
                if t:
                    labels.setdefault(str(t).strip().lower(), (kind, str(t).strip()))

        scored_candidates = []
        for c in candidates:
            c_tags = c.knowledge_tags_ai
            c_all = _norm(c_tags)
            if not c_all:
                continue
                
            intersection = len(target_all.intersection(c_all))
            union = len(target_all.union(c_all))
            if union > 0:
                score = round((intersection / union) * 100, 2)
                if score >= 20:  # weaker overlaps are noise; the router then falls back to the knowledge layer
                    shared = sorted(target_all.intersection(c_all))
                    scored_candidates.append({
                        "question": c,
                        "similarity_score": score,
                        "match_reasons": [
                            f"{labels.get(s, ('Tag', s))[0]}: {labels.get(s, ('Tag', s))[1]}" for s in shared[:2]
                        ],
                    })

        scored_candidates.sort(key=lambda x: x["similarity_score"], reverse=True)
        top_matches = scored_candidates[:limit]
        
        results = []
        for match in top_matches:
            q = match["question"]
            # We need to return the question data in a way the frontend recommendationCardToQuestion can parse
            q_data = q.dict()
            q_data["question_id"] = q.id
            q_data["subject_name"] = q.subject_raw
            q_data["topic_name"] = q.topic_raw
            q_data["subtopic_name"] = q.subtopic_raw
            
            q_trans = (await self.session.exec(
                select(QuestionTranslation).where(QuestionTranslation.question_id == q.id)
            )).first()
            if q_trans:
                q_data["question_text"] = q_trans.question_text
            
            # Basic options for the UI
            from app.db.models.question import QuestionOption
            options = (await self.session.exec(
                select(QuestionOption).where(QuestionOption.question_id == q.id)
            )).all()
            q_data["options"] = [{"option_id": o.id, "option_label": o.option_label} for o in options]
            
            results.append({
                "question_id": q.id,
                "tier": "related", 
                "similarity_score": match["similarity_score"],
                "match_reasons": match["match_reasons"],
                "question": q_data
            })

        return results