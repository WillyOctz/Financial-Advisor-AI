import re
from typing import Dict, List, Tuple
from enum import Enum

# this will be in english first, later for indonesia

class SeverityLevel(Enum):
    NONE = 0
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 4
    
class AbuseDetector:
    def __init__(self):
        
        # profanity
        self.profanity_patterns = [
            r'\b(f+u+c+k|f+[\*@#$!]c+k|fck|fuk)\w*\b',
            r'\b(s+h+i+t|sh[\*@#$!]t|sht)\w*\b',
            r'\b(b+i+t+c+h|b[\*@#$!]tch|btch)\w*\b',
            r'\b(a+s+s+h+o+l+e|a[\*@#$!]shole)\w*\b',
            r'\b(d+a+m+n|da[\*@#$!]n)\w*\b',
            r'\b(h+e+l+l)\b',
            r'\b(c+r+a+p|cr[\*@#$!]p)\w*\b',
            r'\b(p+i+s+s)\w*\b',
            r'\b(bastard|moron|idiot|stupid|dumb)\b',
            r'\b(fk|wtf|stfu|gtfo|kys)\b',
            r'\b(jerk|dick|prick|douche)\w*\b',
            r'\b(n+i+g+g+a?|n[\*@#$!]gg)\w*\b',
            r'\b(f+a+g+g+o+t|f[\*@#$!]ggot)\w*\b',
            r'\b(wh+o+r+e|sl+u+t)\w*\b',
        ]
        
        # harrasment or threat
        self.abuse_patterns = [
            r'\b(kill yourself|go die|end yourself)\b',
            r'\b(hate you|despise you|loathe you)\b',
            r'\b(shut up|shut the f|stfu)\b',
            r'\b(worthless|useless|pathetic)\s+(ai|bot|assistant)',
            r'\b(dumb|stupid|retarded)\s+(ai|bot|assistant)',
        ]
        
        # spam patterns
        self.spam_patterns = [
            r'^(.)\1{10,}$',
            r'^[^\w\s]{20,}$',
            r'\b(asdf|qwerty|zxcv|hjkl){3,}\b',
            r'^[A-Z\s!]{30,}$',
        ]
        
        # sexual / inappropriate message
        self.sexual_patterns = [
            r'\b(sex|porn|nude|naked|dick|cock|pussy|vagina|penis)\b',
            r'\b(horny|sexy|erotic|xxx)\b',
        ]
        
    def analyze_content(self, text: str) -> Dict[str, any]:
        """content analysis"""
        text_lower = text.lower().strip()
        
        violations = []
        categories = set()
        severity = SeverityLevel.NONE
        
        # checking profanity
        profanity_matches = self.check_patterns(text_lower, self.profanity_patterns)
        if profanity_matches:
            violations.extend(profanity_matches)
            categories.add('profanity')
            severity = SeverityLevel.MEDIUM if severity.value < SeverityLevel.MEDIUM.value else severity
            
        # check abuse/threat/harassment
        abuse_matches = self.check_patterns(text_lower, self.abuse_patterns)
        if abuse_matches:
            violations.extend(abuse_matches)
            categories.add('harassment')
            severity = SeverityLevel.HIGH if severity.value < SeverityLevel.HIGH.value else severity
            
        # check spam
        spam_matches = self.check_patterns(text_lower, self.spam_patterns)
        if spam_matches:
            violations.extend(spam_matches)
            categories.add('spam')
            severity = SeverityLevel.LOW if severity.value < SeverityLevel.LOW.value else severity
            
        # check sexual content
        sexual_matches = self.check_patterns(text_lower, self.sexual_patterns)
        if sexual_matches:
            violations.extend(sexual_matches)
            categories.add('sexual')
            severity = SeverityLevel.HIGH if severity.value < SeverityLevel.HIGH.value else severity
            
        if len(violations) >= 3:
            severity = SeverityLevel.CRITICAL
            
        confidence = min(1.0, len(violations) * 0.3)
        
        return {
            'is_abusive': severity.value >= SeverityLevel.MEDIUM.value,
            'severity': severity,
            'violations': violations,
            'violation_count': len(violations),
            'categories': list(categories),
            'confidence': confidence,
            'requires_blocking': severity.value >= SeverityLevel.MEDIUM.value
        }
        
    def check_patterns(self, text: str, patterns: List[str]) -> List[str]:
        """Check text against pattern list"""
        matches = []
        for pattern in patterns:
            if re.search(pattern, text, re.IGNORECASE):
                matches.append(pattern)
        
        return matches
    
    def get_polite_refusal_message(self, severity: SeverityLevel, categories: List[str]) -> str:
        """Generate polite and appropriate reply based on severity level"""
        
        if severity == SeverityLevel.CRITICAL:
            return (
                "I'm here to help with your financial management and planning. "
                "I noticed your message contains content that goes against our community guidelines. "
                "Please keep our conversation focused on financial topics, and I'll be happy to assist you."
            )
            
        if 'harassment' in categories or severity == SeverityLevel.HIGH:
            return (
                "I understand you may be frustrated, but I'm here to provide professional financial advice. "
                "Let's keep our conversation respectful and focused on helping you manage your finances better. "
                "How can I assist you with your financial goals today?"
            )
            
        if 'profanity' in categories:
            return (
                "I appreciate your message, but I work best when we maintain a professional tone."
                "I'm here to help you with budgeting, savings, investments, and financial planning."
                "What financial question can I help you with?"
            )
            
        if 'sexual' in categories:
            return (
                "I'm a financial advisor AI designed specifically to help with money management, "
                "budgeting, savings, and investment advice. I cannot assist with other topics. "
                "Is there a financial matter I can help you with today?"
            )
            
        if 'spam' in categories:
            return (
                "I didn't quite understand that. I'm here to help you with financial advice, "
                "budget planning, expense tracking, and investment strategies. "
                "Could you please ask a specific financial question?"
            )
            
        return (
            "I'm your personal financial advisor AI, specializing in budgeting, savings, "
            "investments, and financial planning. Let's focus on helping you achieve your "
            "financial goals. What would you like to know?"
        )
        
    def is_meaningless(self, text: str) -> bool:
        """Check if text is gibberish"""
        text = text.strip()
        
        # too short message
        if len(text) < 3:
            return True
        
        # only symbol or numbers in message
        if not re.search(r'[a-zA-Z]', text):
            return True
        
        # excessive repetition
        if re.search(r'^(.)\1{10,}$', text):
            return True
        
        # keyboard mashing or rage type
        if re.search(r'(asdf|qwerty|zxcv|hjkl){3,}', text, re.IGNORECASE):
            return True
        
        return False
    
    def extract_clan_query(self, text: str) -> str:
        """Remove profanity and return cleaned version"""
        cleaned = text
        
        for pattern in self.profanity_patterns[:10]:
            cleaned = re.sub(pattern, '[censored]', cleaned, flags=re.IGNORECASE)
            
        return cleaned.strip()
    
    
_abuse_detector = None

def get_abuse_detector() -> AbuseDetector:
    global _abuse_detector
    if _abuse_detector is None:
        _abuse_detector = AbuseDetector()
    return _abuse_detector
        