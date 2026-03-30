import time
import asyncio
import threading
from typing import Dict, List, Optional, Callable, Any
from dataclasses import dataclass
from enum import Enum
import statistics
import logging
from datetime import datetime, timedelta
from collections import deque
import numpy as np

logger = logging.getLogger(__name__)

class RateLimitStrategy(Enum):
    """Rate limiting strategies"""
    TOKEN_BUCKET = "token_bucket"
    LEAKY_BUCKET = "-leaky_bucket"
    FIXED_WINDOW = 'fixed_window'
    SLIDING_WINDOW = "sliding_window"
    ADAPTIVE = "adaptive"
    
class CircuitState(Enum):
    """Circuit breaker states"""
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"
    
@dataclass
class RateLimitConfig:
    """Configuration for rate limiting"""
    strategy: RateLimitStrategy = RateLimitStrategy.ADAPTIVE
    max_requests_per_minute: int = 1000
    burst_capacity: int = 100
    initial_tokens: int = 100
    refill_rate_per_second: float = 10.0
    window_size_seconds: int = 60
    min_backoff_seconds: float = 0.1
    max_backoff_seconds: float = 60.0
    backoff_factor: float = 1.5
    success_threshold_percentage: float = 95.0
    circuit_breaker_threshold: int = 10
    circuit_reset_timeout: int = 30
    adaptive_sampling_window: int = 100
    target_latency_ms: int = 100
    
class PerformanceMetrics:
    """Track performance metrics for adaptive rate limiting"""
    
    def __init__(self, window_size: int = 100):
        self.window_size = window_size
        self.latencies = deque(maxlen=window_size)
        self.successes = deque(maxlen=window_size)
        self.errors = deque(maxlen=window_size)
        self.start_times: Dict[str, float] = {}
        self.total_requests = 0
        self.total_success = 0
        self.total_errors = 0
        
    def start_request(self, request_id: str):
        self.start_times[request_id] = time.time()
        
    def end_request(self, request_id: str, success: bool, error: Optional[Exception] = None):
        if request_id not in self.start_times:
            return
        
        latency = time.time() - self.start_times[request_id]
        self.latencies.append(latency * 1000)
        self.successes.append(1 if success else 0)
        self.errors.append(1 if not success else 0)
        
        self.total_requests += 1
        if success:
            self.total_success += 1
        else:
            self.total_errors += 1
            
        del self.start_times[request_id]
        
    def get_latency_percentiles(self, percentiles: List[float] = [50, 90, 95, 99]):
        if not self.latencies:
            return {p: 0.0 for p in percentiles}
        
        latencies_list = list(self.latencies)
        results = {}
        for p in percentiles:
            results[p] = np.percentile(latencies_list, p)
        return results
    
    def get_success_rate(self) -> float:
        if not self.successes:
            return 100.0
        return (sum(self.successes) / len(self.successes)) * 100
    
    def get_error_rate(self) -> float:
        if not self.errors:
            return 0.0
        return (sum(self.errors) / len(self.errors)) * 100
    
    def get_throughput(self, window_seconds: int = 10) -> float:
        """Get requests per second"""
        if not self.latencies:
            return 0.0
        return len(self.latencies) / window_seconds
    
