from fastapi import APIRouter, Depends, Query
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import List, Dict, Any

from app.db.session import get_async_session
from app.core.deps import get_current_user
from app.db.models.user import User

router = APIRouter(prefix="/search", tags=["Global Search"])

@router.get("/")
async def global_search(
    q: str = Query(..., min_length=1, description="The search query"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Unified search endpoint. Currently returns mocked structured data
    while PYQ and Mock tables are being built.
    """
    query = q.lower()
    
    # Mocked results based on query to simulate a real DB ILIKE search
    results = {
        "mocks": [],
        "pyqs": [],
        "topics": []
    }
    
    # Simple mock logic
    if "upsc" in query or "mock" in query or "test" in query:
        results["mocks"].append({"id": "m1", "title": "UPSC CSE 2024 - Full Length Mock 1", "type": "mock", "url": "/exam/mock_1"})
        results["mocks"].append({"id": "m2", "title": "UPSC CSE 2024 - Polity Sectional", "type": "mock", "url": "/exam/mock_polity"})
        
    if "2022" in query or "pyq" in query or "upsc" in query:
        results["pyqs"].append({"id": "p1", "title": "UPSC CSE Prelims 2022 - GS Paper 1", "type": "pyq", "url": "/exam/pyq_2022"})
        results["pyqs"].append({"id": "p2", "title": "UPSC CSE Prelims 2021 - GS Paper 1", "type": "pyq", "url": "/exam/pyq_2021"})
        
    if "polity" in query or "history" in query or "geo" in query or "fun" in query:
        results["topics"].append({"id": "t1", "title": "Fundamental Rights (Polity)", "type": "topic", "url": "/study/polity/fundamental-rights"})
        results["topics"].append({"id": "t2", "title": "Modern History - Indian National Movement", "type": "topic", "url": "/study/history/inm"})
        
    # If the user searches something totally random, just show some default results
    if not any(results.values()):
        results["topics"].append({"id": "t_def", "title": f"Search results for '{q}' (Data pending)", "type": "topic", "url": "#"})
        
    return results
