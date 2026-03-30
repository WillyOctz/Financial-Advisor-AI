from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, desc, asc, or_, and_, text, union_all, select, literal_column, case
from sqlalchemy.sql import Select
import logging
from backend.models.database import Transaction, ExtractedTransactions, FinancialDocument, User, TransactionType

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
        """Get transactions history from database using efficient SQL query method
        
            in this implementation:
            1. build filtered subqueries for each table
            2. combines them with UNION ALL
            3. Applies ORDER BY and LIMIT/OFFSET at the SQL level
            4. Uses a seperate COUNT query for total
        """
        
        # build unified query using UNION ALL
        combined_query = self.build_combined_query(
            user_id=user_id,
            source=source,
            year=year,
            month=month,
            transaction_type=transaction_type,
            category=category,
            search=search
        )
        
        # materialise into a subquery so it can be referenced multiple times
        combined_subq = combined_query.subquery('combined_view')
        
        # count total rows 
        total_count = self.db.execute(
            select(func.count()).select_from(combined_subq)
        ).scalar()
        
        # apply pagination to the combined query
        offset = (page - 1) * per_page
        paginated_query = (
            select(combined_subq)
            .order_by(desc(combined_subq.c.date))
            .offset(offset)
            .limit(per_page)
        )
        
        # execute and fetch results
        results = self.db.execute(paginated_query).all()
        
        # convert to dictionaries
        transactions = [self.row_to_dict(row) for row in results]
        
        # calculate the pagination
        total_pages = (total_count + per_page - 1) // per_page
        
        # calculate summary (using efficient aggregation query)
        summary = self._calculate_summary(combined_subq=combined_subq)
        
        return {
            'transactions': transactions,
            'summary': summary,
            'pagination': {
                'page':page,
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
        
    def build_combined_query(
        self,
        user_id: int,
        source: str,
        year: Optional[int],
        month: Optional[int],
        transaction_type: str,
        category: Optional[str],
        search: Optional[str]
    ) -> Select:
        """Build a UNION ALL query combining Transactions and ExtractedTransactions tables."""
        
        queries = []
        
        # build transaction table query
        if source in ['all', 'transactions']:
            txn_query = self.build_transaction_query(
                user_id, year, month, transaction_type, category, search
            )
            queries.append(txn_query)
            
        # build extracted-transactions table query
        if source in ['all', 'extracted']:
            ext_query = self.build_extracted_query(
                user_id, year, month, transaction_type, category, search
            )
            queries.append(ext_query)
            
        # combine with UNION ALL
        if len(queries) == 0:
            # Return empty query if no source selected
            return Select(
                literal_column("0").label('id'),
                literal_column("'unknown'").label('source'),
                literal_column("CURRENT_TIMESTAMP").label('date'),
                literal_column("''").label('description'),
                literal_column("0.0").label('amount'),
                literal_column("'EXPENSE'").label('type'),
                literal_column("''").label('category'),
                literal_column("NULL").label('document_id'),
                literal_column("NULL").label('raw_text'),
                literal_column("NULL").label('extraction_date')
            ).where(text("1 = 0")) # always false condition
            
        elif len(queries) == 1:
            combined = queries[0]
            
        else:
            combined = union_all(*queries)
            
        # wrap in subquery and apply ORDER BY
        # Note : select from subquery to apply the ordering filter
        
        subq = combined.subquery('combined_transactions')
        
        final_query = select(
            subq.c.id,
            subq.c.source,
            subq.c.date,
            subq.c.description,
            subq.c.amount,
            subq.c.type,
            subq.c.category,
            subq.c.document_id,
            subq.c.raw_text,
            subq.c.extraction_date
        ).order_by(desc(subq.c.date))
        
        return final_query
    
    def build_transaction_query(
        self,
        user_id: int,
        year: Optional[int],
        month: Optional[int],
        transaction_type: str,
        category: Optional[str],
        search: Optional[str]
    ) -> Select:
        """build a filtered query for Transaction table"""
        
        query = select(
            Transaction.id.label('id'),
            literal_column("'transactions'").label('source'),
            Transaction.date.label('date'),
            Transaction.description.label('description'),
            Transaction.amount.label('amount'),
            Transaction.type.label('type'),
            Transaction.category.label('category'),
            Transaction.document_id.label('document_id'),
            literal_column("NULL").label('raw_text'),
            literal_column("NULL").label('extraction_date')
        ).where(
            and_(
                Transaction.user_id == user_id,
                Transaction.is_archived == False
            )
        )
        
        # apply filters
        query = self.apply_filters(query, Transaction, year, month, transaction_type, category, search)
        
        return query
    
    def build_extracted_query(
        self,
        user_id: int,
        year: Optional[int],
        month: Optional[int],
        transaction_type: str,
        category: Optional[str],
        search: Optional[str]
    ) -> Select:
        """Build a filtered query for extracted transactions"""
        
        query = select(
            ExtractedTransactions.id.label('id'),
            literal_column("'extracted'").label('source'),
            ExtractedTransactions.date.label('date'),
            ExtractedTransactions.description.label('description'),
            ExtractedTransactions.amount.label('amount'),
            ExtractedTransactions.type.label('type'),
            ExtractedTransactions.category.label('category'),
            ExtractedTransactions.document_id.label('document_id'),
            ExtractedTransactions.raw_text.label('raw_text'),
            ExtractedTransactions.extraction_date.label('extraction_date')
        ).where(
            and_(
                ExtractedTransactions.user_id == user_id,
                ExtractedTransactions.is_processed == True
            )
        )
        
        # apply filters
        query = self.apply_filters(query, ExtractedTransactions, year, month, transaction_type, category, search)
        
        return query
    
    def apply_filters(
        self,
        query: Select,
        model,
        year: Optional[int],
        month: Optional[int],
        transaction_type: str,
        category: Optional[str],
        search: Optional[str]
    ) -> Select:
        """Apply common filters to a query"""
        
        if year:
            query = query.where(extract('year', model.date) == year)
        
        if month:
            query = query.where(extract('month', model.date) == month)
        
        if transaction_type != 'all':
            query = query.where(model.type == transaction_type.upper())
        
        if category:
            query = query.where(model.category == category)
        
        if search:
            search_pattern = f"%{search}%"
            query = query.where(
                or_(
                    model.description.ilike(search_pattern),
                    model.category.ilike(search_pattern)
                )
            )
        
        return query
    
    def row_to_dict(self, row) -> Dict[str, Any]:
        """Convert a result row to a dictionary"""
        return {
            'id': row.id,
            'source': row.source,
            'date': row.date,
            'description': row.description,
            'amount': float(row.amount),
            'type': row.type if isinstance(row.type, str) else row.type.value,
            'category': row.category,
            'document_id': row.document_id,
            'raw_text': row.raw_text,
            'extraction_date': row.extraction_date,
        }
        
    def _calculate_summary(
        self,
        combined_subq,
    ) -> Dict[str, Any]:
        """Calculate summary using efficient SQL aggregation instead of loading all records by using the materialised subquery, so it may called once per request"""
        
        # create subquery
        subq = combined_subq
        
        # aggregate query for totals
        totals_query = select(
            func.count().label('total_count'),
            func.sum(
                case(
                    (subq.c.type == 'INCOME', subq.c.amount),
                    else_=0
                )
            ).label('total_income'),
            func.sum(
                case(
                    (subq.c.type == 'EXPENSE', func.abs(subq.c.amount)),
                    else_=0
                )
            ).label('total_expenses'),
            func.sum(
                case(
                    (subq.c.type == 'INCOME', 1),
                    else_=0
                )
            ).label('income_count'),
            func.sum(
                case(
                    (subq.c.type == 'EXPENSE', 1),
                    else_=0
                )
            ).label('expense_count')
        ).select_from(subq)
        
        result = self.db.execute(totals_query).first()
        
        total_income = float(result.total_income or 0)
        total_expenses = float(result.total_expenses or 0)
        total_count = int(result.total_count or 0)
        income_count = int(result.income_count or 0)
        expense_count = int(result.expense_count or 0)
        
        # get top categories (for expenses)
        top_categories_query = select(
            subq.c.category,
            func.sum(func.abs(subq.c.amount)).label('total_amount')
        ).where(
            and_(
                subq.c.type == 'EXPENSE',
                subq.c.category.isnot(None)
            )
        ).group_by(
            subq.c.category
        ).order_by(
            desc('total_amount')
        ).limit(5)
        
        top_categories_results = self.db.execute(top_categories_query).all()
        top_categories = [
            {'category': row.category, 'amount': float(row.total_amount)} for row in top_categories_results
        ]
        
        return {
            'total_income': total_income,
            'total_expenses': total_expenses,
            'net_savings': total_income - total_expenses,
            'transaction_count': total_count,
            'income_count': income_count,
            'expense_count': expense_count,
            'top_categories': top_categories
        }
        
    def get_extracted_documents_overview(
        self,
        user_id: int,
        year: Optional[int] = None
    ) -> Dict[str, Any]:
        """Export transactions to CSV format using efficient SQL Query"""
        
        # build base query with efficient joins and aggregations
        query = select(
            FinancialDocument.id.label('document_id'),
            FinancialDocument.filename,
            FinancialDocument.uploaded_at,
            ExtractedTransactions.extraction_date,
            func.count(ExtractedTransactions.id).label('transaction_count'),
            func.sum(func.abs(ExtractedTransactions.amount)).label('total_amount'),
            func.sum(
                func.case(
                    (ExtractedTransactions.type == TransactionType.INCOME, ExtractedTransactions.amount),
                    else_=0
                )
            ).label('income'),
            func.sum(
                func.case(
                    (ExtractedTransactions.type == TransactionType.EXPENSE, func.abs(ExtractedTransactions.amount)),
                    else_=0
                )
            ).label('expenses')
        ).select_from(
            ExtractedTransactions
        ).join(
            FinancialDocument,
            ExtractedTransactions.document_id == FinancialDocument.id
        ).where(
            ExtractedTransactions.user_id == user_id
        ).group_by(
            FinancialDocument.id,
            FinancialDocument.filename,
            FinancialDocument.uploaded_at,
            ExtractedTransactions.extraction_date
        )
        
        if year:
            query = query.where(ExtractedTransactions.year == year)
            
        # order by uploaded date
        query = query.order_by(desc(FinancialDocument.uploaded_at))
        
        # execute query
        results = self.db.execute(query).all()
        
        # convert to dictionaries
        documents = [
            {
                'document_id': row.document_id,
                'filename': row.filename,
                'uploaded_at': row.uploaded_at,
                'transaction_count': row.transaction_count,
                'total_amount': float(row.total_amount or 0),
                'income': float(row.income or 0),
                'expenses': float(row.expenses or 0),
                'extracted_at': row.extraction_date
            }
            for row in results
        ]
        
        # get total counts
        total_docs = len(documents)
        total_transactions = sum(doc['transaction_count'] for doc in documents)
        
        return {
            'documents': documents,
            'total_documents': total_docs,
            'total_extracted_transactions': total_transactions
        }
        
    def export_transactions_to_csv(self, user_id: int, year: Optional[int] = None) -> str:
        """Export transactions to CSV format using SQL query.
           Processes in batches to handle large datasets
        """
        
        try:
            # build query with all necessary columns
            query = select(
                Transaction.date,
                Transaction.description,
                Transaction.amount,
                Transaction.type,
                Transaction.category,
                Transaction.document_id
            ).where(
                Transaction.user_id == user_id
            )
            
            if year:
                query = query.where(extract('year', Transaction.date) == year)
                
            query = query.order_by(Transaction.date)
            
            # create CSV header
            csv_lines = ['Date,Description,Amount,Type,Category,Document Source']
            
            # processes in batches to avoid memory loss
            batch_size = 1000
            offset = 0
            
            while True:
                batch_query = query.offset(offset).limit(batch_size)
                transactions = self.db.execute(batch_query).all()
                
                if not transactions:
                    break
                
                for txn in transactions:
                    date_str = txn.date.strftime('%Y-%m-%d') if txn.date else ''
                    amount_str = f"{txn.amount:.2f}"
                    type_str = txn.type.value if hasattr(txn.type, 'value') else (txn.type)
                    category_str = txn.category or ''
                    doc_source = f"Document {txn.document_id}" if txn.document_id else ''
                    
                    # escape quotes and commas in description
                    description = txn.description or ''
                    if ',' in description or '""' in description:
                        description = description.replace('""', '""')
                        description = f"{description}"
                        
                    csv_lines.append(
                        f'{date_str},{description},{amount_str},{type_str},{category_str},{doc_source}'
                    )
                    
                offset += batch_size
                
                # prevent infinite loop
                if len(transactions) < batch_size:
                    break
                
            return '\n'.join(csv_lines)
        
        except Exception as e:
            logger.error(f"Error exporting transactions: {e}")
            raise
        
class TransactionQueryOptimizer:
    """Additional query optimization patterns for common use cases.
    These queries are designed to use database indexes effectively."""
    
    @staticmethod
    def get_monthly_aggregates(
        db: Session,
        user_id: int,
        year: int
    ) -> List[Dict[str, Any]]:
        """
        Get monthly aggregates efficiently using SQL GROUP BY.
        Uses indexes: idx_transactions_user_month, idx_transactions_user_date_type
        """
        query = select(
            extract('month', Transaction.date).label('month'),
            func.sum(
                func.case(
                    (Transaction.type == TransactionType.INCOME, Transaction.amount),
                    else_=0
                )
            ).label('income'),
            func.sum(
                func.case(
                    (Transaction.type == TransactionType.EXPENSE, func.abs(Transaction.amount)),
                    else_=0
                )
            ).label('expenses'),
            func.count().label('count')
        ).where(
            and_(
                Transaction.user_id == user_id,
                extract('year', Transaction.date) == year,
                Transaction.is_archived == False
            )
        ).group_by(
            extract('month', Transaction.date)
        ).order_by(
            'month'
        )
        
        results = db.execute(query).all()
        
        return [
            {
                'month': int(row.month),
                'income': float(row.income or 0),
                'expenses': float(row.expenses or 0),
                'net': float((row.income or 0) - (row.expenses or 0)),
                'count': int(row.count)
            }
            for row in results
        ]
    
    @staticmethod
    def get_category_breakdown(
        db: Session,
        user_id: int,
        year: Optional[int] = None,
        month: Optional[int] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Get category breakdown efficiently.
        Uses index: idx_transactions_category_user
        """
        query = select(
            Transaction.category,
            func.count().label('count'),
            func.sum(func.abs(Transaction.amount)).label('total_amount'),
            func.avg(func.abs(Transaction.amount)).label('avg_amount')
        ).where(
            and_(
                Transaction.user_id == user_id,
                Transaction.type == TransactionType.EXPENSE,
                Transaction.category.isnot(None),
                Transaction.is_archived == False
            )
        )
        
        if year:
            query = query.where(extract('year', Transaction.date) == year)
        if month:
            query = query.where(extract('month', Transaction.date) == month)
        
        query = query.group_by(
            Transaction.category
        ).order_by(
            desc('total_amount')
        ).limit(limit)
        
        results = db.execute(query).all()
        
        return [
            {
                'category': row.category,
                'count': int(row.count),
                'total_amount': float(row.total_amount or 0),
                'avg_amount': float(row.avg_amount or 0)
            }
            for row in results
        ]
    
    @staticmethod
    def search_transactions_efficient(
        db: Session,
        user_id: int,
        search_term: str,
        limit: int = 100,
        offset: int = 0
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Search transactions efficiently with pagination.
        Uses indexes when possible.
        """
        search_pattern = f"%{search_term}%"
        
        # Base query
        base_query = select(Transaction).where(
            and_(
                Transaction.user_id == user_id,
                Transaction.is_archived == False,
                or_(
                    Transaction.description.ilike(search_pattern),
                    Transaction.category.ilike(search_pattern)
                )
            )
        )
        
        # Count query
        count_query = select(func.count()).select_from(
            base_query.subquery()
        )
        total = db.execute(count_query).scalar()
        
        # Paginated query
        paginated_query = base_query.order_by(
            desc(Transaction.date)
        ).offset(offset).limit(limit)
        
        results = db.execute(paginated_query).scalars().all()
        
        transactions = [
            {
                'id': txn.id,
                'date': txn.date,
                'description': txn.description,
                'amount': float(txn.amount),
                'type': txn.type.value,
                'category': txn.category,
                'document_id': txn.document_id
            }
            for txn in results
        ]
        
        return transactions, total

        