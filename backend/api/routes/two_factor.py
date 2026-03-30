from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from backend.db.session import get_db
from backend.services.auth_service import AuthService
from backend.models.database import User
from backend.models.schemas import (
    TwoFactorEnableRequest,
    TwoFactorVerifyRequest,
    TwoFactorSetupResponse,
    TwoFactorDisableRequest
)
from backend.api.routes.auth import get_current_user

router = APIRouter(prefix="/2fa", tags=["two-factor-authentication"])

@router.post("/setup", response_model=TwoFactorSetupResponse)
def setup_two_factor(
    request: TwoFactorEnableRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Setup 2fa for user"""
    auth_service = AuthService(db)
    
    if current_user.two_factor_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA is already enabled"
        )
        
    setup_data = auth_service.enable_two_factor(
        user=current_user,
        method=request.method,
        phone_number=request.phone_number
    )
    
    return setup_data

@router.post("/verify-setup")
def verify_two_factor_setup(
    request: TwoFactorVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Verify setup 2fa code"""
    auth_service = AuthService(db)
    
    if current_user.two_factor_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA is already enabled"
        )
        
    if auth_service.verify_and_enable_two_factor(current_user, request.code):
        return {"message": "2FA enabled successfully"}
    
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code"
        )
        
@router.post("/disable")
def disable_two_factor(
    request: TwoFactorDisableRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Disable 2FA"""
    auth_service = AuthService(db)
    
    if not current_user.two_factor_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA is not enabled"
        )
        
    if auth_service.disable_two_factor(current_user, request.password):
        return {"message": "2FA disabled successfully"}
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid password"
        )
        
@router.get("/status")
def get_two_factor_status(
    current_user: User = Depends(get_current_user)
):
    """Get 2fa status"""
    
    return {
        "enabled": current_user.two_factor_enabled,
        "method": current_user.two_factor_method,
        "remaining_backup_codes": len([
            code for code in (current_user.two_factor_backup_codes or [])
            if not code.get('used', False)
        ]) if current_user.two_factor_backup_codes else 0
    }
    
@router.post("/generate-backup-codes")
def generate_new_backup_codes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate new backup codes"""
    auth_service = AuthService(db)
    
    if not current_user.two_factor_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA is not enabled"
        )
        
    backup_codes = auth_service.generate_backup_codes()
    backup_codes_objects = [{'code': code, 'used': False} for code in backup_codes]
    current_user.two_factor_backup_codes = backup_codes_objects
    db.commit()
    
    return {"backup_codes": backup_codes}