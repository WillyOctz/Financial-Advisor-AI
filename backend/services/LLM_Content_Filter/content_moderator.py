from typing import Dict, Optional, Tuple
from datetime import datetime
import logging
from backend.services.LLM_Content_Filter.abuse_detector import get_abuse_detector, SeverityLevel
from backend.services.LLM_Content_Filter.topic_classifier import get_topic_classifier, TopicCategory

logger = logging.getLogger(__name__)

class ModerationResult:
    def __init__(
        self,
        is_approved: bool,
        should_block: bool,
        response_message: Optional[str],
        violation_type: Optional[str],
        severity: SeverityLevel,
        topic_category: TopicCategory,
        confidence: float,
        metadata: Dict
    ):
        self.is_approved = is_approved
        self.should_block = should_block
        self.response_message = response_message
        self.violation_type = violation_type
        self.severity = severity
        self.topic_category = topic_category
        self.confidence = confidence
        self.metadata = metadata
        self.timestamp = datetime.now()
        
    def to_dict(self) -> Dict:
        """Convert to dictionary for logging"""
        return {
            'is_approved': self.is_approved,
            'should_block': self.should_block,
            'response_message': self.response_message,
            'violation_type': self.violation_type,
            'severity': self.severity.name if self.severity else None,
            'topic_category': self.topic_category.value if self.topic_category else None,
            'confidence': self.confidence,
            'metadata': self.metadata,
            'timestamp': self.timestamp.isoformat()
        }

