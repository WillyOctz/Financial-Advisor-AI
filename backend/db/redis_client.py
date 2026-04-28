import asyncio
from contextlib import contextmanager
from enum import Enum
import redis
from redis import ConnectionPool, Redis
from redis.exceptions import RedisError, ConnectionError, TimeoutError, BusyLoadingError
from backend.core.config import settings
import json
import pickle
from typing import Any, Optional, List, Dict, Tuple, Union, Callable
import hashlib
from datetime import timedelta, datetime
import time
import logging
import os
from functools import cache, wraps
import threading
import numpy as np
import pandas as pd
import traceback
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

redis_client = redis.Redis.from_url(os.getenv("REDIS_URL"), decode_responses=True)

# =============================================================================
# CIRCUIT BREAKER IMPLEMENTATION
# =============================================================================

class CircuitState(Enum):
    """Circuit breaker states"""
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half-open"
    
class CircuitBreaker:
    """Circuit breaker implementation for redis operations"""
    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 30, half_open_max_calls: int = 3, name: str = "default"):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_calls = half_open_max_calls
        self.name = name
        
        # state 
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure_time = 0
        self.half_open_calls = 0
        
        # metrics
        self.total_failures = 0
        self.total_successes = 0
        self.total_rejections = 0
        self.last_state_change = time.time()
        
        # thread safety
        self.lock = threading.RLock()
        
        logger.info(f"Circuit breaker '{name}' initialized: threshold={failure_threshold}, timeout={recovery_timeout}s")

    def execute(self, operation_func: Callable, fallback_func: Optional[Callable] = None, *args, **kwargs) -> Any:
        """Execute operation with circuit breaker protection"""
        with self.lock:
            current_time = time.time()
            
            # check circuit state
            if self.state == CircuitState.OPEN:
                if current_time - self.last_failure_time > self.recovery_timeout:
                    # half open
                    self.transition_to(CircuitState.HALF_OPEN)
                    logger.info(f"Circuit '{self.name}' transitioning from OPEN to HALF_OPEN")
                else:
                    # circuit is open, reject request from any client
                    self.total_rejections += 1
                    logger.debug(f"Circuit '{self.name}' OPEN, request rejected")
                    
                    if fallback_func:
                        return fallback_func(*args, **kwargs)
                    raise Exception(f"Circuit breaker '{self.name}' is OPEN")
                
            if self.state == CircuitState.HALF_OPEN:
                if self.half_open_calls >= self.half_open_max_calls:
                    # too many test requests
                    self.total_rejections += 1
                    if fallback_func:
                        return fallback_func(*args, **kwargs)
                    raise Exception(f"Circuit '{self.name}' in HALF_OPEN, too many test requests")
                
                self.half_open_calls += 1
                
        # outside self.lock to prevent blocking 
        try:
            result = operation_func(*args, **kwargs)
            
            # success - close circuit if in half-open
            with self.lock:
                if self.state == CircuitState.HALF_OPEN:
                    self.transition_to(CircuitState.CLOSED)
                    logger.info(f"Circuit '{self.name}' recovered, closing")
                    
                self.total_successes += 1
                self.failure_count = 0
                
            return result
        
        except Exception as e:
            # failure - record and possibly open circuit
            with self.lock:
                self.failure_count += 1
                self.total_failures += 1
                self.last_failure_time = time.time()
                
                if self.state == CircuitState.HALF_OPEN:
                    # failed in half-open, go back to open
                    self.transition_to(CircuitState.OPEN)
                    logger.warning(f"Circuit '{self.name}' test failed, returning to OPEN")
                    
                elif self.state == CircuitState.CLOSED and self.failure_count >= self.failure_threshold:
                    # threshold exceeded, open circuit
                    self.transition_to(CircuitState.OPEN)
                    logger.error(f"Circuit '{self.name}' OPENED after {self.failure_count} failures")
                    
            if fallback_func:
                logger.debug(f"Using fallback for '{self.name}' after failure")
                return fallback_func(*args, **kwargs)
            
            raise
        
    def transition_to(self, new_state: CircuitState):
        """Transition to new state with logging"""
        old_state = self.state
        self.state = new_state
        self.last_state_change = time.time()
        
        if new_state == CircuitState.CLOSED:
            self.failure_count = 0
            self.half_open_calls = 0
        elif new_state == CircuitState.HALF_OPEN:
            self.half_open_calls = 0
            
        logger.debug(f"Circuit '{self.name}': {old_state.value} -> {new_state.value}")
        
    def get_status(self) -> Dict[str, Any]:
        """Get circuit breaker status"""
        with self.lock:
            return {
                'name': self.name,
                'state': self.state.value,
                'failure_count': self.failure_count,
                'failure_threshold': self.failure_threshold,
                'total_failures': self.total_failures,
                'total_successes': self.total_successes,
                'total_rejections': self.total_rejections,
                'success_rate': self.calculate_success_rate(),
                'state_duration': time.time() - self.last_state_change,
                'half_open_calls': self.half_open_calls if self.state == CircuitState.HALF_OPEN else 0
            }
            
    def calculate_success_rate(self) -> float:
        """Calculate success rate over recent operations"""
        total = self.total_successes + self.total_failures
        if total == 0:
            return 100.0
        return (self.total_successes / total) * 100
    
    def reset(self):
        """Reset circuit breaker to closed state"""
        with self.lock:
            self.state = CircuitState.CLOSED
            self.failure_count = 0
            self.half_open_calls = 0
            logger.info(f"Circuit '{self.name}' manually reset")
            
