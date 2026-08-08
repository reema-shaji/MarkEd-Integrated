"""Self-assessment API — ported from Mingyue Qin's branch.

Source: "MarkEd Self-Assessment-Mingyue"/MarkEd/teacher/views.py and
student/views.py. The configuration model (per-assignment toggle, checklist,
Gibbs reflective cycle, rubric self-grading) and the answer shapes are carried
over unchanged; only the transport layer becomes django-ninja.

Answer shapes, as stored by Mingyue:
    checklist_answers          {checklist_item_id: bool}
    rubric_answers             {criteria_id: element_id}
    guided_reflection_answers  {gibbs_stage: text}
"""
from typing import List, Optional

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Router
from ninja.errors import HttpError

from ..decorators import require_auth
from ..schemas.self_assessment import (
    ChecklistItemRequest,
    ChecklistItemSchema,
    ReflectionPromptSchema,
    ReflectionPromptsSaveRequest,
    RubricSelectionSaveRequest,
    RubricTreeNode,
    SAFeedbackRequest,
    SAStatusSchema,
    SelfAssessmentFormSchema,
    SelfAssessmentSettingSchema,
    SelfAssessmentSettingUpdateRequest,
    SelfAssessmentSubmitRequest,
    SelfAssessmentSubmitResponse,
    StudentSelfAssessmentSchema,
)
from ...models import (
    Assignment,
    ChecklistItem,
    Course2Marker,
    Course2Student,
    Criteria,
    Element,
    ReflectionPrompt,
    SelfAssessmentRubricSelection,
    SelfAssessmentSetting,
    StudentSelfAssessmentSubmission,
    User,
)

router = Router()          # mounted at /assignments (assignment-scoped)
sa_router = Router()       # mounted at /self-assessment (item-scoped)

STAFF_ROLES = ['Academic', 'Marker', 'TA']

# Gibbs' reflective cycle, in order. Defaults ported verbatim from Mingyue's
# self_assessment_configure (teacher/views.py:3991).
STAGE_CHOICES = [
    ('description', 'Description'),
    ('feelings', 'Feelings'),
    ('evaluation', 'Evaluation'),
    ('analysis', 'Analysis'),
    ('conclusion', 'Conclusion'),
    ('action_plan', 'Action Plan'),
]

DEFAULT_PROMPTS = {
    'description': "What happened? Who was involved? What was the outcome?",
    'feelings': "What were you thinking and feeling before, during, and after the experience?",
    'evaluation': "What went well and what didn’t? Why?",
    'analysis': "Why did things happen the way they did? What can you learn from this?",
    'conclusion': "What did you learn? What could you have done differently?",
    'action_plan': "If a similar situation arises, what would you do? How will you prepare?",
}

STAGE_LABELS = dict(STAGE_CHOICES)


# =============================================================================
# Helpers
# =============================================================================

def _assignment_for_staff(request, assignment_id: int) -> Assignment:
    assignment = get_object_or_404(Assignment, pk=assignment_id)
    if not Course2Marker.objects.filter(
        course_id=assignment.course_id, marker_id=request.user_id
    ).exists():
        raise HttpError(403, "You do not have access to this assignment")
    return assignment


def _assignment_for_student(request, assignment_id: int) -> Assignment:
    assignment = get_object_or_404(Assignment, pk=assignment_id)
    if not Course2Student.objects.filter(
        course_id=assignment.course_id, student_id=request.user_id
    ).exists():
        raise HttpError(403, "You are not enrolled in this course")
    return assignment


def _setting(assignment_id: int) -> SelfAssessmentSetting:
    setting, _ = SelfAssessmentSetting.objects.get_or_create(assignment_id=assignment_id)
    return setting


def _serialize_setting(s: SelfAssessmentSetting) -> dict:
    return {
        'assignment_id': s.assignment_id,
        'enabled': s.enabled,
        'use_checklist': s.use_checklist,
        'use_rubric': s.use_rubric,
        'use_reflection': s.use_reflection,
        'deadline': s.deadline,
        'needs_feedback': s.needs_feedback,
        'max_score': s.max_score,
    }


def _full_path(criterion: Criteria) -> str:
    """Breadcrumb of criterion names from the root down, as Mingyue displayed."""
    parts = [criterion.name]
    node = criterion.parent
    seen = {criterion.id}
    while node is not None and node.id not in seen:
        parts.append(node.name)
        seen.add(node.id)
        node = node.parent
    return " › ".join(reversed(parts))


