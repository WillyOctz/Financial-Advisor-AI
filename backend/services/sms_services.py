import os
from typing import Optional, Literal
import logging
from dotenv import load_dotenv
import httpx

load_dotenv()

logger = logging.getLogger(__name__)

SMSProvider = Literal["mock"]

class SMSService:
    """SMS service for 2fa otp method (using mock for trial development)"""
    def __init__(self):
        self.provider: SMSProvider = os.getenv("SMS_PROVIDER", "mock")
        
        # will put twillio and brevo as fallback when its stable
        ## Twillio
        ## Brevo
        
        self.validate_config()
        
    def validate_config(self):
        if self.provider == "mock":
            logger.info("SMS Service in MOCK mode - messages will be logged, not sent (just to try)")
    
    async def send_via_mock(self, to_phone: str, message: str) -> bool:
        """Mock SMS trial service"""
        try:
            # Log the SMS that would be sent
            logger.info("=" * 60)
            logger.info("MOCK SMS SERVICE - Message would be sent:")
            logger.info(f"To: {to_phone}")
            logger.info(f"Message: {message}")
            logger.info("=" * 60)
            
            print("\n" + "=" * 60)
            print("📱 MOCK SMS (Not Actually Sent)")
            print(f"📞 To: {to_phone}")
            print(f"💬 Message: {message}")
            print("=" * 60 + "\n")
            
            return True
        
        except Exception as e:
            logger.error(f"Mock SMS error to {to_phone}: {e}")
            return False
        
    async def send_sms(self, to_phone: str, message: str) -> bool:
        """Send SMS using the configured provider (using mock method SMS first)"""
        # validate phone number format
        if not to_phone.startswith("+"):
            logger.error(f"Invalid phone format: {to_phone}. Must start with + (E.164 format)")
            return False
        
        # route for provider
        if self.provider == "mock":
            return await self.send_via_mock(to_phone, message)
        else:
            logger.error(f"Unknown SMS provider: {self.provider}")
            return False
        
    async def send_otp_sms(self, to_phone: str, otp_code: str, app_name: str = "Financial Advisor AI") -> bool:
        """Send OTP code via standaridized format"""
        message = f"{otp_code} is your {app_name} verification code. Valid for 5 minutes. Never share this code."
        
        success = await self.send_sms(to_phone, message)
        
        if success:
            if self.provider == "mock":
                logger.info(f"[MOCK] OTP SMS logged for {to_phone}")
            else:
                logger.info("OTP SMS sent to {to_phone}")
                
        return success
    
    def format_phone_number(self, phone: str, default_country_code: str = "+1") -> str:
        """Format phone number to E.614 format"""
        # remove all non-digit characters except +
        cleaned = ''.join(c for c in phone if c.isdigit() or c == '+')
        
        # add country code if not present
        if not cleaned.startswith('+'):
            cleaned = default_country_code + cleaned
            
        return cleaned