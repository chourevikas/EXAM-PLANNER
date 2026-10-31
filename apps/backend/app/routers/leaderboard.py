"""National and state leaderboards per target exam (recalculated daily)."""
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, Depends, Query
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.deps import get_current_user
from app.db.models.user import User
from app.db.session import get_async_session
from app.services import leaderboard_service

router = APIRouter(tags=["Leaderboard"])


@router.get("/leaderboard", summary="Leaderboard for a target exam, national or by state")
async def get_leaderboard(
    scope: Literal["national", "state"] = "national",
    exam: Optional[str] = Query(default=None, max_length=100, description="Target exam; defaults to the viewer's"),
    state: Optional[str] = Query(default=None, max_length=64, description="State for scope=state; defaults to the viewer's"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    return await leaderboard_service.leaderboard(session, current_user, scope, exam, state, page, page_size)


@router.get("/users/username-available", summary="Whether a leaderboard username is free")
async def username_available(
    u: str = Query(..., min_length=1, max_length=40),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    from app.routers.auth import USERNAME_PATTERN, username_taken

    username = u.strip().lower()
    if not USERNAME_PATTERN.match(username):
        return {"username": username, "available": False, "reason": "3-20 characters: lowercase letters, numbers or underscores"}
    taken = await username_taken(session, username, exclude_user_id=current_user.id)
    return {"username": username, "available": not taken, "reason": "Taken" if taken else None}
