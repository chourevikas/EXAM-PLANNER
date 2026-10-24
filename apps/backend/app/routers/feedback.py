"""'Report a problem': students send feedback from any page; admins read and close it."""
import asyncio
import io
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config.logger import setup_logger
from app.config.settings import settings
from app.core.deps import get_current_user, require_admin_section
from app.db.models.feedback import UserFeedback
from app.db.models.user import User
from app.db.session import get_async_session
from app.services.free_plan import ist_day_bounds

logger = setup_logger("Feedback")

router = APIRouter(tags=["Feedback"])
feedback_admin = require_admin_section("admin.feedback")

FeedbackCategory = Literal["BUG", "CONTENT", "IDEA", "OTHER"]
CATEGORY_LABELS = {"BUG": "Something is broken", "CONTENT": "Question or content", "IDEA": "Suggestion", "OTHER": "Other"}

DAILY_LIMIT = 10
MAX_MESSAGE = 4000
MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024
MAX_SCREENSHOT_SIDE = 1920


class ActionPayload(BaseModel):
    note: Optional[str] = Field(default=None, max_length=2000)


def _clean(text: Optional[str], limit: int) -> Optional[str]:
    text = (text or "").strip()
    return text[:limit] or None


async def _store_screenshot(upload: UploadFile) -> str:
    """Re-encode the upload as JPEG: proves it is an image and drops anything else it carried."""
    data = await upload.read(MAX_SCREENSHOT_BYTES + 1)
    if len(data) > MAX_SCREENSHOT_BYTES:
        raise HTTPException(status_code=413, detail="The screenshot is too large (5 MB at most).")

    from PIL import Image, UnidentifiedImageError

    def _decode() -> Image.Image:
        img = Image.open(io.BytesIO(data))
        img.load()
        img = img.convert("RGB")
        img.thumbnail((MAX_SCREENSHOT_SIDE, MAX_SCREENSHOT_SIDE))
        return img

    try:
        image = await asyncio.to_thread(_decode)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise HTTPException(status_code=422, detail="The screenshot must be a PNG, JPEG or WebP image.")

    from app.storage.factory import get_storage_provider

    return await get_storage_provider().save_image(image, f"feedback/{uuid.uuid4().hex}.jpg")


async def _notify(feedback_id: int, category: str, message: str, page_url: Optional[str], user: str, screenshot: bool):
    from app.services.ops_alerts import send_discord_alert

    await send_discord_alert(
        f"Feedback #{feedback_id}: {CATEGORY_LABELS.get(category, category)}",
        message,
        {
            "From": user,
            "Page": page_url or "—",
            "Screenshot": "yes" if screenshot else "no",
            "Open": f"{settings.FRONTEND_URL.rstrip('/')}/admin",
        },
    )


# ── Student ──────────────────────────────────────────────────────────────────

@router.post("/feedback", status_code=status.HTTP_201_CREATED)
async def send_feedback(
    background_tasks: BackgroundTasks,
    category: FeedbackCategory = Form(...),
    message: str = Form(..., max_length=MAX_MESSAGE),
    page_url: Optional[str] = Form(default=None),
    screenshot: Optional[UploadFile] = File(default=None),
    user_agent: Optional[str] = Form(default=None),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    text = _clean(message, MAX_MESSAGE)
    if not text or len(text) < 5:
        raise HTTPException(status_code=422, detail="Please describe the problem in a few words.")

    start, end = ist_day_bounds()
    sent_today = (
        await session.exec(
            select(func.count(UserFeedback.id)).where(
                UserFeedback.user_id == current_user.id,
                UserFeedback.created_at >= start,
                UserFeedback.created_at < end,
            )
        )
    ).one() or 0
    if sent_today >= DAILY_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="You've sent a lot of reports today. Thank you! Please try again tomorrow.",
        )

    screenshot_path = await _store_screenshot(screenshot) if screenshot and screenshot.filename else None

    feedback = UserFeedback(
        user_id=current_user.id,
        category=category,
        message=text,
        page_url=_clean(page_url, 500),
        user_agent=_clean(user_agent, 300),
        screenshot_path=screenshot_path,
    )
    session.add(feedback)
    await session.commit()
    await session.refresh(feedback)

    background_tasks.add_task(
        _notify,
        feedback.id,
        category,
        text,
        feedback.page_url,
        f"{current_user.full_name or 'Student'} (#{current_user.id})",
        bool(screenshot_path),
    )
    return {"id": feedback.id, "status": feedback.status}