def _rubric_items(assignment_id: int) -> List[dict]:
    """Leaf criteria the teacher selected, each with its elements as levels.

    Ported from Mingyue's student_self_assessment (student/views.py:429): a
    selected criterion is only offered for self-grading if it is a leaf, i.e.
    no other selected criterion has it as a parent.
    """
    selected_ids = list(
        SelfAssessmentRubricSelection.objects.filter(
            assignment_id=assignment_id
        ).values_list('criteria_id', flat=True)
    )
    non_leaf_ids = (
        Criteria.objects.filter(parent_id__in=selected_ids)
        .values_list('parent_id', flat=True)
        .distinct()
    )
    leaves = Criteria.objects.filter(id__in=selected_ids).exclude(id__in=non_leaf_ids)

    items = []
    for criterion in leaves:
        levels = Element.objects.filter(criteria=criterion).order_by('marks')
        items.append(
            {
                'criteria_id': criterion.id,
                'name': criterion.name,
                'full_path': _full_path(criterion),
                'marks': criterion.marks,
                'levels': [
                    {
                        'id': el.id,
                        'name': el.name,
                        'description': el.description,
                        'marks': el.marks,
                    }
                    for el in levels
                ],
            }
        )
    return items


def _reflection_prompts(assignment_id: int) -> List[dict]:
    """Saved prompts, falling back to Mingyue's defaults per stage."""
    saved = {
        rp.stage: rp.prompt_text
        for rp in ReflectionPrompt.objects.filter(assignment_id=assignment_id)
    }
    return [
        {
            'stage': stage,
            'label': label,
            'prompt_text': saved.get(stage, DEFAULT_PROMPTS[stage]),
        }
        for stage, label in STAGE_CHOICES
    ]


def _sa_status(setting: SelfAssessmentSetting, submission) -> str:
    if not setting.enabled:
        return 'Not enabled'
    if submission is None:
        return 'Not submitted'
    if setting.deadline and submission.submitted_at > setting.deadline:
        return 'Late'
    return 'Submitted'


def _latest_submission(assignment_id: int, student_id: int):
    return (
        StudentSelfAssessmentSubmission.objects.filter(
            assignment_id=assignment_id, student_id=student_id
        )
        .order_by('-submitted_at')
        .first()
    )


# =============================================================================
# Teacher configuration
# =============================================================================

@router.get(
    "/{assignment_id}/self-assessment/settings",
    response=SelfAssessmentSettingSchema,
    operation_id="getSelfAssessmentSettings",
)
@require_auth(roles=STAFF_ROLES)
def get_settings(request, assignment_id: int):
    _assignment_for_staff(request, assignment_id)
    return _serialize_setting(_setting(assignment_id))


@router.post(
    "/{assignment_id}/self-assessment/settings",
    response=SelfAssessmentSettingSchema,
    operation_id="updateSelfAssessmentSettings",
)
@require_auth(roles=STAFF_ROLES)
def update_settings(request, assignment_id: int, payload: SelfAssessmentSettingUpdateRequest):
    assignment = _assignment_for_staff(request, assignment_id)
    setting = _setting(assignment_id)
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(setting, field, value)
    if setting.deadline and setting.deadline < assignment.deadline:
        # Mingyue's academics asked what the separate SA deadline meant; the
        # unified form keeps it but rejects the nonsensical ordering.
        raise HttpError(
            400, "The self-assessment deadline cannot be before the assignment deadline"
        )
    setting.save()
    return _serialize_setting(setting)


@router.get(
    "/{assignment_id}/self-assessment/checklist",
    response=List[ChecklistItemSchema],
    operation_id="listChecklistItems",
)
@require_auth()
def list_checklist_items(request, assignment_id: int):
    return list(ChecklistItem.objects.filter(assignment_id=assignment_id))


@router.post(
    "/{assignment_id}/self-assessment/checklist",
    response=ChecklistItemSchema,
    operation_id="addChecklistItem",
)
@require_auth(roles=STAFF_ROLES)
def add_checklist_item(request, assignment_id: int, payload: ChecklistItemRequest):
    _assignment_for_staff(request, assignment_id)
    if not payload.name.strip():
        raise HttpError(400, "Checklist item text is required")
    item = ChecklistItem.objects.create(
        assignment_id=assignment_id,
        name=payload.name.strip(),
        description=payload.description or '',
    )
    # Mingyue turned the checklist section on automatically once an item existed.
    setting = _setting(assignment_id)
    if not setting.use_checklist:
        setting.use_checklist = True
        setting.save()
    return item


