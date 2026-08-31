from typing import List, Optional
from fastapi import APIRouter, Depends, status, HTTPException, Response
from fastapi.responses import JSONResponse
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, col, and_, func

from app.db.session import get_async_session
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services.user_service import UserService
from app.db.models.user import User, UserRole, QuestionBookmark
from app.db.models.question import Question, QuestionTranslation
from app.db.models.enums import LanguageCode
from app.core.deps import get_current_user, require_roles
from app.cache import get_cache, build_cache_key, invalidate_user_cache

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me/bookmarks")
async def list_bookmarks(
    response: Response,
    skip: int = 0,
    limit: int = 100,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    response.headers["Cache-Control"] = "private, max-age=15, stale-while-revalidate=30"
    if not current_user.id:
        return []

    cache = get_cache()
    cache_key = build_cache_key("users:bookmarks", str(current_user.id), skip=skip, limit=limit)
    cached_data = await cache.get(cache_key)
    if cached_data is not None:
        return cached_data

    # Single-pass optimized query selecting only needed scalar columns
    stmt = (
        select(
            col(QuestionBookmark.id).label("bookmark_id"),
            col(Question.id).label("question_id"),
            col(Question.difficulty),
            col(QuestionBookmark.created_at),
            func.coalesce(col(QuestionTranslation.question_text), "").label("question_text"),
        )
        .join(Question, col(QuestionBookmark.question_id) == col(Question.id))
        .join(
            QuestionTranslation,
            and_(
                col(QuestionTranslation.question_id) == col(Question.id),
                col(QuestionTranslation.language) == LanguageCode.ENGLISH,
            ),
            isouter=True,
        )
        .where(col(QuestionBookmark.user_id) == current_user.id)
        .order_by(col(QuestionBookmark.created_at).desc())
        .offset(skip)
        .limit(limit)
    )
    result = await session.exec(stmt)
    rows = result.all()
    
    out = []
    for row in rows:
        difficulty_raw = getattr(row, "difficulty", None)
        diff_val = difficulty_raw.value if hasattr(difficulty_raw, "value") else (difficulty_raw or "MEDIUM")
        out.append({
            "bookmark_id": str(getattr(row, "bookmark_id", "")),
            "question_id": str(getattr(row, "question_id", "")),
            "question_text": getattr(row, "question_text", "") or "",
            "difficulty": diff_val,
            "created_at": row.created_at.isoformat() if getattr(row, "created_at", None) else None,
        })
        
    await cache.set(cache_key, out, ttl_seconds=300)
    return out


@router.post("/me/bookmarks/{question_id}")
async def add_bookmark(
    question_id: int | str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    user_id = current_user.id
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        qid_int = int(question_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Question not found")

    # Check if question exists
    q = await session.get(Question, qid_int)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
        
    # Check if already bookmarked
    stmt = select(QuestionBookmark).where(
        col(QuestionBookmark.user_id) == user_id,
        col(QuestionBookmark.question_id) == qid_int
    )
    result = await session.exec(stmt)
    if result.first():
        return {"message": "Already bookmarked"}
        
    bk = QuestionBookmark(
        user_id=user_id,
        question_id=qid_int
    )
    session.add(bk)
    await session.commit()
    await invalidate_user_cache(str(user_id))
    return {"message": "Bookmark added", "bookmark_id": str(bk.id)}


@router.delete("/me/bookmarks/{question_id}")
async def remove_bookmark(
    question_id: int | str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    user_id = current_user.id
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        qid_int = int(question_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Bookmark not found")

    stmt = select(QuestionBookmark).where(
        col(QuestionBookmark.user_id) == user_id,
        col(QuestionBookmark.question_id) == qid_int
    )
    result = await session.exec(stmt)
    bk = result.first()
    if not bk:
        raise HTTPException(status_code=404, detail="Bookmark not found")
        
    await session.delete(bk)
    await session.commit()
    await invalidate_user_cache(str(user_id))
    return {"message": "Bookmark removed"}


@router.get("", response_model=List[UserRead])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    cache = get_cache()
    cache_key = build_cache_key(
        "users:list",
        role=str(current_user.role.value if hasattr(current_user.role, "value") else current_user.role) if current_user else "anon",
        skip=skip,
        limit=limit,
    )
    cached_data = await cache.get(cache_key)
    if cached_data is not None:
        return JSONResponse(content=cached_data)

    from fastapi.encoders import jsonable_encoder
    user_service = UserService(session)
    users = await user_service.list_users(current_user=current_user, skip=skip, limit=limit)
    if users is not None:
        serialized = jsonable_encoder(users)
        await cache.set(cache_key, serialized, ttl_seconds=600)
        return JSONResponse(content=serialized)
    return JSONResponse(content=[])


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_in: UserCreate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    user_service = UserService(session)
    user = await user_service.create_user(user_in)
    await invalidate_user_cache(str(user.id))
    return user


@router.get("/{user_id}", response_model=UserRead)
async def get_user(
    user_id: int | str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    cache = get_cache()
    cache_key = build_cache_key("users:detail", str(user_id))
    cached_data = await cache.get(cache_key)
    if cached_data is not None:
        return JSONResponse(content=cached_data)

    from fastapi.encoders import jsonable_encoder
    user_service = UserService(session)
    user = await user_service.get_user_by_id(user_id)
    if user is not None:
        serialized = jsonable_encoder(user)
        await cache.set(cache_key, serialized, ttl_seconds=1800)
        return JSONResponse(content=serialized)
    return user


@router.put("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: int | str,
    user_in: UserUpdate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    user_service = UserService(session)
    user = await user_service.update_user(user_id, user_in, current_user=current_user)
    await invalidate_user_cache(str(user_id))
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int | str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    user_service = UserService(session)
    await user_service.delete_user(user_id)
    await invalidate_user_cache(str(user_id))
    return None
