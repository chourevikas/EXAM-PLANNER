from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlmodel import select, col, func
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.session import get_async_session
from app.db.models.user import User
from app.db.models.notification import Notification, UserNotification, UserNotificationRead
from app.db.models.study_plan import StudyTask
from app.db.models.enums import NotificationStatus
from app.routers.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", summary="Get Published Broadcast Notifications and User Notifications")
async def get_user_notifications(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    date: Optional[str] = Query(default=None, description="Filter by published date (YYYY-MM-DD)"),
    content_type: Optional[str] = Query(default=None, alias="contentType"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    User-facing endpoint:
    1. Returns a paginated list of published broadcast notifications sorted by publishedAt / createdAt DESC.
    2. Allows filtering by date and contentType.
    3. Also performs daily pending study task check and provides backward compatibility
       for the existing top header bell (unread_count & combined notification feed).
    """
    current_user_id = current_user.id
    # ── 1. Pending study tasks auto-check for the logged-in user ──
    today = datetime.now(timezone.utc).date()
    cutoff_date = today - timedelta(days=14)

    stmt_pending = select(StudyTask).where(
        StudyTask.user_id == current_user_id,
        StudyTask.scheduled_date >= cutoff_date,
        StudyTask.scheduled_date <= today,
        StudyTask.is_completed == False,
    )
    pending_tasks = (await session.exec(stmt_pending)).all()
    pending_count = len(pending_tasks)

    if pending_count > 0:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        stmt_existing = select(UserNotification).where(
            UserNotification.user_id == current_user_id,
            UserNotification.notification_type == "PENDING_TASKS",
            UserNotification.created_at >= today_start,
        )
        existing_noti = (await session.exec(stmt_existing)).first()

        if not existing_noti:
            noti = UserNotification(
                user_id=current_user_id,
                title=f"{pending_count} Daily Target(s) Remaining",
                message=f"You have {pending_count} pending study task(s) scheduled for today. Complete them to maintain your streak!",
                notification_type="PENDING_TASKS",
                action_url="/study-planner",
                is_read=False,
            )
            session.add(noti)
            await session.commit()
        else:
            new_title = f"{pending_count} Daily Target(s) Remaining"
            if existing_noti.title != new_title:
                existing_noti.title = new_title
                existing_noti.message = f"You have {pending_count} pending study task(s) scheduled for today. Complete them to maintain your streak!"
                session.add(existing_noti)
                await session.commit()

    # ── 2. Query published broadcast notifications ──
    base_stmt = select(Notification).where(Notification.status == NotificationStatus.PUBLISHED)
    count_stmt = select(func.count()).select_from(Notification).where(
        Notification.status == NotificationStatus.PUBLISHED
    )

    # Optional content type filter
    if content_type and content_type.strip().lower() != "all":
        ctype = content_type.strip().lower()
        base_stmt = base_stmt.where(Notification.content_type == ctype)
        count_stmt = count_stmt.where(Notification.content_type == ctype)

    # Optional date filter (YYYY-MM-DD)
    if date and date.strip():
        try:
            parsed_date = datetime.strptime(date.strip(), "%Y-%m-%d").date()
            start_dt = datetime.combine(parsed_date, datetime.min.time(), tzinfo=timezone.utc)
            end_dt = datetime.combine(parsed_date, datetime.max.time(), tzinfo=timezone.utc)
            base_stmt = base_stmt.where(
                Notification.published_at >= start_dt,
                Notification.published_at <= end_dt
            )
            count_stmt = count_stmt.where(
                Notification.published_at >= start_dt,
                Notification.published_at <= end_dt
            )
        except ValueError:
            pass  # Ignore invalid date formats gracefully

    total_broadcasts = (await session.exec(count_stmt)).one() or 0
    total_pages = max(1, (total_broadcasts + limit - 1) // limit)
    offset = (page - 1) * limit

    # Order by published_at DESC (falling back to created_at)
    ordered_stmt = (
        base_stmt.order_by(col(Notification.published_at).desc(), col(Notification.created_at).desc())
        .offset(offset)
        .limit(limit)
    )
    broadcast_notis = (await session.exec(ordered_stmt)).all()

    # Prefetch admin creators for clean display
    user_ids = {n.created_by_id for n in broadcast_notis if n.created_by_id}
    creator_map = {}
    if user_ids:
        users_stmt = select(User).where(User.id.in_(user_ids))
        users_found = (await session.exec(users_stmt)).all()
        for u in users_found:
            creator_map[u.id] = u.full_name or u.email

    items = [
        {
            "id": n.id,
            "title": n.title,
            "description": n.description,
            "contentType": str(n.content_type.value if hasattr(n.content_type, "value") else n.content_type),
            "link": n.link,
            "attachment": n.attachment,
            "status": str(n.status.value if hasattr(n.status, "value") else n.status),
            "createdBy": creator_map.get(n.created_by_id, "Admin Announcement"),
            "createdAt": n.created_at.isoformat() if n.created_at else None,
            "publishedAt": n.published_at.isoformat() if n.published_at else None,
        }
        for n in broadcast_notis
    ]

    # ── 3. Fetch user read notification IDs to ensure database-persisted read status ──
    stmt_reads = select(UserNotificationRead.notification_id).where(
        UserNotificationRead.user_id == current_user_id
    )
    user_read_ids = set((await session.exec(stmt_reads)).all())

    # Format feed for TopHeader bell dropdown:
    # Only notifications that are unread / not marked as read should appear in the dropdown.
    unread_feed = []

    # 3a. Recent published broadcast announcements (only unread ones)
    for b in broadcast_notis[:15]:
        b_key = f"broadcast_{b.id}"
        if b_key not in user_read_ids:
            ctype = str(b.content_type.value if hasattr(b.content_type, "value") else b.content_type)
            unread_feed.append({
                "id": b_key,
                "broadcast_id": b.id,
                "title": b.title,
                "message": b.description or "New announcement published.",
                "notification_type": f"ANNOUNCEMENT_{ctype.upper()}",
                "content_type": ctype,
                "action_url": f"/notifications/{b.id}",
                "is_read": False,
                "created_at": (b.published_at or b.created_at).isoformat() if (b.published_at or b.created_at) else None,
            })

    # 3b. User personal notifications (only unread ones)
    stmt_user_notis = (
        select(UserNotification)
        .where(
            UserNotification.user_id == current_user_id,
            UserNotification.is_read == False,
        )
        .order_by(col(UserNotification.created_at).desc())
        .limit(20)
    )
    personal_notis = (await session.exec(stmt_user_notis)).all()

    for p in personal_notis:
        p_key = str(p.id)
        if p_key not in user_read_ids:
            unread_feed.append({
                "id": p_key,
                "title": p.title,
                "message": p.message,
                "notification_type": p.notification_type,
                "action_url": p.action_url,
                "is_read": False,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            })

    # Sort combined feed by created_at DESC
    unread_feed.sort(
        key=lambda x: x["created_at"] if x["created_at"] else "",
        reverse=True,
    )

    unread_count = len(unread_feed)

    return JSONResponse(
        content=jsonable_encoder({
            "items": items,
            "total": total_broadcasts,
            "page": page,
            "pageSize": limit,
            "totalPages": total_pages,
            "unread_count": unread_count,
            "notifications": unread_feed,
        })
    )


@router.get("/{notification_id}", summary="Get Single Published Notification Detail")
async def get_published_notification_detail(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    User-facing endpoint to fetch details of a single published broadcast notification.
    Target destination for email notification links (/notifications/:id).
    Raises 404 if notification does not exist or is not published.
    """
    noti = await session.get(Notification, notification_id)
    if not noti:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification #{notification_id} not found."
        )

    current_status = str(noti.status.value if hasattr(noti.status, "value") else noti.status).lower()
    if current_status != "published":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification #{notification_id} is not currently available."
        )

    creator_name = "Admin Announcement"
    if noti.created_by_id:
        creator_user = await session.get(User, noti.created_by_id)
        if creator_user:
            creator_name = creator_user.full_name or creator_user.email

    return JSONResponse(
        content=jsonable_encoder({
            "id": noti.id,
            "title": noti.title,
            "description": noti.description,
            "contentType": str(noti.content_type.value if hasattr(noti.content_type, "value") else noti.content_type),
            "link": noti.link,
            "attachment": noti.attachment,
            "status": current_status,
            "createdBy": creator_name,
            "createdAt": noti.created_at.isoformat() if noti.created_at else None,
            "publishedAt": noti.published_at.isoformat() if noti.published_at else None,
        })
    )


