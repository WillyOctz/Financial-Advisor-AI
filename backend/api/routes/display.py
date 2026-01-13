import traceback
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.db.session import get_db
from backend.services.display_service import DisplayService
from backend.models.schemas import AIAdviceRequest, AIAdviceResponse
from backend.api.routes.auth import get_current_user
from backend.models.database import User

router = APIRouter(prefix="/display", tags=["display"])

@router.get("/summary/{user_id}")
def get_financial_summary(user_id: int,timeframe: str = "today" ,db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get financial summary for display"""
    # Verify user can only access their own summary
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this user's data")
    
    # Validate timeframe parameter
    valid_timeframes = ["today", "latest_month", "all_time"]
    if timeframe not in valid_timeframes:
        raise HTTPException(status_code=400, detail=f"Invalid timeframe. Must be one of: {valid_timeframes}")

    display_service = DisplayService(db)
    summary = display_service.get_financial_summary(user_id, timeframe)
    return summary

@router.post("/advice", response_model=AIAdviceResponse)
def get_ai_advice(
    request: AIAdviceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate AI financial advice with more enhanced analytics detail"""

    # Verify user can only request advice for themselves
    if current_user.id != request.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this user's data")
    
    try:
        display_service = DisplayService(db)
        
        # get summary for addtional context
        summary = display_service.get_financial_summary(
            request.user_id, 
            timeframe="all_time"
        )

        # generate AI advice
        advice_response = display_service.generate_ai_advice(
            request.user_id,
            request.custom_prompt
        )

        # enhance response with additional metrics
        enhanced_response = AIAdviceResponse(
            advice=advice_response.advice,
            insights=advice_response.insights,
            recommendations=advice_response.recommendations,
            generated_at=advice_response.generated_at,
            financial_health_score=summary.get('financial_health_score'),
            key_metrics={
                'savings_rate': summary.get('savings_rate'),
                'expense_to_income_ratio': (summary['total_expenses'] / summary['total_income'] * 10)
                    if summary['total_income'] > 0 else 0,
                'essential_spending_ratio': (summary.get('essential_spending', 0) / summary['total_expenses'] * 100)
                    if summary['total_expenses'] > 0 else 0
            }
        )
        return enhanced_response
    except Exception as e:
        print(f"❌ Error generating advice: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error generating advice: {str(e)}")