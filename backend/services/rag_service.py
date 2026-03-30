from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from backend.services.vector_search import VectorSearchService
import google.generativeai as genai
import os
from backend.services.llm_services import LLMService, LLMProvider
from dotenv import load_dotenv
import logging

load_dotenv()

logger = logging.getLogger(__name__)

class RAGService:
    def __init__(self, db: Session):
        self.db = db
        self.vector_search = VectorSearchService(db)
        self.llm_service = LLMService(primary_provider=LLMProvider.GEMINI)
        self.current_provider = LLMProvider.GEMINI # to track which current provider is used

    def generate_contextual_advice(self, user_id: int, query: str, financial_context: str) -> Tuple[str, List[str], List[str], str]:
        """Generate AI advice using RAG along with fallback LLM support"""
        try:
            # Search for relevant document chunks
            relevant_chunks = self.vector_search.search_similar_transactions(query, user_id)

            logger.info(f"Found {len(relevant_chunks)} relevant chunks for RAG")

            # Build context from relevant chunks
            context_text = ""
            if relevant_chunks:
                context_text = "RELEVANT HISTORICAL TRANSACTION DATA:\n"
                for i, chunk in enumerate(relevant_chunks[:3]): # limit to 3
                    context_text += f"\n--- Chunk {i+1} (Relevance: {chunk['similarity_score']:.2f}) ---\n"
                    context_text += f"{chunk['chunk_text']}\n"

            else:
                context_text = 'No specific transaction data available for semantic search'
                logger.info("No relevant chunks found, using fallback context")

            # Build the enhanced prompt
            prompt = self._build_financial_prompt(financial_context, context_text, query)

            # Generate response with fallback support
            response_data = self._generate_llm_response(prompt)

            # Extract the advice text
            advice_text = response_data.get("text", "")
            provider_used = response_data.get("provider_used", "unknown")

            # Extract insights and recommendations
            insights, recommendations = self._extract_structured_insights(advice_text)

            # Log which provider was used
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
        
    def _build_financial_prompt(self, financial_context: str, context_text: str, query: str) -> str:
        """Build the financial advice prompt"""
        return f"""
        ROLE: You are a certified financial advisor with expertise in personal finance, budgeting, and investment strategies.

        USER'S FINANCIAL CONTEXT:
        {financial_context}

        {context_text}

        USER'S SPECIFIC QUESTION OR REQUEST:
        "{query}"

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
        """
    
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
        
    def _extract_structured_insights(self, text: str) -> Tuple[List[str], List[str]]:
        """Enhanced insight extraction using pattern recognition"""
        insights = []
        recommendations = []

        # Split into sections if they exist
        sections = text.split('\n\n')

        for section in sections:
            section_lower = section.lower()

            # Extract insights (patterns, trends, observations)
            if any(keyword in section_lower for keyword in ['insight:', 'observation:', 'pattern:', 'trend:', 'noticed that', 'analysis shows']):
                # Split into sentences and clean
                sentences = [s.strip() for s in section.split('.') if s.strip()]
                for sentence in sentences[:3]: # Take only 3 insights
                    if any(keyword in sentence.lower() for keyword in ['spending', 'income', 'saving', 'pattern', 'trend', 'high', 'low', 'increasing', 'decreasing']):
                        insights.append(sentence.strip())

            # Extract recommendations (action items)
            elif any(keyword in section_lower for keyword in ['recommendation:', 'suggestion:', 'advise:', 'should', 'consider', 'try to', 'action:', 'next steps']):
                # this process look for bullet points or numbered lists
                lines = section.split('\n')
                for line in lines:
                    line_lower = line.lower()
                    if any(keyword in line_lower for keyword in ['start', 'stop', 'increase', 'decrease', 'reduce', 'optimize', 'invest', 'save']):
                        # Clean the line
                        clean_line = line.strip()
                        if clean_line.startswith(('- ', '* ', '• ', '1.', '2.', '3.')):
                            clean_line = clean_line[2:].strip()
                        recommendations.append(clean_line)

        # if no structured insights found, fallback
        if not insights:
            sentences = [s.strip() for s in text.split('.') if s.strip()]
            insights = [sentences[i] for i in range(min(2, len(sentences))) if len(sentences[i]) > 10]

        if not recommendations:
            sentences = [s.strip() for s in text.split('.') if s.strip()]
            # Look for action-oriented sentences
            action_sentences = [s for s in sentences if any(word in s.lower() for word in ['you should', 'try to', 'consider', 'we recommend', 'it would be', 'would help'])]
            recommendations = action_sentences[:2]

        # Ensure not to return empty lists if above won't work
        if not insights:
            insights = ["Analyze specific spending patterns to identify optimization opportunities."]

        if not recommendations:
            recommendations = ["Review monthly expenses and create a detailed budget."]

        return insights[:3], recommendations[:2]
    
    def get_current_provider(self) -> str:
        """Get the currently active LLM provider"""
        return self.current_provider.value