from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from backend.db.session import get_db
from backend.db.redis_client import cache, cache_metrics, cache as redis_cache
from backend.config.cache_config import CACHE_CONFIG
from backend.services.cache_warmer import CacheWarmer
from typing import Dict, Any, List
import logging

router = APIRouter(prefix="/cache", tags=["cache_monitoring"])
logger = logging.getLogger(__name__)

@router.get("/health")
def cache_health_check() -> Dict[str, Any]:
    """Check Redis cache health"""
    try:
        health = cache.health_check()

        if health['status'] != 'healthy':
            raise HTTPException(
                status_code=503, 
                detail=f"Cache unhealthy: {health.get('error', 'Unknown error')}"               
            )
        
        return {
            "status": "healthy",
            "latency_ms": health['latency_ms'],
            "connection_pool": health['connection_pool'],
            "timestamp": "datetime.now().isoformat()"
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Cache health check failed: {str(e)}")
    
@router.get("/metrics")
def get_cache_metrics() -> Dict[str, Any]:
    """Get cache performance metrics"""
    try:
        metrics = cache_metrics.get_metrics()
        redis_stats = cache.get_stats()

        # Check alert thresholds
        alerts = []

        # Hit rate alert
        if metrics['hit_rate'] < CACHE_CONFIG['MONITORING']['ALERT_HIT_RATE_THRESHOLD']:
            alerts.append({
                'type': 'warning',
                'message': f'Cache hit rate ({metrics["hit_rate"]:.2%}) below threshold'
            })

        # memory alert (if available in redis stats)
        if 'used_memory_human' in redis_stats:
            # parse memory string like '1.2M'
            mem_str = redis_stats['used_memory_human']
            if 'M' in mem_str or 'G' in mem_str:
                alerts.append({
                    'type': 'info',
                    'message': f"Memory usage: {mem_str}"
                })

        return {
            "cache_metrics": metrics,
            "redis_stats": redis_stats,
            "alerts": alerts,
            "config": {
                "ttl_settings": {k: str(v) for k, v in CACHE_CONFIG['TTL'].items()},
                "monitoring_thresholds": CACHE_CONFIG['MONITORING']
            }
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get metrics: {str(e)}")
    
@router.get("/warm-status/{user_id}")
def get_warm_status(
    user_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get cache warming status for a user"""
    try:
        cache_warmer = CacheWarmer(db)
        status = cache_warmer.get_warm_status(user_id)
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get warm status: {str(e)}")
    
@router.post("/warm/{user_id}")
def warm_user_cache(
    user_id: int,
    priority: str = "high",
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Manually trigger cache warming for a user"""
    try:
        cache_warmer = CacheWarmer(db)
        cache_warmer.warm_on_login(user_id)

        return {
            "message": f"Cache warming initiated for user {user_id}",
            "priority": priority,
            "status": "started"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to warm cache: {str(e)}")
    
@router.delete("/clear/{user_id}")
def clear_user_cache(
    user_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Clear all cache for a user"""
    try:
        cache_warmer = CacheWarmer(db)
        deleted_count = cache_warmer.clear_user_cache(user_id)

        return {
            "message": f"Cleared cache for user {user_id}",
            "deleted_entries": deleted_count,
            "status": "success"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear cache: {str(e)}")
    
@router.get("/keys")
def list_cache_keys(
    pattern: str = "*",
    limit: int = 100
) -> Dict[str, Any]:
    """List cache keys (use with caution in production)"""
    try:
        # Only allow specific patterns in production
        allowed_patterns = ["*:financial_summary:*", "*:transaction_data:*", "*:forecast:*"]

        if pattern not in allowed_patterns and pattern != "*":
            raise HTTPException(
                status_code=400,
                detail=f"Pattern not allowed. Use one of: {allowed_patterns}"
            )
        
        keys = cache.client.keys(pattern)

        # Limit results
        keys = keys[:limit] if keys else []

        # Get the key info (type, TTL)
        key_info = []
        for key in keys:
            try:
                key_str = key.decode('utf-8') if isinstance(key, bytes) else str(key)
                ttl = cache.client.ttl(key)

                key_info.append({
                    "key": key_str,
                    "type": cache.client.type(key).decode('utf-8') if isinstance(key, bytes) else str(cache.client.type(key)),
                    "ttl": ttl if ttl > 0 else "persistent",
                    "size": len(cache.client.dump(key)) if cache.client.dump(key) else 0
                })
            except:
                continue

        return {
            "pattern": pattern,
            "total_keys": len(keys),
            "keys_shown": len(key_info),
            "keys": key_info
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list keys: {str(e)}")
    
@router.get("/memory")
def get_memory_info() -> Dict[str, Any]:
    """Get Redis memory information"""
    try:
        info = cache.client.info('memory')

        return {
            "used_memory": info.get('used_memory', 0),
            "used_memory_human": info.get('used_memory_human', '0B'),
            "used_memory_rss": info.get('used_memory_rss', 0),
            "used_memory_peak": info.get('used_memory_peak', 0),
            "used_memory_peak_human": info.get('used_memory_peak_human', '0B'),
            "maxmemory": info.get('maxmemory', 0),
            "maxmemory_human": info.get('maxmemory_human', '0B'),
            "maxmemory_policy": info.get('maxmemory_policy', 'noeviction'),
            "mem_fragmentation_ratio": info.get('mem_fragmentation_ratio', 0),
            "allocator": info.get('mem_allocator', 'unknown')
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get memory info: {str(e)}")
    
@router.post("/flush")
def flush_cache(
    confirm: bool = False
) -> Dict[str, Any]:
    """Flush all cache (DANGEROUS - requires confirmation)"""
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="Must confirm with confirm=true parameter"
        )
    
    try:
        result = cache.client.flushall()
        return {
            "message": "Cache flushed successfully",
            "result": result,
            "warning": "This action cleared ALL cache data!"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to flush cache: {str(e)}")