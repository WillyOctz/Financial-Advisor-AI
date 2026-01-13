from datetime import datetime, timedelta
from typing import Optional
from typing import Tuple
from datetime import datetime
from jose import JWTError, jwt
from passlib.context import CryptContext
from backend.services.cache_warmer import CacheWarmer
from backend.models.database import User
from backend.models.schemas import UserCreate, UserLogin
from sqlalchemy.orm import Session
import os
import secrets
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
VERIFICATION_TOKEN_EXPIRE_HOURS = 24

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

class AuthService:
    def __init__(self, db: Session):
        self.db = db

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)
    
    def get_password_hash(self, password: str) -> str:
        return pwd_context.hash(password)
    
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

        to_encode.update({"exp": expire})
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
            verification_token=verification_token,
            verification_token_expires=token_expires
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)

        return user, verification_token
    
    def verify_user_token(self, token: str) -> Optional[User]:
        """Verify user using token"""
        user = self.db.query(User).filter(
            User.verification_token == token,
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

        user.verification_token = verification_token
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
        user.reset_token = reset_token
        user.reset_token_expires = token_expires
        self.db.commit()

        return user, reset_token
    
    def verify_reset_token(self, token: str) -> Optional[User]:
        """Verify if reset token is valid"""
        user = self.db.query(User).filter(
            User.reset_token == token,
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
