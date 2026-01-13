from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from backend.db.session import get_db
from backend.models.database import FinancialDocument, Transaction
from backend.services.service_storage import StorageService
from backend.services.document_services import DocumentService, EnhancedDocumentService
from backend.api.routes.auth import get_current_user
from backend.models.database import User
import datetime
import os
import io
import uuid
import json
import pandas as pd
from typing import Optional
import logging
import tempfile

logger = logging.getLogger(__name__)
router = APIRouter()

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
        
        file_copy_content = content
        
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
            logger.error(f"Supabase upload failed: {e}")
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
        
        # now, process the document from temp path
        document_service = EnhancedDocumentService(db)
        
        result = document_service.process_document(
            temp_path,
            user_id,
            file.filename,
            mapping_dict
        )
        
        # update document status
        document.processed = True
        document.processed_at = datetime.datetime.now()
        document.transaction_count = result.get('transaction_count', 0)
        db.commit()
        
        logger.info(f"Document processed: {result.get('transaction_count', 0)} transactions")
        
        return {
            "message": "Document processed successfully",
            "document_id": document.id,
            "file_url": upload_result["url"],
            "transaction_count": result.get("transaction_count", 0),
            "status": "success"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in upload_document: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error processing document: {str(e)}")
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
                logger.info(f"Cleaned up temp file: {temp_path}")
            except Exception as e:
                logger.warning(f"Could not remove temp file {temp_path}: {e}")
    
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
    