from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.db.session import get_db
from backend.api.routes.auth import get_current_user
from backend.models.database import User
from backend.models.schemas import (
    UserResponse,
    UserPreferencesUpdate,
    UserPreferencesResponse,
    UserProfileUpdate
)

router = APIRouter(prefix="/users", tags=["users"])

SUPPORTED_LANGUAGES = {
    "en", "id", "zh", "ms", "ar", "fr", "de", "es", "ja"
}

SUPPORTED_CURRENCIES = {
    "USD", "IDR"
}

@router.get("/me", response_model=UserResponse)
def get_current_user_profile(
    current_user: User = Depends(get_current_user)
):
    """Get the currently authenticated user's profile"""
    return current_user

@router.get("/preferences", response_model=UserPreferencesResponse)
def get_preferences(
    current_user: User = Depends(get_current_user)
):
    """Get user preferences (language, etc.)"""
    return UserPreferencesResponse(
        language=current_user.language or "en",
        currency=current_user.currency or "USD",
        two_factor_enabled=current_user.two_factor_enabled,
        two_factor_method=current_user.two_factor_method,
    )
    
@router.patch("/preferences", response_model=UserPreferencesResponse)
def update_preferences(
    data: UserPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update user preferences"""
    if data.language is not None:
        if data.language not in SUPPORTED_LANGUAGES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported language code '{data.language}'. " f"Supported: {sorted(SUPPORTED_LANGUAGES)}",
            )
        current_user.language = data.language
    
    if data.currency is not None:
        if data.currency not in SUPPORTED_CURRENCIES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported currency code '{data.currency}'. "
                       f"Supported: {sorted(SUPPORTED_CURRENCIES)}",
            )
        current_user.currency = data.currency
        
    db.commit()
    db.refresh(current_user)
    
    return UserPreferencesResponse(
        language=current_user.language,
        currency=current_user.currency,
        two_factor_enabled=current_user.two_factor_enabled,
        two_factor_method=current_user.two_factor_method,
    )
    
@router.patch("/profile", response_model=UserResponse)
def profile_update(
    data: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user profile name"""
    
    # validate first name
    if data.first_name is not None:
        if len(data.first_name.strip()) < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="First name cannot be empty"
            )
        if len(data.first_name) > 15:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="First name must be less than 15 characters"
            )

        current_user.first_name = data.first_name.strip()
        
    # validate last name
    if data.last_name is not None:
        if len(data.last_name.strip()) < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Last name cannot be empty"
            )
        if len(data.last_name) > 15:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Last name must be less than 15 characters"
            )
            
        current_user.last_name = data.last_name.strip()
        
    db.commit()
    db.refresh(current_user)
    
    return current_user