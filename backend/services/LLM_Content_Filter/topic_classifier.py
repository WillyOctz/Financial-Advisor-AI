import re
from typing import Dict, Tuple
from enum import Enum

class TopicCategory(Enum):
    FINANCIAL = "financial"
    FINANCE_ADJACENT = "finance_adjacent" 
    OFF_TOPIC = "off_topic"
    GREETING = "greeting"
    UNCLEAR = "unclear"
    
class TopicClassifier:
    def __init__(self):
        # core financial topics
        self.financial_keywords = [
            # Money & Banking
            'money', 'cash', 'bank', 'account', 'balance', 'deposit', 'withdraw',
            'transfer', 'payment', 'transaction', 'atm', 'card', 'credit', 'debit',
            
            # Budgeting & Expenses
            'budget', 'expense', 'spending', 'cost', 'price', 'bill', 'invoice',
            'receipt', 'purchase', 'buy', 'bought', 'spent', 'pay', 'paid',
            
            # Income & Earnings
            'income', 'salary', 'wage', 'earn', 'earnings', 'profit', 'revenue',
            'paycheck', 'bonus', 'commission', 'freelance', 'gig',
            
            # Savings & Investments
            'save', 'savings', 'invest', 'investment', 'stock', 'bond', 'mutual fund',
            'portfolio', 'asset', 'wealth', 'retirement', '401k', 'ira', 'roth',
            'pension', 'dividend', 'interest', 'yield', 'return', 'roi',
            
            # Debt & Loans
            'debt', 'loan', 'mortgage', 'rent', 'lease', 'borrow', 'lender',
            'creditor', 'owe', 'owing', 'installment', 'emi', 'interest rate',
            'apr', 'refinance', 'amortization',
            
            # Financial Planning
            'financial', 'finance', 'budget plan', 'financial plan', 'goal',
            'target', 'emergency fund', 'rainy day', 'net worth', 'cash flow',
            
            # Categories
            'category', 'categories', 'groceries', 'food', 'dining', 'restaurant',
            'utilities', 'electricity', 'water', 'gas', 'internet', 'phone',
            'transportation', 'uber', 'lyft', 'taxi', 'fuel', 'gas station',
            'entertainment', 'subscription', 'netflix', 'spotify', 'gym',
            'insurance', 'health', 'medical', 'doctor', 'hospital',
            
            # Analysis terms
            'analyze', 'analysis', 'trend', 'pattern', 'forecast', 'predict',
            'recommendation', 'advice', 'suggest', 'tip', 'help',
            
            # Time periods
            'month', 'monthly', 'year', 'yearly', 'annual', 'quarter', 'quarterly',
            'week', 'weekly', 'day', 'daily', 'today', 'this month', 'last month',
            
            # Amounts & Currency
            'dollar', 'usd', 'rupee', 'euro', 'pound', 'yen', 'currency',
            
            # Financial Actions
            'track', 'monitor', 'record', 'log', 'upload', 'import', 'export',
            'download', 'report', 'summary', 'overview', 'dashboard',
        ]
        
        # finance adjacent
        self.adjacent_keywords = [
            'tax', 'taxes', 'taxation', 'irs', 'deduction', 'refund',
            'economy', 'economic', 'inflation', 'recession', 'gdp',
            'business', 'company', 'entrepreneur', 'startup',
            'market', 'trading', 'forex', 'cryptocurrency', 'bitcoin', 'crypto',
        ]
        
        # greetings & pleasantries
        self.greeting_patterns = [
            r'\b(hi|hello|hey|greetings|good morning|good afternoon|good evening)\b',
            r'\b(how are you|what\'s up|wassup|sup)\b',
            r'\b(thanks|thank you|thx|appreciate)\b',
            r'\b(bye|goodbye|see you|later|cya)\b',
            r'\b(ok|okay|got it|understood|cool|nice|great)\b',
        ]
        
        # off-topic patterns
        self.off_topic_patterns = [
            # Weather
            r'\b(weather|rain|sunny|temperature|forecast|climate)\b',
            # Sports
            r'\b(football|soccer|basketball|baseball|sports|game|match|team)\b',
            # Entertainment
            r'\b(movie|film|tv show|series|actor|actress|celebrity)\b',
            # Technology (non-financial)
            r'\b(computer|laptop|phone|iphone|android|software|game|gaming)\b',
            # Food (non-expense related)
            r'\b(recipe|cook|cooking|bake|baking|ingredients)\b',
            # Health (non-insurance)
            r'\b(exercise|workout|fitness|diet|nutrition|lose weight)\b',
            # General knowledge
            r'\b(who is|who was|what is|define|meaning of|tell me about)\b',
            # Math/Science (non-financial)
            r'\b(math problem|solve|equation|physics|chemistry|biology)\b',
        ]
        
        # question about the AI
        self.meta_patterns = [
            r'\b(who are you|what are you|your name|who made you|who created you)\b',
            r'\b(are you (a )?bot|are you (an )?ai|are you human)\b',
        ]
        
        # help or capability patterns
        self.help_patterns = [
            r'\b(what can you do|capabilities)\b'
        ]
        
    def classify_query(self, query: str) -> Dict[str, any]:
        """classify query if it's financial related"""
        query_lower = query.lower().strip()
        
        # empty or short queries
        if len(query_lower) < 3:
            return {
                'category': TopicCategory.UNCLEAR,
                'is_financial': False,
                'confidence': 0.0,
                'matched_keywords': [],
                'should_answer': False,
                'redirect_message': "Could you please provide more details about your financial question?"
            }
            
        # check for greetings
        if self.matches_patterns(query_lower, self.greeting_patterns):
            return {
                'category': TopicCategory.GREETING,
                'is_financial': False,
                'confidence': 0.9,
                'matched_keywords': ['greeting'],
                'should_answer': True,  # only brief response
                'redirect_message': None
            }
            
        # check for meta questions about the AI
        if self.matches_patterns(query_lower, self.meta_patterns) and financial_matches == 0:
            return {
                'category': TopicCategory.OFF_TOPIC,
                'is_financial': False,
                'confidence': 0.8,
                'matched_keywords': ['meta'],
                'should_answer': True,  # Can answer briefly about being a financial advisor
                'redirect_message': None
            }
            
        # count financial keywords matches
        financial_matches = self.count_keyword_matches(query_lower, self.financial_keywords)
        adjacent_matches = self.count_keyword_matches(query_lower, self.adjacent_keywords)
        
        # check if its clearly off topic
        off_topic_match = self.matches_patterns(query_lower, self.off_topic_patterns)
        
        # decision logic
        total_financial_score = financial_matches + (adjacent_matches * 0.5)
        
        # strong financial indicator
        if financial_matches >= 2:
            return {
                'category': TopicCategory.FINANCIAL,
                'is_financial': True,
                'confidence': min(0.95, 0.6 + (financial_matches * 0.1)),
                'matched_keywords': self.get_matched_keywords(query_lower, self.financial_keywords),
                'should_answer': True,
                'redirect_message': None
            }
            
        # single strong financial keywords
        if financial_matches == 1 and not off_topic_match:
            return {
                'category': TopicCategory.FINANCIAL,
                'is_financial': True,
                'confidence': 0.7,
                'matched_keywords': self.get_matched_keywords(query_lower, self.financial_keywords),
                'should_answer': True,
                'redirect_message': None
            }
            
        # finance adjacent (taxes, crypto, etc.)
        if adjacent_matches >= 1 and financial_matches == 0:
            return {
                'category': TopicCategory.FINANCE_ADJACENT,
                'is_financial': True,
                'confidence': 0.6,
                'matched_keywords': self.get_matched_keywords(query_lower, self.adjacent_keywords),
                'should_answer': True,
                'redirect_message': None
            }
            
        # clearly off-topic
        if off_topic_match and total_financial_score == 0:
            return {
                'category': TopicCategory.OFF_TOPIC,
                'is_financial': False,
                'confidence': 0.8,
                'matched_keywords': [],
                'should_answer': False,
                'redirect_message': (
                    "I'm specialized in financial management and planning. "
                    "I can help you with budgeting, expense tracking, savings goals, "
                    "investment advice, and financial planning. "
                    "Do you have any questions about your finances?"
                )
            }
            
        # ambiguous 
        if total_financial_score == 0 and not off_topic_match:
            return {
                'category': TopicCategory.UNCLEAR,
                'is_financial': False,
                'confidence': 0.3,
                'matched_keywords': [],
                'should_answer': False,
                'redirect_message': (
                    "I'm not sure I understand your question. I specialize in financial advice, including:\n"
                    "• Budget planning and expense tracking\n"
                    "• Savings strategies and investment guidance\n"
                    "• Debt management and financial goals\n"
                    "• Spending analysis and recommendations\n\n"
                    "Could you rephrase your question to focus on one of these financial topics?"
                )
            }
            
        # unclear message
        return {
            'category': TopicCategory.UNCLEAR,
            'is_financial': False,
            'confidence': 0.4,
            'matched_keywords': [],
            'should_answer': False,
            'redirect_message': "Could you clarify your financial question? I'm here to help with money management."
        }
        
    def matches_patterns(self, text: str, patterns: list) -> bool:
        """Check if text matches"""
        for pattern in patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return True
        return False
    
    def count_keyword_matches(self, text: str, keywords: list) -> int:
        """Count how many keywords appear in text"""
        count = 0
        for keyword in keywords:
            if keyword in text:
                count += 1
        return count
    
    def get_matched_keywords(self, text: str, keywords: list) -> list:
        """Get list of matched keywords"""
        matches = []
        for keyword in keywords:
            if keyword in text:
                matches.append(keyword)
        return matches[:5]
    
    def is_greeting_only(self, query: str) -> bool:
        """Check if query is just a greeting"""
        query_lower = query.lower().strip()
        return self.matches_patterns(query_lower, self.greeting_patterns) and len(query_lower.split()) <= 3
    
_topic_classifier = None

def get_topic_classifier() -> TopicClassifier:
    """Get singleton topic classifier instance"""
    global _topic_classifier
    if _topic_classifier is None:
        _topic_classifier = TopicClassifier()
    return _topic_classifier