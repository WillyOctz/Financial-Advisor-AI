from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from datetime import datetime
import sys
import os
import uuid
import asyncio
import logging
import psutil
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from backend.scheduler import start_schedulers

# Add the project root to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.core.config import settings
from backend.db.session import db_manager
from backend.models.database import Base
from backend.services.multi_document_services import multi_doc_processor
from backend.api.routes import documents, forecasting, display, auth, cache_monitor, transactions, predictive, two_factor, multi_documents, user_settings
from backend.scheduler import start_schedulers
from backend.config.smart_batch_rate_limit import global_rate_limiter, RateLimitConfig, RateLimitStrategy

logger = logging.getLogger(__name__)

# ======================Sentry Error Tracking===========================
sentry_dsn = os.getenv("SENTRY_DSN")
if sentry_dsn:
    sentry_sdk.init(
        dsn=sentry_dsn,
        integrations=[FastApiIntegration(), SqlalchemyIntegration()],
        traces_sample_rate=0.1,       # 10% of requests traced for performance
        environment=os.getenv("ENV", "production"),
        send_default_pii=False, # for sending password/tokens to sentry, absolutely don't
    )
    
    logger.info("Sentry error tracking enabled.")
else:
    logger.warning("SENTRY_DSN not set — error tracking disabled.")
    
# ======================HTTP Rate Limiter===========================
limiter = Limiter(key_func=get_remote_address, default_limits=[])

# =======================Lifespan Context Manager========================
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("=" * 50)
    print("STARTING FINANCIAL ADVISOR API")
    print("=" * 50)
    
    print("Initializing Database...")
    db_manager.initialize()
    
    print("Creating database tables...")
    db_manager.initialize_database()
    
    print("Starting Scheulders...")
    start_schedulers()
    
    # Rate limiter
    print("Configuring rate limiter...")
    rate_config = RateLimitConfig(
        max_requests_per_minute=5000,
        burst_capacity=200,
        strategy=RateLimitStrategy.ADAPTIVE,
        target_latency_ms=150
    )
    global_rate_limiter.config = rate_config
    print(f" Rate limiter: {rate_config.max_requests_per_minute} ops/min")
    
    # background monitoring
    print("Starting system monitor...")
    monitor_task = asyncio.create_task(monitor_system_health())
    
    # log system status
    memory = psutil.virtual_memory()
    print(f"System memory: {memory.percent}% used, {memory.available / (1024**3):.1f}GB free")
    
    print("=" * 50)
    print("Server Ready to accept Requests")
    print("=" * 50)
    
    yield
    
    # ======SERVER SHUTDOWN LOGS======
    print("=" * 50)
    print("SHUTTING DOWN FINANCIAL ADVISOR API...")
    print("=" * 50)
    
    # background monitor
    print("Stopping system monitor...")
    monitor_task.cancel()
    try:
        await monitor_task
    except asyncio.CancelledError:
        pass
    
    print("=" * 50)
    print("FINANCIAL ADVISOR API SHUTDOWN.")
    print("=" * 50)
    
