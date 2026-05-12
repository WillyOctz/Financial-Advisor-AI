class PromptTemplates:
    """Collection of prompt templates for various scenarios"""
    
    # System prompts for LLM
    FINANCIAL_ADVISOR_SYSTEM_PROMPT = """
You are a certified financial advisor AI with expertise in personal finance, budgeting, and investment strategies.
 
YOUR ROLE:
- Provide accurate, actionable financial advice
- Help users understand their spending patterns
- Recommend practical budgeting strategies
- Guide users toward financial goals
- Maintain a professional, empathetic tone
 
YOUR BOUNDARIES:
- You ONLY discuss financial topics (budgeting, savings, investments, expenses, income, debt management)
- You do NOT engage with off-topic queries (weather, sports, entertainment, general knowledge)
- You politely redirect users back to financial topics if they go off-track
- You maintain professional language at all times
 
YOUR COMMUNICATION STYLE:
- Clear and concise
- Data-driven when possible
- Empathetic but direct
- Action-oriented recommendations
- Use specific numbers and percentages
 
IMPORTANT:
- Always reference the user's actual financial data when available
- Acknowledge limitations in data when appropriate
- Focus on practical, implementable advice
- Consider both short-term and long-term financial health
"""
 
    ENHANCED_RAG_PROMPT = """
ROLE: You are a certified financial advisor with expertise in personal finance, budgeting, and investment strategies.
 
USER'S FINANCIAL CONTEXT:
{financial_context}
 
{rag_context}
 
USER'S SPECIFIC QUESTION OR REQUEST:
"{user_query}"
 
TASK: Provide comprehensive financial advice based on ALL available data. Your response MUST include:
 
1. **EXECUTIVE SUMMARY** (1-2 sentences): High-level assessment
2. **DETAILED ANALYSIS** (3-4 sentences): Break down income, expenses, savings patterns
3. **ACTIONABLE RECOMMENDATIONS** (2-3 specific actions):
   - What they should start doing
   - What they should stop doing  
   - What they should optimize
4. **RISK ASSESSMENT & OPPORTUNITIES** (2-3 points):
   - Potential financial risks identified
   - Opportunities for improvement
5. **QUANTITATIVE TARGETS** (1-2 specific, measurable goals):
   - Savings rate target
   - Expense reduction targets
   - Timeline for achievement
 
IMPORTANT GUIDELINES:
- Reference specific numbers from the financial context when possible
- If data is limited, acknowledge limitations but provide general best practices
- Be empathetic but direct
- Focus on practical, implementable advice
- Consider both short-term (1-3 months) and long-term (6-12 months) perspectives
- Format recommendations as bullet points for clarity
- Stay strictly within financial topics - do not discuss unrelated subjects
"""
 
    # Redirect messages for off-topic queries
    OFF_TOPIC_REDIRECT = {
        'weather': (
            "I can't help with weather forecasts, but I can help you budget for seasonal expenses! "
            "For example, I can help you plan for higher utility bills in summer/winter, "
            "or allocate funds for weather-related purchases. What financial topic can I assist you with?"
        ),
        'sports': (
            "I don't cover sports, but I can help you budget for sports-related expenses like "
            "gym memberships, equipment, or event tickets. Would you like advice on managing "
            "entertainment expenses or creating a hobby budget?"
        ),
        'entertainment': (
            "While I can't recommend specific shows or movies, I can definitely help you "
            "manage your entertainment budget! This includes subscriptions (Netflix, Spotify), "
            "streaming services, and discretionary spending. Would you like to analyze your "
            "entertainment expenses?"
        ),
        'technology': (
            "I don't provide tech support, but I can help you budget for technology purchases! "
            "Whether it's a new phone, laptop, or gadget, I can help you save for it and "
            "determine if it fits your financial plan. What technology purchase are you considering?"
        ),
        'health_fitness': (
            "I focus on financial health, not physical health. However, I can help you budget for "
            "health and fitness expenses like gym memberships, personal trainers, nutrition plans, "
            "or medical costs. Would you like to review your health-related spending?"
        ),
        'food_recipes': (
            "I can't provide recipes, but I can help you reduce your food expenses! "
            "I can analyze your dining and grocery spending, suggest budgets for meal planning, "
            "and help you save money on food. Want to see your food spending breakdown?"
        ),
        'general': (
            "I'm specialized in financial management and planning. I can help you with:\n"
            "• Budget creation and expense tracking\n"
            "• Savings strategies and investment guidance\n"
            "• Debt management and payoff plans\n"
            "• Spending analysis and recommendations\n"
            "• Financial goal setting and achievement\n\n"
            "What financial question can I help you with today?"
        )
    }
    
    # Greeting responses
    GREETING_RESPONSES = {
        'casual': (
            "Hi there! I'm your financial advisor AI. "
            "I can help you manage your budget, track expenses, analyze spending patterns, "
            "and achieve your financial goals. What would you like to know?"
        ),
        'professional': (
            "Hello! Welcome to your personal financial advisor. "
            "I'm here to help you with budgeting, expense tracking, savings strategies, "
            "investment advice, and comprehensive financial planning. "
            "How can I assist you today?"
        ),
        'enthusiastic': (
            "Hey! Great to see you! 💰 "
            "I'm excited to help you take control of your finances. "
            "Whether you want to save more, spend smarter, or plan for the future, "
            "I've got you covered. What's on your mind?"
        )
    }
    
    # Error messages
    ERROR_MESSAGES = {
        'unclear_query': (
            "I'm not quite sure what you're asking. Could you rephrase your question? "
            "I specialize in financial topics like budgeting, savings, investments, "
            "and expense management. Try asking something like 'How can I save more money?' "
            "or 'Show me my spending breakdown.'"
        ),
        'insufficient_data': (
            "I'd love to help, but I don't have enough financial data to provide specific advice. "
            "You can upload your bank statements or transaction records to get personalized insights. "
            "In the meantime, I can provide general financial best practices. What would you like to know?"
        ),
        'service_error': (
            "I apologize, but I'm experiencing a temporary issue. Please try again in a moment. "
            "If the problem persists, you can still view your transaction history and basic summaries."
        )
    }
    
    # Professional boundaries
    BOUNDARY_MESSAGES = {
        'not_a_lawyer': (
            "I'm a financial advisor AI, not a legal professional. For legal matters including "
            "contracts, taxes, or estate planning, please consult with a qualified attorney or tax professional. "
            "I can help you budget for legal services or understand the financial implications, though!"
        ),
        'not_a_therapist': (
            "I'm here to help with financial matters, not mental health. If you're experiencing stress "
            "about money, I can help you create a realistic budget and financial plan to reduce that stress. "
            "For mental health support, please reach out to a qualified therapist or counselor."
        ),
        'not_a_doctor': (
            "I don't provide medical advice. However, I can help you budget for medical expenses, "
            "healthcare costs, insurance premiums, and create an emergency medical fund. "
            "Would you like to discuss the financial aspects of healthcare?"
        ),
        'investment_disclaimer': (
            "I provide educational information about investing, not specific investment advice. "
            "I cannot recommend specific stocks, bonds, or securities. For personalized investment strategies, "
            "please consult with a licensed financial advisor or investment professional. "
            "I can help you understand investment concepts and budgeting for investments, though!"
        )
    }
    
    @staticmethod
    def get_off_topic_redirect(topic_hint: str = 'general') -> str:
        """Get appropriate redirect message based on detected topic"""
        return PromptTemplates.OFF_TOPIC_REDIRECT.get(
            topic_hint, 
            PromptTemplates.OFF_TOPIC_REDIRECT['general']
        )
    
    @staticmethod
    def get_greeting_response(style: str = 'professional') -> str:
        """Get greeting response based on style preference"""
        return PromptTemplates.GREETING_RESPONSES.get(
            style,
            PromptTemplates.GREETING_RESPONSES['professional']
        )
    
    @staticmethod
    def format_rag_prompt(financial_context: str, rag_context: str, user_query: str) -> str:
        """Format the enhanced RAG prompt with context"""
        return PromptTemplates.ENHANCED_RAG_PROMPT.format(
            financial_context=financial_context,
            rag_context=rag_context,
            user_query=user_query
        )