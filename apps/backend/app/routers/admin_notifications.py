import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks, UploadFile, File
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlmodel import select, col, func
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.session import get_async_session
from app.db.models.user import User
from app.db.models.enums import UserRole, NotificationContentType, NotificationStatus
from app.db.models.notification import Notification
from app.schemas.notification import (
    NotificationCreatePayload,
    NotificationUpdatePayload,
    NotificationResponse,
    NotificationListResponse,
)
from app.core.deps import require_roles
from app.services.email_service import dispatch_broadcast_notification_to_all_users
from app.config.logger import setup_logger

logger = setup_logger("AdminNotificationsRouter")

router = APIRouter(prefix="/admin/notifications", tags=["Admin Notifications"])


@router.post(
    "",
    response_model=NotificationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create New Broadcast Notification (Draft)",
)
async def create_notification(
    payload: NotificationCreatePayload,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    """
    Creates a new notification in draft status.
    Requires title and at least one of link or attachment.
    """
    noti = Notification(
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        content_type=str(payload.content_type.value if hasattr(payload.content_type, "value") else payload.content_type),
        link=payload.link.strip() if payload.link else None,
        attachment=payload.attachment.strip() if payload.attachment else None,
        status="draft",
        created_by_id=current_user.id,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        published_at=None,
    )

    creator_name = current_user.full_name or current_user.email

    session.add(noti)
    await session.commit()
    await session.refresh(noti)
    await _invalidate_notifications_cache()

    return NotificationResponse(
        id=noti.id,
        title=noti.title,
        description=noti.description,
        contentType=str(noti.content_type.value if hasattr(noti.content_type, "value") else noti.content_type),
        link=noti.link,
        attachment=noti.attachment,
        status=str(noti.status.value if hasattr(noti.status, "value") else noti.status),
        createdById=noti.created_by_id,
        createdBy=creator_name,
        createdAt=noti.created_at,
        updatedAt=noti.updated_at,
        publishedAt=noti.published_at,
    )


async def _invalidate_notifications_cache():
    try:
        from app.cache import get_cache
        cache = get_cache()
        await cache.delete_pattern("ep:admin:notifications:*")
        await cache.delete_pattern("ep:notifications:*")
    except Exception:
        pass


@router.get(
    "",
    response_model=NotificationListResponse,
    summary="List Admin Notifications with Pagination and Status Filter",
)
async def list_admin_notifications(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    """
    Returns a paginated list of all broadcast notifications, optionally filtered by status (draft, published, rejected).
    Sorted by createdAt DESC.
    """
    from app.cache import get_cache
    from fastapi.encoders import jsonable_encoder
    from fastapi.responses import JSONResponse

    cache = get_cache()
    sf = status_filter.strip().lower() if status_filter else "all"
    cache_key = f"ep:admin:notifications:list:{page}:{limit}:{sf}"
    cached_data = await cache.get(cache_key)
    if cached_data is not None:
        return JSONResponse(content=cached_data)

    stmt = select(Notification)
    count_stmt = select(func.count()).select_from(Notification)

    if status_filter and status_filter.strip().lower() != "all":
        target_status = status_filter.strip().lower()
        stmt = stmt.where(Notification.status == target_status)
        count_stmt = count_stmt.where(Notification.status == target_status)

    total = (await session.exec(count_stmt)).one() or 0
    total_pages = max(1, (total + limit - 1) // limit)
    offset = (page - 1) * limit

    stmt = stmt.order_by(col(Notification.created_at).desc()).offset(offset).limit(limit)
    notis = (await session.exec(stmt)).all()

    # Prefetch creators for clean display
    user_ids = {n.created_by_id for n in notis if n.created_by_id}
    creator_map = {}
    if user_ids:
        users_stmt = select(User).where(User.id.in_(user_ids))
        users_found = (await session.exec(users_stmt)).all()
        for u in users_found:
            creator_map[u.id] = u.full_name or u.email

    items = [
        NotificationResponse(
            id=n.id,
            title=n.title,
            description=n.description,
            contentType=str(n.content_type.value if hasattr(n.content_type, "value") else n.content_type),
            link=n.link,
            attachment=n.attachment,
            status=str(n.status.value if hasattr(n.status, "value") else n.status),
            createdById=n.created_by_id,
            createdBy=creator_map.get(n.created_by_id, "Admin"),
            createdAt=n.created_at,
            updatedAt=n.updated_at,
            publishedAt=n.published_at,
        )
        for n in notis
    ]

    resp_data = NotificationListResponse(
        items=items,
        total=total,
        page=page,
        pageSize=limit,
        totalPages=total_pages,
    )
    encoded = jsonable_encoder(resp_data)
    await cache.set(cache_key, encoded, ttl_seconds=180)
    return JSONResponse(content=encoded)


@router.get(
    "/{notification_id}",
    response_model=NotificationResponse,
    summary="Get Single Notification by ID (for Admin Edit View)",
)
async def get_admin_notification_detail(
    notification_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    noti = await session.get(Notification, notification_id)
    if not noti:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification #{notification_id} not found."
        )

    creator_name = "Admin"
    if noti.created_by_id:
        creator_user = await session.get(User, noti.created_by_id)
        if creator_user:
            creator_name = creator_user.full_name or creator_user.email

    return NotificationResponse(
        id=noti.id,
        title=noti.title,
        description=noti.description,
        contentType=str(noti.content_type.value if hasattr(noti.content_type, "value") else noti.content_type),
        link=noti.link,
        attachment=noti.attachment,
        status=str(noti.status.value if hasattr(noti.status, "value") else noti.status),
        createdById=noti.created_by_id,
        createdBy=creator_name,
        createdAt=noti.created_at,
        updatedAt=noti.updated_at,
        publishedAt=noti.published_at,
    )


@router.put(
    "/{notification_id}",
    response_model=NotificationResponse,
    summary="Update Notification Fields (Only allowed while in draft or rejected status)",
)
async def update_notification(
    notification_id: int,
    payload: NotificationUpdatePayload,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    noti = await session.get(Notification, notification_id)
    if not noti:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification #{notification_id} not found."
        )

    current_status = str(noti.status.value if hasattr(noti.status, "value") else noti.status).lower()
    if current_status == "published":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Published notifications cannot be edited. Create a new notification instead."
        )

    if payload.title is not None:
        noti.title = payload.title.strip()
    if payload.description is not None:
        noti.description = payload.description.strip() if payload.description else None
    if payload.content_type is not None:
        noti.content_type = str(payload.content_type.value if hasattr(payload.content_type, "value") else payload.content_type)
    if payload.link is not None:
        noti.link = payload.link.strip() if payload.link else None
    if payload.attachment is not None:
        noti.attachment = payload.attachment.strip() if payload.attachment else None

    # Validate that at least one of link or attachment is present
    has_link = bool(noti.link and noti.link.strip())
    has_attachment = bool(noti.attachment and noti.attachment.strip())
    if not has_link and not has_attachment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one of 'link' or 'attachment' must be present."
        )

    noti.updated_at = datetime.now(timezone.utc)
    session.add(noti)
    await session.commit()
    await session.refresh(noti)
    await _invalidate_notifications_cache()

    creator_name = "Admin"
    if noti.created_by_id:
        creator_user = await session.get(User, noti.created_by_id)
        if creator_user:
            creator_name = creator_user.full_name or creator_user.email

    return NotificationResponse(
        id=noti.id,
        title=noti.title,
        description=noti.description,
        contentType=str(noti.content_type.value if hasattr(noti.content_type, "value") else noti.content_type),
        link=noti.link,
        attachment=noti.attachment,
        status=str(noti.status.value if hasattr(noti.status, "value") else noti.status),
        createdById=noti.created_by_id,
        createdBy=creator_name,
        createdAt=noti.created_at,
        updatedAt=noti.updated_at,
        publishedAt=noti.published_at,
    )


@router.patch(
    "/{notification_id}/publish",
    response_model=NotificationResponse,
    summary="Publish Notification and Trigger Async Email Broadcast",
)
async def publish_notification(
    notification_id: int,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    """
    Transitions notification status to 'published', sets published_at timestamp,
    and schedules async background email dispatch to all active users.
    """
    noti = await session.get(Notification, notification_id)
    if not noti:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification #{notification_id} not found."
        )

    current_status = str(noti.status.value if hasattr(noti.status, "value") else noti.status).lower()
    if current_status == "published":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Notification is already published."
        )

    # Validate destination requirement
    has_link = bool(noti.link and noti.link.strip())
    has_attachment = bool(noti.attachment and noti.attachment.strip())
    if not has_link and not has_attachment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot publish notification without a valid 'link' or 'attachment'."
        )

    now = datetime.now(timezone.utc)
    noti.status = "published"
    noti.published_at = now
    noti.updated_at = now

    creator_name = current_user.full_name or current_user.email
    admin_email = current_user.email

    session.add(noti)
    await session.commit()
    await session.refresh(noti)
    await _invalidate_notifications_cache()

    # Queue background asynchronous email broadcasting
    background_tasks.add_task(dispatch_broadcast_notification_to_all_users, noti.id)
    logger.info(f"📢 Notification #{noti.id} published by {admin_email}. Queued email broadcast.")

    return NotificationResponse(
        id=noti.id,
        title=noti.title,
        description=noti.description,
        contentType=str(noti.content_type.value if hasattr(noti.content_type, "value") else noti.content_type),
        link=noti.link,
        attachment=noti.attachment,
        status="published",
        createdById=noti.created_by_id,
        createdBy=creator_name,
        createdAt=noti.created_at,
        updatedAt=noti.updated_at,
        publishedAt=noti.published_at,
    )


