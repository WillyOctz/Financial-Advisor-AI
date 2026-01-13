from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.core.config import settings
import logging

# configure the logging
logging.basicConfig()
logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)

# Create engine with Postgresql connection pool settings
engine = create_engine(
    settings.DB_URL,
    pool_size=20,
    max_overflow=30,
    pool_pre_ping=True, # Enable connection health checks
    pool_recycle=3600, # Recycle connection after an hour
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Initialize database with required data"""
    from backend.models.database import Base, CategoryMapping

    # Create all tables
    Base.metadata.create_all(bind=engine)

    # Add default category mappings
    db = SessionLocal()
    try:
        default_mappings = [
            {"keyword": "salary", "category": "Income"},
            {"keyword": "wage", "category": "Income"},
            {"keyword": "bonus", "category": "Income"},
            {"keyword": "grocery", "category": "Food"},
            {"keyword": "supermarket", "category": "Food"},
            {"keyword": "restaurant", "category": "Dining"},
            {"keyword": "cafe", "category": "Dining"},
            {"keyword": "rent", "category": "Housing"},
            {"keyword": "mortgage", "category": "Housing"},
            {"keyword": "electricity", "category": "Utilities"},
            {"keyword": "water", "category": "Utilities"},
            {"keyword": "gas", "category": "Utilities"},
            {"keyword": "gasoline", "category": "Transportation"},
            {"keyword": "fuel", "category": "Transportation"},
            {"keyword": "uber", "category": "Transportation"},
            {"keyword": "lyft", "category": "Transportation"},
            {"keyword": "movie", "category": "Entertainment"},
            {"keyword": "netflix", "category": "Entertainment"},
            {"keyword": "spotify", "category": "Entertainment"},
        ]

        for mapping in default_mappings:
            existing = db.query(CategoryMapping).filter_by(keyword=mapping["keyword"]).first()
            if not existing:
                db.add(CategoryMapping(**mapping))

        db.commit()
        print("Database initialized with default category mappings")

    except Exception as e:
        db.rollback()
        print(f"❌ Error initializing database: {e}")
    finally:
        db.close()