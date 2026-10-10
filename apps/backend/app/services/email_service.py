import logging
from typing import Optional, List
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
from app.config.settings import settings
from app.config.logger import setup_logger

logger = setup_logger("EmailService")

def get_fastmail_config() -> ConnectionConfig:
    """Builds FastMail ConnectionConfig dynamically from current settings."""
    return ConnectionConfig(
        MAIL_USERNAME=settings.MAIL_USERNAME or "",
        MAIL_PASSWORD=settings.MAIL_PASSWORD or "",
        MAIL_FROM=settings.MAIL_FROM,
        MAIL_PORT=settings.MAIL_PORT,
        MAIL_SERVER=settings.MAIL_SERVER,
        MAIL_STARTTLS=settings.MAIL_STARTTLS,
        MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
        USE_CREDENTIALS=bool(settings.MAIL_USERNAME and settings.MAIL_PASSWORD),
        VALIDATE_CERTS=True
    )

async def _send_via_aws_ses(recipients: list[str], subject: str, html_body: str) -> bool:
    """Fallback email dispatcher using AWS SES if SMTP credentials are not configured."""
    if not (settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY):
        logger.warning("AWS SES skipped: AWS credentials not configured.")
        return False
    try:
        import boto3
        client = boto3.client(
            'ses',
            region_name=settings.AWS_REGION or 'ap-southeast-2',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY
        )
        sender = settings.MAIL_FROM or settings.AWS_SES_SENDER or "support@examplanner.in"
        response = client.send_email(
            Destination={'ToAddresses': recipients},
            Message={
                'Body': {
                    'Html': {'Charset': 'UTF-8', 'Data': html_body}
                },
                'Subject': {'Charset': 'UTF-8', 'Data': subject}
            },
            Source=sender
        )
        logger.info(f"Email sent via AWS SES to {recipients}. MessageId: {response.get('MessageId')}")
        return True
    except Exception as e:
        logger.warning(f"AWS SES send FAILED for {recipients}: {e}")
        return False

async def send_subscription_confirmation(email: EmailStr, user_name: str):
    """Sends a confirmation email to the user when they successfully upgrade to premium."""
    
    html = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center;">
                <h2 style="color: #4F46E5;">Welcome to Premium, {user_name}! 🚀</h2>
            </div>
            
            <p>Your payment was successful and your <strong>Premium Access</strong> to ExamPlanner is now fully active.</p>
            <p>You can now instantly access all Mock Tests, advanced AI Analytics, and personalized study planning.</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://examplanner.in/dashboard" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Go to Dashboard</a>
            </div>
            
            <p>Happy studying!</p>
            <br>
            <p style="color: #666; font-size: 14px;">The ExamPlanner Team</p>
        </body>
    </html>
    """
    
    message = MessageSchema(
        subject="Your ExamPlanner Premium Subscription is Active! 🎉",
        recipients=[email],
        body=html,
        subtype=MessageType.html
    )
    
    try:
        if settings.MAIL_USERNAME and settings.MAIL_PASSWORD:
            fm = FastMail(get_fastmail_config())
            await fm.send_message(message)
            logger.info(f"Subscription confirmation email successfully sent to {email}")
            return True
        
        ses_ok = await _send_via_aws_ses([str(email)], message.subject, html)
        if ses_ok:
            return True

        logger.info(f"📧 [DEV] Subscription confirmation email simulated for {email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send subscription confirmation email: {e}")
        return False


async def send_pending_tasks_summary_email(email: EmailStr, user_name: str, pending_tasks: list):
    """Sends an end-of-day email notification listing all pending uncompleted tasks for the day."""
    if not pending_tasks:
        return True

    html = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #FEF3C7; padding: 20px; border-radius: 8px; text-align: center; border-left: 5px solid #F59E0B;">
                <h2 style="color: #B45309; margin: 0;">📅 Daily Study Reminder: {len(pending_tasks)} Pending Task(s)</h2>
            </div>
            
            <p>Hi <strong>{user_name}</strong>,</p>
            <p>You have <strong>{len(pending_tasks)} study task(s)</strong> remaining for today. Keep up the momentum for your target exam!</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{settings.FRONTEND_URL}/study-planner" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Open Study Planner</a>
            </div>
            
            <p>Stay consistent and crush your goals!</p>
            <br>
            <p style="color: #666; font-size: 14px;">The ExamPlanner Team</p>
        </body>
    </html>
    """

    message = MessageSchema(
        subject=f"Daily Study Summary: {len(pending_tasks)} Pending Tasks for Today 🎯",
        recipients=[email],
        body=html,
        subtype=MessageType.html
    )

    try:
        if settings.MAIL_USERNAME and settings.MAIL_PASSWORD:
            fm = FastMail(get_fastmail_config())
            await fm.send_message(message)
            logger.info(f"Pending tasks email sent successfully via SMTP to {email}")
            return True

        ses_ok = await _send_via_aws_ses([str(email)], message.subject, html)
        if ses_ok:
            return True

        logger.info(f"📧 [DEV] Pending tasks email dispatch simulated for {email}: {len(pending_tasks)} tasks.")
        return True
    except Exception as e:
        logger.error(f"Failed to send pending tasks email: {e}")
        return False


