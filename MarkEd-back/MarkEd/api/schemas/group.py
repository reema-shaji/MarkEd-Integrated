from ninja import Schema
from typing import List, Optional
from datetime import datetime


# --- Group sets ("Group Categories" in the UI, Unified PRD §9 b-1) -----------

class GroupSetSchema(Schema):
    id: int
    course_id: int
    name: str
    description: Optional[str] = None
    max_group_size: int
    min_group_size: int
    allow_student_self_assignment: bool
    self_assignment_deadline: Optional[datetime] = None
    created_at: datetime
    groups_count: int
    students_count: int


class GroupSetCreateRequest(Schema):
    name: str
    description: Optional[str] = None
    min_group_size: int = 2
    max_group_size: int = 5
    allow_student_self_assignment: bool = False
    self_assignment_deadline: Optional[datetime] = None


class GroupSetUpdateRequest(Schema):
    name: Optional[str] = None
    description: Optional[str] = None
    min_group_size: Optional[int] = None
    max_group_size: Optional[int] = None
    allow_student_self_assignment: Optional[bool] = None
    self_assignment_deadline: Optional[datetime] = None


# --- Groups and members ------------------------------------------------------

class GroupMemberSchema(Schema):
    id: int
    student_id: int
    userNumber: str
    userName: str
    joined_at: datetime


class GroupSchema(Schema):
    id: int
    course_id: int
    group_set_id: Optional[int] = None
    name: str
    description: Optional[str] = None
    members: List[GroupMemberSchema]


class GroupCreateRequest(Schema):
    name: str
    description: Optional[str] = None


class GroupUpdateRequest(Schema):
    name: Optional[str] = None
    description: Optional[str] = None


class UngroupedStudentSchema(Schema):
    student_id: int
    userNumber: str
    userName: str


class AddMembersRequest(Schema):
    student_ids: List[int]


class MoveMemberRequest(Schema):
    """Drag-and-drop: move a student into a target group (or out, if null)."""
    student_id: int
    target_group_id: Optional[int] = None


# --- Allocation (Hao's two algorithms) ---------------------------------------

class RandomAssignRequest(Schema):
    group_set_id: int
    method: str  # 'groups' | 'size'
    num_groups: Optional[int] = None
    group_size: Optional[int] = None
    group_name_prefix: str = 'Group'


class AutoAssignRequest(Schema):
    group_set_id: int


class ActionResponse(Schema):
    success: bool
    message: str
    assigned_count: Optional[int] = None
    groups_created: Optional[int] = None


# --- Workspace ---------------------------------------------------------------

class WorkspaceCommentSchema(Schema):
    id: int
    author_id: int
    author_name: str
    content: str
    created_at: datetime


class WorkspaceFileSchema(Schema):
    id: int
    group_id: int
    assignment_id: int
    uploaded_by_id: int
    uploaded_by_name: str
    file: Optional[str] = None
    file_name: str
    file_size: int
    file_type: str
    status: str
    upload_time: datetime
    comments: List[WorkspaceCommentSchema]


class WorkspaceFileCreateRequest(Schema):
    assignment_id: int
    file: str
    file_name: str
    file_size: int
    file_type: str


class WorkspaceCommentCreateRequest(Schema):
    content: str


# --- Group submission --------------------------------------------------------

class GroupSubmissionSchema(Schema):
    id: int
    group_id: int
    group_name: str
    assignment_id: int
    submitted_by_id: int
    submitted_by_name: str
    submissionFile: Optional[str] = None
    filename: str
    submission_version: int
    submissionDateTime: datetime


class GroupSubmitRequest(Schema):
    assignment_id: int
    file: str
    """Pre-signed S3 URL of the file being confirmed as the group's submission."""


# --- Personal contribution adjustment (Hao's headline feature) ---------------

class PersonalAdjustmentSchema(Schema):
    student_id: int
    userNumber: str
    userName: str
    group_score: float
    group_total: float
    adjustment_score: float
    adjustment_reason: Optional[str] = None
    final_score: float
    status: str


class PersonalAdjustmentEntry(Schema):
    student_id: int
    adjustment_score: float
    adjustment_reason: Optional[str] = None


class PersonalAdjustmentSaveRequest(Schema):
    adjustments: List[PersonalAdjustmentEntry]
    status: str = 'final'


class GroupResultSchema(Schema):
    """Transparent score breakdown: base + adjustment = final (Hao GM-13)."""
    group_score: float
    group_total: float
    group_percentage: float
    personal_adjustment: float
    adjustment_reason: Optional[str] = None
    final_score: float
    final_percentage: float


class MyGroupResultSchema(Schema):
    """A student's group result for an assignment, resolved by assignment id.

    `finalised` reflects whether the marker has finalised the adjustment; until
    then the breakdown is provisional and should be presented as such.
    """
    group_name: str
    submission_version: int
    finalised: bool
    breakdown: GroupResultSchema


# --- Group criteria marking (prototype "Group Marking") ----------------------

class GroupMarkingLevel(Schema):
    id: int
    name: str
    description: str
    marks: float


class GroupMarkingCriterion(Schema):
    criteria_id: int
    name: str
    marks: float
    levels: List[GroupMarkingLevel]
    selected_element_id: Optional[int] = None
    score: Optional[float] = None
    # Hao's marker-lock: a finalised criterion can no longer be changed by a
    # marker (only a course organiser can override it).
    finalised: bool = False


class GroupMarkingSchema(Schema):
    group_submission_id: int
    group_name: str
    criteria: List[GroupMarkingCriterion]
    group_score: float
    group_total: float
    finalised: bool = False


class GroupMarkEntry(Schema):
    criteria_id: int
    element_id: int


class GroupMarkingSaveRequest(Schema):
    marks: List[GroupMarkEntry]
    # When true, the saved criteria are finalised (locked to markers). Academics
    # can still override a finalised criterion.
    finalise: bool = False
