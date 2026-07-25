from minio import Minio
import boto3
from django.conf import settings
import os
from datetime import timedelta

class StorageService:
    ALLOWED_CONTENT_TYPES = ['application/pdf']
    MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5MB
    
    def __init__(self):
        # Local filesystem mode (development): no S3 client needed. Uploads go to
        # a local Django endpoint and files are served back from MEDIA_ROOT.
        self.local = getattr(settings, 'USE_LOCAL_STORAGE', False)
        if not self.local:
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
                aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
                region_name=os.getenv('AWS_REGION', 'eu-west-2')
            )
        self.bucket = os.getenv('STORAGE_BUCKET_NAME', 'marked-bucket')
        self.is_production = True

    def upload_file(self, file_obj, object_name, content_type):
        """Upload a file to storage"""
        try:
            self.s3_client.upload_fileobj(
                file_obj,
                self.bucket,
                object_name,
                ExtraArgs={'ContentType': content_type}
            )
            return True
        except Exception as e:
            print(f"Error uploading file: {e}")
            return False

    def get_presigned_url(self, object_name, expires=3600, response_content_type=None, response_content_disposition=None):
        """Generate a presigned URL for downloading"""
        if self.local:
            # Served by the local Django endpoint; browser-reachable path.
            from urllib.parse import quote
            return f"/api/files/local?key={quote(object_name)}"
        try:
            params = {
                'Bucket': self.bucket,
                'Key': object_name
            }
            
            if response_content_type:
                params['ResponseContentType'] = response_content_type
            if response_content_disposition:
                params['ResponseContentDisposition'] = response_content_disposition

            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params=params,
                ExpiresIn=int(expires)
            )
            return url
        except Exception as e:
            print(f"Error generating presigned URL: {e}")
            return None

    def validate_file(self, file_obj, content_type):
        """Validate file size and type"""
        # Check file size
        if hasattr(file_obj, 'size'):
            if file_obj.size > self.MAX_FILE_SIZE_BYTES:
                raise ValueError(f"File size exceeds maximum allowed size of {self.MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB")
        
        # Validate content type
        if content_type not in self.ALLOWED_CONTENT_TYPES:
            raise ValueError(f"Invalid file type. Allowed types: {', '.join(self.ALLOWED_CONTENT_TYPES)}")
        
        return True

    def get_presigned_put_url(self, object_name, expires=3600, content_type=None):
        """Generate a presigned URL for uploading with content type validation"""
        if content_type and content_type not in self.ALLOWED_CONTENT_TYPES:
            raise ValueError(f"Invalid file type. Allowed types: {', '.join(self.ALLOWED_CONTENT_TYPES)}")
        if self.local:
            # Same shape as an S3 presigned POST ({url, fields}) so the frontend
            # upload code is identical: it POSTs the fields + file to `url`.
            return {
                "url": "/api/files/local-upload",
                "fields": {"key": object_name, "content_type": content_type or 'application/pdf'},
            }
        try:
            if content_type and content_type not in self.ALLOWED_CONTENT_TYPES:
                raise ValueError(f"Invalid file type. Allowed types: {', '.join(self.ALLOWED_CONTENT_TYPES)}")

            url = self.s3_client.generate_presigned_post(
                Bucket=self.bucket,
                Key=object_name,
                Conditions=[
                    ["content-length-range", 0, self.MAX_FILE_SIZE_BYTES],
                ],
                ExpiresIn=int(expires)
            )
            return url
        except Exception as e:
            print(f"Error generating presigned upload URL: {e}")
            return None
    
    def get_permanent_url(self, object_name):
        """Generate a permanent URL for accessing files"""
        if self.local:
            return object_name
        return f"https://{self.bucket}.s3.amazonaws.com/{object_name}"