@router.patch(
    "/{notification_id}/reject",
    response_model=NotificationResponse,
    summary="Reject Notification",
)
async def reject_notification(
    notification_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    """
    Transitions notification status to 'rejected'.
    Cannot reject an already-published notification.
    """
    noti = await session.get(Notification, notification_id)
    if not noti:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification #{notification_id} not found."
        )

    current_status = str(noti.status.value if hasattr(noti.status, "value") else noti.status).lower()
    if current_status == "published":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot reject an already published notification."
        )

    now = datetime.now(timezone.utc)
    noti.status = "rejected"
    noti.updated_at = now

    session.add(noti)
    await session.commit()
    await session.refresh(noti)
    await _invalidate_notifications_cache()

    creator_name = "Admin"
    if noti.created_by_id:
        creator_user = await session.get(User, noti.created_by_id)
        if creator_user:
            creator_name = creator_user.full_name or creator_user.email

    return NotificationResponse(
        id=noti.id,
        title=noti.title,
        description=noti.description,
        contentType=str(noti.content_type.value if hasattr(noti.content_type, "value") else noti.content_type),
        link=noti.link,
        attachment=noti.attachment,
        status="rejected",
        createdById=noti.created_by_id,
        createdBy=creator_name,
        createdAt=noti.created_at,
        updatedAt=noti.updated_at,
        publishedAt=noti.published_at,
    )


