import asyncio
import sys
import os

# Ensure the 'app' directory is in the Python path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.services.email_service import send_subscription_confirmation, send_admin_notification_subscription

async def test_emails():
    print("Testing Hostinger SMTP connection...")
    
    # Let's send the confirmation email to the same support email address just to test it
    test_email = "support@examplanner.in"
    test_name = "Test User"
    
    print(f"Attempting to send Subscription Confirmation to {test_email}...")
    success = await send_subscription_confirmation(test_email, test_name)
    
    if success:
        print("✅ Subscription email sent successfully! Check your inbox.")
    else:
        print("❌ Failed to send subscription email. Check the password or SMTP settings.")
        
    print(f"\nAttempting to send Admin Notification...")
    success_admin = await send_admin_notification_subscription(test_email, test_name)
    
    if success_admin:
        print("✅ Admin notification sent successfully!")
    else:
        print("❌ Failed to send admin notification.")

if __name__ == "__main__":
    asyncio.run(test_emails())
