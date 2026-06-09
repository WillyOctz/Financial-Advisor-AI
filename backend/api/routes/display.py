import traceback
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from backend.db.session import get_db
from backend.services.display_service import DisplayService
from backend.models.schemas import AIAdviceRequest, AIAdviceResponse
from backend.api.routes.auth import get_current_user
from backend.models.database import User, ModerationLogs


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

@router.get("/dashboard/{user_id}")
def get_dashboard_summary(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Dashboard home page to display current document data after uploading"""
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this user's data")
    
    display_service = DisplayService(db)
    
    # display today timeframe
    today_summary = display_service.get_financial_summary(user_id, "today")
    
    if today_summary.get("transaction_count", 0) > 0:
        today_summary["display_timeframe"] = "today"
        return today_summary
    
    # if it fails, show latest month
    month_summary = display_service.get_financial_summary(user_id, "latest_month")
    month_summary["display_timeframe"] =  "latest_month"
    
    return month_summary

@router.get("/analysis/{user_id}")
def get_analysis_summary(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Analysis page metrics endpoint.
    Returns current month, previous month, all-time totals and
    the real month-over-month percentage change for every metric card.
    """
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this user's data")

    try:
        display_service = DisplayService(db)
        return display_service.get_analysis_summary(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching analysis summary: {str(e)}")

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
        
        # validate custom_prompt if provided, if no custom prompt use the deault one
        user_query = request.custom_prompt if request.custom_prompt else "Provide financial advice based on my transactions"
        
        # rag service will check the queries and do the block 
        
        # get summary for addtional context
        summary = display_service.get_financial_summary(
            request.user_id, 
            timeframe="all_time"
        )

        # generate AI advice
        advice_response = display_service.generate_ai_advice(
            request.user_id,
            user_query
        )
        
        # check if the response is from moderation
        is_moderated_response = False
        if advice_response.advice:
            advice_lower = advice_response.advice.lower()
            
            moderation_keywords = [
                "content moderation",
                "i'm your financial advisor ai",
                "hello! i'm your financial advisor",
                "i'm specialized in financial management",
                "i didn't quite understand that",
                "i'm not sure i understand",
                "keep our conversation",
                "maintain a professional tone",
                "community guidelines",
                "goes against our",
                "please keep",
                "i work best when",
                "could you please ask",
                "try asking me about",
                "what financial question"
            ]
            
            is_moderated_response = any(keyword in advice_lower for keyword in moderation_keywords)
            
            # check to see insights contain moderateion message
            if advice_response.insights:
                for insight in advice_response.insights:
                    if any(keyword in insight.lower() for keyword in ["moderation", "greeting", "off-topic", "inappropriate"]):
                        is_moderated_response = True
                        break
        
        if is_moderated_response:
            return AIAdviceResponse(
                advice=advice_response.advice,
                insights=advice_response.insights,
                recommendations=advice_response.recommendations,
                generated_at=advice_response.generated_at,
                financial_health_score=None,
                key_metrics=None
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
                'expense_to_income_ratio': (summary['total_expenses'] / summary['total_income'] * 100)
                    if summary['total_income'] > 0 else 0,
                'essential_spending_ratio': (summary.get('essential_spending', 0) / summary['total_expenses'] * 100)
                    if summary['total_expenses'] > 0 else 0
            }
        )
        return enhanced_response
    except Exception as e:
        print(f"❌ Error generating advice: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error generating advice: {str(e)}")
    
@router.get("/moderation/stats/{user_id}")
def get_moderation_stats(
    user_id: int,
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get moderation statistics for user"""
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this user's data")
    
    try:
        # calculate data range
        start_date = datetime.now() - timedelta(days=days)
        
        total_queries = db.query(ModerationLogs).filter(
            ModerationLogs.user_id == user_id,
            ModerationLogs.created_at >= start_date
        ).count()
        
        blocked_queries = db.query(ModerationLogs).filter(
            ModerationLogs.user_id == user_id,
            ModerationLogs.should_block == True,
            ModerationLogs.created_at >= start_date
        ).count()
        
        # get violation
        violations = db.query(
            ModerationLogs.violation_type,
            func.count(ModerationLogs.id).label('count')
        ).filter(
            ModerationLogs.user_id == user_id,
            ModerationLogs.violation_type != None,
            ModerationLogs.created_at >= start_date
        ).group_by(ModerationLogs.violation_type).all()
        
        violation_breakdown = {v.violation_type: v.count for v in violations}
        
        # calculate rates
        approval_rate = ((total_queries - blocked_queries) / total_queries * 100) if total_queries > 0 else 100.0
        block_rate = (blocked_queries / total_queries * 100) if total_queries > 0 else 0.0
        
        return {
            "user_id": user_id,
            "timeframe_days": days,
            "total_queries": total_queries,
            "blocked_queries": blocked_queries,
            "approved_queries": total_queries - blocked_queries,
            "approval_rate": round(approval_rate, 2),
            "block_rate": round(block_rate, 2),
            "violation_breakdown": violation_breakdown
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching stats: {str(e)}")
    