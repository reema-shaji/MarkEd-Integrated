"""Group marking API — ported from Haoyu Wang's branch.

Source: MarkEd-Hao/MarkEd/teacher/views.py and MarkEd/student/views.py.
Hao's branch was a Django MVT monolith, so the view bodies rendered templates
and returned JsonResponse for AJAX. The business logic here (allocation
algorithms, permission rules, the additive contribution formula) is ported
as-is; only the transport layer changes from Django views to django-ninja.

Route layout follows Unified PRD §10 (Option B).
"""
import random
from typing import List, Optional

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Router
from ninja.errors import HttpError

from ..decorators import require_auth
from ..schemas.group import (
    ActionResponse,
    AddMembersRequest,
    AutoAssignRequest,
    GroupCreateRequest,
    GroupResultSchema,
    MyGroupResultSchema,
    GroupMarkingSchema,
    GroupMarkingSaveRequest,
    GroupSchema,
    GroupSetCreateRequest,
    GroupSetSchema,
    GroupSetUpdateRequest,
    GroupSubmissionSchema,
    GroupSubmitRequest,
    GroupUpdateRequest,
    MoveMemberRequest,
    PersonalAdjustmentSaveRequest,
    PersonalAdjustmentSchema,
    RandomAssignRequest,
    UngroupedStudentSchema,
    WorkspaceCommentCreateRequest,
    WorkspaceCommentSchema,
    WorkspaceFileCreateRequest,
    WorkspaceFileSchema,
)
from ...models import (
    Assignment,
    Course,
    Course2Marker,
    Course2Student,
    Criteria,
    Element,
    Group,
    GroupMember,
    GroupSet,
    GroupSubmission,
    GroupSubmissionCriteria,
    GroupSubmissionPersonalAdjustment,
    GroupSubmissionComment,
    GroupWorkspaceFile,
    User,
)

course_router = Router()
groupsets_router = Router()
groups_router = Router()


# =============================================================================
# Helpers
# =============================================================================

STAFF_ROLES = ['Academic', 'Marker', 'TA']


def _require_team_permission(request, course_id: int) -> Course:
    """Hao gated all group management on Course2Marker.teamPermission >= 2 (Write).

    Ported from teacher/views.py; Academics always pass, as in the source.
    """
    course = get_object_or_404(Course, pk=course_id)
    if request.user_role == 'Academic':
        # Academics own the course in all three branches.
        if Course2Marker.objects.filter(course=course, marker_id=request.user_id).exists():
            return course
        raise HttpError(403, "You do not have access to this course")
    relation = Course2Marker.objects.filter(course=course, marker_id=request.user_id).first()
    if not relation or relation.teamPermission < 2:
        raise HttpError(403, "Insufficient permissions to manage groups for this course")
    return course


def _group_set_or_404(group_set_id: int) -> GroupSet:
    return get_object_or_404(GroupSet, pk=group_set_id, is_active=True)


def _ungrouped_students(course: Course, group_set_id: int) -> List[User]:
    """Students enrolled in the course who are not in any active group of this set.

    Ported from Hao's get_ungrouped_students / auto_assign_ungrouped_students.
    """
    grouped_ids = GroupMember.objects.filter(
        group__group_set_id=group_set_id,
        group__is_active=True,
        is_active=True,
    ).values_list('student_id', flat=True)
    return list(
        User.objects.filter(role='S', course2student__course=course)
        .exclude(id__in=grouped_ids)
        .distinct()
    )


def _serialize_group(group: Group) -> dict:
    members = (
        GroupMember.objects.filter(group=group, is_active=True)
        .select_related('student')
        .order_by('joined_at')
    )
    return {
        'id': group.id,
        'course_id': group.course_id,
        'group_set_id': group.group_set_id,
        'name': group.name,
        'description': group.description,
        'members': [
            {
                'id': m.id,
                'student_id': m.student_id,
                'userNumber': m.student.userNumber,
                'userName': m.student.userName,
                'joined_at': m.joined_at,
            }
            for m in members
        ],
    }


def _serialize_group_set(gs: GroupSet) -> dict:
    return {
        'id': gs.id,
        'course_id': gs.course_id,
        'name': gs.name,
        'description': gs.description,
        'max_group_size': gs.max_group_size,
        'min_group_size': gs.min_group_size,
        'allow_student_self_assignment': gs.allow_student_self_assignment,
        'self_assignment_deadline': gs.self_assignment_deadline,
        'created_at': gs.created_at,
        'groups_count': gs.get_groups_count(),
        'students_count': gs.get_students_count(),
    }


