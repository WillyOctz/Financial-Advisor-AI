from fastapi import APIRouter, Request, UploadFile, File, Depends, HTTPException, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from concurrent.futures import ThreadPoolExecutor
import threading
from backend.services.progress_tracker import progress_tracker
from backend.db.session import SessionLocal, get_db
from backend.models.database import FinancialDocument, Transaction
from backend.services.service_storage import StorageService
from backend.services.document_services import EnhancedDocumentService, ProcessingCancelledError
from backend.services.multi_document_services import (MultiDocumentProcessor, DocumentTask, ProcessingPriority, multi_doc_processor)
from backend.api.routes.auth import get_current_user
from backend.models.database import User
from datetime import datetime
import time
from collections import defaultdict
from backend.core.config import settings
import os
import asyncio
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
        
        # mark as cancelled in progress tracker
        progress_tracker.cancel_upload(current_user.id, upload_id, "Cancelled by user")
        
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

def update_progress(user_id: int, upload_id: str, stage: str, percentage: int, details: str = ""):
    """Update progress for SSE"""
    if user_id not in user_progress:
        user_progress[user_id] = {}
        
    user_progress[user_id][upload_id] = {
        "stage": stage,
        "percentage": percentage,
        "details": details,
        "updated_at": datetime.now()
    }
    
    logger.info(f"Progress updated for user {user_id}: {stage} - {percentage}%")
    
