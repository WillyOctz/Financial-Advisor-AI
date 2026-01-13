import os
from typing import Optional
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from jinja2 import Template
from pathlib import Path
import logging
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", 587))
        self.smtp_username = os.getenv("SMTP_USERNAME")
        self.smtp_password = os.getenv("SMTP_PASSWORD")
        self.base_url = os.getenv("BASE_URL", "http://localhost:3000")

    def _load_template(self, template_name: str) -> Template:
        """Load HTML email template"""
        template_path = Path(__file__).parent / "templates" / f"{template_name}.html"
        with open(template_path, 'r', encoding='utf-8') as file:
            template_content =  file.read()
        return Template(template_content)
    
    def send_verification_email(self, to_email: str, token: str, username: str) -> bool:
        """Send account verification email"""
        try:
            # Load template
            template = self._load_template("verification_email")

            # Prepare verificaiton link
            verification_link = f"{self.base_url}/verify-email?token={token}"

            # Render template
            html_content = template.render(
                username=username,
                verification_link=verification_link,
                base_url=self.base_url
            )

            # Create message
            msg = MIMEMultipart("alternative")
            msg["Subject"] = "Verify your Financial Advisor AI Account"
            msg["From"] = f"Financial Advisor AI <{self.smtp_username}>"
            msg["To"] = to_email

            # Plain text version
            text_content = f"""
            Welcome to Financial Advisor AI!
            
            Please verify your email address by clicking the link below:
            {verification_link}
            
            This link will expire in 24 hours.
            
            If you didn't create an account, please ignore this email.

            """
            # Attach both plain text and HTML
            msg.attach(MIMEText(text_content, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            # Send email
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_username, self.smtp_password)
                server.send_message(msg)

            logger.info(f"Verification email sent to {to_email}")
            return True
        
        except Exception as e:
            logger.error(f"Failed to send verification email to {to_email}: {e}")
            return False
        
    def send_welcome_email(self, to_email: str, username: str) -> bool:
        """Send welcome email after successful verification"""
        try:
            template = self._load_template("welcome_email")

            html_content = template.render(
                username=username,
                base_url=self.base_url
            )

            msg = MIMEMultipart("alternative")
            msg["Subject"] = "Welcome to Financial Advisor AI!"
            msg["From"] = f"Financial Advisor AI <{self.smtp_username}>"
            msg["To"] = to_email

            text_content = f"""
            Welcome to Financial Advisor AI, {username}!
            
            Your account has been successfully verified.
            You can now log in and start using our AI-powered financial insights.
            
            Get started by uploading your financial documents or exploring the dashboard.
            
            Best regards,
            The Financial Advisor AI Team
        
            """

            msg.attach(MIMEText(text_content, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_username, self.smtp_password)
                server.send_message(msg)

            logger.info(f"Welcome email sent to {to_email}")
            return True
        
        except Exception as e:
            logger.error(f"Failed to send welcome email: {e}")
            return False
        
    def send_password_reset_email(self, to_email: str, token: str, username: str) -> bool:
        """Send password reset email"""
        try:
            # Load the email template
            template_path = Path(__file__).parent / "templates" / "forget_password.html"
            with open(template_path, 'r', encoding='utf-8') as file:
                template_content = file.read()

            template = Template(template_content)

            # Prepare reset link
            reset_link = f"{self.base_url}/reset-password?token={token}"

            # Render template
            html_content = template.render(
                username=username,
                reset_link=reset_link,
                base_url=self.base_url
            )

            # Create message
            msg = MIMEMultipart("alternative")
            msg["Subject"] = "Reset Your Financial Advisor AI Password"
            msg["From"] = f"Financial Advisor AI <{self.smtp_username}>"
            msg["To"] = to_email

            # Plain text version
            text_content = f"""
            Password Reset Request

            Hello {username},

            We received a request to reset your password. Click the link below to set a new password:
            {reset_link}
            
            This link will expire in 1 hour.
            
            If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
            
            Best regards,
            The Financial Advisor AI Team
            """

            # Attach both plain text and HTML
            msg.attach(MIMEText(text_content, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            # Send Email
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_username, self.smtp_password)
                server.send_message(msg)

            logger.info(f"Password reset email sent to {to_email}")
            return True
        
        except Exception as e:
            logger.error(f"Failed to send password reset email to {to_email}: {e}")
            return False
