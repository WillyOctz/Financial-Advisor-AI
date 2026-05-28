import asyncio
from typing import List, Dict, Optional, Set, Tuple
from enum import Enum
import hashlib
from datetime import datetime
import logging
from dataclasses import dataclass
from functools import partial
import concurrent.futures
import os
import time
import psutil
import gc

from backend.services.document_services import EnhancedDocumentService
from backend.services.batch_processor import BatchProcessor
from backend.config.smart_batch_rate_limit import (global_rate_limiter, batch_rate_limiter, RateLimitConfig, RateLimitStrategy)
from backend.db.session import get_background_session
from backend.db.redis_client import cache

logger = logging.getLogger(__name__)

class ProcessingPriority(Enum):
    HIGH = 1 # immediate processing for users
    MEDIUM = 2 # regular upload session
    LOW = 3 # background processing
    BACKGROUND = 4 # for historical / bulk data
    
@dataclass
class DocumentTask:
    """complete document task with all metadata"""
    upload_id: str
    user_id: int
    file_path: str
    filename: str
    column_mapping: Dict
    priority: ProcessingPriority
    dependencies: List[str] = None
    metadata: Dict = None
    created_at: datetime = None
    estimated_rows: int = 0
    file_size_mb: float = 0.0
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()
        if self.dependencies is None:
            self.dependencies = []
        if self.metadata is None:
            self.metadata = {}
            
        # calculate file size
        if os.path.exists(self.file_path):
            self.file_size_mb = os.path.getsize(self.file_path) / (1024 * 1024)
            
    @property
    def task_id(self) -> str:
        """Unique task identifier"""
        task_data = f"{self.user_id}:{self.filename}:{self.created_at.timestamp()}"
        return hashlib.md5(task_data.encode()).hexdigest()
    
    @property
    def complexity_score(self) -> float:
        """Score for prioritizing based on size/type"""
        score = 0.0
        
        # file size factor (larger = more complex)
        if self.file_size_mb > 50:
            score += 3.0
        elif self.file_size_mb > 10:
            score += 2.0
        elif self.file_size_mb > 1:
            score += 1.0
            
        # file type factor
        if self.filename.lower().endswith('.xlsx'):
            score += 1.0
            
        if self.dependencies:
            score += 0.5 * len(self.dependencies)
            
        return score
    
class MemoryAwareTaskScheduler:
    """Schedule tasks based on available memory"""
    
    def __init__(self, memory_threshold_percent: float = 90.0):
        self.memory_threshold = memory_threshold_percent
        self.task_memory_estimates: Dict[str, float] = {} # task_id for file size estimate
        
    def estimate_memory_needed(self, task: DocumentTask) -> float:
        """Estimate memory needed for a task in MB"""
        
        # base memory for processing
        base_memory = 100.0
        
        # add based on file size (using 2 times as the estimation)
        file_memory = task.file_size_mb * 2.0
        
        # add for batch processing
        batch_memory = 50.0 # -> 50 mb for each batch operations
        
        return base_memory + file_memory + batch_memory
    
    def can_start_task(self, task: DocumentTask, current_tasks: List[DocumentTask]) -> bool:
        """Check memory before starting task"""
        
        # get current memory usage
        memory_percent = psutil.virtual_memory().percent
        
        if memory_percent > self.memory_threshold:
            logger.warning(f"Memory usage high: {memory_percent}%")
            return False
        
        # estimate memory needed for the new task
        task_memory = self.estimate_memory_needed(task)
        
        # estimate memory for currently running tasks
        current_memory = sum(
            self.estimate_memory_needed(t)
            for t in current_tasks
        )
        
        # check available memory
        available_mb = psutil.virtual_memory().available / (1024 * 1024)
        
        if available_mb < task_memory * 1.5:
            logger.warning(f"Insufficient memory: {available_mb:.0f}MB available, " f"need {task_memory:.0f}MB for {task.filename}")
            return False
        
        return True
    
    def cleanup_memory(self):
        """Perform memory cleanup"""
        gc.collect()
        if psutil.virtual_memory().percent > 70:
            logger.info("Performing aggressive memory cleanup")
            gc.collect(generation=2)
            
