import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from app.fastapi_server import app
from app.db.session import engine
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from app.db.models.user import User, QuestionBookmark
from app.db.models.question import Question

@pytest.mark.anyio
async def test_bookmark_api_flow():
    async with AsyncSession(engine) as session:
        # Fetch an existing user or question
        user = (await session.exec(select(User))).first()
        question = (await session.exec(select(Question))).first()
        assert user is not None, "A user must exist for testing"
        assert question is not None, "A question must exist for testing"

        # Test listing bookmarks
        from app.routers.users import list_bookmarks, add_bookmark, remove_bookmark
        
        # Test add bookmark
        res_add = await add_bookmark(question_id=question.id, session=session, current_user=user)
        assert "message" in res_add
        
        # Test list bookmarks
        res_list = await list_bookmarks(session=session, current_user=user)
        assert isinstance(res_list, list)
        assert len(res_list) >= 1
        assert "bookmark_id" in res_list[0]
        assert "question_id" in res_list[0]
        assert "question_text" in res_list[0]
        assert "difficulty" in res_list[0]
        
        # Test remove bookmark
        res_del = await remove_bookmark(question_id=question.id, session=session, current_user=user)
        assert res_del["message"] == "Bookmark removed"