@router.post("/{notification_id}/read", summary="Mark notification as read (persisted in DB)")
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Marks a single notification (personal or broadcast) as read in the database for current user.
    """
    notif_key = str(notification_id).strip()
    if not notif_key:
        return {"message": "Notification read acknowledged"}

    # 1. If numeric personal notification, update UserNotification is_read = True
    if notif_key.isdigit():
        nid = int(notif_key)
        noti = await session.get(UserNotification, nid)
        if noti and noti.user_id == current_user.id:
            noti.is_read = True
            session.add(noti)

    # 2. Record read receipt in user_notification_reads if not already present
    existing_read = (await session.exec(
        select(UserNotificationRead).where(
            UserNotificationRead.user_id == current_user.id,
            UserNotificationRead.notification_id == notif_key,
        )
    )).first()

    if not existing_read:
        read_record = UserNotificationRead(
            user_id=current_user.id,
            notification_id=notif_key,
        )
        session.add(read_record)

    await session.commit()
    return {"message": "Notification marked as read", "id": notif_key}


@router.post("/mark-all-read", summary="Mark all user notifications and active broadcasts as read")
@router.post("/clear-all", summary="Clear all notifications by marking them as read in DB")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Marks all personal notifications as read, and records read receipts for all published broadcast
    announcements so that the notification dropdown is completely cleared across page refreshes.
    """
    # 1. Mark all personal UserNotification records as is_read = True
    stmt_personal = select(UserNotification).where(
        UserNotification.user_id == current_user.id,
        UserNotification.is_read == False,
    )
    unread_personal = (await session.exec(stmt_personal)).all()
    for n in unread_personal:
        n.is_read = True
        session.add(n)

    # 2. Query already read IDs for this user
    stmt_reads = select(UserNotificationRead.notification_id).where(
        UserNotificationRead.user_id == current_user.id
    )
    existing_read_ids = set((await session.exec(stmt_reads)).all())

    # 3. Add read receipts for personal notifications
    for n in unread_personal:
        key = str(n.id)
        if key not in existing_read_ids:
            session.add(UserNotificationRead(user_id=current_user.id, notification_id=key))
            existing_read_ids.add(key)

    # 4. Add read receipts for all published broadcast announcements
    stmt_broadcasts = select(Notification.id).where(
        Notification.status == NotificationStatus.PUBLISHED
    )
    published_broadcast_ids = (await session.exec(stmt_broadcasts)).all()
    for b_id in published_broadcast_ids:
        b_key = f"broadcast_{b_id}"
        if b_key not in existing_read_ids:
            session.add(UserNotificationRead(user_id=current_user.id, notification_id=b_key))
            existing_read_ids.add(b_key)

    await session.commit()
    return {"message": "All notifications marked as read", "unread_count": 0}
