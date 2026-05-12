import os
from typing import Optional, Dict, Any
import google.generativeai as genai
import requests
import logging
from dotenv import load_dotenv
from enum import Enum
from backend.services.LLM_Content_Filter.prompt_templates import PromptTemplates

load_dotenv()

logger = logging.getLogger(__name__)

class LLMProvider(Enum):
    GEMINI = "gemini"
    GROQ = "groq"

class LLMService:
    def __init__(self, primary_provider: LLMProvider = LLMProvider.GEMINI):
        self.primary_provider = primary_provider
        self.fallback_providers = [
            LLMProvider.GROQ
        ]
        self.prompt_templates = PromptTemplates()

        # Initialize APi's
        self.__init__apis()

    def __init__apis(self):
        """Initialize all API clients"""
        # Gemini 
        gemini_key = os.getenv("GOOGLE_API_KEY")
        if gemini_key:
            genai.configure(api_key=gemini_key)
            self.gemini_model = genai.GenerativeModel('gemini-2.0-flash')
        else:
            self.gemini_model = None

        # Hugging face
        self.groq_api_key = os.getenv("GROQ_API_KEY")

    def generate_content(self, prompt: str, provider: Optional[LLMProvider] = None, **kwargs) -> str:
        """Generate content with fallback"""
        if provider:
            return self._generate_with_provider(prompt, provider, **kwargs)
        
        # Try primary provider first
        try:
            return self._generate_with_provider(prompt, self.primary_provider, **kwargs)
        except Exception as e:
            logger.warning(f"Primary provider {self.primary_provider} failed: {e}")

            # Try fallback providers
            for fallback in self.fallback_providers:
                try:
                    logger.info(f"Trying fallback provider: {fallback}")
                    return self._generate_with_provider(prompt, fallback, **kwargs)
                except Exception as fallback_error:
                    logger.warning(f"Fallback provider {fallback} failed: {fallback_error}")
                    continue

            raise Exception("All LLM providers failed")
        
    def _generate_with_provider(self, prompt: str, provider: LLMProvider, **kwargs) -> str:
        """Generate content with specific provider"""
        if provider == LLMProvider.GEMINI:
            return self._generate_gemini(prompt, **kwargs)
        elif provider == LLMProvider.GROQ:
            return self._generate_groq(prompt, **kwargs)
        else:
            raise ValueError(f"Unsupported provider: {provider}")
        
    def _generate_gemini(self, prompt: str, **kwargs) -> str:
        """Generate with Gemini"""
        if not self.gemini_model:
            raise Exception("Gemini API key not configured")
        
        # Gemini uses different parameter names
        generation_config = {
            "max_output_tokens": kwargs.get('max_output_tokens', 1000),  
            "temperature": kwargs.get('temperature', 0.7),
        }
        
        filtered_kwargs = {}
        for k, v in kwargs.items():
            if k not in ['temperature', 'max_tokens', 'max_output_tokens', 'top_p', 'frequency_penalty', 'presence_penalty']:
                filtered_kwargs[k] = v

        response = self.gemini_model.generate_content(prompt, generation_config=generation_config, **filtered_kwargs)
        return response.text
    
    def _generate_groq(self, prompt: str, **kwargs) -> str:
        """Generate with Hugging Face"""
        if not self.groq_api_key:
            raise Exception("Hugging Face API key not configured")
    
        headers = {
            "Authorization": f"Bearer {self.groq_api_key}",
            "Content-Type": "application/json"
        }
        
        # use the professional financial advisor system prompt
        system_prompt = self.prompt_templates.FINANCIAL_ADVISOR_SYSTEM_PROMPT
        
        payload = {
            "model": "llama-3.3-70b-versatile",  
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "max_tokens": kwargs.get('max_tokens', kwargs.get('max_output_tokens', 1000)),
            "temperature": kwargs.get('temperature', 0.7),
        }
        
        try:
            logger.info("Sending request to Groq API (llama-3.3-70b-versatile)")
            response = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 429:
                # rate is limited
                logger.warning("Groq rate limited, trying mixtral fallback model")
                payload["model"] = "mixtral-8x7b-32768"
                response = requests.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=30
                )
                
            if response.status_code != 200:
                error_text = response.text[:200] if response.text else "No error text"
                raise Exception(f"Groq API error {response.status_code}: {error_text}")
            
            result = response.json()
            generated_text = result["choices"][0]["message"]["content"]
            
            if not generated_text:
                raise Exception("No generated text in Groq response")
            
            logger.info(f"Groq generated {len(generated_text)} characters successfully")
            return generated_text.strip()
        
        except requests.exceptions.Timeout:
            raise Exception("Groq API timeout. Please try again.")
        except KeyError as e:
            raise Exception(f"Unexpected Groq response format: {e}")
        except Exception as e:
            logger.error(f"Groq error: {str(e)}")
            raise
        
    def generate_structured_content(self, prompt: str, provider: Optional[LLMProvider] = None, **kwargs) -> Dict[str, Any]:
        """Generate content and also return metadata"""
        try:
            response_text = self.generate_content(prompt, provider, **kwargs)

            return {
                "text": response_text,
                "provider_used": provider.value if provider else self.primary_provider.value,
                "success": True
            }
        except Exception as e:
            logger.error(f"LLM generation failed: {e}")
            return {
                "text": f"Unable to generate response. Error: {str(e)}",
                "provider_used": "none",
                "success": False,
                "error": str(e)
            }