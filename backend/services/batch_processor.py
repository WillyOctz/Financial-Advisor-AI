from typing import List, Dict, Any, Generator
import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from backend.models.database import FinancialDocument, Transaction, DocumentChunk
from sqlalchemy.dialects.postgresql import insert
from backend.db.redis_client import cache
from backend.services.vector_search import VectorSearchService
from concurrent.futures import ThreadPoolExecutor, as_completed
import asyncio
from datetime import datetime
import time
import logging

logger = logging.getLogger(__name__)

class BatchProcessor:
    def __init__(self, db: Session, batch_size: int = 1000):
        self.db = db
        self.batch_size = batch_size

    def process_transactions_batch(self, transactions_data: List[Dict]) -> int:
        """Batch insert transactions with conflict handling"""
        if not transactions_data:
            return 0
        
        processed = 0
        for i in range(0, len(transactions_data), self.batch_size):
            batch = transactions_data[i:i + self.batch_size]

            try:
                # Use bulk insert with conflict handling
                stmt = insert(Transaction).values(batch)

                # Handle conflicts on unique constraints
                stmt = stmt.on_conflict_do_update(
                    constraint='uq_transaction_identifier', # hypothetical unique constraint
                    set_={
                        'amount': stmt.excluded.amount,
                        'category': stmt.excluded.category,
                        'updated_at': datetime.now()
                    } 
                )

                self.db.execute(stmt)
                self.db.commit()

                processed += len(batch)
                logger.info(f"✅ Processed batch {i//self.batch_size + 1}: {len(batch)} transactions")

            except Exception as e:
                self.db.rollback()
                logger.error(f"❌ Batch insert failed: {e}")
                # Fallback to individual inserts for failed batch
                processed += self._insert_individual(batch)

        return processed
    
    def _insert_individual(self, batch: List[Dict]) -> int:
        """Fallback: Insert transactions individually"""
        processed = 0
        for transaction in batch:
            try:
                stmt = insert(Transaction).values(transaction)
                self.db.execute(stmt)
                processed += 1
            except Exception as e:
                logger.warning(f"⚠️ Failed to insert transaction: {e}")

        try:
            self.db.commit()
        except Exception as e:
            logger.error(f"❌ Commit failed: {e}")
            self.db.rollback()
            return 0
        
        return processed
    
    def chunk_documents_batch(self, df: pd.DataFrame, document_id: int) -> Generator[List[Dict], None, None]:
        """Batch chunk document with parallel processing"""
        # Split dataframe into chunks for parallel processing
        num_chunks = (len(df) + self.batch_size - 1) // self.batch_size

        for chunk_num in range(num_chunks):
            start_idx = chunk_num * self.batch_size
            end_idx = min((chunk_num + 1) * self.batch_size, len(df))

            chunk_df = df.iloc[start_idx:end_idx]
            yield self._process_chunk(chunk_df, document_id, chunk_num)

    def _process_chunk(self, chunk_df: pd.DataFrame, document_id: int, chunk_num: int) -> List[Dict]:
        """Process a single chunk into document chunks"""
        chunks = []

        for idx, row in chunk_df.iterrows():
            # Create semantic chunk
            chunk_text = self._create_transaction_text(row)

            chunks.append({
                'document_id': document_id,
                'chunk_text': chunk_text,
                'chunk_index': chunk_num * self.batch_size + idx,
                'chunk_metadata': {
                    'row_index': idx,
                    'batch_number': chunk_num,
                    'total_rows': len(chunk_df),
                    'processed_at': datetime.now().isoformat()
                }
            })
        
        return chunks
    
    def _create_transaction_text(self, row: pd.Series) -> str:
        """Create comprehensive transaction text for embedding"""

        transaction_info = []

        # Basic transaction details
        basic_details = []

        # Data handling
        for col in row.index:
            if 'date' == str(col).lower() and pd.notna(row[col]):
                try:
                    if isinstance(row[col], (pd.Timestamp, datetime)):
                        basic_details.append(f"on {row[col].strftime('%Y-%m-%d')}")
                    elif isinstance(row[col], str):
                        basic_details.append(f"on {row[col][:10]}")

                except:
                    pass
                break

        # Amount handling
        for col in row.index:
            if 'amount' in str(col).lower() and pd.notna(row[col]):
                try:
                    amount = float(row[col])
                    basic_details.append(f"for ${abs(amount):,.2f}")
                    if amount < 0:
                        basic_details.append("(expense)")
                    else:
                        basic_details.append("(income)")

                except:
                    pass
                break

        if basic_details:
            transaction_info.append("Transaction " + " ".join(basic_details))

        # 2. Description and merchant
        merchant_info = []
        for col in row.index:
            col_lower = str(col).lower()
            if any(keyword in col_lower for keyword in ['desc', 'merchant', 'vendor', 'store', 'name']):
                if pd.notna(row[col]):
                    desc = str(row[col]).strip()
                    if desc and desc.lower() != 'nan':
                        merchant_info.append(f"at/in {desc}")
                        break

        # 3. Category/Type information
        category_info = []
        for col in row.index:
            col_lower = str(col).lower()
            if any(keyword in col_lower for keyword in ['category', 'type', 'class', 'group']):
                if pd.notna(row[col]):
                    category = str(row[col]).strip()
                    if category and category.lower() != 'nan':
                        category_info.append(f"categorized as {category}")
                        break

        # 4. Additional metadata (paymentmethod, location, etc)
        metadata = []
        for col in row.index:
            col_lower = str(col).lower()
            # Skip already used columns
            if any(keyword in col_lower for keyword in ['date', 'amount', 'desc', 'merchant', 'category', 'type']):
                continue

            if pd.notna(row[col]):
                value = str(row[col]).strip()
                if value and value.lower() != 'nan':
                    # Format column name nicely
                    col_name = str(col).replace('_', ' ').title()

                    # Handle special metadata
                    if any(keyword in col_lower for keyword in ['payment', 'method', 'card']):
                        metadata.append(f"paid with {value}")
                    elif any(keyword in col_lower for keyword in ['location', 'city', 'state']):
                        metadata.append(f"location: {value}")
                    elif any(keyword in col_lower for keyword in ['reference', 'id', 'number']):
                        metadata.append(f"reference: {value}")
                    elif len(value) < 30: # Only add short values
                        metadata.append(f"{col_name}: {value}")

                    if len(metadata) >= 2:
                        break

        # Combine all parts
        all_parts = transaction_info + merchant_info + category_info + metadata

        if all_parts:
            # Format as a coherent paragraph
            text = all_parts[0]
            if len(all_parts) > 1:
                text += ". " + ". ".join(all_parts[1:]) + "."
            
            return text
        
        else:
            # Fallback : structured representation
            non_null_items = []
            for col in row.index:
                if pd.notna(row[col]):
                    value = str(row[col]).strip()
                    if value and value.lower() != 'nan':
                        non_null_items.append(f"{col}: {value[:50]}")

            if non_null_items:
                return " | ".join(non_null_items[:5])
            else:
                return "Empty transaction record"

    def generate_embeddings_batch(self, texts: List[str], batch_size: int = 50) -> List[List[float]]:
        """Generate embeddings in batches"""
        embeddings = []
        vector_service = VectorSearchService(self.db)

        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i + batch_size]

            # Generate embeddings for each text
            batch_embeddings = []
            for text in batch_texts:
                try:
                    embedding = vector_service.generate_embeddings(text)
                    batch_embeddings.append(embedding)
                except Exception as e:
                    print(f"⚠️ Failed to generate embedding: {e}")
                    # Add zero as fallback
                    batch_embeddings.append([0.0] * 128) # size can be adjusted

            embeddings.extend(batch_embeddings)

            # Progress logging
            if (i // batch_size) % 10 == 0:
                print(f"📊 Generated embeddings for {i + len(batch_texts)}/{len(texts)} texts")

            # Small delay to avoid overwhelming the system
            if i + batch_size < len(texts):
                time.sleep(0.05)
            
        return embeddings
    
    def _generate_single_embedding(self, text: str) -> List[float]:
        """Generate embedding for single text"""
        # This should be replaced with actual embedding model
        # For now, using simple TF-IDF approach from your vector_search
        vector_service = VectorSearchService(self.db)
        return vector_service.generate_embeddings(text)
    
    def store_embeddings_batch(self, chunks: List[Dict], embeddings: List[List[float]]) -> bool:
        """Store embeddings in batches with Redis cache"""

        try:
            # Prepare cache items
            cache_items = []
            for chunk, embedding in zip(chunks, embeddings):
                cache_key = f"embedding:{chunk['document_id']}: {chunk['chunk_index']}"
                cache_items.append(('embeddings', cache_key, embedding))

            # Batch cache embeddings
            if cache_items:
                cache.batch_set(cache_items)

            # Store in database as well
            self._store_embeddings_db(chunks, embeddings)

            return True
        
        except Exception as e:
            logger.error(f"❌ Failed to store embeddings: {e}")
            return False
        
    def _store_embeddings_db(self, chunks: List[Dict], embeddings: List[List[float]]):
        """Store embeddings in database"""
        try:
            for i, chunk in enumerate(chunks):
                chunk_obj = DocumentChunk(
                    document_id=chunk['document_id'],
                    chunk_text=chunk['chunk_text'],
                    chunk_index=chunk['chunk_index'],
                    chunk_metadata=chunk['chunk_metadata'],
                    embeddings=embeddings[i] if i < len(embeddings) else None
                )
                self.db.add(chunk_obj)

            self.db.commit()
            logger.info(f"✅ Stored {len(chunks)} embeddings in database")

        except Exception as e:
            self.db.rollback()
            logger.error(f"❌ Failed to store embeddings in DB: {e}")
            raise

class UpgradedBatchProcessor(BatchProcessor):
    def __init__(self, db: Session, batch_size: int = 1000):
        super().__init__(db, batch_size)
        self.vector_service = VectorSearchService(db)
        
    def generate_embeddings_batch(self, texts: List[str], batch_size: int = 50) -> List[List[float]]:
        """Generate the embeddings process using upgraded vector_search.py file using sentence transformer"""
        logger.info(f"Generating embeddings for {len(texts)} texts")
        
        try:
            embeddings = self.vector_service.generate_embeddings(texts, batch_size=batch_size)
            logger.info(f"✅ Generated {len(embeddings)} embeddings")
            
            return embeddings
        except Exception as e:
            logger.error(f"Failed to generate embeddings: {e}")
            # Fallback to existing method
            return super().generate_embeddings_batch(texts, batch_size)
            