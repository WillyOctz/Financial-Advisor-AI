from datetime import datetime, timedelta
from typing import Optional, Tuple, List
from jose import jwt
from passlib.context import CryptContext
from backend.services.cache_warmer import CacheWarmer
from backend.models.database import User
from backend.models.schemas import UserCreate, UserLogin
from sqlalchemy.orm import Session
import os
import hashlib
import secrets
from dotenv import load_dotenv
import uuid
from cryptography.fernet import Fernet, InvalidToken 

# import new services
from backend.services.otp_services import OTPService
from backend.services.sms_services import SMSService
from backend.services.email_service import EmailService

#======2FA Library Imports======
import pyotp
import qrcode
import base64
import io

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET")
if not SECRET_KEY or len(SECRET_KEY) < 32:
    raise ValueError("JWT_SECRET must be at least 32 characters")


ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
VERIFICATION_TOKEN_EXPIRE_HOURS = 24

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


# 2FA secret encrption
raw_2fa_key = os.getenv("TWO_FACTOR_ENCRYPTION_KEY")
if not raw_2fa_key:
    raise ValueError("TWO_FACTOR_ENCRYPTION_KEY is not set in .env — generate one with Fernet.generate_key()")
_fernet = Fernet(raw_2fa_key.encode() if isinstance(raw_2fa_key, str) else raw_2fa_key)

def encrypt_2fa_secret(plain_secret: str) -> str:
    """Encrypt a TOTP secret before storing in the database"""
    return _fernet.encrypt(plain_secret.encode()).decode()

def decrypt_2fa_secret(encrypted_secret: str) -> str:
    """Decrypt a TOTP secret retrieved from the database"""
    try:
        return _fernet.decrypt(encrypted_secret.encode()).decode()
    except InvalidToken:
        raise ValueError("Failed to decrypt 2FA secret — key mismatch or corrupted data")