class ContentModerator:
    """Content moderation combine abuse and topic classifer"""
    def __init__(self):
        self.abuse_detector = get_abuse_detector()
        self.topic_classifier = get_topic_classifier()
        
        # moderation statistics
        self.stats = {
            'total_queries': 0,
            'blocked_queries': 0,
            'off_topic_queries': 0,
            'abusive_queries': 0,
            'approved_queries': 0
        }
        
    def moderate_query(self, query: str, user_id: int) -> ModerationResult:
        """Moderate user query before processing"""
        self.stats['total_queries'] += 1
        
        logger.info(f"Moderating query from user {user_id}: {query[:50]}...")
        
        # step 1 : check for abuse/profanity
        abuse_analysis = self.abuse_detector.analyze_content(query)
        
        # step 2 : check if meaningless gibberish
        is_meaningless = self.abuse_detector.is_meaningless(query)
        
        # step 3 : classify topic
        topic_analysis = self.topic_classifier.classify_query(query)
        
        # decision matrix
        
        # if abused detected, block immediately
        if abuse_analysis['is_abusive'] or abuse_analysis['requires_blocking']:
            self.stats['blocked_queries'] += 1
            self.stats['abusive_queries'] += 1
            
            polite_message = self.abuse_detector.get_polite_refusal_message(
                abuse_analysis['severity'],
                abuse_analysis['categories']
            )
            
            logger.warning(
                f"BLOCKED - Abuse detected from user {user_id}: "
                f"Severity={abuse_analysis['severity'].name}, "
                f"Categories={abuse_analysis['categories']}"
            )
            
            return ModerationResult(
                is_approved=False,
                should_block=True,
                response_message=polite_message,
                violation_type='abuse',
                severity=abuse_analysis['severity'],
                topic_category=TopicCategory.OFF_TOPIC,
                confidence=abuse_analysis['confidence'],
                metadata={
                    'abuse_categories': abuse_analysis['categories'],
                    'violation_count': abuse_analysis['violation_count'],
                    'user_id': user_id,
                    'query_length': len(query)
                }
            )
    
        # meaningless message gibberish
        if is_meaningless:
            self.stats['blocked_queries'] += 1
            
            logger.info(f"BLOCKED - Meaningless input from user {user_id}")
            
            return ModerationResult(
                is_approved=False,
                should_block=False,
                response_message=(
                    "I didn't quite understand that. I'm your financial advisor AI. "
                    "Try asking me about budgets, expenses, savings, or investments. "
                    "For example: 'How can I save more money?' or 'Show me my spending breakdown.'"
                ),
                violation_type='meaningless',
                severity=SeverityLevel.LOW,
                topic_category=TopicCategory.UNCLEAR,
                confidence=0.9,
                metadata={
                    'reason': 'gibberish',
                    'user_id': user_id
                }
            )
            
        # off topic: that's not financial - redirect politely
        if not topic_analysis['is_financial'] and topic_analysis['category'] == TopicCategory.OFF_TOPIC:
            self.stats['off_topic_queries'] += 1
            
            logger.info(
                f"OFF-TOPIC query from user {user_id}: "
                f"Category={topic_analysis['category'].value}"
            )
            
            return ModerationResult(
                is_approved=False,
                should_block=False,
                response_message=topic_analysis['redirect_message'],
                violation_type='off_topic',
                severity=SeverityLevel.NONE,
                topic_category=topic_analysis['category'],
                confidence=topic_analysis['confidence'],
                metadata={
                    'matched_keywords': topic_analysis.get('matched_keywords', []),
                    'user_id': user_id
                }
            )
            
        # greetings message
        if topic_analysis['category'] == TopicCategory.GREETING:
            logger.info(f"GREETING from user {user_id}")
            
            # allow greeting but suggest financial topics
            return ModerationResult(
                is_approved=True,
                should_block=False,
                response_message=(
                    "Hello! I'm your financial advisor AI. "
                    "I can help you with budgeting, tracking expenses, analyzing your spending patterns, "
                    "setting savings goals, and providing personalized financial advice. "
                    "What would you like to know about your finances?"
                ),
                violation_type=None,
                severity=SeverityLevel.NONE,
                topic_category=topic_analysis['category'],
                confidence=topic_analysis['confidence'],
                metadata={'is_greeting': True, 'user_id': user_id}
            )
            
        # unclear or ambiguous message
        if topic_analysis['category'] == TopicCategory.UNCLEAR:
            logger.info(f"UNCLEAR query from user {user_id}")
            
            return ModerationResult(
                is_approved=False,
                should_block=False,
                response_message=topic_analysis['redirect_message'],
                violation_type='unclear',
                severity=SeverityLevel.NONE,
                topic_category=topic_analysis['category'],
                confidence=topic_analysis['confidence'],
                metadata={'user_id': user_id}
            )
            
        # approved
        self.stats['approved_queries'] += 1
        
        logger.info(
            f"APPROVED query from user {user_id}: "
            f"Category={topic_analysis['category'].value}, "
            f"Confidence={topic_analysis['confidence']:.2f}"
        )
        
        return ModerationResult(
            is_approved=True,
            should_block=False,
            response_message=None,
            violation_type=None,
            severity=SeverityLevel.NONE,
            topic_category=topic_analysis['category'],
            confidence=topic_analysis['confidence'],
            metadata={
                'matched_keywords': topic_analysis.get('matched_keywords', []),
                'user_id': user_id,
                'financial_confidence': topic_analysis['confidence']
            }
        )
        
    def get_statistics(self) -> Dict:
        """Get moderation statistics"""
        total = self.stats['total_queries']
        if total == 0:
            return self.stats
        
        return {
            **self.stats,
            'block_rate': (self.stats['blocked_queries'] / total) * 100,
            'approval_rate': (self.stats['approved_queries'] / total) * 100,
            'abuse_rate': (self.stats['abusive_queries'] / total) * 100,
            'off_topic_rate': (self.stats['off_topic_queries'] / total) * 100
        }
        
    def reset_statistics(self):
        """Reset statistics"""
        self.stats = {
            'total_queries': 0,
            'blocked_queries': 0,
            'off_topic_queries': 0,
            'abusive_queries': 0,
            'approved_queries': 0
        }
        
_content_moderator = None

def get_content_moderator() -> ContentModerator:
    global _content_moderator
    if _content_moderator is None:
        _content_moderator = ContentModerator()
    return _content_moderator