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

class MyAssignmentStatusSchema(Schema):
    """A student's own status for an assignment (prototype Assignment Detail)."""
    assignment_id: int
    group_id: Optional[int] = None
    group_name: Optional[str] = None
    submitted: bool = False
    submitted_at: Optional[datetime] = None
    is_late: bool = False
    # Individual mark, shown on the dashboard row like the original student home.
    # Populated only once marking is finished (finished-only gate); group marks
    # come from the group-result endpoint instead.
    mark_released: bool = False
    mark_score: Optional[float] = None
    mark_total: Optional[float] = None
    mark_percentage: Optional[float] = None


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

class AssignmentUpdateRequest(Schema):
    """Editable assignment fields (prototype "Customization"). The assignment
    *type* is intentionally omitted — it is fixed at creation because it
    determines submission and review behaviour."""
    assignmentTitle: Optional[str] = None
    assignmentDescription: Optional[str] = None
    assignmentWebsite: Optional[str] = None
    deadline: Optional[datetime] = None


class StructureCriterionSchema(Schema):
    id: int
    name: str
    marks: float


class AssignmentStructureSchema(Schema):
    """Marking criteria + self-assessment status (prototype "Assignment
    Structure")."""
    criteria: List[StructureCriterionSchema] = []
    self_assessment_enabled: bool = False


class CriterionUpsertRequest(Schema):
    name: Optional[str] = None
    marks: Optional[float] = None


class MarkerJobSchema(Schema):
    """Per-marker marking allocation summary (prototype "Marking Jobs")."""
    marker_id: int
    marker_name: str
    allocated: int
    completed: int
    status: str  # 'Not Started' | 'In Progress' | 'Complete'


class AssignmentStatistics(Schema):
    total_submissions: int
    unique_submitters: int
    active_users_24h: int
    total_peer_reviews: int
    peer_review_stats: Dict[str, int]  # Status counts
    average_reviews_per_student: float
    completion_rate: float

    # Dashboard breakdowns (prototype Academic Dashboard).
    enrolled_students: int = 0
    expected_submissions: int = 0
    submission_on_time: int = 0
    submission_late: int = 0
    submission_missing: int = 0
    self_assessment_enabled: bool = False
    self_assessment_submitted: int = 0
    grade_distribution: Dict[str, int] = {}