from fastapi import APIRouter, Request, UploadFile, File, Depends, HTTPException, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from concurrent.futures import ThreadPoolExecutor
import threading
from backend.db.session import SessionLocal, get_db
from backend.models.database import FinancialDocument, Transaction
from backend.services.service_storage import StorageService
from backend.services.document_services import EnhancedDocumentService, ProcessingCancelledError
from backend.api.routes.auth import get_current_user
from backend.models.database import User
from datetime import datetime
import time
from collections import defaultdict
from backend.core.config import settings
import os
import uuid
import json
import pandas as pd
from typing import Dict, List
import logging
import tempfile

logger = logging.getLogger(__name__)
router = APIRouter()
user_progress = defaultdict(dict)

class CancellationManager:
    def __init__(self):
        self._lock = threading.Lock()
        self._flags: Dict[str, bool] = {}
        
    def set_cancelled(self, upload_id: str):
        with self._lock:
            logger.info(f"Setting cancellation flag for {upload_id}")
            self._flags[upload_id] = True
    
    def is_cancelled(self, upload_id: str) -> bool:
        with self._lock:
            result = self._flags.get(upload_id, False)
            logger.debug(f"Checking cancellation for {upload_id}: {result}")
            return result
    
    def clear(self, upload_id: str):
        with self._lock:
            logger.info(f"Clearing cancellation flag for {upload_id}")
            if upload_id in self._flags:
                del self._flags[upload_id]
                
upload_cancellation_manager = CancellationManager()
upload_cleanup_files = []
cleanup_lock = threading.Lock()