def _group_base_score(group_submission: GroupSubmission) -> tuple:
    """Sum of criteria scores for a group submission -> (score, total).

    Ported from Hao's get_personal_final_score(); the source summed
    `submission_criteria.maxInput`, which on the unified schema lives on the
    linked Criteria as `marks`.
    """
    rows = GroupSubmissionCriteria.objects.filter(
        group_submission=group_submission
    ).select_related('criteria')
    score = 0.0
    total = 0.0
    for row in rows:
        if row.score is not None:
            score += row.score
        if row.criteria is not None:
            total += row.criteria.marks
    return score, total


def _personal_final_score(group_submission: GroupSubmission, student: User) -> dict:
    """final = base + adjustment. Ported verbatim from Hao (§14.5)."""
    group_score, group_total = _group_base_score(group_submission)
    adjustment = GroupSubmissionPersonalAdjustment.objects.filter(
        group_submission=group_submission, student=student, status='final'
    ).first()
    personal_adjustment = adjustment.adjustment_score if adjustment else 0.0
    reason = adjustment.adjustment_reason if adjustment else ''
    final_score = group_score + personal_adjustment
    return {
        'group_score': group_score,
        'group_total': group_total,
        'group_percentage': (group_score / group_total * 100) if group_total > 0 else 0,
        'personal_adjustment': personal_adjustment,
        'adjustment_reason': reason,
        'final_score': final_score,
        'final_percentage': (final_score / group_total * 100) if group_total > 0 else 0,
    }


def _student_group_for(assignment: Assignment, student_id: int) -> Optional[Group]:
    """The student's active group within the assignment's group set."""
    if not assignment.group_set_id:
        return None
    membership = (
        GroupMember.objects.filter(
            student_id=student_id,
            group__group_set_id=assignment.group_set_id,
            group__is_active=True,
            is_active=True,
        )
        .select_related('group')
        .first()
    )
    return membership.group if membership else None


# =============================================================================
# Group sets — course-scoped (mounted under /courses)
# =============================================================================

@course_router.get(
    "/{course_id}/groupsets", response=List[GroupSetSchema], operation_id="listGroupSets"
)
@require_auth(roles=STAFF_ROLES)
def list_group_sets(request, course_id: int):
    _require_team_permission(request, course_id)
    sets = GroupSet.objects.filter(course_id=course_id, is_active=True)
    return [_serialize_group_set(gs) for gs in sets]


@course_router.post(
    "/{course_id}/groupsets", response=GroupSetSchema, operation_id="createGroupSet"
)
@require_auth(roles=STAFF_ROLES)
def create_group_set(request, course_id: int, payload: GroupSetCreateRequest):
    course = _require_team_permission(request, course_id)
    if payload.min_group_size < 1:
        raise HttpError(400, "Minimum group size must be at least 1")
    if payload.max_group_size < payload.min_group_size:
        raise HttpError(400, "Maximum group size must be greater than or equal to the minimum")
    gs = GroupSet.objects.create(
        course=course,
        name=payload.name,
        description=payload.description,
        min_group_size=payload.min_group_size,
        max_group_size=payload.max_group_size,
        allow_student_self_assignment=payload.allow_student_self_assignment,
        self_assignment_deadline=payload.self_assignment_deadline,
    )
    return _serialize_group_set(gs)


@course_router.post(
    "/{course_id}/random-assign", response=ActionResponse, operation_id="randomAssignStudents"
)
@require_auth(roles=STAFF_ROLES)
def random_assign_students(request, course_id: int, payload: RandomAssignRequest):
    """Randomly assign ungrouped students into NEW groups.

    Ported from Hao's random_assign_students (teacher/views.py:5458). Shuffles
    the ungrouped students and then either splits them across a fixed number of
    groups, or chunks them into groups of a fixed size.
    """
    course = _require_team_permission(request, course_id)
    group_set = get_object_or_404(GroupSet, pk=payload.group_set_id, course=course, is_active=True)

    ungrouped = _ungrouped_students(course, group_set.id)
    if not ungrouped:
        raise HttpError(400, "No ungrouped students found")
    random.shuffle(ungrouped)

    groups_created = 0
    with transaction.atomic():
        if payload.method == 'groups':
            num_groups = payload.num_groups or 0
            if num_groups < 1:
                raise HttpError(400, "Invalid number of groups")
            per_group = len(ungrouped) // num_groups
            remainder = len(ungrouped) % num_groups
            index = 0
            for i in range(num_groups):
                size = per_group + (1 if i < remainder else 0)
                if size == 0:
                    break
                group = Group.objects.create(
                    course=course,
                    group_set_id=group_set.id,
                    name=f"{payload.group_name_prefix} {i + 1}",
                )
                groups_created += 1
                for _ in range(size):
                    if index < len(ungrouped):
                        GroupMember.objects.create(group=group, student=ungrouped[index])
                        index += 1

        elif payload.method == 'size':
            size = payload.group_size or 0
            if size < 2:
                raise HttpError(400, "Invalid group size")
            if size > group_set.max_group_size:
                raise HttpError(
                    400,
                    f"Group size ({size}) exceeds maximum allowed ({group_set.max_group_size})",
                )
            number = 1
            for start in range(0, len(ungrouped), size):
                chunk = ungrouped[start:start + size]
                group = Group.objects.create(
                    course=course,
                    group_set_id=group_set.id,
                    name=f"{payload.group_name_prefix} {number}",
                )
                groups_created += 1
                for student in chunk:
                    GroupMember.objects.create(group=group, student=student)
                number += 1
        else:
            raise HttpError(400, "method must be 'groups' or 'size'")

    return {
        'success': True,
        'message': f"Successfully assigned {len(ungrouped)} students using random assignment",
        'assigned_count': len(ungrouped),
        'groups_created': groups_created,
    }


