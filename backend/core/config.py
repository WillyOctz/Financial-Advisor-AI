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

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # CORS
    ALLOWED_ORIGINS: list = ["http://localhost:8501", "http://127.0.0.1:8501", "http://localhost:3000", "http://127.0.0.1:3000"]

    # Embedding Model
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: str = ""

    # JWT Secret 
    JWT_SECRET: str = ""

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

    class Config:
        env_file = ".env"

settings = Settings()