@router.delete(
    "/{notification_id}",
    summary="Delete Notification",
)
async def delete_notification(
    notification_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    noti = await session.get(Notification, notification_id)
    if not noti:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification #{notification_id} not found."
        )

    # Clean up attachment file if it's stored locally
    if noti.attachment and noti.attachment.startswith("/static/uploads/notifications/"):
        rel_path = noti.attachment.replace("/static/uploads/", "", 1)
        full_path = Path("uploads") / rel_path
        if full_path.exists() and full_path.is_file():
            try:
                full_path.unlink()
            except Exception as e:
                logger.warning(f"Could not delete attachment file {full_path}: {e}")

    await session.delete(noti)
    await session.commit()
    await _invalidate_notifications_cache()

    return {"message": f"Notification #{notification_id} deleted successfully.", "id": notification_id}


@router.post(
    "/upload",
    summary="Upload PDF or Document Attachment for Notification",
)
async def upload_notification_attachment(
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    """
    Accepts file upload (PDF or document), saves into uploads/notifications/,
    and returns accessible static URL.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded.")

    # Sanitize extension
    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()
    allowed_extensions = {".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg", ".zip"}
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"File extension '{ext}' is not supported. Allowed: {', '.join(allowed_extensions)}"
        )

    target_dir = Path("uploads") / "notifications"
    target_dir.mkdir(parents=True, exist_ok=True)

    safe_name = f"{uuid.uuid4().hex[:10]}_{Path(filename).name}"
    dest_path = target_dir / safe_name

    content = await file.read()
    with open(dest_path, "wb") as f:
        f.write(content)

    public_url = f"/static/uploads/notifications/{safe_name}"
    return {
        "url": public_url,
        "filename": filename,
        "size_bytes": len(content),
    }