@course_router.post(
    "/{course_id}/auto-assign-ungrouped",
    response=ActionResponse,
    operation_id="autoAssignUngrouped",
)
@require_auth(roles=STAFF_ROLES)
def auto_assign_ungrouped(request, course_id: int, payload: AutoAssignRequest):
    """Fill existing groups that still have capacity; create new ones if needed.

    Ported from Hao's auto_assign_ungrouped_students (teacher/views.py:5589).
    Unlike random assign, this reuses groups that already exist and only
    creates a new group once every existing group is full.
    """
    course = _require_team_permission(request, course_id)
    group_set = get_object_or_404(GroupSet, pk=payload.group_set_id, course=course, is_active=True)
    max_size = group_set.max_group_size

    ungrouped = _ungrouped_students(course, group_set.id)
    assigned = 0

    with transaction.atomic():
        for student in ungrouped:
            existing = list(
                Group.objects.filter(course=course, group_set_id=group_set.id, is_active=True)
            )
            target = None
            for group in existing:
                if group.members.filter(is_active=True).count() < max_size:
                    target = group
                    break
            if target is None:
                number = len(existing) + 1
                target = Group.objects.create(
                    course=course,
                    group_set_id=group_set.id,
                    name=f"Group {number}",
                    description=f"Auto-generated group {number}",
                )
            GroupMember.objects.create(group=target, student=student)
            assigned += 1

    return {
        'success': True,
        'message': f"Successfully assigned {assigned} students to groups",
        'assigned_count': assigned,
    }


# =============================================================================
# Group sets — detail (mounted under /groupsets)
# =============================================================================

@groupsets_router.get("/{group_set_id}", response=GroupSetSchema, operation_id="getGroupSet")
@require_auth(roles=STAFF_ROLES)
def get_group_set(request, group_set_id: int):
    gs = _group_set_or_404(group_set_id)
    _require_team_permission(request, gs.course_id)
    return _serialize_group_set(gs)


@groupsets_router.patch("/{group_set_id}", response=GroupSetSchema, operation_id="updateGroupSet")
@require_auth(roles=STAFF_ROLES)
def update_group_set(request, group_set_id: int, payload: GroupSetUpdateRequest):
    gs = _group_set_or_404(group_set_id)
    _require_team_permission(request, gs.course_id)

    data = payload.dict(exclude_unset=True)
    # Hao locked sizes once teams had members, so existing groups cannot be
    # invalidated retroactively.
    has_members = GroupMember.objects.filter(
        group__group_set_id=gs.id, group__is_active=True, is_active=True
    ).exists()
    if has_members and ('min_group_size' in data or 'max_group_size' in data):
        raise HttpError(400, "Group sizes cannot be changed once groups have members")

    for field, value in data.items():
        setattr(gs, field, value)
    if gs.max_group_size < gs.min_group_size:
        raise HttpError(400, "Maximum group size must be greater than or equal to the minimum")
    gs.save()
    return _serialize_group_set(gs)


@groupsets_router.delete("/{group_set_id}", response=ActionResponse, operation_id="deleteGroupSet")
@require_auth(roles=STAFF_ROLES)
def delete_group_set(request, group_set_id: int):
    gs = _group_set_or_404(group_set_id)
    _require_team_permission(request, gs.course_id)
    # Soft delete, as in Hao's groupset_delete.
    gs.is_active = False
    gs.save()
    Group.objects.filter(group_set_id=gs.id).update(is_active=False)
    return {'success': True, 'message': 'Group category deleted'}


@groupsets_router.get(
    "/{group_set_id}/groups", response=List[GroupSchema], operation_id="listGroups"
)
@require_auth(roles=STAFF_ROLES)
def list_groups(request, group_set_id: int):
    gs = _group_set_or_404(group_set_id)
    _require_team_permission(request, gs.course_id)
    groups = Group.objects.filter(group_set_id=gs.id, is_active=True)
    return [_serialize_group(g) for g in groups]