async def send_admin_notification_subscription(user_email: str, user_name: str):
    """Sends a notification email to the admin when a user successfully upgrades to premium."""
    
    html = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #2E7D32;">New Subscription Alert 💰</h2>
            <p>A user has successfully paid and been automatically upgraded to Premium.</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #2E7D32; margin-bottom: 20px;">
                <p style="margin: 5px 0;"><strong>Name:</strong> {user_name}</p>
                <p style="margin: 5px 0;"><strong>Email:</strong> {user_email}</p>
            </div>
            <p>No manual action is required; this is an automated audit log for your records.</p>
        </body>
    </html>
    """
    
    admin_email = settings.SUPERADMIN_EMAIL
    
    message = MessageSchema(
        subject=f"New Premium Subscriber: {user_name}",
        recipients=[admin_email],
        body=html,
        subtype=MessageType.html
    )
    
    try:
        if settings.MAIL_USERNAME and settings.MAIL_PASSWORD:
            fm = FastMail(get_fastmail_config())
            await fm.send_message(message)
            logger.info(f"Admin notification email successfully sent to {admin_email} for user {user_email}")
            return True
            
        ses_ok = await _send_via_aws_ses([str(admin_email)], message.subject, html)
        if ses_ok:
            return True

        logger.info(f"📧 [DEV] Admin notification email simulated for {admin_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send admin notification email: {e}")
        return False

async def send_admin_alert_email(recipients: List[str], subject: str, html: str) -> bool:
    """Sends an operational alert (e.g. pipeline failure) to admin recipients."""
    message = MessageSchema(
        subject=subject,
        recipients=recipients,
        body=html,
        subtype=MessageType.html
    )

    try:
        if settings.MAIL_USERNAME and settings.MAIL_PASSWORD:
            fm = FastMail(get_fastmail_config())
            await fm.send_message(message)
            logger.info(f"Admin alert email sent to {recipients}: {subject}")
            return True

        ses_ok = await _send_via_aws_ses(recipients, subject, html)
        if ses_ok:
            return True

        logger.info(f"📧 [DEV] Admin alert email simulated for {recipients}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send admin alert email to {recipients}: {e}")
        return False

async def send_verification_email(email: str, token: str):
    """Dispatches a magic verification link to verify user email address."""
    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    
    html = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #4F46E5; padding: 24px; border-radius: 12px; text-align: center; color: white;">
                <h2 style="margin: 0; font-size: 22px;">Verify Your Email Address ✉️</h2>
                <p style="margin: 8px 0 0 0; opacity: 0.9;">ExamPlanner AI Mentorship Platform</p>
            </div>
            
            <p style="margin-top: 24px;">Welcome to ExamPlanner!</p>
            <p>Please confirm your email address to activate your account and start your personalized AI study plan.</p>
            
            <div style="text-align: center; margin: 32px 0;">
                <a href="{verify_url}" style="background-color: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Verify Email Address</a>
            </div>
            
            <p style="color: #666; font-size: 13px;">If you didn't create an account with ExamPlanner, you can safely ignore this email.</p>
            <p style="color: #666; font-size: 12px; word-break: break-all;">Link: <a href="{verify_url}">{verify_url}</a></p>
            <br>
            <p style="color: #888; font-size: 13px;">The ExamPlanner Team</p>
        </body>
    </html>
    """
    
    message = MessageSchema(
        subject="Verify your ExamPlanner email address ✉️",
        recipients=[email],
        body=html,
        subtype=MessageType.html
    )
    
    try:
        if settings.MAIL_USERNAME and settings.MAIL_PASSWORD:
            fm = FastMail(get_fastmail_config())
            await fm.send_message(message)
            logger.info(f"Verification email sent successfully to {email}")
            return True

        ses_ok = await _send_via_aws_ses([str(email)], message.subject, html)
        if ses_ok:
            return True

        logger.info(f"📧 [DEV] Verification email link simulated for {email}: {verify_url}")
        return True
    except Exception as e:
        logger.error(f"Failed to send verification email: {e}")
        return False


