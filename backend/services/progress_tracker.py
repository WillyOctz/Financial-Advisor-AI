import threading
import time
from datetime import datetime
from typing import Dict, Any, Optional
import logging
from collections import defaultdict

logger = logging.getLogger(__name__)

class ProgressTracker:
    """simple version of progress tracker"""
    def __init__(self):
        self.task_status: Dict[str, dict] = {}
        self.lock = threading.RLock()
        
        logger.info("Initializing progress tracker...")
        
        self.start_cleanup_thread()
        
    def set_progress(
        self,
        user_id: int,
        upload_id: str,
        stage_name: str,
        percentage: int,
        details: str = "",
        metadata: dict = None
    ):
        """Update task progress with only each stage"""
        with self.lock:
            task_key = f"{user_id}:{upload_id}"
            
            if percentage >= 100 or stage_name.lower() in ["completed", "complete", "success"]:
                status = "completed"
            elif stage_name.lower() in ["error", "failed", "cancelled"]:
                status = "failed"
            elif percentage > 0:
                status = "processing"
            else:
                status = "pending"
                
            self.task_status[task_key] = {
                "upload_id": upload_id,
                "user_id": user_id,
                "status": status,
                "stage": stage_name,
                "percentage": max(0, min(100, percentage)),
                "details": details,
                "metadata": metadata or {},
                "updated_at": datetime.now().isoformat(),
                "timestamp": time.time(),
                "is_complete": status == "completed",
                "is_error": status == "failed"
            }
            
            # only log major stage milestone
            if percentage % 25 == 0 or status in ["completed", "failed"]:
                logger.info(f"Progress [{upload_id[:8]}] {stage_name}: {percentage}% - {details}")
                
    def get_progress(self, user_id: int, upload_id: str) -> Optional[Dict[str, Any]]:
        """get the current task progress"""
        with self.lock:
            task_key = f"{user_id}:{upload_id}"
            return self.task_status.get(task_key)
        
    def get_status_by_task_id(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get status by task id"""
        with self.lock:
            for task_key, status in self.task_status.items():
                # check if metadata contains task id
                if status.get("metadata", {}).get("task_id") == task_id:
                    return status
            return None
        
    def set_task_id_mapping(self, user_id: int, upload_id: str, task_id: str):
        """Store task id mapping in metadata for lookups"""
        with self.lock:
            task_key = f"{user_id}:{upload_id}"
            if task_key in self.task_status:
                if "metadata" not in self.task_status[task_key]:
                    self.task_status[task_key]["metadata"] = {}
                self.task_status[task_key]["metadata"]["task_id"] = task_id
                
    def is_cancelled(self, user_id: int, upload_id: str) -> bool:
        """Check if task is cancelled"""
        progress = self.get_progress(user_id, upload_id)
        if progress:
            return progress.get("is_error") and "cancel" in progress.get("stage", "").lower()
        
        return False
    
    def cancel_upload(self, user_id: int, upload_id: str, reason: str = "User cancelled"):
        """Mark upload is cancelled"""
        self.set_progress(
            user_id,
            upload_id,
            "cancelled",
            0,
            reason,
            {
                "cancelled": True,
                "cancelled_at": datetime.now().isoformat(),
                "cancelled_reason": reason
            }
        )
        
    def start_cleanup_thread(self):
        """Clean up old completed/failed tasks after an hour"""
        def cleanup_worker():
            while True:
                try:
                    time.sleep(1800)
                    self.cleanup_old_tasks(max_age_hours=1)
                except Exception as e:
                    logger.error(f"Cleanup error: {e}")
                    time.sleep(60)
                    
        thread = threading.Thread(
            target=cleanup_worker,
            daemon=True,
            name="ProgressCleanup"
        )
        thread.start()
        logger.info(f"Cleanup thread started every 30 minutes")
        
    def cleanup_old_tasks(self, max_hours_age: int = 1):
        """Remove completed tasks older """
        cutoff = time.time() - (max_hours_age * 3600)
        removed_count = 0
        
        with self.lock:
            tasks_to_remove = []
            
            for task_key, status in self.task_status.items():
                if status["status"] in ["completed", "failed"]:
                    if status["timestamp"] < cutoff:
                        tasks_to_remove.append(task_key)
                        
            for task_key in tasks_to_remove:
                del self.task_status[task_key]
                removed_count += 1
                
            if removed_count > 1:
                logger.info(f"Cleaned up {removed_count} old task statuses")
                
    def get_all_user_uploads(self, user_id: int) -> list:
        """Get all uploads for a specific user"""
        with self.lock:
            user_tasks = []
            for task_key, status in self.task_status.items():
                if status["user_id"] == user_id:
                    user_tasks.append({
                        "upload_id": status["upload_id"],
                        "status": status["status"],
                        "stage": status["stage"],
                        "percentage": status["percentage"],
                        "details": status["details"],
                        "updated_at": status["updated_at"],
                        "is_complete": status["is_complete"],
                        "is_error": status["is_error"]
                    })
            return user_tasks
        
    def send_heartbeat(self, user_id: int, upload_id: str):
        """No-op for compatibility"""
        pass
    
    def check_heartbeat(self, user_id: int, upload_id: str, timeout_seconds: int = 30) ->bool:
        """alyways return True for compatibility"""
        return True
    
    def define_stages(self, process_type: str, stages: list):
        """no op for compatibility"""
        pass
    
progress_tracker = ProgressTracker()