import logging
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
from app.config.settings import settings

logger = logging.getLogger(__name__)

# Initialize the FastMail configuration using our Settings from Hostinger
conf = ConnectionConfig(
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
        if not settings.MAIL_USERNAME:
            logger.warning("MAIL_USERNAME is not set in environment. Skipping email sending.")
            return False
            
        fm = FastMail(conf)
        await fm.send_message(message)
        logger.info(f"Subscription confirmation email successfully sent to {email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send subscription confirmation email: {e}")
        return False


async def send_pending_tasks_summary_email(email: EmailStr, user_name: str, pending_tasks: list):
    """Sends an end-of-day email notification listing all pending uncompleted tasks for the day."""
    if not pending_tasks:
        return True

    task_list_items = "".join([
        f"<li style='margin-bottom: 8px;'><strong>{t.get('title', 'Task')}</strong> ({t.get('subject', 'General')} — {t.get('allocated_time_minutes', 30)} mins)</li>"
        for t in pending_tasks
    ])

    html = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #FEF3C7; padding: 20px; border-radius: 8px; text-align: center; border-left: 5px solid #F59E0B;">
                <h2 style="color: #B45309; margin: 0;">📅 Daily Study Reminder: {len(pending_tasks)} Pending Task(s)</h2>
            </div>
            
            <p>Hi <strong>{user_name}</strong>,</p>
            <p>You have <strong>{len(pending_tasks)} study task(s)</strong> remaining for today. Keep up the momentum for your target exam!</p>
            
            <div style="background-color: #F9FAFB; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #E5E7EB;">
                <h4 style="margin-top: 0; color: #374151;">Pending Tasks List:</h4>
                <ul style="padding-left: 20px; color: #4B5563;">
                    {task_list_items}
                </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://examplanner.in/planner" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Open Study Planner</a>
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
        if not settings.MAIL_USERNAME:
            logger.warning(f"MAIL_USERNAME not configured. Logging pending tasks for {email}: {len(pending_tasks)} tasks.")
            return True

        fm = FastMail(conf)
        await fm.send_message(message)
        logger.info(f"Pending tasks email sent successfully to {email}")
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
        if not settings.MAIL_USERNAME:
            logger.warning("MAIL_USERNAME is not set in environment. Skipping admin email.")
            return False
            
        fm = FastMail(conf)
        await fm.send_message(message)
        logger.info(f"Admin notification email successfully sent to {admin_email} for user {user_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send admin notification email: {e}")
        return False

# Legacy mock for auth_service.py compatibility
class MockEmailService:
    def send_verification_email(self, email: str, token: str):
        logger.info(f"Mock: Sending verification email to {email}")
        
    def send_password_reset_email(self, email: str, token: str):
        logger.info(f"Mock: Sending password reset email to {email}")

EmailService = MockEmailService
email_service = MockEmailService()
