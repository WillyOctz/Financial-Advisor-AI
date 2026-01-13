import time
import threading
from datetime import datetime
from sqlalchemy.orm import Session
from backend.db.session import SessionLocal
from backend.services.cache_warmer import CacheWarmer
import logging
from backend.models.database import User
from datetime import timedelta

logger = logging.getLogger(__name__)

def start_schedulers():
    """Start all background schedulers"""

    def daily_cache_warming():
        """Run daily at 3 AM"""
        while True:
            now = datetime.now()

            # Check if its 3 AM
            if now.hour == 3 and now.minute < 5:
                try:
                    db = SessionLocal()

                    try:
                        # Get active users (last 7 days)
                        week_ago = datetime.now() - timedelta(days=7)
                        active_users = db.query(User.id).filter(
                            User.last_login >= week_ago
                        ).all()

                        if active_users:
                            cache_warmer = CacheWarmer(db)
                            user_ids = [user.id for user in active_users]
                            cache_warmer._warm_all_users(user_ids)
                        
                        logger.info("✅ Daily cache warming completed")
                    finally:
                        db.close()
                except Exception as e:
                    logger.error(f"❌ Daily cache warming failed: {e}")

            # Sleep for 5 minutes
            time.sleep(300)

    # Start the scheduler in a background thread
    scheduler_thread = threading.Thread(target=daily_cache_warming, daemon=True)
    scheduler_thread.start()
    logger.info("🎯 Background schedulers started")

    return scheduler_thread