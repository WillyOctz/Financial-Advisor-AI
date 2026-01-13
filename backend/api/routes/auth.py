from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Dict, Any
from backend.db.session import get_db
from backend.services.auth_service import AuthService, SECRET_KEY, ALGORITHM
from backend.services.email_service import EmailService
from backend.models.database import User
from backend.models.schemas import (UserCreate, UserLogin, Token, UserResponse, 
VerificationConfirm, ResendVerification, ForgotPasswordRequest, ResetPasswordRequest, PasswordResetConfirm)
from jose import JWTError, jwt
import os
import re

router = APIRouter(prefix="/auth", tags=["authentication"])
security = HTTPBearer()


@router.post("/register", response_model=dict)
def register(user_data: UserCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):

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
def resend_verification(
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
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Initiate password reset process"""
    auth_service = AuthService(db)
    email_service = EmailService()

    # Generate reset token
    user, reset_token = auth_service.initiate_password_reset(request.email)

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
def login(login_data: UserLogin, db: Session = Depends(get_db)):
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
        
    access_token = auth_service.create_access_token(
        data={"sub": user.email, "user_id": user.id}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.from_orm(user)
    }


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    auth_service = AuthService(db)
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        user_id: int = payload.get("user_id")
        if email is None or user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
    except JWTError:
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
    return user

@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    return {"message": "Successfully Logged out"}