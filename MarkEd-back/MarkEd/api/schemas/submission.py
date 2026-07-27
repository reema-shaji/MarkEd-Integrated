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


# --- Individual marking (restores Hao/Tomas mark.html per-criterion scoring) --

class SubmissionCriterionMark(Schema):
    criteria_id: int
    name: str
    marks: float  # maximum for this criterion
    score: Optional[float] = None
    feedback: str = ''
    finalised: bool = False


class SubmissionMarkingSchema(Schema):
    submission_id: int
    student_name: str
    criteria: List[SubmissionCriterionMark]
    score: float
    total: float
    finalised: bool


class SubmissionMarkSaveEntry(Schema):
    criteria_id: int
    score: float
    feedback: Optional[str] = ''


class SubmissionMarkingSaveRequest(Schema):
    marks: List[SubmissionMarkSaveEntry]
    finalise: bool = False


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
    # Marking state for the Marking-tab list (was hard-coded to Submitted/—).
    marking_status: str = 'Unmarked'  # 'Unmarked' | 'In progress' | 'Marked'
    score: Optional[float] = None
    total: float = 0.0