async def send_password_reset_email(email: str, token: str):
    """Dispatches a password reset link to user email address."""
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    
    html = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #DC2626; padding: 24px; border-radius: 12px; text-align: center; color: white;">
                <h2 style="margin: 0; font-size: 22px;">Reset Your Password 🔒</h2>
            </div>
            
            <p style="margin-top: 24px;">We received a request to reset your password for your ExamPlanner account.</p>
            
            <div style="text-align: center; margin: 32px 0;">
                <a href="{reset_url}" style="background-color: #DC2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
            </div>
            
            <p style="color: #666; font-size: 13px;">If you didn't request a password reset, please ignore this email.</p>
        </body>
    </html>
    """
    
    message = MessageSchema(
        subject="Reset your ExamPlanner password 🔒",
        recipients=[email],
        body=html,
        subtype=MessageType.html
    )
    
    try:
        if settings.MAIL_USERNAME and settings.MAIL_PASSWORD:
            fm = FastMail(get_fastmail_config())
            await fm.send_message(message)
            logger.info(f"Password reset email sent successfully to {email}")
            return True

        logger.info("SMTP not configured (MAIL_USERNAME/MAIL_PASSWORD); trying AWS SES for password reset.")
        ses_ok = await _send_via_aws_ses([str(email)], message.subject, html)
        if ses_ok:
            return True

        # Only simulate delivery (and print the link) for a local frontend. Anywhere
        # else a reset token in logs would let anyone with log access take over accounts.
        if "localhost" in settings.FRONTEND_URL or "127.0.0.1" in settings.FRONTEND_URL:
            logger.warning(f"📧 [DEV] Email not delivered; password reset link simulated for {email}: {reset_url}")
            return True

        logger.error(f"Password reset email NOT delivered to {email}: SMTP not configured and SES failed.")
        return False
    except Exception as e:
        logger.error(f"Failed to send password reset email: {e}")
        return False



async def send_staff_welcome_email(email: str, user_name: str, role_label: str, temp_password: str):
    """Emails a newly created staff member their temporary password. Never logs the password."""
    from html import escape

    login_url = f"{settings.FRONTEND_URL}/signin"
    html = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #DC2626; padding: 24px; border-radius: 12px; text-align: center; color: white;">
                <h2 style="margin: 0; font-size: 22px;">Welcome to ExamPlanner</h2>
            </div>

            <p style="margin-top: 24px;">Hi {escape(user_name)},</p>
            <p>A Super Admin has created an ExamPlanner <strong>{escape(role_label)}</strong> account for you.</p>

            <p style="margin-bottom: 4px;">Sign in with this email address and the temporary password below:</p>
            <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center; font-family: monospace; font-size: 20px; letter-spacing: 1px;">{escape(temp_password)}</div>

            <p style="margin-top: 20px;">You will be asked to choose a new password the first time you sign in. The temporary password stops working after that.</p>

            <div style="text-align: center; margin: 32px 0;">
                <a href="{login_url}" style="background-color: #DC2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Sign in</a>
            </div>

            <p style="color: #666; font-size: 13px;">If you weren't expecting this email, please ignore it or contact support.</p>
        </body>
    </html>
    """

    message = MessageSchema(
        subject="Your ExamPlanner account is ready",
        recipients=[email],
        body=html,
        subtype=MessageType.html
    )

    try:
        if settings.MAIL_USERNAME and settings.MAIL_PASSWORD:
            fm = FastMail(get_fastmail_config())
            await fm.send_message(message)
            logger.info(f"Staff welcome email sent successfully to {email}")
            return True

        ses_ok = await _send_via_aws_ses([str(email)], message.subject, html)
        if ses_ok:
            return True

        # Dev fallback: no mail transport configured. Deliberately does not log the password.
        logger.info(f"📧 [DEV] Staff welcome email simulated for {email} (no mail transport configured)")
        return True
    except Exception as e:
        logger.error(f"Failed to send staff welcome email to {email}: {e}")
        return False


