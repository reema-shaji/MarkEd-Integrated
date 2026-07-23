from ninja import Schema
from typing import List, Optional, Dict
from datetime import datetime

class AssignmentSchema(Schema):
    id: int
    assignmentTitle: str
    assignmentDescription: Optional[str]
    deadline: datetime
    assignment_instructions: Optional[List[str]]
    assignment_type: str
    status: int
    is_peer_review_matching_complete: bool
    review_deadline: datetime
    reviews_per_student: int
    release_date: datetime

class PeerAssignmentRequest(Schema):
    course_id: str
    title: str
    description: str
    reviews_per_student: int
    release_date: datetime
    submission_deadline: datetime
    review_deadline: datetime
    instructions: Optional[List[str]] = None
    max_submissions_per_student: int
    allow_late_submissions: bool
    students_can_see_reviews: bool
    markers_can_see_reviews: bool
    is_anonymous: bool
    markers_per_submission: int

class PeerAssignmentCreationResponse(Schema):
    success: bool
    message: str
    assignment_id: Optional[int] = None

class AssignmentStatistics(Schema):
    total_submissions: int
    unique_submitters: int
    active_users_24h: int
    total_peer_reviews: int
    peer_review_stats: Dict[str, int]  # Status counts
    average_reviews_per_student: float
    completion_rate: float