import os
from typing import Optional, BinaryIO
from supabase import create_client, Client
import uuid
from datetime import datetime
import logging
from fastapi import UploadFile

logger = logging.getLogger(__name__)

class StorageService:
    
    def __init__(self):
        self.storage_type = os.getenv('STORAGE_TYPE')
        
        if self.storage_type == "supabase":
            self.supabase: Client = create_client(
                os.getenv('SUPABASE_URL'),
                os.getenv('SUPABASE_SERVICE_KEY')
            )
            self.bucket_name = "documents"
    
    async def upload_file(self, file: UploadFile, user_id: int) -> dict:
        """Upload file to configured storage"""
        if self.storage_type == "supabase":
            return await self.upload_to_supabase(file, user_id)
        
    async def upload_to_supabase(self, file: UploadFile, user_id: int) -> dict:
        """Upload to Supabase Storage"""
        try:
            # Handling both the uploaded file and content file
            if hasattr(file, 'read'):
                content = await file.read()
                filename = file.filename
                content_type = file.content_type
            else:
                content = file.get('content')
                filename = file.get('filename')
                content_type = file.get('content_type')
                
            # generating a unique name for the file    
            file_ext = os.path.splitext(filename)[1]
            unique_filename = f"{uuid.uuid4()}{file_ext}"
            file_path = f"user_{user_id}/{unique_filename}"
            
            # upload it to supabase
            self.supabase.storage.from_(self.bucket_name).upload(
                file_path,
                content,
                {"content-type": content_type or "application/octet-stream"}
            )
            
            url = self.supabase.storage.from_(self.bucket_name).get_public_url(file_path)
            
            logger.info(f"✅ File uploaded to Supabase: {url}")
            
            return {
                "url": url,
                "file_path": file_path,
                "storage_type": "supabase",
                "original_filename": filename,
                "file_size": len(content)
            }
            
        except Exception as e:
            logger.error(f"❌ Supabase upload failed: {e}")
            raise
        
    async def upload_file_direct(self, filename: str, content: bytes, content_type: str, user_id: int) -> dict:
        """Upload file directly using content bytes"""
        if self.storage_type == "supabase":
            return await self.upload_to_supabase_direct(filename, content, content_type, user_id)
        
    async def upload_to_supabase_direct(self, filename: str, content: bytes, content_type: str, user_id: int) -> dict:
        """Direct upload to supabase using bytes content"""
        try:
            file_ext = os.path.splitext(filename)[1]
            unique_filename = f"{uuid.uuid4()}{file_ext}"
            file_path = f"user_{user_id}/{unique_filename}"
            
            # Upload to supabase
            self.supabase.storage.from_(self.bucket_name).upload(
                file_path,
                content,
                {"content-type": content_type or "application/octet-stream"}
            )
            
            # get public URL
            url = self.supabase.storage.from_(self.bucket_name).get_public_url(file_path)
            
            logger.info(f"✅ File uploaded to Supabase: {url}")
            
            return {
                "url": url,
                "file_path": file_path,
                "storage_type": "supabase",
                "original_filename": filename,
                "file_size": len(content)
            }
        
        except Exception as e:
            logger.error(f"Supabase direct upload failed: {e}")
            raise
    
    async def download_file(self, file_url: str) -> bytes:
        """Download file from storage"""
        if self.storage_type == "supabase":
            
            file_path = file_url.split(f"/storage/v1/object/public/{self.bucket_name}/")[-1]
            
            response = self.supabase.storage.from_(self.bucket_name).download(file_path)
            return response
        
        else:
            with open(file_url, "rb") as f:
                return f.read()
            
    def delete_file(self, file_url: str) -> bool:
        """Delete file from storage"""
        try:
            if self.storage_type == "supabase":
                file_path = file_url.split(f"/storage/v1/object/public/{self.bucket_name}/")[-1]
                self.supabase.storage.from_(self.bucket_name).remove([file_path])
                return True
            else:
                if os.path.exists(file_url):
                    os.remove(file_url)
                    return True
                return False
            
        except Exception as e:
            logger.error(f"❌ Delete failed: {e}")
            return False    
     