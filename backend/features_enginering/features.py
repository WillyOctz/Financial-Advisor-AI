from sqlalchemy.orm import Session
from backend.db.session import get_db
from backend.models.database import CategoryMapping
from typing import Optional


def categorize_transaction(description: str, db_session: Optional[Session] = None) -> str:
    """
    Categorize transaction based on description using database mappings
    """
    description_lower = description.lower()
    
    # Use provided session or create new one
    close_session = False
    if db_session is None:
        db = next(get_db())
        close_session = True
    else:
        db = db_session
    
    try:
        # Get all category mappings from database
        mappings = db.query(CategoryMapping).all()
        
        # Check for keyword matches
        for mapping in mappings:
            if mapping.keyword.lower() in description_lower:
                return mapping.category
        
        # Default categories based on common patterns
        if any(word in description_lower for word in ['salary', 'payroll', 'wage', 'bonus', 'income']):
            return "Income"
        elif any(word in description_lower for word in ['grocery', 'supermarket', 'food', 'market']):
            return "Food"
        elif any(word in description_lower for word in ['restaurant', 'cafe', 'coffee', 'dining', 'eat']):
            return "Dining"
        elif any(word in description_lower for word in ['rent', 'mortgage', 'housing', 'apartment']):
            return "Housing"
        elif any(word in description_lower for word in ['electric', 'water', 'gas', 'utility', 'bill']):
            return "Utilities"
        elif any(word in description_lower for word in ['gas', 'fuel', 'transport', 'uber', 'lyft', 'taxi', 'bus']):
            return "Transportation"
        elif any(word in description_lower for word in ['movie', 'netflix', 'spotify', 'entertainment', 'game']):
            return "Entertainment"
        elif any(word in description_lower for word in ['medical', 'doctor', 'hospital', 'pharmacy', 'health']):
            return "Healthcare"
        elif any(word in description_lower for word in ['shopping', 'mall', 'store', 'amazon', 'walmart']):
            return "Shopping"
        elif any(word in description_lower for word in ['transfer', 'bank', 'atm']):
            return "Transfer"
        else:
            return "Other"
            
    except Exception as e:
        print(f"❌ Error categorizing transaction '{description}': {e}")
        return "Uncategorized"
    finally:
        # Only close if we created the session locally
        if close_session:
            db.close()
    