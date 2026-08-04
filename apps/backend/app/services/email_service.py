import boto3
from botocore.exceptions import ClientError
from app.config.settings import settings


from app.config.logger import setup_logger

logger = setup_logger("EmailService")


class EmailService:
  def __init__(self):
    # AWS credentials can be automatically picked up from env or AWS config if not strictly provided
    try:
      self.client = boto3.client(
        'ses',
        region_name=settings.AWS_REGION
      )
      self.sender = getattr(settings, 'AWS_SES_SENDER', "no-reply@examplanner.com")
    except Exception as e:
      logger.warning(f"Could not initialize SES client. Emails will only be logged. Error: {str(e)}")
      self.client = None

  def send_email(self, to_email: str, subject: str, html_content: str):
    if not self.client:
      logger.info(f"--- MOCK EMAIL ---")
      logger.info(f"To: {to_email}")
      logger.info(f"Subject: {subject}")
      logger.info(f"Content: {html_content}")
      logger.info(f"------------------")
      return True

    try:
      response = self.client.send_email(
        Destination={'ToAddresses': [to_email]},
        Message={
          'Body': {
            'Html': {'Charset': 'UTF-8', 'Data': html_content},
          },
          'Subject': {'Charset': 'UTF-8', 'Data': subject},
        },
        Source=self.sender,
      )
      logger.info(f"Email sent! Message ID: {response['MessageId']}")
      return True
    except ClientError as e:
      logger.error(f"Failed to send email via SES: {e.response['Error']['Message']}")
      # Fallback to logging so it doesn't block execution
      logger.info(f"--- MOCK EMAIL (Fallback) ---")
      logger.info(f"To: {to_email}")
      logger.info(f"Subject: {subject}")
      logger.info(f"Content: {html_content}")
      return False

  def send_verification_email(self, to_email: str, token: str):
    verification_link = f"http://localhost:3000/verify-email?token={token}"
    subject = "Verify your Exam Planner account"
    html_content = f"""
    <html>
      <body>
        <h2>Welcome to Exam Planner!</h2>
        <p>Please verify your email address by clicking the link below:</p>
        <a href="{verification_link}">Verify Email</a>
        <p>Or copy and paste this link: {verification_link}</p>
      </body>
    </html>
    """
    return self.send_email(to_email, subject, html_content)

  def send_password_reset_email(self, to_email: str, token: str):
    reset_link = f"http://localhost:3000/reset-password?token={token}"
    subject = "Reset your Exam Planner password"
    html_content = f"""
    <html>
      <body>
        <h2>Password Reset Request</h2>
        <p>You requested to reset your password. Click the link below to set a new password:</p>
        <a href="{reset_link}">Reset Password</a>
        <p>If you did not request this, please ignore this email.</p>
        <p>Or copy and paste this link: {reset_link}</p>
      </body>
    </html>
    """
    return self.send_email(to_email, subject, html_content)

email_service = EmailService()
