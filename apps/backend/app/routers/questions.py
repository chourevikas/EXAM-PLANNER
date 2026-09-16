from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import PlainTextResponse, JSONResponse
from fastapi.encoders import jsonable_encoder
from sqlmodel.ext.asyncio.session import AsyncSession
from fastapi import HTTPException
from app.db.session import get_async_session
from app.db.models import QuestionStatus, QuestionSourceType, DifficultyLevel
from app.db.models.user import User, UserRole
from app.core.languages import parse_language
from app.core.deps import require_roles
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
    exam_year: Optional[str] = Query(default=None, description="Filter by Exam Year e.g. 2023 or comma-separated e.g. 2023,2024"),
    paper_set_code: Optional[str] = Query(default=None, description="Filter by Paper Set Code e.g. SET_A"),
    stage: Optional[str] = Query(default=None, description="Filter by Stage e.g. prelims"),
    status: Optional[QuestionStatus] = Query(default=None, description="Filter by Status e.g. PENDING_HUMAN_REVIEW or PUBLISHED"),
    language: str = Query(default="en", description="Target Language for response text (ISO code 'en', 'hi' or Enum name 'ENGLISH')"),
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
    lang_code = parse_language(language)
    from app.cache import get_cache, build_cache_key
    cache = get_cache()
    should_cache = not bool(exclude_ids)
    cache_key = None
    if should_cache:
        cache_key = build_cache_key(
            "questions:list",
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
            exam_type=str(exam_type.value if hasattr(exam_type, "value") else exam_type) if exam_type else None,
            exam_year=exam_year,
            paper_set_code=paper_set_code,
            stage=stage,
            status=str(status.value if hasattr(status, "value") else status) if status else None,
            language=lang_code.value,
            include_solutions=include_solutions,
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
        language=lang_code,
        include_solutions=include_solutions,
        exclude_ids=exclude_ids,
        page=page,
        limit=limit,
    )
    if res is not None:
        serialized = res.model_dump(mode="json") if hasattr(res, "model_dump") else (res.dict() if hasattr(res, "dict") else res)
        if should_cache and cache_key:
            await cache.set(cache_key, serialized, ttl_seconds=600)
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
        stmt = (
            select(Subject.name, Topic.name, Subtopic.name)
            .outerjoin(Topic, Topic.subject_id == Subject.id)
            .outerjoin(Subtopic, Subtopic.topic_id == Topic.id)
        )
        if subject_name and subject_name != "All Subjects":
            stmt = stmt.where(Subject.name.ilike(f"%{subject_name.strip()}%"))
        if topic_name and topic_name != "All Topics":
            stmt = stmt.where(Topic.name.ilike(f"%{topic_name.strip()}%"))

        res = await session.exec(stmt)
        rows = res.all()
        for s_raw, t_raw, st_raw in rows:
            if not s_raw:
                continue
            s_name = s_raw.strip()
            all_subjects_set.add(s_name)
            if s_name not in three_level_hierarchy:
                three_level_hierarchy[s_name] = {}

            if t_raw:
                t_name = t_raw.strip()
                all_topics_set.add(t_name)
                if t_name not in three_level_hierarchy[s_name]:
                    three_level_hierarchy[s_name][t_name] = []
                if t_name not in flat_hierarchy:
                    flat_hierarchy[t_name] = []

                if st_raw:
                    st_name = st_raw.strip()
                    all_subtopics_set.add(st_name)
                    if st_name not in three_level_hierarchy[s_name][t_name]:
                        three_level_hierarchy[s_name][t_name].append(st_name)
                    if st_name not in flat_hierarchy[t_name]:
                        flat_hierarchy[t_name].append(st_name)

    except Exception:
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