@sa_router.patch(
    "/checklist/{item_id}", response=ChecklistItemSchema, operation_id="editChecklistItem"
)
@require_auth(roles=STAFF_ROLES)
def edit_checklist_item(request, item_id: int, payload: ChecklistItemRequest):
    item = get_object_or_404(ChecklistItem, pk=item_id)
    _assignment_for_staff(request, item.assignment_id)
    item.name = payload.name.strip()
    item.description = payload.description or ''
    item.save()
    return item


@sa_router.delete("/checklist/{item_id}", operation_id="deleteChecklistItem")
@require_auth(roles=STAFF_ROLES)
def delete_checklist_item(request, item_id: int):
    item = get_object_or_404(ChecklistItem, pk=item_id)
    assignment_id = item.assignment_id
    _assignment_for_staff(request, assignment_id)
    item.delete()
    # Mirrors Mingyue: the section switches off when the last item goes.
    if not ChecklistItem.objects.filter(assignment_id=assignment_id).exists():
        setting = _setting(assignment_id)
        setting.use_checklist = False
        setting.save()
    return {'success': True}


@router.get(
    "/{assignment_id}/self-assessment/reflections",
    response=List[ReflectionPromptSchema],
    operation_id="getReflectionPrompts",
)
@require_auth()
def get_reflection_prompts(request, assignment_id: int):
    return _reflection_prompts(assignment_id)


@router.post(
    "/{assignment_id}/self-assessment/reflections",
    response=List[ReflectionPromptSchema],
    operation_id="saveReflectionPrompts",
)
@require_auth(roles=STAFF_ROLES)
def save_reflection_prompts(request, assignment_id: int, payload: ReflectionPromptsSaveRequest):
    _assignment_for_staff(request, assignment_id)
    valid = set(STAGE_LABELS)
    with transaction.atomic():
        for stage, text in payload.prompts.items():
            if stage not in valid:
                raise HttpError(400, f"Unknown reflection stage '{stage}'")
            ReflectionPrompt.objects.update_or_create(
                assignment_id=assignment_id, stage=stage, defaults={'prompt_text': text}
            )
    return _reflection_prompts(assignment_id)


@router.get(
    "/{assignment_id}/self-assessment/rubric-tree",
    response=List[RubricTreeNode],
    operation_id="getRubricTree",
)
@require_auth(roles=STAFF_ROLES)
def get_rubric_tree(request, assignment_id: int):
    """Criteria hierarchy with current selections.

    Replaces Mingyue's build_rubric_json (which emitted jsTree's node format)
    with a plain nested structure; the React checkbox tree renders the same
    hierarchy and selection state.
    """
    _assignment_for_staff(request, assignment_id)
    selected = set(
        SelfAssessmentRubricSelection.objects.filter(
            assignment_id=assignment_id
        ).values_list('criteria_id', flat=True)
    )

    def build(parent_id: Optional[int]):
        return [
            {
                'id': node.id,
                'name': node.name,
                'marks': node.marks,
                'selected': node.id in selected,
                'children': build(node.id),
            }
            for node in Criteria.objects.filter(
                assignment_id=assignment_id, parent_id=parent_id
            )
        ]

    return build(None)


@router.post(
    "/{assignment_id}/self-assessment/rubric-selection",
    operation_id="saveRubricSelection",
)
@require_auth(roles=STAFF_ROLES)
def save_rubric_selection(request, assignment_id: int, payload: RubricSelectionSaveRequest):
    _assignment_for_staff(request, assignment_id)
    valid_ids = set(
        Criteria.objects.filter(assignment_id=assignment_id).values_list('id', flat=True)
    )
    unknown = set(payload.criteria_ids) - valid_ids
    if unknown:
        raise HttpError(400, "Criteria do not belong to this assignment")

    with transaction.atomic():
        SelfAssessmentRubricSelection.objects.filter(assignment_id=assignment_id).delete()
        SelfAssessmentRubricSelection.objects.bulk_create(
            [
                SelfAssessmentRubricSelection(assignment_id=assignment_id, criteria_id=cid)
                for cid in payload.criteria_ids
            ]
        )
        setting = _setting(assignment_id)
        setting.use_rubric = bool(payload.criteria_ids)
        setting.save()

    return {'success': True, 'selected': len(payload.criteria_ids)}


