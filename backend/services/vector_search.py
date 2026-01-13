import numpy as np
from typing import List, Dict, Any, Optional
from sentence_transformers import SentenceTransformer
import torch
from sqlalchemy.orm import Session
from backend.models.database import DocumentChunk, FinancialDocument
from backend.db.redis_client import cache_embeddings, get_cached_embeddings, cache, cache_metrics, cached
import google.generativeai as genai
from backend.config.cache_config import get_ttl
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)

class VectorSearchService:
    def __init__(self, db: Session, model_name: str = "all-MiniLM-L6-v2"):
        self.db = db
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
        # Load the model
        logger.info(f"Loading SentenceTransformer model: {model_name} on {self.device}")
        self.model = SentenceTransformer(model_name, device=self.device)
        
        # Model configuration
        self.embedding_dim = self.model.get_sentence_embedding_dimension()
        logger.info(f"Model loaded. Embedding dimension: {self.embedding_dim}")

    @cached(category='embeddings', ttl=get_ttl('embeddings'))
    def generate_embeddings(self, texts: List[str], batch_size: int = 32) -> List[List[float]]:
        """Generate embeddings using SentenceTransformer Huggingface"""
        try:
            # Check cache first
            cached_embeddings = []
            texts_to_encode = []
            text_to_index = {}
            
            for idx, text in enumerate(texts):
                cache_key = f"embedding:text:{hash(text)}"
                cached = cache.get('embeddings', cache_key)
                
                if cached:
                    cached_embeddings.append(cached)
                    cache_metrics.record_hit()
                    
                else:
                    texts_to_encode.append(text)
                    text_to_index[text] = idx
                    cached_embeddings.append(None)
                    cache_metrics.record_miss()
                
            # Generating embeddings for uncached texts    
            if texts_to_encode:
                logger.info(f"Generating embeddings for {len(texts_to_encode)} texts")
                
                embeddings = []
                for i in range(0, len(texts_to_encode), batch_size):
                    batch = texts_to_encode[i:i + batch_size]
                    batch_embeddings = self.model.encode(
                        batch,
                        convert_to_numpy=True,
                        normalize_embeddings=True,
                        show_progress_bar=False
                    )
                    embeddings.extend(batch_embeddings.tolist())
                    
                # Cache the newly embedded text
                for text, embedding in zip(texts_to_encode, embeddings):
                    cache_key = f"embedding:text:{hash(text)}"
                    cache.set('embeddings', cache_key, embedding, timedelta(days=7))
                    
                # insert the embeddings into final list
                for text, embedding in zip(texts_to_encode, embeddings):
                    idx = text_to_index[text]
                    cached_embeddings[idx] = embedding
                    
            return cached_embeddings
        
        except Exception as e:
            logger.error(f"Error generating embeddings: {e}")
            return self.fallback_embeddings(texts)
        
    def fallback_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Fallback method by using simple TF-IDF approach"""
        embeddings = []
        for text in texts:
            words = text.lower().split()
            embedding = [words.count(word) for word in set(words)]
            if embedding:
                norm = np.linalg.norm(embedding)
                if norm > 0:
                    embedding = [x / norm for x in embedding]
            embeddings.append(embedding)
        return embeddings

    @cached(category='vector_search', ttl=get_ttl('vector_search'))
    def search_similar_transactions(self, query: str, user_id: int, top_k: int = 10, similarity_threshold: float = 0.7) -> List[Dict[str, Any]]:
        """Search for similar document transactions through semantic search"""
        try:
            # Generate the query embedding
            query_embedding = self.generate_embeddings([query])[0]
            
            # Get all chunks for user
            chunks = self.db.query(DocumentChunk).join(
                FinancialDocument, DocumentChunk.document_id == FinancialDocument.id
            ).filter(
                FinancialDocument.user_id == user_id,
                DocumentChunk.chunk_text.isnot(None)
            ).all()
            
            if not chunks:
                return []
            
            # Get or generate chunk embeddings
            chunk_texts = [chunk.chunk_text for chunk in chunks]
            chunk_embeddings = self.generate_embeddings(chunk_texts)
            
            # Calculate similarities
            results = []
            for chunk, embedding in zip(chunks, chunk_embeddings):
                if embedding is None:
                    continue
                
                similarity = self.cosine_similarity(query_embedding, embedding)
                
                if similarity >= similarity_threshold:
                    results.append({
                        "chunk_id": chunk.id,
                        "similarity_score": float(similarity),
                        "chunk_text": chunk.chunk_text[:300],
                        "full_text": chunk.chunk_text,
                        "metadata": chunk.chunk_metadata,
                        "document_id": chunk.document_id,
                        "transaction_date": chunk.chunk_metadata.get("date"),
                        "amount": chunk.chunk_metadata.get("amount"),
                        "category": chunk.chunk_metadata.get("category")
                    })
            # sort then return the top results
            results.sort(key=lambda x: x['similarity_score'], reverse=True)
            return results[:top_k]
        
        except Exception as e:
            logger.error(f"Error in semantic search: {e}")
            return []
        
    def cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate the cosine similarity between vectors"""
        if not vec1 and vec2:
            return 0.0
        
        # Ensure that both vector lengths are similar
        vec1_np = np.array(vec1, dtype=np.float32)
        vec2_np = np.array(vec2, dtype=np.float32)
        
        # pad or truncate to same dimension
        if len(vec1_np) != len(vec2_np):
            target_len = max(len(vec1_np), len(vec2_np))
            vec1_np = np.pad(vec1_np, (0, target_len - len(vec1_np)))
            vec2_np = np.pad(vec2_np, (0, target_len - len(vec2_np)))
            
        # Calculate the cosine similarity
        dot_product = np.dot(vec1_np, vec2_np)
        norm1 = np.linalg.norm(vec1_np)
        norm2 = np.linalg.norm(vec2_np)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return float(dot_product / (norm1 * norm2))
    
    def batch_process_transactions(
        self,
        transactions: List[Dict[str, Any]],
        generate_summaries: bool = True
    ) -> Dict[str, Any]:
        """Process multiple transactions with semantic analysis"""
        try:
            # Extract transactions description
            descriptions = []
            for txn in transactions:
                desc = f"Transaction on {txn.get('date')}: {txn.get('description')} "
                desc += f"Amount: ${txn.get('amount'):.2f} Category: {txn.get('category', 'Uncategorized')}"
                
                descriptions.append(desc)
                
            # generate embeddings in batch
            embeddings = self.generate_embeddings(descriptions)
            
            # Find similar transactions within batch 
            similar_groups = self.cluster_similar_transactions(embeddings, transactions)
            
            # Generate semantic summaries 
            summaries = {}
            if generate_summaries:
                summaries = self.generate_semantic_summaries(similar_groups)
                
            return {
                "embeddings": embeddings,
                "similar_groups": similar_groups,
                "summaries": summaries,
                "total_transactions": len(transactions)
            }
        
        except Exception as e:
            logger.error(f"Error in batch processing: {e}")
            return {"error": str(e)}
        
    def cluster_similar_transactions(
        self,
        embeddings: List[List[float]],
        transactions: List[Dict[str, Any]]
    ) -> Dict[str, List[int]]:
        """Group similar transactions using embeddings"""
        
        if len(embeddings) < 2:
            return {}
        
        # Simple clustering based similarity threshold
        clusters = {}
        visited = set()
        
        for i, emb_i in enumerate(embeddings):
            if i in visited:
                continue
            
            cluster = [i]
            visited.add(i)
            
            for j, emb_j in enumerate(embeddings[i+1:], start=i+1):
                if j in visited:
                    continue
                
                similarity = self.cosine_similarity(emb_i, emb_j)
                if similarity > 0.8:
                    cluster.append(j)
                    visited.add(j)
                    
            if len(cluster) > 1:
                cluster_name = f"group_{len(clusters)}"
                clusters[cluster_name] = cluster
                
        return clusters
    
    def generate_semantic_summaries(self, clusters: Dict[str, List[int]]) -> Dict[str, str]:
        """Generate summaries for clusters"""
        summaries = {}
        
        for cluster_name, indices in clusters.items():
            # could use LLM here but right now its simplified
            
            summary = f"Group of {len(indices)} similar transactions"
            summaries[cluster_name] = summary
        
        return summaries

    def invalidate_chunk_cache(self, chunk_id: int) -> bool:
        """Invalidate cache for a specific chunk"""
        try:
            # Invalidate chunk embedding
            cache.delete('embeddings', f"chunk:{chunk_id}")

            # Invalidate text-based embedding cache if exists
            chunk = self.db.query(DocumentChunk).filter(DocumentChunk.id == chunk_id).first()
            if chunk and chunk.chunk_text:
                text_hash = hash(chunk.chunk_text)
                cache.delete('embeddings', f"text:{text_hash}")

            logger.info(f"🗑️ Invalidated cache for chunk {chunk_id}")
            return True
        
        except Exception as e:
            logger.error(f"❌ Failed to invalidate chunk cache: {e}")
            return False
    