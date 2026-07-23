from ninja import Schema
from typing import List, Optional
from datetime import datetime

class SubmissionRequest(Schema):
    assignment_id: int
    files: List[str]

class SubmissionSchema(Schema):
    id: int
    student_id: int
    assignment_id: int
    submissionFile: str
    submissionDateTime: datetime

class SubmissionResponse(Schema):
    success: bool
    submission: Optional[dict] = None
    message: Optional[str] = None 
    
class PeersLastSubmissionResponse(Schema):
    success: bool
    pre_signed_file_url: Optional[str] = None
    message: Optional[str] = None 

class AllSubmissionSchema(Schema):
    id: int
    student_id: int
    student_number: str
    student_name: str
    assignment_id: int
    submissionFile: str
    submissionDateTime: datetime