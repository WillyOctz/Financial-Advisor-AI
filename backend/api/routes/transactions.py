from fastapi import APIRouter, Depends, HTTPException, Response, Query
from sqlalchemy.orm import Session
from typing import Optional, List, Any, Dict
from backend.db.session import get_db
from backend.services.transaction_view_services import TransactionViewService
from backend.services.transactions_service import TransactionsService
from backend.api.routes.auth import get_current_user
from backend.models.database import User
from backend.models.schemas import (
    ExtractedChunkResponse,
    ArchiveExtractedChunksRequest,
    MonthlyTransactionsResponse,
    YearlyOverview,
    SearchTransactionsRequest,
    ExportTransactionsRequest,
    ArchiveTransactionsRequest
)
import logging
import datetime

router = APIRouter()
logger = logging.getLogger(__name__)

# ============ TRANSACTION ENDPOINTS ============

@router.get("/transactions/history")
async def get_transaction_history(
    source: str = Query('transactions', description="Data source: transactions"),
    year: Optional[int] = Query(None, description="Filter by year"),
    month: Optional[int] = Query(None, description="Filter by month (1-12)"),
    type: str = Query('all', description="Transaction type: all, income, expense"),
    category: Optional[str] = Query(None, description="Filter by category"),
    search: Optional[str] = Query(None, description="Search query"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(50, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get the transactions history"""
    try:
        service = TransactionsService(db)
        result = service.get_transaction_history(
            user_id=current_user.id,
            source=source,
            year=year,
            month=month,
            transaction_type=type,
            category=category,
            search=search,
            page=page,
            per_page=per_page
        )
        
        return {
            "success": True,
            "data": result
        }
        
    except Exception as e:
        logger.error(f"Error getting transaction history: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch transaction history")
    
@router.get("/transactions/extracted-documents")
async def get_extracted_documents(
    year: Optional[int] = Query(None, description="Filter by year"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get the view of extracted documents"""
    try:
        service = TransactionsService(db)
        result = service.get_extracted_documents_overview(
            user_id=current_user.id,
            year=year
        )
        
        return {
            "success": True,
            "data": result
        }
        
    except Exception as e:
        logger.error(f"Error getting extracted documents: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch extracted documents")
    
@router.get("/transactions/export")
async def export_transactions(
    year: Optional[int] = Query(None, description="Export a specific year"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Method to export CSV"""
    try:
        service = TransactionsService(db)
        csv_content = service.export_transactions_to_csv(current_user.id, year)
        
        filename = f"transactions_{year if year else 'all'}_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        logger.error(f"Error exporting transactions: {e}")
        raise HTTPException(status_code=500, detail="Failed to export transactions")
    

        