# =============================================================================
# CACHE METRICS COLLECTOR
# =============================================================================

class CacheMetrics:
    """Centralized metrics collection for cache operations"""
    
    _instance = None
    _lock = threading.RLock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance.init_metrics()
        return cls._instance
    
    def init_metrics(self):
        """Initialize metrics storage"""
        self.hits = 0
        self.misses = 0
        self.errors = 0
        self.operations = {
            'get': 0,
            'set': 0,
            'delete': 0,
            'batch_get': 0,
            'batch_set': 0,
            'exists': 0,
            'keys': 0
        }
        self.operation_times = {
            'get': [],
            'set': [],
            'delete': [],
            'batch_get': []
        }
        self.circuit_breakers = {}
        
        # category specific metrics
        self.category_hits = {}
        self.category_misses = {}
        
        # start time for uptime calculation
        self.start_time = time.time()
        
        # thread safety
        self.metrics_lock = threading.RLock()
        
    def record_hit(self, category: str = "unknown"):
        """Record a cache hit"""
        with self.metrics_lock:
            self.hits += 1
            self.operations['get'] += 1
            
            if category not in self.category_hits:
                self.category_hits[category] = 0
            self.category_hits[category] += 1
            
    def record_miss(self, category: str = "unknown"):
        """Record a cache miss"""
        with self.metrics_lock:
            self.misses += 1
            self.operations['get'] += 1
            
            if category not in self.category_misses:
                self.category_misses[category] = 0
            self.category_misses[category] += 1
            
    def record_error(self, operation: str):
        """Record an error"""
        with self.metrics_lock:
            self.errors += 1
            if operation in self.operations:
                self.operations[operation] += 1
                
    def record_operation(self, operation: str, duration_ms: float = None):
        """Record an operation"""
        with self.metrics_lock:
            if operation in self.operations:
                self.operations[operation] += 1
                
            if duration_ms and operation in self.operation_times:
                self.operation_times[operation].append(duration_ms)
                # keep only last 1000 samples
                if len(self.operation_times[operation]) > 1000:
                    self.operation_times[operation] = self.operation_times[operation][-1000:]
                    
    def register_circuit_breaker(self, name: str, circuit_breaker: CircuitBreaker):
        """Register a circuit breaker for monitoring"""
        with self.metrics_lock:
            self.circuit_breakers[name] = circuit_breaker
            
    def hit_rate(self) -> float:
        """Calculate overall hit rate"""
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0
    
    def category_hit_rate(self, category: str) -> float:
        """Calculate hit rate for a specific category"""
        hits = self.category_hits.get(category, 0)
        misses = self.category_misses.get(category, 0)
        total = hits + misses
        return hits / total if total > 0 else 0
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get comprehensive metrics"""
        with self.metrics_lock:
            # calculate average operation times
            avg_times = {}
            for op, times in self.operation_times.items():
                if times:
                    avg_times[op] = {
                        'avg_ms': sum(times) / len(times),
                        'p95_ms': sorted(times)[int(len(times) * 0.95)] if len(times) > 20 else 0,
                        'p99_ms': sorted(times)[int(len(times) * 0.99)] if len(times) > 100 else 0,
                        'samples': len(times)
                    }
                    
            # circuit breaker statuses
            circuit_status = {}
            for name, cb in self.circuit_breakers.items():
                circuit_status[name] = cb.get_status()
                
            # category hit rates
            category_stats = {}
            all_categories = set(self.category_hits.keys()) | set(self.category_misses.keys())
            for category in all_categories:
                hits = self.category_hits.get(category, 0)
                misses = self.category_misses.get(category, 0)
                total = hits + misses
                category_stats[category] = {
                    'hits': hits,
                    'misses': misses,
                    'hit_rate': hits / total if total > 0 else 0,
                    'total_requests': total
                }
                
            return {
                'hits': self.hits,
                'misses': self.misses,
                'errors': self.errors,
                'hit_rate': self.hit_rate(),
                'operations': self.operations.copy(),
                'total_operations': sum(self.operations.values()),
                'avg_times_ms': avg_times,
                'circuit_breakers': circuit_status,
                'category_stats': category_stats,
                'uptime_seconds': time.time() - self.start_time
            }          
            
# global metrics instance
cache_metrics = CacheMetrics()


# =============================================================================
# SERIALIZATION UTILITIES
# =============================================================================

class CacheSerializer:
    """Intelligent serializer for different data types"""
    
    @staticmethod
    def serialize(value: Any) -> bytes:
        """Serialize value to bytes based on type"""
        try:
            # handle numpy arrays
            if isinstance(value, np.ndarray):
                return pickle.dumps({
                    '__type__': 'numpy_array',
                    'data': value.tolist(),
                    'dtype': str(value.dtype)
                })
                
            # handle pandas dataframes, if its too large then cache the file path or query
            if isinstance(value, pd.DataFrame):
                logger.warning("Attempting to cache DataFrame - consider caching query instead")
                return pickle.dumps({
                    '__type__': 'dataframe_reference',
                    'shape': value.shape,
                    'columns': list(value.columns),
                    'warning': 'DataFrame too large for cache'
                })
                
            # handle datetime
            if isinstance(value, datetime):
                return pickle.dumps({
                    '__type__': 'datetime',
                    'value': value.isoformat()
                })
                
            # handle regular python objects
            return pickle.dumps(value)
        
        except Exception as e:
            logger.error(f"Serialization error: {e}")
            # fallback to JSON for simple types
            try:
                return json.dumps(value).encode('utf-8')
            except:
                raise ValueError(f"Cannot serialize value of type {type(value)}")
            
    @staticmethod
    def deserialize(data: bytes) -> Any:
        """Deserialize bytes back to original value"""
        try:
            value = pickle.loads(data)
            
            # check for special types
            if isinstance(value, dict) and '__type__' in value:
                if value['__type__'] == 'numpy_array':
                    return np.array(value['data'], dtype=value['dtype'])
                elif value['__type__'] == 'datetime':
                    return datetime.fromisoformat(value['value'])
                elif value['__type__'] == 'dataframe_reference':
                    logger.warning("Retrieved DataFrame reference from cache")
                    return None
                
            return value
        
        except (pickle.PickleError, EOFError):
            # try JSON as fallback
            try:
                return json.loads(data.decode('utf-8'))
            except:
                logger.error("Failed to deserialize cache data")
                return None
            

# =============================================================================
# CONNECTION POOL MANAGER
# =============================================================================

class RedisConnectionManager:
    """Manage redis connection pool with health checks and auto-recovery"""
    
    _instance = None
    _lock = threading.RLock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance.initialize()
        return cls._instance
    
    def initialize(self):
        """initialize connection pool and circuit breakers"""
        self.redis_url = settings.REDIS_URL if hasattr(settings, 'REDIS_URL') else os.getenv('REDIS_URL', 'redis://localhost:6379/0')
        
        # pool configuration
        self.pool_config = {
            'max_connections': int(50),
            'socket_timeout': float(5.0),
            'socket_connect_timeout': float(5.0),
            'socket_keepalive': True,
            'retry_on_timeout': True,
            'health_check_interval': int(30),
            'decode_responses': False,  # Keep as bytes for pickling
            'encoding': 'utf-8'
        }
        
        # circuit breaker for different operations
        self.circuit_breakers = {
            'read': CircuitBreaker(failure_threshold=5, recovery_timeout=30, name='redis_read'),
            'write': CircuitBreaker(failure_threshold=3, recovery_timeout=60, name='redis_write'),
            'batch': CircuitBreaker(failure_threshold=2, recovery_timeout=90, name='redis_batch')
        }
        
        # register with metrics
        for name, cb in self.circuit_breakers.items():
            cache_metrics.register_circuit_breaker(name, cb)
            
        # initialize pool
        self.pool = None
        self.connect_pool()
        
        # test connection
        self.test_connection()
        
        logger.info(f"Redis connection manager initialized: {self.pool_config}")
        
    def connect_pool(self):
        """Create or recreate connection pool"""
        try:
            self.pool = ConnectionPool.from_url(
                self.redis_url,
                **self.pool_config
            )
            logger.info(f"Redis connection pool created: max={self.pool_config['max_connections']}")
            
        except Exception as e:
            logger.error(f"Failed to create Redis pool: {e}")
            self.pool = None
            
    def test_connection(self):
        """Test Redis connection"""
        if not self.pool:
            return False
        
        try:
            client = Redis(connection_pool=self.pool)
            client.ping()
            logger.info("Redis connection test successful")
            return True
        except Exception as e:
            logger.error(f"Redis connection test failed: {e}")
            return False
        
    def get_client(self, operation: str = 'read') -> Optional[Redis]:
        """Get redis client from pool with circuit breaker"""
        def _get_client():
            if not self.pool:
                self.connect_pool()
                if not self.pool:
                    raise ConnectionError("No Redis connection pool")
                
            return Redis(connection_pool=self.pool)
        
        # use appropriate circuit breaker
        cb = self.circuit_breakers.get(operation, self.circuit_breakers['read'])
        
        try:
            return cb.execute(_get_client, fallback_func=lambda: None)
        except Exception as e:
            logger.error(f"Failed to get Redis client: {e}")
            return None
        
    @contextmanager
    def client_context(self, operation: str = 'read'):
        """Context manager for redis client"""
        client = self.get_client(operation)
        try:
            yield client
        finally:
            # connection returns to pool automatically
            pass
        
    def health_check(self) -> Dict[str, Any]:
        """Comprehensive health check"""
        result = {
            'status': 'unhealthy',
            'pool': None,
            'latency_ms': None,
            'circuit_breakers': {}
        }
        
        # checks pool
        if self.pool:
            result['pool'] = {
                'max_connections': self.pool.max_connections,
                'in_use_connections': getattr(self.pool, '_in_use_connections', 0),
                'available_connections': len(getattr(self.pool, '_available_connections', [])) if hasattr(self.pool, '_available_connections') else 0
            }
            
        # check circuit breakers
        for name, cb in self.circuit_breakers.items():
            result['circuit_breakers'][name] = cb.get_status()
            
        # test connection
        try:
            with self.client_context() as client:
                if client:
                    start = time.time()
                    client.ping()
                    latency = (time.time() - start) * 1000
                    result['latency_ms'] = round(latency, 2)
                    result['status'] = 'healthy'
        except Exception as e:
            result['error'] = str(e)
            
        return result
    
    def reset_circuit_breakers(self):
        """Reset all circuit breakers"""
        for cb in self.circuit_breakers.values():
            cb.reset()
        logger.info("All circuit breakers reset")
        
# =============================================================================
# MAIN CACHE CLASS
# =============================================================================

class RedisCache:
    def __init__(self):
        self.manager = RedisConnectionManager()
        self.serializer = CacheSerializer()
        self.metrics = cache_metrics
        self.CACHE_VERSION = "v2.0"
        
        # default TTLs by category (in seconds)
        self.default_ttl = {
            'embeddings': 7 * 24 * 3600,      # 7 days
            'forecast': 6 * 3600,              # 6 hours
            'ai_advice': 12 * 3600,            # 12 hours
            'financial_summary': 15 * 60,       # 15 minutes
            'transaction_data': 15 * 60,        # 15 minutes
            'document_processing': 24 * 3600,   # 24 hours
            'vector_search': 1 * 3600,          # 1 hour
            'user_sessions': 5 * 60,            # 5 minutes
            'category_mappings': 7 * 24 * 3600, # 7 days
            'temporary': 5 * 60,                 # 5 minutes
        }
        
        logger.info("RedisCache initialized with version %s", self.CACHE_VERSION)
        
    def build_key(self, category: str, key: str) -> str:
        """Build versioned cache key"""
        return f"{self.CACHE_VERSION}:{category}:{key}"
    
    def get_ttl(self, category: str, ttl: Optional[Union[int, timedelta]] = None) -> Optional[int]:
        """Get TTL in seconds"""
        if ttl is None:
            ttl = self.default_ttl.get(category)
            if ttl is None:
                return None
            
        if isinstance(ttl, timedelta):
            return int(ttl.total_seconds())
        
        return int(ttl) if ttl else None
    
    # =========================================================================
    # CORE OPERATIONS
    # =========================================================================
    
    def get(self, category: str, key: str, fallback: Any = None) -> Any:
        """Get value from cache, args:
                category: Cache category (embeddings, forecast and etc.)
                key: Cache key
                fallback: value to return if cache miss or error
        """
        cache_key = self.build_key(category, key)
        start_time = time.time()
        
        def _get():
            with self.manager.client_context('read') as client:
                if not client:
                    return None
                
                data = client.get(cache_key)
                
                if data:
                    self.metrics.record_hit(category)
                    return self.serializer.deserialize(data)
                else:
                    self.metrics.record_miss(category)
                    return None
                
        # execute with circuit breaker
        cb = self.manager.circuit_breakers['read']
        
        try:
            result = cb.execute(_get)
            
            duration = (time.time() - start_time) * 1000
            self.metrics.record_operation('get', duration)
            
            return result if result is not None else fallback
        
        except Exception as e:
            self.metrics.record_error('get')
            logger.warning(f"Cache get failed for {category}:{key}: {e}")
            return fallback
        
    def set(self, category: str, key: str, value: Any, ttl: Optional[Union[int, timedelta]] = None, nx: bool = False) -> bool:
        """Set value in cache"""
        cache_key = self.build_key(category, key)
        start_time = time.time()
        seconds = self.get_ttl(category, ttl)
        
        def _set():
            with self.manager.client_context('write') as client:
                if not client:
                    return False
                
                serialized = self.serializer.serialize(value)
                
                if seconds:
                    if nx:
                        return bool(client.set(cache_key, serialized, ex=seconds, nx=True))
                    else:
                        return bool(client.setex(cache_key, seconds, serialized))
                    
                else:
                    return bool(client.set(cache_key, serialized, nx=nx))
                
        # execute with circuit breaker
        cb = self.manager.circuit_breakers['write']
        
        try:
            result = cb.execute(_set)
            
            duration = (time.time() - start_time) * 1000
            self.metrics.record_operation('set', duration)
            
            return result
        
        except Exception as e:
            self.metrics.record_error('set')
            logger.warning(f"Cache set failed for {category}:{key}: {e}")
            return False
        
    def delete(self, category: str, key: str) -> bool:
        """Delete cache entry"""
        cache_key = self.build_key(category, key)
        
        def _delete():
            with self.manager.client_context('write') as client:
                if not client:
                    return False
                return bool(client.delete(cache_key))
            
        cb = self.manager.circuit_breakers['write']
        
        try:
            result = cb.execute(_delete)
            self.metrics.record_operation('delete')
            return result
        except Exception as e:
            self.metrics.record_error('delete')
            logger.warning(f"Cache delete failed for {category}:{key}: {e}")
            return False
        
    def exists(self, category: str, key: str) -> bool:
        """Check if cache key exists"""
        cache_key = self.build_key(category, key)
        
        def _exists():
            with self.manager.client_context('read') as client:
                if not client:
                    return False
                return bool(client.exists(cache_key))
            
        cb = self.manager.circuit_breakers['read']
        
        try:
            result = cb.execute(_exists)
            self.metrics.record_operation('exists')
            return result
        except Exception as e:
            self.metrics.record_error('exists')
            return False
        
    # =========================================================================
    # BATCH OPERATIONS
    # =========================================================================
    
    def batch_get(self, items: List[Tuple[str, str]]) -> List[Any]:
        """Get multiple cache items in one operation"""
        if not items:
            return []
        
        # build cache keys
        cache_keys = [self.build_key(cat, key) for cat, key in items]
        
        def _batch_get():
            with self.manager.client_context('batch') as client:
                if not client:
                    return [None] * len(items)
                
                data_list = client.mget(cache_keys)
                results = []
                
                for i, data in enumerate(data_list):
                    if data:
                        self.metrics.record_hit(items[i][0])
                        results.append(self.serializer.deserialize(data))
                    else:
                        self.metrics.record_miss(items[i][0])
                        results.append(None)
                
                return results
            
        cb = self.manager.circuit_breakers['batch']
        
        try:
            result = cb.execute(_batch_get)
            self.metrics.record_operation('batch_get')
            return result
        except Exception as e:
            self.metrics.record_error('batch_get')
            logger.warning(f"Batch get failed: {e}")
            return [None] * len(items)
        
    def batch_set(self, items: List[Tuple[str, str, Any]], ttl: Optional[Union[int, timedelta]] = None) -> bool:
        """Set multiple cache items in one operation."""
        if not items:
            return True
        
        seconds = self.get_ttl(items[0][0], ttl) if items else None
        
        def _batch_set():
            with self.manager.client_context('batch') as client:
                if not client:
                    return False
                
            pipe = client.pipeline()
            
            for category, key, value in items:
                cache_key = self.build_key(category, key)
                serialized = self.serializer.serialize(value)
                
                if seconds:
                    pipe.setex(cache_key, seconds, serialized)
                else:
                    pipe.set(cache_key, serialized)
                    
            # execute all commands
            results = pipe.execute()
            
            # count successes
            success_count = sum(1 for r in results if r)
            
            if success_count < len(items):
                logger.warning(f"Batch set partial success: {success_count}/{len(items)}")
                
            return success_count == len(items)
        
        cb = self.manager.circuit_breakers['batch']
        
        try:
            result = cb.execute(_batch_set)
            self.metrics.record_operation('batch_set')
            return result
        except Exception as e:
            self.metrics.record_error('batch_set')
            logger.warning(f"Batch set failed: {e}")
            return False
        
    # =========================================================================
    # SPECIALIZED CACHE METHODS
    # =========================================================================
    
    def cache_embeddings(self, chunk_id: int, embeddings: Union[List[float], np.ndarray], ttl: int = 604800) -> bool:
        """Cache embeddings for a document chunk, purpose to save generating embeddings each time so we cache it for 7 days long"""
        
        # convert numpy to list for consistent storage
        if isinstance(embeddings, np.ndarray):
            embeddings = embeddings.tolist()
            
        return self.set('embeddings', f"chunk:{chunk_id}", embeddings, ttl=ttl)
    
    def get_cached_embeddings(self, chunk_id: int) -> Optional[Union[List[float], np.ndarray]]:
        """Get cached embeddings"""
        return self.get('embeddings', f"chunk: {chunk_id}")
    
    def cache_text_embeddings(self, text_hash: str, embeddings: Union[List[float], np.ndarray], ttl: int = 604800) -> bool:
        """Cache embeddings by text hash to avoid regenerating for same text"""
        if isinstance(embeddings, np.ndarray):
            embeddings = embeddings.tolist()
            
        return self.set('embeddings', f"text: {text_hash}", embeddings, ttl=ttl)
    
    def get_cached_text_embeddings(self, text: str) -> Optional[Union[List[float], np.ndarray]]:
        """Get cached embeddings by text context"""
        text_hash = hashlib.md5(text.encode()).hexdigest()
        return self.get('embeddings', f"text:{text_hash}")
    
    # -------------------------------------------------------------------------
    # Forecast caching
    # -------------------------------------------------------------------------
    
    def cache_forecast(self, user_id: int, forecast_data: dict, ttl: int = 21600) -> bool:
        """Cache forecast data"""
        return self.set('forecast', f"user:{user_id}", forecast_data, ttl=ttl)
    
    def get_cached_forecast(self, user_id: int) -> Optional[dict]:
        """Get cached forecast"""
        return self.get('forecast', f"user:{user_id}")
    
    # -------------------------------------------------------------------------
    # AI Advice caching
    # -------------------------------------------------------------------------
    
    def cache_ai_advice(self, user_id: int, timeframe: str, advice_data: dict, ttl: int = 43200) -> bool:
        """Cache AI generated financial data"""
        key = f"{user_id}: {timeframe}"
        return self.set('ai advice', key, advice_data, ttl=ttl)
    
    def get_cached_ai_advice(self, user_id: int, timeframe: str) -> Optional[dict]:
        """Get cache AI Advice"""
        key = f"{user_id}: {timeframe}"
        return self.get('ai_advice', key)
    
    # -------------------------------------------------------------------------
    # Vector search caching
    # -------------------------------------------------------------------------
    
    def cache_search_results(self, user_id: int, query_hash: str, results: List[Dict], ttl: int = 3600) -> bool:
        """Cache vector search results"""
        key = f"{user_id}:{query_hash}"
        return self.set('vector_search', key, results, ttl=ttl)
    
    def get_cached_search_results(self, user_id: int, query: str) -> Optional[List[Dict]]:
        """Get cached search results"""
        query_hash = hashlib.md5(query.encode()).hexdigest()
        key = f"{user_id}:{query_hash}"
        return self.get('vector_search', key)
    
    # -------------------------------------------------------------------------
    # Financial summary caching
    # -------------------------------------------------------------------------
    
    def cache_financial_summary(self, user_id: int, year: int, month: Optional[int], summary_data: dict, ttl: int = 900) -> bool:
        """Cache financial summary"""
        if month:
            key = f"{user_id}:{year}:{month}"
        else:
            key = f"{user_id}:{year}:annual"
            
        return self.set('financial_summary', key, summary_data, ttl=ttl)
    
    def get_cached_financial_summary(self, user_id: int, year: int, month: Optional[int] = None) -> Optional[dict]:
        """Get cached financial summary"""
        if month:
            key = f"{user_id}:{year}:{month}"
        else:
            key = f"{user_id}:{year}:annual"
            
        return self.get('financial_summary', key)
    
    # -------------------------------------------------------------------------
    # Transaction data caching
    # -------------------------------------------------------------------------
    
    def cache_recent_transactions(self, user_id: int, transactions: List[Dict], ttl: int = 900) -> bool:
        """Cache recent transactions"""
        return self.set('transaction_data', f"recent:{user_id}", transactions, ttl=ttl)
    
    def get_cached_recent_transactions(self, user_id: int) -> Optional[List[Dict]]:
        """Get cached recent trasanctions"""
        return self.get('transaction_data', f"recent: {user_id}")
    
    # -------------------------------------------------------------------------
    # Category mappings caching
    # -------------------------------------------------------------------------
    
    def cache_category_mappings(self, mappings: List[Dict], ttl: int = 604800) -> bool:
        """Cache category mappings"""
        return self.set('category_mappings', 'global', mappings, ttl=ttl)
    
    def get_cached_category_mappings(self) -> Optional[List[Dict]]:
        """Get cached category mappings"""
        return self.get('category_mappings', 'global')
    
    # =========================================================================
    # CACHE INVALIDATION
    # =========================================================================
    
    def invalidate_user_cache(self, user_id: int) -> int:
        """invalidate all cache entries for a user across all categories"""
        total_deleted = 0
        
        # patterns for user-specific keys
        patterns = [
            f"{self.CACHE_VERSION}:forecast:user:{user_id}",
            f"{self.CACHE_VERSION}:forecast_enhanced:enhanced:{user_id}:*",
            f"{self.CACHE_VERSION}:ai_advice:{user_id}:*",
            f"{self.CACHE_VERSION}:financial_summary:{user_id}:*",
            f"{self.CACHE_VERSION}:transaction_data:recent:{user_id}",
            f"{self.CACHE_VERSION}:vector_search:{user_id}:*",
            f"{self.CACHE_VERSION}:document_processing:*:{user_id}:*",
        ]
        
        def invalidate():
            with self.manager.client_context('write') as client:
                if not client:
                    return 0
                
                deleted = 0
                for pattern in patterns:
                    try:
                        keys = client.keys(pattern)
                        if keys:
                            deleted += client.delete(keys)
                    except Exception as e:
                        logger.warning(f"Pattern {pattern} failed: {e}")
                        
                return deleted
            
        cb = self.manager.circuit_breakers['write']
        
        try:
            total_deleted = cb.execute(invalidate)
            logger.info(f"Invalidated {total_deleted} cache entries for user {user_id}")
            return total_deleted
        except Exception as e:
            logger.error(f"Failed to invalidate user cache: {e}")
            return 0
        
    def invalidate_category(self, category: str, pattern: str = "*") -> int:
        """Invalidate all cache entries in a category matching pattern"""
        full_pattern = f"{self.CACHE_VERSION}:{category}:{pattern}"
        
        def _invalidate():
            with self.manager.client_context('write') as client:
                if not client:
                    return 0
                
                keys = client.keys(full_pattern)
                if keys:
                    return client.delete(*keys)
                return 0
            
        cb = self.manager.circuit_breakers['write']
        
        try:
            deleted = cb.execute(_invalidate)
            if deleted > 0:
                logger.info(f"Invalidated {deleted} entries in category {category}")
            return deleted
        except Exception as e:
            logger.error(f"Failed to invalidate category {category}: {e}")
            return 0
        
    # =========================================================================
    # UTILITY METHODS
    # =========================================================================
    
    def get_stats(self) -> Dict[str, Any]:
        """Get comprehensive cache statistics"""
        stats = {
            'metrics': self.metrics.get_metrics(),
            'connection_pool': {},
            'version': self.CACHE_VERSION
        }
        
        # add pool status
        health = self.manager.health_check()
        stats['connection_pool'] = health.get('pool', {})
        stats['circuit_breakers'] = health.get('circuit_breakers', {})
        
        return stats
    
    def health_check(self) -> Dict[str, Any]:
        """perform health check"""
        return self.manager.health_check()
    
    def clear_all(self) -> bool:
        """Clear entire cache (use with caution!)"""
        def _clear():
            with self.manager.client_context('write') as client:
                if not client:
                    return False
                client.flushdb()
                return True
            
        cb = self.manager.circuit_breakers['write']
        
        try:
            result = cb.execute(_clear)
            if result:
                logger.warning("Entire cache cleared")
            return result
        except Exception as e:
            logger.error(f"Failed to clear cache: {e}")
            return False
        
# =============================================================================
# DECORATORS
# =============================================================================

def cached(category: str, ttl: Optional[Union[int, timedelta]] = None, key_builder: Optional[Callable] = None, fallback_to_db: bool = True):
    """Decorator for caching function results"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # build cache key
            if key_builder:
                cache_key = key_builder(*args, **kwargs)
            else:
                # default key : function_name: arg1:arg2:kwarg1=val1
                key_parts = [func.__name__]
                
                # add args 
                start_idx = 1 if args and hasattr(args[0], '__class__') and func.__name__ in dir(args[0]) else 0
                
                for arg in args[start_idx:]:
                    if hasattr(arg, 'id'):
                        key_parts.append(str(arg.id))
                    elif isinstance(arg, (int, str, float, bool)):
                        key_parts.append(str(arg))
                    else:
                        key_parts.append(hashlib.md5(str(arg).encode()).hexdigest()[:8])
                        
                # add kwargs
                for key, value in sorted(kwargs.items()):
                    if hasattr(value, 'id'):
                        key_parts.append(f"{key}:{value.id}")
                    elif isinstance(value, (int, str, float, bool)):
                        key_parts.append(f"{key}:{value}")
                    else:
                        key_parts.append(f"{key}:{hashlib.md5(str(value).encode()).hexdigest()[:8]}")
                        
                cache_key = ":".join(key_parts)
                
            cached_value = cache.get(category, cache_key)
            if cached_value is not None:
                logger.debug(f"Cache HIT: {category}:{cache_key}")
                return cached_value
            
            logger.debug(f"Cache MISS: {category}:{cache_key}")
            
            # execute function
            try:
                result = func(*args, **kwargs)
                
                # cache result (non-blocking)
                try:
                    cache.set(category, cache_key, result, ttl)
                except Exception as e:
                    logger.warning(f"Failed to cache result: {e}")
                
                return result
            
            except Exception as e:
                if fallback_to_db:
                    # executing the function, state re-raise it
                    raise
                else:
                    # no fall back, raise original
                    raise
                
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            # using similar logic as wrapper but this is for async function
            if key_builder:
                cache_key = key_builder(*args, **kwargs)
            else:
                key_parts = [func.__name__]
                
                start_idx = 1 if args and hasattr(args[0], '__class__') and func.__name__ in dir(args[0]) else 0
                for arg in args[start_idx:]:
                    if hasattr(arg, 'id'):
                        key_parts.append(str(arg.id))
                    elif isinstance(arg, (int, str, float, bool)):
                        key_parts.append(str(arg))
                    else:
                        key_parts.append(hashlib.md5(str(arg).encode()).hexdigest()[:8])
                        
                for key, value in sorted(kwargs.items()):
                    if hasattr(value, 'id'):
                        key_parts.append(f"{key}:{value.id}")
                    elif isinstance(value, (int, str, float, bool)):
                        key_parts.append(f"{key}:{value}")
                    else:
                        key_parts.append(f"{key}:{hashlib.md5(str(value).encode()).hexdigest()[:8]}")
                        
                cache_key = ":".join(key_parts)
                
            cached_value = cache.get(category, cache_key)
            if cached_value is not None:
                logger.debug(f"Cache HIT: {category}:{cache_key}")
                return cached_value
            
            logger.debug(f"Cache MISS: {category}:{cache_key}")
            
            try:
                result = await func(*args, **kwargs)
                
                try:
                    cache.set(category, cache_key, result, ttl)
                except Exception as e:
                    logger.warning(f"Failed to cache result: {e}")
                    
            except Exception as e:
                if fallback_to_db:
                    raise
                else:
                    raise
        
        return async_wrapper if asyncio.iscoroutinefunction(func) else wrapper
    return decorator

# =============================================================================
# SINGLETON INSTANCE
# =============================================================================

# global cache instance
cache = RedisCache()

# backward compatibility functions
def cache_forecast(user_id: int, forecast_data: dict, expire: int = 3600) -> bool:
    """Legacy function for backward compatibility"""
    return cache.cache_forecast(user_id, forecast_data, ttl=expire)

def get_cached_forecast(user_id: int) -> Optional[dict]:
    return cache.get_cached_forecast(user_id)

def clear_user_forecast_cache(user_id: int) -> int:
    return cache.invalidate_user_cache(user_id)

def cache_embeddings(chunk_id: int, embeddings: list) -> bool:
    return cache.cache_embeddings(chunk_id, embeddings)

def get_cached_embeddings(chunk_id: int) -> Optional[list]:
    return cache.get_cached_embeddings(chunk_id)
        
    
    
        
               