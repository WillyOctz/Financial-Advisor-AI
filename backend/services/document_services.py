import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from backend.models.database import FinancialDocument, Transaction, DocumentChunk, ExtractedTransactions
from backend.models.schemas import TransactionCreate, ChunkCreate
from backend.services.batch_processor import BatchProcessor
from backend.db.redis_client import RedisCache, cached
from backend.features_enginering.features import categorize_transaction
from typing import List, Tuple, Optional, Dict, Any
import hashlib
from datetime import datetime, timedelta
import os
import openpyxl
import traceback
import re
from collections import defaultdict
import json
import logging

logger = logging.getLogger(__name__)

class DocumentService:
    def __init__(self, db: Session):
        self.db = db

    def _read_dataframe(self, file_path: str) -> pd.DataFrame:
        """Method to unify to read CSV or Excel files"""
        try:
            print(f"📖 Reading file: {file_path}")

            if file_path.endswith('.csv'):
                # Try different encodings for CSV
                for encoding in ['utf-8', 'latin-1', 'iso-8859-1', 'cp1252']:
                    try:
                        df = pd.read_csv(file_path, encoding=encoding)
                        print(f"✅ CSV read with {encoding} encoding")
                        return df
                    except UnicodeDecodeError:
                        continue

                return pd.read_csv(file_path, engine='python', on_bad_lines='skip')
            
            elif file_path.endswith('.xlsx') | file_path.endswith('.xls'):
                # Try with pandas first
                try:
                    excel_file = pd.ExcelFile(file_path, engine='openpyxl')
                    sheet_names = excel_file.sheet_names
                    print(f"📄 Excel sheets found: {sheet_names}")

                    # Try each sheet to find data
                    for sheet in sheet_names:
                        try:
                            df = pd.read_excel(file_path, sheet_name=sheet, engine='openpyxl')
                            if not df.empty and len(df.columns) > 1:
                                print(f"✅ Found data in sheet: '{sheet}' with {len(df)} rows")
                                return df
                        except Exception as e:
                            print(f"⚠️ Could not read sheet '{sheet}': {e}")
                            continue

                    # If all sheets failed, try openpyxl directly
                    print(f"🔄 Trying openpyxl direct reading...")
                    workbook = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
                    sheet = workbook.active
                    data = sheet.values
                    cols = next(data)
                    df = pd.DataFrame(data, columns=cols)
                    print(f"✅ Openpyxl loaded {len(df)} rows")
                    return df
                
                except Exception as e:
                    print(f"❌ Excel read failed: {e}")
                    raise
        except Exception as e:
            print(f"❌ Failed to read file: {e}")
            raise

    def extract_transactions(self, file_path: str, user_id: int, document_id: int, column_mapping: dict) -> List[Transaction]:
        """Extract transactions from uploaded document with proper column mapping and template support"""
        try:
            # Read the file
            df = self._read_dataframe(file_path)
            print(f"📊 File loaded: {len(df)} rows, {len(df.columns)} columns")
            print(f"🔧 Column mapping: {column_mapping}")

            # convert column names to lowercase for matching
            df.columns = [str(col).strip().lower() for col in df.columns]

            # find mapped columns
            date_col = self._find_best_column_match(df.columns, column_mapping.get('date', 'date'))
            desc_col = self._find_best_column_match(df.columns, column_mapping.get('description', 'description'))
            amount_col = self._find_best_column_match(df.columns, column_mapping.get('amount', 'amount'))
            type_col = self._find_best_column_match(df.columns, column_mapping.get('type', 'type'))

            transactions = []
            successfull_rows = 0
            skipped_rows = 0

            # Process each row
            for index, row in df.iterrows():
                try:
                    # Skip if amount is empty
                    if pd.isna(row.get(amount_col)):
                        skipped_rows += 1
                        continue

                    # parse amount
                    amount_raw = row[amount_col]

                    # Convert to string if not already
                    if not isinstance(amount_raw, str):
                        amount_str = str(amount_raw)
                    else:
                        amount_str = amount_raw

                    # Clean the amount string
                    amount_str = amount_str.replace('$', '').replace(',', '').replace(' ', '').strip()

                    # Handle negative amounts (expenses might be negative)
                    is_negative = amount_str.startswith('-') or amount_str.startswith('(')
                    if is_negative:
                        amount_str = amount_str.replace('-', '').replace('(', '').replace(')', '')

                    # Convert to numeric
                    amount = pd.to_numeric(amount_str, errors='coerce')

                    if pd.isna(amount):
                        print(f"⚠️ Row {index}: Skipping - Could not parse amount: '{amount_raw}' -> '{amount_str}'")
                        skipped_rows += 1
                        continue

                    # Restore negative sign if needed
                    if is_negative:
                        amount = -amount

                    # parse date
                    date = self._parse_date(row.get(date_col, ''))
                    if pd.isna(date):
                        skipped_rows += 1
                        continue

                    # Get description and type
                    description = str(row.get(desc_col, '')).strip() or "Unknown Transactions"
                    type_value = str(row.get(type_col, '')).strip()

                    # Determine transaction type
                    transaction_type = self._determine_transaction_type(type_value, amount, description)

                    # Caegorize transaction
                    category = categorize_transaction(description, self.db)

                    # Create transaction record
                    transaction_data = {
                        "document_id": document_id,
                        "user_id": user_id,
                        "date": date,
                        "description": description,
                        "amount": float(amount),
                        "type": transaction_type,
                        "category": category
                    }

                    db_transaction = Transaction(**transaction_data)
                    db_transaction.month = db_transaction.date.strftime('%Y-%m')
                    self.db.add(db_transaction)
                    transactions.append(db_transaction)
                    successfull_rows += 1

                    if successfull_rows % 10 == 0:
                        print(f"📝 Processed {successfull_rows} transactions...")

                except Exception as e:
                    print(f"⚠️ Skipping row {index}: {e}")
                    skipped_rows += 1
                    continue

            self.db.commit()
            print(f"✅ Successfully processed {successfull_rows} transactions, skipped {skipped_rows}")

            return transactions
        except Exception as e:
            self.db.rollback()
            print(f"❌ Error in extract_transactions: {e}")
            raise
        
    def _find_best_column_match(self, available_columns: List[str], target_column: str) -> str:
        """Find the best matching column name for template compatibility"""
        target_lower = target_column.lower()
        available_lower = [col.lower().strip() for col in available_columns]

        # if exact match exists
        if target_lower in available_columns:
            index = available_lower.index(target_lower)
            return available_columns[index]
        
        # Partial matches
        for i, col in enumerate(available_columns):
            col_lower = col.lower()
            if (target_lower in col_lower or 
                col_lower in target_lower or
                any(word in col_lower for word in target_lower.split()) and 
                any(word in target_lower for word in col_lower.split())):
                return available_columns[i]
            
        # Return first column as fallback
        return available_columns[0] if available_columns else target_column
    
    def _parse_date(self, date_value) -> pd.Timestamp:
        """Enhanced date parsing for various template formats"""
        if pd.isna(date_value):
            return pd.NaT

        try:
            # Handle various date formats
            if isinstance(date_value, (datetime, pd.Timestamp)):
                return pd.Timestamp(date_value)
            
            # Handle strings
            if isinstance(date_value, str):
                date_value = date_value.strip()
                # Remove time component if present
                date_value = date_value.split(' ')[0].split('T')[0]

            return pd.to_datetime(date_value, errors='coerce', dayfirst=False)
        except:
            return pd.NaT
        
    def chunk_document(self, file_path: str, document_id: int, chunk_size: int = 1000) -> List[DocumentChunk]:
        """Chunk document for RAG processing"""
        try:
            print(f"📄 Starting advanced document chunking...")

            # Read file
            df = self._read_dataframe(file_path)

            if df.empty:
                print("⚠️ DataFrame is empty")
                return []
            
            print(f"📊 Processing {len(df)} rows for chunking")

            chunks = []

            # Method 1 : Group by semantic units (e.g., months, categories)
            text_chunks = self._create_semantic_chunks(df, chunk_size)

            # Method 2 : Create summary chunks
            summary_chunks = self._create_summary_chunks(df, chunk_size)

            # Combine strategies
            all_chunks = summary_chunks + text_chunks

            for chunk_index, chunk_text in enumerate(all_chunks):
                if len(chunk_text.strip()) < 50:
                    continue

                # Calculate embeddings-friendly metadata
                metadata = {
                    "chunk_size": len(chunk_text),
                    "document_id": document_id,
                    "chunk_index": chunk_index,
                    "total_chunks": len(all_chunks),
                    "source_file": os.path.basename(file_path),
                    "file_type": "excel" if file_path.endswith('.xlsx') else "csv",
                    "row_count": len(df),
                    "column_count": len(df.columns),
                    "chunk_strategy": "semantic" if chunk_index < len(summary_chunks) else "transaction",
                    "word_count": len(chunk_text.split()),
                    "char_count": len(chunk_text)
                }

                # Create chunk object
                chunk_data = {
                    "document_id": document_id,
                    "chunk_text": chunk_text,
                    "chunk_index": chunk_index,
                    "chunk_metadata": metadata
                }

                db_chunk = DocumentChunk(**chunk_data)
                self.db.add(db_chunk)
                print(f"✅ Created {len(chunks)} advanced document chunks")
                return chunks
            
        except Exception as e:
            self.db.rollback()
            print(f"❌ Error in chunk_document: {e}")
            print(traceback.format_exc())
            raise

    def _create_semantic_chunks(self, df: pd.DataFrame, chunk_size: int) -> List[str]:
        """Create chunks based on semantic grouping"""
        chunks = []

        # Try to group by date (monthly chunks)
        date_cols = [col for col in df.columns if 'date' in col.lower()]
        if date_cols:
            date_col = date_cols[0]
            try:
                df['month'] = pd.to_datetime(df[date_col]).dt.to_period('M')

                for month, month_data in df.groupby('month'):
                    chunk_text = self._create_monthly_summary(month, month_data)
                    if len(chunk_text) > 100:
                        chunks.append(chunk_text)

            except:
                pass

        # Create transaction detail chunks (grouped for readability)
        transaction_chunks = self._create_transaction_chunks(df, chunk_size)
        chunks.extend(transaction_chunks)

        return chunks
    
    def _create_monthly_summary(self, month, month_data: pd.DataFrame) -> str:
        """Create monthly summary chunk"""
        text = f"📅 MONTHLY SUMMARY: {month}\n"
        text += "-" * 40 + "\n\n"

        text += f"📊 Transaction Count: {len(month_data)}\n"

        # Try to find amount column
        amount_cols = [col for col in month_data.columns if 'amount' in col.lower()]
        if amount_cols:
            amount_col = amount_cols[0]
            try:
                amounts = pd.to_numeric(month_data[amount_col], errors='coerce')
                if not amounts.isna().all():
                    total = amounts.sum()
                    avg = amounts.mean()
                    text += f"💰 Total Amount: ${total:,.2f}\n"
                    text += f"📈 Average Transaction: ${avg:,.2f}\n"
            except:
                pass

        # Top descriptions
        desc_cols = [col for col in month_data.columns if 'desc' in col.lower()]
        if desc_cols:
            desc_col = desc_cols[0]
            top_descs = month_data[desc_col].value_counts().head(3)
            if len(top_descs) > 0:
                text += "\n🔝 Top Transactions:\n"
                for desc, count in top_descs.items():
                    text += f"- {desc[:30]}{'...' if len(desc) > 30 else ''}: {count} times\n"
        
        return text
    
    def _create_summary_chunks(self, df: pd.DataFrame, chunk_size: int) -> List[str]:
        """Create summary/overview chunks"""
        chunks = []

        # Overall summary
        summary_text = "FINANCIAL DOCUMENT SUMMARY\n"
        summary_text += "=" * 40 + "\n\n"

        summary_text += f"📊 Document Overview:\n"
        summary_text += f"- Total transactions: {len(df)}\n"
        summary_text += f"- Columns available: {', '.join(df.columns[:5])}{'...' if len(df.columns) > 5 else ''}\n\n"

        # Column statistics
        summary_text += f"📈 Column Statistics:\n"
        for col in df.columns[:5]:
            non_null = df[col].count()
            unique = df[col].nunique()
            summary_text += f"- {col}: {non_null} values ({unique} unique)\n"

        chunks.append(summary_text)

        # Data type summary
        dtype_text = "🔍 Data Types and Patterns:\n"
        for col in df.columns[:5]:
            dtype = str(df[col].dtype)
            sample = str(df[col].iloc[0])[:50] if len(df) > 0 else "N/A"
            dtype_text += f"- {col}: {dtype} (sample: {sample}...)\n"

        chunks.append(dtype_text)
        return chunks
    
    def _create_transaction_chunks(self, df: pd.DataFrame, chunk_size: int) -> List[str]:
        """Create transaction detail chunks"""
        chunks = []
        current_chunk = "TRANSACTION DETAILS\n" + "=" * 40 + "\n\n"
        
        for index, row in df.iterrows():
            # Create transaction entry
            entry = f"Transaction {index+1}:\n"
            
            # Add key-value pairs for each column
            for col_idx, (col, value) in enumerate(row.items()):
                if pd.isna(value):
                    continue
                    
                value_str = str(value)
                if len(value_str) > 100:  # Truncate long values
                    value_str = value_str[:97] + "..."
                
                entry += f"  {col}: {value_str}\n"
            
            entry += "\n"
            
            # If adding this entry would exceed chunk size, start new chunk
            if len(current_chunk) + len(entry) > chunk_size and len(current_chunk) > 100:
                chunks.append(current_chunk)
                current_chunk = "TRANSACTION DETAILS (Continued)\n" + "=" * 40 + "\n\n"
            
            current_chunk += entry
        
        # Add the last chunk if it has content
        if len(current_chunk) > len("TRANSACTION DETAILS\n" + "=" * 40 + "\n\n"):
            chunks.append(current_chunk)
        
        return chunks
        
    def _determine_transaction_type(self, type_str: str, amount: float, description: str = "") -> str:
        """Determine if transaction is income or expense with multiple formats"""
        if pd.isna(type_str) or type_str == "":
            return "INCOME" if amount > 0 else "EXPENSE"
        
        type_clean = str(type_str).strip()
        type_lower = type_clean.lower()

        print(f"🔍 Type detection: '{type_str}' -> '{type_clean}' (lower: '{type_lower}'), amount: {amount}")

        # Comprehensive income keywords
        income_keywords = [
            'income', 'revenue', 'salary', 'deposit', 'credit', 
            'bonus', 'payment received', 'refund', 'interest',
            'incoming', 'payment from', 'transfer in', 'deposit', 'dividend'
        ]
        
        # Comprehensive expense keywords  
        expense_keywords = [
            'expense', 'payment', 'withdrawal', 'purchase', 'debit',
            'bill', 'fee', 'charge', 'payment sent', 'debit', 
            'negative', 'payment to', 'purchase at', 'withdrawal', 'atm'
        ]

        if any(keywords in type_lower for keywords in income_keywords):
            print(f"✅ Determined INCOME from description: {description}")
            return "INCOME"
            
        elif any(keywords in type_lower for keywords in expense_keywords):
            print(f"✅ Determined EXPENSE from description: {description}")
            return "EXPENSE"
        
         # Checking the description too if type is ambiguous
        desc_lower = description.lower()
        if any(keyword in desc_lower for keyword in ['salary', 'deposit', 'refund', 'interest', 'dividend', 'payment from']):
            return "INCOME"
        elif any(keyword in desc_lower for keyword in ['purchase', 'bill', 'fee', 'charge', 'payment', 'amazon', 'uber', 'netflix', 'rent', 'grocery', 'gas', 'electricity', 'water']):
            return "EXPENSE"
            
        else:
            result = 'INCOME' if amount > 0 else 'EXPENSE'
            print(f"🔍 Using amount-based fallback: {result}")
            return result
                
    def debug_excel_structure(self, file_path: str):
        """Debug method to examine Excel file structure"""
        print(f"\n🔍 DEBUG: Examining Excel file: {file_path}")
    
        try:
            # Check file exists
            if not os.path.exists(file_path):
                print("❌ File does not exist")
                return
        
            print(f"📊 File size: {os.path.getsize(file_path)} bytes")
        
            # Try pandas first
            try:
                excel_file = pd.ExcelFile(file_path)
                sheet_names = excel_file.sheet_names
                print(f"📄 Sheets found by pandas: {sheet_names}")
            
                for sheet in sheet_names:
                    try:
                        df = pd.read_excel(file_path, sheet_name=sheet, nrows=5)
                        print(f"\n📋 Sheet: '{sheet}'")
                        print(f"   Rows: {len(df)}, Columns: {list(df.columns)}")
                        print(f"   First 3 rows:")
                        for i in range(min(3, len(df))):
                            print(f"   Row {i}: {dict(df.iloc[i])}")
                    except Exception as e:
                        print(f"   ❌ Could not read sheet '{sheet}': {e}")
            except Exception as e:
                print(f"⚠️ Pandas failed: {e}")
        
            # Try openpyxl
            print("\n🔄 Trying openpyxl...")
            try:
                workbook = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
                print(f"📄 Sheets found by openpyxl: {workbook.sheetnames}")
            
                for sheet_name in workbook.sheetnames:
                    sheet = workbook[sheet_name]
                    print(f"\n📋 Sheet: '{sheet_name}'")
                    print(f"   Max row: {sheet.max_row}, Max column: {sheet.max_column}")
                
                # Read first few rows
                data = []
                for i, row in enumerate(sheet.iter_rows(values_only=True), 1):
                    if i > 5:  # Only first 5 rows
                        break
                    data.append(row)
                
                if data:
                    print(f"   First {len(data)} rows:")
                    for i, row in enumerate(data):
                        print(f"   Row {i}: {row}")
                        
            except Exception as e:
                print(f"❌ Openpyxl failed: {e}")
            
        except Exception as e:
            print(f"❌ Debug error: {e}")
            print(f"🔍 Stack trace: {traceback.format_exc()}")

        
