from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.db.session import get_db
from backend.api.routes.auth import get_current_user
from backend.models.database import User
from backend.models.schemas import (
    UserResponse,
    UserPreferencesUpdate,
    UserPreferencesResponse,
)

router = APIRouter(prefix="/users", tags=["users"])

SUPPORTED_LANGUAGES = {
    "en", "id", "zh", "ms", "ar", "fr", "de", "es", "ja"
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
        
    db.commit()
    db.refresh(current_user)
    
    return UserPreferencesResponse(
        language=current_user.language,
        two_factor_enabled=current_user.two_factor_enabled,
        two_factor_method=current_user.two_factor_method,
    )