from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, desc, asc, or_, and_
import logging
from backend.models.database import Transaction, ExtractedTransactions, FinancialDocument, User

logger = logging.getLogger(__name__)

class TransactionsService:
    """Service for displaying transactions views after document extraction"""
    
    def __init__(self, db: Session):
        self.db = db
        
    def get_transaction_history(
        self,
        user_id: int,
        source: str = 'all',
        year: Optional[int] = None,
        month: Optional[int] = None,
        transaction_type: str = 'all',
        category: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        per_page: int = 50
    ) -> Dict[str, Any]:
        """Get transactions history from database"""
        
        # Build base queries
        transactions_query = self.db.query(Transaction).filter(
            Transaction.user_id == user_id,
            Transaction.is_archived == False
        )
        
        extracted_query = self.db.query(ExtractedTransactions).filter(
            ExtractedTransactions.user_id == user_id,
            ExtractedTransactions.is_processed == True
        )
        
        # Applying filters
        queries = []
        
        if source in ['all', 'transactions']:
            queries.append(('transactions', transactions_query))
            
        # Apply filter to each of the queries
        filtered_results = []
        
        for source_type, query in queries:
            if year:
                query = query.filter(extract('year', Transaction.date if source_type == 'transactions' else ExtractedTransactions.date) == year)
                
            if month:
                query = query.filter(extract('month', Transaction.date if source_type == 'transactions' else ExtractedTransactions.date) == month)
                
            if transaction_type != 'all':
                query = query.filter((Transaction if source_type == 'transactions' else ExtractedTransactions).type == transaction_type.upper())
                
            if category:
                query = query.filter((Transaction if source_type == 'transactions' else ExtractedTransactions).category == category)
                
            if search:
                search_pattern = f"%{search}%"
                query = query.filter(
                    or_(
                        (Transaction if source_type == 'transactions' else ExtractedTransactions).description.ilike(search_pattern),
                        (Transaction if source_type == 'transactions' else ExtractedTransactions).category.ilike(search_pattern)
                    )
                )
                
            results = query.order_by(desc(Transaction.date if source_type == 'transactions' else ExtractedTransactions.date)).all()
        
            for item in results:
                filtered_results.append({
                    'id': item.id,
                    'source': source_type,
                    'date': item.date,
                    'description': item.description,
                    'amount': float(item.amount),
                    'type': item.type.value,
                    'category': item.category,
                    'document_id': getattr(item, 'document_id', None),
                    'raw_text': getattr(item, 'raw_text', None) if source_type == 'extracted' else None,
                    'extraction_date': getattr(item, 'extraction_date', None) if source_type == 'extracted' else None,
                })
                
        # Sort the results by the date
        filtered_results.sort(key=lambda x:x['date'], reverse=True)
        
        # Apply the pagination
        total_count = len(filtered_results)
        total_pages = (total_count + per_page - 1) // per_page
        offset = (page - 1) * per_page
        paginated = filtered_results[offset:offset + per_page]
        
        # Calculating the summary
        summary = self._calculate_summary(filtered_results)
        
        return {
            'transactions': paginated,
            'summary': summary,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total_count,
                'total_pages': total_pages,
                'has_next': page < total_pages,
                'has_prev': page > 1
            },
            'filters': {
                'source': source,
                'year': year,
                'month': month,
                'transaction_type': transaction_type,
                'category': category,
                'search': search
            }
        }
        
    def _calculate_summary(self, transactions: List[Dict]) -> Dict[str, Any]:
        """Calculate summary from the transactions"""
        
        if not transactions:
            return {
                'total_income': 0.0,
                'total_expenses': 0.0,
                'net_savings': 0.0,
                'transaction_count': 0,
                'income_count': 0,
                'expense_count': 0,
                'top_categories': []
            }
            
        total_income = sum(t['amount'] for t in transactions if t['type'] == 'INCOME')
        total_expenses = sum(abs(t['amount']) for t in transactions if t['type'] == 'EXPENSE')
        
        category_totals = {}
        for t in transactions:
            if t['type'] == 'EXPENSE' and t['category']:
                category_totals[t['category']] = category_totals.get(t['category'], 0) + abs(t['amount'])
                
        top_categories = [
            {'category': cat, 'amount': amount} for cat, amount in sorted(category_totals.items(), key=lambda x:x[1], reverse=True)[:5]
        ]
        
        return {
            'total_income': float(total_income),
            'total_expenses': float(total_expenses),
            'net_savings': float(total_income - total_expenses),
            'transaction_count': len(transactions),
            'income_count': len([t for t in transactions if t['type'] == 'INCOME']),
            'expense_count': len([t for t in transactions if t['type'] == 'EXPENSE']),
            'top_categories': top_categories
        }
        
    def get_extracted_documents_overview(
        self,
        user_id: int,
        year: Optional[int] = None
    ) -> Dict[str, Any]:
        """get overview of extracted documents and their data"""
        
        query = self.db.query(ExtractedTransactions).filter(
            ExtractedTransactions.user_id == user_id
        )
        
        if year:
            query = query.filter(ExtractedTransactions.year == year)
            
        extracted_data = query.all()
        
        # Group by document
        documents = {}
        for item in extracted_data:
            doc_id = item.document_id
            if doc_id not in documents:
                doc = self.db.query(FinancialDocument).filter(
                    FinancialDocument.id == doc_id,
                    FinancialDocument.user_id == user_id
                ).first()
                
                if doc:
                    documents[doc_id] = {
                        'document_id': doc_id,
                        'filename': doc.filename,
                        'uploaded_at': doc.uploaded_at,
                        'transaction_count': 0,
                        'total_amount': 0.0,
                        'income': 0.0,
                        'expenses': 0.0,
                        'extracted_at': item.extraction_date
                    }
            
            if doc_id in documents:
                documents[doc_id]['transaction_count'] += 1
                documents[doc_id]['total_amount'] += abs(item.amount)
                if item.type.value == 'INCOME':
                    documents[doc_id]['income'] += item.amount
                else:
                    documents[doc_id]['expenses'] += abs(item.amount)
                    
        return {
            'documents': list(documents.values()),
            'total_documents': len(documents),
            'total_extracted_transactions': len(extracted_data)
        }
        
    def export_transactions_to_csv(self, user_id: int, year: Optional[int] = None) -> str:
        """Export transactions to CSV format"""
        try:
            query = self.db.query(Transaction).filter(Transaction.user_id == user_id)
            
            if year:
                query = query.filter(extract('year', Transaction.date) == year)
                
            transactions = query.order_by(Transaction.date).all()
            
            # Create CSV content
            csv_lines = []
            
            # Header
            csv_lines.append('Date,Description,Amount,Type,Category,Document Source')
            
            for txn in transactions:
                date_str = txn.date.strftime('%Y-%m-%d') if txn.date else ''
                amount_str = f"{txn.amount:.2f}"
                type_str = txn.type.value if txn.type else ''
                category_str = txn.category or ''
                doc_source = f"Document {txn.document_id}" if txn.document_id else ''
                
                # Escape quotes and commas in description
                description = txn.description or ''
                if ',' in description or '"' in description:
                    description = description.replace('"', '""')
                    description = f'"{description}"'
                    
                csv_lines.append(f'{date_str},{description},{amount_str},{type_str},{category_str},{doc_source}')
        
            return '\n'.join(csv_lines)
        
        except Exception as e:
            logger.error(f"Error exporting transactions: {e}")
            raise
    