class EnhancedDocumentService(DocumentService):
    def __init__(self, db: Session):
        super().__init__(db)
        self.batch_processor = BatchProcessor(db, batch_size=500)
        self.cache = RedisCache()

    def _read_dataframe_chunked(self, file_path: str, chunk_size: int = 10000) -> pd.DataFrame:
        """Read large files in chunks"""
        if file_path.endswith('.csv'):
            # Use chunk reading for CSV
            chunks = []
            for chunk in pd.read_csv(file_path, chunksize=chunk_size, low_memory=False):
                chunks.append(chunk)
            return pd.concat(chunks, ignore_index=True)
        else:
            # For excel
            return self._read_dataframe(file_path)
        
    @cached(category='document_processing', ttl=timedelta(hours=1))
    def process_document(self, file_path: str, user_id: int, filename: str, column_mapping: dict) -> dict:
        """Optimized document processing with caching and batch processing with extracted storage chunks"""
        # changed due to using supabase file path
        try:
            with open(file_path, 'rb') as f:
                file_content = f.read()
            cache_key = f"{user_id}:{hashlib.md5(file_content).hexdigest()}"
        except:
            cache_key = f"{user_id}:{filename}:{hashlib.md5(str(column_mapping).encode()).hexdigest()}"
    
        # Check cache first
        cached_result = self.cache.get('document_processing', cache_key)   
        if cached_result:  
            logger.info(f"📄 Using cached document processing result for {filename}")  
            return cached_result   
    
        try:   
            logger.info(f"🚀 Starting document processing for {filename}")
            
            # check the file exists
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"File not found: {file_path}")
            
            file_size = os.path.getsize(file_path)
            logger.info(f"File size: {file_size} bytes")
            
            # get the existing document from the documents.py endpoint
            document = self.db.query(FinancialDocument).filter(
                FinancialDocument.user_id == user_id,
                FinancialDocument.filename == filename
            ).order_by(FinancialDocument.id.desc()).first()
            
            if not document:
                # Create document record if it's not exist
                document = FinancialDocument(  
                    user_id=user_id,   
                    filename=filename, 
                    file_path=file_path,   
                    file_size=file_size   
                )  
                self.db.add(document)  
                self.db.commit()   
                self.db.refresh(document)  
        
            logger.info(f"Using document record with ID : {document.id}")  

            # Read file in chunks for large file   
            logger.info(f"📖 Reading file: {file_path}")   
            df = self._read_dataframe_chunked(file_path)   
            logger.info(f"📊 File loaded: {len(df)} rows, {len(df.columns)} columns")  

            # Process transactions in batches and extracted chunks  
            logger.info("🔄 Processing transactions in batches...")
            transactions_data, extracted_data = self._prepare_transactions_batch(df, user_id, document.id, column_mapping) 
            logger.info(f"📝 Prepared {len(transactions_data)} transactions for batch processing") 
        
            transaction_count = self.batch_processor.process_transactions_batch(transactions_data) 
            logger.info(f"✅ Processed {transaction_count} transactions")
            
            # Storing the extracted document in ExtractedTransactions
            if extracted_data:
                logger.info(f"Storing {len(extracted_data)} extracted transactions...")
                for ext_record in extracted_data:
                    try:
                        existing = self.db.query(ExtractedTransactions).filter(
                            ExtractedTransactions.user_id == user_id,
                            ExtractedTransactions.document_id == document.id,
                            ExtractedTransactions.raw_text == ext_record.get('raw_text', '')
                        ).first()
                        
                        if not existing:
                            extracted_txn = ExtractedTransactions(**ext_record)
                            self.db.add(extracted_txn)
                        else:
                            logger.debug(f"Skipping duplicate extracted transaction...")
                    except Exception as e:
                        logger.warning(f"Failed to store extracted transaction: {e}")
                
                self.db.commit()
                logger.info("Stored extracted transactions")
             
            # Generate document chunks in parallel 
            logger.info("🔄 Generating document chunks...")
            chunks_data = []   
            for chunk_batch in self.batch_processor.chunk_documents_batch(df, document.id):
                chunks_data.extend(chunk_batch)
            logger.info(f"📄 Created {len(chunks_data)} chunks")   

            # Generate and store embeddings in batches 
            if chunks_data:
                logger.info("🧠 Generating embeddings...") 
                texts = [chunk['chunk_text'] for chunk in chunks_data] 
                embeddings = self.batch_processor.generate_embeddings_batch(texts, batch_size=50)  
                logger.info(f"✅ Generated {len(embeddings)} embeddings")  
            
                logger.info("💾 Storing embeddings...")
                success = self.batch_processor.store_embeddings_batch(chunks_data, embeddings) 
                if not success:
                    logger.warning("⚠️ Failed to store some embeddings")

            # update document status   
            document.processed = True  
            document.processed_at = datetime.now() 
        
            self.db.commit()   
            logger.info("✅ Database commit successful")   

            result = { 
                "document_id": document.id,
                "transaction_count": transaction_count,
                "chunk_count": len(chunks_data),  
                "status": "success",   
                "processing_time": datetime.now().isoformat(), 
                "batch_processed": True
            }  
        
            # Cache the result 
            self.cache.set('document_processing', cache_key, result)   
            logger.info(f"✅ Document processing completed successfully for {filename}")   

            return result  
        
        except Exception as e: 
            # Ensure rollback on error 
            self.db.rollback() 
            logger.error(f"❌ Optimized document processing failed: {e}")  
            logger.error(f"🔍 Stack trace: {traceback.format_exc()}")  
            raise e    
    
    def _prepare_transactions_batch(self, df: pd.DataFrame, user_id: int, document_id: int, column_mapping: dict) -> List[Dict]:
        """Prepare transaction data dictionaries for batch insertion along with extracted chunks to save"""

        transactions_data = []
        extracted_data = []    
        
        # convert column names to lowercase for matching
        df.columns = [str(col).strip().lower() for col in df.columns]

        # find mapped columns
        date_col = self._find_best_column_match(df.columns, column_mapping.get('date', 'date'))
        desc_col = self._find_best_column_match(df.columns, column_mapping.get('description', 'description'))
        amount_col = self._find_best_column_match(df.columns, column_mapping.get('amount', 'amount'))
        type_col = self._find_best_column_match(df.columns, column_mapping.get('type', 'type'))
        
        # Process each row
        for index, row in df.iterrows():
            try:
                # Skip if amount is empty
                if pd.isna(row.get(amount_col)):
                    continue

                # Parse amount
                amount_raw = row[amount_col]
                amount = self._parse_amount(amount_raw)

                if pd.isna(amount):
                    continue

                # Parse date 
                date = self._parse_date(row.get(date_col, ''))
                if pd.isna(date):
                    continue

                # Get description or type
                description = str(row.get(desc_col, '')).strip() or "Unknown Transactions"
                type_value = str(row.get(type_col, '')).strip()

                transaction_type = self._determine_transaction_type(type_value, amount, description)
                # Categorize transaction
                category = categorize_transaction(description, self.db)

                # Ensure date is datetime object
                if isinstance(date, pd.Timestamp):
                    date_obj = date.to_pydatetime()
                    month_str = date_obj.strftime('%Y-%m')
                elif hasattr(date, 'strftime'):
                    date_obj = date
                    month_str = date.strftime('%Y-%m')
                else:
                    # Try to convert
                    try:
                        date_obj = datetime.fromisoformat(str(date))
                        month_str = date_obj.strftime('%Y-%m')
                    except:
                        print(f"⚠️ Row {index}: Could not format date, using current month")
                        date_obj = datetime.now()
                        month_str = date_obj.strftime('%Y-%m')

                # create transaction dictionary (not an object ORM)
                transaction_data = {
                    "document_id": document_id,
                    "user_id": user_id,
                    "date": date.to_pydatetime() if isinstance(date, pd.Timestamp) else date,
                    "description": description[:255],  # Limit for database column
                    "amount": float(amount),
                    "type": transaction_type,
                    "category": category,
                    "month": month_str,
                    "created_at": datetime.now()
                }
                transactions_data.append(transaction_data)
                
                extracted_record = {
                    "user_id": user_id,
                    "document_id": document_id,
                    "date": date_obj,
                    "description": description[:255],
                    "amount": float(amount),
                    "type": transaction_type,
                    "category": category,
                    "raw_text": str(row.to_dict()),
                    "metadata": {
                        "row_index": index,
                        "column_mapping": column_mapping,
                        "extraction_method": "document_processing"
                    },
                    "year": date_obj.year,
                    "month": date_obj.month,
                    "is_processed": True,
                    "processed_at": datetime.now()
                }
                extracted_data.append(extracted_record)             
                
            except Exception as e:
                logger.info(f"⚠️ Skipping row {index} in batch preparation: {e}")
                continue
                  
        return transactions_data, extracted_data
    
    def _parse_amount(self, amount_raw) -> float:
        """Parse amount from various formats"""
        if pd.isna(amount_raw):
            return float('nan')
    
        try:
            # Convert to string if not already
            if not isinstance(amount_raw, str):
                amount_str = str(amount_raw)
            else:
                amount_str = amount_raw
        
            # Clean the amount string
            amount_str = amount_str.replace('$', '').replace(',', '').replace(' ', '').strip()
        
            # Handle negative amounts
            is_negative = amount_str.startswith('-') or amount_str.startswith('(')
            if is_negative:
                amount_str = amount_str.replace('-', '').replace('(', '').replace(')', '')
        
            # Convert to numeric
            amount = pd.to_numeric(amount_str, errors='coerce')
        
            if pd.isna(amount):
                return float('nan')
        
            # Restore negative sign if needed
            if is_negative:
                amount = -amount
        
            return float(amount)
        except:
            return float('nan')

    

