import threading
import time
import json
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Callable, List
import logging
from collections import defaultdict
import redis

logger = logging.getLogger(__name__)

class ProgressStage:
    """Progress stage"""
    def __init__(self, name: str, weight: float, description: str = "", can_cancel: bool = True, is_critical: bool = False):
        self.name = name
        self.weight = weight
        self.description = description
        self.can_cancel = can_cancel
        self.is_critical = is_critical
        
        
class ProgressTracker:
    """Thread safe of progress tracking with redis support"""
    
    def __init__(self, redis_url: str = None):
        self.progress_data = defaultdict(dict)
        self.stage_definitions: Dict[str, List[ProgressStage]] = defaultdict(list)
        self.lock = threading.RLock()
        self.heartbeats = {}
        self.redis_client = None
        
        # batch update tracking to reduce Redis writes everytime
        self.pending_updates = defaultdict(dict)
        self.last_flush = time.time()
        self.FLUSH_INTERVAL = 2.0
        
        # initialize redis if available
        if redis_url:
            try:
                self.redis_client = redis.Redis.from_url(redis_url, decode_responses=False)
                logger.info(f"Progress tracker connected to Redis")
                # start batch flusher
                self.start_batch_flusher()
            except Exception as e:
                logger.error(f"Failed to connect to Redis: {e}")
                self.redis_client = None
                
        self.start_cleanup_thread()
        
    def start_batch_flusher(self):
        """Start background thread for batched redis writes"""
        def flush_worker():
            while True:
                try:
                    time.sleep(self.FLUSH_INTERVAL)
                    self.flush_pending_updates()
                except Exception as e:
                    logger.error(f"Batch flush error: {e}")
                    time.sleep(5)
                    
        thread = threading.Thread(target=flush_worker, daemon=True, name="ProgressBatchFlusher")
        
        thread.start()
        logger.info(f"Batch flusher started (interval: {self.FLUSH_INTERVAL}s)")
        
    def start_cleanup_thread(self):
        """start background thread for cleaning up old entries"""
        def cleanup_worker():
            while True:
                try:
                    time.sleep(3600)
                    self.cleanup_old(max_age_hours=2)
                except Exception as e:
                    logger.error(f"Cleanup thread error: {e}")
                    time.sleep(60)
                    
        thread = threading.Thread(target=cleanup_worker, daemon=True)
        thread.start()
        
    def define_stages(self, process_type: str, stages: List[ProgressStage]):
        """define progress stages for a process type"""
        with self.lock:
            self.stage_definitions[process_type] = stages
            
    def set_progress(self, user_id: int, upload_id: str, stage_name: str, percentage: int, details: str = "", metadata: dict = None):
        """Set progress with thread safety and persistence"""
        with self.lock:
            # Check if this is the final stage
            is_complete = (percentage >= 100 or stage_name.lower() in ["completed", "complete", "success"])
            is_error = stage_name.lower() in ["error", "cancelled", "failed"]
            is_critical = is_complete or is_error or (percentage % 10 == 0) # only write milestones immediately
            
            progress_entry = {
                "stage": stage_name,
                "percentage": max(0, min(100, percentage)),
                "details": details,
                "metadata": metadata or {},
                "updated_at": datetime.now().isoformat(),
                "last_heartbeat": time.time(),
                "is_complete": is_complete,
                "is_error": stage_name.lower() in ["error", "failed", "cancelled"],
                "user_id": user_id,
                "upload_id": upload_id,
                "timestamp": time.time()
            }
            
            # store in memory
            self.progress_data[user_id][upload_id] = progress_entry
            
            # batched redis write
            if is_critical:
                # flush critical updates only
                self.flush_single_update(user_id, upload_id, progress_entry)
            else:
                # batch other updates 
                key = f"{user_id}:{upload_id}"
                self.pending_updates[key] = progress_entry
                
            logger.debug(f"Progress [{upload_id[:8]}] {stage_name}: {percentage}% - {details} {'(batched)' if not is_critical else '(immediate)'}")
            
            self.send_heartbeat(user_id, upload_id)
            
    def flush_single_update(self, user_id: int, upload_id: str, progress_sentry: dict):
        """Immediately flush single critical update to Redis"""
        if self.redis_client:
            try:
                redis_key = f"progress:{user_id}:{upload_id}"
                serialized = json.dumps(progress_sentry, default=str).encode("utf-8")
                self.redis_client.setex(redis_key, 7200, serialized)
            except Exception as e:
                logger.warning(f"Redis single write failed: {e}")
                
    def flush_pending_updates(self):
        """Flush all pending updates in batch"""
        with self.lock:
            if not self.pending_updates:
                return
            
            if self.redis_client:
                try:
                    # use pipeline for batch writes
                    pipe = self.redis_client.pipeline()
                    for key, progress_entry in self.pending_updates.items():
                        user_id, upload_id = key.split(":", 1)
                        redis_key = f"progress:{user_id}:{upload_id}"
                        serialized = json.dumps(progress_entry, default=str).encode("utf-8")
                        pipe.setex(redis_key, 7200, serialized)
                        
                    pipe.execute()
                    logger.debug(f"Flushed {len(self.pending_updates)} batched updates to Redis")
                    
                except Exception as e:
                    logger.error(f"Batch flush failed: {e}")
                    
            self.pending_updates.clear()
            
    def get_progress(self, user_id: int, upload_id: str) -> Optional[Dict[str, Any]]:
        """Get progress with redis fallback"""
        
        with self.lock:
            progress = self.progress_data.get(user_id, {}).get(upload_id)
            
            if not progress and self.redis_client:
                try:
                    redis_key = f"progress:{user_id}:{upload_id}"
                    cached = self.redis_client.get(redis_key)
                    if cached:
                        progress = json.loads(cached.decode("utf-8") if isinstance(cached, bytes) else cached)
                        # update memory cache
                        if user_id not in self.progress_data:
                            self.progress_data[user_id] = {}
                        self.progress_data[user_id][upload_id] = progress
                except Exception as e:
                    logger.warning(f"Failed to load progress from Redis: {e}")
                    
            return progress
        
    def send_heartbeat(self, user_id: int, upload_id: str):
        """Update heartbeat to keep connection alive"""
        with self.lock:
            heartbeat_key = f"heartbeat:{user_id}:{upload_id}"
            self.heartbeats[heartbeat_key] = time.time()
            
            if self.redis_client:
                try:
                    self.redis_client.setex(heartbeat_key, 60, str(time.time()))
                except Exception as e:
                    logger.warning(f"Failed to store heartbeat in Redis: {e}")
                    
    def check_heartbeat(self, user_id: int, upload_id: str, timeout_seconds: int = 30) -> bool:
        """Check if heartbeat is recent"""
        with self.lock:
            heartbeat_key = f"heartbeat:{user_id}:{upload_id}"
            last_heartbeat = self.heartbeats.get(heartbeat_key)
            
            if not last_heartbeat and self.redis_client:
                try:
                    cached = self.redis_client.get(heartbeat_key)
                    if cached:
                        last_heartbeat = float(cached)
                except:
                    pass
                
            if last_heartbeat:
                return (time.time() - last_heartbeat) <= timeout_seconds
            return False
        
    def cancel_upload(self, user_id: int , upload_id: str, reason: str = "User cancelled"):
        """Mark upload as cancelled"""
        self.set_progress(
            user_id, upload_id,
            "cancelled", 0,
            reason,
            {
                "cancelled": True,
                "cancelled_at": datetime.now().isoformat(),
                "cancelled_reason": reason
            }
        )
        
        # store cancellation flag for immediate response
        cancel_key = f"cancel:{user_id}:{upload_id}"
        if self.redis_client:
            self.redis_client.setex(cancel_key, 300, "1")
    
    def is_cancelled(self, user_id: int, upload_id: str) -> bool:
        """Check if upload is cancelled"""
        with self.lock:
            progress = self.get_progress(user_id, upload_id)
            if progress and progress.get("is_error") and "cancelled" in progress.get("stage", "").lower():
                return True
            
            if self.redis_client:
                try:
                    cancel_key = f"cancel:{user_id}:{upload_id}"
                    return bool(self.redis_client.get(cancel_key))
                except:
                    pass
                
            return False
        
    def cleanup_old(self, max_age_hours: int = 2):
        """Clean up old progress entries"""
        cutoff = time.time() - (max_age_hours * 3600)
        removed_count = 0
        
        with self.lock:
            for user_id in list(self.progress_data.keys()):
                for upload_id in list(self.progress_data[user_id].keys()):
                    progress = self.progress_data[user_id][upload_id]
                    updated_at = progress.get("timestamp", 0)
                    
                    if updated_at < cutoff or progress.get("is_complete") or progress.get("is_error"):
                        del self.progress_data[user_id][upload_id]
                        removed_count += 1
                        
                if not self.progress_data[user_id]:
                    del self.progress_data[user_id]
                    
            # clean heartbeats
            stale_heartbeats = [k for k, v in self.heartbeats.items() if v < cutoff]
            for key in stale_heartbeats:
                del self.heartbeats[key]
                
            logger.info(f"Cleaned up {removed_count} old progress entries and {len(stale_heartbeats)} heartbeats")   
            
    def get_all_user_uploads(self, user_id: int) -> List[Dict[str, Any]]:
        """Get all uploads for a user"""
        with self.lock:
            uploads = []
            for upload_id, progress in self.progress_data.get(user_id, {}).items():
                uploads.append({
                    "upload_id": upload_id,
                    "stage": progress.get("stage"),
                    "percentage": progress.get("percentage"),
                    "details": progress.get("details"),
                    "updated_at": progress.get("updated_at"),
                    "is_complete": progress.get("is_complete", False),
                    "is_error": progress.get("is_error", False)
                })
            return uploads
        
