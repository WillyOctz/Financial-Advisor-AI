import os
from typing import Optional, Literal
import aiosmtplib
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from jinja2 import Template
from pathlib import Path
import logging
from dotenv import load_dotenv
import httpx

load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)

MAX_RETRIES = 3
RETRY_BASE_DELAY = 2

EmailProvider = Literal["brevo", "smtp"]

class EmailService:
    def __init__(self):
        self.provider: EmailProvider = os.getenv("EMAIL_PROVIDER", "smtp")
        self.base_url = os.getenv("BASE_URL", "http://localhost:3000")
        
        # Brevo
        self.brevo_api_key = os.getenv("BREVO_API_KEY")
        self.from_name = os.getenv("FROM_NAME")
        self.from_email = os.getenv("FROM_EMAIL")
        
        # SMTP (fallback method)
        self.smtp_server = os.getenv("SMTP_SERVER")
        self.smtp_port = int(os.getenv("SMTP_PORT"))
        self.smtp_username = os.getenv("SMTP_USERNAME")
        self.smtp_password = os.getenv("SMTP_PASSWORD")
        
        self.validate_config()
        
    def validate_config(self):
        if self.provider == "brevo" and not self.brevo_api_key:
            raise ValueError("BREVO_API_KEY required when EMAIL_PROVIDER=brevo")
        elif self.provider == "smtp" and (not self.smtp_username or not self.smtp_password):
            raise ValueError("SMTP credentials not configured - emails will fail")

    def _load_template(self, template_name: str) -> Template:
        """Load HTML email template"""
        template_path = Path(__file__).parent / "templates" / f"{template_name}.html"
        with open(template_path, 'r', encoding='utf-8') as file:
            template_content =  file.read()
        return Template(template_content)
    
    async def send_via_brevo(self, to_email: str, subject: str, html_content: str, text_content: str) -> bool:
        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(
                    "https://api.brevo.com/v3/smtp/email",
                    headers={
                        "accept": "application/json",
                        "api-key": self.brevo_api_key,
                        "content-type": "application/json"
                    },
                    json={
                        "sender": {
                            "name": self.from_name,
                            "email": self.from_email
                        },
                        "to": [{"email": to_email}],
                        "subject": subject,
                        "htmlContent": html_content,
                        "textContent": text_content
                    },
                    timeout=10.0
                )
                
                if res.status_code in [200, 201]:
                    logger.info(f"Email sent via Brevo to {to_email}")
                    return True
                else:
                    logger.error(f"Brevo API error: {res.status_code} - {res.text}")
                    return False
                
        except Exception as e:
            logger.error(f"Brevo send error to {to_email}: {e}")
            return False
        
    async def send_via_smtp(self, to_email: str, subject: str, html_content: str, text_content: str) -> bool:
        """Fallback method should brevo is done (but risky and not for production)"""
        if not self.smtp_username and self.smtp_password:
            logger.error("SMTP credentials not configured")
            return False
        
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"AI Financial Advisor Team"
        msg["To"] = to_email
        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))
        
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                await aiosmtplib.send(
                    msg,
                    hostname=self.smtp_server,
                    port=self.smtp_port,
                    username=self.smtp_username,
                    password=self.smtp_password,
                    start_tls=True,
                    timeout=10,
                )
                logger.info(f"Email sent via SMTP to {to_email}")
                return True
                
            except aiosmtplib.SMTPException as e:
                wait = RETRY_BASE_DELAY * (2 ** (attempt - 1))
                if attempt < MAX_RETRIES:
                    logger.warning(f"SMTP send failed (attempt {attempt}/{MAX_RETRIES}), retrying in {wait}s: {e}")
                    await asyncio.sleep(wait)
                else:
                    logger.error(f"SMTP send failed after {MAX_RETRIES} attempts to {to_email}: {e}")
                    return False
                    
            except Exception as e:
                logger.error(f"Unexpected SMTP error to {to_email}: {e}")
                return False
        
        return False
    
    async def send_mail(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: str
    ) -> bool:
        if self.provider == "brevo":
            return await self.send_via_brevo(to_email, subject, html_content, text_content)
        else:
            return await self.send_via_smtp(to_email, subject, html_content, text_content)
        
    async def send_verification_email(self, to_email: str, token: str, username: str) -> bool:
        try:
            template = self._load_template("verification_email")
            verification_link = f"{self.base_url}/verify-email?token={token}"
            
            html_content = template.render(
                username=username,
                verification_link=verification_link,
                base_url=self.base_url,
            )
            text_content = (
                f"Welcome to Financial Advisor AI!\n\n"
                f"Please verify your email address by clicking the link below:\n"
                f"{verification_link}\n\n"
                f"This link expires in 24 hours.\n"
                f"If you didn't create an account, please ignore this email.\n\n"
                f"For security reasons, never share this link with anyone."
            )
            
            success = await self.send_mail(
                to_email=to_email,
                subject="Verify your Financial Advisor AI Account",
                html_content=html_content,
                text_content=text_content
            )
            
            if success:
                logger.info(f"Verification email sent to {to_email}")
            return success
        
        except FileNotFoundError as e:
            logger.error(f"Missing email template: {e}")
            return False
        except Exception as e:
            logger.error(f"Failed to build verification email for {to_email}: {e}")
            return False
        
    async def send_welcome_email(self, to_email: str, username: str) -> bool:
        try:
            template = self._load_template("welcome_email")
            html_content = template.render(username=username, base_url=self.base_url)
            text_content = (
                f"Welcome to Financial Advisor AI, {username}!\n\n"
                f"Your account has been successfully verified.\n"
                f"You can now log in and start using our AI-powered financial insights.\n\n"
                f"Best regards,\nThe Financial Advisor AI Team"
            )
            
            success = await self.send_mail(
                to_email=to_email,
                subject="Welcome to Financial Advisor AI",
                html_content=html_content,
                text_content=text_content
            )
            
            if success:
                logger.info(f"Welcome email sent to {to_email}")
            return success
        
        except FileNotFoundError as e:
            logger.error(f"Missing email template: {e}")
            return False
        except Exception as e:
            logger.error(f"Failed to build welcome email for {to_email}: {e}")
            return False
        
    async def send_password_reset_email(self, to_email: str, token: str, username: str) -> bool:
        try:
            template = self._load_template("forget-password")
            reset_link = f"{self.base_url}/reset-password?token={token}"
            
            html_content = template.render(
                username=username,
                reset_link=reset_link,
                base_url=self.base_url
            )
            
            text_content = (
                f"Password Reset Request\n\n"
                f"Hello {username},\n\n"
                f"We received a request to reset your password. "
                f"Click the link below to set a new password:\n"
                f"{reset_link}\n\n"
                f"This link expires in 1 hour.\n"
                f"If you didn't request this reset, please ignore this email.\n\n"
                f"For security reasons, never share this link with anyone.\n\n"
                f"Best regards,\nThe Financial Advisor AI Team"
            )
            
            success = await self.send_mail(
                to_email=to_email,
                subject="Reset Your Financial Advisor AI Password",
                html_content=html_content,
                text_content=text_content
            )
            
            if success:
                logger.info(f"Password reset email sent to {to_email}")
            return success
        
        except FileNotFoundError as e:
            logger.error(f"Missing email template: {e}")
            return False
        except Exception as e:
            logger.error(f"Failed to build password reset email for {to_email}: {e}")
            return False
        
    async def send_otp_email(self, to_email: str, otp_code: str, username: str) -> bool:
        """Send OTP code via email for 2FA"""
        try:
            html_content = f"""
                <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .otp-code {{ font-size: 32px; font-weight: bold; letter-spacing: 5px; 
                                 color: #2563eb; text-align: center; padding: 20px; 
                                 background: #f3f4f6; border-radius: 8px; margin: 20px 0; }}
                    .warning {{ background: #fef3c7; padding: 15px; border-radius: 8px; 
                               border-left: 4px solid #f59e0b; margin: 20px 0; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>Your Verification Code</h2>
                    <p>Hello {username},</p>
                    <p>Your verification code for Financial Advisor AI is:</p>
                    <div class="otp-code">{otp_code}</div>
                    <p>This code will expire in 5 minutes.</p>
                    <div class="warning">
                        <strong>Security Notice:</strong><br>
                        Never share this code with anyone. Our team will never ask for this code.
                        If you didn't request this code, please secure your account immediately.
                    </div>
                    <p>Best regards,<br>The Financial Advisor AI Team</p>
                </div>
            </body>
            </html>
            """
            
            text_content = (
                f"Your Verification Code\n\n"
                f"Hello {username},\n\n"
                f"Your verification code for Financial Advisor AI is: {otp_code}\n\n"
                f"This code will expire in 5 minutes.\n\n"
                f"SECURITY NOTICE:\n"
                f"Never share this code with anyone. Our team will never ask for this code.\n"
                f"If you didn't request this code, please secure your account immediately.\n\n"
                f"Best regards,\nThe Financial Advisor AI Team"
            )
            
            success = await self.send_mail(
                to_email=to_email,
                subject=f"Your verification code: {otp_code}",
                html_content=html_content,
                text_content=text_content
            )
            
            if success:
                logger.info(f"OTP email sent to {to_email}")
            return success
        
        except Exception as e:
            logger.error(f"Failed to send OTP email to {to_email}: {e}")
            return False


    