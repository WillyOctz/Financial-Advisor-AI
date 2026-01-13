from datetime import timedelta

CACHE_CONFIG = {
    'TTL': {
        'SHORT': timedelta(minutes=5),           # Frequently changing data
        'MEDIUM': timedelta(minutes=15),         # Semi-stable data
        'LONG': timedelta(hours=1),              # Stable data
        'VERY_LONG': timedelta(days=1),          # Very stable data
        'EMBEDDINGS': timedelta(days=7),         # Vector embeddings
        'FORECAST': timedelta(hours=6),          # Forecast data
        'AI_ADVICE': timedelta(hours=12),        # AI-generated advice
        'DOCUMENT_PROCESSING': timedelta(hours=24),  # Document processing results
    },

    'BATCH_SIZES': {
        'TRANSACTIONS': 1000,
        'EMBEDDINGS': 50,
        'CHUNKS': 100,
        'DATAFRAME_CHUNKS': 10000,
        'CACHE_BATCH': 100,
    },

    'REDIS': {
        'HOST': 'localhost',
        'PORT': 6379,
        'MAX_CONNECTIONS': 20,
        'MIN_CONNECTIONS': 5,
        'SOCKET_TIMEOUT': 5,
        'SOCKET_CONNECT_TIMEOUT': 5,
        'RETRY_ON_TIMEOUT': True,
        'HEALTH_CHECK_INTERVAL': 30,
        'MAX_RETRIES': 3,
        'RETRY_DELAY': 0.1,
    },

    # Circuit breaker settings
    'CIRCUIT_BREAKER': {
        'FAILURE_THRESHOLD': 3,
        'RECOVERY_TIMEOUT': 30,  # seconds
        'TEST_COMMAND': 'PING',
    },

    # Memory limits and eviction policies
    'MEMORY': {
        'MAX_MEMORY': '1gb',  # Maximum memory for Redis
        'EVICTION_POLICY': 'allkeys-lru',  # Least Recently Used eviction
        'MAX_ITEM_SIZE': '10mb',  # Maximum size for single cache item
    },

    # Monitoring threshold
    'MONITORING': {
        'HEALTH_CHECK_INTERVAL': 60,  # seconds
        'METRICS_FLUSH_INTERVAL': 300,  # seconds
        'ALERT_HIT_RATE_THRESHOLD': 0.7,  # Alert if hit rate below 70%
        'ALERT_MEMORY_THRESHOLD': 0.8,  # Alert if memory usage > 80%
        'ALERT_LATENCY_THRESHOLD': 100,  # Alert if latency > 100ms
    },

    # Cache categories and their TTL's
    'CATEGORIES': {
        'financial_summary': 'MEDIUM',
        'ai_advice': 'AI_ADVICE',
        'forecast': 'FORECAST',
        'embeddings': 'EMBEDDINGS',
        'transaction_data': 'MEDIUM',
        'document_processing': 'DOCUMENT_PROCESSING',
        'user_sessions': 'SHORT',
        'vector_search': 'LONG',
        'category_mappings': 'VERY_LONG',
    },

    # Cache key patterns (for invalidation)
    'KEY_PATTERNS': {
        'USER': 'user:{user_id}:{category}:{key}',
        'DOCUMENT': 'document:{doc_id}:{category}:{key}',
        'TRANSACTION': 'transaction:{txn_id}:{category}:{key}',
        'GLOBAL': 'global:{category}:{key}',
    },
}

def get_ttl(category: str) -> timedelta:
    """Get TTL for a cache category"""
    ttl_name = CACHE_CONFIG['CATEGORIES'].get(category, 'MEDIUM')
    return CACHE_CONFIG['TTL'].get(ttl_name, timedelta(minutes=15))

def build_cache_key(pattern: str, **kwargs) -> str:
    """Build cache key using pattern"""
    try:
        return pattern.format(**kwargs)
    except KeyError:
        # Fallback to simple concatenation
        parts = [str(v) for v in kwargs.values()]
        return ":".join(parts)