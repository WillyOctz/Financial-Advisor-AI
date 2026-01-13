from unicodedata import category
import redis
from backend.core.config import settings
import json
from redis import ConnectionPool
import pickle
from typing import Any, Optional, List, Dict, Tuple, Union
import hashlib
from datetime import timedelta
import time
import logging
import os
from functools import wraps

logger = logging.getLogger(__name__)

redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)

def cache_forecast(user_id: int, forecast_data: dict, expire: int = 3600):
    key = f"forecast:{user_id}"
    redis_client.setex(key, expire, json.dumps(forecast_data))

def get_cached_forecast(user_id: int):
    key = f"forecast:{user_id}"
    data = redis_client.get(key)
    return json.loads(data) if data else None

def clear_user_forecast_cache(user_id: int):
    key = f"forecast:{user_id}"
    deleted = redis_client.delete(key)
    return deleted > 0

def cache_embeddings(chunk_id: int, embeddings: list):
    key = f"embeddings:{chunk_id}"
    redis_client.setex(key, 86400, json.dumps(embeddings))

def get_cached_embeddings(chunk_id: int):
    key = f"embeddings:{chunk_id}"
    data = redis_client.get(key)
    return json.loads(data) if data else None


class RedisCache:
    """Production-ready Redis cache with connection pooling and error handling"""

    _instance = None
    _pool = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RedisCache, cls).__new__(cls)
            cls._instance._init_pool()
        return cls._instance
    
    def _init_pool(self):
        """Initialize connection pool with production settings"""
        try:
            self._pool = ConnectionPool(
                host='localhost',
                port=6379,
                max_connections=20,
                decode_responses=False, # keep as bytes for pickling
                socket_timeout=5,
                socket_connect_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30
            ) 

            self._client = redis.Redis(connection_pool=self._pool)
            # Testing the connection
            self._client.ping()
            logger.info("✅ Redis connection pool initialized successfully")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Redis connection pool: {e}")
            self._client = None

    @property
    def client(self):
        """Get Redis client with reconnection logic"""
        if self._client is None:
            self._init_pool()
        return self._client
    
    def get(self, category: str, key: str) -> Optional[Any]:
        """Get value from cache with error handling"""
        try:
            cache_key = self._build_key(category, key)
            data = self.client.get(cache_key)
            if data:
                try:
                    return pickle.loads(data)
                except:
                    # Fallback to JSON for legacy data
                    return json.loads(data.decode('utf-8'))
            return None
        except redis.RedisError as e:
            logger.error(f"❌ Redis error in get for: {category}: {key} {e}")
            return None
        except Exception as e:
            logger.error(f"❌ Unexpected cache error: {e}")
            return None
        
    def set(self, category: str, key: str, value: Any, ttl: Optional[Union[int, timedelta]] = None) -> bool:
        """Set value in cache with error handling"""
        try:
            cache_key = self._build_key(category, key)

            # Serialize with pickle (handles more types than JSON)
            serialized = pickle.dumps(value)
            if ttl:
                if isinstance(ttl, timedelta):
                    seconds = int(ttl.total_seconds())
                else:
                    seconds = int(ttl)
                success = self.client.setex(cache_key, seconds, serialized)
            else:
                success = self.client.set(cache_key, serialized)

            return bool(success)
        except redis.RedisError as e:
            logger.warning(f"⚠️ Cache set failed for {category}:{key}: {e}")
            return False
        except Exception as e:
            logger.error(f"❌ Unexpected cache set error: {e}")
            return False
        
    def batch_set(self, items: List[Tuple[str, str, Any]]) -> bool:
        """Batch set multiple cache items"""
        if not items:
            return True
        
        try:
            pipe = self.client.pipeline()

            for category, key, value in items:
                cache_key = self._build_key(category, key)
                serialized = pickle.dumps(value)
                pipe.set(cache_key, serialized)

            pipe.execute()
            return True
        except Exception as e:
            logger.error(f"❌ Batch set failed: {e}")
            return False
        
    def delete(self, category: str, key: str) -> bool:
        """Delete cache item"""
        try:
            cache_key = self._build_key(category, key)
            return bool(self.client.delete(cache_key))
        except Exception as e:
            logger.warning(f"⚠️ Cache delete failed: {e}")
            return False
        
    def exists(self, category: str, key: str) -> bool:
        """Check if cache key exists"""
        try:
            cache_key = self._build_key(category, key)
            return bool(self.client.exists(cache_key))
        except Exception as e:
            logger.warning(f"⚠️ Cache exists check failed: {e}")
            return False
        
    def invalidate_user_cache(self, user_id: int) -> int:
        """Invalidate all cache entries for a user"""
        try:
            # Pattern to match all user keys
            patterns = [
                f"*:financial_summary:{user_id}:*",
                f"*:ai_advice:{user_id}:*",
                f"*:transaction_data:recent:{user_id}",
                f"*:forecast_enhanced_{user_id}_*",
                f"*:document_processing:{user_id}:*"
            ]

            deleted = 0
            for pattern in patterns:
                keys = self.client.keys(pattern)
                if keys:
                    deleted += self.client.delete(*keys)

            logger.info(f"🗑️ Cleared {deleted} cache entries for user {user_id}")
            return deleted
        except Exception as e:
            logger.error(f"❌ Failed to invalidate user cache: {e}")
            return 0
        
    def clear_category(self, category: str) -> int:
        """Clear all cache entries in a category"""
        try:
            pattern = f"*:{category}:*"
            keys = self.client.keys(pattern)
            if keys:
                deleted = self.client.delete(*keys)
                logger.info(f"🗑️ Cleared {deleted} entries from category {category}")
                return deleted
            return 0
        except Exception as e:
            logger.error(f"❌ Failed to clear category {category}: {e}")
            return 0
        
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        try:
            info = self.client.info()
            stats = {
                'connected_clients': info.get('connected_clients', 0),
                'used_memory_human': info.get('used_memory_human', '0B'),
                'total_connections_received': info.get('total_connections_received', 0),
                'keyspace_hits': info.get('keyspace_hits', 0),
                'keyspace_misses': info.get('keyspace_misses', 0),
                'uptime_in_seconds': info.get('uptime_in_seconds', 0)
            }

            # Calculate hit rate
            hits = stats['keyspace_hits']
            misses = stats['keyspace_misses']
            total = hits + misses
            stats['hit_rate'] = hits / total if total > 0 else 0

            return stats
        except Exception as e:
            logger.error(f"❌ Failed to get cache stats: {e}")
            return {'error': str(e)}
        
    def health_check(self) -> Dict[str, Any]:
        """Perform health check on Redis"""
        try:
            start_time = time.time()
            self.client.ping()
            latency = time.time() - start_time

            return {
                'status': 'healthy',
                'latency_ms': round(latency * 1000, 2),
                'connection_pool': {
                    'max_connections': self._pool.max_connections if self._pool else 0,
                    'in_use_connections': self._pool._in_use_connections if self._pool else 0
                }
            }
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e)
            }
        
    def _build_key(self, category: str, key: str) -> str:
        """Build cache key with version prefix"""
        CACHE_VERSION = "v1.0"
        return f"{CACHE_VERSION}:{category}:{key}"
    
