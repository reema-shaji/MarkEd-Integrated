import json

from django.db import transaction
from django.shortcuts import get_object_or_404
from ninja import Router
from typing import List
from ..schemas import SubmissionSchema, SubmissionRequest, SubmissionResponse, PeersLastSubmissionResponse, AllSubmissionSchema, MySubmissionResultSchema, SubmissionMarkingSchema, SubmissionMarkingSaveRequest
from ..decorators import require_auth, check_permissions
from ..permissions import AssignmentSubmissionDeadlineHasNotPassed, CanPerformPeerReview, IsEnrolledStudent, IsCourseStaffFromAssignment
from ...models import Submission, Assignment, PeerReviewAllocation, Course2Marker, User, GroupSubmission, GroupMember, SubmissionCriteria, Criteria
from datetime import timedelta
from ...services.storage import StorageService
from ninja.errors import HttpError

router = Router()


def _readable_feedback(raw):
    """Rubric feedback is stored as a {"start","middle","end"} JSON blob (legacy
    marking format); flatten it to a single human string, or return the raw text
    if it isn't that shape. Empty -> None."""
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
    except (ValueError, TypeError):
        parsed = None
    if isinstance(parsed, dict):
        text = ' '.join(
            str(parsed.get(k, '')).strip()
            for k in ('start', 'middle', 'end')
            if str(parsed.get(k, '')).strip()
        )
        return text or None
    return raw if str(raw).strip() else None

@router.get("/", response=List[SubmissionSchema], operation_id="listSubmissions")
@require_auth(roles=['Student', 'Marker'])
def list_submissions(request):
    if request.user_role == 'Student':
        submissions = Submission.objects.filter(
            student_id=request.user_id
        )
    else:
        submissions = Submission.objects.filter(
            assignment__course__course2marker__marker_id=request.user_id
        )
    return submissions.order_by('-submitted_at')

@router.post("/", response=SubmissionResponse, operation_id="createSubmission")
@require_auth(roles=['Student'])
@check_permissions(IsEnrolledStudent, AssignmentSubmissionDeadlineHasNotPassed)
def create_submission(request, data: SubmissionRequest):
    try:
        assignment = Assignment.objects.get(id=data.assignment_id)
        
        submission = Submission.objects.create(
            student_id=request.user_id,
            assignment=assignment,
            submissionFile=data.files[0],
        )

        return {
            "success": True,
            "message": "Submission created successfully"
        }

    except Exception as e:
        return {
            "success": False,
            "message": f"Error creating submission: {str(e)}"
        }

@router.get("/{submission_id}", response=SubmissionSchema, operation_id="getSubmission")
@require_auth()
# @check_permissions(IsEnrolledStudent, IsCourseStaffFromAssignment)
def get_submission(request, submission_id: int):
    return Submission.objects.get(id=submission_id)

@router.get("/assignment/{assignment_id}/last", response=SubmissionSchema, operation_id="getLastSubmission")
@require_auth()
def get_last_submission(request, assignment_id: int):
    submission = Submission.objects.filter(
        student_id=request.user_id,
        assignment_id=assignment_id
    ).order_by('-submissionDateTime').first()
    
    if not submission:
        raise HttpError(404, "No submission found")

    return submission

@router.get("/assignment/{assignment_id}/my-result", response=MySubmissionResultSchema, operation_id="getMySubmissionResult")
@require_auth(roles=['Student'])
def get_my_submission_result(request, assignment_id: int):
    """The student's own mark for an individual assignment.

    Restores the mark students saw on the original student home (Tomas'
    student/views.home): score summed across rubric criteria, revealed only once
    every criterion is Finished (status 2). Until then the numbers are withheld
    (`released=False`) — the same finished-only gate the source used before it
    showed a mark instead of "-". The scores never leave the server unless the
    requester owns the submission and marking is complete.
    """
    submission = Submission.objects.filter(
        student_id=request.user_id,
        assignment_id=assignment_id,
    ).order_by('-submissionDateTime').first()
    if not submission:
        raise HttpError(404, "You have not submitted to this assignment")

    rows = list(
        SubmissionCriteria.objects.filter(submission=submission)
        .select_related('criteria')
    )
    finished = bool(rows) and all(r.status == 2 for r in rows)
    # A student sees the mark only once marking is finished AND the course
    # organiser has released results (the explicit "Release marks" gate).
    released = finished and submission.assignment.results_released

    if not released:
        # Withhold the numbers until released; mirror the original "-".
        return {
            "released": False,
            "status": "Marked" if finished else ("Marking" if rows else "Submitted"),
            "score": 0.0,
            "total": 0.0,
            "percentage": 0.0,
            "breakdown": [],
        }

    score = sum((r.score or 0) for r in rows)
    total = sum((r.criteria.marks if r.criteria else 0) for r in rows)
    breakdown = [
        {
            "name": r.criteria.name if r.criteria else "Criterion",
            "score": r.score or 0,
            "max": r.criteria.marks if r.criteria else 0,
            "feedback": _readable_feedback(r.feedback),
        }
        for r in rows
    ]
    return {
        "released": True,
        "status": "Finished",
        "score": score,
        "total": total,
        "percentage": (score / total * 100) if total > 0 else 0.0,
        "breakdown": breakdown,
    }

