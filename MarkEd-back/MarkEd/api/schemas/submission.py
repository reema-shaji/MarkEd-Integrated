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

class CriterionResultEntry(Schema):
    """One rubric criterion's mark on the student's own submission."""
    name: str
    score: float
    max: float
    feedback: Optional[str] = None


class MySubmissionResultSchema(Schema):
    """A student's own mark for an individual assignment.

    Mirrors the original student-home mark (Tomas' student/views.home): the mark
    is only revealed once every criterion is Finished. Until then `released` is
    False and the numbers are withheld — the same finished-only gate the source
    used before showing a mark instead of "-".
    """
    released: bool
    status: str  # 'Submitted' | 'Marking' | 'Finished'
    score: float
    total: float
    percentage: float
    breakdown: List[CriterionResultEntry]


class AllSubmissionSchema(Schema):
    id: int
    student_id: int
    student_number: str
    student_name: str
    assignment_id: int
    submissionFile: str
    submissionDateTime: datetime