@router.get("/recommended", summary="Lightweight Recommended Questions (no passages/metadata/hierarchy-detail/solutions)")
async def list_recommended_questions(
    subject_name: Optional[str] = Query(default=None, description="Filter by Subject Name (substring match)"),
    topic_name: Optional[str] = Query(default=None, description="Filter by Topic Name (substring match)"),
    subtopic_name: Optional[str] = Query(default=None, description="Filter by Subtopic Name (substring match)"),
    exam_name: Optional[str] = Query(default=None, description="Filter by Exam Name e.g. upsc (substring match)"),
    difficulty: Optional[str] = Query(default=None, description="Filter by Difficulty e.g. EASY, MEDIUM, HARD"),
    exclude_ids: Optional[str] = Query(default=None, description="Comma-separated Question IDs to exclude from results"),
    language: str = Query(default="en", description="Target Language for response text"),
    limit: int = Query(default=15, ge=1, le=50, description="Max recommended questions to return"),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Minimal per-question payload (text + options + subject/topic/subtopic
    names) for "recommended questions" sidebars/cards. Unlike the general
    listing endpoint above, this skips passages, metadata, multi-concept
    hierarchy detail, and explanations entirely — a recommendation card
    doesn't render any of that, and solutions are still fetched lazily via
    GET /questions/{question_id}/solution only when a recommendation is
    actually revealed.
    """
    if difficulty and difficulty.strip() and difficulty.strip().lower() not in ("all", "all levels", "all difficulties"):
        diff_upper = difficulty.strip().upper()
        if diff_upper not in DifficultyLevel.__members__:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid difficulty: '{difficulty}'. Allowed values: {[d.value for d in DifficultyLevel]}",
            )

    lang_code = parse_language(language)
    from app.cache import get_cache, build_cache_key
    cache = get_cache()
    cache_key = None
    if not exclude_ids:
        cache_key = build_cache_key(
            "questions:recommended",
            s=subject_name,
            t=topic_name,
            st=subtopic_name,
            e=exam_name,
            d=difficulty,
            l=lang_code.value,
            lim=limit,
        )
        cached = await cache.get(cache_key)
        if cached is not None:
            return JSONResponse(content=cached)

    service = QuestionService(session)
    res = await service.list_recommended_questions(
        subject_name=subject_name,
        topic_name=topic_name,
        subtopic_name=subtopic_name,
        exam_name=exam_name,
        difficulty=difficulty,
        exclude_ids=exclude_ids,
        language=lang_code,
        limit=limit,
    )
    if cache_key and res:
        await cache.set(cache_key, res, ttl_seconds=300)
    return JSONResponse(content=res)


@router.get("/{question_id}", response_model=QuestionDetailResponse, summary="Get Question Detail by ID")
async def get_question(
    question_id: int | str,
    language: str = Query(default="en", description="Target Language"),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Requirement 8: Takes question ID and language, returning complete information across all tables
    (question text, passage text, options, paper set, difficulty, marks, explanation, metadata, hierarchy links).
    """
    try:
        qid_int = int(question_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail=f"Question with ID '{question_id}' not found.")

    lang_code = parse_language(language)
    from app.cache import get_cache, build_cache_key
    cache = get_cache()
    cache_key = build_cache_key(
        "questions:detail",
        str(qid_int),
        lang=lang_code.value,
    )
    cached_data = await cache.get(cache_key)
    if cached_data is not None:
        return JSONResponse(content=cached_data)

    service = QuestionService(session)
    detail = await service.get_question_detail(question_id=qid_int, language=lang_code)
    if detail is not None:
        serialized = detail.model_dump(mode="json") if hasattr(detail, "model_dump") else (detail.dict() if hasattr(detail, "dict") else detail)
        await cache.set(cache_key, serialized, ttl_seconds=3600)
        return JSONResponse(content=serialized)
    return JSONResponse(content={})


@router.put("/{question_id}", response_model=QuestionDetailResponse, summary="Update Question & Publish")
async def update_question(
    question_id: int | str,
    payload: QuestionUpdatePayload,
    session: AsyncSession = Depends(get_async_session),
):
    """
    Requirement 8: Updates question text, options, translations, passage, explanation, metadata in DB
    and automatically sets Question status to PUBLISHED upon saving.
    """
    try:
        qid_int = int(question_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail=f"Question with ID '{question_id}' not found.")

    from app.cache import invalidate_question_cache
    service = QuestionService(session)
    res = await service.update_question_detail(question_id=qid_int, payload=payload)
    await invalidate_question_cache(str(qid_int))
    return res


@router.patch("/{question_id}", response_model=QuestionDetailResponse, summary="Partial Update Question & Publish")
async def patch_question(
    question_id: int | str,
    payload: QuestionUpdatePayload,
    session: AsyncSession = Depends(get_async_session),
):
    """
    Partially updates question text, options, translations, explanation, or metadata in DB
    and automatically sets Question status to PUBLISHED upon saving.
    """
    try:
        qid_int = int(question_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail=f"Question with ID '{question_id}' not found.")

    from app.cache import invalidate_question_cache
    service = QuestionService(session)
    res = await service.update_question_detail(question_id=qid_int, payload=payload)
    await invalidate_question_cache(str(qid_int))
    return res


@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete Question")
async def delete_question(
    question_id: int | str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    """Deletes a question entity by ID. Admin/Super Admin only — permanently removes the question."""
    try:
        qid_int = int(question_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail=f"Question with ID '{question_id}' not found.")

    from app.cache import invalidate_question_cache
    service = QuestionService(session)
    await service.delete_question(question_id=qid_int)
    await invalidate_question_cache(str(qid_int))
    return None


@router.get("/{question_id}/formatted/yaml", response_class=PlainTextResponse, summary="Export Question to YAML")
async def get_question_yaml_file(
    question_id: int | str, session: AsyncSession = Depends(get_async_session)
):
    try:
        qid_int = int(question_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail=f"Question with ID '{question_id}' not found.")
    service = QuestionService(session)
    return await service.get_question_yaml_file(qid_int)


@router.get("/{question_id}/formatted/markdown", response_class=PlainTextResponse, summary="Export Question to Markdown")
async def get_question_markdown_file(
    question_id: int | str, session: AsyncSession = Depends(get_async_session)
):
    try:
        qid_int = int(question_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail=f"Question with ID '{question_id}' not found.")
    service = QuestionService(session)
    return await service.get_question_markdown_file(qid_int)


@router.get("/{question_id}/solution", summary="Get Full Solution & Distractor Analysis for a Question")
async def get_question_solution(
    question_id: int | str,
    language: str = Query(default="en", description="Target Language"),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Optimized single-query fetch for question solution and distractor analyses
    using exact database parameters available for Exam 10.
    """
    try:
        qid_int = int(question_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail=f"Question with ID '{question_id}' not found.")

    lang_code = parse_language(language)
    from app.cache import get_cache, build_cache_key
    from app.db.models import Question, QuestionOption, OptionTranslation, QuestionExplanation, QuestionOptionReasoning
    from app.engine.matrices.closeness_evaluator import ClosenessEvaluator
    from sqlalchemy import select
    from sqlmodel import col

    cache = get_cache()
    lang_str = lang_code.value
    cache_key = build_cache_key("questions:solution", str(qid_int), lang_str)
    cached_data = await cache.get(cache_key)
    if cached_data is not None:
        return JSONResponse(content=jsonable_encoder(cached_data))

    # Single optimized SQL join query: fetches Question, Explanation, Options, Translations, and Distractor Reasonings
    stmt = (
        select(Question, QuestionExplanation, QuestionOption, OptionTranslation, QuestionOptionReasoning)
        .outerjoin(QuestionExplanation, col(QuestionExplanation.question_id) == col(Question.id))
        .join(QuestionOption, col(QuestionOption.question_id) == col(Question.id))
        .outerjoin(OptionTranslation, col(OptionTranslation.option_id) == col(QuestionOption.id))
        .outerjoin(QuestionOptionReasoning, col(QuestionOptionReasoning.question_option_id) == col(QuestionOption.id))
        .where(col(Question.id) == qid_int, col(Question.status) != QuestionStatus.REJECTED)
        .order_by(col(QuestionOption.display_order).asc())
    )
    rows = (await session.exec(stmt)).all()

    if not rows:
        # Fallback if question exists without options
        q = await session.get(Question, qid_int)
        if not q or q.status == QuestionStatus.REJECTED:
            raise HTTPException(status_code=404, detail=f"Question with ID '{question_id}' not found.")
        expl = (await session.exec(select(QuestionExplanation).where(col(QuestionExplanation.question_id) == q.id))).first()
        sol_card = {
            "question_id": str(q.id),
            "question_number": q.question_number_in_paper,
            "correct_option_id": None,
            "correct_option_label": None,
            "difficulty": q.difficulty.value if hasattr(q.difficulty, "value") else str(q.difficulty),
            "explanation": {
                "detailed_solution": expl.detailed_solution if expl else "",
                "reverse_logic": expl.reverse_logic if expl else None,
                "common_mistake": expl.common_mistake if expl else None,
                "common_traps": (expl.common_traps_json or ([expl.common_mistake] if expl.common_mistake else [])) if expl else [],
            },
            "distractor_scores": {},
            "source": "DATABASE_OPTIMIZED",
        }
        await cache.set(cache_key, sol_card, ttl_seconds=3600)
        return JSONResponse(content=jsonable_encoder(sol_card))

    q = rows[0][0]
    expl = rows[0][1]

    correct_option_id = None
    correct_option_label = "A"
    distractor_scores = {}

    opt_data = {}
    for _, _, opt, ot, qr in rows:
        if opt.id not in opt_data:
            opt_data[opt.id] = {
                "opt": opt,
                "ot": None,
                "qr": qr,
            }
        cur_ot = opt_data[opt.id]["ot"]
        if ot:
            if not cur_ot:
                opt_data[opt.id]["ot"] = ot
            elif ot.language == language or (hasattr(ot.language, "value") and ot.language.value == lang_str):
                opt_data[opt.id]["ot"] = ot
            elif ot.distractor_analysis and not cur_ot.distractor_analysis:
                opt_data[opt.id]["ot"] = ot
        if qr and not opt_data[opt.id]["qr"]:
            opt_data[opt.id]["qr"] = qr

    for opt_id, entry in opt_data.items():
        opt = entry["opt"]
        ot = entry["ot"]
        qr = entry["qr"]

        analysis_text = None
        if ot and ot.distractor_analysis:
            analysis_text = ot.distractor_analysis
        elif qr:
            why_t = (qr.why_tempting or "").strip()
            whats_t = (qr.whats_actually_true or "").strip()
            if why_t and whats_t:
                analysis_text = f"Why it seems tempting — {why_t}\n\nWhat's actually true — {whats_t}"
            elif whats_t:
                analysis_text = whats_t
            elif why_t:
                analysis_text = why_t

        if opt.is_correct:
            correct_option_id = str(opt.id)
            correct_option_label = opt.option_label

        c_score = opt.closeness_score if opt.closeness_score is not None else (1.0 if opt.is_correct else 0.0)

        distractor_scores[str(opt.id)] = {
            "option_id": str(opt.id),
            "label": opt.option_label,
            "text": ot.option_text if ot else f"Option {opt.option_label}",
            "closeness_score": c_score,
            "is_correct": opt.is_correct,
            "classification": ClosenessEvaluator.classify_option(c_score),
            "distractor_analysis": analysis_text or "",
            "analysis": analysis_text or "",
        }

    detailed_solution = (
        expl.detailed_solution if (expl and expl.detailed_solution) else (
            f"**Option ({correct_option_label}) is correct.**\n\nThis question evaluates core conceptual mastery under standard syllabus guidelines."
        )
    )

    common_traps = (
        expl.common_traps_json if (expl and expl.common_traps_json) else (
            [expl.common_mistake] if (expl and expl.common_mistake) else []
        )
    )

    sol_card = {
        "question_id": str(q.id),
        "question_number": q.question_number_in_paper,
        "correct_option_id": correct_option_id,
        "correct_option_label": correct_option_label,
        "difficulty": q.difficulty.value if hasattr(q.difficulty, "value") else str(q.difficulty),
        "explanation": {
            "detailed_solution": detailed_solution,
            "reverse_logic": expl.reverse_logic if expl else None,
            "common_mistake": expl.common_mistake if expl else None,
            "common_traps": common_traps,
        },
        "distractor_scores": distractor_scores,
        "source": "DATABASE_OPTIMIZED",
    }

    await cache.set(cache_key, sol_card, ttl_seconds=3600)
    return JSONResponse(content=jsonable_encoder(sol_card))
