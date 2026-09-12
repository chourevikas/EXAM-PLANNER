from typing import Any
from fastapi import APIRouter, Depends, Query
from sqlmodel import select, or_
from sqlmodel.ext.asyncio.session import AsyncSession

from app.cache import get_cache, build_cache_key
from app.db.session import get_async_session
from app.db.models import Exam, Topic, Subtopic, QuestionSourceType

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
        return {"mocks": [], "pyqs": [], "topics": []}

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

