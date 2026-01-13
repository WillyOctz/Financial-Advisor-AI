from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum

class TransactionType(str, Enum):
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"

class TransactionBase(BaseModel):
    date: datetime
    description: str
    amount: float
    type: TransactionType
    category: Optional[str] = None

class TransactionCreate(TransactionBase):
    document_id: int
    user_id: int

class Transaction(TransactionBase):
    id: int
    month: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class DocumentUpload(BaseModel):
    filename: str
    user_id: int

class DocumentProcessed(BaseModel):
    id: int
    filename: str
    processed: bool
    transaction_count: int

class ChunkBase(BaseModel):
    chunk_text: str
    chunk_index: int
    chunk_metadata: Dict[str, Any]

class ChunkCreate(ChunkBase):
    document_id: int

class Chunk(ChunkBase):
    id: int
    embeddings: Optional[List[float]] = None

    class Config:
        from_attributes = True

class ForecastRequest(BaseModel):
    user_id: int
    periods: int = 6
    frequency: str = "M"

class ForecastInsight(BaseModel):
    type: str
    title: str
    description: str
    details: str
    action: str

class AccuracyMetrics(BaseModel):
    mae: float
    mape: float
    rmse: float
    mdape: float
    coverage: float
    interpretation: str
    confidence: str

class ForecastResponse(BaseModel):
    dates: List[str]
    values: List[float]
    confidence_upper: List[float]
    confidence_lower: List[float]
    historical_data: Optional[Dict[str, List]] = None
    seasonality_patterns: Optional[Dict[str, Any]] = None
    forecast_insights: Optional[List[ForecastInsight]] = None
    accuracy_metrics: Optional[AccuracyMetrics] = None
    metadata: Optional[Dict[str, Any]] = None
    component_analysis: Optional[Dict[str, Any]] = None
    visualizations: Optional[Dict[str, str]] = None
    recommendations: Optional[List[str]] = None

class ForecastScenario(BaseModel):
    baseline: ForecastResponse
    optimistic: Dict[str, List[float]]
    pessimistic: Dict[str, List[float]]
    comparison: Dict[str, float]

class AIAdviceRequest(BaseModel):
    user_id: int
    timeframe: str = "all_time" # or "all_time", "custom"
    custom_prompt: Optional[str] = None

class AIAdviceResponse(BaseModel):
    advice: str
    insights: List[str]
    recommendations: List[str]
    generated_at: datetime
    financial_health_score: Optional[int] = None
    key_metrics: Optional[Dict[str, Any]] = None
    risk_assessment: Optional[List[str]] = None
    improvement_opportunities: Optional[List[str]] = None

    class Config:
        from_attributes = True

class VectorSearchRequest(BaseModel):
    query: str
    user_id: int
    top_k: int = 5

class VectorSearchResponse(BaseModel):
    results: List[Dict[str, Any]]
    similarity_scores: List[float]

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    created_at: datetime
    is_verified: bool
    is_active: bool

    class Config:
        from_attributes = True

class VerificationRequest(BaseModel):
    email: EmailStr

class VerificationConfirm(BaseModel):
    token: str

class ResendVerification(BaseModel):
    email: EmailStr

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class PasswordResetConfirm(BaseModel):
    email: EmailStr
    token: str
    new_password: str

class Timeframe(str, Enum):
    DAY = "day"
    WEEK = "week"
    MONTH = "month"
    QUARTER = "quarter"
    YEAR = "year"

class TransactionFilter(BaseModel):
    year: Optional[int] = None
    month: Optional[int] = None
    transaction_type: Optional[str] = "all"
    category: Optional[str] = None
    search_query: Optional[str] = None
    page: int = 1
    per_page: int = 50

class CategoryBreakdown(BaseModel):
    category: str
    amount: float
    percentage: float
    count: int

class MonthlyBreakdown(BaseModel):
    month: int
    month_name: str
    income: float
    expenses: float
    net_savings: float
    transaction_count: int

class TransactionSummary(BaseModel):
    total_income: float
    total_expenses: float
    net_savings: float
    transaction_count: int
    avg_income: float
    avh_expense: float
    top_categories: List[CategoryBreakdown]
    income_by_month: List[Dict[str, Any]]
    expense_by_month: List[Dict[str, Any]]

class MonthlyTransactionsResponse(BaseModel):
    transactions: List[Transaction]
    pagination: Dict[str, Any]
    summary: TransactionSummary
    filters: Dict[str, Any]

class YearlyOverview(BaseModel):
    year: int
    total_income: float
    total_expenses: float
    net_savings: float
    savings_rate: float
    transaction_count: int
    monthly_breakdown: List[MonthlyBreakdown]
    category_distribution: List[CategoryBreakdown]
    avg_monthly_income: float
    avg_monthly_expenses: float

class SearchTransactionsRequest(BaseModel):
    query: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    limit: int = 100

class ExportTransactionsRequest(BaseModel):
    year: Optional[int] = None

class ArchiveTransactionsRequest(BaseModel):
    year: int
    
class ExtractedChunkBase(BaseModel):
    document_id: int
    chunk_index: int
    raw_text: str
    processed_text: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    year: int
    
class ExtractedChunkCreate(ExtractedChunkBase):
    user_id: int
    
class ExtractedChunk(ExtractedChunkBase):
    id: int
    user_id: int
    extraction_date: datetime
    is_archived: bool = False
    archived_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
        
class ExtractedChunkResponse(BaseModel):
    chunks: List[ExtractedChunk]
    total_chunks: int
    document_info: Dict[str,Any]
    year: int
    
class ArchiveExtractedChunksRequest(BaseModel):
    year: int