from typing import Literal
from ninja import Router
from ..schemas.file import FileAccessResponse, FileUploadResponse
from ..decorators import require_auth
from django.conf import settings
import uuid
from datetime import timedelta
from ...services.storage import StorageService  


router = Router()


@router.get("/get-submission-file-access-url", response=FileAccessResponse, operation_id="getSubmissionFileAccessUrl")
@require_auth()
def get_submission_file_access_url(request, assignment_id: int, filename: str):
    """Get the presigned URL for a submission file"""
    try:
        # TODO: Add permission checks here
        storage = StorageService()
        download_url = storage.get_presigned_url(
            filename,
            expires=timedelta(minutes=5).total_seconds(),
            response_content_type='application/pdf',
            response_content_disposition='inline'
        )

        return {
            "success": True,
            "download_url": download_url,
            "message": "Download URL generated successfully"
        }

    except Exception as e:
        return {
            "success": False,
            "download_url": None,
            "message": f"Error generating download URL: {str(e)}"
        }


@router.get("/get-instruction-file-access-url", response=FileAccessResponse, operation_id="getInstructionFileAccessUrl")
@require_auth()
def get_instruction_file_access_url(request, assignment_id: int, filename: str):
    """
    Get the presigned URL for a file
    TODO: Check permissions of user to access the file. They need to be enrolled in the course and the assingment must be open
    """
    try:
        storage = StorageService()
        download_url = storage.get_presigned_url(f"instruction/{filename}", expires=timedelta(days=7).total_seconds())

        return {
            "success": True,
            "download_url": download_url,
            "message": "Download URL generated successfully"
        }

    except Exception as e:
        print("error", e)
        return {
            "success": False,
            "download_url": None,
            "message": f"Error generating download URL: {str(e)}"
        }

@router.post("/get-upload-url", response=FileUploadResponse, operation_id="getUploadUrl")
@require_auth()
def get_upload_url(request, filename: str, type: Literal["submission", "instruction"], content_type: str):
    try:
        # Basic filename validation
        if not filename or len(filename) > 255:
            return {
                "success": False,
                "message": "Invalid filename",
                "upload_url": None,
                "permanent_url": None
            }

        # Validate file extension
        file_extension = filename.split('.')[-1].lower()
        if file_extension != 'pdf':
            return {
                "success": False,
                "message": "Only PDF files are allowed",
                "upload_url": None,
                "permanent_url": None
            }

        # Generate unique filename
        unique_filename = f"{type}/{uuid.uuid4()}.{file_extension}"
        
        storage = StorageService()
        
        # Get presigned URL with content type validation
        upload_url = storage.get_presigned_put_url(
            unique_filename, 
            expires=1800,  # 30 minutes
            content_type=content_type
        )
        
        if not upload_url:
            return {
                "success": False,
                "message": "Failed to generate upload URL",
                "upload_url": None,
                "permanent_url": None
            }

        return {
            "success": True,
            "upload_url": upload_url,
            "permanent_url": unique_filename,
            "message": "Upload URL generated successfully"
        }

    except ValueError as e:
        return {
            "success": False,
            "message": str(e),
            "upload_url": None,
            "permanent_url": None
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Error generating upload URLs: {str(e)}",
            "upload_url": None,
            "permanent_url": None
        } 