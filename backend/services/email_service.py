import os
from typing import Optional
import aiosmtplib
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from jinja2 import Template
from pathlib import Path
import logging
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)

MAX_RETRIES = 3
RETRY_BASE_DELAY = 2

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
    
    async def send_email(self, msg: MIMEMultipart) -> bool:
        """Core async send helper with retry logic. Uses aiosmtplib so the event loop is never blocked"""
        if not self.smtp_username or not self.smtp_password:
            logger.error("SMTP credentials not configured — set SMTP_USERNAME and SMTP_PASSWORD in .env")
            return False
        
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
              return True
          
            except aiosmtplib.SMTPException as e:
                wait = RETRY_BASE_DELAY * (2 ** (attempt - 1))
                if attempt < MAX_RETRIES:
                    logger.warning(
                        f"SMTP send failed (attempt {attempt}/{MAX_RETRIES}), "
                        f"retrying in {wait}s: {e}"
                    )
                    await asyncio.sleep(wait)
                else:
                    logger.error(
                        f"SMTP send failed after {MAX_RETRIES} attempts "
                        f"to {msg['To']}: {e}"
                    )
                    return False
                
            except Exception as e:
                logger.error(f"Unexpected email error to {msg['To']}: {e}")
                return False
            
        return False
    
    async def send_verification_email(self, to_email: str, token: str, username: str) -> bool:
        """Send account verification email"""
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
                f"Please verify your email address:\n{verification_link}\n\n"
                f"This link expires in 24 hours.\n"
                f"If you didn't create an account, ignore this email."
            )
            
            msg = MIMEMultipart("alternative")
            msg["Subject"] = "Verify your Financial Advisor AI Account"
            msg["From"] = f"Financial Advisor AI <{self.smtp_username}>"
            msg["To"] = to_email
            msg.attach(MIMEText(text_content, "plain"))
            msg.attach(MIMEText(html_content, "html"))
            
            success = await self.send_email(msg)
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
        """Send welcome email after successful verification"""
        try:
            template = self._load_template("welcome_email")
            html_content = template.render(username=username, base_url=self.base_url)
            text_content = (
                f"Welcome to Financial Advisor AI, {username}!\n\n"
                f"Your account has been successfully verified.\n"
                f"You can now log in and start using our AI-powered financial insights.\n\n"
                f"Best regards,\nThe Financial Advisor AI Team"
            )
            
            msg = MIMEMultipart("alternative")
            msg["Subject"] = "Welcome to Financial Advisor AI!"
            msg["From"] = f"Financial Advisor AI <{self.smtp_username}>"
            msg["To"] = to_email
            msg.attach(MIMEText(text_content, "plain"))
            msg.attach(MIMEText(html_content, "html"))
            
            success = await self.send_email(msg)
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
        """Send password reset email"""
        try:
            template = self._load_template("forget_password")
            reset_link = f"{self.base_url}/reset-password?token={token}"
 
            html_content = template.render(
                username=username,
                reset_link=reset_link,
                base_url=self.base_url,
            )
            text_content = (
                f"Password Reset Request\n\nHello {username},\n\n"
                f"Click the link below to set a new password:\n{reset_link}\n\n"
                f"This link expires in 1 hour.\n"
                f"If you didn't request this, ignore this email.\n\n"
                f"Best regards,\nThe Financial Advisor AI Team"
            )
 
            msg = MIMEMultipart("alternative")
            msg["Subject"] = "Reset Your Financial Advisor AI Password"
            msg["From"] = f"Financial Advisor AI <{self.smtp_username}>"
            msg["To"] = to_email
            msg.attach(MIMEText(text_content, "plain"))
            msg.attach(MIMEText(html_content, "html"))
 
            success = await self.send_email(msg)
            if success:
                logger.info(f"Password reset email sent to {to_email}")
            return success
 
        except FileNotFoundError as e:
            logger.error(f"Missing email template: {e}")
            return False
        except Exception as e:
            logger.error(f"Failed to build password reset email for {to_email}: {e}")
            return False
