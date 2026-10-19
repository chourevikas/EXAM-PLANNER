from typing import Any, Optional
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Query
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlmodel import select, or_, col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.cache import get_cache, build_cache_key
from app.config.logger import setup_logger
from app.core.deps import get_current_user
from app.db.session import get_async_session
from app.db.models import Exam, Topic, Subtopic, QuestionSourceType, Question, User

logger = setup_logger("GlobalSearch")

router = APIRouter(prefix="/search", tags=["Global Search"])


@router.get("")
@router.get("/")
async def global_search(
    q: str = Query(..., min_length=1, description="The search query"),
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, list[dict[str, Any]]]:
    """
    Unified search endpoint returning structured search results across Mocks, PYQs, and Study Planner topics.
    Queries database live with Redis caching (TTL 600s).
    """
    clean_query = q.strip()
    if not clean_query:
        return {"mocks": [], "pyqs": [], "topics": [], "questions": []}

    cache = get_cache()
    cache_key = build_cache_key("search", clean_query.lower())
    cached_data = await cache.get(cache_key)
    if cached_data is not None:
        return cached_data

    term = f"%{clean_query}%"
    results: dict[str, list[dict[str, Any]]] = {
        "mocks": [],
        "pyqs": [],
        "topics": [],
        "questions": [],
    }

    try:
        # 1. Search Exams (Mocks & PYQs)
        exam_stmt = (
            select(Exam)
            .where(or_(Exam.name.ilike(term), Exam.code.ilike(term)))
            .limit(15)
        )
        exam_res = await session.exec(exam_stmt)
        exams = exam_res.all()

        for exam in exams:
            is_mock = (
                exam.exam_type == QuestionSourceType.STATIC_MOCK
                or "mock" in (exam.name or "").lower()
                or "test" in (exam.name or "").lower()
            )
            item = {
                "id": str(exam.id),
                "title": exam.name,
                "type": "Mock Test" if is_mock else "PYQ Paper",
                "url": f"/mocks?examId={exam.id}" if is_mock else f"/pyq?examId={exam.id}",
            }
            if is_mock:
                results["mocks"].append(item)
            else:
                results["pyqs"].append(item)

        # 2. Search Topics & Subtopics
        topic_stmt = select(Topic).where(Topic.name.ilike(term)).limit(10)
        topic_res = await session.exec(topic_stmt)
        topics = topic_res.all()
        for t in topics:
            results["topics"].append({
                "id": f"topic_{t.id}",
                "title": t.name,
                "type": "Topic",
                "url": "/study-planner",
            })

        subtopic_stmt = select(Subtopic).where(Subtopic.name.ilike(term)).limit(10)
        subtopic_res = await session.exec(subtopic_stmt)
        subtopics = subtopic_res.all()
        for st in subtopics:
            results["topics"].append({
                "id": f"subtopic_{st.id}",
                "title": st.name,
                "type": "Subtopic",
                "url": "/study-planner",
            })

    except Exception:
        pass

    # 3. Question text (full-text); each result opens a practice session on all the matches, from that question
    try:
        results["questions"] = await _question_results(session, clean_query)
    except Exception as err:
        logger.warning(f"Question search failed for {clean_query!r}: {err}")

    # Fallback if no results found
    if not any(results.values()):
        results["topics"].append({
            "id": "t_def",
            "title": f"Explore Study Planner for '{clean_query}'",
            "type": "Syllabus Topic",
            "url": "/study-planner",
        })

    await cache.set(cache_key, results, ttl_seconds=600)
    return results



QUESTION_RESULTS = 8


async def _question_results(session: AsyncSession, query: str) -> list[dict[str, Any]]:
    from app.services.exam_session_service import exam_badge_label, load_exam_type_codes
    from app.services.question_search_service import search_questions, snippet

    matches = await search_questions(session, query, limit=QUESTION_RESULTS)
    if not matches:
        return []
    ids = [qid for qid, _ in matches]
    meta = {
        qid: (name, code, q_year, e_year, mixed)
        for qid, name, code, q_year, e_year, mixed in (await session.exec(
            select(Question.id, Exam.name, Exam.code, Question.source_year, Exam.source_year, Exam.is_mixed_bank)
            .outerjoin(Exam, col(Exam.id) == col(Question.exam_id))
            .where(col(Question.id).in_(ids))
        )).all()
    }
    type_codes = await load_exam_type_codes(session)
    out = []
    for qid, text in matches:
        name, code, q_year, e_year, mixed = meta.get(qid, (None, None, None, None, False))
        badge = exam_badge_label(name or code, type_codes) if (name or code) else None
        year = q_year or (None if mixed else e_year)
        out.append({
            "id": str(qid),
            "title": snippet(text, query),
            "type": " ".join(str(p) for p in (badge, year) if p) or "Question",
            "url": "/practice-exam?" + urlencode({"source": "search", "q": query, "start": qid}),
        })
    return out


@router.get("/questions/practice", summary="Questions matching a search, with solutions, for a practice session")
async def search_practice(
    q: str = Query(..., min_length=1, max_length=200),
    start: Optional[int] = Query(default=None, description="Question to open first (the one clicked)"),
    language: str = Query(default="en", description="Session language: en, hi or mr"),
    limit: int = Query(default=50, ge=1, le=100),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Same item shape as GET /questions, best match first; the clicked question is moved to the front."""
    from app.core.languages import parse_language
    from app.services.question_search_service import search_questions
    from app.services.question_service import QuestionService

    ids = [qid for qid, _ in await search_questions(session, q, limit=limit)]
    if start is not None and start in ids:
        ids.remove(start)
        ids.insert(0, start)
    by_id = {x.id: x for x in (await session.exec(select(Question).where(col(Question.id).in_(ids)))).all()} if ids else {}
    questions = [by_id[i] for i in ids if i in by_id]
    items = await QuestionService(session)._build_batch_question_detail_responses(
        questions, target_lang=parse_language(language), include_solutions=True
    )
    return JSONResponse(content=jsonable_encoder({"items": items, "total": len(items)}))