@router.post("/cancel-upload/{upload_id}")
async def cancel_upload(
    upload_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cancel an ongoing upload"""
    try:
        logger.info(f"Cancelling upload {upload_id} for user {current_user.id}")
        
        #mark as cancelled in the manager
        upload_cancellation_manager.set_cancelled(upload_id)
        
        # store cancellation in database for background processes
        from backend.db.session import SessionLocal
        bg_db = SessionLocal()
        try:
            # Find the document being processed
            document = bg_db.query(FinancialDocument).filter(
                FinancialDocument.user_id == current_user.id
            ).order_by(FinancialDocument.id.desc()).first()
            
            if document:
                document.processed = False
                document.processed_at = datetime.now()
                bg_db.commit()
                logger.info(f"Marked document {document.id} as cancelled")
        except Exception as e:
            logger.error(f"Error updating document status: {e}")
            bg_db.rollback()
        finally:
            bg_db.close()
            
        logger.info(f"Upload {upload_id} cancelled successfully")
        
        return {
            "message": "Upload cancelled successfully",
            "upload_id": upload_id,
            "cancelled_at": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error cancelling upload {upload_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error cancelling upload: {str(e)}")
            
@router.post("/upload")
async def upload_document(
    user_id: int = Form(...),
    file: UploadFile = File(...),
    column_mapping: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    storage_service: StorageService = Depends(lambda: StorageService())
):
    """Upload and process financial document"""
    
    # Create unique upload id for user
    upload_id = str(uuid.uuid4())
    temp_path = None
    
    try: 
        # Ensure the user is uploading their own document
        if current_user.id != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to upload for this user")
        
        try:
            mapping_dict = json.loads(column_mapping)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid column mapping format: {str(e)}")
        
        temp_dir = tempfile.gettempdir()
        temp_filename = f"{uuid.uuid4()}{os.path.splitext(file.filename)[1]}"
        temp_path = os.path.join(temp_dir, temp_filename)
        
        logger.info(f"Saving uploaded file to temp location: {temp_path}")
        
        content = await file.read()
        
        with open(temp_path, "wb") as temp_file:
            temp_file.write(content)
            
        logger.info(f"File saved to temp location: {temp_path} ({len(content)} bytes)")
        
        # file reading process
        try:
            if temp_path.endswith('.csv'):
                test_df = pd.read_csv(temp_path, nrows=5)
            elif temp_path.endswith(('.xlsx', '.xls')):
                test_df = pd.read_excel(temp_path, nrows=5)
                
            logger.info(f"File read test successful: {len(test_df)} rows, columns: {list(test_df.columns)}")
        except Exception as e:
            logger.info(f"File reading test failed: {e}")
            raise HTTPException(status_code=400, detail=f"Cannot read file format: {str(e)}")
        
        # upload it to supabase
        try:
            upload_result = await storage_service.upload_file_direct(
                filename=file.filename,
                content=content,
                content_type=file.content_type,
                user_id=user_id
            )
            
            logger.info(f"✅ File uploaded to storage: {upload_result['storage_type']}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to upload to storage: {str(e)}")
        
        # Creating the document record
        document = FinancialDocument(
            user_id=user_id,
            filename=file.filename,
            file_path=upload_result["file_path"],
            file_url=upload_result.get("url"),
            storage_type=upload_result["storage_type"],
            file_size=len(content)
        )
        db.add(document)
        db.commit()
        db.refresh(document)
        document_id = document.id
        logger.info(f"Document saved to database with ID: {document.id}")
        
        def process_in_background():
            from backend.db.session import get_background_session
            
            def check_cancellation():
                return upload_cancellation_manager.is_cancelled(upload_id)
            
            # clean up methods for file locking issue
            def cleanup_file_with_retry(file_path):
                """Helper function for the clean-up process"""
                if not file_path or not os.path.exists(file_path):
                    return
                
                max_attempts = 3
                for attempt in range(max_attempts):
                    try:
                        os.remove(file_path)
                        return True
                    except PermissionError as e:
                        if attempt < max_attempts - 1:
                            time.sleep(1)
                        else:
                            with cleanup_lock:
                                if file_path not in upload_cleanup_files:
                                    upload_cleanup_files.append(file_path)
                            return False
                    except Exception as e:
                        logger.error(f"Error removing {file_path}: {e}")
                        return False
                    
            background_db = None
            try:
                user_currency = current_user.currency if hasattr(current_user, 'currency') else 'USD'
                background_db = get_background_session()
                document_service = EnhancedDocumentService(background_db, user_currency)
                
                if check_cancellation():
                    logger.info(f"Upload {upload_id} cancelled before processing")
                    return
                
                # set the upload id for progress tracking
                document_service.current_upload_id = upload_id
                document_service.current_user_id = user_id
                
                result = document_service.process_document(
                    temp_path,
                    user_id,
                    file.filename,
                    mapping_dict,
                    cancellation_check=check_cancellation,
                )
                    
                if result.get('status') == 'success':
                    logger.info(f"Background processing completed successfully for upload {upload_id}")
                    sync_document_status(document_id, SessionLocal())
                else:
                    logger.error(f"Background processing failed for upload {upload_id}: {result}")
            
            except ProcessingCancelledError as e:
                logger.info(f"Upload {upload_id} cancelled during processing: {e}")
                if background_db:
                    background_db.rollback()
                    
            except Exception as e:
                error_msg = str(e)
                # check if its cancelled
                if "cancelled" in error_msg.lower():
                    logger.info(f"Upload {upload_id} cancelled during processing")
                else:
                    logger.error(f"Background processing failed: {error_msg}", exc_info=True)
                    if background_db:
                        background_db.rollback()
            finally:
                upload_cancellation_manager.clear(upload_id)                   
                if background_db:
                    background_db.close()
                if temp_path and os.path.exists(temp_path):
                    cleanup_file_with_retry(temp_path)
                
        thread = threading.Thread(target=process_in_background)
        thread.daemon = True
        thread.start()
        
        return {
            "message": "Document upload started",
            "upload_id": upload_id,
            "document_id": document.id,
            "status": "processing"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in upload_document: {str(e)}", exc_info=True)
        db.rollback()
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except:
                pass
        raise HTTPException(status_code=500, detail=f"Error processing document: {str(e)}")

@router.get("/{document_id}/transactions")
def get_document_transactions(document_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get transactions for a specific document"""
    try:
        # Verify document belongs to current user
        document = db.query(FinancialDocument).filter(
            FinancialDocument.id == document_id,
            FinancialDocument.user_id == current_user.id
        ).first()

        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        transactions = db.query(Transaction).filter(Transaction.document_id == document_id).all()
        return transactions
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching transactions: {str(e)}")
    
def sync_document_status(document_id: int, db: Session):
    """Sync document status from background session to main session"""
    try:
        # Refresh the document process in the main session
        main_document = db.query(FinancialDocument).filter(
            FinancialDocument.id == document_id
        ).first()
        
        if main_document:
            main_document.processed = True
            main_document.processed_at = datetime.now()
            db.commit()
            logger.info(f"Synced document {document_id} status to main session")
        else:
            logger.error(f"Document {document_id} not found in main session")
    except Exception as e:
        logger.error(f"Error syncing document status: {e}")
        db.rollback()
        
    