# ===============Background Monitor=====================
async def monitor_system_health():
    while True:
        try:
            await asyncio.sleep(60)
            
            # get system metrics
            memory_percent = psutil.virtual_memory().percent
            cpu_percent = psutil.cpu_percent(interval=1)
            
            # get rate limiter status
            rate_status = global_rate_limiter.get_status()
            
            # get processor metrics
            processor_metrics = multi_doc_processor.get_system_metrics()
            
            # auto adjust based on memory
            if memory_percent > 85:
                old_limit = multi_doc_processor.max_concurrent_docs
                multi_doc_processor.max_concurrent_docs = max(1, old_limit - 1)
                print(f"High memory ({memory_percent}%), " f"reduced concurrent docs: {old_limit} → {multi_doc_processor.max_concurrent_docs}")
                
            elif memory_percent < 60 and multi_doc_processor.max_concurrent_docs < 5:
                old_limit = multi_doc_processor.max_concurrent_docs
                multi_doc_processor.max_concurrent_docs = min(5, old_limit + 1)
                print(f"Low memory ({memory_percent}%), " f"increased concurrent docs: {old_limit} → {multi_doc_processor.max_concurrent_docs}")
                
            # log status every 5 minutes
            if datetime.now().minute % 5 == 0:
                print(
                    f"SYSTEM STATUS: "
                    f"Mem={memory_percent}%, "
                    f"CPU={cpu_percent}%, "
                    f"Concurrent={processor_metrics['current_concurrent_tasks']}/"
                    f"{processor_metrics['max_concurrent_docs']}, "
                    f"Queue={processor_metrics['pending_tasks']}, "
                    f"Success={rate_status['metrics']['success_rate']:.1f}%"
                )
        
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Monitor error: {e}")
            await asyncio.sleep(30)

# =================FASTAPI API======================
app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ===========================Rate ID Middleware========================
@app.middleware("http")
async def add_request(request: Request, call_next):
    """Attach a short request ID to every request and response header, make it easy to trace"""
    request_id = str(uuid.uuid4())[:8]
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response

# ===========================CORS Middleware========================
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600
)

# =======================================Routers=====================================
app.include_router(documents.router, prefix="/api/v1")
app.include_router(multi_documents.router, prefix="/api/v1")
app.include_router(forecasting.router, prefix="/api/v1")
app.include_router(display.router, prefix="/api/v1")
app.include_router(predictive.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(transactions.router, prefix="/api/v1")
app.include_router(cache_monitor.router, prefix="/api/v1")
app.include_router(two_factor.router, prefix="/api/v1")
app.include_router(user_settings.router, prefix="/api/v1")

# ===========================HEALTH ENDPOINTS=========================
@app.get("/")
def read_root():
    return {
        "message": "Financial Advisor AI API is running",
        "version": "enhanced",
        "systems": {
            "rate_limiter": "active",
            "multi_doc_processor": "active",
            "max_concurrent_docs": multi_doc_processor.max_concurrent_docs
        }
    }
    
@app.get("/health")
async def health_check():
    """Enhanced health check with system status, Redis, Database""" 
    memory = psutil.virtual_memory()
    processor_metrics = multi_doc_processor.get_system_metrics()
    rate_status = global_rate_limiter.get_status()
    
    # Database
    from backend.db.session import check_database_health
    db_health = check_database_health()
    
    # Redis
    redis_status = "unavailable"
    try:
        from backend.db.redis_client import cache
        cache.ping()
        redis_status = "healthy"
    except Exception as e:
        redis_status = f"unhealthy: {str(e)[:60]}"
        logger.warning(f"Redis health check failed: {e}")
        
    # Overall status 
    overall = "healthy"
    if db_health["status"] != "healthy":
        overall = "degraded"
    if redis_status != "healthy":
        overall = "degraded"
    if memory.percent > 90:
        overall = "degraded"
        
    return {
        "status": overall,
        "timestamp": datetime.now().isoformat(),
        "dependencies": {
            "database": db_health["status"],
            "redis": redis_status,
        },
        "systems": {
            "rate_limiter": {
                "status": "active",
                "success_rate": f"{rate_status['metrics']['success_rate']:.1f}%",
                "current_rate": rate_status['current_rate_per_minute']
            },
            "multi_doc_processor": {
                "status": "active",
                "concurrent": f"{processor_metrics['current_concurrent_tasks']}/{processor_metrics['max_concurrent_docs']}",
                "queue": processor_metrics['pending_tasks'],
                "processed_total": processor_metrics['total_processed'],
                "transactions_total": processor_metrics['total_transactions']
            }
        },
        "system": {
            "memory_percent": memory.percent,
            "memory_available_gb": round(memory.available / (1024**3), 1),
            "cpu_percent": psutil.cpu_percent()
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)