# Global cache instance
cache = RedisCache()

# Circuit breaker for cache operations
class CircuitBreaker:
    def __init__(self, failure_threshold = 3, recovery_timeout = 30):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failures = 0
        self.last_failure_time = 0
        self.state = 'CLOSED' 

    def execute(self, operation_func, fallback_func = None):
        """Execute operation with circuit breaker"""
        current_time = time.time()

        if self.state == 'OPEN':
            if current_time - self.last_failure_time > self.recovery_timeout:
                self.state = 'HALF-OPEN'
                logger.info(f"🔄 Circuit breaker transitioning to HALF_OPEN")
            else:
                logger.warning(f"⏸️ Circuit breaker OPEN, using fallback")
                return fallback_func() if fallback_func else None
            
        try:
            result = operation_func()

            if self.state == 'HALF-OPEN':
                self.state = 'CLOSED'
                self.failures = 0
                logger.info("✅ Circuit breaker reset to CLOSED")

            return result
        except Exception as e:
            self.failures += 1
            self.last_failure_time = current_time

            if self.failures >= self.failure_threshold:
                self.state = 'OPEN'
                logger.error(f"🚨 Circuit breaker OPENED after {self.failures} failures")

            logger.warning(f"⚠️ Cache operation failed: {e}")

            if fallback_func:
                return fallback_func()
            raise

