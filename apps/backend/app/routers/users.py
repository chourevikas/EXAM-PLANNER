from typing import List
from fastapi import APIRouter, Depends, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.session import get_async_session
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services.user_service import UserService
from app.db.models.user import User, UserRole
from app.core.deps import get_current_user, require_roles

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=List[UserRead])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    user_service = UserService(session)
    return await user_service.list_users(current_user=current_user, skip=skip, limit=limit)


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_in: UserCreate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    user_service = UserService(session)
    return await user_service.create_user(user_in)


@router.get("/{user_id}", response_model=UserRead)
async def get_user(
    user_id: str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    user_service = UserService(session)
    return await user_service.get_user_by_id(user_id)


@router.put("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: str,
    user_in: UserUpdate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    user_service = UserService(session)
    return await user_service.update_user(user_id, user_in, current_user=current_user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
):
    user_service = UserService(session)
    await user_service.delete_user(user_id)
    return None

