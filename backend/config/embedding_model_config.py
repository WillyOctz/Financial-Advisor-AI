from enum import Enum
from typing import Optional
from dataclasses import dataclass
import torch

class EmbeddingModel(str, Enum):
    MINILM = "all-MiniLM-L6-v2" # 384 dimensions, 22mb
    MPNET = "all-mpnet-base-v2" # 768 dimensions, 420mb
    MULTILINGUAL = "paraphrase-multilingual-MiniLM-L12-v2" # For non-english document
    FINANCIAL_BERT = "ProsusAI/finbert"
    
@dataclass
class EmbeddingConfig:
    MODEL_NAME: EmbeddingModel = EmbeddingModel.MINILM
    BATCH_SIZE: int = 64
    DEVICE: str = "cuda" if torch.cuda.is_available() else "cpu"
    CACHE_TTL_HOURS: int = 24
    SIMILARITY_THRESHOLD: float = 0.75
    MAX_SEQ_LENGTH: int = 256
    
    # Performance tuning
    USE_FP16: bool = True
    PRELOAD_MODEL: bool = True
    ENABLE_QUANTIZATION: bool = False
    
    # Cache settings
    EMBEDDING_CACHE_SIZE: int = 10000
    ENABLE_SIMILARITY_CACHE: bool = True
    
    