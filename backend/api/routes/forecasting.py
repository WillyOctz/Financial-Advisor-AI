from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from backend.db.session import get_db
from backend.services.forecasting_services import ForecastingService
from backend.models.schemas import ForecastRequest, ForecastResponse, ForecastScenario, ForecastInsight
from backend.api.routes.auth import get_current_user
from backend.db.redis_client import clear_user_forecast_cache
from backend.models.database import User
from typing import Optional
from fpdf import FPDF
from datetime import datetime

router = APIRouter(prefix="/forecast", tags=["forecasting"])

@router.post("/expenses/enhanced", response_model=ForecastResponse)
def forecast_expenses(
    request: ForecastRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate expense forecasts"""
    # Checking for the current user that logged in
    if current_user.id != request.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this user's data")

    try:
        forecasting_service = ForecastingService(db)
        forecast = forecasting_service.forecast_expenses(
            request.user_id,
            request.periods
        )
        return forecast
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Enhanced forecasting error: {str(e)}")
    
@router.post("/expenses/scenarios", response_model=ForecastScenario)
def forecast_expenses_scenarios(
    request: ForecastRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate multiple forecast scenarios"""
    # Checking for the current user that logged in
    if current_user.id != request.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this user's data")
        
    try:
        forecasting_service = ForecastingService(db)
        scenarios = forecasting_service.forecast_multiple_scenarios(
            request.user_id,
            request.periods
        )
        return scenarios
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scenario forecasting error: {str(e)}")
    
@router.get("/{user_id}/comparison")
def get_forecast_comparison(
    user_id: int,
    periods: Optional[int] = 6,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get forecast comparison with historical averages"""
    # Checking for the current user that logged in
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        forecasting_service = ForecastingService(db)

        # Get enhanced forecast
        forecast = forecasting_service.forecast_expenses(user_id, periods)

        # Calculate comparison metrics
        if forecast.historical_data and forecast.values:
            hist_avg = sum(forecast.historical_data['values']) / len(forecast.historical_data['values']) if forecast.historical_data['values'] else 0
            forecast_avg = sum(forecast.values) / len(forecast.values) if forecast.values else 0

            comparison = {
                "historical_average": hist_avg,
                "forecast_average": forecast_avg,
                "percentage_change": ((forecast_avg - hist_avg) / hist_avg * 100) if hist_avg > 0 else 0,
                "expected_total": sum(forecast.values),
                "highest_month": {
                    "date": forecast.dates[forecast.values.index(max(forecast.values))],
                    "value": max(forecast.values)
                },
                "lowest_month": {
                    "date": forecast.dates[forecast.values.index(min(forecast.values))],
                    "value": min(forecast.values)
                },
                "confidence_level": forecast.accuracy_metrics.confidence if forecast.accuracy_metrics else "medium"
            }

            return comparison
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison error: {str(e)}")
    

@router.get("/{user_id}/report")
def download_forecast_report(
    user_id: int,
    periods: Optional[int] = 6,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Download forecast report as PDF"""
    # Checking for the current user that logged in
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        forecasting_service = ForecastingService(db)
        forecast = forecasting_service.forecast_expenses(user_id, periods)

        # Create PDF report
        pdf = FPDF()
        pdf.add_page()

        # Add title
        pdf.set_font("Arial", 'B', 16)
        pdf.cell(0, 10, "Financial Forecast Report", ln=True, align='C')
        pdf.ln(5)

        # Add report details
        pdf.set_font("Arial", '', 12)
        pdf.cell(0, 10, f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", ln=True)
        pdf.cell(0, 10, f"User ID: {user_id}", ln=True)
        pdf.cell(0, 10, f"Forecast Period: {periods} months", ln=True)
        pdf.ln(10)

        # Add forecast summary
        pdf.set_font("Arial", 'B', 14)
        pdf.cell(0, 10, "Forecast Summary", ln=True)
        pdf.set_font("Arial", '', 12)

        if forecast.values:
            total_forecast = sum(forecast.values)
            avg_monthly = total_forecast / len(forecast.values)
            pdf.cell(0, 10, f"Total Forecasted Expenses: ${total_forecast:,.2f}", ln=True)
            pdf.cell(0, 10, f"Average Monthly: ${avg_monthly:,.2f}", ln=True)
            pdf.cell(0, 10, f"Highest Month: ${max(forecast.values):,.2f}", ln=True)
            pdf.cell(0, 10, f"Lowest Month: ${min(forecast.values):,.2f}", ln=True)

        pdf.ln(10)

        # Add accuracy insights
        if forecast.accuracy_metrics:
            pdf.set_font("Arial", 'B', 14)
            pdf.cell(0, 10, "Forecast Accuracy", ln=True)
            pdf.set_font("Arial", '', 12)
            pdf.cell(0, 10, f"Confidence Level: {forecast.accuracy_metrics.confidence.title()}", ln=True)
            pdf.cell(0, 10, f"Mean Absolute Percentage Error: {forecast.accuracy_metrics.mape:.2f}%", ln=True)
            pdf.cell(0, 10, f"Interpretation: {forecast.accuracy_metrics.interpretation}", ln=True)

        pdf.ln(10)

        # Add key insights
        if forecast.forecast_insights:
            pdf.set_font("Arial", 'B', 14)
            pdf.cell(0, 10, "Key Insights", ln=True)
            pdf.set_font("Arial", '', 12)
            for insight in forecast.forecast_insights[:3]:  # Limit to 3 insights
                pdf.cell(0, 10, f"• {insight.title}: {insight.description}", ln=True)

        pdf.ln(10)

        # Add recommendations
        if forecast.recommendations:
            pdf.set_font("Arial", 'B', 14)
            pdf.cell(0, 10, "Key Insights", ln=True)
            pdf.set_font("Arial", '', 12)
            for rec in forecast.recommendations[:3]:  # Limit to 3 recommendations
                pdf.cell(0, 10, f"• {rec}", ln=True)

        # Generate PDF content
        pdf_output = pdf.output(dest='S').encode('latin-1')

        return Response(
            content=pdf_output,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=forecast_report_{user_id}_{datetime.now().strftime('%Y%m%d')}.pdf"
            }
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation error: {str(e)}")
    
@router.delete("/{user_id}/cache")
def clear_forecast_cache(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Clear forecast cache for user"""
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        clear_user_forecast_cache(user_id)
        return {"message": "Forecast cache cleared succesfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cache clearing error: {str(e)}")
    
    