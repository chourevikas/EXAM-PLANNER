"""Send one test email through the configured transport, to check production delivery.

    docker compose -f docker-compose.prod.yml exec api python -m app.scripts.send_test_email you@example.com

Uses SMTP when MAIL_USERNAME/MAIL_PASSWORD are set, otherwise AWS SES, like the app does. Unlike the app,
it fails loudly when neither is configured instead of simulating the send. Check the inbox AND the spam
folder, and look at the SPF/DKIM/DMARC results in the message headers ("Show original" in Gmail).
"""
import asyncio
import sys
from datetime import datetime, timezone
from html import escape

from app.config.settings import settings


def _html(transport: str) -> str:
    sent = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    return f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.5; color: #172033; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="margin: 0 0 12px;">ExamPlanner test email</h2>
            <p>If you can read this, email from <strong>{escape(settings.ENVIRONMENT)}</strong> is being delivered.</p>
            <table style="font-size: 14px; border-collapse: collapse;">
                <tr><td style="padding:4px 12px 4px 0;color:#64748B;">Transport</td><td><strong>{escape(transport)}</strong></td></tr>
                <tr><td style="padding:4px 12px 4px 0;color:#64748B;">From</td><td><strong>{escape(settings.MAIL_FROM or settings.AWS_SES_SENDER or '')}</strong></td></tr>
                <tr><td style="padding:4px 12px 4px 0;color:#64748B;">Sent</td><td><strong>{sent}</strong></td></tr>
            </table>
        </body>
    </html>
    """


async def main(recipient: str) -> int:
    subject = f"ExamPlanner test email ({settings.ENVIRONMENT})"
    if settings.MAIL_USERNAME and settings.MAIL_PASSWORD:
        from fastapi_mail import FastMail, MessageSchema, MessageType
        from app.services.email_service import get_fastmail_config

        transport = f"SMTP {settings.MAIL_SERVER}:{settings.MAIL_PORT}"
        try:
            await FastMail(get_fastmail_config()).send_message(
                MessageSchema(subject=subject, recipients=[recipient], body=_html(transport), subtype=MessageType.html)
            )
        except Exception as err:
            print(f"FAILED via {transport}: {err}")
            return 1
    elif settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
        from app.services.email_service import _send_via_aws_ses

        transport = f"AWS SES ({settings.AWS_REGION or 'ap-southeast-2'})"
        if not await _send_via_aws_ses([recipient], subject, _html(transport)):
            print(f"FAILED via {transport}; see the log line above.")
            return 1
    else:
        print("No email transport configured: set MAIL_USERNAME/MAIL_PASSWORD (SMTP) or the AWS keys (SES).")
        return 1
    print(f"Sent to {recipient} via {transport}. Check the inbox and the spam folder.")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2 or "@" not in sys.argv[1]:
        print("Usage: python -m app.scripts.send_test_email you@example.com")
        sys.exit(2)
    sys.exit(asyncio.run(main(sys.argv[1])))
