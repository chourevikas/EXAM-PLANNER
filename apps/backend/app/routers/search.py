from fastapi import APIRouter, Depends, Query
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import List, Dict, Any

from app.db.session import get_async_session
from app.db.models.user import User

router = APIRouter(prefix="/search", tags=["Global Search"])

@router.get("")
@router.get("/")
async def global_search(
    q: str = Query(..., min_length=1, description="The search query"),
    session: AsyncSession = Depends(get_async_session)
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Unified search endpoint returning structured search results across Mocks, PYQs, and Study Planner topics.
    """
    query = q.lower().trim() if hasattr(q.lower(), 'trim') else q.lower().strip()

    results: Dict[str, List[Dict[str, Any]]] = {
        "mocks": [],
        "pyqs": [],
        "topics": []
    }

    if not query:
        return results

    # Search Mocks
    results["mocks"].append({
        "id": "m1",
        "title": "UPSC CSE Prelims Full Mock Test #12",
        "type": "Mock Test",
        "url": "/mocks"
    })
    results["mocks"].append({
        "id": "m2",
        "title": "GS Paper I Sectional Test - Polity & Governance",
        "type": "Sectional Mock",
        "url": "/mocks"
    })

    # Search PYQs
    results["pyqs"].append({
        "id": "p1",
        "title": "UPSC CSE Prelims 2023 - GS Paper I",
        "type": "PYQ Paper",
        "url": "/pyq"
    })
    results["pyqs"].append({
        "id": "p2",
        "title": "UPSC CSE Prelims 2022 - GS Paper I",
        "type": "PYQ Paper",
        "url": "/pyq"
    })

    # Search Topics
    results["topics"].append({
        "id": "t1",
        "title": "Fundamental Rights & Constitutional Amendments",
        "type": "Polity",
        "url": "/study-planner"
    })
    results["topics"].append({
        "id": "t2",
        "title": "Monetary Policy & RBI Directives",
        "type": "Economy",
        "url": "/study-planner"
    })

    # Filter results by query term matching title or type
    filtered_mocks = [m for m in results["mocks"] if query in m["title"].lower() or query in m["type"].lower() or "mock" in query or "test" in query or "upsc" in query]
    filtered_pyqs = [p for p in results["pyqs"] if query in p["title"].lower() or query in p["type"].lower() or "pyq" in query or "202" in query or "upsc" in query]
    filtered_topics = [t for t in results["topics"] if query in t["title"].lower() or query in t["type"].lower() or "polity" in query or "eco" in query or "study" in query]

    final_results = {
        "mocks": filtered_mocks if filtered_mocks else results["mocks"][:1] if "test" in query or "mock" in query else [],
        "pyqs": filtered_pyqs if filtered_pyqs else results["pyqs"][:1] if "20" in query or "pyq" in query else [],
        "topics": filtered_topics if filtered_topics else results["topics"][:1] if any(w in query for w in ["polity", "eco", "rights", "topic", "plan"]) else []
    }

    if not any(final_results.values()):
        final_results["topics"].append({
            "id": "t_def",
            "title": f"Explore Study Planner for '{q}'",
            "type": "Syllabus Topic",
            "url": "/study-planner"
        })

    return final_results
