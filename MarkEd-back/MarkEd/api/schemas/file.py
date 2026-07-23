from ninja import Schema
from typing import Optional, Dict, Any

class PresignedPostData(Schema):
    url: str
    fields: Dict[str, Any]

class FileUploadResponse(Schema):
    success: bool
    upload_url: Optional[PresignedPostData]
    permanent_url: Optional[str]
    message: str 

class FileAccessResponse(Schema):
    success: bool
    download_url: Optional[str]
    message: str