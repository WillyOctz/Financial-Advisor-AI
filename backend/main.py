from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sys
import os
from backend.scheduler import start_schedulers

# Add the project root to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.core.config import settings
from backend.db.session import engine, init_db
from backend.models.database import Base
from backend.api.routes import documents, forecasting, display, auth, cache_monitor, transactions, predictive

# Create database tables
#Base.metadata.drop_all(bind=engine)  # -> for development purposes
Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.APP_NAME)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include routers
app.include_router(documents.router, prefix="/api/v1")
app.include_router(forecasting.router, prefix="/api/v1")
app.include_router(display.router, prefix="/api/v1")
app.include_router(predictive.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(transactions.router, prefix="/api/v1")
app.include_router(cache_monitor.router, prefix="/api/v1")

@app.on_event("startup")
async def startup_event():
    init_db()
    start_schedulers()

@app.get("/")
def read_root():
    return {"message": "Financial Advisor AI API is running"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)