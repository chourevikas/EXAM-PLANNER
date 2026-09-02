from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select, desc
from app.db.session import AsyncSession, get_async_session
from app.core.deps import get_current_user, require_roles
from app.db.models.enums import UserRole
from app.db.models.user import User
from app.db.models.current_affairs import CurrentAffair
from pydantic import BaseModel
import datetime as dt
from datetime import datetime, timezone

router = APIRouter(prefix="/current-affairs", tags=["Current Affairs"])

class CurrentAffairCreate(BaseModel):
    title: str
    content: str
    topic: Optional[str] = None
    subtopic: Optional[str] = None
    date: Optional[dt.date] = None

class CurrentAffairRead(BaseModel):
    id: int
    title: str
    content: str
    topic: Optional[str]
    subtopic: Optional[str]
    date: dt.date
    created_at: datetime
    updated_at: datetime
    is_published: bool

@router.post("/", response_model=CurrentAffairRead)
async def create_current_affair(
    data: CurrentAffairCreate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    affair = CurrentAffair(
        title=data.title,
        content=data.content,
        topic=data.topic,
        subtopic=data.subtopic,
        date=data.date or datetime.now(timezone.utc).date(),
        created_by_id=current_user.id
    )
    session.add(affair)
    await session.commit()
    await session.refresh(affair)
    return affair

@router.get("/", response_model=List[CurrentAffairRead])
async def list_current_affairs(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    stmt = select(CurrentAffair).where(CurrentAffair.is_published == True).order_by(desc(CurrentAffair.date))
    result = await session.exec(stmt)
    return result.all()

@router.get("/{id}", response_model=CurrentAffairRead)
async def get_current_affair(
    id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    affair = await session.get(CurrentAffair, id)
    if not affair:
        raise HTTPException(status_code=404, detail="Current affair not found")
    return affair

@router.put("/{id}", response_model=CurrentAffairRead)
async def update_current_affair(
    id: int,
    data: CurrentAffairCreate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    affair = await session.get(CurrentAffair, id)
    if not affair:
        raise HTTPException(status_code=404, detail="Current affair not found")
    
    affair.title = data.title
    affair.content = data.content
    affair.topic = data.topic
    affair.subtopic = data.subtopic
    if data.date:
        if isinstance(data.date, str):
            affair.date = dt.datetime.strptime(data.date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        else:
            affair.date = data.date
            
    session.add(affair)
    await session.commit()
    await session.refresh(affair)
    return affair

@router.delete("/{id}", response_model=dict)
async def delete_current_affair(
    id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    affair = await session.get(CurrentAffair, id)
    if not affair:
        raise HTTPException(status_code=404, detail="Not found")
    await session.delete(affair)
    await session.commit()
    return {"status": "deleted"}