# =============================================================================
# Student form (Mingyue SA-7)
# =============================================================================

@router.get(
    "/{assignment_id}/self-assessment/form",
    response=SelfAssessmentFormSchema,
    operation_id="getSelfAssessmentForm",
)
@require_auth(roles=['Student'])
def get_self_assessment_form(request, assignment_id: int):
    _assignment_for_student(request, assignment_id)
    setting = _setting(assignment_id)
    if not setting.enabled:
        raise HttpError(404, "Self-assessment is not enabled for this assignment")

    previous = _latest_submission(assignment_id, request.user_id)
    checklist_answers, rubric_answers, reflection_answers, feedback_text = {}, {}, {}, ''
    if previous:
        checklist_answers = {str(k): bool(v) for k, v in (previous.checklist_answers or {}).items()}
        # Keep the value as-is: an element id (level) or a direct score.
        rubric_answers = {str(k): float(v) for k, v in (previous.rubric_answers or {}).items()}
        reflection_answers = previous.guided_reflection_answers or {}
        feedback_text = previous.feedback_text or ''

    return {
        'assignment_id': assignment_id,
        'enabled': setting.enabled,
        'deadline': setting.deadline,
        'is_late': bool(setting.deadline and timezone.now() > setting.deadline),
        'use_checklist': setting.use_checklist,
        'checklist_items': list(ChecklistItem.objects.filter(assignment_id=assignment_id))
        if setting.use_checklist
        else [],
        'use_reflection': setting.use_reflection,
        'reflection_prompts': _reflection_prompts(assignment_id) if setting.use_reflection else [],
        'use_rubric': setting.use_rubric,
        'rubric_items': _rubric_items(assignment_id) if setting.use_rubric else [],
        'checklist_answers': checklist_answers,
        'rubric_answers': rubric_answers,
        'reflection_answers': reflection_answers,
        'feedback_text': feedback_text,
        'submitted_at': previous.submitted_at if previous else None,
    }


@router.post(
    "/{assignment_id}/self-assessment/submit",
    response=SelfAssessmentSubmitResponse,
    operation_id="submitSelfAssessment",
)
@require_auth(roles=['Student'])
def submit_self_assessment(request, assignment_id: int, payload: SelfAssessmentSubmitRequest):
    """Record a self-assessment.

    Mingyue deliberately allowed repeat submissions and displayed the latest,
    so this creates a new row rather than updating in place.
    """
    _assignment_for_student(request, assignment_id)
    setting = _setting(assignment_id)
    if not setting.enabled:
        raise HttpError(403, "Self-assessment is not enabled for this assignment")

    submission = StudentSelfAssessmentSubmission.objects.create(
        student_id=request.user_id,
        assignment_id=assignment_id,
        checklist_answers=payload.checklist,
        rubric_answers=payload.rubric,
        guided_reflection_answers=payload.reflection,
    )
    late = bool(setting.deadline and submission.submitted_at > setting.deadline)
    return {
        'success': True,
        'submission_id': submission.id,
        'message': 'Self-assessment submitted late' if late else 'Self-assessment submitted',
    }


@router.get(
    "/{assignment_id}/self-assessment/status",
    response=SAStatusSchema,
    operation_id="getSelfAssessmentStatus",
)
@require_auth(roles=['Student'])
def get_self_assessment_status(request, assignment_id: int):
    """Badge for the student's assignment card (Mingyue SA-10)."""
    setting = _setting(assignment_id)
    previous = _latest_submission(assignment_id, request.user_id)
    return {
        'enabled': setting.enabled,
        'status': _sa_status(setting, previous),
        'deadline': setting.deadline if setting.enabled else None,
        'submitted_at': previous.submitted_at if previous else None,
    }


# =============================================================================
# Marker view — the SA card on the marking page (Mingyue SA-8)
# =============================================================================

