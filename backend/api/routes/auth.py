from fastapi import APIRouter, Depends, HTTPException, Request, status, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Dict, Any
from datetime import timedelta, datetime
from backend.db.session import get_db
from backend.services.auth_service import AuthService, SECRET_KEY, ALGORITHM
from backend.services.email_service import EmailService
from backend.models.database import User
from backend.models.schemas import (UserCreate, UserLogin, Token, UserResponse, 
VerificationConfirm, ResendVerification, ForgotPasswordRequest, ResetPasswordRequest, PasswordResetConfirm, TwoFactorVerifyRequest)
from jose import JWTError, jwt
from slowapi import Limiter
from backend.db.redis_client import cache
from slowapi.util import get_remote_address
import re

router = APIRouter(prefix="/auth", tags=["authentication"])
security = HTTPBearer()

# uses the limiter instance registered on main.py
limiter = Limiter(key_func=get_remote_address)

@router.post("/register", response_model=dict)
@limiter.limit("5/minute")
def register(request: Request ,user_data: UserCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):

    auth_service = AuthService(db)
    email_service = EmailService()
    
    try:
        # Create user with verification token
        user, verification_token = auth_service.create_user(user_data)

        # Send verification email in background
        background_tasks.add_task(
            email_service.send_verification_email,
            to_email=user.email,
            token=verification_token,
            username=f"{user.first_name} {user.last_name}"
        )

        return {
            "message": "Registration successful! Please check your email to verify your account.",
            "user_id": user.id,
            "email": user.email,
            "requires_verification": True
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
@router.post("/verify-email", response_model=dict)
def verify_email(
    verification_data: VerificationConfirm,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    auth_service = AuthService(db)
    email_service = EmailService()

    user = auth_service.verify_user_token(verification_data.token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token"
        )
    
    # Send welcome email
    background_tasks.add_task(
        email_service.send_welcome_email,
        to_email=user.email,
        username=f"{user.first_name} {user.last_name}"
    )

    return {
        "message": "Email verified successfully! You can now log in.",
        "email": user.email,
        "verified": True
    }

@router.post("/resend-verification", response_model=dict)
@limiter.limit("3/minute")
def resend_verification(
    request: Request,
    data: ResendVerification,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    auth_service = AuthService(db)
    email_service = EmailService()

    try:
        user, verification_token = auth_service.resend_verification(data.email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User not found"
            )
        
        # Resend verification email
        background_tasks.add_task(
            email_service.send_verification_email,
            to_email=user.email,
            token=verification_token,
            username=f"{user.first_name} {user.last_name}"
        )

        return {
            "message": "Verification email resent successfully!",
            "email": user.email
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.post("/forgot-password")
@limiter.limit("3/minute")
def forgot_password(request: Request ,data: ForgotPasswordRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Initiate password reset process"""
    auth_service = AuthService(db)
    email_service = EmailService()

    # Generate reset token
    user, reset_token = auth_service.initiate_password_reset(data.email)

    if user and reset_token:
        # Send reset email
        username = f"{user.first_name} {user.last_name}" if user.first_name else user.email
        email_sent = email_service.send_password_reset_email(
            to_email=user.email,
            token=reset_token,
            username=username
        )

        if email_sent:
            return {"message": "Password reset email sent. Please check your inbox."}
        
    # Always return success message even if email doesn't exist for security
    return {"message": "If your email exists in our system, you will receive a password reset link."}

@router.post("/reset-password")
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Reset password using token"""
    auth_service = AuthService(db)

    # Validate password strength
    password = request.new_password

    if len(password) < 8:
        raise HTTPException(
            status_code=400, 
            detail="Password must be at least 8 characters long"
        )
    
    # Check for at least one number
    if not re.search(r'\d', password):
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least one number (0-9)"
        )
    
    # Check for at least one symbol (in common regex pattern)
    if not re.search(r'[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]', password):
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least one special character (!@#$%^&* etc.)"
        )
    
    user = auth_service.reset_password(request.token, request.new_password)

    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    return {"message": "Password reset successful. You can now login with your new password."}

@router.get("/verify-reset-token/{token}")
def verify_reset_token(token: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Verify if reset token is valid"""
    auth_service = AuthService(db)
    user = auth_service.verify_reset_token(token)

    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    return {"valid": True, "email": user.email}
    

@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
def login(request: Request, login_data: UserLogin, db: Session = Depends(get_db)):
    auth_service = AuthService(db)
    
    try:
        user = auth_service.authenticate_user(login_data.email, login_data.password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )
    
    except ValueError as e:
        # Handle verification or activation errors
        if "verify your email" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=str(e),
                headers={"X-Verification-Required": "true"}
            )
        elif "deactivated" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=str(e)
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )
            
    # check if 2fa is enabled
    if user.two_factor_enabled:
        
        # return a token that used for 2fa authentication
        partial_token = auth_service.create_access_token(
            data={"sub": user.email, "user_id": user.id, "requires_2fa": True, "type": "partial_token"},
            expires_delta=timedelta(minutes=10) # expire for 2fa
        )
        
        return {
            "requires_2fa": True,
            "token_type": "bearer",
            "user": UserResponse.from_orm(user),
            "partial_token": partial_token,
            "message": "2FA verification required",
            "method": user.two_factor_method
        }
        
    # regular login from access token
    access_token = auth_service.create_access_token(
        data={"sub": user.email, "user_id": user.id, "requires_2fa": False, "type": "access_token"}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.from_orm(user),
        "requires_2fa": False
    }

@router.post("/verify-2fa")
@limiter.limit("5/minute")
def verify_two_factor(
    request: Request,
    verification_data: TwoFactorVerifyRequest,
    db: Session = Depends(get_db)
):
    """Verifying 2fa code after initial login"""
    auth_service = AuthService(db)
    
    try:
        # Decode partial token
        payload = jwt.decode(
            verification_data.partial_token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )
        
        if not payload.get("requires_2fa"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid token"
            )
            
        user_id = payload.get("user_id")
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
            
        # Try the backup code first
        if verification_data.backup_code:
            if auth_service.verify_backup_code(user, verification_data.backup_code):
                # Generate full access token
                access_token = auth_service.create_access_token(
                    data={"sub": user.email, "user_id": user.id, "requires_2fa": False}
                )
                
                return {
                    "access_token": access_token,
                    "token_type": "bearer",
                    "user": UserResponse.from_orm(user),
                    "user_backup_code": True
                }
                
        # Verify TOTP code
        if verification_data.code and user.two_factor_secret:
            if auth_service.verify_two_factor_code(user.two_factor_secret, verification_data.code):
                # Generate full access token
                access_token = auth_service.create_access_token(
                    data={"sub": user.email, "user_id": user.id, "requires_2fa": False}
                )
                
                return {
                    "access_token": access_token,
                    "token_type": "bearer",
                    "user": UserResponse.from_orm(user),
                    "user_backup_code": False
                }
                
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code"
        )
        
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired token"
        )

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)) -> User:
    
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        
        # check token type first
        if payload.get("type") == "partial_token":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="2FA verification required"
            )
            
        # check if token has already blacklisted
        jti = payload.get("jti")
        if jti:
            try:
                if cache.client.get(f"blocklist:jti:{jti}"):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Token has been revoked. Please log in again."
                    )
            except HTTPException:
                raise
            except Exception:
                pass
        
        email: str = payload.get("sub")
        user_id: int = payload.get("user_id")
        if email is None or user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
            
        user = db.query(User).filter(User.id == user_id).first()
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
            
        # Check if user is active
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is deactivated"
            )
        
        return user
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        ) 

@router.post("/logout")
def logout(credentials: HTTPAuthorizationCredentials = Depends(security), current_user: User = Depends(get_current_user)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        jti = payload.get("jti")
        exp = payload.get("exp")
        
        if jti and exp:
            # calculate how many seconds until this token expires
            ttl = int(exp - datetime.utcnow().timestamp())
            if ttl > 0:
                cache.client.setex(f"blocklist:jti:{jti}", ttl, "1")
                
    except Exception:
        pass
    
    return {"message": "Successfully logged out"}