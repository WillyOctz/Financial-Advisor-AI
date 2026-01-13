from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from sqlalchemy import or_, extract
from backend.models.database import Transaction, ExtractedTransactions, FinancialDocument
import logging

logger = logging.getLogger(__name__)

class TransactionViewService:
    """Simple service for viewing transactions"""
    
    def __init__(self, db: Session):
        self.db = db
        
    def get_all_transactions(
        self,
        user_id: int,
        include_archived: bool = True,
        year: Optional[int] = None,
        month: Optional[int] = None,
        type_filter: Optional[str] = None,
        category: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        per_page: int = 50
    ) -> Dict[str, Any]:
        """Get all transactions method"""
        
        # Get active transactions
        active_query = self.db.query(Transaction).filter(
            Transaction.user_id == user_id,
            Transaction.is_archived == False
        )
        
        if year:
            active_query = active_query.filter(extract('year', Transaction.date) == year)
        if month:
            active_query = active_query.filter(extract('month', Transaction.date) == month)
        if type_filter and type_filter != 'all':
            active_query = active_query.filter(Transaction.type == type_filter)
        if category and category != 'all':
            active_query = active_query.filter(Transaction.category == category)
        if search:
            search_pattern = f"%{search}%"
            active_query = active_query.filter(
                or_(
                    Transaction.description.ilike(search_pattern),
                    Transaction.category.ilike(search_pattern)
                )
            )
            
        # Count and paginate
        total_active = active_query.count()
        offset = (page - 1) * per_page
        
        active_transactions = active_query.order_by(
            Transaction.date.desc()
        ).offset(offset).limit(per_page).all()
        
        # if archived included, get from TransactionLog
        archived_transactions = []
        if include_archived:
            archived_query = self.db.query(ExtractedTransactions).filter(
                ExtractedTransactions.user_id == user_id
            )
            
            # Apply the same filters
            if year:
                archived_query = archived_query.filter(ExtractedTransactions.year == year)
            if type_filter and type_filter != 'all':
                archived_query = archived_query.filter(ExtractedTransactions.type == type_filter)
            if category and category != 'all':
                archived_query = archived_query.filter(ExtractedTransactions.category == category)
            if search:
                search_pattern = f"%{search}%"
                archived_query = archived_query.filter(
                    or_(
                        ExtractedTransactions.description.ilike(search_pattern),
                        ExtractedTransactions.category.ilike(search_pattern)
                    )
                )
                
            archived_transactions = archived_query.order_by(
                ExtractedTransactions.date.desc()
            ).all()
            
            # Combine and format it
            all_transactions = []
            
            # and add the active transactions
            for txn in active_transactions:
                all_transactions.append({
                    'id': txn.id,
                    'source': 'active',
                    'date': txn.date,
                    'description': txn.description,
                    'amount': txn.amount,
                    'type': txn.type,
                    'category': txn.category,
                    'document_id': txn.document_id,
                    'is_archived': False
                })
                
            # also add the archived transactions
            for log in archived_transactions:
                all_transactions.append({
                    'id': log.id,
                    'source': 'archived',
                    'date': log.date,
                    'description': log.description,
                    'amount': log.amount,
                    'type': log.type,
                    'category': log.category,
                    'document_id': log.document_id,
                    'is_archived': True,
                    'archived_at': log.archived_at
                })
                
            # Sort by date (most recent first)
            all_transactions.sort(key=lambda x: x['date'], reverse=True)
            
            # Paginate the combined list
            total_count = len(all_transactions)
            paginated_transactions = all_transactions[offset:offset + per_page]
            
            # Get summary
            summary = self._get_summary(user_id, year, month)
            
            return {
                'transactions': paginated_transactions,
                'pagination': {
                    'page': page,
                    'total': total_count,
                    'total_pages': (total_count + per_page - 1) // per_page,
                    'has_next': offset + per_page < total_count,
                    'has_prev': page > 1
                },
                'summary': summary,
                'counts': {
                    'active': total_active,
                    'archived': len(archived_transactions),
                    'total': total_count
                }
            }
            
    def _get_summary(self, user_id: int, year: Optional[int] = None, month: Optional[int] = None):
        """Simple summary calculation"""
        # Query active transactions
        
        active_query = self.db.query(Transaction).filter(
            Transaction.user_id == user_id,
            Transaction.is_archived == False
        )
        
        if year:
            active_query = active_query.filter(extract('year', Transaction.date) == year)
        if month:
            active_query = active_query.filter(extract('month', Transaction.date) == month)
            
        active_txns = active_query.all()
        
        # Calculate totals
        total_income = sum(t.amount for t in active_txns if t.type.value == 'INCOME')
        total_expenses = sum(abs(t.amount) for t in active_txns if t.type.value == 'EXPENSE')
        
        return {
            'total_income': float(total_income),
            'total_expenses': float(total_expenses),
            'net_savings': float(total_income - total_expenses),
            'transaction_count': len(active_txns)
        }
        
        
             
        
                