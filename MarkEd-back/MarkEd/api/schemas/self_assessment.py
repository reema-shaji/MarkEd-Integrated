from ninja import Schema
from typing import Dict, List, Optional
from datetime import datetime


class SelfAssessmentSettingSchema(Schema):
    assignment_id: int
    enabled: bool
    use_checklist: bool
    use_rubric: bool
    use_reflection: bool
    deadline: Optional[datetime] = None
    needs_feedback: bool
    max_score: int


class SelfAssessmentSettingUpdateRequest(Schema):
    enabled: Optional[bool] = None
    use_checklist: Optional[bool] = None
    use_rubric: Optional[bool] = None
    use_reflection: Optional[bool] = None
    deadline: Optional[datetime] = None
    needs_feedback: Optional[bool] = None
    max_score: Optional[int] = None


# --- Checklist ---------------------------------------------------------------

class ChecklistItemSchema(Schema):
    id: int
    assignment_id: int
    name: str
    description: str = ''


class ChecklistItemRequest(Schema):
    name: str
    description: str = ''


# --- Gibbs reflection --------------------------------------------------------

class ReflectionPromptSchema(Schema):
    stage: str
    label: str
    prompt_text: str


class ReflectionPromptsSaveRequest(Schema):
    prompts: Dict[str, str]
    """Map of Gibbs stage -> prompt text."""


# --- Rubric self-grading -----------------------------------------------------

class RubricTreeNode(Schema):
    """Mirrors the jsTree node shape Mingyue's configuration page consumed."""
    id: int
    name: str
    marks: float
    selected: bool
    children: List['RubricTreeNode'] = []


RubricTreeNode.model_rebuild()


class RubricSelectionSaveRequest(Schema):
    criteria_ids: List[int]


class RubricLevelSchema(Schema):
    id: int
    name: str
    description: str
    marks: float


class RubricItemSchema(Schema):
    criteria_id: int
    name: str
    full_path: str
    levels: List[RubricLevelSchema]


# --- Student-facing form -----------------------------------------------------

class SelfAssessmentFormSchema(Schema):
    assignment_id: int
    enabled: bool
    deadline: Optional[datetime] = None
    is_late: bool = False

    use_checklist: bool
    checklist_items: List[ChecklistItemSchema]

    use_reflection: bool
    reflection_prompts: List[ReflectionPromptSchema]

    use_rubric: bool
    rubric_items: List[RubricItemSchema]

    # Previously saved answers, so the form reopens where the student left off.
    checklist_answers: Dict[str, bool]
    rubric_answers: Dict[str, int]
    reflection_answers: Dict[str, str]
    feedback_text: str = ''
    submitted_at: Optional[datetime] = None


class SelfAssessmentSubmitRequest(Schema):
    checklist: Dict[str, bool] = {}
    rubric: Dict[str, int] = {}
    reflection: Dict[str, str] = {}


class SelfAssessmentSubmitResponse(Schema):
    success: bool
    submission_id: Optional[int] = None
    message: str = ''


# --- Marker-facing view (SA card on the marking page, Mingyue SA-8) ----------

class SAChecklistAnswerSchema(Schema):
    name: str
    description: str = ''
    checked: bool


class SARubricAnswerSchema(Schema):
    criteria_name: str
    element_name: Optional[str] = None
    element_description: Optional[str] = None
    marks: Optional[float] = None


class SAReflectionAnswerSchema(Schema):
    stage: str
    label: str
    prompt_text: str
    answer: str


class StudentSelfAssessmentSchema(Schema):
    submission_id: int
    student_id: int
    userNumber: str
    userName: str
    submitted_at: datetime
    is_late: bool
    checklist: List[SAChecklistAnswerSchema]
    rubric: List[SARubricAnswerSchema]
    rubric_total: float
    reflections: List[SAReflectionAnswerSchema]
    feedback_text: str = ''


class SAFeedbackRequest(Schema):
    feedback_text: str


class SAStatusSchema(Schema):
    """Badge shown on the student's assignment card: Submitted / Late / Not submitted."""
    enabled: bool
    status: str
    deadline: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
