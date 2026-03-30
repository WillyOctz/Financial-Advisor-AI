from typing import List, Dict, Any
from datetime import datetime, timedelta
import asyncio
import threading
from sqlalchemy.orm import Session
from backend.db.redis_client import cache, cache_metrics, CircuitBreaker, cache_forecast
from backend.services.display_service import DisplayService
from backend.services.forecasting_services import ForecastingService
import logging
from backend.models.database import Transaction
from sqlalchemy import desc, func
import time
from backend.config.cache_config import CACHE_CONFIG, get_ttl

logger = logging.getLogger(__name__)

class CacheWarmer:
    def __init__(self, db: Session):
        self.db = db
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=CACHE_CONFIG['CIRCUIT_BREAKER']['FAILURE_THRESHOLD'],
            recovery_timeout=CACHE_CONFIG['CIRCUIT_BREAKER']['RECOVERY_TIMEOUT']
        )

    def warm_on_login(self, user_id: int):
        """Warm cache immediately when user logs in"""
        # Run in background thread
        thread = threading.Thread(
            target=self._warm_critical_data,
            args=(user_id,),
            daemon=True,
            name=f"CachWarm-{user_id}"
        )
        thread.start()
        logger.info(f"🔥 Started cache warming for user {user_id}")

    def _warm_critical_data(self, user_id: int, priority: str = "high"):
        """Warm critical data in background with priority-based warning"""
        try:
            start_time = time.time()
            logger.info(f"🔥 Warming {priority} priority data for user {user_id}")

            # Define warming tasks based on priority
            warming_tasks = {
                'high': [
                    ('financial_summary_today', self._warm_financial_summary, [user_id, 'today']),
                    ('recent_transactions', self._warm_recent_transactions, [user_id]),
                ],
                'medium': [
                    ('financial_summary_month', self._warm_financial_summary, [user_id, 'latest_month']),
                    ('category_breakdown', self._warm_category_breakdown, [user_id]),
                ], 
                'low': [
                    ('forecast_data', self._warm_forecast_data, [user_id]),
                    ('ai_advice', self._warm_ai_advice, [user_id]),
                ]
            }

            # Execute tasks for the given priority higher
            executed_tasks = 0
            for prio_level in ['high', 'medium', 'low']:
                if self._get_priority_value(prio_level) <= self._get_priority_value(priority):
                    for task_name, task_func, task_args in warming_tasks[prio_level]:
                        try:
                            task_func(*task_args)
                            executed_tasks += 1

                            # Small delay between tasks to avoid overwhelming
                            if executed_tasks % 2 == 0:
                                time.sleep(0.05)

                        except Exception as e:
                            logger.warning(f"⚠️ Failed to warm {task_name} for user {user_id}: {e}")

            elapsed_time = time.time() - start_time
            logger.info(f"✅ Completed cache warming for user {user_id} ({executed_tasks} tasks in {elapsed_time:.2f}s)")

            # Record metrics
            cache_metrics.record_operation('warm')

        except Exception as e:
            logger.error(f"❌ Cache warming failed for user {user_id}: {e}")
            cache_metrics.record_error('warm')

    def _get_priority_value(self, priority: str) -> int:
        """Convert priority string to numeric value"""
        priority_map = {'high': 0, 'medium': 1, 'low': 2}
        return priority_map.get(priority, 2)
    
    def _warm_financial_summary(self, user_id: int, timeframe: str):
        """Warm financial summary"""
        try:
            def warm_operation():
                display_service = DisplayService(self.db)
                summary = display_service.get_financial_summary(user_id, timeframe)

                # Cache with appropriate TTL
                ttl = get_ttl('financial_summary')
                cache.set('financial_summary', f"{user_id}:{timeframe}", summary, ttl)

                logger.debug(f"✅ Warmed {timeframe} summary for user {user_id}")
                return True

            self.circuit_breaker.execute(warm_operation)
        except Exception as e:
            logger.warning(f"⚠️ Failed to warm {timeframe} summary: {e}")

    def _warm_recent_transactions(self, user_id: int, limit: int = 50):
        """Warm recent transactions cache"""
        try:
            def warm_operation():
                transactions = self.db.query(Transaction).filter(
                    Transaction.user_id == user_id
                ).order_by(desc(Transaction.date)).limit(limit).all()

                if transactions:
                    # Convert to list of dicts
                    transaction_list = []
                    for t in transactions:
                        transaction_list.append({
                            'id': t.id,
                            'date': t.date.isoformat() if t.date else None,
                            'description': t.description,
                            'amount': t.amount,
                            'type': t.type.value if t.type else None,
                            'category': t.category,
                            'document_id': t.document_id
                        })
                    
                    cache_key = f"recent:{user_id}"

                    cache_data = {
                        'transactions': transaction_list,
                        'count': len(transaction_list),
                        'last_updated': datetime.now().isoformat()
                    }

                    ttl = get_ttl('transaction_data')
                    cache.set('transaction_data', cache_key, cache_data, ttl)

                    logger.debug(f"✅ Warmed {len(transaction_list)} recent transactions for user {user_id}")

                    return True
                return False
            self.circuit_breaker.execute(warm_operation)

        except Exception as e:
            logger.warning(f"⚠️ Failed to warm transactions for {user_id}: {e}")

    def _warm_category_breakdown(self, user_id: int):
        """Warm expense category breakdown"""
        try:
            category_totals = self.db.query(
                Transaction.category,
                func.sum(Transaction.amount).label('total')
            ).filter(
                Transaction.user_id == user_id,
                Transaction.type == 'EXPENSE'
            ).group_by(Transaction.category).all()

            if category_totals:
                breakdown = {cat: float(total) for cat, total in category_totals if cat}

                cache.set(
                    'category_breakdown',
                    f"user:{user_id}",
                    breakdown,
                    get_ttl('financial_summary')
                )

                logger.debug(f"✅ Warmed category breakdown for user {user_id}")

        except Exception as e:
            logger.warning(f"⚠️ Failed to warm category breakdown: {e}")

    def _warm_forecast_data(self, user_id: int):
        """Warm forecast data (lower priority)"""
        try:
            forecasting_service = ForecastingService(self.db)

            # Warm next 3 months forecast
            forecast = forecasting_service.forecast_expenses(user_id, periods=3)

            # Cache key already includes user_id
            cache_key = f"forecast_enhanced_{user_id}_3"
            cache_forecast(cache_key, forecast.dict())

            logger.debug(f"✅ Warmed forecast for user {user_id}")

        except Exception as e:
            logger.debug(f"ℹ️ Forecast warming skipped for user {user_id}: {e}")

    def _warm_ai_advice(self, user_id: int):
        """Warm AI advice (lowest priority)"""
        try:
            display_service = DisplayService(self.db)

            # Generate and cache default
            advice = display_service.generate_ai_advice(user_id)

            cache.set(
                'ai_advice',
                f"{user_id}:default",
                advice.dict(),
                get_ttl('ai_advice')
            )

            logger.debug(f"✅ Warmed AI advice for user {user_id}")

        except Exception as e:
            logger.debug(f"ℹ️ AI advice warming skipped for user {user_id}: {e}")

    def _warm_all_users(self, user_ids: List[int]):
        """Warm cache for all active users with rate limiting"""
        logger.info(f"🌅 Starting daily cache warming for {len(user_ids)} users")

        warmed_count = 0
        failed_count = 0

        for index, user_id in enumerate(user_ids):
            try:
                # Stagger warming to avoid thundering herd
                if index > 0 and index % 10 == 0:
                    time.sleep(1)

                # Warm with medium priority for background job
                self._warm_critical_data(user_id, priority='medium')
                warmed_count += 1

                # Progress loading
                if (index + 1) % 50 == 0:
                    logger.info(f"🌅 Warmed {index + 1}/{len(user_ids)} users")

            except Exception as e:
                failed_count += 1
                logger.error(f"❌ Failed to warm cache for user {user_id}: {e}")

                # Don't fail completely on single user error
                if failed_count > 10:
                    logger.warning("⚠️ Too many failures, aborting daily warming job")
                    break

        logger.info(f"🌅 Completed daily cache warming: {warmed_count} warmed, {failed_count} failed")

        # Record the metrics
        cache_metrics.record_operation('batch_warm')

    def get_warm_status(self, user_id: int) -> Dict[str, Any]:
        """Check what data is warmed for a user"""
        warmed_data = {}

        # Check with circuit breaker
        def check_cache(category, key):
            return cache.exists(category, key)
        
        # Check financial summaries
        for timeframe in ['today', 'latest_month']:
            key = f"{user_id}:{timeframe}"
            if self.circuit_breaker.execute(
                lambda: check_cache('financial_summary', key),
                lambda: False
            ):
                warmed_data[f"summary_{timeframe}"] = True

        # Check for transactions
        if self.circuit_breaker.execute(
            lambda: check_cache('transaction_data', f"recent:{user_id}"),
            lambda: False
        ):
            warmed_data['transactions'] = True

        # Check forecast
        forecast_key = f"forecast_enhanced_{user_id}_6"
        if self.circuit_breaker.execute(
            lambda: check_cache('forecast', forecast_key),
            lambda: False
        ):
            warmed_data['forecast'] = True

        return {
            'user_id': user_id,
            'warmed_data': warmed_data,
            'total_warmed': len(warmed_data),
            'checked_at': datetime.now().isoformat(),
            'cache_health': cache.health_check()
        }
    
    def clear_user_cache(self, user_id: int) -> int:
        """Clear all cache for a user with circuit breaker"""
        def clear_operation():
            deleted = cache.invalidate_user_cache(user_id)
            logger.info(f"🗑️ Cleared {deleted} cache entries for user {user_id}")
            return deleted
        
        try:
            return self.circuit_breaker.execute(clear_operation, lambda: 0)
        except Exception as e:
            logger.error(f"❌ Failed to clear cache for user {user_id}: {e}")
            return 0
        
    def get_warming_metrics(self) -> Dict[str, Any]:
        """Get warming performance metrics"""
        metrics = cache_metrics.get_metrics()

        # Add warming-specific metrics
        warming_metrics = {
            'cache_hit_rate': metrics['hit_rate'],
            'total_operations': metrics['total_operations'],
            'errors': metrics['errors'],
            'cache_health': cache.health_check(),
            'redis_stats': cache.get_stats()
        }

        return warming_metrics
        
            