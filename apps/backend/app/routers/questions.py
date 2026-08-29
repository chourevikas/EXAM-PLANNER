import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import PlainTextResponse, JSONResponse
from fastapi.encoders import jsonable_encoder
from sqlmodel.ext.asyncio.session import AsyncSession
from fastapi import HTTPException
from app.db.session import get_async_session
from app.db.models import QuestionStatus, QuestionSourceType, LanguageCode
from app.schemas.question import (
    QuestionUpdatePayload,
    QuestionCreatePayload,
    QuestionDetailResponse,
    QuestionPaginatedResponse,
)
from app.services.question_service import QuestionService


router = APIRouter(prefix="/questions", tags=["Questions & Formatted Outputs"])


@router.get("", response_model=QuestionPaginatedResponse, summary="Get Questions with Multi-Filtering & Pagination")
async def list_questions(
    subject_id: Optional[int] = Query(default=None, description="Filter by Subject ID"),
    subject_name: Optional[str] = Query(default=None, description="Filter by Subject Name (substring match)"),
    subject_code: Optional[str] = Query(default=None, description="Filter by Subject Code"),
    topic_id: Optional[int] = Query(default=None, description="Filter by Topic ID"),
    topic_name: Optional[str] = Query(default=None, description="Filter by Topic Name (substring match)"),
    topic_code: Optional[str] = Query(default=None, description="Filter by Topic Code"),
    subtopic_id: Optional[int] = Query(default=None, description="Filter by Subtopic ID"),
    subtopic_name: Optional[str] = Query(default=None, description="Filter by Subtopic Name (substring match)"),
    subtopic_code: Optional[str] = Query(default=None, description="Filter by Subtopic Code"),
    exam_id: Optional[int] = Query(default=None, description="Filter by Exam ID"),
    exam_name: Optional[str] = Query(default=None, description="Filter by Exam Name e.g. upsc (substring match)"),
    exam_type: Optional[QuestionSourceType] = Query(default=None, description="Filter by Exam Type e.g. PYQ or STATIC_MOCK"),
    exam_year: Optional[int] = Query(default=None, description="Filter by Exam Year e.g. 2023"),
    paper_set_code: Optional[str] = Query(default=None, description="Filter by Paper Set Code e.g. SET_A"),
    stage: Optional[str] = Query(default=None, description="Filter by Stage e.g. prelims"),
    status: Optional[QuestionStatus] = Query(default=None, description="Filter by Status e.g. PENDING_HUMAN_REVIEW or PUBLISHED"),
    language: LanguageCode = Query(default=LanguageCode.ENGLISH, description="Target Language for response text"),
    include_solutions: bool = Query(default=False, description="Whether to include full solution explanations and option distractor analyses"),
    exclude_ids: Optional[str] = Query(default=None, description="Comma-separated Question IDs to exclude from results"),
    page: int = Query(default=1, ge=1, description="Page number"),
    limit: int = Query(default=20, ge=1, le=100, description="Items per page"),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Requirement 3: Endpoint to get all questions with multi-filtering based on subjects, topics, subtopics,
    exam type, exam year, exam set, stage, and exam name (case-insensitive substring match e.g. 'upsc'),
    with pagination ordered by question number in paper.
    By default, solution explanations are omitted (include_solutions=False) to protect test-taking integrity.
    """
    from app.cache import get_cache, build_cache_key
    cache = get_cache()
    cache_key = build_cache_key(
        "questions:list",
        subject_id=str(subject_id) if subject_id else None,
        subject_name=subject_name.strip() if subject_name else None,
        subject_code=subject_code.strip() if subject_code else None,
        topic_id=str(topic_id) if topic_id else None,
        topic_name=topic_name.strip() if topic_name else None,
        topic_code=topic_code.strip() if topic_code else None,
        subtopic_id=str(subtopic_id) if subtopic_id else None,
        subtopic_name=subtopic_name.strip() if subtopic_name else None,
        subtopic_code=subtopic_code.strip() if subtopic_code else None,
        exam_id=str(exam_id) if exam_id else None,
        exam_name=exam_name.strip() if exam_name else None,
        exam_type=str(exam_type.value if hasattr(exam_type, "value") else exam_type) if exam_type else None,
        year=exam_year,
        set=paper_set_code,
        stage=stage,
        status=str(status.value if hasattr(status, "value") else status) if status else None,
        lang=str(language.value if hasattr(language, "value") else language),
        sols=include_solutions,
        exclude=exclude_ids.strip() if exclude_ids else None,
        page=page,
        limit=limit,
    )
    cached_data = await cache.get(cache_key)
    if cached_data is not None:
        return JSONResponse(content=cached_data)

    service = QuestionService(session)
    res = await service.list_questions_paginated(
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
        language=language,
        include_solutions=include_solutions,
        exclude_ids=exclude_ids,
        page=page,
        limit=limit,
    )
    if res is not None:
        serialized = res.model_dump(mode="json") if hasattr(res, "model_dump") else (res.dict() if hasattr(res, "dict") else res)
        await cache.set(cache_key, serialized, ttl_seconds=1800)
        return JSONResponse(content=serialized)
    return JSONResponse(content={})



@router.get("/taxonomy", summary="Get Dynamic Syllabus Taxonomy (Subjects, Topics & Subtopics) from Database")
async def get_syllabus_taxonomy(
    subject_name: Optional[str] = Query(default=None, description="Filter by Subject Name"),
    topic_name: Optional[str] = Query(default=None, description="Filter by Topic Name"),
    session: AsyncSession = Depends(get_async_session)
):
    """
    Fetches all available Subjects, Topics, and Subtopics dynamically from the Database hierarchy
    and fallback master SYLLABUS_HIERARCHY with full 3-level tree support and caching.
    """
    from app.cache import get_cache, build_cache_key
    cache = get_cache()
    cache_key = build_cache_key("questions:taxonomy", subject_name or "", topic_name or "")
    cached_data = await cache.get(cache_key)
    if cached_data is not None:
        return JSONResponse(content=jsonable_encoder(cached_data))

    from app.db.models import Subject, Topic, Subtopic
    from app.schemas.syllabus_literals import SYLLABUS_HIERARCHY
    from sqlmodel import select

    three_level_hierarchy: dict[str, dict[str, list[str]]] = {}
    flat_hierarchy: dict[str, list[str]] = {}
    all_subjects_set = set()
    all_topics_set = set()
    all_subtopics_set = set()

    try:
        # 1. Fetch Subjects
        stmt_subj = select(Subject)
        if subject_name and subject_name != "All Subjects":
            stmt_subj = stmt_subj.where(Subject.name.ilike(f"%{subject_name.strip()}%"))
        res_subj = await session.exec(stmt_subj)
        db_subjects = res_subj.all()
        subj_map = {s.id: s.name.strip() for s in db_subjects if s.name}

        # 2. Fetch Topics
        stmt_topics = select(Topic)
        if db_subjects:
            stmt_topics = stmt_topics.where(Topic.subject_id.in_([s.id for s in db_subjects]))
        if topic_name and topic_name != "All Topics":
            stmt_topics = stmt_topics.where(Topic.name.ilike(f"%{topic_name.strip()}%"))
        res_topics = await session.exec(stmt_topics)
        db_topics = res_topics.all()
        topic_map = {t.id: (subj_map.get(t.subject_id, "General Studies"), t.name.strip()) for t in db_topics if t.name}

        # 3. Fetch Subtopics
        if db_topics:
            stmt_subs = select(Subtopic).where(Subtopic.topic_id.in_([t.id for t in db_topics]))
            res_subs = await session.exec(stmt_subs)
            db_subs = res_subs.all()
            for sub in db_subs:
                if sub.topic_id in topic_map and sub.name:
                    s_name, t_name = topic_map[sub.topic_id]
                    st_name = sub.name.strip()
                    if st_name:
                        all_subjects_set.add(s_name)
                        all_topics_set.add(t_name)
                        all_subtopics_set.add(st_name)

                        if s_name not in three_level_hierarchy:
                            three_level_hierarchy[s_name] = {}
                        if t_name not in three_level_hierarchy[s_name]:
                            three_level_hierarchy[s_name][t_name] = []
                        if st_name not in three_level_hierarchy[s_name][t_name]:
                            three_level_hierarchy[s_name][t_name].append(st_name)

                        if t_name not in flat_hierarchy:
                            flat_hierarchy[t_name] = []
                        if st_name not in flat_hierarchy[t_name]:
                            flat_hierarchy[t_name].append(st_name)

    except Exception as exc:
        pass

    # Fallback to master SYLLABUS_HIERARCHY if database returned empty
    if not three_level_hierarchy:
        for s_name, t_dict in SYLLABUS_HIERARCHY.items():
            if subject_name and subject_name != "All Subjects" and subject_name.lower() not in s_name.lower():
                continue
            all_subjects_set.add(s_name)
            if s_name not in three_level_hierarchy:
                three_level_hierarchy[s_name] = {}
            for t_name, st_list in t_dict.items():
                if topic_name and topic_name != "All Topics" and topic_name.lower() not in t_name.lower():
                    continue
                all_topics_set.add(t_name)
                three_level_hierarchy[s_name][t_name] = list(st_list)
                flat_hierarchy[t_name] = list(st_list)
                for st in st_list:
                    all_subtopics_set.add(st)

    # Format sorted lists with "All ..." options
    for s_name, t_map in three_level_hierarchy.items():
        for t_name, st_arr in t_map.items():
            three_level_hierarchy[s_name][t_name] = ["All Subtopics"] + sorted(st_arr)

    for t_name, st_arr in flat_hierarchy.items():
        flat_hierarchy[t_name] = ["All Subtopics"] + sorted(st_arr)

    sorted_subjects = sorted(list(all_subjects_set))
    sorted_topics = sorted(list(all_topics_set))
    sorted_subtopics = sorted(list(all_subtopics_set))

    result = {
        "subjects": ["All Subjects"] + sorted_subjects,
        "topics": ["All Topics"] + sorted_topics,
        "subtopics": ["All Subtopics"] + sorted_subtopics,
        "hierarchy": three_level_hierarchy,
        "flat_hierarchy": flat_hierarchy,
    }
    await cache.set(cache_key, result, ttl_seconds=7200)
    return JSONResponse(content=jsonable_encoder(result))


@router.post("", response_model=QuestionDetailResponse, status_code=status.HTTP_201_CREATED, summary="Create New or Missing Question & Publish")
async def create_question(
    payload: QuestionCreatePayload,
    session: AsyncSession = Depends(get_async_session),
):
    """
    Creates a new question (or fills in a missing question) for an exam paper.
    Automatically sets Question status to PUBLISHED and updates Exam missing question metrics.
    """
    from app.cache import invalidate_question_cache, invalidate_exam_cache
    service = QuestionService(session)
    res = await service.create_question(payload=payload)
    if res and res.id:
        await invalidate_question_cache(str(res.id), str(payload.exam_id) if payload.exam_id else None)
    if payload.exam_id:
        await invalidate_exam_cache(str(payload.exam_id))
    return res


@router.get("/{question_id}", response_model=QuestionDetailResponse, summary="Get Question Detail by ID")
async def get_question(
    question_id: int,
    language: LanguageCode = Query(default=LanguageCode.ENGLISH, description="Target Language"),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Requirement 8: Takes question ID and language, returning complete information across all tables
    (question text, passage text, options, paper set, difficulty, marks, explanation, metadata, hierarchy links).
    """
    from app.cache import get_cache, build_cache_key
    cache = get_cache()
    cache_key = build_cache_key(
        "questions:detail",
        str(question_id),
        lang=str(language.value if hasattr(language, "value") else language),
    )
    cached_data = await cache.get(cache_key)
    if cached_data is not None:
        return JSONResponse(content=cached_data)

    service = QuestionService(session)
    detail = await service.get_question_detail(question_id=question_id, language=language)
    if detail is not None:
        serialized = detail.model_dump(mode="json") if hasattr(detail, "model_dump") else (detail.dict() if hasattr(detail, "dict") else detail)
        await cache.set(cache_key, serialized, ttl_seconds=3600)
        return JSONResponse(content=serialized)
    return JSONResponse(content={})


@router.put("/{question_id}", response_model=QuestionDetailResponse, summary="Update Question & Publish")
async def update_question(
    question_id: int,
    payload: QuestionUpdatePayload,
    session: AsyncSession = Depends(get_async_session),
):
    """
    Requirement 8: Updates question text, options, translations, passage, explanation, metadata in DB
    and automatically sets Question status to PUBLISHED upon saving.
    """
    from app.cache import invalidate_question_cache
    service = QuestionService(session)
    res = await service.update_question_detail(question_id=question_id, payload=payload)
    await invalidate_question_cache(str(question_id))
    return res


@router.patch("/{question_id}", response_model=QuestionDetailResponse, summary="Partial Update Question & Publish")
async def patch_question(
    question_id: int,
    payload: QuestionUpdatePayload,
    session: AsyncSession = Depends(get_async_session),
):
    """
    Partially updates question text, options, translations, explanation, or metadata in DB
    and automatically sets Question status to PUBLISHED upon saving.
    """
    from app.cache import invalidate_question_cache
    service = QuestionService(session)
    res = await service.update_question_detail(question_id=question_id, payload=payload)
    await invalidate_question_cache(str(question_id))
    return res


@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete Question")
async def delete_question(
    question_id: int,
    session: AsyncSession = Depends(get_async_session),
):
    """Deletes a question entity by ID."""
    from app.cache import invalidate_question_cache
    service = QuestionService(session)
    await service.delete_question(question_id=question_id)
    await invalidate_question_cache(str(question_id))
    return None


@router.get("/{question_id}/formatted/yaml", response_class=PlainTextResponse, summary="Export Question to YAML")
async def get_question_yaml_file(
    question_id: int, session: AsyncSession = Depends(get_async_session)
):
    service = QuestionService(session)
    return await service.get_question_yaml_file(question_id)


@router.get("/{question_id}/formatted/markdown", response_class=PlainTextResponse, summary="Export Question to Markdown")
async def get_question_markdown_file(
    question_id: int, session: AsyncSession = Depends(get_async_session)
):
    service = QuestionService(session)
    return await service.get_question_markdown_file(question_id)


@router.get("/{question_id}/solution", summary="Get Full Solution & Distractor Analysis for a Question")
async def get_question_solution(
    question_id: int,
    language: LanguageCode = LanguageCode.ENGLISH,
    session: AsyncSession = Depends(get_async_session),
):
    """
    Fetches full solution metadata, markdown explanation, option distractor analyses,
    core concepts, key takeaways, and common traps from S3 JSON artifact or optimized batch DB query.
    """
    from app.cache import get_cache, build_cache_key
    from app.db.models import Exam, Question, QuestionOption, OptionTranslation, QuestionExplanation, QuestionMetadata
    from app.engine.matrices.closeness_evaluator import ClosenessEvaluator
    from app.storage.factory import get_storage_provider
    from sqlmodel import select, col

    cache = get_cache()
    lang_str = language.value if hasattr(language, "value") else str(language)
    cache_key = build_cache_key("questions:solution", str(question_id), lang_str)
    cached_data = await cache.get(cache_key)
    if cached_data is not None:
        return JSONResponse(content=jsonable_encoder(cached_data))

    q = await session.get(Question, question_id)
    if not q:
        raise HTTPException(status_code=404, detail=f"Question with ID '{question_id}' not found.")

    # 1. Primary Strategy: Check S3 Solution JSON Artifact
    if q.exam_id:
        exam = await session.get(Exam, q.exam_id)
        if exam:
            storage = get_storage_provider()
            paper_set = exam.paper_set_code or "SET_A"
            clean_set = str(paper_set).strip().lower().replace("_", "-")
            s_folder = exam.solutions_json_folder_path or f"artifacts/{exam.code}/{clean_set}/json/solutions"
            q_filename = f"Q{q.question_number_in_paper:03d}.json"
            rel_path = f"{s_folder.rstrip('/')}/{q_filename}"
            try:
                if await storage.exists(rel_path):
                    presigned_url = await storage.generate_presigned_url(rel_path)
                    s3_data = await storage.download_json(rel_path)
                    s3_data["presigned_url"] = presigned_url
                    s3_data["source"] = "S3_ARTIFACT"
                    await cache.set(cache_key, s3_data, ttl_seconds=7200)
                    return JSONResponse(content=jsonable_encoder(s3_data))
            except Exception:
                pass

    # 2. Optimized Batch Database Fetch
    stmt_opts = select(QuestionOption).where(QuestionOption.question_id == q.id).order_by(col(QuestionOption.display_order).asc())
    options = (await session.exec(stmt_opts)).all()
    opt_ids = [o.id for o in options]

    opt_trans_map = {}
    if opt_ids:
        stmt_trans = select(OptionTranslation).where(OptionTranslation.option_id.in_(opt_ids))
        for t in (await session.exec(stmt_trans)).all():
            t_lang = t.language.value if hasattr(t.language, "value") else str(t.language)
            if t.option_id not in opt_trans_map or t_lang == lang_str:
                opt_trans_map[t.option_id] = t

    correct_option_id = None
    correct_option_label = "A"
    distractor_scores = {}

    for opt in options:
        trans = opt_trans_map.get(opt.id)
        analysis_text = trans.distractor_analysis if trans else None
        if opt.is_correct:
            correct_option_id = str(opt.id)
            correct_option_label = opt.option_label

        distractor_scores[str(opt.id)] = {
            "option_id": str(opt.id),
            "label": opt.option_label,
            "text": trans.option_text if trans else f"Option {opt.option_label}",
            "closeness_score": opt.closeness_score,
            "is_correct": opt.is_correct,
            "classification": ClosenessEvaluator.classify_option(opt.closeness_score),
            "distractor_analysis": analysis_text,
        }

    # Fetch explanation & metadata in single queries
    target_expl = (await session.exec(select(QuestionExplanation).where(QuestionExplanation.question_id == q.id))).first()
    q_meta = (await session.exec(select(QuestionMetadata).where(QuestionMetadata.question_id == q.id))).first()

    blooms_level = (q_meta.blooms_level.value if hasattr(q_meta.blooms_level, "value") else str(q_meta.blooms_level)) if (q_meta and q_meta.blooms_level) else "ANALYZE"
    cognitive_skill = q_meta.cognitive_skill if (q_meta and q_meta.cognitive_skill) else "Conceptual Reasoning"
    primary_concept_tag = q_meta.primary_concept_tag if (q_meta and q_meta.primary_concept_tag) else None

    detailed_solution = (target_expl.detailed_solution if (target_expl and target_expl.detailed_solution) else (
        f"**Option ({correct_option_label}) is correct.**\n\nThis question evaluates core conceptual mastery under standard syllabus guidelines."
    ))

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
            "a": q_meta.irt_discrimination_a if q_meta and q_meta.irt_discrimination_a is not None else 1.50,
            "b": q_meta.irt_difficulty_b if q_meta and q_meta.irt_difficulty_b is not None else 0.00,
            "c": q_meta.irt_pseudo_guessing_c if q_meta and q_meta.irt_pseudo_guessing_c is not None else 0.25,
        },
        "subject": "General Studies",
        "topic": "Syllabus Topic",
        "subtopic": "Micro Topic",
        "explanation": {
            "core_concept": target_expl.core_concept if target_expl and target_expl.core_concept else "Core conceptual foundation",
            "detailed_solution": detailed_solution,
            "common_traps": target_expl.common_traps_json if (target_expl and target_expl.common_traps_json) else [],
            "key_takeaways": target_expl.key_takeaways_json if (target_expl and target_expl.key_takeaways_json) else [],
        },
        "distractor_scores": distractor_scores,
        "source": "DATABASE_FAST_BATCH",
    }

    await cache.set(cache_key, sol_card, ttl_seconds=3600)
    return JSONResponse(content=jsonable_encoder(sol_card))
