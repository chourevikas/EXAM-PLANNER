import os
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from svix.webhooks import Webhook, WebhookVerificationError
from sqlalchemy import select

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
            if not user.clerk_id:
                user.clerk_id = clerk_id
            if image_url:
                user.profile_image = image_url
            await db.commit()
            
    return {"status": "success"}
