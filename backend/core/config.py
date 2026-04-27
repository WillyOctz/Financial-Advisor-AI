from pydantic_settings import BaseSettings
from typing import Optional
import os

class Settings(BaseSettings):
    # Database
    DB_URL: str = ""

    # LLM
    GOOGLE_API_KEY: str = ""
    HUGGINGFACE_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    GROQ_API_KEY: str = ""

    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    REDIS_SSL: bool = False

    # CORS
    ALLOWED_ORIGINS: list = ["http://localhost:8501", "http://127.0.0.1:8501", "http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8000", "http://127.0.0.1:8000"]

    # Embedding Model
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: str = ""

    # JWT Secret 
    JWT_SECRET: str = ""
    TWO_FACTOR_ENCRYPTION_KEY: str = ""

    # App 
    APP_NAME: str = "AI Financial Advisor"
    DEBUG: bool = False

    # Email Services
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    BASE_URL: str = "http://localhost:3000"
    
    # Supabase Cloud Storage
    STORAGE_TYPE: str = ""
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    
    # Progress tracking settings
    PROGRESS_TTL_HOURS: int = 2 
    SSE_HEARTBEAT_INTERVAL: int = 10  
    SSE_CONNECTION_TIMEOUT: int = 600
    
    # Sentry
    SENTRY_DSN: str = ""
    
    # Email forwarding
    EMAIL_PROVIDER: str = ""
    BREVO_API_KEY: str = ""
    FROM_EMAIL: str = ""
    FROM_NAME: str = ""
    
    # SMS providing 
    SMS_PROVIDER: str = ""

    class Config:
        env_file = ".env"

settings = Settings()