def _serialize_student_sa(submission, setting) -> dict:
    """Resolve stored IDs into the names/levels a marker needs to read."""
    student = submission.student

    checklist = []
    if submission.checklist_answers:
        items = {
            i.id: i for i in ChecklistItem.objects.filter(assignment_id=submission.assignment_id)
        }
        for raw_id, checked in submission.checklist_answers.items():
            item = items.get(int(raw_id))
            if item:
                checklist.append(
                    {
                        'name': item.name,
                        'description': item.description or '',
                        'checked': bool(checked),
                    }
                )

    rubric, rubric_total = [], 0.0
    if submission.rubric_answers:
        for raw_criteria_id, value in submission.rubric_answers.items():
            criterion = Criteria.objects.filter(id=int(raw_criteria_id)).first()
            if criterion is None:
                continue
            # Level-based criteria store an element id; criteria with no levels
            # store a direct self-graded score.
            if Element.objects.filter(criteria=criterion).exists():
                element = (
                    Element.objects.filter(id=int(value)).first()
                    if value is not None
                    else None
                )
                if element is not None:
                    rubric_total += element.marks
                rubric.append(
                    {
                        'criteria_name': criterion.name,
                        'element_name': element.name if element else None,
                        'element_description': element.description if element else None,
                        'marks': element.marks if element else None,
                    }
                )
            else:
                score = float(value) if value is not None else None
                if score is not None:
                    rubric_total += score
                rubric.append(
                    {
                        'criteria_name': criterion.name,
                        'element_name': None,
                        'element_description': None,
                        'marks': score,
                    }
                )

    reflections = []
    answers = submission.guided_reflection_answers or {}
    if answers:
        prompts = {p['stage']: p['prompt_text'] for p in _reflection_prompts(submission.assignment_id)}
        for stage, label in STAGE_CHOICES:
            if stage in answers:
                reflections.append(
                    {
                        'stage': stage,
                        'label': label,
                        'prompt_text': prompts.get(stage, DEFAULT_PROMPTS[stage]),
                        'answer': answers.get(stage, ''),
                    }
                )

    return {
        'submission_id': submission.id,
        'student_id': student.id,
        'userNumber': student.userNumber,
        'userName': student.userName,
        'submitted_at': submission.submitted_at,
        'is_late': bool(setting.deadline and submission.submitted_at > setting.deadline),
        'checklist': checklist,
        'rubric': rubric,
        'rubric_total': rubric_total,
        'reflections': reflections,
        'feedback_text': submission.feedback_text or '',
    }


@router.get(
    "/{assignment_id}/self-assessment/student/{student_id}",
    response=StudentSelfAssessmentSchema,
    operation_id="getStudentSelfAssessment",
)
@require_auth(roles=STAFF_ROLES)
def get_student_self_assessment(request, assignment_id: int, student_id: int):
    _assignment_for_staff(request, assignment_id)
    submission = _latest_submission(assignment_id, student_id)
    if submission is None:
        raise HttpError(404, "This student has not submitted a self-assessment")
    return _serialize_student_sa(submission, _setting(assignment_id))


@router.get(
    "/{assignment_id}/self-assessment/submissions",
    response=List[StudentSelfAssessmentSchema],
    operation_id="listSelfAssessmentSubmissions",
)
@require_auth(roles=STAFF_ROLES)
def list_self_assessment_submissions(request, assignment_id: int):
    """Latest self-assessment per student, for the marker's overview."""
    _assignment_for_staff(request, assignment_id)
    setting = _setting(assignment_id)
    latest = {}
    for s in (
        StudentSelfAssessmentSubmission.objects.filter(assignment_id=assignment_id)
        .select_related('student')
        .order_by('student_id', '-submitted_at')
    ):
        latest.setdefault(s.student_id, s)
    return [_serialize_student_sa(s, setting) for s in latest.values()]


@sa_router.post(
    "/submissions/{submission_id}/feedback",
    response=StudentSelfAssessmentSchema,
    operation_id="saveSelfAssessmentFeedback",
)
@require_auth(roles=STAFF_ROLES)
def save_self_assessment_feedback(request, submission_id: int, payload: SAFeedbackRequest):
    """Teacher feedback on a self-assessment — a single text box, as Mingyue built it."""
    submission = get_object_or_404(StudentSelfAssessmentSubmission, pk=submission_id)
    _assignment_for_staff(request, submission.assignment_id)
    submission.feedback_text = payload.feedback_text.strip()
    submission.save()
    return _serialize_student_sa(submission, _setting(submission.assignment_id))
