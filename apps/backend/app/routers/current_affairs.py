from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import select, desc, func
from app.db.session import AsyncSession, get_async_session
from app.core.deps import get_current_user, require_roles, require_admin_section
from app.db.models.enums import UserRole
from app.db.models.user import User
from app.db.models.current_affairs import CurrentAffair
from pydantic import BaseModel, ConfigDict
import datetime as dt
from datetime import datetime, timezone

router = APIRouter(prefix="/current-affairs", tags=["Current Affairs"])
# Unauthenticated, read-only feed for the public marketing site (SEO pages).
public_router = APIRouter(prefix="/public/current-affairs", tags=["Public — Current Affairs"])

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
    current_user: User = Depends(require_admin_section("admin.current_affairs"))
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
    is_staff = current_user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN)
    if not affair or (not affair.is_published and not is_staff):
        raise HTTPException(status_code=404, detail="Current affair not found")
    return affair

@router.put("/{id}", response_model=CurrentAffairRead)
async def update_current_affair(
    id: int,
    data: CurrentAffairCreate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_admin_section("admin.current_affairs"))
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
    current_user: User = Depends(require_admin_section("admin.current_affairs"))
):
    affair = await session.get(CurrentAffair, id)
    if not affair:
        raise HTTPException(status_code=404, detail="Not found")
    await session.delete(affair)
    await session.commit()
    return {"status": "deleted"}


class PublicCurrentAffair(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    content: str
    topic: Optional[str]
    subtopic: Optional[str]
    date: dt.date
    updated_at: datetime


class PublicCurrentAffairPage(BaseModel):
    items: List[PublicCurrentAffair]
    total: int
    page: int
    size: int


@public_router.get("", response_model=PublicCurrentAffairPage)
async def list_public_current_affairs(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=1000),
    topic: Optional[str] = None,
    session: AsyncSession = Depends(get_async_session),
):
    filters = [CurrentAffair.is_published == True]
    if topic:
        filters.append(CurrentAffair.topic == topic)
    total = (await session.exec(select(func.count()).select_from(CurrentAffair).where(*filters))).one()
    stmt = (
        select(CurrentAffair)
        .where(*filters)
        .order_by(desc(CurrentAffair.date), desc(CurrentAffair.id))
        .offset((page - 1) * size)
        .limit(size)
    )
    items = (await session.exec(stmt)).all()
    return PublicCurrentAffairPage(items=items, total=total, page=page, size=size)


@public_router.get("/{id}", response_model=PublicCurrentAffair)
async def get_public_current_affair(
    id: int,
    session: AsyncSession = Depends(get_async_session),
):
    affair = await session.get(CurrentAffair, id)
    if not affair or not affair.is_published:
        raise HTTPException(status_code=404, detail="Current affair not found")
    return affair