@groupsets_router.post("/{group_set_id}/groups", response=GroupSchema, operation_id="createGroup")
@require_auth(roles=STAFF_ROLES)
def create_group(request, group_set_id: int, payload: GroupCreateRequest):
    gs = _group_set_or_404(group_set_id)
    _require_team_permission(request, gs.course_id)
    group = Group.objects.create(
        course_id=gs.course_id,
        group_set_id=gs.id,
        name=payload.name,
        description=payload.description,
    )
    return _serialize_group(group)


@groupsets_router.get(
    "/{group_set_id}/ungrouped-students",
    response=List[UngroupedStudentSchema],
    operation_id="listUngroupedStudents",
)
@require_auth(roles=STAFF_ROLES)
def list_ungrouped_students(request, group_set_id: int):
    gs = _group_set_or_404(group_set_id)
    course = _require_team_permission(request, gs.course_id)
    return [
        {'student_id': s.id, 'userNumber': s.userNumber, 'userName': s.userName}
        for s in _ungrouped_students(course, gs.id)
    ]


# =============================================================================
# Groups and membership (mounted under /groups)
# =============================================================================

@groups_router.post("/{group_id}/members", response=GroupSchema, operation_id="addGroupMembers")
@require_auth(roles=STAFF_ROLES)
def add_group_members(request, group_id: int, payload: AddMembersRequest):
    group = get_object_or_404(Group, pk=group_id, is_active=True)
    _require_team_permission(request, group.course_id)
    group_set = group.group_set

    current = GroupMember.objects.filter(group=group, is_active=True).count()
    if group_set and current + len(payload.student_ids) > group_set.max_group_size:
        raise HttpError(
            400,
            f"Adding {len(payload.student_ids)} student(s) would exceed the maximum "
            f"group size of {group_set.max_group_size}",
        )

    for student_id in payload.student_ids:
        if not Course2Student.objects.filter(
            course_id=group.course_id, student_id=student_id
        ).exists():
            raise HttpError(400, "Student is not enrolled in this course")
        # A student may belong to only one group per group set.
        if group_set and GroupMember.objects.filter(
            student_id=student_id,
            group__group_set_id=group_set.id,
            group__is_active=True,
            is_active=True,
        ).exists():
            raise HttpError(400, "Student already belongs to a group in this group category")
        GroupMember.objects.create(group=group, student_id=student_id)

    return _serialize_group(group)


@groups_router.delete(
    "/{group_id}/members/{student_id}", response=GroupSchema, operation_id="removeGroupMember"
)
@require_auth(roles=STAFF_ROLES)
def remove_group_member(request, group_id: int, student_id: int):
    group = get_object_or_404(Group, pk=group_id, is_active=True)
    _require_team_permission(request, group.course_id)
    GroupMember.objects.filter(group=group, student_id=student_id).delete()
    return _serialize_group(group)


@groups_router.post("/move-member", response=ActionResponse, operation_id="moveGroupMember")
@require_auth(roles=STAFF_ROLES)
def move_group_member(request, payload: MoveMemberRequest, group_set_id: int):
    """Backs the drag-and-drop interface (Hao GM-4).

    Moving a student to `target_group_id=null` returns them to the unassigned
    pool. Hao's jQuery UI sortable posted the same intent.
    """
    gs = _group_set_or_404(group_set_id)
    _require_team_permission(request, gs.course_id)

    with transaction.atomic():
        GroupMember.objects.filter(
            student_id=payload.student_id,
            group__group_set_id=gs.id,
            group__is_active=True,
        ).delete()

        if payload.target_group_id is not None:
            target = get_object_or_404(
                Group, pk=payload.target_group_id, group_set_id=gs.id, is_active=True
            )
            if target.members.filter(is_active=True).count() >= gs.max_group_size:
                raise HttpError(400, f"{target.name} is already full")
            GroupMember.objects.create(group=target, student_id=payload.student_id)

    return {'success': True, 'message': 'Group membership updated'}


# =============================================================================
# Student-facing group views (ported from Hao's student/views.py)
# =============================================================================

@groups_router.get("/my-groups", response=List[GroupSchema], operation_id="listMyGroups")
@require_auth(roles=['Student'])
def list_my_groups(request):
    memberships = GroupMember.objects.filter(
        student_id=request.user_id, is_active=True, group__is_active=True
    ).select_related('group')
    return [_serialize_group(m.group) for m in memberships]


