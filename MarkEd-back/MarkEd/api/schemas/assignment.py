from ninja import Schema
from typing import List, Optional, Dict
from datetime import datetime

class AssignmentSchema(Schema):
    id: int
    course_id: int
    assignmentTitle: str
    assignmentDescription: Optional[str] = None
    deadline: datetime
    assignment_instructions: Optional[List[str]] = None
    # Unified: INDIVIDUAL | GROUP (Unified PRD §6.2)
    assignment_type: str
    status: int

    # Group configuration (from Hao)
    group_set_id: Optional[int] = None
    max_group_size: Optional[int] = None
    min_group_size: Optional[int] = None

    # Peer review configuration (from Tomas). These are nullable on the model —
    # an assignment with peer review switched off has none of them — so they
    # must be optional here too.
    peer_review_enabled: bool = False
    is_peer_review_matching_complete: bool = False
    review_deadline: Optional[datetime] = None
    reviews_per_student: Optional[int] = None
    release_date: Optional[datetime] = None

    # Self-assessment configuration (from Mingyue). Resolved from the related
    # SelfAssessmentSetting so the UI can decide whether to offer the feature.
    self_assessment_enabled: bool = False
    self_assessment_deadline: Optional[datetime] = None

    @staticmethod
    def resolve_self_assessment_enabled(obj) -> bool:
        setting = getattr(obj, 'selfassessmentsetting', None)
        return bool(setting and setting.enabled)

    @staticmethod
    def resolve_self_assessment_deadline(obj):
        setting = getattr(obj, 'selfassessmentsetting', None)
        return setting.deadline if setting and setting.enabled else None

class AssignmentCreateRequest(Schema):
    """Unified create form (Design PRD): an INDIVIDUAL or GROUP assignment with
    peer review and self-assessment as independent configuration toggles."""
    title: str
    description: Optional[str] = None
    deadline: datetime
    assignmentWebsite: Optional[str] = None
    assignment_type: str  # 'INDIVIDUAL' | 'GROUP'
    group_set_id: Optional[int] = None
    min_group_size: Optional[int] = None
    max_group_size: Optional[int] = None
    peer_review_enabled: bool = False
    reviews_per_student: Optional[int] = None
    review_deadline: Optional[datetime] = None
    self_assessment_enabled: bool = False
    self_assessment_deadline: Optional[datetime] = None


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