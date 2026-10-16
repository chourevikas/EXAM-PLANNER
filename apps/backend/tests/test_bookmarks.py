import pytest
import asyncio
from fastapi import Response
from httpx import AsyncClient, ASGITransport
from app.fastapi_server import app
from app.db.session import engine
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from app.db.models.user import User, QuestionBookmark
from app.db.models.question import Question

@pytest.mark.anyio
async def test_bookmark_api_flow():
    await engine.dispose()  # pooled connections belong to the previous test's event loop
    async with AsyncSession(engine, expire_on_commit=False) as session:  # same as the app's sessions
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
        res_list = await list_bookmarks(response=Response(), session=session, current_user=user)
        assert res_list["total"] >= 1
        items = res_list["items"]
        assert len(items) >= 1
        assert "bookmark_id" in items[0]
        assert "question_id" in items[0]
        assert "question_text" in items[0]
        assert "difficulty" in items[0]
        assert {"exam_name", "exam_full_name", "source_year"} <= items[0].keys()

        # Test remove bookmark
        res_del = await remove_bookmark(question_id=question.id, session=session, current_user=user)
        assert res_del["message"] == "Bookmark removed"


@pytest.mark.anyio
async def test_bookmark_list_pagination_and_filters():
    from app.routers.users import list_bookmarks, add_bookmark, remove_bookmark

    await engine.dispose()  # pooled connections belong to the previous test's event loop
    async with AsyncSession(engine, expire_on_commit=False) as session:  # same as the app's sessions
        user = (await session.exec(select(User))).first()
        questions = (await session.exec(select(Question.id, Question.difficulty).order_by(Question.id).limit(3))).all()
        assert user is not None and len(questions) == 3, "A user and 3 questions must exist for testing"
        user_id = user.id
        already = set(
            (await session.exec(select(QuestionBookmark.question_id).where(QuestionBookmark.user_id == user_id))).all()
        )
        added = [qid for qid, _ in questions if qid not in already]
        for qid in added:
            await add_bookmark(question_id=qid, session=session, current_user=user)

        try:
            full = await list_bookmarks(response=Response(), limit=100, session=session, current_user=user)
            total = full["total"]
            assert total >= 3
            assert len(full["items"]) == min(total, 100)

            # Pages are disjoint and together cover the first items in order
            page1 = await list_bookmarks(response=Response(), skip=0, limit=2, session=session, current_user=user)
            page2 = await list_bookmarks(response=Response(), skip=2, limit=2, session=session, current_user=user)
            assert page1["total"] == page2["total"] == total
            assert len(page1["items"]) == 2
            ids = [b["bookmark_id"] for b in page1["items"] + page2["items"]]
            assert ids == [b["bookmark_id"] for b in full["items"][: len(ids)]]

            # Difficulty filter only returns that difficulty, and its total counts only those
            diff = questions[0][1]
            by_diff = await list_bookmarks(
                response=Response(), limit=100, difficulty=diff, session=session, current_user=user
            )
            assert by_diff["items"] and all(b["difficulty"] == diff.value for b in by_diff["items"])
            assert by_diff["total"] == sum(1 for b in full["items"] if b["difficulty"] == diff.value)

            # A search that cannot match returns nothing; LIKE wildcards are matched literally
            none = await list_bookmarks(
                response=Response(), q="%_no-such-text_%", session=session, current_user=user
            )
            assert none == {"items": [], "total": 0}

            # A word from a bookmarked question's text finds it
            text = next(b["question_text"] for b in full["items"] if b["question_text"].strip())
            word = max(text.split(), key=len)
            found = await list_bookmarks(
                response=Response(), limit=100, q=word.upper(), session=session, current_user=user
            )
            assert any(b["question_text"] == text for b in found["items"])
        finally:
            for qid in added:
                await remove_bookmark(question_id=qid, session=session, current_user=user)