class SmartRateLimiter:
    """Smart rate limiter with multiple strategies and circuit breaking methods"""
    
    def __init__(self, config: Optional[RateLimitConfig] = None):
        self.config = config or RateLimitConfig()
        self.metrics = PerformanceMetrics(self.config.adaptive_sampling_window)
        
        # token bucket implementation
        self.tokens = self.config.initial_tokens
        self.last_refill = time.time()
        self.lock = threading.RLock()
        
        # sliding window implementation
        self.request_timestamps = deque()
        
        # circuit breaker
        self.circuit_state = CircuitState.CLOSED
        self.circuit_failures = 0
        self.circuit_last_failures = 0
        self.circuit_last_test = 0
        
        # adaptive rate control
        self.current_rate = self.config.max_requests_per_minute
        self.rate_adjustment_factor = 1.0
        self.last_rate_adjustment = time.time()
        
    def acquire(self, tokens: int = 1, timeout: Optional[float] = None) -> bool:
        """control acquire persmission to proceed with operation returns true if allowed, false if rate is limited"""
        start_time = time.time()
        
        with self.lock:
            if not self.check_circuit():
                return False
            
            # apply selected rate limiting strategy
            allowed = self.apply_strategy(tokens)
            
            if not allowed and timeout:
                # implement exponential backoff
                backoff_time = self.calculate_backoff()
                if backoff_time <= timeout:
                    time.sleep(backoff_time)
                    return self.acquire(tokens, timeout - backoff_time)
                
            return allowed
        
    async def acquire_async(self, tokens: int = 1, timeout: Optional[float] = None) -> bool:
        """Async version of acquire"""
        return await asyncio.to_thread(self.acquire, tokens, timeout)
    
    def apply_strategy(self, tokens: int) -> bool:
        """Apply the configured rate limiting strategy"""
        if self.config.strategy == RateLimitStrategy.TOKEN_BUCKET:
            return self.token_bucket_strategy(tokens)
        elif self.config.strategy == RateLimitStrategy.SLIDING_WINDOW:
            return self.sliding_window_strategy()
        elif self.config.strategy == RateLimitStrategy.ADAPTIVE:
            return self.adaptive_strategy(tokens)
        else:
            return self.fixed_window_strategy()
        
    def token_bucket_strategy(self, tokens: int) -> bool:
        """Token bucket algorithm"""
        self.refill_tokens()
        
        if self.tokens >= tokens:
            self.tokens -= tokens
            return True
        return False
    
    def sliding_window_strategy(self) -> bool:
        """Sliding window algorithm"""
        now = time.time()
        window_start = now - self.config.window_size_seconds
        
        # remove old timestamps
        while self.request_timestamps and self.request_timestamps[0] < window_start:
            self.request_timestamps.popleft()
            
        max_requests = (self.config.max_requests_per_minute * self.config.window_size_seconds) / 60
        
        if len(self.request_timestamps) < max_requests:
            self.request_timestamps.append(now)
            return True
        return False
    
    def adaptive_strategy(self, tokens: int) -> bool:
        """Adaptive rate limiting based on performance metrics"""
        success_rate = self.metrics.get_success_rate()
        error_rate = self.metrics.get_error_rate()
        latency_percentiles = self.metrics.get_latency_percentiles()
        
        # adjust rate based on performance
        self.adjust_rate(success_rate, error_rate, latency_percentiles)
        
        # use token bucket with adaptive tokens
        adaptive_tokens = int(tokens * self.rate_adjustment_factor)
        return self.token_bucket_strategy(adaptive_tokens)
    
    def fixed_window_strategy(self) -> bool:
        """Fixed window algorithm"""
        
        now = int(time.time() / self.config.window_size_seconds)
        
        if not hasattr(self, 'window_counters'):
            self.window_counters = {}
            
        if now not in self.window_counters:
            # clean old windows
            old_windows = [w for w in self.window_counters.keys() if w < now - 1]
            for w in old_windows:
                del self.window_counters[w]
            self.window_counters[now] = 0
            
        max_requests = (self.config.max_requests_per_minute * self.config.window_size_seconds) / 60
        
        if self.window_counters[now] < max_requests:
            self.window_counters[now] += 1
            return True
        return False
    
    def refill_tokens(self):
        """Refill tokens based on time elapsed"""
        now = time.time()
        time_passed = now - self.last_refill
        
        if time_passed > 0:
            new_tokens = time_passed * self.config.refill_rate_per_second
            self.tokens = min(self.config.burst_capacity, self.tokens + new_tokens)
            self.last_refill = now
            
    def adjust_rate(self, success_rate: float, error_rate: float, latencies: Dict[float, float]):
        """Adjust rate based on performance metrics"""
        now = time.time()
        
        # only adjust every 5 seconds
        if now - self.last_rate_adjustment < 5:
            return
        
        p95_latency = latencies.get(95, 0)
        
        # calculate adjustment factor
        adjustment = 1.0
        
        if error_rate > 5.0: # high error rate
            adjustment *= 0.8 # reduce rate 20%
        elif p95_latency > self.config.target_latency_ms * 2:
            adjustment *= 0.9 # reduce rate 10%
        elif success_rate > 98.0 and p95_latency < self.config.target_latency_ms:
            adjustment *= 1.1 # increase rate 10%
            
        # apply smooth adjustment
        self.rate_adjustment_factor = max(0.5, min(2.0, self.rate_adjustment_factor * adjustment))
        
        self.last_rate_adjustment = now
        
        logger.debug(f"Rate adjustment: factor={self.rate_adjustment_factor:.2f}, "
                    f"success={success_rate:.1f}%, error={error_rate:.1f}%, "
                    f"p95_latency={p95_latency:.1f}ms")
        
    def calculate_backoff(self) -> float:
        """Calculate exponential backoff time"""
        backoff = self.config.min_backoff_seconds
        backoff = min(backoff * self.config.backoff_factor ** self.circuit_failures, self.config.max_backoff_seconds)
        
        return backoff
    
    def check_circuit(self) -> bool:
        """Check circuit breaker state"""
        
        now = time.time()
        
        if self.circuit_state == CircuitState.OPEN:
            # check if reset timeout has passed
            if now - self.circuit_last_failures > self.config.circuit_reset_timeout:
                self.circuit_state = CircuitState.HALF_OPEN
                self.circuit_last_test = now
                return True
            return False
        
        elif self.circuit_state == CircuitState.HALF_OPEN:
            # allow one test request
            if now - self.circuit_last_test > 1.0:
                self.circuit_last_test = now
                return True
            return False
        
        return True # closed state
    
    def record_success(self):
        """Record success test"""
        with self.lock:
            if self.circuit_state == CircuitState.HALF_OPEN:
                self.circuit_state = CircuitState.CLOSED
                self.circuit_failures = 0
                logger.info("Circuit breaker reset to CLOSED")
                
    def record_failure(self):
        """Record failed test"""
        with self.lock:
            self.circuit_failures += 1
            self.circuit_last_failures = time.time()
            
            if self.circuit_failures >= self.config.circuit_breaker_threshold:
                self.circuit_state = CircuitState.OPEN
                logger.warning(f"Circuit breaker OPENED after {self.circuit_failures} failures")
                
    def get_status(self) -> Dict[str, Any]:
        """Get current rate state limiter"""
        with self.lock:
            return {
                'strategy': self.config.strategy.value,
                'tokens_available': self.tokens,
                'circuit_state': self.circuit_state.value,
                'circuit_failures': self.circuit_failures,
                'rate_adjustment_factor': self.rate_adjustment_factor,
                'current_rate_per_minute': self.current_rate * self.rate_adjustment_factor,
                'metrics': {
                    'success_rate': self.metrics.get_success_rate(),
                    'error_rate': self.metrics.get_error_rate(),
                    'throughput_rps': self.metrics.get_throughput(),
                    'latency_percentiles': self.metrics.get_latency_percentiles(),
                    'total_requests': self.metrics.total_requests,
                    'total_success': self.metrics.total_success,
                    'total_errors': self.metrics.total_errors
                }
            }
            