@groups_router.post(
    "/{group_id}/join", response=ActionResponse, operation_id="joinGroup"
)
@require_auth(roles=['Student'])
def join_group(request, group_id: int):
    """Student self-enrolment — only when the group set allows it (Hao GM-7)."""
    group = get_object_or_404(Group, pk=group_id, is_active=True)
    group_set = group.group_set
    if not group_set or not group_set.allow_student_self_assignment:
        raise HttpError(403, "Self-enrolment is not enabled for this group category")
    if group_set.self_assignment_deadline and timezone.now() > group_set.self_assignment_deadline:
        raise HttpError(403, "The deadline for joining a group has passed")
    if not Course2Student.objects.filter(
        course_id=group.course_id, student_id=request.user_id
    ).exists():
        raise HttpError(403, "You are not enrolled in this course")
    if GroupMember.objects.filter(
        student_id=request.user_id,
        group__group_set_id=group_set.id,
        group__is_active=True,
        is_active=True,
    ).exists():
        raise HttpError(400, "You already belong to a group in this group category")
    if group.members.filter(is_active=True).count() >= group_set.max_group_size:
        raise HttpError(400, "This group is already full")

    GroupMember.objects.create(group=group, student_id=request.user_id)
    return {'success': True, 'message': f'You joined {group.name}'}


@groups_router.post("/{group_id}/leave", response=ActionResponse, operation_id="leaveGroup")
@require_auth(roles=['Student'])
def leave_group(request, group_id: int):
    group = get_object_or_404(Group, pk=group_id, is_active=True)
    group_set = group.group_set
    if not group_set or not group_set.allow_student_self_assignment:
        raise HttpError(403, "You cannot leave a group you were assigned to")
    if group_set.self_assignment_deadline and timezone.now() > group_set.self_assignment_deadline:
        raise HttpError(403, "The deadline for changing groups has passed")
    GroupMember.objects.filter(group=group, student_id=request.user_id).delete()
    return {'success': True, 'message': f'You left {group.name}'}


# =============================================================================
# Group workspace (Hao GM-8) — shared file space with a comment thread
# =============================================================================

def _can_access_group(request, group: Group) -> bool:
    if request.user_role in STAFF_ROLES:
        return Course2Marker.objects.filter(
            course_id=group.course_id, marker_id=request.user_id
        ).exists()
    return GroupMember.objects.filter(
        group=group, student_id=request.user_id, is_active=True
    ).exists()


def _serialize_workspace_file(f: GroupWorkspaceFile) -> dict:
    comments = (
        GroupSubmissionComment.objects.filter(file=f, is_active=True)
        .select_related('author')
        .order_by('created_at')
    )
    return {
        'id': f.id,
        'group_id': f.group_id,
        'assignment_id': f.assignment_id,
        'uploaded_by_id': f.uploaded_by_id,
        'uploaded_by_name': f.uploaded_by.userName,
        'file': f.file,
        'file_name': f.file_name,
        'file_size': f.file_size,
        'file_type': f.file_type,
        'status': f.status,
        'upload_time': f.upload_time,
        'comments': [
            {
                'id': c.id,
                'author_id': c.author_id,
                'author_name': c.author.userName,
                'content': c.content,
                'created_at': c.created_at,
            }
            for c in comments
        ],
    }


@groups_router.get(
    "/{group_id}/workspace-files",
    response=List[WorkspaceFileSchema],
    operation_id="listWorkspaceFiles",
)
@require_auth()
def list_workspace_files(request, group_id: int, assignment_id: int):
    group = get_object_or_404(Group, pk=group_id, is_active=True)
    if not _can_access_group(request, group):
        raise HttpError(403, "You are not a member of this group")
    files = (
        GroupWorkspaceFile.objects.filter(group=group, assignment_id=assignment_id)
        .select_related('uploaded_by')
    )
    return [_serialize_workspace_file(f) for f in files]


@groups_router.post(
    "/{group_id}/workspace-files",
    response=WorkspaceFileSchema,
    operation_id="uploadWorkspaceFile",
)
@require_auth(roles=['Student'])
def upload_workspace_file(request, group_id: int, payload: WorkspaceFileCreateRequest):
    group = get_object_or_404(Group, pk=group_id, is_active=True)
    if not _can_access_group(request, group):
        raise HttpError(403, "You are not a member of this group")
    f = GroupWorkspaceFile.objects.create(
        group=group,
        assignment_id=payload.assignment_id,
        uploaded_by_id=request.user_id,
        file=payload.file,
        file_name=payload.file_name,
        file_size=payload.file_size,
        file_type=payload.file_type,
    )
    return _serialize_workspace_file(f)


@groups_router.delete(
    "/workspace-files/{file_id}", response=ActionResponse, operation_id="deleteWorkspaceFile"
)
@require_auth()
def delete_workspace_file(request, file_id: int):
    f = get_object_or_404(GroupWorkspaceFile, pk=file_id)
    # Hao allowed only the uploader to remove their own file.
    if f.uploaded_by_id != request.user_id and request.user_role not in STAFF_ROLES:
        raise HttpError(403, "Only the person who uploaded a file can remove it")
    f.delete()
    return {'success': True, 'message': 'File removed from workspace'}


