import time
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, scoped_session, Session
from sqlalchemy.pool import QueuePool, NullPool
from backend.core.config import settings
import logging
import os
import threading
from contextlib import contextmanager
from threading import local

from backend.models.database import CategoryMapping

# configure the logging
logging.basicConfig()
logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)

logger = logging.getLogger(__name__)

# thread local storage for session
_thread_local = local()
        
class DatabaseSessionManager:
    """Central database session management with connection pooling"""
    
    _instance = None
    _lock = threading.Lock()
    initialized = False
    _init_lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance.initialize()
                    
        return cls._instance
    
    def __init__(self):
        if not hasattr(self, 'engine'):
            self.initialize()
    
    def initialize(self):
        """initialize connection pool and session factory"""
        database_url = os.getenv("DB_URL", settings.DB_URL)
        if not database_url:
            raise ValueError("DB_URL environment variable not set")
        
        self.engine = create_engine(
            database_url,
            poolclass=QueuePool,
            pool_size=20,
            max_overflow=10,
            pool_timeout=30,
            pool_pre_ping=True,
            pool_recycle=3600, 
            echo=False,  # Set True for SQL debugging
            connect_args={
                'connect_timeout': 10,
                'keepalives': 1,
                'keepalives_idle': 30,
                'keepalives_interval': 10,
                'keepalives_count': 5
            }
        )
        
        # thread local session factory, each thread gets its own session
        self.session_factory = sessionmaker(
            bind=self.engine,
            autocommit=False,
            autoflush=False,
            expire_on_commit=False
        )
        
        # thread local storage for sessions
        self._thread_local = threading.local()
        
        # metrics for monitoring
        self.metrics = {
            'sessions_created': 0,
            'sessions_closed': 0,
            'active_sessions': 0,
            'connection_errors': 0,
            'deadlock_retries': 0
        }
        self.metrics_lock = threading.Lock()
        
    def initialize_database(self):
        """initialize database schema and default data"""
        
        with DatabaseSessionManager._init_lock:
            if DatabaseSessionManager.initialized:
                return
            
            logger.info("Initializing database schema and default data...")
            
            try:
                # create tables
                from backend.models.database import Base 
                #Base.metadata.drop_all(bind=self.engine) #-> for testing
                Base.metadata.create_all(bind=self.engine)
                
                # Then initialize default data
                self.initialize_default_data()
                
                DatabaseSessionManager._initialized = True
                logger.info("Database initialization complete.")
            
            except Exception as e:
                logger.error(f"❌ Database initialization failed: {e}")
                raise
                
    def initialize_default_data(self):
        """Initialize default data for mapping category"""
        with self.get_session() as db:
            try:
                default_mappings = [
                    {"keyword": "salary", "category": "Income"},
                    {"keyword": "wage", "category": "Income"},
                    {"keyword": "bonus", "category": "Income"},
                    {"keyword": "grocery", "category": "Food"},
                    {"keyword": "supermarket", "category": "Food"},
                    {"keyword": "restaurant", "category": "Dining"},
                    {"keyword": "cafe", "category": "Dining"},
                    {"keyword": "rent", "category": "Housing"},
                    {"keyword": "mortgage", "category": "Housing"},
                    {"keyword": "electricity", "category": "Utilities"},
                    {"keyword": "water", "category": "Utilities"},
                    {"keyword": "gas", "category": "Utilities"},
                    {"keyword": "gasoline", "category": "Transportation"},
                    {"keyword": "fuel", "category": "Transportation"},
                    {"keyword": "uber", "category": "Transportation"},
                    {"keyword": "lyft", "category": "Transportation"},
                    {"keyword": "movie", "category": "Entertainment"},
                    {"keyword": "netflix", "category": "Entertainment"},
                    {"keyword": "spotify", "category": "Entertainment"},
                ]
                
                for mapping in default_mappings:
                    existing = db.query(CategoryMapping).filter_by(keyword=mapping['keyword']).first()
                    if not existing:
                        db.add(CategoryMapping(**mapping))
                
                db.commit()
                logger.info("Database initialized with default category mappings.")
            
            except Exception as e:
                db.rollback()
                logger.error(f"Error initializing database: {e}")
                raise
            finally:
                db.close()
        
    @contextmanager
    def get_session(self, retry_deadlocks: bool = True, max_retries: int = 3):
        """Get a database session with automatic cleanup and deadlock retry"""
        
        session = None
        retry_count = 0
        
        while True:
            try:
                # create a new session
                session = self.session_factory()
                
                with self.metrics_lock:
                    self.metrics['sessions_created'] += 1
                    self.metrics['active_sessions'] += 1
                    
                # store in thread-local for nested contexts
                if not hasattr(self._thread_local, 'sessions'):
                    self._thread_local.sessions = []
                self._thread_local.sessions.append(session)
                
                yield session
                
                session.commit()
                break
            
            except Exception as e:
                if session:
                    session.rollback()
                    
                # check if we should retry on deadlock
                is_deadlock = self.is_deadlock_error(e)
                
                if retry_deadlocks and is_deadlock and retry_count < max_retries:
                    retry_count += 1
                    with self.metrics_lock:
                        self.metrics['deadlock_retries'] += 1
                        
                    wait_time = 0.1 * (2 ** retry_count)
                    logger.warning(f"Deadlock detected, retry {retry_count}/{max_retries} " f"after {wait_time:.2f}s")
                    time.sleep(wait_time)
                    continue
                
                # not retryable or out of retries
                logger.error(f"Database error: {e}")
                raise
            
            finally:
                if session:
                    # ensure session is closed
                    try:
                        session.close()
                    except Exception as e:
                        logger.error(f"Error closing session: {e}")
                        
                    # remove from thread-local
                    if hasattr(self._thread_local, 'sessions'):
                        try:
                            self._thread_local.sessions.remove(session)
                        except ValueError:
                            pass
                        
                    with self.metrics_lock:
                        self.metrics['sessions_closed'] += 1
                        self.metrics['active_sessions'] -= 1
                        
    @contextmanager
    def get_session_from_pool(self):
        """Use this for background tasks that need their own session"""
        
        with self.get_session() as session:
            yield session
            
    def is_deadlock_error(self, error: Exception):    
        """Detect Postgresql deadlock errors"""
        error_str = str(error).lower()
        
        return any([
            'deadlock detected' in error_str,
            'deadlock' in error_str and '40p01' in error_str,  # PostgreSQL deadlock code
            'could not serialize access' in error_str,
            '55p03' in error_str 
        ])
        
    def get_metrics(self) -> dict:
        """Get current pool metrics for monitoring"""
        with self.metrics_lock:
            metrics = self.metrics.copy()
            
        # add pool status from engine
        if hasattr(self.engine, 'pool'):
            pool = self.engine.pool
            metrics.update({
                'pool_size': pool.size(),
                'pool_checked_out': pool.checkedout(),
                'pool_overflow': pool.overflow(),
                'pool_available': getattr(pool, 'checkedin_connections', 0)
            })
        
        return metrics
    
    def close_all_sessions(self):
        """Emergency cleanup - close all sessions in current thread"""
        if hasattr(self._thread_local, 'sessions'):
            for session in self._thread_local.sessions[:]:
                try:
                    session.close()
                except Exception:
                    pass
            self._thread_local.sessions.clear()
            
    def health_check(self) -> bool:
        """Check database connectivity."""
        try:
            with self.get_session() as db:
                db.execute(text("SELECT 1"))
            return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False
        
# =============================================================================
# Singleton instance
# =============================================================================

db_manager = DatabaseSessionManager()
SessionLocal = db_manager.session_factory

__all__ = [
    'db_manager',
    'get_db',
    'get_background_session',
    'check_database_health',
    'SessionLocal',  # Added back for compatibility
]

# =============================================================================
# FastAPI dependency
# =============================================================================

def get_db():
    """FastAPI dependency that provides session."""
    with db_manager.get_session() as session:
        yield session


def get_background_session() -> Session:
    """
    Get session for background tasks.
    
    WARNING: Caller MUST close this session!
    Better to use context manager if possible.
    """
    return db_manager.session_factory()


# =============================================================================
# Health check endpoint helper
# =============================================================================

def check_database_health() -> dict:
    """Health check for database."""
    return {
        'status': 'healthy' if db_manager.health_check() else 'unhealthy',
        'metrics': db_manager.get_metrics(),
        'initialized': DatabaseSessionManager.initialized
    }        