async def send_broadcast_notification_email(
    email: str,
    user_name: str,
    notification_id: int,
    title: str,
    description: Optional[str] = None,
    content_type: str = "other",
    action_url: Optional[str] = None,
) -> bool:
    """Dispatches a broadcast announcement email to a user."""
    detail_url = action_url or f"{settings.FRONTEND_URL}/notifications/{notification_id}"
    excerpt = (description[:240] + "...") if description and len(description) > 240 else (description or "")

    type_colors = {
        "video": "#DC2626",
        "pdf": "#2563EB",
        "article": "#059669",
        "other": "#4F46E5"
    }
    badge_color = type_colors.get(content_type.lower(), "#4F46E5")
    type_label = content_type.upper()

    html = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #172033; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #F8FAFC;">
            <div style="background-color: #172033; padding: 24px; border-radius: 8px 8px 0 0; text-align: center; color: white;">
                <span style="display: inline-block; background-color: {badge_color}; color: white; padding: 4px 10px; font-size: 11px; font-weight: bold; text-transform: uppercase; border-radius: 4px; margin-bottom: 8px;">
                    {type_label} ANNOUNCEMENT
                </span>
                <h2 style="margin: 6px 0 0 0; font-size: 20px; font-weight: 700; color: #FFFFFF;">{title}</h2>
            </div>
            
            <div style="background-color: #FFFFFF; padding: 24px; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 8px 8px;">
                <p>Hello <strong>{user_name}</strong>,</p>
                <p>A new announcement has been published on the <strong>ExamPlanner Mentorship Platform</strong>:</p>
                
                <div style="background-color: #F8FAFC; border-left: 4px solid {badge_color}; padding: 14px 16px; margin: 20px 0; border-radius: 0 4px 4px 0;">
                    <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #111111;">{title}</h3>
                    <p style="margin: 0; color: #475569; font-size: 14px; white-space: pre-line;">{excerpt}</p>
                </div>
                
                <div style="text-align: center; margin: 28px 0;">
                    <a href="{detail_url}" style="background-color: #E31B23; color: white; padding: 12px 28px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 14px; display: inline-block;">
                        View Announcement
                    </a>
                </div>
                
                <p style="color: #64748B; font-size: 12px; margin-top: 24px; border-top: 1px solid #E2E8F0; padding-top: 16px;">
                    If the button above does not work, visit: <br>
                    <a href="{detail_url}" style="color: #E31B23; word-break: break-all;">{detail_url}</a>
                </p>
                <p style="color: #94A3B8; font-size: 12px; margin-top: 8px;">
                    You are receiving this email because you are a registered student or mentor on ExamPlanner.
                </p>
            </div>
        </body>
    </html>
    """

    message = MessageSchema(
        subject=f"📢 Announcement: {title}",
        recipients=[email],
        body=html,
        subtype=MessageType.html
    )

    try:
        if settings.MAIL_USERNAME and settings.MAIL_PASSWORD:
            fm = FastMail(get_fastmail_config())
            await fm.send_message(message)
            logger.info(f"Broadcast notification email sent to {email} for notification #{notification_id}")
            return True

        ses_ok = await _send_via_aws_ses([str(email)], message.subject, html)
        if ses_ok:
            return True

        logger.info(f"📧 [DEV] Broadcast notification email simulated for {email}: {title} (ID #{notification_id})")
        return True
    except Exception as e:
        logger.error(f"Failed to send broadcast notification email to {email}: {e}")
        return False


async def dispatch_broadcast_notification_to_all_users(notification_id: int):
    """
    Background worker that queries active users and sends announcement email dispatches
    with bounded concurrency.
    """
    import asyncio
    from sqlmodel import select
    from app.db.session import async_session_factory
    from app.db.models.notification import Notification
    from app.db.models.user import User, UserStatus

    logger.info(f"🚀 Starting background email broadcast for notification #{notification_id}...")

    async with async_session_factory() as session:
        noti = await session.get(Notification, notification_id)
        if not noti:
            logger.warning(f"Notification #{notification_id} not found. Aborting broadcast dispatch.")
            return

        if noti.status != "published":
            logger.warning(f"Notification #{notification_id} status is '{noti.status}' (not published). Aborting dispatch.")
            return

        # Query all active users
        stmt = select(User).where(User.status == UserStatus.ACTIVE)
        users = (await session.exec(stmt)).all()

    if not users:
        logger.info("No active users found for broadcast notification email dispatch.")
        return

    logger.info(f"Dispatching announcement #{notification_id} '{noti.title}' to {len(users)} active users...")

    # Limit concurrent mail sends to 5 to protect pool / connections
    semaphore = asyncio.Semaphore(5)

    async def _send_with_semaphore(user_obj: User):
        async with semaphore:
            if not user_obj.email:
                return False
            name = user_obj.full_name or "Student"
            return await send_broadcast_notification_email(
                email=user_obj.email,
                user_name=name,
                notification_id=noti.id,
                title=noti.title,
                description=noti.description,
                content_type=str(noti.content_type.value if hasattr(noti.content_type, 'value') else noti.content_type),
            )

    results = await asyncio.gather(*[_send_with_semaphore(u) for u in users], return_exceptions=True)
    success_count = sum(1 for r in results if r is True)
    logger.info(f"✅ Finished broadcast dispatch for notification #{notification_id}: {success_count}/{len(users)} emails successfully handled.")


class AppEmailService:
    async def send_verification_email(self, email: str, token: str):
        return await send_verification_email(email, token)
        
    async def send_staff_welcome_email(self, email: str, user_name: str, role_label: str, temp_password: str):
        return await send_staff_welcome_email(email, user_name, role_label, temp_password)

    async def send_password_reset_email(self, email: str, token: str):
        return await send_password_reset_email(email, token)

    async def send_broadcast_notification(self, email: str, user_name: str, notification_id: int, title: str, description: Optional[str] = None, content_type: str = "other"):
        return await send_broadcast_notification_email(email, user_name, notification_id, title, description, content_type)

    async def dispatch_broadcast(self, notification_id: int):
        return await dispatch_broadcast_notification_to_all_users(notification_id)

EmailService = AppEmailService
email_service = AppEmailService()