@groups_router.post(
    "/workspace-files/{file_id}/comments",
    response=WorkspaceCommentSchema,
    operation_id="addWorkspaceComment",
)
@require_auth()
def add_workspace_comment(request, file_id: int, payload: WorkspaceCommentCreateRequest):
    f = get_object_or_404(GroupWorkspaceFile, pk=file_id)
    if not _can_access_group(request, f.group):
        raise HttpError(403, "You are not a member of this group")
    if not payload.content.strip():
        raise HttpError(400, "Comment cannot be empty")
    c = GroupSubmissionComment.objects.create(
        file=f, author_id=request.user_id, content=payload.content.strip()
    )
    return {
        'id': c.id,
        'author_id': c.author_id,
        'author_name': c.author.userName,
        'content': c.content,
        'created_at': c.created_at,
    }


# =============================================================================
# Group submission (Hao GM-9, GM-10) — leader-confirmed, version-preserving
# =============================================================================

def _serialize_group_submission(gs: GroupSubmission) -> dict:
    return {
        'id': gs.id,
        'group_id': gs.group_id,
        'group_name': gs.group.name,
        'assignment_id': gs.assignment_id,
        'submitted_by_id': gs.submitted_by_id,
        'submitted_by_name': gs.submitted_by.userName,
        'submissionFile': gs.submissionFile,
        'filename': gs.filename,
        'submission_version': gs.submission_version,
        'submissionDateTime': gs.submissionDateTime,
    }


@groups_router.post(
    "/{group_id}/submit", response=GroupSubmissionSchema, operation_id="submitGroupAssignment"
)
@require_auth(roles=['Student'])
def submit_group_assignment(request, group_id: int, payload: GroupSubmitRequest):
    """Confirm the group's submission.

    Hao's two-step flow: files are uploaded to the workspace first, then a
    member confirms one as the group's submission. Each confirmation creates a
    new immutable row, giving the version history his evaluation praised.
    """
    group = get_object_or_404(Group, pk=group_id, is_active=True)
    if not GroupMember.objects.filter(
        group=group, student_id=request.user_id, is_active=True
    ).exists():
        raise HttpError(403, "You are not a member of this group")

    assignment = get_object_or_404(Assignment, pk=payload.assignment_id)
    if not assignment.is_group_assignment():
        raise HttpError(400, "This is not a group assignment")

    # Enforce the submission deadline, as individual submissions do — group
    # submissions previously had no deadline check (dropped in unification).
    if assignment.release_date and timezone.now() < assignment.release_date:
        raise HttpError(403, "Submissions are not open yet.")
    if timezone.now() > assignment.deadline:
        raise HttpError(403, "The submission deadline has passed.")

    previous = GroupSubmission.objects.filter(
        group=group, assignment=assignment
    ).order_by('-submission_version').first()
    version = (previous.submission_version + 1) if previous else 1

    submission = GroupSubmission.objects.create(
        group=group,
        assignment=assignment,
        submitted_by_id=request.user_id,
        submissionFile=payload.file,
        submission_version=version,
    )
    return _serialize_group_submission(submission)


@groups_router.get(
    "/submissions/{assignment_id}",
    response=List[GroupSubmissionSchema],
    operation_id="listGroupSubmissions",
)
@require_auth(roles=STAFF_ROLES)
def list_group_submissions(request, assignment_id: int):
    """Latest submission per group for an assignment."""
    assignment = get_object_or_404(Assignment, pk=assignment_id)
    _require_team_permission(request, assignment.course_id)
    latest = {}
    for gs in (
        GroupSubmission.objects.filter(assignment=assignment, is_active=True)
        .select_related('group', 'submitted_by')
        .order_by('group_id', '-submission_version')
    ):
        latest.setdefault(gs.group_id, gs)
    return [_serialize_group_submission(gs) for gs in latest.values()]


@groups_router.get(
    "/my-group-submissions/{assignment_id}",
    response=List[GroupSubmissionSchema],
    operation_id="getMyGroupSubmissions",
)
@require_auth(roles=['Student'])
def get_my_group_submissions(request, assignment_id: int):
    """The current student's group's submissions for an assignment (full version
    history, newest first). Backs the group workspace so students see their own
    group's submission state — listGroupSubmissions is staff-only."""
    assignment = get_object_or_404(Assignment, pk=assignment_id)
    group = _student_group_for(assignment, request.user_id)
    if group is None:
        return []
    subs = (
        GroupSubmission.objects.filter(group=group, assignment=assignment, is_active=True)
        .select_related('group', 'submitted_by')
        .order_by('-submission_version')
    )
    return [_serialize_group_submission(gs) for gs in subs]


# =============================================================================
# Personal contribution adjustment (Hao GM-12, GM-13)
# =============================================================================

