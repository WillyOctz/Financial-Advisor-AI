from sqlalchemy.orm import Session
from sqlalchemy import extract
from backend.models.database import Transaction, FinancialInsight
from backend.models.schemas import AIAdviceResponse
from backend.services.rag_service import RAGService
from typing import Dict, List, Any
from datetime import datetime, date, timedelta
from backend.db.redis_client import RedisCache, cached, cache

class DisplayService:
    def __init__(self, db: Session):
        self.db = db
        self.rag_service = RAGService(db)
        self.cache = cache

    @cached(category='financial_summary', ttl=900) # cache for 15 minutes
    def get_financial_summary(self, user_id: int, timeframe: str = "today") -> Dict[str, Any]:
        """Get comprehensive financial summary"""
        query = self.db.query(Transaction).filter(Transaction.user_id == user_id)

        # ADD DEBUG LOGGING
        print(f"🔍 DEBUG: User ID: {user_id}, Timeframe: {timeframe}")
    
        # First, let's see all transactions without filtering
        all_transactions = self.db.query(Transaction).filter(Transaction.user_id == user_id).all()
        print(f"🔍 DEBUG: Total transactions in database: {len(all_transactions)}")
    
        for i, t in enumerate(all_transactions[:10]):
            print(f"🔍 Transaction {i+1}: ID={t.id}, Date={t.date}, Desc={t.description}, Amount={t.amount}, Type={t.type}, Month={t.month}")

        if timeframe == "today":
            # Get today's date
            today = datetime.combine(date.today(), datetime.min.time())
            query = query.filter(Transaction.date >= today)
            print(f"📅 Filtering transactions from today: {today}")

        elif timeframe == "latest_month":
            # Get the latest month data
            latest_month = self.db.query(Transaction.month).filter(
                Transaction.user_id == user_id
            ).order_by(Transaction.date.desc()).first()

            if latest_month:
                query = query.filter(Transaction.month == latest_month[0])
                print(f"📅 Filtering transactions for latest month: {latest_month[0]}")
            else:
                print("⚠️ No latest month found, returning all transactions")

        transactions = query.all()
        print(f"Found {len(transactions)} transactions")

        # Debugging - comment it when it works fully
        for i, t in enumerate(transactions[:5]):
            print(f"💳 Transaction {i+1}: {t.date} | {t.description} | ${t.amount} | {t.type} | {t.category} | Month: {t.month}")

        # Calculate spending patterns and trends
        spending_patterns = self._analyze_spending_patterns(transactions)
        income_patterns = self._analyze_income_patterns(transactions)

        if not transactions:
            return {
                "timeframe": timeframe,
                "total_income": 0,
                "total_expenses": 0,
                "net_savings": 0,
                "savings_rate": 0,
                "top_expense_category": "None",
                "top_expense_amount": 0,
                "expense_breakdown": {},
                "transaction_count": 0,
                "date": date.today().isoformat() if timeframe == "today" else None,
                "spending_patterns": spending_patterns,
                "income_patterns": income_patterns,
                "financial_health_score": 0
            }

        income = sum(t.amount for t in transactions if t.type.value == "INCOME")
        expenses = sum(t.amount for t in transactions if t.type.value == "EXPENSE")
        net_savings = income - expenses
        savings_rate = (net_savings / income * 100) if income > 0 else 0

        print(f"💰 Calculated - Income: ${income}, Expenses: ${expenses}, Net: ${net_savings}")

        # Category breakdown
        expense_categories = {}
        for t in transactions:
            if t.type.value == "EXPENSE":
                category = t.category or "Uncategorized"
                expense_categories[category] = expense_categories.get(category, 0) + t.amount

        top_category = max(expense_categories.items(), key=lambda x: x[1]) if expense_categories else("None", 0)

        # Calculate financial health score (0-100)
        financial_health_score = self._calculate_financial_health_score(
            income, expenses, net_savings, savings_rate
        )

        result = {
            "timeframe": timeframe,
            "total_income": income,
            "total_expenses": expenses,
            "net_savings": net_savings,
            "savings_rate": savings_rate,
            "top_expense_category": top_category[0],
            "top_expense_amount": top_category[1],
            "expense_breakdown": expense_categories,
            "transaction_count": len(transactions),
            "spending_patterns": spending_patterns,
            "income_patterns": income_patterns,
            "financial_health_score": financial_health_score,
            "average_daily_spending": expenses / 30 if timeframe == "latest_month" else expenses,
            "discretionary_spending": self._calculate_discretionary_spending(expense_categories),
            "essential_spending": self._calculate_essential_spending(expense_categories)
        }
    
        if timeframe == "today":
            result["date"] = date.today().isoformat()

        return result
    
    def _analyze_spending_patterns(self, transactions: List[Transaction]) -> Dict[str, Any]:
        """Analyze spending patterns from transactions"""
        patterns = {
            "highest_spending_day": None,
            "most_frequent_category": None,
            "recurring_expenses": [],
            "unsual_spending": []
        }

        if not transactions:
            return patterns
        
        # Group by day of week
        day_spending = {}
        category_frequency = {}
        expense_dates = []

        for t in transactions:
            if t.type.value == "EXPENSE":
                # Day of week analysis
                day = t.date.strftime('%A')
                day_spending[day] = day_spending.get(day, 0) + t.amount

                # Category frequency
                category = t.category or "Uncategorized"
                category_frequency[category] = category_frequency.get(category, 0) + 1

                # Tracks dates for pattern detection
                expense_dates.append(t.date)

                # Identify recurring expenses (same amount ±10%)
                recurring_key = f"{category}_{t.description}"

        if day_spending:
            patterns["highest_spending_day"] = max(day_spending.items(), key=lambda x: x[1])

        if category_frequency:
            patterns["most_frequent_category"] = max(category_frequency.items(), key=lambda x: x[1])

        # can be continued more for tracking dates and recurring expenses

        return patterns
    
    def _analyze_income_patterns(self, transactions: List[Transaction]) -> Dict[str, Any]:
        """Analyze income patterns from transactions"""
        patterns = {
            "income_sources": {},
            "income_consistency": "variable",
            "average_monthly_income": 0
        }

        income_transactions = [t for t in transactions if t.type.value == "INCOME"]

        if not income_transactions:
            return patterns
        
        # Group income by source/description
        for t in income_transactions:
            source = t.description.lower()
            patterns["income_sources"][source] = patterns["income_sources"].get(source, 0) + t.amount

        # Calculate average monthly income
        monthly_income = {}
        for t in income_transactions:
            month_key = t.date.strftime('%Y-%m')
            monthly_income[month_key] = monthly_income.get(month_key, 0) + t.amount

        if monthly_income:
            patterns["average_monthly_income"] = sum(monthly_income.values()) / len(monthly_income)

            # Check consistency
            incomes = list(monthly_income.values())
            if len(incomes) > 1:
                variation = max(incomes) - min(incomes)
                if variation < patterns["average_monthly_income"] * 0.1:
                    patterns["income_consistency"] = "stable"
                else:
                    patterns["income_consistency"] = "variable"

        return patterns
    
    def _calculate_financial_health_score(self, income: float, expenses: float, net_savings: float, savings_rate: float) -> int:
        """Calculate financial health score (0-100)"""
        if income == 0:
            return 0
        
        score = 0

        # Savings rate component (40 points max)
        if savings_rate >= 20:
            score += 40
        elif savings_rate >= 15:
            score += 30
        elif savings_rate >= 10:
            score += 20
        elif savings_rate >= 5:
            score += 10
        elif savings_rate > 0:
            score += 5

        # Expense to income ratio component (30 points max)
        expense_ratio = expenses / income
        if expense_ratio <= 0.5:
            score += 30
        elif expense_ratio <= 0.7:
            score += 20
        elif expense_ratio <= 0.0:
            score += 10

        # Positive net savings component (30 points max)
        if net_savings > 0:
            score += min(30, int((net_savings / income) * 100))

        return min(100, score)
    
    def _calculate_discretionary_spending(self, expense_categories: Dict[str, float]) -> float:
        """Calculate discretionary (non-essential) spending"""
        discretionary_categories = ['entertainment', 'dining', 'shopping', 'hobbies', 'subscriptions']
        discretionary_total = 0

        for category, amount in expense_categories.items():
            category_lower = category.lower()
            if any(disc_category in category_lower for disc_category in discretionary_categories):
                discretionary_total += amount

        return discretionary_total
    
    def _calculate_essential_spending(self, expense_categories: Dict[str, float]) -> float:
        """Calculate essential spending"""
        essential_categories = ['rent', 'mortgage', 'utilities', 'groceries', 'insurance', 'healthcare', 'transportation']
        essential_total = 0

        for category, amount in expense_categories.items():
            category_lower = category.lower()
            if any(ess_category in category_lower for ess_category in essential_categories):
                essential_total += amount

        return essential_total
    
    def get_analysis_summary(self, user_id: int) -> Dict[str, any]:
        """Return metrics current month,previous month and all time almost same with financial summary but for calculation between percentage current month and previous month and all time from both"""
        
        now = datetime.now()
        current_year = now.year()
        current_month = now.month()
        
        prev_month = current_month - 1 if current_month > 1 else 12
        prev_year = current_year if current_month > 1 else current_year - 1
        
        # helper function
        def _totals(transactions):
            income = sum(t.amount for t in transactions if t.type.value == "INCOME")
            expenses = sum(t.amount for t in transactions if t.type.value == "EXPENSE")
            net = income - expenses
            rate = (net / income * 100) if income > 0 else 0.0
            return {"income": income, "expenses": expenses,
                    "net_savings": net, "savings_rate": rate,
                    "count": len(transactions)}
        
        def _pct_change(current: float, previous: float) -> float:
            """Signed percentage change"""
            # return 0 when previous is 0 or none
            if previous == 0:
                return 100.0 if current > 0 else 0.0
            return round((current - previous) / previous * 100, 1)
        
        # query each period
        base = self.db.query(Transaction).filter(Transaction.user_id == user_id)
        
        current_txns = base.filter(
            extract("year",  Transaction.date) == current_year,
            extract("month", Transaction.date) == current_month,
        ).all()
        
        prev_txns = base.filter(
            extract("year",  Transaction.date) == prev_year,
            extract("month", Transaction.date) == prev_month,
        ).all()
        
        all_txns = base.all()
        
        cur = _totals(current_txns)
        prev = _totals(prev_txns)
        all_ = _totals(all_txns)
        
        def _direction(pct: float) -> str:
            return "up" if pct >= 0 else "down"
        
        # analysis object of financial summary, can flip colour if needed
        return {
            "current_month": {
                "label": now.strftime("%B %Y"),
                "income":        cur["income"],
                "expenses":      cur["expenses"],
                "net_savings":   cur["net_savings"],
                "savings_rate":  round(cur["savings_rate"], 1),
                "transaction_count": cur["count"],
            },
            "previous_month": {
                "label": datetime(prev_year, prev_month, 1).strftime("%B %Y"),
                "income":       prev["income"],
                "expenses":     prev["expenses"],
                "net_savings":  prev["net_savings"],
                "savings_rate": round(prev["savings_rate"], 1),
                "transaction_count": prev["count"],
            },
            "all_time": {
                "income":       all_["income"],
                "expenses":     all_["expenses"],
                "net_savings":  all_["net_savings"],
                "savings_rate": round(all_["savings_rate"], 1),
                "transaction_count": all_["count"],
            },
            # Ready-to-use change objects for each metric
            "changes": {
                "income": {
                    "pct":       _pct_change(cur["income"],       prev["income"]),
                    "direction": _direction(_pct_change(cur["income"], prev["income"])),
                },
                "expenses": {
                    "pct":       _pct_change(cur["expenses"],     prev["expenses"]),
                    "direction": _direction(_pct_change(cur["expenses"], prev["expenses"])),
                },
                "net_savings": {
                    "pct":       _pct_change(cur["net_savings"],  prev["net_savings"]),
                    "direction": _direction(_pct_change(cur["net_savings"], prev["net_savings"])),
                },
                "savings_rate": {
                    "pct":       _pct_change(cur["savings_rate"], prev["savings_rate"]),
                    "direction": _direction(_pct_change(cur["savings_rate"], prev["savings_rate"])),
                },
            },
        }
        
    
    def generate_ai_advice(self, user_id: int, custom_prompt: str = None) -> AIAdviceResponse:
        """Generate AI advice using RAG (more advanced and optimized)"""
        summary = self.get_financial_summary(user_id, timeframe="all_time") # timeframe can be changed but all time is much more detailed

        # Enhanced financial context with more details
        financial_context = f""""
        COMPREHENSIVE FINANCIAL ANALYSIS:

        BASIC METRICS:
        - Timeframe: {summary['timeframe']}
        - Total Income: ${summary['total_income']:,.2f}
        - Total Expenses: ${summary['total_expenses']:,.2f}
        - Net Savings: ${summary['net_savings']:,.2f}
        - Savings Rate: {summary['savings_rate']:.1f}%
        - Financial Health Score: {summary['financial_health_score']}/100
        
        SPENDING ANALYSIS:
        - Top Expense Category: {summary['top_expense_category']} (${summary['top_expense_amount']:,.2f})
        - Essential Spending: ${summary.get('essential_spending', 0):,.2f}
        - Discretionary Spending: ${summary.get('discretionary_spending', 0):,.2f}
        - Average Daily Spending: ${summary.get('average_daily_spending', 0):,.2f}
        
        EXPENSE BREAKDOWN:
        {self._format_expense_breakdown(summary['expense_breakdown'])}
        
        INCOME PATTERNS:
        - Income Sources: {len(summary['income_patterns'].get('income_sources', {}))} distinct sources
        - Income Consistency: {summary['income_patterns'].get('income_consistency', 'unknown')}
        - Average Monthly Income: ${summary['income_patterns'].get('average_monthly_income', 0):,.2f}
        
        SPENDING PATTERNS:
        - Highest Spending Day: {summary['spending_patterns'].get('highest_spending_day', ('None', 0))[0]}
        - Most Frequent Category: {summary['spending_patterns'].get('most_frequent_category', ('None', 0))[0]}
        - Total Transactions: {summary['transaction_count']}
        
        FINANCIAL HEALTH INDICATORS:
        - Savings Status: {'Healthy' if summary['savings_rate'] > 15 else 'Moderate' if summary['savings_rate'] > 5 else 'Needs Improvement'}
        - Expense to Income Ratio: {(summary['total_expenses']/summary['total_income']*100 if summary['total_income'] > 0 else 0):.1f}%
        - Essential vs Discretionary Ratio: {(summary.get('essential_spending', 0)/summary['total_expenses']*100 if summary['total_expenses'] > 0 else 0):.1f}% essential
        """

        query = custom_prompt or "Provide comprehensive financial advice including specific insights, actionable recommendations, risk assessment, and improvement opportunities based on my complete financial picture for the future."

        # Get enhanced advice with structured insights
        advice_text, insights, recommendations, provider_used = self.rag_service.generate_contextual_advice(
            user_id, query, financial_context
        )

        # Save insights to database for future reference
        if provider_used not in ["greeting_response", "moderation_blocked"]:
            self._save_financial_insights(user_id, insights, recommendations, advice_text)

        return AIAdviceResponse(
            advice=advice_text,
            insights=insights,
            recommendations=recommendations,
            generated_at=datetime.now(),
            provider_used=provider_used
        )
    
    def _format_expense_breakdown(self, expense_breakdown: Dict[str, float]) -> str:
        """Format expense breakdown for the AI context"""
        if not expense_breakdown:
            return "No expense data available."
        
        formatted = ""
        sorted_categories = sorted(expense_breakdown.items(), key=lambda x: x[1], reverse=True)

        for category, amount in sorted_categories[:10]:
            formatted += f"- {category}: ${amount:,.2f}\n"

        return formatted
    
    def _save_financial_insights(self, user_id: int, insights: List[str], recommendations: List[str], advice_text: str):
        """Save generated insights to database"""
        try:
            # Save main insights
            if insights:
                main_insight = FinancialInsight(
                    user_id=user_id,
                    insight_type="spending pattern",
                    insight_text=insights[0],
                    confidence_score=0.8
                )
            self.db.add(main_insight)

            # Save recommendations as insights
            for i, recommendation in enumerate(recommendations[:2]):
                rec_insight = FinancialInsight(
                    user_id=user_id,
                    insight_type="recommendation",
                    insight_text=recommendation,
                    confidence_score=0.7
                )
                self.db.add(rec_insight)

            # Save summary insight
            summary_insight = FinancialInsight(
                user_id=user_id,
                insight_type="ai_advice_summary",
                insight_text=advice_text[:200] + ("..." if len(advice_text) > 500 else ""),
                confidence_score=0.9
            )
            self.db.add(summary_insight)

            self.db.commit()
            print(f"💾 Saved {len(insights)} insights and {len(recommendations)} recommendations to database")

        except Exception as e:
            print(f"⚠️ Failed to save insights: {e}")
            self.db.rollback()


class EnhancedDisplayService(DisplayService):
    def __init__(self, db: Session):
        super().__init__(db)
        self.cache = RedisCache()

    @cached(category='financial_summary', ttl=timedelta(minutes=15))
    def get_financial_summary(self, user_id: int, timeframe: str = "today") -> Dict[str, Any]:

        """Cached version of financial summary"""
        return super().get_financial_summary(user_id, timeframe)
    
    def generate_ai_advice_cached(self, user_id: int, custom_prompt: str = None) -> AIAdviceResponse:
        """Generate AI advice with caching"""
        cache_key = f"{user_id}:{custom_prompt or 'default'}"

        # Try cache first
        cached = self.cache.get('ai_advice', cache_key)
        if cached:
            return AIAdviceResponse(**cached)
        
        # Generate fresh advice
        advice = super().generate_ai_advice(user_id, custom_prompt)

        # Cache the result
        advice_dict = advice.dict()
        self.cache.set('ai_advice', cache_key, advice_dict)

        return advice
    