@router.get("/upload-status/{upload_id}")
async def get_upload_status(upload_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get current status of an upload"""
    try:
        progress = progress_tracker.get_progress(current_user.id, upload_id)
        
        if not progress:
            raise HTTPException(status_code=404, detail="Upload not found")
        
        return {
            "upload_id": upload_id,
            "stage": progress.get("stage"),
            "percentage": progress.get("percentage"),
            "details": progress.get("details"),
            "is_complete": progress.get("is_complete", False),
            "is_error": progress.get("is_error", False),
            "updated_at": progress.get("updated_at"),
            "metadata": progress.get("metadata", {})
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting upload status: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting status: {str(e)}")

@router.get("/progress/{upload_id}")
async def progress_stream(request: Request ,upload_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Using SSE to for progress tracking with stage and other managements"""
    
    async def event_generator():
        last_sent_data = None
        heartbeat_interval = 10
        last_heartbeat_time = time.time()
        connection_start_time = time.time()
        max_connection_time = 600
        
        logger.info(f"SSE stream started for upload {upload_id}")
        
        try:
            # send initial confirmation connection
            yield f"data: {json.dumps({'connected': True, 'upload_id': upload_id})}\n\n"
            
            while True:
                # check connection limits
                if time.time() - connection_start_time > max_connection_time:
                    yield f"data: {json.dumps({'warning': 'Connection timeout', 'reconnect': True})}\n\n"
                    break
                
                if await request.is_disconnected():
                    logger.info(f"Client disconnected for {upload_id}")
                    break
                
                # get progress data
                progress_data = None
                if current_user:
                    progress_data = progress_tracker.get_progress(current_user.id, upload_id)
                else:
                    # search for upload across all users (less secure but will modify once it works for demo only)
                    for user_id in list(progress_tracker.progress_data.keys()):
                        progress_data = progress_tracker.get_progress(user_id, upload_id)
                        if progress_data:
                            break
                     
                # send heartbeat if needed
                current_time = time.time()
                if current_time - last_heartbeat_time > heartbeat_interval:
                    yield f":heartbeat {int(current_time)}\n\n"
                    last_heartbeat_time = current_time
                    
                    # update server side heartbeat
                    if current_user and progress_data:
                        progress_tracker.send_heartbeat(current_user.id, upload_id)
                        
                if progress_data:
                    # prepare progress update
                    update_data = {
                        "upload_id": upload_id,
                        "stage": progress_data.get("stage", "unknown"),
                        "percentage": progress_data.get("percentage", 0),
                        "details": progress_data.get("details", ""),
                        "is_complete": progress_data.get("is_complete", False),
                        "is_error": progress_data.get("is_error", False),
                        "can_cancel": progress_data.get("stage") not in ["completed", "cancelled", "error"],
                        "timestamp": datetime.now().isoformat(),
                        "metadata": progress_data.get("metadata", {})
                    }
                    
                    # check if data changed significantly
                    should_send = (
                        not last_sent_data or
                        update_data["stage"] != last_sent_data.get("stage") or
                        abs(update_data["percentage"] - last_sent_data.get("percentage", 0)) >= 1 or
                        update_data["is_complete"] != last_sent_data.get("is_complete") or
                        update_data["is_error"] != last_sent_data.get("is_error")
                    )
                    
                    if should_send:
                        yield f"data: {json.dumps(update_data)}\n\n"
                        last_sent_data = update_data
                        
                        # handle completion
                        if update_data["is_complete"] or update_data["is_error"]:
                            # send final confirmation
                            yield f"data: {json.dumps({'final': True, **update_data})}\n\n"
                            
                            # wait for client to receive
                            await asyncio.sleep(2)
                            
                            logger.info(f"SSE stream completed for {upload_id}")
                            break
                        
                # adaptive polling interval
                if progress_data and progress_data.get("is_complete"):
                    await asyncio.sleep(1) # slow pooling
                elif progress_data and progress_data.get("percentage", 0) > 90:
                    await asyncio.sleep(0.5) # medium pooling
                else:
                    await asyncio.sleep(0.3) # fast pooling
                    
        except asyncio.CancelledError:
            logger.info(f"SSE connection cancelled for {upload_id}")    
        except Exception as e:
            logger.error(f"SSE stream error for {upload_id}: {str(e)}", exc_info=True)
            yield f"data: {json.dumps({'error': str(e)[:100], 'reconnect': True})}\n\n"
        finally:
            logger.info(f"SSE stream ended for {upload_id}")
            
    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "text/event-stream; charset=utf-8"
    }
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers=headers
    )
        
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
        
        # create initial progress
        update_progress(user_id, upload_id, "Starting Upload", 5, "File Received")
        
        # upload it to supabase
        try:
            update_progress(user_id, upload_id, "Uploading to storage", 10, "Uploading to cloud storage")
            
            upload_result = await storage_service.upload_file_direct(
                filename=file.filename,
                content=content,
                content_type=file.content_type,
                user_id=user_id
            )
            
            logger.info(f"✅ File uploaded to storage: {upload_result['storage_type']}")
        except Exception as e:
            update_progress(user_id, upload_id, "Error", 0, f"Storage upload failed: {str(e)}") 
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
        logger.info(f"Document saved to database with ID: {document.id}")
        
        document_id = document.id
        
        # Start background processing
        update_progress(user_id, upload_id, "Starting processing", 15, "Document processing started...")
        
        def process_in_background():
            from backend.db.session import get_background_session
            
            def check_cancellation():
                is_cancelled = upload_cancellation_manager.is_cancelled(upload_id)
                logger.debug(f"Cancellation check for {upload_id}: {is_cancelled}")
                return is_cancelled
            
            background_db = None
            temp_file_closed = False
            
            # process the document with periodic cancellation checks
            cancellation_check = lambda: check_cancellation()
            
            # clean up methods for file locking issue
            def cleanup_file_with_retry(file_path):
                """Helper function for the clean-up process"""
                if not file_path or not os.path.exists(file_path):
                    return
                
                max_attempts = 3
                for attempt in range(max_attempts):
                    try:
                        os.remove(file_path)
                        logger.info(f"Successfully cleaned up temp file: {file_path}")
                        return True
                    except PermissionError as e:
                        if attempt < max_attempts - 1:
                            logger.warning(f"Attempt {attempt + 1}/{max_attempts}: File locked, waiting...")
                            time.sleep(1)
                        else:
                            logger.error(f"Failed to remove {file_path} after {max_attempts} attempts: {e}")
                            
                            with cleanup_lock:
                                if file_path not in upload_cleanup_files:
                                    upload_cleanup_files.append(file_path)
                            return False
                    except Exception as e:
                        logger.error(f"Error removing {file_path}: {e}")
                        return False
                    
            try:
                background_db = get_background_session()
                document_service = EnhancedDocumentService(background_db)
                
                # check for cancellation before starting
                if cancellation_check():
                    logger.info(f"Upload {upload_id} was cancelled before processing")
                    update_progress(user_id, upload_id, "Cancelled", 0, "Upload cancelled by user")
                    return
                
                # set the upload id for progress tracking
                document_service.current_upload_id = upload_id
                document_service.current_user_id = user_id
                
                result = document_service.process_document(
                    temp_path,
                    user_id,
                    file.filename,
                    mapping_dict,
                    cancellation_check=cancellation_check,
                )
                    
                if result.get('status') == 'success':
                    logger.info(f"Background processing completed successfully for upload {upload_id}")
                    
                    sync_document_status(document_id, SessionLocal())
                    
                    update_progress(user_id, upload_id, "Completed", 100, f"Processed {result.get('transaction_count', 0)} transactions")
                else:
                    logger.error(f"Background processing failed for upload {upload_id}: {result}")
                    update_progress(user_id, upload_id, "Error", 0, f"Processing failed: {result.get('error', 'Unknown error')}")
            
            except ProcessingCancelledError as e:
                update_progress(user_id, upload_id, "Cancelled", 0, "Upload cancelled by user")
                logger.info(f"Upload {upload_id} cancelled during processing: {e}")
                if background_db:
                    background_db.rollback()
                    
            except Exception as e:
                error_msg = str(e)
                # check if its cancelled
                if "cancelled" in error_msg.lower():
                    update_progress(user_id, upload_id, "Cancelled", 0, "Upload cancelled by user")
                    logger.info(f"Upload {upload_id} cancelled during processing")
                else:
                    update_progress(user_id, upload_id, "Error", 0, f"Processing failed: {error_msg[:100]}")
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
        
    