from backend.core.config import settings

progress_tracker = ProgressTracker(
    redis_url=getattr(settings, "REDIS_URL", None)
)    

# define document processing stages
document_processing_stages = [
    ProgressStage("initializing", 0, "Initializing upload...", can_cancel=True),
    ProgressStage("validating", 5, "Validating file format...", can_cancel=True),
    ProgressStage("uploading_storage", 10, "Uploading to cloud storage...", can_cancel=True),
    ProgressStage("reading_file", 15, "Reading document...", can_cancel=True, is_critical=True),
    ProgressStage("parsing_data", 25, "Parsing data structure...", can_cancel=True),
    ProgressStage("extracting_transactions", 35, "Extracting transactions...", can_cancel=True, is_critical=True),
    ProgressStage("categorizing", 45, "Categorizing transactions...", can_cancel=False),
    ProgressStage("processing_batch", 60, "Batch processing transactions...", can_cancel=False, is_critical=True),
    ProgressStage("creating_chunks", 70, "Creating document chunks...", can_cancel=False),
    ProgressStage("generating_embeddings", 80, "Generating embeddings...", can_cancel=False),
    ProgressStage("storing_embeddings", 90, "Storing embeddings...", can_cancel=False),
    ProgressStage("finalizing", 95, "Finalizing processing...", can_cancel=False),
    ProgressStage("completed", 100, "Processing complete!", can_cancel=False)
]

# register stages
progress_tracker.define_stages("document_processing", document_processing_stages)