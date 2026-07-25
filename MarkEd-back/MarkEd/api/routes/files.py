from typing import Literal
from ninja import Router
from ..schemas.file import FileAccessResponse, FileUploadResponse
from ..decorators import require_auth
from django.conf import settings
from django.http import FileResponse, HttpResponse
import os
import uuid
from datetime import timedelta
from ...services.storage import StorageService


router = Router()


def _safe_media_path(key: str) -> str:
    """Resolve a storage key to a path inside MEDIA_ROOT, blocking traversal."""
    key = (key or '').lstrip('/').replace('..', '')
    root = os.path.realpath(settings.MEDIA_ROOT)
    path = os.path.realpath(os.path.join(root, key))
    if not path.startswith(root):
        raise ValueError('Invalid path')
    return path


@router.post("/local-upload", auth=None, operation_id="localUpload")
def local_upload(request):
    """Local-storage upload target (development only). Accepts the same multipart
    body an S3 presigned POST would (a `key` field + the `file`) and writes it to
    MEDIA_ROOT so the submit/upload flow works without AWS credentials."""
    if not getattr(settings, 'USE_LOCAL_STORAGE', False):
        return HttpResponse('Local storage disabled', status=403)
    key = request.POST.get('key')
    upload = request.FILES.get('file')
    if not key or not upload:
        return HttpResponse('Missing key or file', status=400)
    if upload.size > StorageService.MAX_FILE_SIZE_BYTES:
        return HttpResponse('File too large', status=413)
    try:
        path = _safe_media_path(key)
    except ValueError:
        return HttpResponse('Invalid key', status=400)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as out:
        for chunk in upload.chunks():
            out.write(chunk)
    return HttpResponse(status=204)


@router.get("/local", auth=None, operation_id="localFile")
def local_file(request, key: str):
    """Serve a locally-stored file (development only), inline as a PDF."""
    if not getattr(settings, 'USE_LOCAL_STORAGE', False):
        return HttpResponse('Local storage disabled', status=403)
    try:
        path = _safe_media_path(key)
    except ValueError:
        return HttpResponse('Invalid key', status=400)
    if not os.path.exists(path):
        return HttpResponse('Not found', status=404)
    resp = FileResponse(open(path, 'rb'), content_type='application/pdf')
    resp['Content-Disposition'] = 'inline'
    return resp


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