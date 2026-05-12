from collections import deque
import statistics
import threading
from typing import List, Dict, Optional, Callable, Any, Generator, Tuple
import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from backend.models.database import Transaction, DocumentChunk
from sqlalchemy.dialects.postgresql import insert
from backend.db.redis_client import cache
from backend.services.progress_tracker import progress_tracker
from backend.services.vector_search import VectorSearchService
from concurrent.futures import Future, ThreadPoolExecutor, as_completed
from datetime import datetime
import logging
import time
import torch
import gc
import psutil
from contextlib import contextmanager

from backend.config.smart_batch_rate_limit import batch_rate_limiter, global_rate_limiter
from backend.db.redis_client import cache
from backend.db.session import db_manager

logger = logging.getLogger(__name__)

class ProcessingCancelledError(Exception):
    """Raised when user cancels processing"""
    pass

class BatchTimeoutError(Exception):
    """Raised when batch processing times out"""
    pass

class MemoryThresholdError(Exception):
    """Raised when memory usage exceeds threshold"""
    pass
            
class BatchProcessor:
    """Batch processing using parallel methods for transactions and document chunking with rate limiting and memory management"""
    def __init__(self, batch_size: int = 1000, max_workers: int = 4, progress_callback = None, db: Optional[Session] = None, vector_service: Optional[VectorSearchService] = None, upload_id: Optional[str] = None, user_id: Optional[int] = None, enable_rate_limiting: bool = True, operation_timeout: int = 300, memory_threshold_percent: float = 85.0):
        self.initial_batch_size = batch_size
        self.max_workers = max_workers
        self.vector_service = vector_service
        self.progress_callback = progress_callback
        self.db = db
        self.upload_id = upload_id
        self.user_id = user_id
        self.enable_rate_limiting = enable_rate_limiting
        self.operation_timeout = operation_timeout
        self.memory_threshold_percent = memory_threshold_percent
        
        # performance metrics 
        self.performance_history = {
            'transaction_batch': deque(maxlen=50), 
            'embedding_batch': deque(maxlen=50),
            'chunk_batch': deque(maxlen=50),
            'storage_batch': deque(maxlen=50)
        }
        
        # current batch size 
        self.current_batch_sizes = {
            'transaction': batch_size,
            'embedding': 50,
            'chunk': 100,
            'storage': 100
        }
        
        # throughput tracking (items/second)
        self.throughput = {
            'transaction': deque(maxlen=10),
            'embedding': deque(maxlen=10),
            'chunk': deque(maxlen=10),
            'storage': deque(maxlen=10)
        }
        
        # target performance metrics
        self.target_throughput = 1000
        self.target_latency_ms = 100
        self.min_batch_size = 10
        self.max_batch_size = 5000
        
        # memory management
        self.last_memory_check = time.time()
        self.memory_check_interval = 5
        self.memory_pressure_mode = False
        
        # thread safety
        self.lock = threading.RLock()
        self.active_futures: List[Future] = []
        
        # whole metrics
        self.metrics = {
            'total_processed': 0,
            'total_errors': 0,
            'batch_times': [],
            'memory_usage': [],
            'rate_limit_hits': 0,
            'timeouts': 0,
            'adaptive_adjustments': 0
        }
        
        if not self.vector_service:
            try:
                from backend.services.vector_search import VectorSearchService
                self.vector_service = VectorSearchService(db or self.db)
            except Exception as e:
                logger.error(f"Failed to initialize VectorSearchService: {e}")
                self.vector_service = None
    
    # =========================================================================
    # SESSION MANAGEMENT
    # =========================================================================
    
    def get_session(self) -> Tuple[Session, bool]:
        """Get database session with context manager"""
        if self.db is not None:
            # session was injected - do not close it!
            return self.db, False
        else:
            # create new session - then close it
            from backend.db.session import get_background_session
            return get_background_session(), True
        
    @contextmanager
    def session_scope(self):
        """Context manager for database sessions"""
        session, should_close = self.get_session()
        try:
            yield session
            if should_close:
                session.commit()
        except Exception:
            if should_close:
                session.rollback()
            raise
        finally:
            if should_close:
                session.close()
                
    # =========================================================================
    # CANCELLATION HANDLING
    # =========================================================================

    def check_cancelled(self, cancellation_check: Optional[Callable], context: str = "") -> None:
        """Unified cancellation check with logging"""
        if cancellation_check and callable(cancellation_check):
            try:
                if cancellation_check():
                    msg = f"Processing cancelled {context}".strip()
                    logger.info(msg)
                    raise ProcessingCancelledError(msg)
            except ProcessingCancelledError:
                raise
            except Exception as e:
                logger.error(f"Cancellation check failed {context}: {e}")
                
    # =========================================================================
    # MEMORY MANAGEMENT
    # =========================================================================
    
    def check_memory(self, required_mb: int = 100) -> bool:
        """Check if sufficient memory is available"""
        memory = psutil.virtual_memory()
        available_mb = memory.available / (1024 * 1024)
        
        # update memory pressure mode
        if memory.percent > self.memory_threshold_percent:
            self.memory_pressure_mode = True
            logger.warning(f"Memory pressure mode: {memory.percent:.1f}% used")
        else:
            self.memory_pressure_mode = False
            
        if available_mb < required_mb:
            logger.warning(f"Low memory: {available_mb:.0f}MB available, " f"need {required_mb}MB")
            return False
        
        # record metrics
        self.metrics['memory_usage'].append({
            'timestamp': time.time(),
            'percent': memory.percent,
            'available_mb': available_mb
        })
        
        return True
    
    def cleanup_memory(self, aggresive: bool = False):
        """Perform memory cleanup"""
        gc.collect()
        
        if aggresive or psutil.virtual_memory().percent > 80:
            logger.info("Performing aggressive memory cleanup")
            gc.collect(generation=2)
            
            # clear any larger caches
            if hasattr(self, 'vector_service') and self.vector_service:
                if hasattr(self.vector_service, 'clear_cache'):
                    self.vector_service.clear_cache()
                    
    def monitor_memory(self):
        """Periodic memory monitoring and adaptation"""
        now = time.time()
        if now - self.last_memory_check < self.memory_check_interval:
            return
        
        self.last_memory_check = now
        memory_percent = psutil.virtual_memory().percent
        
        if memory_percent > 90:
            # critical memory condition - reduce everything
            with self.lock:
                for op_type in self.current_batch_sizes:
                    self.current_batch_sizes[op_type] = max(
                        self.min_batch_size,
                        int(self.current_batch_sizes[op_type] * 0.5)
                    )
                    self.max_workers = max(1, self.max_workers // 2)
                    logger.warning(f"Critical memory ({memory_percent}%): reduced batch sizes")
                    
        elif memory_percent > 80 and not self.memory_pressure_mode:
            self.memory_pressure_mode = True
            logger.info(f"Entering memory pressure mode ({memory_percent}%)")
        
        elif memory_percent < 60 and self.memory_pressure_mode:
            self.memory_pressure_mode = False
            logger.info(f"Exiting memory pressure mode ({memory_percent}%)")
            
    # =========================================================================
    # CLEANUP OPTIMIZE MANAGEMENT
    # =========================================================================
    def _cleanup_memory(self):
        """
        Aggressive memory cleanup - call after processing operations.
        Safe for 16GB servers.
        """
        try:
            logger.debug("🧹 Starting memory cleanup...")
        
            # 1. Clear any cached temporary data
            if hasattr(self, '_temp_data'):
                del self._temp_data
        
            # 2. Force Python garbage collection (all generations)
            collected = gc.collect(generation=2)
        
            # 3. Clear PyTorch CUDA cache if available
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                torch.cuda.synchronize()
        
            # 4. Log memory status (optional, remove if too verbose)
            memory = psutil.virtual_memory()
            logger.debug(f"   Memory: {memory.percent:.1f}% used, {memory.available / (1024**3):.2f}GB free")
        
        except Exception as e:
            logger.warning(f"Memory cleanup warning: {e}")
 
    def _cleanup_dataframe(self, df):
        """
        Clean up DataFrame from memory.
        Call this after you're done with a DataFrame.
        """
        try:
            if df is not None:
                # Clear the dataframe
                df = None
                del df
                gc.collect(generation=0)
        except Exception as e:
            logger.warning(f"DataFrame cleanup warning: {e}")
 
    def _periodic_cleanup(self):
        """
        Lighter cleanup for periodic use during long operations.
        Call every N batches (e.g., every 5-10 batches).
        """
        try:
            # Just generation 0 (fastest)
            gc.collect(generation=0)
        
            # Only clear CUDA cache if memory is high
            if torch.cuda.is_available():
                memory = psutil.virtual_memory()
                if memory.percent > 80:
                    torch.cuda.empty_cache()
                
        except Exception as e:
            logger.warning(f"Periodic cleanup warning: {e}")
            
    # =========================================================================
    # RATE LIMITING
    # =========================================================================
    
    def acquire_rate_limit(self, tokens: int = 1, timeout: float = 5.0) -> bool:
        """Acquire rate limit tokens"""
        if not self.enable_rate_limiting:
            return True
        
        try:
            return global_rate_limiter.acquire(tokens, timeout=timeout)
        except Exception as e:
            logger.error(f"Rate limit acquisition failed: {e}")
            self.metrics['rate_limit_hits'] += 1
            return False
        
    def record_success(self):
        """Record successful operation for rate limiting."""
        if self.enable_rate_limiting:
            global_rate_limiter.record_success()
            
    def record_failure(self):
        """Record failed operation for rate limiting."""
        if self.enable_rate_limiting:
            global_rate_limiter.record_failure()
            
    @contextmanager
    def rate_limited_batch(self, batch_size: int, operation_type: str = 'default'):
        """Context manager for rate-limited batch processing"""
        # acquire rate limit tokens
        if not self.acquire_rate_limit(batch_size):
            self.metrics['rate_limit_hits'] += 1
            raise Exception(f"Rate limit exceeded for {operation_type} batch")
        
        start_time = time.time()
        try:
            yield
            # record success
            self.record_success()
            
            # update metrics
            processing_time = time.time() - start_time
            with self.lock:
                self.metrics['batch_times'].append(processing_time)
                
        except Exception as e:
            # record the failure
            self.record_failure()
            raise
        
    # =========================================================================
    # ADAPTIVE BATCH SIZING
    # =========================================================================
    
    def calculate_optimal_batch_size(self, total_items: int, operation_type: str = 'transaction', forced: bool = False) -> int:
        """Calculate optimal batch size based on real-time performance"""
        base_size = self.current_batch_sizes.get(operation_type, self.initial_batch_size)
        
        if forced:
            return min(base_size, total_items)
        
        # get performance history for this operation type
        history_key = f"{operation_type}_batch"
        history = self.performance_history.get(history_key, deque())
        
        if len(history) >= 5:
            # calculate average performance metrics
            avg_time = statistics.mean(h[1] for h in history if h[1] > 0)
            avg_success = statistics.mean(h[2] for h in history)
            
            # calculate per-item latency
            items_per_second = base_size / max(avg_time, 0.001)
            
            # adjust based on throughput
            if items_per_second < self.target_throughput * 0.7:
                # if its too slow - reduce the batch size
                base_size = max(self.min_batch_size, int(base_size * 0.8))
                with self.lock:
                    self.metrics['adaptive_adjustments'] += 1
                logger.debug(f"Reducing {operation_type} batch size to {base_size}" f"(throughput: {items_per_second:.1f}/s)")
                
            elif items_per_second > self.target_throughput * 1.3 and avg_success > 0.95:
                # if its successfull and stabilize - increase the batch size
                base_size = min(self.max_batch_size, int(base_size * 1.2))
                with self.lock:
                    self.metrics['adaptive_adjustments'] += 1
                logger.debug(f"Increasing {operation_type} batch size to {base_size} " f"(throughput: {items_per_second:.1f}/s)")
                
        # adjust based on rate limiting status
        if self.enable_rate_limiting:
            rate_status = global_rate_limiter.get_status()
            success_rate = rate_status['metrics']['success_rate']
            
            if success_rate < 90.0:
                # high error rate - be conservative
                base_size = max(self.min_batch_size, int(base_size * 0.7))
            elif success_rate > 98.0:
                # great success - increase batch size
                base_size = min(self.max_batch_size, int(base_size * 1.1))
                
        # adjust based on memory pressure
        if self.memory_pressure_mode:
            base_size = max(self.min_batch_size, int(base_size * 0.7))
            
        # don't create too many tiny batches
        if total_items < base_size * 2:
            base_size = max(self.min_batch_size, total_items // 4)
            
        # apply bounds
        final_size = min(base_size, self.max_batch_size, total_items)
        final_size = max(self.min_batch_size, final_size)
        
        return final_size
    
    def record_batch_performance(self, operation_type: str, batch_size: int, processing_time: float, success_count: int, total_count: int):
        """Record batch performance for adaptive sizing"""
        success_rate = (success_count / max(total_count, 1)) * 100
        per_item_time = processing_time / max(batch_size, 1) * 1000
        
        # update throughput (items/second)
        throughput = batch_size / max(processing_time, 0.001)
        self.throughput[operation_type].append(throughput)
        
        # update performance history
        history_key = f"{operation_type}_batch"
        self.performance_history[history_key].append(
            (batch_size, processing_time, success_rate)
        )
        
        # update current batch size based on performance
        if len(self.performance_history[history_key]) >= 5:
            # calculate moving average of optimal size
            recent = list(self.performance_history[history_key])[-5:]
            optimal_sizes = [s[0] for s in recent]
            
            # weight more recent results higher
            weights = [0.1, 0.15, 0.2, 0.25, 0.3]
            weighted_avg = sum(s * w for s, w in zip(optimal_sizes, weights))
            
            # smooth update
            current = self.current_batch_sizes.get(operation_type, self.initial_batch_size)
            new_size = int(current * 0.8 + weighted_avg * 0.2)
            
            # apply bounds
            new_size = max(self.min_batch_size, min(self.max_batch_size))
            
            with self.lock:
                self.current_batch_sizes[operation_type] = new_size
                
            logger.debug(f"Updated {operation_type} batch size: {current} -> {new_size} " f"(throughput: {throughput:.1f}/s, latency: {per_item_time:.1f}ms)")
            
        # log warnings for poor performance
        if per_item_time > self.target_latency_ms * 2:
            logger.warning(f"High latency for {operation_type}: {per_item_time:.1f}ms/item")
        if  success_rate < 90:
            logger.warning(f"Low success rate for {operation_type}: {success_rate:.1f}%")
            
    # =========================================================================
    # TRANSACTION PROCESSING
    # =========================================================================

    def process_transactions_batch(self, transactions_data: List[Dict], cancellation_check: Optional[Callable] = None) -> int:
        """Batch insert transactions with parallel processing method"""
        
        if not transactions_data:
            return 0
        
        # cancellation check
        self.check_cancelled(cancellation_check, "before transaction batch")
        
        # track progress
        self.set_progress("Processing Transactions", 0, f"Starting batch processing of {len(transactions_data)} transactions")
        
        processed = 0
        # split into batches
        total_transactions = len(transactions_data)
        
        # get session
        with self.session_scope() as db:
            try:
                # calculate optimal batch size
                optimal_batch_size = self.calculate_optimal_batch_size(
                    total_transactions, 'transaction'
                )
                
                # split into batches
                batches = []
                for i in range(0, total_transactions, optimal_batch_size):
                    batch = transactions_data[i:i + optimal_batch_size]
                    batches.append(batch)
                    
                total_batches = len(batches)
                self.set_progress("Processing Transactions", 10, f"Split into {total_batches} batches")
                
                # process batches in parallel
                with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                    # submit all batches
                    future_to_batch = {}
                    for batch_num, batch in enumerate(batches):
                        # check cancellation before submission
                        self.check_cancelled(cancellation_check, f"before batch {batch_num}")
                        
                        future = executor.submit(
                            self.process_single_batch, batch, batch_num, db, cancellation_check
                        )
                        future_to_batch[future] = (batch_num, batch)
                        self.active_futures.append(future)
                        
                    # completed results
                    completed_batches = 0
                    for future in as_completed(future_to_batch):
                        # check cancellation
                        self.check_cancelled(cancellation_check, "during batch collection")
                        
                        batch_num, batch = future_to_batch[future]
                        try:
                            # set timeout
                            batch_result = future.result(timeout=self.operation_timeout)
                            processed += batch_result
                            completed_batches += 1
                            
                            # update progress
                            progress_pct = 10 + int((completed_batches / total_batches) * 60)
                            self.set_progress("Processing Transactions", progress_pct, f"Processed {completed_batches}/{total_batches} batches")

                            # memory cleanup every few batches
                            if completed_batches % 5 == 0:
                                self.cleanup_memory()
                                self.monitor_memory()
                                
                        except TimeoutError:
                            logger.error(f"Batch {batch_num} timed out after {self.operation_timeout}s")
                            self.metrics['timeouts'] += 1
                            future.cancel()
                            
                        except ProcessingCancelledError:
                            # cancel all pending futures
                            for f in self.active_futures:
                                f.cancel()
                            raise
                        
                        except Exception as e:
                            logger.error(f"Batch {batch_num} failed: {e}")
                            self.metrics['total_errors'] += len(batch)
                            
                    self.active_futures.clear()
                
                self.set_progress("Processing Transactions", 80, f"Successfully processed {processed} transactions")
                return processed
            
            except ProcessingCancelledError:
                logger.info("Transaction processing cancelled")
                raise
            except Exception as e:
                logger.error(f"Transaction processing failed: {e}")
                raise
            
            finally:
                self._cleanup_memory()
                    
    async def bulk_insert_with_retry(self, data: List[Dict], model_class: Any, batch_size: int = 500, max_retries: int = 3) -> int:
        """Bulk insert with rate limiting"""
        inserted = 0
        total_batches = (len(data) + batch_size - 1) // batch_size
        
        for batch_num in range(total_batches):
            start_idx = batch_num * batch_size
            end_idx = min(start_idx + batch_size, len(data))
            batch = data[start_idx:end_idx]
            
            for attempt in range(max_retries):
                try:
                    # apply rate limiting
                    if self.enable_rate_limiting:
                        await global_rate_limiter.acquire_async(len(batch), timeout=5.0)
                        
                    # perform bulk insertion
                    self.db.bulk_insert_mappings(model_class, batch)
                    self.db.commmit()
                    
                    # record success
                    if self.enable_rate_limiting:
                        global_rate_limiter.record_success()
                    
                    logger.debug(f"Batch {batch_num+1}/{total_batches} inserted: "f"{len(batch)} records")
                    break
                except Exception as e:
                    logger.warning(f"Batch insert attempt {attempt+1} failed: {e}")
                    self.db.rollback()
        
        return inserted
    
    def process_single_batch(self, batch: List[Dict], batch_num: int, db: Session, cancellation_check = None) -> int:
        """Process a single batch of transactions with rate limiting"""
        start_time = time.time()
        
        try:
            self.check_cancelled(cancellation_check, f"at start of batch {batch_num}")
            
            # apply rate limiting
            with self.rate_limited_batch(len(batch), 'transaction'):
                # de-duplicate within batch
                seen = {}
                deduped_batch = []
                for txn in batch:
                    txn_hash = txn.get('transaction_hash')
                    if txn_hash and txn_hash not in seen:
                        seen[txn_hash] = True
                        deduped_batch.append(txn)
                    elif txn_hash:
                        logger.debug(f"Duplicate hash in batch {batch_num}: {txn_hash}")
                    else:
                        deduped_batch.append(txn)
                        
                if not deduped_batch:
                    return 0
                
                # perform the bulk insert
                stmt = insert(Transaction).values(deduped_batch)
                stmt = stmt.on_conflict_do_update(
                    index_elements=['transaction_hash'],
                    set_={
                        'amount': stmt.excluded.amount,
                        'category': stmt.excluded.category,
                        'updated_at': datetime.now(),
                        'document_id': stmt.excluded.document_id
                    }
                )
                
                db.execute(stmt)
                db.flush()
                
                # record performance
                processing_time = time.time() - start_time
                self.record_batch_performance(
                    'transaction',
                    len(deduped_batch),
                    processing_time,
                    len(deduped_batch),
                    len(deduped_batch)
                )
                
                # update metrics
                with self.lock:
                    self.metrics['total_processed'] += len(deduped_batch)
                    
                logger.debug(f"Batch {batch_num}: processed {len(deduped_batch)} transactions " f"in {processing_time:.3f}s")
                
                return len(deduped_batch)
            
        except ProcessingCancelledError:
            raise
        except Exception as e:
            processing_time = time.time() - start_time
            self.record_batch_performance(
                'transaction',
                len(batch),
                processing_time,
                0,
                len(batch)
            )
            
            if "rate limit" in str(e).lower():
                logger.warning(f"Rate limit hit for batch {batch_num}, retrying with smaller batch")
                return self.retry_batch_with_smaller_size(batch, batch_num, db, cancellation_check)
            else:
                logger.error(f"Batch {batch_num} failed: {e}")
                # fallback to individual insert method
                return self._insert_individual(batch, db, batch_num, cancellation_check)
            
    def retry_batch_with_smaller_size(self, batch: List[Dict], batch_num: int, db: Session, cancellation_check = None) -> int:
        """Retry batch with smaller size due after rate limit is hit"""
        if len(batch) <= 1:
            return 0
        
        # split into smaller batch
        half_size = len(batch) // 2
        first_half = batch[:half_size]
        second_half = batch[half_size:]
        
        processed = 0
        
        # process first half
        if first_half:
            processed += self.process_single_batch(first_half, batch_num, db, cancellation_check)
            
        # small delay between retries
        if self.enable_rate_limiting:
            time.sleep(0.5)
            
        # process second half
        if second_half:
            processed += self.process_single_batch(second_half, batch_num, db, cancellation_check)
            
        return processed
    
    def _insert_individual(self, batch: List[Dict], db: Session, batch_num: int, cancellation_check: Optional[Callable] = None) -> int:
        """Fallback batch insertion individually to avoid error during batch process: Insert transactions parallelly one by one with rate limiting"""
        processed = 0
        
        # cancellation check
        self.check_cancelled(cancellation_check, f"before individual fallback batch {batch_num}")
        
        for i, transaction in enumerate(batch):
            # check periodically
            if i % 10 == 0:
                self.check_cancelled(cancellation_check, f"individual item {i}")
                
            try:
                # acquire rate limit for each transaction
                if not self.acquire_rate_limit(1):
                    logger.warning(f"Rate limit exceeded for individual insert {i}")
                    continue
                
                if self.insert_single_transaction(transaction, db, i, cancellation_check):
                    processed += 1
                    self.record_success()
                else:
                    self.record_failure()
                    
            except ProcessingCancelledError:
                raise
            except Exception as e:
                logger.warning(f"Individual insert {i} failed: {e}")
                self.record_failure()
        
        logger.info(f"Fallback insert for batch {batch_num}: {processed}/{len(batch)} successful")
        return processed
    
    def insert_single_transaction(self, transaction: Dict, db: Session, cancellation_check: Optional[Callable] = None, index: int = 0) -> bool:
        """Insert a single transaction"""
        # cancellation check
        self.check_cancelled(cancellation_check, f"transaction {index}")
        
        try:
            stmt = insert(Transaction).values(transaction)
            stmt = stmt.on_conflict_do_update(
                index_elements=['transaction_hash'],
                set_={
                    'amount': stmt.excluded.amount,
                    'category': stmt.excluded.category,
                    'updated_at': datetime.now(),
                    'document_id': stmt.excluded.document_id
                }
            )
            
            db.execute(stmt)
            return True
        except Exception as e:
            if "cancelled" in str(e).lower():
                raise
            logger.warning(f"Failed to insert transaction {index}: {e}")
            return False
        
    # =========================================================================
    # EMBEDDING PART
    # =========================================================================
    
    def generate_embeddings_parallel(self, texts: List[str], batch_size: int = 50, max_workers: int = 4, cancellation_check: Optional[Callable] = None) -> List[List[float]]:
        """Generate embeddings in parallel with adaptive batching"""
        if not texts:
            return []
        
        # cancellation check
        self.check_cancelled(cancellation_check, "before embedding generation")
        
        # update progress
        self.set_progress("Generating Embeddings", 0, f"Starting {len(texts)} texts")
        
        # calculate optimal batch size
        adaptive_batch_size = self.calculate_optimal_batch_size(
            len(texts), 'embedding'
        )
        
        # split into batches
        text_batches = []
        for i in range(0, len(texts), adaptive_batch_size):
            batch_texts = texts[i:i + adaptive_batch_size]
            text_batches.append(batch_texts)
            
        total_batches = len(text_batches)
        self.set_progress("Generating Embeddings", 5, f"Split into {total_batches} batches")
        
        # initialize results list
        results = [None] * total_batches
        
        # process batches in parallel
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # submit all batches
            future_to_batch = {}
            for batch_num, batch_texts in enumerate(text_batches):
                # check cancellation
                self.check_cancelled(cancellation_check, f"before embedding batch {batch_num}")
                
                # apply rate limiting
                if not self.acquire_rate_limit(len(batch_texts)):
                    logger.warning(f"Rate limit exceeded for embedding batch {batch_num}")
                    continue
                
                future = executor.submit(
                    self.generate_batch_embeddings,
                    batch_texts, batch_num, cancellation_check
                )
                future_to_batch[future] = (batch_num, batch_texts)
                self.active_futures.append(future)
                
            # collect results
            completed_batches = 0
            for future in as_completed(future_to_batch):
                # check cancellation
                self.check_cancelled(cancellation_check, "during embedding collection")
                
                batch_num, batch_texts = future_to_batch[future]
                try:
                    batch_embeddings = future.result(timeout=self.operation_timeout)
                    results[batch_num] = batch_embeddings
                    completed_batches += 1
                    
                    # record success
                    self.record_success()
                    
                    # record performance
                    if batch_embeddings:
                        self.record_batch_performance(
                            'embedding',
                            len(batch_texts),
                            0,  
                            len([e for e in batch_embeddings if e]),
                            len(batch_texts)
                        )
                        
                    # update progress
                    progress_act = 5 + int((completed_batches / total_batches) * 80)
                    self.set_progress("Generating Embeddings", progress_act, f"Generated {completed_batches}/{total_batches} batches")
                    
                except TimeoutError:
                    logger.error(f"Embedding batch {batch_num} timed out")
                    self.metrics['timeouts'] += 1
                    # create zero embeddings as fallback
                    results[batch_num] = [[0.0] * 128 for _ in batch_texts]
                except ProcessingCancelledError:
                    # cancel all pending
                    for f in self.active_futures:
                        f.cancel()
                    raise
                except Exception as e:
                    logger.error(f"Embedding batch {batch_num} failed: {e}")
                    results[batch_num] = [[0.0] * 128 for _ in batch_texts]
                    
        # clear active futures
        self.active_futures.clear()
        
        # flatten results
        embeddings = []
        for batch_result in results:
            if batch_result:
                embeddings.extend(batch_result)
                
        self.set_progress("Generating Embeddings", 90, f"Generated {len(embeddings)} embeddings")
        
        # verify count
        if len(embeddings) != len(texts):
            logger.warning(f"Embedding count mismatch: got {len(embeddings)}, expected {len(texts)}")
            
            # pad with zeros if needed
            while len(embeddings) < len(texts):
                embeddings.append([0.0] * 128)
                
        return embeddings
    
    
    def calculate_embedding_batch_size(self, total_texts: int) -> int:
        """Calculate optimal embedding batch size based on rate limiting"""
        base_size = 50
        
        if self.enable_rate_limiting:
            rate_status = global_rate_limiter.get_status()
            if rate_status['metrics']['success_rate'] < 90.0:
                base_size = max(10, base_size // 2)
                
        # adjust for memory
        memory_mb = psutil.virtual_memory().available / (1024 * 1024)
        if memory_mb < 1000:
            base_size = max(10, base_size // 2)
            
        return min(base_size, 100)
    
    def generate_batch_embeddings(self, batch_texts: List[str], batch_num: int, cancellation_check: Optional[Callable] = None) -> List[List[float]]:
        """Generate embeddings for a single batch with rate limiting"""
        # cancellation check
        self.check_cancelled(cancellation_check, f"embedding batch {batch_num}")
        
        if not self.vector_service:
            # initialize vector service if needed
            try:
                from backend.services.vector_search import VectorSearchService
                with self.session_scope() as db:
                    self.vector_service = VectorSearchService(db)
            except Exception as e:
                logger.error(f"Failed to initialize vector service for batch {batch_num}: {e}")
                return [[0.0] * 128 for _ in batch_texts]
            
        try:
            # generate embeddings
            embeddings = self.vector_service.generate_embeddings(
                batch_texts,
                batch_size=len(batch_texts)
            )
            
            # validate embeddings
            if not embeddings or len(embeddings) != len(batch_texts):
                logger.warning(f"Embedding batch {batch_num}: got {len(embeddings) if embeddings else 0}, " f"expected {len(batch_texts)}")
                return [[0.0] * 128 for _ in batch_texts]
            
            return embeddings
        except Exception as e:
            logger.error(f"Embedding batch {batch_num} failed: {e}")
            return [[0.0] * 128 for _ in batch_texts] # fallback to zero embeddings
        
    # =========================================================================
    # DOCUMENT CHUNKING
    # =========================================================================   
        
    def chunk_documents_parallel(self, df: pd.DataFrame, document_id: int, max_workers: int = 4, cancellation_check: Optional[Callable] = None) -> List[Dict]:
        """Chunk documents in parallel"""
        # cancellation check 
        self.check_cancelled(cancellation_check, "before document chunking")
        
        # check dataframe is empty or not
        if df.empty:
            logger.warning("DataFrame is empty, returning empty chunks list")
            return []
        
        # update progress
        self.set_progress("Chunking Document", 0, f"Chunking {len(df)} rows")
        
        # calculate optimal chunk size based on memory
        rows_per_chunk = self.calculate_optimal_batch_size(len(df), 'chunk')
        
        # split dataframe into chunks
        df_chunks = []
        for i in range(0, len(df), rows_per_chunk):
            chunk = df.iloc[i:i + rows_per_chunk]
            if not chunk.empty:
                df_chunks.append(chunk)
                
        total_chunks = len(df_chunks)
        self.set_progress("Chunking document", 10, f"Split into {total_chunks} chunks")
        
        # process chunks in parallel
        all_chunks = []
        chunk_lock = threading.Lock()
        
        with ThreadPoolExecutor(max_workers=min(max_workers, total_chunks)) as executor:
            # submit all batches
            future_to_chunk = {}
            for chunk_num, chunk_df in enumerate(df_chunks):
                # cancellation check
                self.check_cancelled(cancellation_check, f"before chunk {chunk_num}")
                
                # rate limiting
                if not self.acquire_rate_limit(len(chunk_df)):
                    logger.warning(f"Rate limit exceeded for chunk {chunk_num}")
                    continue
                
                future = executor.submit(
                    self.process_single_chunk,
                    chunk_df, document_id, chunk_num, cancellation_check
                ) 
                future_to_chunk[future] = chunk_num
                self.active_futures.append(future)
                
            # collect results
            completed_chunks = 0
            for future in as_completed(future_to_chunk):
                # cancellation check
                self.check_cancelled(cancellation_check, "during chunk collection")
                
                chunk_num = future_to_chunk[future]
                try:
                    chunk_result = future.result(timeout=self.operation_timeout)
                    
                    with chunk_lock:
                        all_chunks.extend(chunk_result)
                        
                    completed_chunks += 1
                    self.record_success()
                    
                    # record performance
                    self.record_batch_performance(
                        'chunk',
                        len(chunk_result) if chunk_result else 0,
                        0,  # We don't have exact time
                        len(chunk_result) if chunk_result else 0,
                        len(chunk_result) if chunk_result else 0
                    )
                    
                    # update progress
                    progress_pct = 10 + int((completed_chunks / total_chunks) * 40)
                    self.set_progress("Chunking Document", progress_pct, f"Processed {completed_chunks}/{total_chunks} chunks")
                    
                except TimeoutError:
                    logger.error(f"Chunk {chunk_num} timed out")
                    self.metrics['timeouts'] += 1
                except ProcessingCancelledError:
                    # cancel all pending
                    for f in self.active_futures:
                        f.cancel()
                    raise
                except Exception as e:
                    logger.error(f"Chunk {chunk_num} processing failed: {e}")
                    
        self.active_futures.clear()
        
        self.set_progress("Chunking Document", 60, f"Created {len(all_chunks)} chunks")
        return all_chunks
    
    def process_single_chunk(self, chunk_df: pd.DataFrame, document_id: int, chunk_num: int, cancellation_check: Optional[Callable] = None) -> List[Dict]:
        """Process a single document chunk"""
        self.check_cancelled(cancellation_check, f"chunk {chunk_num}")
        
        chunks = []
        
        if chunk_df.empty:
            return chunks
        
        for idx, row in chunk_df.iterrows():
            try:
                # check cancellation periodically
                if idx % 10 == 0:
                    self.check_cancelled(cancellation_check, f"chunk {chunk_num} row {idx}")
                    
                # apply rate limiting
                if not self.acquire_rate_limit(1):
                    logger.warning(f"Rate limit exceeded for row {idx}")
                    continue
                
                # create chunk text
                chunk_text = self._create_transaction_text(row)
                
                chunks.append({
                    'document_id': document_id,
                    'chunk_text': chunk_text,
                    'chunk_index': chunk_num * 1000 + idx,  
                    'chunk_metadata': {
                        'row_index': idx,
                        'chunk_number': chunk_num,
                        'total_rows_in_chunk': len(chunk_df),
                        'processed_at': datetime.now().isoformat()
                    }
                })
                
            except ProcessingCancelledError:
                raise
            except Exception as e:
                logger.warning(f"Error creating chunk for row {idx}: {e}")
                continue
        
        return chunks
    
    # =========================================================================
    # EMBEDDING STORAGE
    # =========================================================================
                                
    def store_embeddings_parallel(self, db: Session, chunks: List[Dict], embeddings: List[List[float]], max_workers: int = 4, cancellation_check = None) -> bool:
        """Store embeddings with parallel processing"""
        if not chunks or not embeddings or len(chunks) != len(embeddings):
            logger.error(f"Chunk/embedding mismatch: chunks={len(chunks)}, embeddings={len(embeddings)}")
            return False
        
        # check cancellation
        self.check_cancelled(cancellation_check, "before embedding storage")
        
        # update progress
        self.set_progress("Storing Embeddings", 0, f"Storing {len(chunks)} embeddings")
        
        # calculate optimal batch size
        batch_size = self.calculate_optimal_batch_size(len(chunks), 'storage')
        
        # split into batches
        batches = []
        for i in range(0, len(chunks), batch_size):
            chunk_batch = chunks[i:i + batch_size]
            embedding_batch = embeddings[i:i + batch_size]
            batches.append((chunk_batch, embedding_batch))
            
        total_batches = len(batches)
        self.set_progress("Storing Embeddings", 5, f"Split into {total_batches} batches")
        
        # results tracking
        results = [False] * total_batches
        
        with ThreadPoolExecutor(max_workers=min(max_workers, total_batches)) as executor:
            # submit all batches
            future_to_batch = {}
            for batch_idx, (chunk_batch, embedding_batch) in enumerate(batches):
                # check cancellation
                self.check_cancelled(cancellation_check, f"before storage batch {batch_idx}")
                
                # apply rate limiting
                if not self.acquire_rate_limit(len(chunk_batch)):
                    logger.warning(f"Rate limit exceeded for storage batch {batch_idx}")
                    continue
                
                future = executor.submit(
                    self.store_embeddings_batch,
                    db, chunk_batch, embedding_batch, batch_idx, cancellation_check
                )
                
                future_to_batch[future] = (batch_idx, chunk_batch)
                self.active_futures.append(future)
                
            # collect results
            completed_batches = 0
            for future in as_completed(future_to_batch):
                # check cancellation
                self.check_cancelled(cancellation_check, "during storage collection")
                
                batch_idx, chunk_batch = future_to_batch[future]
                try:
                    success = future.result(timeout=self.operation_timeout)
                    results[batch_idx] = success
                    completed_batches += 1
                    
                    if success:
                        self.record_success()
                        
                        # record performance
                        self.record_batch_performance(
                            'storage',
                            len(chunk_batch),
                            0,  
                            len(chunk_batch),
                            len(chunk_batch)
                        )
                        
                    # update progress
                    progress_pct = 5 + int((completed_batches / total_batches) * 90)
                    self.set_progress("Storing Embeddings", progress_pct, f"Stored {completed_batches}/{total_batches} batches")
                    
                except TimeoutError:
                    logger.error(f"Storage batch {batch_idx} timed out")
                    self.metrics['timeouts'] += 1
                    results[batch_idx] = False
                except ProcessingCancelledError:
                    # cancel all pending
                    for f in self.active_futures:
                        f.cancel()
                    raise
                except Exception as e:
                    logger.error(f"Storage batch {batch_idx} failed: {e}")
                    results[batch_idx] = False
                    
        # clear active futures
        self.active_futures.clear()
        
        overall_success = all(results)
        self.set_progress("Storing Embeddings", 100, f"Storage {'successful' if overall_success else 'partial'} for {len(chunks)} embeddings")
        
        return overall_success
        
    def calculate_storage_batch_size(self, total_items: int) -> int:
        """Calculate optimal storage batch size"""
        base_size = 100
        
        if self.enable_rate_limiting:
            rate_status = global_rate_limiter.get_status()
            if rate_status['metrics']['success_rate'] < 90.0:
                base_size = max(20, base_size // 2)
                
        return min(base_size, total_items // 2)
        
    def store_embeddings_batch(self, db: Session, chunk_batch: List[Dict], embedding_batch: List[List[float]], batch_idx: int, cancellation_check=None) -> bool:
        """Store a single batch of embeddings with rate limiting"""
        self.check_cancelled(cancellation_check, f"storage batch {batch_idx}")    
        
        try:
            for i, chunk in enumerate(chunk_batch):
                # check periodically
                if i % 20 == 0:
                    self.check_cancelled(cancellation_check, f"storage batch {batch_idx} item {i}")
                    
                if i < len(embedding_batch):
                    chunk_obj = DocumentChunk(
                        document_id=chunk['document_id'],
                        chunk_text=chunk['chunk_text'],
                        chunk_index=chunk['chunk_index'],
                        chunk_metadata=chunk.get('chunk_metadata', {}),
                        embeddings=embedding_batch[i],
                        embedding=embedding_batch[i]
                    )
                    db.add(chunk_obj)
                    
            # flush 
            db.flush()
            return True
        
        except ProcessingCancelledError:
            raise
        except Exception as e:
            logger.error(f"Embedding batch storage failed: {e}")
            return False
        
    # =========================================================================
    # UTILITY METHODS
    # =========================================================================    
    
    def _create_transaction_text(self, row: pd.Series) -> str:
        """Create comprehensive transaction text for embedding"""
        try:
            transaction_info = []

            # Basic transaction details
            basic_details = []

            # Data handling
            for col in row.index:
                if 'date' == str(col).lower() and pd.notna(row[col]):
                    try:
                        if isinstance(row[col], (pd.Timestamp, datetime)):
                            basic_details.append(f"on {row[col].strftime('%Y-%m-%d')}")
                        elif isinstance(row[col], str):
                            basic_details.append(f"on {row[col][:10]}")

                    except:
                        pass
                    break

            # Amount handling
            for col in row.index:
                if 'amount' in str(col).lower() and pd.notna(row[col]):
                    try:
                        amount = float(row[col])
                        basic_details.append(f"for ${abs(amount):,.2f}")
                        if amount < 0:
                            basic_details.append("(expense)")
                        else:
                            basic_details.append("(income)")

                    except:
                        pass
                    break

            if basic_details:
                transaction_info.append("Transaction " + " ".join(basic_details))

            # 2. Description and merchant
            merchant_info = []
            for col in row.index:
                col_lower = str(col).lower()
                if any(keyword in col_lower for keyword in ['desc', 'merchant', 'vendor', 'store', 'name']):
                    if pd.notna(row[col]):
                        desc = str(row[col]).strip()
                        if desc and desc.lower() != 'nan':
                            merchant_info.append(f"at/in {desc}")
                            break

            # 3. Category/Type information
            category_info = []
            for col in row.index:
                col_lower = str(col).lower()
                if any(keyword in col_lower for keyword in ['category', 'type', 'class', 'group']):
                    if pd.notna(row[col]):
                        category = str(row[col]).strip()
                        if category and category.lower() != 'nan':
                            category_info.append(f"categorized as {category}")
                            break

            # 4. Additional metadata (paymentmethod, location, etc)
            metadata = []
            for col in row.index:
                col_lower = str(col).lower()
                # Skip already used columns
                if any(keyword in col_lower for keyword in ['date', 'amount', 'desc', 'merchant', 'category', 'type']):
                    continue

                if pd.notna(row[col]):
                    value = str(row[col]).strip()
                    if value and value.lower() != 'nan':
                        # Format column name nicely
                        col_name = str(col).replace('_', ' ').title()

                        # Handle special metadata
                        if any(keyword in col_lower for keyword in ['payment', 'method', 'card']):
                            metadata.append(f"paid with {value}")
                        elif any(keyword in col_lower for keyword in ['location', 'city', 'state']):
                            metadata.append(f"location: {value}")
                        elif any(keyword in col_lower for keyword in ['reference', 'id', 'number']):
                            metadata.append(f"reference: {value}")
                        elif len(value) < 30: # Only add short values
                            metadata.append(f"{col_name}: {value}")

                        if len(metadata) >= 2:
                            break

            # Combine all parts
            all_parts = transaction_info + merchant_info + category_info + metadata

            if all_parts:
                # Format as a coherent paragraph
                text = all_parts[0]
                if len(all_parts) > 1:
                    text += ". " + ". ".join(all_parts[1:]) + "."
            
                return text
        
            else:
                # Fallback : structured representation
                non_null_items = []
                for col in row.index:
                    if pd.notna(row[col]):
                        value = str(row[col]).strip()
                        if value and value.lower() != 'nan':
                            non_null_items.append(f"{col}: {value[:50]}")

                if non_null_items:
                    return " | ".join(non_null_items[:5])
                else:
                    return "Empty transaction record"
        except Exception as e:
            logger.warning(f"Error creating transaction text: {e}")
            return "Transaction data unavailable"
        
    def set_progress(self, stage: str, percentage: int, details: str = ""):
        """Progress tracker"""
        percentage = max(0, min(100, percentage))
        
        # call progress callback if provided
        if self.progress_callback:
            try:
                self.progress_callback(stage, percentage, details)
            except Exception as e:
                logger.error(f"Progress callback failed: {e}")
                
        # update progress tracker
        if self.upload_id and self.user_id:
            try:
                progress_tracker.set_progress(
                    self.user_id,
                    self.upload_id,
                    stage,
                    percentage,
                    details
                )
            except Exception as e:
                logger.error(f"Failed to update progress tracker: {e}")
                
        logger.info(f"Progress: {stage} - {percentage}% - {details}")

    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get performance metrics so it can be evaluated"""
        if self.metrics['batch_times']:
            avg_batch_time = sum(self.metrics['batch_times']) / len(self.metrics['batch_times'])
        else:
            avg_batch_time = 0
        
        return {
            'total_processed': self.metrics['total_processed'],
            'total_errors': self.metrics['total_errors'],
            'avg_batch_time_seconds': avg_batch_time,
            'batches_processed': len(self.metrics['batch_times']),
            'rate_limiting_enabled': self.enable_rate_limiting,
            'upload_id': self.upload_id,
            'user_id': self.user_id
        }
        
    def shutdown(self, timeout: int = 30):
        """Graceful shutdown - cancel all pending operations"""
        logger.info("Shutting down batch processor...")
        
        # cancel all active futures
        for future in self.active_futures:
            future.cancel()
            
        # wait for cancellation
        start_time = time.time()
        while self.active_futures and time.time() - start_time < timeout:
            time.sleep(0.1)
            
        logger.info(f"Batch processor shutdown complete, {len(self.active_futures)} futures remaining")
        

        