import secrets
import string
from typing import Optional, Tuple
from datetime import datetime, timedelta
import logging
import hmac
import json
from backend.db.redis_client import redis_client
import hashlib

logger = logging.getLogger(__name__)

# OTP configuration
OTP_LENGTH = 6
OTP_EXPIRY_MINUTES = 5
MAX_OTP_ATTEMPTS = 5
OTP_RATE_LIMIT_WINDOW = 60  

class OTPService:
    """Service for generating a OTP for 2fa"""
    
    def __init__(self):
        self.redis_client = redis_client
        
    # ==============================================================
    
    def generate_otp(self, length: int = OTP_LENGTH) -> str:
        return ''.join(secrets.choice(string.digits) for _ in range(length))
    
    def hash_otp(self, otp_code: str) -> str:
        return hashlib.sha256(otp_code.encode()).hexdigest()
    
    def verify_hash(self, stored_hash: str, provided_code: str) -> bool:
        provided_hash = self.hash_otp(provided_code)
        return hmac.compare_digest(stored_hash, provided_hash)
    
    def get_otp_key(self, user_id: int, purpose: str = "2fa_login") -> str:
        """Generate Redis key for storing OTP"""
        return f"otp:{purpose}:{user_id}"
    
    def get_attempts_key(self, user_id: int, purpose: str = "2fa_login") -> str:
        """Generate Redis key for tracking verification attempts"""
        return f"otp_attempts:{purpose}:{user_id}"

    def get_rate_limit(self, user_id: int, purpose: str = "2fa_login") -> str:
        """Generate Redis key for rate limiting OTP generation"""
        return f"otp_rate_limit:{purpose}:{user_id}"
    
    # ==============================================================
    
    def create_otp(
        self,
        user_id: int,
        purpose: str = "2fa_login",
        expires_in_minutes: int = OTP_EXPIRY_MINUTES,
        skip_rate_limit: bool = False
    ) -> Tuple[Optional[str], Optional[datetime]]:
        try:
            # check rate limiting (can be skipped for setup/resend flows)
            if not skip_rate_limit:
                rate_limit_key = self.get_rate_limit(user_id, purpose)
                if self.redis_client.exists(rate_limit_key):
                    logger.warning(f"OTP rate limit hit for user {user_id}, purpose: {purpose}")
                    return None, None
            
            # Generate new OTP
            otp_code = self.generate_otp()
            hashed_code = self.hash_otp(otp_code)
            expiry = datetime.utcnow() + timedelta(minutes=expires_in_minutes)
            
            # Store in redis with expiry
            otp_data = {
                "code": hashed_code,
                "created_at": datetime.utcnow().isoformat(),
                "expires_at": expiry.isoformat()
            }
            
            otp_key = self.get_otp_key(user_id, purpose)
            
            # Store OTP with TTL
            self.redis_client.setex(
                otp_key,
                expires_in_minutes * 60,
                json.dumps(otp_data)
            )
            
            # Reset attempt counter
            attempts_key = self.get_attempts_key(user_id, purpose)
            self.redis_client.delete(attempts_key)
            
            # set rate limit to prevent immediate regen
            rate_limit_key = self.get_rate_limit(user_id, purpose)
            self.redis_client.setex(
                rate_limit_key,
                OTP_RATE_LIMIT_WINDOW,
                "1"
            )
            
            logger.info(f"OTP created for user {user_id}, purpose: {purpose}")
            return otp_code, expiry
        
        except Exception as e:
            logger.error(f"Failed to create OTP for user {user_id}: {e}")
            return None, None
        
    def clear_rate_limit(self, user_id: int, purpose: str = "2fa_login") -> bool:
        """Clear rate limit for a user - useful for resend flows"""
        try:
            rate_limit_key = self.get_rate_limit(user_id, purpose)
            deleted = self.redis_client.delete(rate_limit_key)
            
            if deleted:
                logger.info(f"Rate limit cleared for user {user_id}, purpose: {purpose}")
                return True
            return False
        
        except Exception as e:
            logger.error(f"Failed to clear rate limit for user {user_id}: {e}")
            return False
        
    def verify_otp(
        self,
        user_id: int,
        otp_code: str,
        purpose: str = "2fa_login"
    ) -> bool:
        """Verify an OTP Code"""
        try:
            otp_key = self.get_otp_key(user_id, purpose)
            attempts_key = self.get_attempts_key(user_id, purpose)
            
            # check if OTP exists
            stored_data = self.redis_client.get(otp_key)
            if not stored_data:
                logger.warning(f"No OTP found for user {user_id}")
                return False
            
            # handle bytes or string safely
            if isinstance(stored_data, bytes):
                stored_data = stored_data.decode("utf-8")
                
            stored_dict = json.loads(stored_data)
            
            # check attempt limit
            attempts = self.redis_client.get(attempts_key)
            attempts_count = int(attempts) if attempts else 0
            
            if attempts_count >= MAX_OTP_ATTEMPTS:
                logger.warning(f"Max OTP attempts exceeded for user {user_id}")
                # delete the OTP to prevent further attempts
                self.redis_client.delete(otp_key)
                self.redis_client.delete(attempts_key)
                return False
            
            # increment attempt counter
            self.redis_client.incr(attempts_key)
            self.redis_client.expire(attempts_key, OTP_EXPIRY_MINUTES * 60)
            
            stored_hash = stored_dict.get("code")
            
            # secure comparison
            if self.verify_hash(stored_hash, otp_code):
                self.redis_client.delete(otp_key)
                self.redis_client.delete(attempts_key)

                logger.info(f"OTP verified for user {user_id}")
                return True
            else:
                logger.warning(
                    f"Invalid OTP for user {user_id}. "
                    f"Attempt {attempts_count + 1}/{MAX_OTP_ATTEMPTS}"
                )
                return False
            
        except Exception as e:
            logger.error(f"Failed to verify OTP for user {user_id}: {e}")
            return False
        
    def invalidate_otp(
        self,
        user_id: int,
        purpose: int = "2fa_login"
    ) -> bool:
        try:
            otp_key = self.get_otp_key(user_id, purpose)
            attempts_key = self.get_attempts_key(user_id, purpose)
            
            deleted = self.redis_client.delete(otp_key, attempts_key)
            
            if deleted:
                logger.info(f"OTP invalidated for user {user_id}")
                return True
            return False
        
        except Exception as e:
            logger.error(f"Failed to invalidate OTP for user {user_id}: {e}")
            return False
        
    def get_remaining_attempts(self, user_id: int, purpose: str = "2fa_login") -> int:
        """Method to give remaining attempts of re entering OTP"""
        try:
            attempts_key = self.get_attempts_key(user_id, purpose)
            attempts = self.redis_client.get(attempts_key)
            attempts_count = int(attempts) if attempts else 0
            
            return max(0, MAX_OTP_ATTEMPTS - attempts_count)
        
        except Exception as e:
            logger.error(f"Failed to get remaining attempts for user {user_id}: {e}")
            return 0