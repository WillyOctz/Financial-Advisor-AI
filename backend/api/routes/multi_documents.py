from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from typing import List, Optional
import json
import uuid
import asyncio
import tempfile
import os
import logging
from datetime import datetime

from backend.services.multi_document_services import (
    MultiDocumentProcessor, 
    DocumentTask, 
    ProcessingPriority, 
    multi_doc_processor
)
from backend.api.routes.auth import get_current_user
from backend.models.database import User
from backend.models.schemas import MultiUploadFormData, MultiUploadResponse

logger = logging.getLogger(__name__)

router = APIRouter()

# Simple in-memory task tracking - just status, no progress percentages
task_status_cache: dict[str, dict] = {}

@router.post("/upload-multiple", response_model=MultiUploadResponse)
async def upload_multiple_documents(
    files: List[UploadFile] = File(..., description="Multiple files to upload"), 
    user_id: int = Form(...),
    column_mappings_json: str = Form(...),
    priority: str = Form("medium"),
    dependencies_json: str = Form("[]"),
    current_user: User = Depends(get_current_user)    
):
    """Upload and process multiple documents - NO PROGRESS TRACKING"""
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    logger.info(f"📤 Upload started: {len(files)} file(s) for user {user_id}")
    
    try:
        mappings_list = json.loads(column_mappings_json)
        dependency_rules = json.loads(dependencies_json)
        
        if len(mappings_list) != len(files):
            raise HTTPException(status_code=400, detail="Mappings count mismatch")
        
        user_currency = current_user.currency if hasattr(current_user, 'currency') and current_user.currency else 'USD'
        logger.info(f"User {user_id} currency: {user_currency}")
        
        priority_map = {
            "high": ProcessingPriority.HIGH,
            "medium": ProcessingPriority.MEDIUM,
            "low": ProcessingPriority.LOW,
            "background": ProcessingPriority.BACKGROUND
        }
        task_priority = priority_map.get(priority.lower(), ProcessingPriority.MEDIUM)
        
        tasks = []
        temp_files = []
        
        for i, (file, column_mapping) in enumerate(zip(files, mappings_list)):
            content = await file.read()
            upload_id = str(uuid.uuid4())
            
            temp_dir = tempfile.gettempdir()
            temp_filename = f"{upload_id}_{file.filename}"
            temp_path = os.path.join(temp_dir, temp_filename)
            
            with open(temp_path, "wb") as f:
                f.write(content)
                
            temp_files.append(temp_path)
            
            file_dependencies = []
            for rule in dependency_rules:
                if rule.get('file_index') == i:
                    dep_index = rule.get('depends_on')
                    if dep_index < len(tasks):
                        file_dependencies.append(tasks[dep_index].task_id)
                        
            task = DocumentTask(
                upload_id=upload_id,
                user_id=user_id,
                file_path=temp_path,
                filename=file.filename,
                column_mapping=column_mapping,
                priority=task_priority,
                dependencies=file_dependencies,
                metadata={
                    "original_filename": file.filename,
                    "file_size": len(content),
                    "content_type": file.content_type,
                    "upload_timestamp": datetime.now().isoformat(),
                    "user_currency": user_currency,
                }
            )
            
            task_id = task.task_id
            
            # Simple status tracking - just 3 states: processing, completed, failed
            task_status_cache[task_id] = {
                "task_id": task_id,
                "user_id": user_id,
                "filename": file.filename,
                "status": "processing",  # Only 3 states!
                "created_at": datetime.now().isoformat()
            }
            
            tasks.append(task)
            logger.info(f"✅ Queued: {file.filename} ({task_id[:8]}...)")
        
        # Cleanup temp files after 5 minutes
        async def cleanup_temp_files():
            await asyncio.sleep(300)
            for temp_path in temp_files:
                try:
                    if os.path.exists(temp_path):
                        os.remove(temp_path)
                except Exception as e:
                    logger.warning(f"Cleanup failed: {e}")
                    
        asyncio.create_task(cleanup_temp_files())
        
        return MultiUploadResponse(
            message=f"Processing {len(files)} file(s)",
            task_ids=[t.task_id for t in tasks],
            upload_ids=[t.upload_id for t in tasks],
            priority=priority,
            dependencies_set=len(dependency_rules) > 0,
            estimated_concurrent_processing=min(len(files), 3)
        )
    
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")
    except Exception as e:
        logger.error(f"Upload failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.get("/task-status/{task_id}")
async def get_task_status(
    task_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get simple task status - ONLY 3 STATES: processing, completed, failed
    No percentages, no stages, no progress bars
    """
    task_data = task_status_cache.get(task_id)
    
    if not task_data:
        # Try getting from processor
        processor_status = await multi_doc_processor.get_task_status(task_id)
        if processor_status.get('status') == 'not_found':
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Convert processor status to simple format
        return {
            "task_id": task_id,
            "status": processor_status.get('status', 'processing'),
        }
    
    # Verify ownership
    if task_data.get('user_id') != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return {
        "task_id": task_id,
        "status": task_data.get("status"),  # Just: processing, completed, or failed
    }


def update_task_status(task_id: str, status: str):
    """
    Helper to update task status from document processor
    Call this from your document processing service when done
    """
    if task_id in task_status_cache:
        task_status_cache[task_id]["status"] = status
        task_status_cache[task_id]["updated_at"] = datetime.now().isoformat()
        logger.info(f"📊 Task {task_id[:8]}... → {status}")


@router.post("/task/{task_id}/cancel")
async def cancel_task(
    task_id: str,
    current_user: User = Depends(get_current_user)
):
    """Cancel a task"""
    task_data = task_status_cache.get(task_id)
    
    if not task_data:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task_data.get('user_id') != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update status
    update_task_status(task_id, "failed")
    
    # Try canceling in processor
    try:
        await multi_doc_processor.cancel_task(task_id)
    except:
        pass
    
    return {
        "success": True,
        "task_id": task_id,
        "message": "Task cancelled"
    }


@router.get("/user-tasks")
async def get_user_tasks(
    current_user: User = Depends(get_current_user),
    status_filter: Optional[str] = None,
    limit: int = 50
):
    """Get all tasks for current user"""
    all_tasks = [
        {
            "task_id": task_id,
            "filename": task_data.get("filename"),
            "status": task_data.get("status"),
            "created_at": task_data.get("created_at"),
        }
        for task_id, task_data in task_status_cache.items()
        if task_data.get("user_id") == current_user.id
    ]
    
    if status_filter:
        all_tasks = [t for t in all_tasks if t['status'] == status_filter]
        
    all_tasks.sort(key=lambda x: x.get('created_at', ''), reverse=True)
    
    return {
        "tasks": all_tasks[:limit],
        "total_count": len(all_tasks)
    }