@router.get("/assignment/{assignment_id}/submission/{submission_id}/marking", response=SubmissionMarkingSchema, operation_id="getSubmissionMarking")
@require_auth(roles=['Academic', 'Marker', 'TA'])
def get_submission_marking(request, assignment_id: int, submission_id: int):
    """Rubric criteria + current per-criterion marks for an individual
    submission — restores the scoring form from the original mark.html that the
    unified build dropped (individual marking had become annotations-only)."""
    submission = get_object_or_404(Submission, id=submission_id, assignment_id=assignment_id)
    existing = {
        row.criteria_id: row
        for row in SubmissionCriteria.objects.filter(submission=submission)
    }
    criteria_out = []
    score = 0.0
    total = 0.0
    for crit in Criteria.objects.filter(assignment_id=assignment_id, parent=None):
        total += crit.marks
        row = existing.get(crit.id)
        if row and row.score is not None:
            score += row.score
        criteria_out.append({
            "criteria_id": crit.id,
            "name": crit.name,
            "marks": crit.marks,
            "score": row.score if row else None,
            "feedback": (_readable_feedback(row.feedback) or '') if row else '',
            "finalised": bool(row and row.status == 2),
        })
    return {
        "submission_id": submission.id,
        "student_name": submission.student.userName,
        "criteria": criteria_out,
        "score": score,
        "total": total,
        "finalised": bool(criteria_out) and all(c["finalised"] for c in criteria_out),
    }


@router.post("/assignment/{assignment_id}/submission/{submission_id}/marking", response=SubmissionMarkingSchema, operation_id="saveSubmissionMarking")
@require_auth(roles=['Academic', 'Marker', 'TA'])
def save_submission_marking(request, assignment_id: int, submission_id: int, payload: SubmissionMarkingSaveRequest):
    """Save per-criterion scores + feedback for an individual submission.

    Applies Hao's marker-lock rule (as restored for group marking): a finalised
    criterion is locked to markers and only a course organiser (Academic) may
    change it. ``finalise`` marks the saved criteria Finished (status 2), which
    is also the gate that releases the mark to the student.
    """
    submission = get_object_or_404(Submission, id=submission_id, assignment_id=assignment_id)
    is_academic = request.user_role == 'Academic'

    valid = {
        c.id: c for c in Criteria.objects.filter(assignment_id=assignment_id, parent=None)
    }
    existing = {
        row.criteria_id: row
        for row in SubmissionCriteria.objects.filter(submission=submission)
    }
    new_status = 2 if payload.finalise else 1
    with transaction.atomic():
        for entry in payload.marks:
            crit = valid.get(entry.criteria_id)
            if crit is None:
                raise HttpError(400, "Criterion does not belong to this assignment")
            if entry.score is None or entry.score < 0 or entry.score > crit.marks:
                raise HttpError(400, f"Score for '{crit.name}' must be between 0 and {crit.marks}")
            prev = existing.get(entry.criteria_id)
            if prev and prev.status == 2 and not is_academic:
                raise HttpError(
                    403,
                    "This criterion has been finalised and can only be changed by "
                    "a course organiser."
                )
            SubmissionCriteria.objects.update_or_create(
                submission=submission, criteria_id=entry.criteria_id,
                defaults={
                    'marker_id': request.user_id,
                    'score': entry.score,
                    'status': new_status,
                    'feedback': entry.feedback or '',
                },
            )
    return get_submission_marking(request, assignment_id, submission_id)