@groups_router.get(
    "/group-submissions/{group_submission_id}/personal-adjustment",
    response=List[PersonalAdjustmentSchema],
    operation_id="getPersonalAdjustments",
)
@require_auth(roles=['Academic', 'Marker'])
def get_personal_adjustments(request, group_submission_id: int):
    gs = get_object_or_404(GroupSubmission, pk=group_submission_id)
    _require_team_permission(request, gs.assignment.course_id)

    group_score, group_total = _group_base_score(gs)
    existing = {
        a.student_id: a
        for a in GroupSubmissionPersonalAdjustment.objects.filter(group_submission=gs)
    }
    members = (
        GroupMember.objects.filter(group=gs.group, is_active=True)
        .select_related('student')
        .order_by('joined_at')
    )
    rows = []
    for m in members:
        adj = existing.get(m.student_id)
        adjustment = adj.adjustment_score if adj else 0.0
        rows.append(
            {
                'student_id': m.student_id,
                'userNumber': m.student.userNumber,
                'userName': m.student.userName,
                'group_score': group_score,
                'group_total': group_total,
                'adjustment_score': adjustment,
                'adjustment_reason': adj.adjustment_reason if adj else '',
                'final_score': group_score + adjustment,
                'status': adj.status if adj else 'draft',
            }
        )
    return rows


@groups_router.post(
    "/group-submissions/{group_submission_id}/personal-adjustment",
    response=ActionResponse,
    operation_id="savePersonalAdjustments",
)
@require_auth(roles=['Academic', 'Marker'])
def save_personal_adjustments(
    request, group_submission_id: int, payload: PersonalAdjustmentSaveRequest
):
    """Save every member's adjustment at once, as Hao's form did."""
    gs = get_object_or_404(GroupSubmission, pk=group_submission_id)
    _require_team_permission(request, gs.assignment.course_id)
    if payload.status not in ('draft', 'final'):
        raise HttpError(400, "status must be 'draft' or 'final'")

    member_ids = set(
        GroupMember.objects.filter(group=gs.group, is_active=True).values_list(
            'student_id', flat=True
        )
    )
    with transaction.atomic():
        for entry in payload.adjustments:
            if entry.student_id not in member_ids:
                raise HttpError(400, "Cannot adjust a student who is not in this group")
            GroupSubmissionPersonalAdjustment.objects.update_or_create(
                group_submission=gs,
                student_id=entry.student_id,
                defaults={
                    'adjustment_score': entry.adjustment_score,
                    'adjustment_reason': entry.adjustment_reason or '',
                    'adjusted_by_id': request.user_id,
                    'status': payload.status,
                },
            )
    return {'success': True, 'message': 'Personal contribution adjustments saved successfully'}


@groups_router.get(
    "/group-submissions/{group_submission_id}/my-result",
    response=GroupResultSchema,
    operation_id="getMyGroupResult",
)
@require_auth(roles=['Student'])
def get_my_group_result(request, group_submission_id: int):
    """Transparent breakdown for the student: base + adjustment = final."""
    gs = get_object_or_404(GroupSubmission, pk=group_submission_id)
    if not GroupMember.objects.filter(
        group=gs.group, student_id=request.user_id, is_active=True
    ).exists():
        raise HttpError(403, "You are not a member of this group")
    student = get_object_or_404(User, pk=request.user_id)
    return _personal_final_score(gs, student)


@groups_router.get(
    "/my-group-result/{assignment_id}",
    response=MyGroupResultSchema,
    operation_id="getMyGroupResultByAssignment",
)
@require_auth(roles=['Student'])
def get_my_group_result_by_assignment(request, assignment_id: int):
    """Resolve the student's group and its latest submission for an assignment.

    Students never see raw group-submission ids, so this looks up their group,
    finds its most recent submission, and returns the base+adjustment breakdown.
    """
    assignment = get_object_or_404(Assignment, pk=assignment_id)
    group = _student_group_for(assignment, request.user_id)
    if group is None:
        raise HttpError(404, "You are not in a group for this assignment")

    gs = (
        GroupSubmission.objects.filter(group=group, assignment=assignment, is_active=True)
        .order_by('-submission_version')
        .first()
    )
    if gs is None:
        raise HttpError(404, "Your group has not submitted yet")

    student = get_object_or_404(User, pk=request.user_id)
    finalised = GroupSubmissionPersonalAdjustment.objects.filter(
        group_submission=gs, status='final'
    ).exists()
    return {
        'group_name': group.name,
        'submission_version': gs.submission_version,
        'finalised': finalised,
        'breakdown': _personal_final_score(gs, student),
    }


