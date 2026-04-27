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
async def setup_two_factor(
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
        
    # validate method
    if request.method not in ['app', 'email', 'sms']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid 2FA method. Must be 'app', 'email', or 'sms'"
        )
        
    # validate phone number for SMS
    if request.method == 'sms' and not request.phone_number:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number required for SMS 2FA"
        )
        
    try:
        setup_data = auth_service.enable_two_factor(
            user=current_user,
            method=request.method,
            phone_number=request.phone_number
        )
        
        # for email/sms methods, send initial OTP 
        if request.method in ['email', 'sms']:
            # Use '2fa_setup' purpose to differentiate from login OTPs
            otp_sent = await auth_service.send_2fa_otp(current_user, purpose="2fa_setup")
            
            if not otp_sent:
                # Rollback the 2FA setup if OTP sending fails
                current_user.two_factor_method = None
                current_user.two_factor_backup_codes = None
                current_user.phone_number = None if request.method == 'sms' else current_user.phone_number
                db.commit()
                
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to send verification code to your {request.method}. Please try again."
                )
            setup_data['verification_sent'] = True
            setup_data['message'] = f"Verification code sent to your {request.method}. Enter it to complete setup."
            
        return setup_data
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.post("/verify-setup")
async def verify_two_factor_setup(
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
        
    if not request.code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code required"
        )
        
    # verify and enable 2fa
    verified = await auth_service.verify_and_enable_two_factor(current_user, request.code)
    
    if verified:
        return {
            "message": f"2FA enabled successfully using {current_user.two_factor_method} method",
            "method": current_user.two_factor_method,
            "enabled": True
        }
    
    else:
        # get remaining attempts for OTP method (using 2fa_setup purpose)
        remaining = 0
        if current_user.two_factor_method in ['email', 'sms']:
            remaining = auth_service.otp_service.get_remaining_attempts(
                current_user.id,
                purpose="2fa_setup"
            )
            
        error_detail = "Invalid verification code"
        if remaining > 0:
            error_detail += f". {remaining} attempts remaining."
            
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_detail
        )
        
@router.post("/resend-setup-code")
async def resend_setup_code(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Resend verification OTP"""
    auth_service = AuthService(db)
    
    if current_user.two_factor_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA is already enabled"
        )
        
    if current_user.two_factor_method not in ['email', 'sms']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Code resend only available for email/SMS 2FA"
        )
    
    # Clear any existing rate limit for setup purpose to allow resend
    auth_service.otp_service.clear_rate_limit(current_user.id, purpose="2fa_setup")
    
    # send new OTP with setup purpose
    otp_sent = await auth_service.send_2fa_otp(current_user, purpose="2fa_setup")
    
    if not otp_sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification code. Please try again."
        )
        
    return {
        "message": f"New verification code sent to your {current_user.two_factor_method}",
        "method": current_user.two_factor_method
    }
        
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
        return {
            "message": "2FA disabled successfully",
            "enabled": False
        }
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
    remaining_backup_codes = 0
    if current_user.two_factor_backup_codes:
        remaining_backup_codes = len([
            code for code in current_user.two_factor_backup_codes
            if not code.get('used', False)
        ])
        
    return {
        "enabled": current_user.two_factor_enabled,
        "method": current_user.two_factor_method,
        "remaining_backup_codes": remaining_backup_codes,
        "phone_number": current_user.phone_number if current_user.two_factor_method == 'sms' else None
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
    
    return {
        "backup_codes": backup_codes,
        "message": "New backup codes generated. Store them securely - they won't be shown again."
    }
    
@router.put("/update-phone")
async def update_phone_number(
    phone_number: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update phone number for SMS 2FA"""
    auth_service = AuthService(db)
    
    if not current_user.two_factor_enabled or current_user.two_factor_method != 'sms':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SMS 2FA is not enabled"
        )
        
    # format and validate phone number
    try:
        formatted_phone = auth_service.sms_service.format_phone_number(phone_number)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid phone number format. Use E.164 format (e.g., +1234567890)"
        )
        
    # update phone number and disable 2FA temporarily for reverification
    current_user.phone_number = formatted_phone
    current_user.two_factor_enabled = False
    db.commit()
    
    # Clear any existing rate limit before sending verification
    auth_service.otp_service.clear_rate_limit(current_user.id, purpose="2fa_setup")
    
    # send verification to code to new number with setup purpose
    otp_sent = await auth_service.send_2fa_otp(current_user, purpose="2fa_setup")
    
    if not otp_sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification code to new number"
        )
    
    return {
        "message": "Phone number updated. Verification code sent. Please verify to re-enable 2FA.",
        "phone_number": formatted_phone,
        "requires_verification": True
    }