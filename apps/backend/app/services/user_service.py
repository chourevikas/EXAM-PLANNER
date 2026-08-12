import uuid
from typing import List, Optional
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from fastapi import status

from app.db.models.user import User, UserRole
from app.schemas.user import UserCreate, UserUpdate
from app.repositories.user_repository import UserRepository
from app.core.security import get_password_hash
from app.core.exceptions import UserAlreadyExistsException, BaseAppException


class UserService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepository(session)

    async def get_user_by_id(self, user_id: uuid.UUID | str) -> Optional[User]:
        return await self.user_repo.get_by_id(user_id)

    async def list_users(self, current_user: Optional[User] = None, skip: int = 0, limit: int = 100) -> List[User]:
        stmt = select(User)

        # Super Admin accounts are hidden at all cost from backend user listing
        stmt = stmt.where(User.role != UserRole.SUPER_ADMIN)

        # One admin should not see other admins; an admin ONLY sees student accounts
        if current_user and current_user.role == UserRole.ADMIN:
            stmt = stmt.where(User.role == UserRole.STUDENT)

        stmt = stmt.offset(skip).limit(limit)
        res = await self.session.exec(stmt)
        return list(res.all())

    async def create_user(self, user_in: UserCreate) -> User:
        existing = await self.user_repo.get_by_email(user_in.email)
        if existing:
            raise UserAlreadyExistsException(user_in.email)

        hashed_pw = get_password_hash(user_in.password)
        return await self.user_repo.create_user(
            email=user_in.email,
            full_name=user_in.full_name,
            password_hash=hashed_pw,
            role=user_in.role or UserRole.STUDENT,
        )

    async def update_user(self, user_id: uuid.UUID | str, user_in: UserUpdate, current_user: Optional[User] = None) -> User:
        user = await self.get_user_by_id(user_id)
        if not user:
            raise BaseAppException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        # Super Admin accounts cannot be altered via standard user API
        if user.role == UserRole.SUPER_ADMIN:
            raise BaseAppException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Super Admin account cannot be modified"
            )

        # Admin users can ONLY update STUDENT accounts
        if current_user and current_user.role == UserRole.ADMIN and user.role != UserRole.STUDENT:
            raise BaseAppException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Admins can only manage student accounts"
            )

        update_data = user_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(user, field, value)

        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user


    async def delete_user(self, user_id: uuid.UUID | str) -> None:
        user = await self.get_user_by_id(user_id)
        if not user:
            raise BaseAppException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        await self.session.delete(user)
        await self.session.commit()
