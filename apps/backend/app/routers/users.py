from typing import List, Optional
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.session import get_async_session
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services.user_service import UserService
from app.db.models.user import User, UserRole
from app.core.deps import get_current_user, require_roles
from app.cache import get_cache, build_cache_key, invalidate_user_cache

router = APIRouter(prefix="/users", tags=["Users"])


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
    user_id: str,
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
    user_id: str,
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
    user_id: str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    user_service = UserService(session)
    await user_service.delete_user(user_id)
    await invalidate_user_cache(str(user_id))
    return None

