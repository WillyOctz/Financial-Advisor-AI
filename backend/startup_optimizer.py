import logging
import gc
import torch
from typing import Optional

logger = logging.getLogger(__name__)

class StartupOptimizer:
    """Handles all startup initialization and optimization"""
    
    def __init__(self):
        self.initialized = False
        self.model_loaded = False
        
    async def initialize(self):
        """Run all startup optimizations"""
        if self.initialized:
            logger.info("Startup optimizer already initialized")
            return
        
        logger.info("Starting application optimization...")
        
        try:
            # 1. preload transformer model
            await self.preload_embedding_model()
            
            # 2. initial garbage collection
            self.optimize_memory()
            
            self.initialized = True
            logger.info("Model preloading complete")
            
        except Exception as e:
            logger.error(f"❌ Startup optimization failed: {e}")
            
    async def preload_embedding_model(self):
        """Preload SentenceTransformer into memory"""
        try:
            logger.info("Preloading SentenceTransformer model...")
            
            from backend.services.vector_search import VectorSearchService
            from backend.config.embedding_model_config import EmbeddingConfig
            
            config = EmbeddingConfig()
            model = VectorSearchService.get_model(config.MODEL_NAME.value)
            
            if model is not None:
                dim = model.get_sentence_embedding_dimension()
                device = "cuda" if torch.cuda.is_available() else "cpu"
                
                logger.info(f"Model preloaded: {config.MODEL_NAME.value}")
                logger.info(f"   - Embedding dimension: {dim}")
                logger.info(f"   - Device: {device}")
                
                self.model_loaded = True
            else:
                logger.warning("Model returned None")
                
        except Exception as e:
            logger.error(f"❌ Failed to preload model: {e}")
            
    def optimize_memory(self):
        """Quick memory optimization"""
        try:
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            logger.info("Memory optimized")
        except Exception as e:
            logger.warning(f"Memory optimization skipped: {e}")
            
    async def cleanup(self):
        """Cleanup on shutdown"""
        try:
            logger.info("Cleaning up resources...")
            
            # clear model if needed ONLY!
            gc.collect()
            
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                
            logger.info("✅ Cleanup complete")
            
        except Exception as e:
            logger.error(f"❌ Cleanup failed: {e}")
            
# global singleton instance
startup_optimizer = StartupOptimizer()

__all__ = ['startup_optimizer']

            
            