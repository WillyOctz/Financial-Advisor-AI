from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Enum, JSON, Boolean, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
import enum

Base = declarative_base()

class TransactionType(enum.Enum):
    INCOME = "INCOME"
    EXPENSE = "EXPENSE" 

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100))
    last_name = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    verification_token = Column(String(255), nullable=True)
    verification_token_expires = Column(DateTime(timezone=True), nullable=True)
    reset_token = Column(String(255), nullable=True)
    reset_token_expires = Column(DateTime(timezone=True), nullable=True)

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
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_archived = Column(Boolean, default=False)
    archived_at = Column(DateTime(timezone=True), nullable=True)  
    
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
    chunk_metadata = Column(JSON) # Store additional metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())

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
