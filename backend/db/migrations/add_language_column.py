"""
add language column to users

Run this once against your existing database:
    python -m backend.db.migrations.add_language_column
"""

from sqlalchemy import text
from backend.db.session import db_manager
import logging

logger = logging.getLogger(__name__)

def upgrade():
    """Add language preference column to users table"""
    with db_manager.get_session() as db:
        # check if column already exists first 
        result = db.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'users'
                AND column_name = 'language' 
        """)).fetchone()
        
        if result:
            logger.info(f"Column 'language' already exists on users table — skipping.")
            return 
        
        db.execute(text("""
            ALTER TABLE users
            ADD COLUMN language VARCHAR(10) NOT NULL DEFAULT 'en'                
        """))
        
        logger.info("Added 'language' column to users table.")
        
def downgrade():
    """Remove language column"""
    with db_manager.get_session() as db:
        db.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS language"))
        logger.info("Removed 'language' column from users table.")
        
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    upgrade()