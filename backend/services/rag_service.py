from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from backend.services.vector_search import VectorSearchService
import google.generativeai as genai
import os
from backend.services.llm_services import LLMService, LLMProvider
from backend.services.LLM_Content_Filter.content_moderator import get_content_moderator
from backend.services.LLM_Content_Filter.prompt_templates import PromptTemplates
from backend.models.database import ModerationLogs
from dotenv import load_dotenv
import logging

load_dotenv()

logger = logging.getLogger(__name__)

class QueryType:
    """Classify query types for different response strategies"""
    DATA_ANALYSIS = "data_analysis"
    CONVERSATIONAL_ADVICE = "conversational_advice"
    GENERAL_FINANCIAL = "general_financial"
    SPECIFIC_QUESTION = "specific_quesiton"

class RAGService:
    def __init__(self, db: Session):
        self.db = db
        self.vector_search = VectorSearchService(db)
        self.llm_service = LLMService(primary_provider=LLMProvider.GEMINI)
        self.current_provider = LLMProvider.GEMINI # to track which current provider is used
        self.content_moderator = get_content_moderator()
        self.prompt_templates = PromptTemplates()

    def generate_contextual_advice(self, user_id: int, query: str, financial_context: str) -> Tuple[str, List[str], List[str], str]:
        """Generate AI advice using RAG along with fallback LLM support"""
        try:
            # content moderation - check if query is appropriate
            moderation_result = self.content_moderator.moderate_query(query, user_id)
            
            # log moderation result to the database
            self.log_moderation(user_id, query, moderation_result)
            
            # handle blocked or inappropriate queries
            if moderation_result.should_block:
                logger.warning(
                    f"Query blocked for user {user_id}: "
                    f"Type={moderation_result.violation_type}, "
                    f"Severity={moderation_result.severity.name}"
                )
                
                return (
                    moderation_result.response_message,
                    ["Content moderation active"],
                    ["Please ask financial-related questions"],
                    "moderation_blocked"
                )
                
            # handle a greeting one with brief response
            if moderation_result.topic_category.value == 'greeting':
                logger.info(f"Greeting detected from user {user_id}")
                return (
                    moderation_result.response_message,
                    ["Greeting acknowledged"],
                    ["Ask about your budget, expenses, or savings"],
                    "greeting_response"
                )
                
            # classify query first then query approved, continue to regular flow RAG
            query_type = self.classify_query_type(query)
            logger.info(f"Query classified as: {query_type}")
            
            # query approved, continue to regular flow RAG
            logger.info(f"Query approved for user {user_id}, proceeding with RAG")

            # decide to fetch RAG context based on query type
            use_rag = query_type in [QueryType.DATA_ANALYSIS, QueryType.CONVERSATIONAL_ADVICE]
            
            context_text = ""
            if use_rag:
                # search relevant dcoument chunks
                relevant_chunks = self.vector_search.search_similar_transactions(query, user_id)
                
                logger.info(f"Found {len(relevant_chunks)} relevant chunks for RAG")
                
                # build context from relevant chunks
                if relevant_chunks:
                    context_text = "RELEVANT HISTORICAL TRANSACTION DATA:\n"
                    for i, chunk in enumerate(relevant_chunks[:3]): # limit it to 3
                        context_text += f"\n--- Chunk {i+1} (Relevance: {chunk['similarity_score']:.2f}) ---\n"
                        context_text += f"{chunk['chunk_text']}\n"
                else:
                    context_text = 'No specific transaction data available for semantic search'
                    logger.info("No relevant chunks found, using fallback context")
                    
            else:
                context_text = "No transaction data needed for this query type."
                logger.info(f"Skipping RAG for {query_type} - conversational response")
                
            prompt = self._build_contextual_prompt(
                query=query,
                query_type=query_type,
                financial_context=financial_context,
                rag_context=context_text
            )
            
            # generate the response with context text
            response_data = self._generate_llm_response(prompt)
            
            advice_text = response_data.get("text", "")
            provider_used = response_data.get("provider_used", "unknown")
            
            # insights/recommendations differ based on query type
            insights, recommendations = self._extract_structured_insights(
                advice_text,
                query_type
            )
            
            # log which provider was used
            logger.info(f"Generated advice using provider: {provider_used}")
            if provider_used not in ["unknown", "none", "error", "fallback"]:
                try:
                    self.current_provider = LLMProvider(provider_used)
                except ValueError:
                    self.current_provider = LLMProvider.GEMINI
            else:
                self.current_provider = LLMProvider.GEMINI
                
            return advice_text, insights, recommendations, provider_used
        
        except Exception as e:
            logger.error(f"Error in RAG service: {e}", exc_info=True)
            error_message = "Unable to generate financial advice at this time. Please try again later or contact support."
            return error_message, ["Service temporarily unavailable"], ["Please try again later"], "error"
        
    def classify_query_type(self, query: str) -> str:
        """Classify the query type to determine response strategy"""
        query_lower = query.lower()
        
        # data anlysis queries
        data_analysis_keywords = [
            'show me', 'display', 'what did i spend', 'how much did i', 'breakdown',
            'summary', 'total', 'list my', 'my expenses', 'my income', 'last month',
            'this year', 'spending on', 'spent on', 'category', 'where did'
        ]
        
        # specific questions 
        conversational_keywords = [
            'how can i', 'what should i', 'advice', 'tips', 'help me', 'suggest',
            'recommend', 'improve', 'optimize', 'better', 'reduce', 'increase',
            'save more', 'cut down'
        ]
        
        # general finance knowledge
        general_knowledge_keywords = [
            'what is', 'what are', 'explain', 'define', 'difference between',
            'how does', 'why should', 'tell me about', 'meaning of', 'generally'
        ]
        
        # specific yes/no pattern or question
        specific_question_keywords = [
            'should i invest', 'is it good', 'worth it', 'is this a good',
            'better to', 'which one', 'or', '?'
        ]
        
        # check patterns
        if any(keyword in query_lower for keyword in data_analysis_keywords):
            return QueryType.DATA_ANALYSIS
        
        elif any(keyword in query_lower for keyword in conversational_keywords):
            return QueryType.CONVERSATIONAL_ADVICE
        
        elif any(keyword in query_lower for keyword in general_knowledge_keywords):
            return QueryType.GENERAL_FINANCIAL
        
        elif any(keyword in query_lower for keyword in specific_question_keywords):
            return QueryType.SPECIFIC_QUESTION
        
        # default to conversational advice
        return QueryType.CONVERSATIONAL_ADVICE
        
    def _build_contextual_prompt(self, financial_context: str, rag_context: str, query: str, query_type: str) -> str:
        """Build different advice prompt based on query type for more natural response"""
        if query_type == QueryType.DATA_ANALYSIS:
            return f"""
            You are a financial advisor AI. The user asked for data analysis.
 
            USER'S FINANCIAL SUMMARY:
            {financial_context}
 
            {rag_context}
 
            USER'S QUERY: "{query}"
 
            Provide a clear, structured analysis with:
            1. Direct answer to their question (2-3 sentences)
            2. Key insights from the data (2-3 bullet points)
            3. Actionable recommendations (1-2 bullet points)
 
            Be concise and data-focused. Use specific numbers from the context.
            """
            
        elif query_type == QueryType.CONVERSATIONAL_ADVICE:
            return f"""
            You are a friendly financial advisor having a conversation with someone seeking advice.
 
            THEIR FINANCIAL SITUATION:
            {financial_context}
 
            {rag_context}
 
            THEY ASKED: "{query}"
 
            Respond naturally and helpfully:
            - Address their question directly in a conversational tone
            - Reference their actual financial data when relevant
            - Give 2-3 practical, specific tips they can act on today
            - Be encouraging and supportive
            - Keep it concise (3-5 sentences)
 
            Don't use formal headers like "EXECUTIVE SUMMARY". Just talk to them like a helpful friend.
            """
        
        elif query_type == QueryType.GENERAL_FINANCIAL:
            return f"""
            You are a financial educator explaining concepts clearly.
 
            USER'S FINANCIAL CONTEXT (for personalization):
            {financial_context}
 
            THEY ASKED: "{query}"
 
            Explain clearly and concisely:
            - Define the concept in simple terms
            - Why it matters for personal finance
            - 1-2 practical examples
            - How it might apply to their situation (if relevant from context)
    
            Keep it under 5 sentences. Be educational but not preachy.
            """
        
        else:
            return f"""
            You are a financial advisor answering a specific question.
 
            THEIR SITUATION:
            {financial_context}
 
            THEIR QUESTION: "{query}"
 
            Provide a direct, thoughtful answer:
            - Give your recommendation clearly (2-3 sentences)
            - Explain the reasoning briefly
            - Mention any important considerations or risks
            - Keep it conversational and helpful
 
            No formal structure needed. Just answer their question naturally.
            """
        
    def _extract_structured_insights(self, text: str, query_type: str) -> Tuple[List[str], List[str]]:
        """Enhanced insight extraction using pattern recognition"""
        insights = []
        recommendations = []

        # for DATA_ANALYSIS, extract the structured insights
        if query_type == QueryType.DATA_ANALYSIS:
            sections = text.split('\n\n')
            
            for section in sections:
                section_lower = section.lower()
                
                # extract insights
                if any(keyword in section_lower for keyword in ['insight:', 'observation:', 'pattern:', 'key finding']):
                    sentences = [s.strip() for s in section.split('.') if s.strip()]
                    for sentence in sentences[:3]:
                        if any(keyword in sentence.lower() for keyword in ['spending', 'income', 'saving', 'expense']):
                            insights.append(sentence.strip())
                            
                # extract recommendations
                elif any(keyword in section_lower for keyword in ['recommendation:', 'suggestion:', 'action:', 'consider']):
                    lines = section.split('\n')
                    for line in lines:
                        line_lower = line.lower()
                        if any(keyword in line_lower for keyword in ['start', 'stop', 'reduce', 'increase', 'try']):
                            clean_line = line.strip()
                            if clean_line.startswith(('- ', '* ', '• ', '1.', '2.', '3.')):
                                clean_line = clean_line[:2].strip()
                            recommendations.append(clean_line)
        
        # for conversational                    
        else:
            sentences = [s.strip() + '.' for s in text.split('.') if s.strip()]
            
            # first 1-2 sentences as insights
            insights = sentences[:2] if len(sentences) >= 2 else sentences
            
            # look for action-oriented sentences as recommendations
            action_words = ['you should', 'try', 'consider', 'start', 'focus on', 'prioritize', 'avoid', 'reduce', 'increase']
            recommendations = [s for s in sentences if any(word in s.lower() for word in action_words)][:2]
            
            # fallback
            if not insights:
                insights = ["Your financial situation shows room for optimization."]
            
            if not recommendations:
                recommendations = ["Review your expenses and identify areas to reduce spending."]
                
            return insights[:3], recommendations[:2]
        
    def _generate_llm_response(self, prompt: str) -> Dict[str, Any]:
        """Generate LLM response with fallback providers"""
        try:
            # Try to generate with auto-fallback
            result = self.llm_service.generate_structured_content(
                prompt=prompt,
                max_output_tokens=1000,
                temperature=0.7
            )
 
            if result.get("success", False):
                return result
            else:
                # if structured call fails, try direct call
                text = self.llm_service.generate_content(
                    prompt=prompt,
                    max_output_tokens=1000,
                    temperature=0.7
                )
                return {
                    "text": text,
                    "provider_used": "fallback",
                    "success": True
                }
        except Exception as e:
            logger.error(f"All LLM providers failed: {e}")
            return {
                "text": "I apologize, but I'm unable to generate financial advice at this moment due to service limitations. Please try again in a few minutes.",
                "provider_used": "none",
                "success": False,
                "error": str(e)
            }
    
    def get_current_provider(self) -> str:
        """Get the currently active LLM provider"""
        return self.current_provider.value
    
    def log_moderation(self, user_id: int, query: str, moderation_result) -> None:
        """Log moderation for analysis later"""
        try:
            moderation_log = ModerationLogs(
                user_id=user_id,
                query_text=query[:500], # truncate long queries
                is_approved=moderation_result.is_approved,
                should_block=moderation_result.should_block,
                violation_type=moderation_result.violation_type,
                severity=moderation_result.severity.name if moderation_result.severity else None,
                topic_category=moderation_result.topic_category.value if moderation_result.topic_category else None,
                confidence=moderation_result.confidence,
                response_message=moderation_result.response_message,
                meta_data=moderation_result.metadata
            )
            
            self.db.add(moderation_log)
            self.db.commit()
            
            logger.info(f"Logged moderation event for user {user_id}")
            
        except Exception as e:
            logger.error(f"Failed to log moderation event: {e}")
            self.db.rollback()
