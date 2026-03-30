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
            "jti": str(uuid.uuid4)
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
    
    def enable_two_factor(self, user: User, method: str = 'app', phone_number: str = None) -> dict:
        """Enable 2fa for user"""
        secret = self.generate_two_factor_secret(user.email)
        qr_code_url = self.generate_two_factor_qr_code(user.email, secret)
        backup_codes = self.generate_backup_codes()
        
        user.two_factor_secret = secret
        user.two_factor_method = method
        user.two_factor_enabled = False # automatically enabled after verification
        user.phone_number = phone_number if method == 'sms' else None
        
        # Store backup codes as objects with usage status
        backup_codes_objects = [{'code': code, 'used': False} for code in backup_codes]
        user.two_factor_backup_codes = backup_codes_objects
        
        self.db.commit()
        
        return {
            'qr_code_url': qr_code_url,
            'secret': secret,
            'backup_codes': backup_codes,
            'method': method
        }
        
    def verify_and_enable_two_factor(self, user: User, code: str) -> bool:
        """Verify initial 2FA setup code and enable 2FA"""
        if not user.two_factor_secret:
            return False
        
        if self.verify_two_factor_code(user.two_factor_secret, code):
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
        self.db.commit()
        return True