@router.get("/assignment/{assignment_id}/peer-review/{submission_id}", response=PeersLastSubmissionResponse, operation_id="getPeersLastSubmission")
@require_auth()
def get_peers_last_submission(request, assignment_id: int, submission_id: int):
    try:
        assignment = Assignment.objects.get(id=assignment_id)
    except Assignment.DoesNotExist:
        return {"success": False, "message": "Assignment not found"}

    # Group peer review (§8): the reviewed object is a GroupSubmission, and the
    # `submission_id` path value is its id. Since an assignment is entirely
    # individual or entirely group, this branch is unambiguous.
    is_group = assignment.is_group_assignment()
    target_kwargs = (
        {'group_submission_id': submission_id} if is_group
        else {'submission_id': submission_id}
    )

    is_peer_reviewer = PeerReviewAllocation.objects.filter(
        assignment_id=assignment_id,
        reviewer_id=request.user_id,
        **target_kwargs,
    ).exists()

    is_marker = (
        Course2Marker.objects.filter(
            course=assignment.course,
            marker_id=request.user_id,
            markingPermission__gt=0
        ).exists() or
        User.objects.filter(
            id=request.user_id, role__in=['M', 'T', 'A']
        ).exists()
    )

    if is_group:
        group_submission = GroupSubmission.objects.filter(
            id=submission_id, assignment_id=assignment_id
        ).select_related('group').first()
        # A member of the submitting group may view their own group's work.
        is_owner = bool(group_submission) and GroupMember.objects.filter(
            group=group_submission.group, student_id=request.user_id, is_active=True
        ).exists()
        target = group_submission
    else:
        is_owner = Submission.objects.filter(
            id=submission_id, student_id=request.user_id
        ).exists()
        target = Submission.objects.filter(
            id=submission_id, assignment_id=assignment_id
        ).order_by('-submissionDateTime').first()

    if not (is_peer_reviewer or is_marker or is_owner):
        return {"success": False, "message": "Not authorized to view this submission"}

    if not target or not target.submissionFile:
        return {"success": False, "message": "No submission found"}

    storage = StorageService()
    pre_signed_file_url = storage.get_presigned_url(
        target.submissionFile,
        expires=timedelta(hours=1).total_seconds()
    )
    return {
        "success": True,
        "pre_signed_file_url": pre_signed_file_url,
        "message": "Submission retrieved successfully"
    }

@router.get("/{assignment_id}/all", response=List[AllSubmissionSchema], operation_id="getAllSubmissions")
@require_auth(roles=['Marker', 'Academic', 'TA'])
@check_permissions(IsCourseStaffFromAssignment)
def get_all_submissions(request, assignment_id: int):
    """Get all submissions for an assignment, ordered by most recent first"""
    # Get all submissions
    all_submissions = Submission.objects.filter(
        assignment_id=assignment_id
    ).select_related('student').order_by('-submissionDateTime')
    
    # Use a dictionary to keep track of the most recent submission per student
    latest_submissions = {}
    for submission in all_submissions:
        if submission.student_id not in latest_submissions:
            latest_submissions[submission.student_id] = submission
    
    # Convert to list and sort by submission date
    submissions_list = sorted(
        latest_submissions.values(),
        key=lambda x: x.submissionDateTime,
        reverse=True
    )

    # Total marks available and the per-submission marking state, so the Marking
    # tab can show real scores/status instead of hard-coded "Submitted / —".
    total_marks = sum(
        Criteria.objects.filter(assignment_id=assignment_id, parent=None)
        .values_list('marks', flat=True)
    )
    criteria_count = Criteria.objects.filter(assignment_id=assignment_id, parent=None).count()

    result = []
    for submission in submissions_list:
        rows = list(SubmissionCriteria.objects.filter(submission=submission))
        scored = [r for r in rows if r.score is not None]
        if not scored:
            marking_status = 'Unmarked'
            score = None
        elif criteria_count and len(rows) >= criteria_count and all(r.status == 2 for r in rows):
            marking_status = 'Marked'
            score = sum(r.score or 0 for r in scored)
        else:
            marking_status = 'In progress'
            score = sum(r.score or 0 for r in scored)
        result.append({
            "id": submission.id,
            "student_id": submission.student.id,
            "student_number": submission.student.userNumber,
            "student_name": submission.student.userName,
            "assignment_id": submission.assignment_id,
            "submissionFile": submission.submissionFile,
            "submissionDateTime": submission.submissionDateTime,
            "marking_status": marking_status,
            "score": score,
            "total": total_marks,
        })
    return result

@router.get("/assignment/{assignment_id}/submission/{submission_id}", response=PeersLastSubmissionResponse, operation_id="getSubmissionForMarking")
@require_auth(roles=['Marker', 'Academic', 'TA'])
@check_permissions(IsCourseStaffFromAssignment)
def get_submission_for_marking(request, assignment_id: int, submission_id: int):
    """Get a specific submission for marking"""
    try:
        submission = Submission.objects.get(
            id=submission_id,
            assignment_id=assignment_id,
        )
        
        storage = StorageService()
        pre_signed_file_url = storage.get_presigned_url(
            submission.submissionFile, 
            expires=timedelta(hours=1).total_seconds()
        )
        
        return {
            "success": True,
            "pre_signed_file_url": pre_signed_file_url,
            "message": "Submission retrieved successfully"
        }
        
    except Submission.DoesNotExist:
        return {
            "success": False,
            "message": "Submission not found"
        }