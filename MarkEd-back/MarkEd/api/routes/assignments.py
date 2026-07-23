from ninja import Router
from typing import List, Set
from django.db import models
from ..schemas.assignment import AssignmentSchema, PeerAssignmentRequest, PeerAssignmentCreationResponse, AssignmentStatistics
from ..schemas.feedback import CreationResponse
from ..decorators import require_auth, check_permissions
from ..permissions import IsCourseStaffFromAssignment, CanCreateAssignment
from ...models import Assignment, PeerReviewAllocation, Submission, Course2Student
from ..schemas.peer_review import PeerMatch
from django.utils import timezone
from datetime import timedelta
from django.db.models import Count, Q
from django.contrib.auth.models import User
from typing import Dict
from django.db.models import Max, Subquery, OuterRef
import random

router = Router()

@router.get("/", response=List[AssignmentSchema], operation_id="getAssignments")
@require_auth()
def list_assignments(request):
    if request.user_role == 'Student':
        assignments = Assignment.objects.filter(
            course__course2student__student_id=request.user_id,
            status=1
        )
    else:
        assignments = Assignment.objects.filter(
            course__course2marker__marker_id=request.user_id,
            status=1
        )
    return assignments.order_by('deadline')

@router.get("/{assignment_id}", response=AssignmentSchema, operation_id="getAssignment")
@require_auth()
# @check_permissions(IsEnrolledStudent)
def get_assignment(request, assignment_id: int):
    return Assignment.objects.get(id=assignment_id)

@router.post("/create-peer-assignment/{course_id}", response=PeerAssignmentCreationResponse, operation_id="createPeerAssignment")
@require_auth(roles=['Academic', 'Marker', 'TA'])
@check_permissions(CanCreateAssignment)
def create_peer_assignment(request, data: PeerAssignmentRequest, course_id: int):
    try:
        if str(course_id) != data.course_id:
            return {
                "success": False,
                "message": "Course ID mismatch between query parameter and request data",
                "assignment_id": None
            }

        instruction_urls = []
        if data.instructions:
            for file_url in data.instructions:
                if not file_url.lower().endswith('.pdf'):
                    return {
                        "success": False,
                        "message": "Only PDF files are allowed for instructions",
                        "assignment_id": None
                    }
                instruction_urls.append(file_url)

        assignment = Assignment.objects.create(
            course_id=data.course_id,
            assignmentTitle=data.title,
            assignmentDescription=data.description,
            deadline=data.submission_deadline,
            status=1,
            assignment_type='PEER_REVIEW',
            reviews_per_student=data.reviews_per_student,
            review_deadline=data.review_deadline,
            assignment_instructions=instruction_urls if instruction_urls else None,
            is_peer_review_matching_complete=False,
            release_date=data.release_date
        )

        return {
            "success": True,
            "message": f"Peer review assignment '{data.title}' created successfully",
            "assignment_id": getattr(assignment, 'id', None)
        }

    except Exception as e:
        return {
            "success": False,
            "message": f"Error creating peer review assignment: {str(e)}",
            "assignment_id": None
        } 

@router.get("/{assignment_id}/matched-peers", response=List[PeerMatch], operation_id="getMatchedPeers")
@require_auth(roles=['Academic', 'Marker', 'TA'])
@check_permissions(IsCourseStaffFromAssignment)
def get_matched_peers(request, assignment_id: int):
    peer_reviews = PeerReviewAllocation.objects.filter(
        assignment_id=assignment_id
    ).select_related(
        'reviewer',
        'submission__student'
    )

    matches = []
    for review in peer_reviews:
        matches.append({
            "reviewer_name": getattr(review.reviewer, 'userName', ''),
            "reviewer_email": getattr(review.reviewer, 'userEmail', ''),
            "reviewer_userNumber": getattr(review.reviewer, 'userNumber', ''),
            "submission_owner_name": getattr(getattr(review.submission, 'student'), 'userName', ''),
            "submission_owner_email": getattr(getattr(review.submission, 'student'), 'userEmail', ''),
            "submission_owner_userNumber": getattr(getattr(review.submission, 'student'), 'userNumber', ''),
            "status": review.status
        })
    
    return matches

