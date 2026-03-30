from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from typing import List, Optional
import json
import uuid
import asyncio
import tempfile
import os
import logging
from datetime import datetime

from backend.services.multi_document_services import (MultiDocumentProcessor, DocumentTask, ProcessingPriority, multi_doc_processor)
from backend.api.routes.auth import get_current_user
from backend.models.database import User
from backend.models.schemas import MultiUploadFormData, MultiUploadResponse

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/upload-multiple", response_model=MultiUploadResponse)
async def upload_multiple_documents(
    files: List[UploadFile] = File(..., description="Multiple files to upload"), 
    user_id: int = Form(...),
    column_mappings_json: str = Form(...),
    priority: str = Form("medium"),
    dependencies_json: str = Form("[]"),
    current_user: User = Depends(get_current_user)    
):
    """Upload and process multiple documents with dependencies"""
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to upload for this user")
    
    # debug logging
    logger.info(f"=== MULTIPLE UPLOAD DEBUG ===")
    logger.info(f"Files received: {len(files)}")
    for i, file in enumerate(files):
        logger.info(f"  File {i}: {file.filename}, {file.content_type}")
    
    logger.info(f"user_id: {user_id}")
    logger.info(f"priority: {priority}")
    logger.info(f"column_mappings_json: {column_mappings_json[:100]}...")
    logger.info(f"dependencies_json: {dependencies_json}")
    
    try:
        # use the properties from schema
        mappings_list = json.loads(column_mappings_json)
        dependency_rules = json.loads(dependencies_json)
        
        logger.info(f"Parsed {len(mappings_list)} mappings")
        logger.info(f"Parsed {len(dependency_rules)} dependency rules")
        
        if len(mappings_list) != len(files):
            raise HTTPException(status_code=400, detail="Number of column mappings must match number of files")
        
        # parse priority
        priority_map = {
            "high": ProcessingPriority.HIGH,
            "medium": ProcessingPriority.MEDIUM,
            "low": ProcessingPriority.LOW,
            "background": ProcessingPriority.BACKGROUND
        }
        task_priority = priority_map.get(priority.lower(), ProcessingPriority.MEDIUM)
        
        # save files and create tasks
        tasks = []
        temp_files = []
        
        for i, (file, column_mapping) in enumerate(zip(files, mappings_list)):
            # read file content
            content = await file.read()
            logger.info(f"Processing file {i}: {file.filename} ({len(content)} bytes)")
            
            # create upload id
            upload_id = str(uuid.uuid4())
            
            # save temp file
            temp_dir = tempfile.gettempdir()
            temp_filename = f"{upload_id}_{file.filename}"
            temp_path = os.path.join(temp_dir, temp_filename)
            
            with open(temp_path, "wb") as f:
                f.write(content)
                
            temp_files.append(temp_path)
            
            # determine dependencies for this file
            file_dependencies = []
            for rule in dependency_rules:
                if rule.get('file_index') == i:
                    # this file depends on another file
                    dep_index = rule.get('depends_on')
                    if dep_index < len(tasks):
                        file_dependencies.append(tasks[dep_index].task_id)
                        
            # create document task
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
                    "upload_timestamp": datetime.now().isoformat()
                }
            )
            
            # submit task
            task_id = await multi_doc_processor.submit_document(task)
            tasks.append(task)
            
            logger.info(f"Submitted document {file.filename} as task {task_id}")
        
        # cleanup temporary files after processing completes
        async def cleanup_temp_files():
            await asyncio.sleep(300)
            for temp_path in temp_files:
                try:
                    if os.path.exists(temp_path):
                        os.remove(temp_path)
                        logger.debug(f"Cleaned up temp file: {temp_path}")
                except Exception as e:
                    logger.warning(f"Failed to cleanup temp file {temp_path}: {e}")
                    
        asyncio.create_task(cleanup_temp_files())
        
        return MultiUploadResponse(
            message=f"Submitted {len(files)} documents for processing",
            task_ids=[t.task_id for t in tasks],
            upload_ids=[t.upload_id for t in tasks],
            priority=priority,
            dependencies_set=len(dependency_rules) > 0,
            estimated_concurrent_processing=min(len(files), 3)
        )
    
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")
    except Exception as e:
        logger.error(f"Multiple upload failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
    
@router.get("/task-status/{task_id}")
async def get_task_status(
    task_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get status of processing multi document task"""
    status = await multi_doc_processor.get_task_status(task_id)
    
    if status['status'] == 'not_found':
        raise HTTPException(status_code=404, detail="Task not found")
    
    # verify task belongs to a user
    task_data = status.get('task') or status.get('result', {}).get('task')
    if task_data and task_data.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return status

@router.post("/task/{task_id}/cancel")
async def cancel_task(
    task_id: str,
    current_user: User = Depends(get_current_user)
):
    """cancel a processing task"""
    # first verify that task belong to user
    status = await multi_doc_processor.get_task_status(task_id)
    
    if status['status'] == 'not_found':
        raise HTTPException(status_code=404, detail="Task not found")

    task_data = status.get('task') or status.get('result', {}).get('task')
    if task_data and task_data.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    success = await multi_doc_processor.cancel_task(task_id)
    
    return {
        "success": success,
        "task_id": task_id,
        "message": "Task cancelled" if success else "Could not cancel task"
    }
    
@router.get("/user-tasks")
async def get_user_tasks(
    current_user: User = Depends(get_current_user),
    status_filter: Optional[str] = None,
    limit: int = 50
):
    """get all tasks for the current user"""
    all_tasks = []
    
    # get tasks from all states
    states = [
        ("pending", multi_doc_processor.pending_tasks),
        ("processing", multi_doc_processor.processing_tasks),
        ("completed", multi_doc_processor.completed_tasks),
        ("failed", multi_doc_processor.failed_tasks)
    ]
    
    for state_name, state_dict in states:
        for task_id, task_data in list(state_dict.items()):
            if isinstance(task_data, DocumentTask):
                task = task_data
            elif isinstance(task_data, dict) and 'task' in task_data:
                task = task_data['task']
            else:
                continue
            
            if task.user_id == current_user.id:
                all_tasks.append({
                    "task_id": task_id,
                    "status": state_name,
                    "filename": task.filename,
                    "upload_id": task.upload_id,
                    "priority": task.priority.name,
                    "created_at": task.created_at.isoformat(),
                    "dependencies": task.dependencies
                })
    
    # apply filters
    if status_filter:
        all_tasks = [t for t in all_tasks if t['status'] == status_filter]
        
    # sort by creation time (newest first)
    all_tasks.sort(key=lambda x: x['created_at'], reverse=True)
    
    return {
        "tasks": all_tasks[:limit],
        "total_count": len(all_tasks),
        "filtered_count": len(all_tasks[:limit])
    }
