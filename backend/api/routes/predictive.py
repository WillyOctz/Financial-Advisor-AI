from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.db.session import get_db
from backend.services.predictive_analysis import PredictiveAnalysisService
from backend.api.routes.auth import get_current_user
from backend.models.database import User
from typing import Optional
from datetime import datetime, timedelta

router = APIRouter(prefix="/predictive", tags=["predictive"])

@router.get("/anomalies/{user_id}")
async def get_transactions_anomalies(
    user_id: int,
    window_days: Optional[int] = 90,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Detect anomalous transactions for a user"""
    
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    service = PredictiveAnalysisService(db)
    result = service.detect_anomalies(user_id, window_days)
    
    return {
        "user_id": user_id,
        "analysis_date": datetime.now().isoformat(),
        "window_days": window_days,
        **result
    }
    
@router.get("/risk-assessment/{user_id}")
async def get_financial_risk(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Calculate comprehensive financial risk score"""
    
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    service = PredictiveAnalysisService(db)
    result = service.calculate_financial_risk_score(user_id)
    
    return {
        "user_id": user_id,
        "analysis_date": datetime.now().isoformat(),
        **result
    }
    
@router.get("/future-risks/{user_id}")
async def get_future_risks(
    user_id: int,
    horizon_months: Optional[int] = 6,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Predict the incoming financial risks based on current pattern"""
    
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    service = PredictiveAnalysisService(db)
    result = service.predict_future_risks(user_id, horizon_months)
    
    return {
        "user_id": user_id,
        "horizon_months": horizon_months,
        "analysis_date": datetime.now().isoformat(),
        **result
    }
    
@router.get("/financial-status/{user_id}")
async def get_financial_health_status(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Displaying financial health check through combining all analysis"""
    
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    service = PredictiveAnalysisService(db)
    
    # run all analysis
    anomalies = service.detect_anomalies(user_id)
    risk_assessment = service.calculate_financial_risk_score(user_id)
    future_risks = service.predict_future_risks(user_id)
    
    # generate overall health score (0-100)
    risk_score = risk_assessment.get('risk_score', 0)
    health_score = max(0, 100 - risk_score)
    
    if health_score >= 80:
        health_status = "EXCELLENT"
    elif health_score >= 60:
        health_status = "GOOD"
    elif health_score >= 40:
        health_status = "FAIR"
    elif health_score >= 20:
        health_status = "POOR"
    else:
        health_status = "CRITICAL"
        
    priority_actions = []
    
    if risk_score >= 70:
        priority_actions.append("Immediate budget review and calculation")
    
    if anomalies.get('risk_score', 0) > 50:
        priority_actions.append("Investigate anomalous transactions")
        
    if len(future_risks.get('future_risks', [])) > 0:
        priority_actions.append("Address predicted future risks proactively and dig more info")
        
    return {
        "user_id": user_id,
        "analysis_date": datetime.now().isoformat(),
        "overall_health": {
            "score": health_score,
            "status": health_status,
            "risk_score": risk_score
        },
        "anomaly_analysis": anomalies,
        "risk_assessment": risk_assessment,
        "future_risk_prediction": future_risks,
        "priority_actions": priority_actions[:3],
        "next_review_recommended": "30 days" if risk_score > 50 else "90 days"
    }
