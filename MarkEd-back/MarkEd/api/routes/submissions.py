from ninja import Router
from typing import List
from ..schemas import SubmissionSchema, SubmissionRequest, SubmissionResponse, PeersLastSubmissionResponse, AllSubmissionSchema
from ..decorators import require_auth, check_permissions
from ..permissions import AssignmentSubmissionDeadlineHasNotPassed, CanPerformPeerReview, IsEnrolledStudent, IsCourseStaffFromAssignment
from ...models import Submission, Assignment, PeerReviewAllocation, Course2Marker, User
from datetime import timedelta
from ...services.storage import StorageService
from ninja.errors import HttpError

router = Router()

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

@router.get("/assignment/{assignment_id}/peer-review/{submission_id}", response=PeersLastSubmissionResponse, operation_id="getPeersLastSubmission")
@require_auth()
def get_peers_last_submission(request, assignment_id: int, submission_id: int):
    # Check if user is assigned to peer review this submission
    is_peer_reviewer = PeerReviewAllocation.objects.filter(
        assignment_id=assignment_id,
        submission_id=submission_id,
        reviewer_id=request.user_id
    ).exists()
    
    # Check if user is a marker for this course
    is_marker = False
    try:
        assignment = Assignment.objects.get(id=assignment_id)
        is_marker = (
            Course2Marker.objects.filter(
                course=assignment.course,
                marker_id=request.user_id,
                markingPermission__gt=0  # Has marking permission
            ).exists() or
            User.objects.filter(
                id=request.user_id,
                role__in=['M', 'T', 'A']  # Is a Marker, TA, or Academic
            ).exists()
        )
    except Assignment.DoesNotExist:
        return {
            "success": False,
            "message": "Assignment not found"
        }
    
    # Check if user is the submission owner
    is_submission_owner = Submission.objects.filter(
        id=submission_id,
        student_id=request.user_id
    ).exists()
    
    # If user is not a peer reviewer, marker, or submission owner, deny access
    if not (is_peer_reviewer or is_marker or is_submission_owner):
        return {
            "success": False,
            "message": "Not authorized to view this submission"
        }
    
    submission = Submission.objects.filter(
        id=submission_id,
        assignment_id=assignment_id,
    ).order_by('-submissionDateTime').first()
    
    if submission:
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
    else:
        return {
            "success": False,
            "message": "No submission found"
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
    
    return [
        {
            "id": submission.id,
            "student_id": submission.student.id,
            "student_number": submission.student.userNumber,
            "student_name": submission.student.userName,
            "assignment_id": submission.assignment_id,
            "submissionFile": submission.submissionFile,
            "submissionDateTime": submission.submissionDateTime
        }
        for submission in submissions_list
    ]

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