# Cache metrics collector
class CacheMetrics:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(CacheMetrics, cls).__new__(cls)
            cls._instance._init_metrics()
        return cls._instance
    
    def _init_metrics(self):
        self.hits = 0
        self.misses = 0
        self.errors = 0
        self.operations = {
            'get': 0,
            'set': 0,
            'delete': 0,
            'batch_set': 0
        }
    
    def record_hit(self):
        self.hits += 1
        self.operations['get'] += 1
    
    def record_miss(self):
        self.misses += 1
        self.operations['get'] += 1
    
    def record_error(self, operation: str):
        self.errors += 1
        if operation in self.operations:
            self.operations[operation] += 1
    
    def record_operation(self, operation: str):
        if operation in self.operations:
            self.operations[operation] += 1
    
    def hit_rate(self) -> float:
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0
    
    def get_metrics(self) -> Dict[str, Any]:
        return {
            'hits': self.hits,
            'misses': self.misses,
            'errors': self.errors,
            'hit_rate': self.hit_rate(),
            'operations': self.operations.copy(),
            'total_operations': sum(self.operations.values())
        }


# Global metrics instance
cache_metrics = CacheMetrics()


# Decorator for caching with fallback
def cached(category: str, ttl: Optional[timedelta] = None, fallback_to_db: bool = True):
    """
    Decorator for caching function results with circuit breaker and metrics
    
    Args:
        category: Cache category for organization
        ttl: Time to live for cache entry
        fallback_to_db: If True, fall back to original function on cache failure
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Build cache key from function name and arguments
            cache_key_parts = [func.__name__]
            
            # Add string representation of args (skip self for methods)
            start_idx = 1 if args and hasattr(args[0], '__class__') and func.__name__ in dir(args[0]) else 0
            for arg in args[start_idx:]:
                if isinstance(arg, (int, str, float, bool)):
                    cache_key_parts.append(str(arg))
                elif hasattr(arg, 'id'):
                    cache_key_parts.append(str(arg.id))
            
            # Add kwargs
            for key, value in sorted(kwargs.items()):
                if isinstance(value, (int, str, float, bool)):
                    cache_key_parts.append(f"{key}:{value}")
                elif hasattr(value, 'id'):
                    cache_key_parts.append(f"{key}:{value.id}")
            
            cache_key = ":".join(cache_key_parts)
            
            # Try to get from cache
            def cache_get():
                result = cache.get(category, cache_key)
                if result is not None:
                    cache_metrics.record_hit()
                    logger.debug(f"✅ Cache HIT: {category}:{cache_key}")
                else:
                    cache_metrics.record_miss()
                    logger.debug(f"❌ Cache MISS: {category}:{cache_key}")
                return result
            
            # Fallback to original function
            def db_query():
                logger.debug(f"🔄 Cache fallback to DB query: {func.__name__}")
                return func(*args, **kwargs)
            
            # Try cache with circuit breaker
            circuit_breaker = CircuitBreaker()
            
            try:
                cached_result = circuit_breaker.execute(cache_get, db_query if fallback_to_db else None)
                
                if cached_result is not None:
                    return cached_result
                
                # Cache miss, execute function
                result = db_query()
                
                # Store in cache
                def cache_set():
                    cache.set(category, cache_key, result, ttl)
                    cache_metrics.record_operation('set')
                
                # Store in background if possible
                try:
                    circuit_breaker.execute(cache_set)
                except:
                    pass  # Non-critical if cache set fails
                
                return result
                
            except Exception as e:
                cache_metrics.record_error('get')
                logger.error(f"❌ Cache decorator error for {func.__name__}: {e}")
                
                if fallback_to_db:
                    return db_query()
                raise
        
        return wrapper
    return decorator