class BatchRateLimiter:
    """specialized rate limiter batch operations for dynamic settings"""
    
    def __init__(self, base_limiter: SmartRateLimiter):
        self.base_limiter = base_limiter
        self.batch_size = 100 # initial batch size
        self.min_batch_size = 10
        self.max_batch_size = 1000
        self.batch_adjustment_window = 10
        self.batch_performance = deque(maxlen=self.batch_adjustment_window)
        self.target_batch_time_ms = 1000
        
    def get_optimal_batch_size(self) -> int:
        """Calculate optimal batch size based on performance"""
        if len(self.batch_performance) < 5:
            return self.batch_size
        
        # calculate average batch processing time
        avg_time = statistics.mean([t for t, _ in self.batch_performance])
        avg_success = statistics.mean([t for t, _ in self.batch_performance])
        
        # adjust the batch size
        if avg_time < self.target_batch_time_ms * 0.8 and avg_success > 95.0:
            # if processing too fast, increase batch size
            new_size = min(self.max_batch_size, int(self.batch_size * 1.2))
        elif avg_time > self.target_batch_time_ms * 1.2 or avg_success < 90.0:
            # if processing slow, decrease batch size
            new_size = max(self.min_batch_size, int(self.batch_size * 0.8))
        else:
            new_size = self.batch_size
            
        if new_size != self.batch_size:
            logger.info(f"Adjusting batch size: {self.batch_size} -> {new_size} " f"(avg_time={avg_time:.0f}ms, success={avg_success:.1f}%)")
            self.batch_size = new_size
            
        return self.batch_size
    
    def record_batch_performance(self, processing_time_ms: float, success_rate: float):
        """Record batch processing performance"""
        self.batch_performance.append((processing_time_ms, success_rate))
        
    async def process_batch_with_limits(self, items: List[Any], process_func: Callable[[List[Any]], Any], max_concurrent: int = 4) -> List[Any]:
        """Process items in optimally sized batches with rate limiting"""
        
        results = []
        total_items = len(items)
        processed = 0
        
        while processed < total_items:
            # get optimal batch size
            batch_size = self.get_optimal_batch_size()
            batch = items[processed:processed + batch_size]
            
            # acquire rate limit tokens for batch
            tokens_needed = len(batch)
            if not self.base_limiter.acquire(tokens_needed, timeout=5.0):
                logger.warning("Rate limiting exceeded for batch, waiting...")
                await asyncio.sleep(1)
                continue
            
            try:
                # process batch
                start_time = time.time()
                batch_results = await process_func(batch)
                processing_time = (time.time() - start_time) * 1000
                
                # calculate success rate
                success_count = sum(1 for r in batch_results if r.get('success', False))
                success_rate = (success_count / len(batch)) * 100 if batch else 100.0
                
                # record performance
                self.record_batch_performance(processing_time, success_rate)
                
                # update circuit breaker
                if success_rate > 90.0:
                    self.base_limiter.record_success()
                else:
                    self.base_limiter.record_failure()
                    
                results.extend(batch_results)
                processed += len(batch)
                
                logger.debug(f"Processed batch: {len(batch)} items, " f"time={processing_time:.0f}ms, "f"success={success_rate:.1f}%")
                
            except Exception as e:
                logger.error(f"Batch processing failed: {e}")
                self.base_limiter.record_failure()
                # retry with smaller batch if it can't
                self.batch_size = max(self.min_batch_size, self.batch_size // 2)
                await asyncio.sleep(self.base_limiter._calculate_backoff())
                
        return results
    
# global rate limiter instance
global_rate_limiter = SmartRateLimiter()
batch_rate_limiter = BatchRateLimiter(global_rate_limiter)
            
            
        