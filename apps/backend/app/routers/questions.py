import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import PlainTextResponse, JSONResponse
from sqlmodel.ext.asyncio.session import AsyncSession

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
    subject_id: Optional[uuid.UUID] = Query(default=None, description="Filter by Subject ID"),
    subject_name: Optional[str] = Query(default=None, description="Filter by Subject Name (substring match)"),
    subject_code: Optional[str] = Query(default=None, description="Filter by Subject Code"),
    topic_id: Optional[uuid.UUID] = Query(default=None, description="Filter by Topic ID"),
    topic_name: Optional[str] = Query(default=None, description="Filter by Topic Name (substring match)"),
    topic_code: Optional[str] = Query(default=None, description="Filter by Topic Code"),
    subtopic_id: Optional[uuid.UUID] = Query(default=None, description="Filter by Subtopic ID"),
    subtopic_name: Optional[str] = Query(default=None, description="Filter by Subtopic Name (substring match)"),
    subtopic_code: Optional[str] = Query(default=None, description="Filter by Subtopic Code"),
    exam_id: Optional[uuid.UUID] = Query(default=None, description="Filter by Exam ID"),
    exam_name: Optional[str] = Query(default=None, description="Filter by Exam Name e.g. upsc (substring match)"),
    exam_type: Optional[QuestionSourceType] = Query(default=None, description="Filter by Exam Type e.g. PYQ or STATIC_MOCK"),
    exam_year: Optional[int] = Query(default=None, description="Filter by Exam Year e.g. 2023"),
    paper_set_code: Optional[str] = Query(default=None, description="Filter by Paper Set Code e.g. SET_A"),
    stage: Optional[str] = Query(default=None, description="Filter by Stage e.g. prelims"),
    status: Optional[QuestionStatus] = Query(default=None, description="Filter by Status e.g. PENDING_HUMAN_REVIEW or PUBLISHED"),
    language: LanguageCode = Query(default=LanguageCode.ENGLISH, description="Target Language for response text"),
    include_solutions: bool = Query(default=False, description="Whether to include full solution explanations and option distractor analyses"),
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
        topic_id=str(topic_id) if topic_id else None,
        subtopic_id=str(subtopic_id) if subtopic_id else None,
        exam_id=str(exam_id) if exam_id else None,
        exam_type=str(exam_type.value if hasattr(exam_type, "value") else exam_type) if exam_type else None,
        year=exam_year,
        set=paper_set_code,
        stage=stage,
        status=str(status.value if hasattr(status, "value") else status) if status else None,
        lang=str(language.value if hasattr(language, "value") else language),
        sols=include_solutions,
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
        page=page,
        limit=limit,
    )
    if res is not None:
        serialized = res.model_dump(mode="json") if hasattr(res, "model_dump") else (res.dict() if hasattr(res, "dict") else res)
        await cache.set(cache_key, serialized, ttl_seconds=1800)
        return JSONResponse(content=serialized)
    return JSONResponse(content={})



@router.get("/taxonomy", summary="Get Dynamic Syllabus Taxonomy (Topics & Subtopics) from Database")
async def get_syllabus_taxonomy(session: AsyncSession = Depends(get_async_session)):
    """
    Fetches all available Topics and Subtopics dynamically from the Database hierarchy.
    Uses 2 batch queries for maximum efficiency.
    """
    from app.cache import get_cache, build_cache_key
    cache = get_cache()
    cache_key = build_cache_key("questions:taxonomy")
    cached_data = await cache.get(cache_key)
    if cached_data is not None:
        return JSONResponse(content=cached_data)

    from app.db.models import Topic, Subtopic
    from app.schemas.syllabus_literals import SYLLABUS_HIERARCHY
    from sqlmodel import select

    hierarchy_map = {}
    unique_topics = set()

    try:
        # Query 1: Fetch all topics in one query
        stmt_topics = select(Topic)
        res_topics = await session.exec(stmt_topics)
        db_topics = res_topics.all()

        topic_id_map = {}
        for top in db_topics:
            t_name = top.name.strip() if top.name else ""
            if t_name:
                topic_id_map[top.id] = t_name
                unique_topics.add(t_name)
                if t_name not in hierarchy_map:
                    hierarchy_map[t_name] = set()

        if topic_id_map:
            # Query 2: Fetch all subtopics with their topic_id
            stmt_subs = select(Subtopic)
            res_subs = await session.exec(stmt_subs)
            db_subs = res_subs.all()

            for sub in db_subs:
                t_name = topic_id_map.get(sub.topic_id)
                if t_name and sub.name:
                    sub_name = sub.name.strip()
                    if sub_name:
                        hierarchy_map[t_name].add(sub_name)

            # Format output dictionary with sorted lists
            if hierarchy_map:
                formatted_hierarchy = {}
                for t_name, sub_set in hierarchy_map.items():
                    formatted_hierarchy[t_name] = ["All Subtopics"] + sorted(list(sub_set))

                hierarchy_map = formatted_hierarchy

    except Exception as exc:
        pass

    if not hierarchy_map:
        for subj, topics_dict in SYLLABUS_HIERARCHY.items():
            for top_name, sub_list in topics_dict.items():
                unique_topics.add(top_name)
                hierarchy_map[top_name] = ["All Subtopics"] + list(sub_list)

    sorted_topics = sorted(list(unique_topics))

    result = {
        "topics": ["All Topics"] + sorted_topics,
        "hierarchy": hierarchy_map,
    }
    await cache.set(cache_key, result, ttl_seconds=7200)
    return JSONResponse(content=result)


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
    question_id: uuid.UUID,
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
    question_id: uuid.UUID,
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
    question_id: uuid.UUID,
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
    question_id: uuid.UUID,
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
    question_id: uuid.UUID, session: AsyncSession = Depends(get_async_session)
):
    service = QuestionService(session)
    return await service.get_question_yaml_file(question_id)


@router.get("/{question_id}/formatted/markdown", response_class=PlainTextResponse, summary="Export Question to Markdown")
async def get_question_markdown_file(
    question_id: uuid.UUID, session: AsyncSession = Depends(get_async_session)
):
    service = QuestionService(session)
    return await service.get_question_markdown_file(question_id)