@router.post("/{assignment_id}/trigger-peer-review-matching", response=CreationResponse, operation_id="triggerPeerReviewMatching")
@require_auth(roles=['Academic', 'Marker', 'TA'])
@check_permissions(IsCourseStaffFromAssignment)
def trigger_peer_review_matching(request, assignment_id: int):
    try:
        assignment = Assignment.objects.get(id=assignment_id)
        
        if assignment.is_peer_review_matching_complete:
            return {
                "success": False,
                "message": "Peer matching already completed",
                "matches": None
            }

        # Check that the assignment is indeed a peer-review type
        if assignment.assignment_type != "PEER_REVIEW":
            return {
                "success": False,
                "message": "This is not a peer review assignment",
                "matches": None
            }

        # Grab the latest submissions from each student
        latest_submissions_query = Submission.objects.filter(
            assignment=assignment,
            student=OuterRef('student')
        ).order_by('-submissionDateTime')

        submissions = list(
            Submission.objects.filter(
                assignment=assignment,
                submissionDateTime=Subquery(
                    latest_submissions_query.values('submissionDateTime')[:1]
                )
            )
        )

        if len(submissions) < 2:
            return {
                "success": False,
                "message": "Not enough submissions for peer matching",
                "matches": None
            }

        # Shuffle to introduce randomness so that each test iteration won't yield the same result
        random.shuffle(submissions)

        # We want every student to perform exactly r reviews
        r = assignment.reviews_per_student

        # 1) If r > (number_of_submissions - 1), it's impossible for each student to do r distinct reviews
        # since they cannot review their own submission
        if r > len(submissions) - 1:
            return {
                "success": False,
                "message": "Could not assign all reviews fairly",
                "matches": None
            }

        # 2) Clear out all old allocations from this assignment
        PeerReviewAllocation.objects.filter(assignment=assignment).delete()

        # Each submission belongs to exactly one student
        # We will treat the submissions list as a ring and "shift" to decide which reviews they get
        # so that each student ends up with exactly r reviews, and each submission ends up reviewed r times.
        S = len(submissions)
        new_allocations = []
        for i in range(S):
            reviewer = submissions[i].student
            # We pick r distinct "neighbors" in a ring, skipping the student's own submission
            for k in range(r):
                # Move forward k+1 steps in the ring
                target_index = (i + k + 1) % S
                submission_target = submissions[target_index]

                new_allocations.append(
                    PeerReviewAllocation(
                        reviewer=reviewer,
                        submission=submission_target,
                        assignment=assignment,
                        status='PENDING'
                    )
                )

        # Bulk create the new allocations
        PeerReviewAllocation.objects.bulk_create(new_allocations)

        # Verify that each student got exactly r reviews assigned
        # and that each submission has at least r reviewers
        # (In theory this round-robin approach is guaranteed, but we double-check just to be safe.)
        reviews_assigned_to_student = {}
        reviews_for_submission = {}
        for alloc in PeerReviewAllocation.objects.filter(assignment=assignment):
            rid = alloc.reviewer_id
            sid = alloc.submission_id
            reviews_assigned_to_student[rid] = reviews_assigned_to_student.get(rid, 0) + 1
            reviews_for_submission[sid] = reviews_for_submission.get(sid, 0) + 1

        # Check if any student is under-assigned or over-assigned
        for student_id, count in reviews_assigned_to_student.items():
            if count != r:
                # rollback
                PeerReviewAllocation.objects.filter(assignment=assignment).delete()
                print(f"[DEBUG] Rolling back - student {student_id} had {count} instead of {r}")
                return {
                    "success": False,
                    "message": "Could not assign all reviews fairly",
                    "matches": None
                }

        # Check that no submission ended up with fewer than r reviewers
        for submission_id, count in reviews_for_submission.items():
            if count < r:
                # rollback
                PeerReviewAllocation.objects.filter(assignment=assignment).delete()
                print(f"[DEBUG] Rolling back - submission {submission_id} had {count} instead of at least {r}")
                return {
                    "success": False,
                    "message": "Could not assign all reviews fairly",
                    "matches": None
                }

        assignment.is_peer_review_matching_complete = True
        assignment.save()

        # Build a little summary to return in "matches" 
        # (the test doesn't rely on it but it's nice to show what we did)
        matches = [
            {
                "reviewer_name": getattr(alloc.reviewer, 'userName', ''),
                "reviewer_email": getattr(alloc.reviewer, 'userEmail', ''),
                "reviewer_userNumber": getattr(alloc.reviewer, 'userNumber', ''),
                "submission_owner_name": getattr(getattr(alloc.submission, 'student'), 'userName', ''),
                "submission_owner_email": getattr(getattr(alloc.submission, 'student'), 'userEmail', ''),
                "submission_owner_userNumber": getattr(getattr(alloc.submission, 'student'), 'userNumber', ''),
                "status": alloc.status
            }
            for alloc in PeerReviewAllocation.objects.filter(assignment=assignment)
        ]

        return {
            "success": True,
            "message": "Peer matching completed successfully",
            "matches": matches
        }

    except Assignment.DoesNotExist:
        return {
            "success": False,
            "message": "Assignment not found",
            "matches": None
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Error during peer matching: {str(e)}",
            "matches": None
        }

@router.get("/{assignment_id}/statistics", response=AssignmentStatistics, operation_id="getAssignmentStatistics")
@require_auth(roles=['Academic', 'Marker', 'TA'])
@check_permissions(IsCourseStaffFromAssignment)
def get_assignment_statistics(request, assignment_id: int):
    assignment = Assignment.objects.get(id=assignment_id)
    
    # Get submission stats
    submissions = Submission.objects.filter(assignment_id=assignment_id)
    total_submissions = submissions.count()
    unique_submitters = submissions.values('student').distinct().count()
    
    # Get active users in last 24h - using Course2Student model directly
    twenty_four_hours_ago = timezone.now() - timedelta(hours=24)
    active_users = Course2Student.objects.filter(
        course=assignment.course,
        student__last_seen__gte=twenty_four_hours_ago
    ).values('student').distinct().count()
    
    # Get peer review stats
    peer_reviews = PeerReviewAllocation.objects.filter(assignment_id=assignment_id)
    total_peer_reviews = peer_reviews.count()
    
    status_counts = dict(peer_reviews.values_list('status').annotate(count=Count('status')))
    
    # Calculate average reviews per student
    students_with_reviews = peer_reviews.values('reviewer').distinct().count()
    avg_reviews = total_peer_reviews / students_with_reviews if students_with_reviews > 0 else 0
    
    # Calculate completion rate
    completed_reviews = status_counts.get('COMPLETED', 0)
    completion_rate = (completed_reviews / total_peer_reviews * 100) if total_peer_reviews > 0 else 0
    
    return {
        "total_submissions": total_submissions,
        "unique_submitters": unique_submitters,
        "active_users_24h": active_users,
        "total_peer_reviews": total_peer_reviews,
        "peer_review_stats": status_counts,
        "average_reviews_per_student": round(avg_reviews, 2),
        "completion_rate": round(completion_rate, 2)
    }