class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.otp_service = OTPService()
        self.sms_service = SMSService()
        self.email_service = EmailService()

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)
    
    def get_password_hash(self, password: str) -> str:
        return pwd_context.hash(password)
    
    def hash_token(self, token: str) -> str:
        """SHA-256 hash a token before storing in DB, preventing from someone else read it"""
        return hashlib.sha256(token.encode()).hexdigest()
    
    def authenticate_user(self, email: str, password: str) -> Optional[User]:
        user = self.db.query(User).filter(User.email == email).first()
        if not user or not self.verify_password(password, user.password_hash):
            return None
        if not user.is_verified:
            raise ValueError("Please verify your email before logging in")
        if not user.is_active:
            raise ValueError("Account is deactivated. Please contact support.")
        
        # Update last login
        user.last_login = datetime.utcnow()
        self.db.commit()

        # Warm cache on login
        cache_warmer = CacheWarmer(self.db)
        cache_warmer.warm_on_login(user.id)

        return user
    
    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None):
        to_encode = data.copy()
        
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=15)

        to_encode.update({
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "access_token",
            "jti": str(uuid.uuid4())
        })
        
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt
    
    def create_verification_token(self) -> Tuple[str, datetime]:
        """Generate a unique verification token with expiry"""
        token = secrets.token_urlsafe(32)
        expires = datetime.utcnow() + timedelta(hours=VERIFICATION_TOKEN_EXPIRE_HOURS)
        return token, expires
    
    def create_user(self, user_data: UserCreate) -> User:
        # Check if user exists
        existing_user = self.db.query(User).filter(User.email == user_data.email).first()
        if existing_user:
            raise ValueError("User with this email already exists")
        
        # Create verification token
        verification_token, token_expires = self.create_verification_token()
        
        # Create new user
        hashed_password = self.get_password_hash(user_data.password)
        user = User(
            email=user_data.email,
            password_hash=hashed_password,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            is_verified=False,
            verification_token=self.hash_token(verification_token),
            verification_token_expires=token_expires
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)

        return user, verification_token
    
    def verify_user_token(self, token: str) -> Optional[User]:
        """Verify user using token"""
        token_hash = self.hash_token(token)
        user = self.db.query(User).filter(
            User.verification_token == token_hash,
            User.verification_token_expires > datetime.utcnow()
        ).first()

        if user:
            user.is_verified = True
            user.verification_token = None
            user.verification_token_expires = None
            self.db.commit()
            self.db.refresh(user)
            return user
        return None
    
    def resend_verification(self, email: str) -> Tuple[Optional[User], Optional[str]]:
        """Resend verification email"""
        user = self.db.query(User).filter(User.email == email).first()
        if not user:
            return None, None
        
        if user.is_verified:
            raise ValueError("Account is already verified")
        
        # Generate new token
        verification_token, token_expires = self.create_verification_token()

        user.verification_token = self.hash_token(verification_token)
        user.verification_token_expires = token_expires
        self.db.commit()

        return user, verification_token
    
    def create_reset_token(self) -> Tuple[str, datetime]:
        """Generate a unique password reset token with expiry"""
        token = secrets.token_urlsafe(32)
        expires = datetime.utcnow() + timedelta(hours=1) # 1 hour expiry
        return token, expires
    
    def initiate_password_reset(self, email: str) -> Tuple[Optional[User], Optional[str]]:
        """Initiate password reset process"""
        
        user = self.db.query(User).filter(User.email == email).first()
        if not user:
            return None, None
        
        # Generate reset token
        reset_token, token_expires = self.create_reset_token()

        # Store token in database
        user.reset_token = self.hash_token(reset_token)
        user.reset_token_expires = token_expires
        self.db.commit()

        return user, reset_token
    
    def verify_reset_token(self, token: str) -> Optional[User]:
        """Verify if reset token is valid"""
        token_hash = self.hash_token(token)
        user = self.db.query(User).filter(
            User.reset_token == token_hash,
            User.reset_token_expires > datetime.utcnow()
        ).first()
        return user
    
    def reset_password(self, token: str, new_password: str) -> Optional[User]:
        """Reset user password using token"""
        user = self.verify_reset_token(token)
        if not user:
            return None
        
        # Update password and clear reset token
        user.password_hash = self.get_password_hash(new_password)
        user.reset_token = None
        user.reset_token_expires = None
        self.db.commit()
        self.db.refresh(user)

        return user
    
    # ======TOTP-based service 2FA======
    
    def generate_two_factor_secret(self, user_email: str) -> str:
        """Generate TOTP secret for 2fa"""
        return pyotp.random_base32()
    
    def generate_two_factor_qr_code(self, user_email: str, secret: str) -> str:
        """Generate QR code for authenticator app"""
        totp = pyotp.TOTP(secret)
        uri = totp.provisioning_uri(
            name=user_email,
            issuer_name="AI Financial Advisor"
        )
        
        # Generate QR code 
        qr = qrcode.make(uri)
        buffered = io.BytesIO()
        qr.save(buffered, format="PNG")
        qr_base64 = base64.b64encode(buffered.getvalue()).decode()
        
        return f"data:image/png;base64,{qr_base64}"
    
    def generate_backup_codes(self, count: int = 10) -> List[str]:
        """Generate backup codes for 2fa"""
        return [secrets.token_hex(4).upper() for _ in range(count)]
    
    def verify_two_factor_code(self, secret: str, code: str) -> bool:
        """Verify OTP code"""
        totp = pyotp.TOTP(secret)
        return totp.verify(code, valid_window=1)
    
    def verify_backup_code(self, user: User, code: str) -> bool:
        """Verify backup code and mark as read"""
        if not user.two_factor_backup_codes:
            return False
        
        backup_codes = user.two_factor_backup_codes
        for backup_code in backup_codes:
            if backup_code.get('code') == code and not backup_code.get('used', False):
                # mark as used
                backup_code['used'] = True
                user.two_factor_backup_codes = backup_codes
                self.db.commit()
                return True
            
        return False
    
    # ======OTP based 2FA (Email/SMS)======
    
    async def send_2fa_otp(self, user: User, purpose: str = "2fa_login") -> bool:
        """Send OTP code based on user's preferred 2FA method
        
        Args:
            user: User object
            purpose: Either '2fa_setup' or '2fa_login' to differentiate setup from actual login
        """
        # For setup flow, skip rate limiting to allow immediate resends
        skip_rate_limit = (purpose == "2fa_setup")
        
        # Generate OTP
        otp_code, expiry = self.otp_service.create_otp(
            user.id, 
            purpose=purpose,
            skip_rate_limit=skip_rate_limit
        )
        
        if not otp_code:
            return False
        
        username = f"{user.first_name} {user.last_name}" if user.first_name else user.email
        
        # send via email
        if user.two_factor_method == "email":
            success = await self.email_service.send_otp_email(
                to_email=user.email,
                otp_code=otp_code,
                username=username
            )
            return success
        
        # send via SMS
        elif user.two_factor_method == "sms":
            if not user.phone_number:
                return False
            
            success = await self.sms_service.send_otp_sms(
                to_phone=user.phone_number,
                otp_code=otp_code
            )
            return success
        
        return False
    
    def verify_2fa_otp(self, user: User, otp_code: str, purpose: str = "2fa_login") -> bool:
        """Verify OTP code for email/SMS 2FA methods
        
        Args:
            user: User object
            otp_code: The OTP code to verify
            purpose: Either '2fa_setup' or '2fa_login' to match the purpose used in send_2fa_otp
        """
        return self.otp_service.verify_otp(user.id, otp_code, purpose=purpose)
    
    # ======2FA Setup======
    
    def enable_two_factor(self, user: User, method: str = 'app', phone_number: str = None) -> dict:
        """Enable 2fa for user with specified method"""
        result = {}
        
        # for app-based 2FA, generate secret and QR code
        if method == 'app':
            secret = self.generate_two_factor_secret(user.email)
            qr_code_url = self.generate_two_factor_qr_code(user.email, secret)
            backup_codes = self.generate_backup_codes()
            
            # encrypt and store secret
            user.two_factor_secret = encrypt_2fa_secret(secret)
            
            result = {
                'qr_code_url': qr_code_url,
                'secret': secret,
                'backup_codes': backup_codes,
                'method': method
            }
            
        # for email-based 2FA 
        elif method == 'email':
            backup_codes = self.generate_backup_codes()
            result = {
                'backup_codes': backup_codes,
                'method': method,
                'message': 'Email 2FA enabled. You will receive OTP codes via email.'
            }
            
        # for sms-based 2FA
        elif method == 'sms':
            if not phone_number:
                raise ValueError("Phone number required for SMS 2FA")
            
            # format phone number to E.164
            formatted_phone = self.sms_service.format_phone_number(phone_number)
            user.phone_number = formatted_phone
            
            backup_codes = self.generate_backup_codes()
            result = {
                'backup_codes': backup_codes,
                'method': method,
                'phone_number': formatted_phone,
                'message': 'SMS 2FA enabled. You will receive OTP codes via text message.'
            }
            
        # update user settings
        user.two_factor_method = method
        user.two_factor_enabled = False
        
        # store backup codes
        backup_codes_objects = [{'code': code, 'used': False} for code in result.get('backup_codes', [])]
        user.two_factor_backup_codes = backup_codes_objects
        
        self.db.commit()
        
        return result
        
    async def verify_and_enable_two_factor(self, user: User, code: str) -> bool:
        """Verify initial 2FA setup code and enable 2FA"""
        if user.two_factor_method == 'app':
            if not user.two_factor_secret:
                return False
            
            # decrypt secret
            decrypted_secret = decrypt_2fa_secret(user.two_factor_secret)
            
            if self.verify_two_factor_code(decrypted_secret, code):
                user.two_factor_enabled = True
                self.db.commit()
                return True
            
        # for email/sms send otp code first
        elif user.two_factor_method in ['email', 'sms']:
            # Use '2fa_setup' purpose to match what was sent during setup
            if self.verify_2fa_otp(user, code, purpose="2fa_setup"):
                user.two_factor_enabled = True
                self.db.commit()
                return True
            
        return False
    
    def disable_two_factor(self, user: User, password: str) -> bool:
        """Disable 2FA for user"""
        if not self.verify_password(password, user.password_hash):
            return False
        
        user.two_factor_enabled = False
        user.two_factor_secret = None
        user.two_factor_backup_codes = None
        user.two_factor_method = None
        user.phone_number = None
        self.db.commit()
        return True