@groups_router.get(
    "/group-submissions/{group_submission_id}/marking",
    response=GroupMarkingSchema,
    operation_id="getGroupMarking",
)
@require_auth(roles=['Academic', 'Marker'])
def get_group_marking(request, group_submission_id: int):
    """Rubric criteria + current marks for a group submission (Group Marking).

    The marker scores each criterion by picking a level (Element); the level's
    marks become that criterion's score.
    """
    gs = get_object_or_404(GroupSubmission, pk=group_submission_id)
    _require_team_permission(request, gs.assignment.course_id)

    existing = {
        row.criteria_id: row
        for row in GroupSubmissionCriteria.objects.filter(group_submission=gs).prefetch_related('selected_elements')
    }
    criteria_out = []
    group_score = 0.0
    group_total = 0.0
    for crit in Criteria.objects.filter(assignment=gs.assignment, parent=None):
        group_total += crit.marks
        row = existing.get(crit.id)
        selected = row.selected_elements.first() if row else None
        if row and row.score is not None:
            group_score += row.score
        criteria_out.append({
            'criteria_id': crit.id,
            'name': crit.name,
            'marks': crit.marks,
            'levels': [
                {'id': e.id, 'name': e.name, 'description': e.description, 'marks': e.marks}
                for e in Element.objects.filter(criteria=crit).order_by('marks')
            ],
            'selected_element_id': selected.id if selected else None,
            'score': row.score if row else None,
            'finalised': bool(row and row.status == 2),
        })

    finalised = GroupSubmissionPersonalAdjustment.objects.filter(
        group_submission=gs, status='final'
    ).exists()
    return {
        'group_submission_id': gs.id,
        'group_name': gs.group.name,
        'criteria': criteria_out,
        'group_score': group_score,
        'group_total': group_total,
        'finalised': finalised,
    }


@groups_router.post(
    "/group-submissions/{group_submission_id}/marking",
    response=GroupMarkingSchema,
    operation_id="saveGroupMarking",
)
@require_auth(roles=['Academic', 'Marker'])
def save_group_marking(request, group_submission_id: int, payload: GroupMarkingSaveRequest):
    """Save the marker's per-criterion level selections for a group submission.

    Hao's rule (GM branch): once a criterion is finalised it is locked to
    markers — only a course organiser (Academic) can override it. Saving with
    ``finalise`` marks the saved criteria as final; a plain save leaves them in
    the editable "Marking" state.
    """
    gs = get_object_or_404(GroupSubmission, pk=group_submission_id)
    _require_team_permission(request, gs.assignment.course_id)
    is_academic = request.user_role == 'Academic'

    valid_criteria = set(
        Criteria.objects.filter(assignment=gs.assignment, parent=None).values_list('id', flat=True)
    )
    existing = {
        row.criteria_id: row
        for row in GroupSubmissionCriteria.objects.filter(group_submission=gs)
    }
    # STATUS: 0 Submitted, 1 Marking, 2 Finished (finalised)
    new_status = 2 if payload.finalise else 1
    with transaction.atomic():
        for entry in payload.marks:
            if entry.criteria_id not in valid_criteria:
                raise HttpError(400, "Criterion does not belong to this assignment")
            prev = existing.get(entry.criteria_id)
            if prev and prev.status == 2 and not is_academic:
                raise HttpError(
                    403,
                    "This criterion has been finalised and can only be changed by "
                    "a course organiser."
                )
            element = get_object_or_404(Element, pk=entry.element_id, criteria_id=entry.criteria_id)
            row, _ = GroupSubmissionCriteria.objects.update_or_create(
                group_submission=gs, criteria_id=entry.criteria_id,
                defaults={'marker_id': request.user_id, 'score': element.marks, 'status': new_status},
            )
            row.selected_elements.set([element])
    return get_group_marking(request, group_submission_id)


# NOTE ON ORDERING: Django resolves URL patterns in declaration order and
# django-ninja registers `{group_id}` as a greedy segment, so it would match
# literal paths like /groups/move-member and /groups/my-groups. The two
# single-segment `/{group_id}` handlers are therefore declared last, after
# every literal route in this router.
@groups_router.patch("/{group_id}", response=GroupSchema, operation_id="updateGroup")
@require_auth(roles=STAFF_ROLES)
def update_group(request, group_id: int, payload: GroupUpdateRequest):
    group = get_object_or_404(Group, pk=group_id, is_active=True)
    _require_team_permission(request, group.course_id)
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(group, field, value)
    group.save()
    return _serialize_group(group)


@groups_router.delete("/{group_id}", response=ActionResponse, operation_id="deleteGroup")
@require_auth(roles=STAFF_ROLES)
def delete_group(request, group_id: int):
    group = get_object_or_404(Group, pk=group_id, is_active=True)
    _require_team_permission(request, group.course_id)
    group.is_active = False
    group.save()
    return {'success': True, 'message': 'Group deleted'}