class MultiDocumentProcessor:
    """Multi document for multi upload documents reading methods"""
    
    def __init__(self, max_concurrent_docs: int = 3, enable_rate_limiting: bool = True, enable_memory_management: bool = True):
        self.max_concurrent_docs = max_concurrent_docs
        self.enable_rate_limiting = enable_rate_limiting
        self.enable_memory_management = enable_memory_management
        
        # Task management
        self.pending_tasks: Dict[str, DocumentTask] = {}
        self.processing_tasks: Dict[str, DocumentTask] = {}
        self.completed_tasks: Dict[str, Dict] = {}
        self.failed_tasks: Dict[str, Dict] = {}
        
        # priority queues
        self.queues = {
            ProcessingPriority.HIGH: [],
            ProcessingPriority.MEDIUM: [],
            ProcessingPriority.LOW: [],
            ProcessingPriority.BACKGROUND: []
        }
        
        # dependency tracking
        self.dependencies: Dict[str, Set[str]] = {}
        self.dependents: Dict[str, Set[str]] = {}
        
        # memory management 
        self.memory_scheduler = MemoryAwareTaskScheduler()
        
        # rate limiting
        if enable_rate_limiting:
            self.rate_limiter = global_rate_limiter
            logger.info("Rate limiting enabled for multi-document processing")
            
        # thread safety
        self.lock = asyncio.Lock()
        
        # performance metrics
        self.metrics = {
            'total_processed': 0,
            'total_failed': 0,
            'total_transactions': 0,
            'avg_processing_time_seconds': 0,
            'peak_memory_usage_percent': 0,
            'rate_limit_hits': 0,
            'concurrent_peak': 0,
            'queue_sizes': {p.value: 0 for p in ProcessingPriority}
        }
        
        # background monitoring
        self.monitoring_task = None
        
        logger.info(f"MultiDocumentProcessor initialized: " f"{max_concurrent_docs} concurrent docs, " f"rate limiting: {enable_rate_limiting}")
        
    async def start(self):
        """Start background monitoring"""
        self.monitoring_task = asyncio.create_task(self.background_monitor())
        logger.info("Background monitoring started")
        
    async def stop(self):
        """Stop the processor"""
        if self.monitoring_task:
            self.monitoring_task.cancel()
            try:
                await self.monitoring_task
            except asyncio.CancelledError:
                pass
            logger.info("Background monitoring stopped")
            
    async def submit_document(self, task: DocumentTask) -> str:
        """Submit a document for processing with rate limiting check"""
        async with self.lock:
            task_id = task.task_id
            
            # check rate limiting before accepting task
            if self.enable_rate_limiting:
                # estimate tokens needed 
                tokens_needed = max(1, int(task.file_size_mb))
                if not self.rate_limiter.acquire(tokens_needed, timeout=1.0):
                    self.metrics['rate_limit_hits'] += 1
                    raise Exception("Rate limit exceeded, please try again later")
                
            # store task
            self.pending_tasks[task_id] = task
            self.queues[task.priority].append(task_id)
            self.metrics['queue_sizes'][task.priority.value] += 1
            
            # set up dependencies
            for dep_id in task.dependencies:
                self.add_dependency(task_id, dep_id)
                
            logger.info(f"Submitted: {task.filename} " f"(size: {task.file_size_mb:.1f}MB," f"priority: {task.priority.name}, " f"deps: {len(task.dependencies)})")
            
            # trigger processing
            asyncio.create_task(self.schedule_task())
            
            return task_id
        
    async def submit_multiple_documents(self, tasks: List[DocumentTask]) -> List[str]:
        """Submit multiple documents with intelligent scheduling"""
        task_ids = []
        
        # sort by priority and complexity
        sorted_tasks = sorted(tasks, key=lambda t: (t.priority.value, -t.complexity_score))
        
        for task in sorted_tasks:
            try:
                task_id = await self.submit_document(task)
                task_ids.append(task_id)
                
                # small delay between submissions
                await asyncio.sleep(0.1)
                
            except Exception as e:
                logger.error(f"Failed to submit {task.filename}: {e}")
                
        return task_ids
    
    def add_dependency(self, task_id: str, depends_on: str):
        """Add dependency between tasks"""
        if task_id not in self.dependencies:
            self.dependencies[task_id] = set()
        self.dependencies[task_id].add(depends_on)
        
        if depends_on not in self.dependents:
            self.dependents[depends_on] = set()
        self.dependents[depends_on].add(depends_on)
        
    def can_process(self, task_id: str) -> bool:
        """Check if task can be processed"""
        if task_id not in self.dependencies:
            return True
        
        required = self.dependencies[task_id]
        return required.issubset(self.completed_tasks.keys())
    
    async def schedule_task(self):
        """Intelligent task scheduling with rate and memory limits"""
        async with self.lock:
            # check capacity
            current_processing = len(self.processing_tasks)
            if current_processing >= self.max_concurrent_docs:
                return
            
            slots_available = self.max_concurrent_docs - current_processing
            
            # update peak concurrency metric
            if current_processing > self.metrics['concurrent_peak']:
                self.metrics['concurrent_peak'] = current_processing
                
            # process tasks by priority
            for priority in [ProcessingPriority.HIGH, ProcessingPriority.MEDIUM, ProcessingPriority.LOW, ProcessingPriority.BACKGROUND]:
                if slots_available <= 0:
                    break
                
                # find ready tasks in this queue
                ready_tasks = []
                for task_id in self.queues[priority][:slots_available * 3]:
                    if self.can_process(task_id):
                        ready_tasks.append(task_id)
                        
                    if len(ready_tasks) >= slots_available:
                        break
                    
                # start processing ready tasks
                for task_id in ready_tasks:
                    task = self.pending_tasks[task_id]
                    
                    # memory check
                    if (self.enable_memory_management and not self.memory_scheduler.can_start_task(task, list(self.processing_tasks.values()))):
                        logger.debug(f"Memory constraint for {task.filename}, skipping for now")
                        asyncio.create_task(self.retry_schedule_after_delay(10))
                        continue
                    
                    # move to processing
                    self.processing_tasks[task_id] = task
                    del self.pending_tasks[task_id]
                    self.queues[priority].remove(task_id)
                    self.metrics['queue_sizes'][priority.value] -= 1
                    
                    asyncio.create_task(self.process_document_with_limits(task))
                    
                    slots_available -= 1
                    
                    logger.debug(f"Started processing: {task.filename} " f"(concurrent: {len(self.processing_tasks)})")
                    
    async def process_document_with_limits(self, task: DocumentTask):
        """Process a document with rate limiting and memory management (fixed with proper seperation of async/sync dedicated thread pool)"""
        task_id = task.task_id
        start_time = time.time()
        
        # Create a dedicated executor for This task to prevent thread pool starvation across multiple concurrent documents
        executor = concurrent.futures.ThreadPoolExecutor(
            max_workers=2,
            thread_name_prefix=f"doc_{task.filename[:10]}"
        )
        
        try:
            # acquire rate limit tokens for this task
            if self.enable_rate_limiting:
                tokens_needed = max(10, int(task.file_size_mb * 2))
                acquired = await self.rate_limiter.acquire_async(tokens_needed, timeout=10.0)
                if not acquired:
                    raise Exception("Rate limit timeout for document processing")
                
            logger.info(f" Processing document: {task.filename} " f"(user: {task.user_id}, size: {task.file_size_mb:.1f}MB)")
            
            # run all sync processing in thread pool
            loop = asyncio.get_running_loop()
            
            # create a partial function with all arguments
            process_func = partial(
                self.sync_process_document,
                task=task,
                rate_limit_success=self.enable_rate_limiting
            ) 
            
            # run in thread pool and await the result
            result = await loop.run_in_executor(executor, process_func)
            
            # process the successfull result
            processing_time = time.time() - start_time
            transaction_count = result.get('transaction_count', 0)
            
            # update task status (thread-safe operation)
            await self.update_task_completion(task_id, task, result, processing_time)
            
            logger.info(f"Completed: {task.filename} ({processing_time:.1f}s, {transaction_count}txns)")
            
            # record rate limit success
            if self.enable_rate_limiting:
                self.rate_limiter.record_success()   
                
        except Exception as e:
            processing_time = time.time() - start_time
            await self.handle_task_failure(task_id, task, e, processing_time)
            
        finally:
            # shutdown executor
            executor.shutdown(wait=False)
            
            # trigger the next scheduling
            asyncio.create_task(self.schedule_task())
            
    def sync_process_document(self, task: DocumentTask, rate_limit_success: bool = False) -> Dict:
        """Sync only document process, runs in threadpoolexecutor"""
        
        db = None
        try:
            # create a new session for this thread
            db = get_background_session()
            
            # initialize services with this session
            user_currency = task.metadata.get("user_currency", "USD")
            document_service = EnhancedDocumentService(db, user_currency=user_currency)
            document_service.current_upload_id = task.upload_id
            document_service.current_user_id = task.user_id
            document_service.enable_rate_limiting = self.enable_rate_limiting
            
            # initialize vector service and batch processor
            from backend.services.vector_search import VectorSearchService
            vector_service = VectorSearchService(db)
            
            batch_processor = BatchProcessor(
                max_workers=2,
                batch_size=500,
                db=db,
                vector_service=vector_service,
                upload_id=task.upload_id,
                user_id=task.user_id,
                enable_rate_limiting=self.enable_rate_limiting
            )
            document_service.batch_processor = batch_processor
            
            # process document in sync operation
            result = document_service.process_document(
                file_path=task.file_path,
                user_id=task.user_id,
                filename=task.filename,
                column_mapping=task.column_mapping,
                cancellation_check=lambda: False # will implement proper cancellation later
            )
            
            # commit explicitly
            db.commit()
            
            return result
        
        except Exception as e:
            if db:
                db.rollback()
            logger.error(f"Sync processing failed for {task.filename}: {e}")
            raise
        finally:
            if db:
                db.close()
                
    async def update_task_completion(self, task_id: str, task: DocumentTask, result: Dict, processing_time: float):
         """Thread safe task completion update"""
         async with self.lock:
            self.completed_tasks[task_id] = {
                'task': task,
                'result': result,
                'processing_time': processing_time,
                'completed_at': datetime.now(),
                'transaction_count': result.get('transaction_count', 0)
            }
            
            if task_id in self.processing_tasks:
                del self.processing_tasks[task_id]
                
            # update metrics
            self.metrics['total_processed'] += 1
            self.metrics['total_transactions'] += result.get('transaction_count', 0)
            
            # update average processing time
            total_processed = self.metrics['total_processed']
            old_avg = self.metrics['avg_processing_time_seconds']
            self.metrics['avg_processing_time_seconds'] = (
                (old_avg * (total_processed - 1)) + processing_time
            ) / total_processed
            
            # remove dependencies
            if task_id in self.dependents:
                for dependent_id in list(self.dependents[task_id]):
                    self.remove_dependency(dependent_id, task_id)
                    
            asyncio.create_task(self.precompute_analysis(task.user_id))
            
    async def precompute_analysis(self, user_id: int):
        """Pre-train and cache all models after upload so analysis page loads instantly"""
        try:
            from backend.db.session import get_background_session
            db = get_background_session()
            loop = asyncio.get_running_loop()
            
            # run all slow operations in thread pool so they don't block
            await loop.run_in_executor(None, self.run_precompute, db, user_id)
            logger.info(f"Pre-computation complete for user {user_id}")
            
        except Exception as e:
            logger.warning(f"Pre-computation failed for user {user_id}: {e}")
            
    def run_precompute(self, db, user_id: int):
        from backend.services.forecasting_services import ForecastingService
        from backend.services.predictive_analysis import PredictiveAnalysisService
        from backend.services.display_service import DisplayService
        
        try:
            # pre-train and cache it
            forecast_service = ForecastingService(db)
            forecast_service.forecast_expenses(user_id, periods=6)
            
            # pre-run and cache anomaly detection
            predictive = PredictiveAnalysisService(db)
            predictive.detect_anomalies(user_id)
            
            # pre-compute financial
            display = DisplayService(db)
            display.get_financial_summary(user_id, timeframe="all_time")
        
        finally:
            db.close()
                    
    async def handle_task_failure(self, task_id: str, task: DocumentTask, error: Exception, processing_time: float):
        """Thread-safe task failure handler"""
        logger.error(f"Task failed: {task.filename} after {processing_time:.1f}s — {error}")
        
        async with self.lock:
            self.failed_tasks[task_id] = {
                'task': task,
                'error': str(error),
                'processing_time': processing_time,
                'failed_at': datetime.now(),
            }
            
            if task_id in self.processing_tasks:
                del self.processing_tasks[task_id]
                
            # update metrics
            self.metrics['total_failed'] += 1
            
        # record rate limit 
        if self.enable_rate_limiting:
            self.rate_limiter.record_failure()
            
        # cleanup temp files
        self.cleanup_task_resources(task)
            
    def update_progress(self, task_id: str, stage: str, percentage: int):
        """Update progress for a task"""
        logger.debug(f"Progress: {task_id} - {stage}: {percentage}%")
        
    def remove_dependency(self, task_id: str, depends_on: str):
        """Remove dependecy"""
        if task_id in self.dependencies:
            self.dependencies[task_id].discard(depends_on)
            if not self.dependencies[task_id]:
                del self.dependencies[task_id]
                
        if depends_on in self.dependents:
            self.dependents[depends_on].discard(task_id)
            if not self.dependents[depends_on]:
                del self.dependents[depends_on] 
                
    def cleanup_task_resources(self, task: DocumentTask):
        """Clean up task resource"""
        # clean up temporary file
        try:
            if os.path.exists(task.file_path):
                os.remove(task.file_path)
                logger.debug(f"Cleaned temp file: {task.file_path}")
        except Exception as e:
            logger.warning(f"Failed to cleanup temp file {task.file_path}: {e}")
            
        # memory cleanup
        if self.enable_memory_management:
            self.memory_scheduler.cleanup_memory()
            
    async def background_monitor(self):
        """Background monitoring of system health"""
        while True:
            try:
                await asyncio.sleep(60)
                
                # get system metrics
                memory_percent = psutil.virtual_memory().percent
                cpu_percent = psutil.cpu_percent(interval=1)
                
                # adaptive adjustments
                if memory_percent > 85 and self.max_concurrent_docs > 1:
                    # reduce concurrent processing
                    self.max_concurrent_docs = max(1, self.max_concurrent_docs - 1)
                    logger.warning(f"High memory ({memory_percent}%), " f"reduced to {self.max_concurrent_docs} concurrent docs")
                    
                elif (memory_percent < 60 and cpu_percent < 70 and self.max_concurrent_docs < 5):
                    # increase if resources available
                    self.max_concurrent_docs += 1
                    logger.info(f"Resources available, " f"increased to {self.max_concurrent_docs} concurrent docs")
                    
                logger.info(
                    f"📈 System Status: "
                    f"Memory={memory_percent}%, "
                    f"CPU={cpu_percent}%, "
                    f"Concurrent={len(self.processing_tasks)}/{self.max_concurrent_docs}, "
                    f"Pending={len(self.pending_tasks)}, "
                    f"Completed={len(self.completed_tasks)}"
                )
            
            except Exception as e:
                logger.error(f"Monitoring error: {e}")
                await asyncio.sleep(30)
                
    async def get_task_status(self, task_id: str) -> Dict:
        """Get detailed task status"""
        async with self.lock:
            if task_id in self.pending_tasks:
                return {
                    'status': 'pending',
                    'task': self.pending_tasks[task_id],
                    'queue_position': self.get_queue_position(task_id),
                    'estimated_wait_seconds': self.estimate_wait_time(task_id),
                    'memory_estimate_mb': self.memory_scheduler.estimate_memory_needed(
                        self.pending_tasks[task_id]
                    )
                }
            elif task_id in self.processing_tasks:
                return {
                    'status': 'processing',
                    'task': self.processing_tasks[task_id],
                    'started_at': self.processing_tasks[task_id].created_at.isoformat(),
                    'concurrent_tasks': len(self.processing_tasks)
                }
            elif task_id in self.completed_tasks:
                return {
                    'status': 'completed',
                    'result': self.completed_tasks[task_id]
                }
            elif task_id in self.failed_tasks:
                return {
                    'status': 'failed',
                    'error': self.failed_tasks[task_id]['error']
                }
            else:
                return {'status': 'not_found'}
            
    def get_queue_position(self, task_id: str) -> int:
        """Get position in queue"""
        task = self.pending_tasks[task_id]
        
        position = 0
        for t_id in self.queues[task.priority]:
            if t_id == task_id:
                break
            position += 1
            
        # add tasks from higher priority queues
        for priority in [p for p in ProcessingPriority if p.value < task.priority.value]:
            position += len(self.queues[priority])
            
        return position
    
    def estimate_wait_time(self, task_id: str) -> float:
        """Estimate wait time in seconds"""
        position = self.get_queue_position(task_id)
        avg_time = self.metrics['avg_processing_time_seconds']
        
        if avg_time == 0:
            avg_time = 60
            
        return (position / self.max_concurrent_docs) * avg_time
    
    async def cancel_task(self, task_id: str) -> Dict:
        """Cancel a task with resource cleanup"""
        async with self.lock:
            if task_id in self.pending_tasks:
                task = self.pending_tasks[task_id]
                
                # remove from queue
                if task_id in self.queues[task.priority]:
                    self.queues[task.priority].remove(task_id)
                    self.metrics['queue_sizes'][task.priority.value] -= 1
                    
                # remove dependencies
                if task_id in self.dependencies:
                    for dep_id in list(self.dependencies[task_id]):
                        self.remove_dependency(task_id, dep_id)
                    
                # clean up resources
                self.cleanup_task_resources(task)
                
                del self.pending_tasks[task_id]
                
                return {
                    'success': True,
                    'message': f"Cancelled task {task_id}",
                    'filename': task.filename
                }
            
            elif task_id in self.processing_tasks:
                return False
            
            return False
        
    def get_system_metrics(self) -> Dict:
        """Get comprehensive system metrics"""
        metrics = self.metrics.copy()
        
        # add current system stats
        metrics.update({
            'current_memory_percent': psutil.virtual_memory().percent,
            'current_cpu_percent': psutil.cpu_percent(),
            'current_concurrent_tasks': len(self.processing_tasks),
            'pending_tasks': len(self.pending_tasks),
            'completed_tasks': len(self.completed_tasks),
            'failed_tasks': len(self.failed_tasks),
            'total_tasks': (len(self.pending_tasks) + len(self.processing_tasks) + len(self.completed_tasks) + len(self.failed_tasks)),
            'timestamp': datetime.now().isoformat(),
            'rate_limiting_enabled': self.enable_rate_limiting,
            'memory_management_enabled': self.enable_memory_management,
            'max_concurrent_docs': self.max_concurrent_docs
        })
        
        # add rate limiter metrics if enabled
        if self.enable_rate_limiting:
            rate_metrics = self.rate_limiter.get_status()
            metrics['rate_limiter'] = {
                'success_rate': rate_metrics['metrics']['success_rate'],
                'current_rate_per_minute': rate_metrics['current_rate_per_minute'],
                'circuit_state': rate_metrics['circuit_state']
            }
            
        return metrics
    
    async def retry_schedule_after_delay(self, delay_seconds: int):
        """Retry scheduling after a delay when memory is constrained"""
        await asyncio.sleep(delay_seconds)
        self.memory_scheduler.cleanup_memory()  # trigger GC first
        asyncio.create_task(self.schedule_task())
    
multi_doc_processor = MultiDocumentProcessor(
    max_concurrent_docs=3,
    enable_rate_limiting=True,
    enable_memory_management=True
)