# ── Admin ────────────────────────────────────────────────────────────────────

@router.get("/admin/feedback/summary")
async def feedback_summary(
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(feedback_admin),
):
    open_count = (
        await session.exec(select(func.count(UserFeedback.id)).where(UserFeedback.status == "OPEN"))
    ).one() or 0
    return {"open": open_count}


@router.get("/admin/feedback")
async def list_feedback(
    feedback_status: Literal["OPEN", "RESOLVED", "DISMISSED", "ALL"] = Query(default="OPEN", alias="status"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(feedback_admin),
):
    where = [] if feedback_status == "ALL" else [UserFeedback.status == feedback_status]
    total = (await session.exec(select(func.count(UserFeedback.id)).where(*where))).one() or 0
    rows = (
        await session.exec(
            select(UserFeedback, User.full_name, User.email)
            .join(User, User.id == UserFeedback.user_id)
            .where(*where)
            .order_by(UserFeedback.created_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
    ).all()
    items = [
        {
            "id": fb.id,
            "category": fb.category,
            "message": fb.message,
            "page_url": fb.page_url,
            "user_agent": fb.user_agent,
            "has_screenshot": bool(fb.screenshot_path),
            "status": fb.status,
            "admin_note": fb.admin_note,
            "created_at": fb.created_at,
            "resolved_at": fb.resolved_at,
            "user": {"id": fb.user_id, "name": name, "email": email},
        }
        for fb, name, email in rows
    ]
    return {"items": items, "total": total, "page": page, "limit": limit}


@router.get("/admin/feedback/{feedback_id}/screenshot")
async def feedback_screenshot(
    feedback_id: int,
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(feedback_admin),
):
    feedback = await session.get(UserFeedback, feedback_id)
    if not feedback or not feedback.screenshot_path:
        raise HTTPException(status_code=404, detail="No screenshot for this report.")

    from app.storage.factory import get_storage_provider

    tmp = Path("./temp_uploads").resolve() / f"feedback-{uuid.uuid4().hex}.jpg"
    try:
        await get_storage_provider().download_file(feedback.screenshot_path, tmp)
        data = await asyncio.to_thread(tmp.read_bytes)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="The screenshot file is missing.")
    finally:
        tmp.unlink(missing_ok=True)
    return Response(content=data, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=3600"})


async def _close(
    session: AsyncSession, feedback_id: int, new_status: str, note: Optional[str], admin: User
) -> UserFeedback:
    feedback = await session.get(UserFeedback, feedback_id)
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found.")
    feedback.status = new_status
    feedback.admin_note = _clean(note, 2000)
    feedback.resolved_by_id = admin.id
    feedback.resolved_at = datetime.now(timezone.utc)
    session.add(feedback)
    await session.commit()
    return feedback


@router.post("/admin/feedback/{feedback_id}/resolve")
async def resolve_feedback(
    feedback_id: int,
    payload: ActionPayload,
    session: AsyncSession = Depends(get_async_session),
    admin: User = Depends(feedback_admin),
):
    feedback = await _close(session, feedback_id, "RESOLVED", payload.note, admin)
    return {"id": feedback.id, "status": feedback.status}


@router.post("/admin/feedback/{feedback_id}/dismiss")
async def dismiss_feedback(
    feedback_id: int,
    payload: ActionPayload,
    session: AsyncSession = Depends(get_async_session),
    admin: User = Depends(feedback_admin),
):
    feedback = await _close(session, feedback_id, "DISMISSED", payload.note, admin)
    return {"id": feedback.id, "status": feedback.status}


@router.post("/admin/feedback/{feedback_id}/reopen")
async def reopen_feedback(
    feedback_id: int,
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(feedback_admin),
):
    feedback = await session.get(UserFeedback, feedback_id)
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found.")
    feedback.status = "OPEN"
    feedback.resolved_by_id = None
    feedback.resolved_at = None
    session.add(feedback)
    await session.commit()
    return {"id": feedback.id, "status": feedback.status}
