from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Enum, JSON, Boolean, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
import enum

# pgvector
try:
    from pgvector.sqlalchemy import Vector
    PGVECTOR_AVAILABLE = True
except ImportError:
    Vector = None
    PGVECTOR_AVAILABLE = False

Base = declarative_base()

class TransactionType(enum.Enum):
    INCOME = "INCOME"
    EXPENSE = "EXPENSE" 

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    two_factor_enabled = Column(Boolean, default=False)
    two_factor_secret = Column(String(255), nullable=True)
    two_factor_backup_codes = Column(JSON, nullable=True)
    two_factor_method = Column(String(20), default='app') # can be change to sms, email or app
    phone_number = Column(String(20), nullable=True)
    first_name = Column(String(100))
    last_name = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    verification_token = Column(String(255), nullable=True)
    verification_token_expires = Column(DateTime(timezone=True), nullable=True)
    reset_token = Column(String(255), nullable=True)
    reset_token_expires = Column(DateTime(timezone=True), nullable=True)
    
    # user preferences
    language = Column(String(10), default='en', nullable=False, server_default='en')

class FinancialDocument(Base):
    __tablename__ = "financial_documents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    filename = Column(String(255), index=True, nullable=False)
    file_path = Column(String(500))
    file_url = Column(String(500))
    storage_type = Column(String(50), default='supabase')
    file_size = Column(Integer)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    processed = Column(Boolean, default=False)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    transaction_count = Column(Integer, default=0)
    
    __table_args__ = (
        Index('idx_documents_user_processed', 'user_id', 'processed', 'uploaded_at'),
        Index('idx_documents_filename_user', 'filename', 'user_id'),
    )

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, index=True, nullable=False)
    user_id = Column(Integer, index=True, nullable=False)
    date = Column(DateTime(timezone=True), nullable=False)
    description = Column(Text)
    amount = Column(Float, nullable=False)
    type = Column(Enum(TransactionType), nullable=False)
    category = Column(String(100))
    month = Column(String(7))
    transaction_hash = Column(String(64), unique=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_archived = Column(Boolean, default=False)
    archived_at = Column(DateTime(timezone=True), nullable=True)  
    
    __table_args__ = (
        Index('idx_transactions_user_date_type', 'user_id', 'date', 'type'),
        Index('idx_transactions_user_month', 'user_id', 'month'),
        Index('idx_transactions_date_amount', 'date', 'amount'),
        Index('idx_transactions_category_user', 'category', 'user_id'),
        Index('idx_transactions_document_user', 'document_id', 'user_id'),
        Index('idx_transactions_amount_type', 'amount', 'type')
    )
    
class ExtractedTransactions(Base):
    """Store the processed transactions from document extraction"""
    __tablename__ = "extracted_transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    document_id = Column(Integer, index=True, nullable=True)
    date = Column(DateTime(timezone=True), nullable=False)
    description = Column(Text)
    amount = Column(Float, nullable=False)
    type = Column(Enum(TransactionType), nullable=False)
    category = Column(String(100))
    raw_text = Column(Text)
    chunk_metadata = Column(JSON)
    extraction_date = Column(DateTime(timezone=True), server_default=func.now())
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    is_processed = Column(Boolean, default=True)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Indexing
    __table_args__ = (
        Index('idx_extracted_txn_user_date', 'user_id', 'date'),
        Index('idx_extracted_txn_user_year', 'user_id', 'year'),
        Index('idx_extracted_txn_document', 'document_id'),
    )

class MonthlySummary(Base):
    """Pre-calculated monthly summaries for performance"""
    __tablename__ = "monthly_summaries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    total_income = Column(Float, default=0)
    total_expenses = Column(Float, default=0)
    transaction_count = Column(Integer, default=0)
    top_category = Column(String(100), nullable=True)
    top_category_amount = Column(Float, nullable=True)
    calculated_at = Column(DateTime(timezone=True), server_default=func.now())

    # Ensure unique summary per user per month
    __table_args__ = (
        Index('idx_monthly_summaries_user_year_month', 'user_id', 'year', 'month', unique=True),
    )

class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, index=True, nullable=False)
    chunk_text = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    embeddings = Column(JSON) # Store vector embeddings
    embedding = Column(Vector(384) if PGVECTOR_AVAILABLE else JSON, nullable=True) # using 384-dim vector, can be changed 768-dim with different model
    chunk_metadata = Column(JSON) # Store additional metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        Index('idx_chunks_document_index', 'document_id', 'chunk_index'),
        Index('idx_chunks_created_document', 'created_at', 'document_id')
    )

class FinancialInsight(Base):
    __tablename__ = "financial_insights"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    insight_type = Column(String(50)) # 'spending_pattern', 'savings_oppurtunity', etc.
    insight_text = Column(Text, nullable=False)
    confidence_score = Column(Float)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())

class CategoryMapping(Base):
    __tablename__ = "category_mappings"
    
    id = Column(Integer, primary_key=True, index=True)
    keyword = Column(String(100), unique=True, nullable=False)
    category = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
class ModerationLogs(Base):
    """Logs all content moderation for event analysis"""
    __tablename__ = "moderation_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    query_text = Column(Text, nullable=False)
    is_approved = Column(Boolean, nullable=False)
    should_block = Column(Boolean, nullable=False)
    violation_type = Column(String(50), nullable=True)  # 'abuse', 'off_topic', 'unclear', etc.
    severity = Column(String(20), nullable=True)  # 'NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    topic_category = Column(String(50), nullable=True)  # 'financial', 'off_topic', 'greeting', etc.
    confidence = Column(Float, nullable=True)
    response_message = Column(Text, nullable=True)
    meta_data = Column(JSON, nullable=True)  # Store additional context
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        Index('idx_moderation_user_date', 'user_id', 'created_at'),
        Index('idx_moderation_violation', 'violation_type', 'severity'),
        Index('idx_moderation_blocked', 'should_block', 'created_at'),
    )
