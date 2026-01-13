import os
from typing import Optional, Dict, Any
import google.generativeai as genai
import requests
import logging
from dotenv import load_dotenv
from enum import Enum

load_dotenv()

logger = logging.getLogger(__name__)

class LLMProvider(Enum):
    GEMINI = "gemini"
    HUGGINGFACE = "huggingface"


class LLMService:
    def __init__(self, primary_provider: LLMProvider = LLMProvider.GEMINI):
        self.primary_provider = primary_provider
        self.fallback_providers = [
            LLMProvider.HUGGINGFACE
        ]

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
        self.hf_api_key = os.getenv("HUGGINGFACE_API_KEY")

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
        elif provider == LLMProvider.HUGGINGFACE:
            return self._generate_huggingface(prompt, **kwargs)
        else:
            raise ValueError(f"Unsupported provider: {provider}")
        
    def _generate_gemini(self, prompt: str, **kwargs) -> str:
        """Generate with Gemini"""
        if not self.gemini_model:
            raise Exception("Gemini API key not configured")
        
        # Gemini uses different parameter names
        generation_config = {
            "max_output_tokens": kwargs.get('max_output_tokens', 1000),  # Changed from max_tokens
            "temperature": kwargs.get('temperature', 0.7),
        }
        
        filtered_kwargs = {}
        for k, v in kwargs.items():
            if k not in ['temperature', 'max_tokens', 'max_output_tokens', 'top_p', 'frequency_penalty', 'presence_penalty']:
                filtered_kwargs[k] = v

        response = self.gemini_model.generate_content(prompt, generation_config=generation_config, **filtered_kwargs)
        return response.text
    
    def _generate_huggingface(self, prompt: str, **kwargs) -> str:
        """Generate with Hugging Face"""
        if not self.hf_api_key:
            raise Exception("Hugging Face API key not configured")
    
        logger.info(f"🔍 Using Hugging Face Router API")
    
        # Router API endpoint format
        api_url = "https://huggingface.co/api"
        
    
        # Format prompt for Mistral instruct model
        formatted_prompt = f"<s>[INST] {prompt} [/INST]"
    
        headers = {
            "Authorization": f"Bearer {self.hf_api_key}",
            "Content-Type": "application/json"
        }
    
        # Router API payload format
        payload = {
            "model": "mistralai/Mistral-7B-Instruct-v0.1",
            "inputs": formatted_prompt,  
            "parameters": {
                "max_new_tokens": kwargs.get('max_tokens', 500),
                "temperature": kwargs.get('temperature', 0.7),
                "top_p": 0.95,
                "do_sample": True,
                "return_full_text": False
            }
        }
    
        try:
            logger.info(f"📤 Sending request to Router API")
            logger.info(f"📝 Model: {payload['model']}")
            logger.info(f"📝 Prompt length: {len(prompt)} chars")
        
            response = requests.post(api_url, headers=headers, json=payload, timeout=60)
        
            logger.info(f"📥 Response status: {response.status_code}")
            logger.info(f"📥 Response headers: {dict(response.headers)}")
        
            # Handle different status codes
            if response.status_code == 503:
                # Model is loading
                logger.warning("Model is loading, trying alternative model...")
                return self._try_alternative_hf_model(prompt, **kwargs)
        
            if response.status_code != 200:
                error_text = response.text[:200] if response.text else "No error text"
                logger.error(f"❌ API Error {response.status_code}: {error_text}")
            
                # Try to parse error message
                try:
                    error_data = response.json()
                    error_msg = error_data.get('error', str(error_data))
                    raise Exception(f"Hugging Face API error: {error_msg}")
                except:
                    raise Exception(f"Hugging Face API error {response.status_code}: {error_text}")
        
            # Parse the response
            try:
                result = response.json()
                logger.info(f"✅ Successfully parsed JSON response: {result.keys() if isinstance(result, dict) else type(result)}")
            except requests.exceptions.JSONDecodeError as json_err:
                logger.error(f"❌ JSON decode error: {json_err}")
                logger.error(f"❌ Raw response: {response.text[:500]}")
                raise Exception(f"Invalid JSON response: {response.text[:100]}")
        
            # Extract text from response
            generated_text = self._extract_text_from_hf_response(result)
        
            if not generated_text:
                logger.error(f"❌ No text extracted from response: {result}")
                raise Exception("No generated text in response")
        
            logger.info(f"✅ Generated {len(generated_text)} characters")
            return generated_text.strip()
        
        except requests.exceptions.Timeout:
            logger.error("❌ Request timeout")
            raise Exception("Hugging Face API timeout. Please try again.")
        except Exception as e:
            logger.error(f"❌ Hugging Face error: {str(e)}")
            raise Exception(f"Hugging Face API error: {str(e)}")
        
    def _try_alternative_hf_model(self, prompt: str, **kwargs) -> str:
        """Try alternative models if primary is loading"""
        alternative_models = [
            "mistralai/Mixtral-8x7B-Instruct-v0.1",
            "HuggingFaceH4/zephyr-7b-beta",
            "meta-llama/Llama-2-7b-chat-hf",
            "google/flan-t5-xxl"
        ]
    
        for model_name in alternative_models:
            try:
                logger.info(f"🔄 Trying alternative model: {model_name}")
            
                # Different prompt formats for different models
                if "mistral" in model_name or "mixtral" in model_name:
                    formatted_prompt = f"<s>[INST] {prompt} [/INST]"
                elif "zephyr" in model_name or "llama" in model_name:
                    formatted_prompt = f"<|system|>\nYou are a helpful AI assistant.</s>\n<|user|>\n{prompt}</s>\n<|assistant|>"
                else:
                    formatted_prompt = prompt
            
                headers = {
                    "Authorization": f"Bearer {self.hf_api_key}",
                    "Content-Type": "application/json"
                }
            
                payload = {
                    "model": model_name,
                    "inputs": formatted_prompt,
                    "parameters": {
                        "max_new_tokens": kwargs.get('max_tokens', 500),
                        "temperature": kwargs.get('temperature', 0.7),
                        "top_p": 0.95,
                        "do_sample": True,
                        "return_full_text": False
                    }
                }
            
                response = requests.post(
                    "https://router.huggingface.co/hf-inference",
                    headers=headers,
                    json=payload,
                    timeout=30
                )
            
                if response.status_code == 200:
                    result = response.json()
                    text = self._extract_text_from_hf_response(result)
                    if text:
                        logger.info(f"✅ Success with model: {model_name}")
                        return text.strip()
            
            except Exception as e:
                logger.warning(f"❌ Model {model_name} failed: {e}")
                continue
    
        raise Exception("All Hugging Face models failed or are loading")
    
    def _extract_text_from_hf_response(self, result) -> str:
        """Extract text from various Hugging Face API response formats"""
        # Router API returns different formats
        if isinstance(result, list) and len(result) > 0:
            item = result[0]
            if isinstance(item, dict):
                # Router API format
                if 'generated_text' in item:
                    return item['generated_text']
                elif 'text' in item:
                    return item['text']
                # Try to find any string value
                for key, value in item.items():
                    if isinstance(value, str) and len(value) > 10:
                        return value
            return str(item)
        elif isinstance(result, dict):
            # Direct response format
            if 'generated_text' in result:
                return result['generated_text']
            elif 'text' in result:
                return result['text']
            elif 'output' in result:
                return result['output']
            # Router API might return nested structure
            elif 'response' in result:
                return result['response']
            # Try to find any string value
            for key, value in result.items():
                if isinstance(value, str) and len(value) > 10:
                    return value
        elif isinstance(result, str):
            return result
    
        # Last resort
        return str(result)
        
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