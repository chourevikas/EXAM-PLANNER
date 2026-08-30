import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.session import get_async_session
from app.db.models.user import User
from app.db.models.notification import Notification
from app.db.models.study_plan import StudyTask
from app.routers.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", summary="Get Current User's Notifications")
async def get_user_notifications(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """
    Fetches DB notifications for the logged-in user.
    Also automatically checks today's pending study tasks in DB (0 LLM calls)
    and creates/updates a notification record if uncompleted tasks exist.
    """
    today = datetime.now(timezone.utc).date()
    cutoff_date = today - timedelta(days=14)
    
    # 1. Fast SQL Check: Count uncompleted tasks scheduled in the last 14 days up to today
    stmt_pending = select(StudyTask).where(
        StudyTask.user_id == current_user.id,
        StudyTask.scheduled_date >= cutoff_date,
        StudyTask.scheduled_date <= today,
        StudyTask.is_completed == False
    )
    pending_tasks = (await session.exec(stmt_pending)).all()
    pending_count = len(pending_tasks)

    if pending_count > 0:
        # Check if a pending task notification was already created today
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        stmt_existing = select(Notification).where(
            Notification.user_id == current_user.id,
            Notification.notification_type == "PENDING_TASKS",
            Notification.created_at >= today_start
        )
        existing_noti = (await session.exec(stmt_existing)).first()

        if not existing_noti:
            noti = Notification(
                user_id=current_user.id,
                title=f"{pending_count} Daily Target(s) Remaining",
                message=f"You have {pending_count} pending study task(s) scheduled for today. Complete them to maintain your streak!",
                notification_type="PENDING_TASKS",
                action_url="/study-planner",
                is_read=False
            )
            session.add(noti)
            await session.commit()
        else:
            # Update count in message if pending tasks changed
            new_title = f"{pending_count} Daily Target(s) Remaining"
            if existing_noti.title != new_title:
                existing_noti.title = new_title
                existing_noti.message = f"You have {pending_count} pending study task(s) scheduled for today. Complete them to maintain your streak!"
                session.add(existing_noti)
                await session.commit()

    # 2. Fetch latest 20 notifications for the user
    stmt_all = select(Notification).where(
        Notification.user_id == current_user.id
    ).order_by(col(Notification.created_at).desc()).limit(20)
    
    notifications = (await session.exec(stmt_all)).all()

    # 3. Calculate unread count (efficient SQL COUNT)
    from sqlmodel import func
    stmt_unread_count = select(func.count()).select_from(Notification).where(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    )
    unread_count = (await session.exec(stmt_unread_count)).one_or_none() or 0

    return JSONResponse(content=jsonable_encoder({
        "unread_count": unread_count,
        "notifications": [
            {
                "id": str(n.id),
                "title": n.title,
                "message": n.message,
                "notification_type": n.notification_type,
                "action_url": n.action_url,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat() if n.created_at else None
            }
            for n in notifications
        ]
    }))


@router.post("/{notification_id}/read", summary="Mark single notification as read")
async def mark_notification_read(
    notification_id: int | str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    try:
        nid = int(notification_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Notification not found")

    noti = await session.get(Notification, nid)
    if not noti or noti.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    noti.is_read = True
    session.add(noti)
    await session.commit()
    return {"message": "Notification marked as read", "id": str(nid)}


@router.post("/mark-all-read", summary="Mark all user notifications as read")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    stmt = select(Notification).where(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    )
    unread_notis = (await session.exec(stmt)).all()
    for n in unread_notis:
        n.is_read = True
        session.add(n)
    await session.commit()
    return {"message": "All notifications marked as read", "count": len(unread_notis)}
