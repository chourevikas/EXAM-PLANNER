import os
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from svix.webhooks import Webhook, WebhookVerificationError
from sqlalchemy import select

from app.config.settings import get_settings
from app.cache.factory import get_cache
from app.cache.helpers import invalidate_user_cache
from app.db.session import get_db
from app.db.models.user import User, StudentProfile
from app.db.models.enums import UserRole, UserStatus
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

@router.post("/clerk")
async def clerk_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    secret = os.getenv("CLERK_WEBHOOK_SECRET")
    if not secret:
        raise HTTPException(status_code=500, detail="Webhook secret not configured")
    
    payload = await request.body()
    headers = request.headers
    
    svix_id = headers.get("svix-id")
    svix_timestamp = headers.get("svix-timestamp")
    svix_signature = headers.get("svix-signature")
    
    if not svix_id or not svix_timestamp or not svix_signature:
        raise HTTPException(status_code=400, detail="Missing Svix headers")
        
    webhook = Webhook(secret)
    try:
        event = webhook.verify(payload, headers)
    except WebhookVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
        
    if not event or not isinstance(event, dict):
        raise HTTPException(status_code=400, detail="Invalid webhook event payload")

    # Domain 26 Idempotency Check: ep:webhook:idempotency:<svix_id> (TTL: 86400s)
    cache = get_cache()
    settings = get_settings()
    prefix = settings.CACHE_KEY_PREFIX or "ep"
    idempotency_key = f"{prefix}:webhook:idempotency:{svix_id}"

    if await cache.get(idempotency_key):
        logger.info("Webhook %s already processed; skipping duplicate", svix_id)
        return {"status": "already_processed"}
        
    event_type = event.get("type")
    data = event.get("data", {})
    
    if event_type == "user.created":
        email_addresses = data.get("email_addresses", [])
        email = email_addresses[0].get("email_address") if email_addresses else None
        if not email:
            return {"status": "ignored", "reason": "No email address"}
            
        first_name = data.get("first_name") or ""
        last_name = data.get("last_name") or ""
        full_name = f"{first_name} {last_name}".strip() or "Clerk User"
        
        clerk_id = data.get("id")
        image_url = data.get("image_url")
        
        # Check if user already exists by clerk_id or email
        existing = await db.exec(select(User).where((User.clerk_id == clerk_id) | (User.email == email)))
        user = existing.first()
        
        if not user:
            # Create new user
            user = User(
                email=email,
                clerk_id=clerk_id,
                full_name=full_name,
                profile_image=image_url,
                role=UserRole.STUDENT,
                status=UserStatus.ACTIVE,
                is_verified=True
            )
            db.add(user)
            await db.flush()
            
            # Create StudentProfile
            student_profile = StudentProfile(user_id=user.id)
            db.add(student_profile)
            await db.commit()
        else:
            # Update existing user with clerk_id if missing
            if not user.clerk_id and clerk_id:
                user.clerk_id = clerk_id
            if image_url:
                user.profile_image = image_url
            if full_name and full_name != "Clerk User":
                user.full_name = full_name
            await db.commit()

        if user.id:
            await invalidate_user_cache(user.id, user.clerk_id)

    elif event_type == "user.updated":
        clerk_id = data.get("id")
        email_addresses = data.get("email_addresses", [])
        email = email_addresses[0].get("email_address") if email_addresses else None
        first_name = data.get("first_name") or ""
        last_name = data.get("last_name") or ""
        full_name = f"{first_name} {last_name}".strip()
        image_url = data.get("image_url")

        existing = await db.exec(select(User).where((User.clerk_id == clerk_id) | (User.email == email)))
        user = existing.first()
        if user:
            if email and user.email != email:
                user.email = email
            if full_name:
                user.full_name = full_name
            if image_url:
                user.profile_image = image_url
            if not user.clerk_id and clerk_id:
                user.clerk_id = clerk_id
            await db.commit()
            if user.id:
                await invalidate_user_cache(user.id, user.clerk_id)

    elif event_type == "user.deleted":
        clerk_id = data.get("id")
        if clerk_id:
            existing = await db.exec(select(User).where(User.clerk_id == clerk_id))
            user = existing.first()
            if user:
                user.status = UserStatus.DELETED
                await db.commit()
                if user.id:
                    await invalidate_user_cache(user.id, user.clerk_id)

    # Record idempotency token for 24h
    await cache.set(idempotency_key, "1", ttl_seconds=86400)
    return {"status": "success"}
