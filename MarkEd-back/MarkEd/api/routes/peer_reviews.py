from ninja import Router, Schema
from typing import List
from django.utils import timezone
from ..schemas.peer_review import PeerReviewSchema, PeerReviewCommentSchema, PeerReviewCommentAction, PeerReviewCompletion, DismissLLMFeedbackRequest, DismissedLLMFeedbackResponse, PeerReviewSchemaWithStudent
from ..schemas.feedback import CreationResponse
from ..decorators import require_auth, check_permissions
from ..permissions import CanAccessPeerReviews, CanPerformPeerReview, CanCreatePeerReviewComment, check_comment_rate_limit, validate_peer_review_content, CanModifyPeerReviewComment
from ...models import PeerReviewAllocation, Assignment, PeerReviewComment, User, Course2Marker, DismissedLLMFeedback, Submission
from ...tasks import process_feedback_with_llm
from django.db.models import Q
from datetime import timedelta
from django.http import StreamingHttpResponse
from django.core.serializers import serialize
import json
from ninja.security import HttpBearer
import logging
from django.views.decorators.http import require_http_methods
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.urls import path
import time
from django.contrib.auth.decorators import login_required
from ninja.security import django_auth
from MarkEd.utils import log_execution_time
from django.core.exceptions import ValidationError
import bleach
from django.core.cache import cache
import random

router = Router()
logger = logging.getLogger(__name__)

# LLM feedback delay configuration
MIN_LLM_DELAY_SECONDS = 20  # Minimum delay of 20 seconds
MAX_LLM_DELAY_SECONDS = 90  # Maximum delay of 1.5 minutes

@router.get("/{assignment_id}/reviews", response=List[PeerReviewSchema], operation_id="getPeerReviews")
@require_auth()
def get_peer_reviews(request, assignment_id: int):
    reviews = PeerReviewAllocation.objects.filter(
        assignment_id=assignment_id,
        reviewer_id=request.user_id
    ).select_related('submission__student')
    
    return [
        {
            "id": review.id,
            "submission_id": getattr(review, 'submission_id', None),
            "status": review.status,
            "student_name": getattr(getattr(review.submission, 'student', None), 'userName', None)
        }
        for review in reviews
    ]

@router.post("/{assignment_id}/submit-review", response=CreationResponse)
@require_auth()
@check_permissions(CanPerformPeerReview)
def submit_peer_review(request, assignment_id: int, submission_id: int):
    try:
        review = PeerReviewAllocation.objects.get(
            assignment_id=assignment_id,
            submission_id=submission_id,
            reviewer_id=request.user_id
        )
        
        review.status = 'COMPLETED'
        review.completed_at = timezone.now()
        review.save()
        
        return {
            "success": True,
            "message": "Peer review submitted successfully"
        }
        
    except PeerReviewAllocation.DoesNotExist:
        return {
            "success": False,
            "message": "Review allocation not found"
        }

class CommentCreate(Schema):
    selected_text: str
    feedback: str
    margin_text_top: str
    margin_text_bottom: str
    position_data: dict

@router.post("/{assignment_id}/{submission_id}/comments", response=PeerReviewCommentSchema, operation_id="createPeerReviewComment")
@require_auth()
@check_permissions(CanCreatePeerReviewComment)
@log_execution_time
def create_peer_review_comment(request, assignment_id: int, submission_id: int, data: CommentCreate):
    try:
        # Check rate limit
        if not check_comment_rate_limit(request.user_id):
            return {
                "success": False,
                "message": "Too many comments. Please wait a minute before trying again."
            }

        try:
            cleaned_feedback = validate_peer_review_content(data.feedback)
        except ValidationError as e:
            return {
                "success": False,
                "message": str(e)
            }

        # Ensure position data has all required fields
        position_data = data.position_data
        bounding_rect = position_data.get('boundingRect', {})
        position_data['boundingRect'] = {
            'x': bounding_rect.get('x', bounding_rect.get('left', 0)),
            'y': bounding_rect.get('y', bounding_rect.get('top', 0)),
            'top': bounding_rect.get('top', bounding_rect.get('y', 0)),
            'left': bounding_rect.get('left', bounding_rect.get('x', 0)),
            'right': bounding_rect.get('right', bounding_rect.get('left', 0) + bounding_rect.get('width', 0)),
            'width': bounding_rect.get('width', bounding_rect.get('right', 0) - bounding_rect.get('left', 0)),
            'bottom': bounding_rect.get('bottom', bounding_rect.get('top', 0) + bounding_rect.get('height', 0)),
            'height': bounding_rect.get('height', bounding_rect.get('bottom', 0) - bounding_rect.get('top', 0))
        }

        # Get or create review allocation
        review, created = PeerReviewAllocation.objects.get_or_create(
            assignment_id=assignment_id,
            submission_id=submission_id,
            reviewer_id=request.user_id,
            defaults={
                'status': 'IN_PROGRESS' if request.user_role in ['Marker', 'TA', 'Academic'] else 'PENDING'
            }
        )
        
        comment = PeerReviewComment.objects.create(
            review_allocation=review,
            selected_text=bleach.clean(data.selected_text, strip=True),
            feedback=cleaned_feedback,
            margin_text_top=bleach.clean(data.margin_text_top, strip=True),
            margin_text_bottom=bleach.clean(data.margin_text_bottom, strip=True),
            position_data=position_data
        )
        
        # Only schedule LLM processing for student comments
        if request.user_role == 'Student':
            process_feedback_with_llm.apply_async(
                args=[comment.id],
                countdown=random.randint(MIN_LLM_DELAY_SECONDS, MAX_LLM_DELAY_SECONDS)
            )
        
        return {
            "id": comment.id,
            "selected_text": comment.selected_text,
            "feedback": comment.feedback,
            "margin_text_top": comment.margin_text_top,
            "margin_text_bottom": comment.margin_text_bottom,
            "position_data": comment.position_data,
            "created_at": comment.created_at,
            "author": {
                "id": comment.review_allocation.reviewer_id,
                "userNumber": comment.review_allocation.reviewer.userNumber,
                "userName": comment.review_allocation.reviewer.userName,
                "userEmail": comment.review_allocation.reviewer.userEmail,
                "role": comment.review_allocation.reviewer.role,
                "isValid": comment.review_allocation.reviewer.isValid
            },
            "marker_feedback": comment.marker_comment,
            "llm_feedback": "",
            "llm_feedback_dismissed": True,
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": str(e)
        }

@router.get("/{assignment_id}/{submission_id}/comments", response=List[PeerReviewCommentSchema], operation_id="getPeerReviewComments")
@require_auth()
@log_execution_time
def get_peer_review_comments(request, assignment_id: int, submission_id: int):
    # Check if user is a marker, TA, or academic for this course
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
        
        # Check if user is the submission owner
        submission_owner = Submission.objects.filter(
            id=submission_id,
            student_id=request.user_id
        ).exists()
    except Assignment.DoesNotExist:
        return []

    # If user is a marker, TA, or academic, return all peer reviews for this submission
    # If user is the submission owner, also return all comments for their submission
    if is_marker or submission_owner:
        comments = PeerReviewComment.objects.filter(
            review_allocation__assignment_id=assignment_id,
            review_allocation__submission_id=submission_id
        ).select_related('review_allocation', 'review_allocation__reviewer')
    else:
        # Otherwise, return only the peer reviews assigned to the current user
        comments = PeerReviewComment.objects.filter(
            review_allocation__assignment_id=assignment_id,
            review_allocation__submission_id=submission_id,
            review_allocation__reviewer_id=request.user_id
        ).select_related('review_allocation', 'review_allocation__reviewer')
    
    result = []
    for comment in comments:
        reviewer = comment.review_allocation.reviewer
        
        # For submission owners viewing comments, anonymize userNumbers
        if submission_owner and not is_marker:
            result.append({
                "id": comment.id,
                "selected_text": comment.selected_text,
                "feedback": comment.feedback,
                "margin_text_top": comment.margin_text_top,
                "margin_text_bottom": comment.margin_text_bottom,
                "position_data": comment.position_data,
                "created_at": comment.created_at,
                "author": {
                    "id": reviewer.id,
                    "userNumber": "",  # Anonymize student IDs
                    "userName": "Marker" if reviewer.role in ['M', 'T', 'A'] else reviewer.userName,
                    "userEmail": "",  # Hide email
                    "role": reviewer.role,
                    "isValid": reviewer.isValid
                },
                "marker_feedback": comment.marker_comment,
                "llm_feedback": "",  # Don't show LLM feedback to submission owners
                "llm_feedback_dismissed": True,
            })
        else:
            result.append({
                "id": comment.id,
                "selected_text": comment.selected_text,
                "feedback": comment.feedback,
                "margin_text_top": comment.margin_text_top,
                "margin_text_bottom": comment.margin_text_bottom,
                "position_data": comment.position_data,
                "created_at": comment.created_at,
                "author": {
                    "id": reviewer.id,
                    "userNumber": reviewer.userNumber,
                    "userName": reviewer.userName,
                    "userEmail": reviewer.userEmail,
                    "role": reviewer.role,
                    "isValid": reviewer.isValid
                },
                "marker_feedback": comment.marker_comment,
                "llm_feedback": comment.llm_comment if not comment.llm_comment_dismissed else "",
                "llm_feedback_dismissed": comment.llm_comment_dismissed,
            })
    
    return result

@router.delete("/{assignment_id}/{submission_id}/comments/{comment_id}", response=PeerReviewCommentAction, operation_id="deletePeerReviewComment")
@require_auth()
def delete_peer_review_comment(request, assignment_id: int, submission_id: int, comment_id: int):
    try:
        comment = PeerReviewComment.objects.get(
            id=comment_id,
            review_allocation__assignment_id=assignment_id,
            review_allocation__submission_id=submission_id,
            review_allocation__reviewer_id=request.user_id
        )
        
        # If there's existing LLM feedback that hasn't been dismissed, log the dismissal
        if comment.llm_comment and not comment.llm_comment_dismissed:
            print("Creating dismissed LLM feedback")
            DismissedLLMFeedback.objects.create(
                user_id=request.user_id,
                llm_feedback=comment.llm_comment,
                original_feedback=comment.feedback,
                context_text=comment.selected_text,
                dismiss_reason="DELETED",
                user_feedback=""
            )
            
        comment.delete()
        
        return {
            "success": True,
            "message": "Comment deleted successfully"
        }
        
    except PeerReviewComment.DoesNotExist:
        return {
            "success": False,
            "message": "Comment not found"
        }

@router.get("/{assignment_id}/{submission_id}/complete", response=PeerReviewCompletion, operation_id="isPeerReviewComplete")
@require_auth()
def get_peer_review_complete(request, assignment_id: int, submission_id: int):
    try:
        review = PeerReviewAllocation.objects.get(
            assignment_id=assignment_id,
            submission_id=submission_id,
            reviewer_id=request.user_id
        )
        return {
            "success": True,
            "message": "Peer review marked as completed",
            "is_completed": review.status == 'COMPLETED'
        }
    except PeerReviewAllocation.DoesNotExist:
        return {
            "success": False,
            "message": "Review allocation not found"
        }

@router.post("/{assignment_id}/{submission_id}/completenessToggle", response=PeerReviewCompletion, operation_id="togglePeerReviewCompleteness")
@require_auth()
@log_execution_time
def complete_peer_review(request, assignment_id: int, submission_id: int):
    try:
        # Check rate limit
        rate_key = f'review_complete_rate_{request.user_id}'
        RATE_LIMIT_PERIOD = 60  # 1 minute
        MAX_TOGGLES = 5  # Maximum toggles per period
        
        current_count = cache.get(rate_key, 0)
        if current_count >= MAX_TOGGLES:
            return {
                "success": False,
                "message": "You are going too fast! Please wait 1 minute before trying again.",
                "is_completed": False
            }
        cache.set(rate_key, current_count + 1, RATE_LIMIT_PERIOD)

        # Get review allocation and related data
        review = PeerReviewAllocation.objects.select_related(
            'assignment'
        ).get(
            assignment_id=assignment_id,
            submission_id=submission_id,
            reviewer_id=request.user_id
        )

        # Check if review deadline has passed
        if timezone.now() > review.assignment.review_deadline:
            return {
                "success": False,
                "message": "Review deadline has passed",
                "is_completed": review.status == PeerReviewAllocation.STATUS_CHOICES[2][0]
            }

        # Check minimum review requirements
        comment_count = PeerReviewComment.objects.filter(
            review_allocation=review
        ).count()

        MIN_COMMENTS = -1

        if review.status != PeerReviewAllocation.STATUS_CHOICES[2][0]:  # If marking as complete
            # Get all comments for this review
            comments = PeerReviewComment.objects.filter(
                review_allocation=review
            ).values_list('feedback', flat=True)

            # Check minimum number of comments
            if comment_count < MIN_COMMENTS:
                return {
                    "success": False,
                    "message": f"Please provide at least {MIN_COMMENTS} comments before marking as complete",
                    "is_completed": False
                }

        # Toggle status
        new_status = (PeerReviewAllocation.STATUS_CHOICES[2][0] 
                     if review.status == PeerReviewAllocation.STATUS_CHOICES[1][0] 
                     else PeerReviewAllocation.STATUS_CHOICES[1][0])
        
        # Update status and completion time
        review.status = new_status
        review.completed_at = timezone.now() if new_status == PeerReviewAllocation.STATUS_CHOICES[2][0] else None
        review.save()
        
        return {
            "success": True,
            "message": "Peer review status updated successfully",
            "is_completed": new_status == PeerReviewAllocation.STATUS_CHOICES[2][0]
        }
        
    except PeerReviewAllocation.DoesNotExist:
        return {
            "success": False,
            "message": "Review allocation not found",
            "is_completed": False
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Error updating review status: {str(e)}",
            "is_completed": False
        }

@router.post("/{assignment_id}/{submission_id}/comments/{comment_id}/dismiss-llm", response=DismissedLLMFeedbackResponse, operation_id="dismissLLMFeedback")
@require_auth()
@check_permissions(CanModifyPeerReviewComment)
def dismiss_llm_feedback(request, assignment_id: int, submission_id: int, comment_id: int, data: DismissLLMFeedbackRequest):
    try:
        # Check rate limit
        rate_key = f'llm_dismiss_rate_{request.user_id}'
        RATE_LIMIT_PERIOD = 60  # 1 minute
        MAX_DISMISSALS = 3  # Maximum dismissals per minute
        
        current_count = cache.get(rate_key, 0)
        if current_count >= MAX_DISMISSALS:
            return {
                "success": False,
                "message": "You are going too fast! Please wait a minute before trying again."
            }
        cache.set(rate_key, current_count + 1, RATE_LIMIT_PERIOD)

        # Get comment and verify it has LLM feedback to dismiss
        comment = PeerReviewComment.objects.select_related(
            'review_allocation__assignment'
        ).get(
            id=comment_id,
            review_allocation__assignment_id=assignment_id,
            review_allocation__submission_id=submission_id,
            review_allocation__reviewer_id=request.user_id,
            llm_comment_dismissed=False,  # Can't dismiss already dismissed feedback
            llm_comment__isnull=False,    # Must have LLM feedback to dismiss
            llm_comment__gt=''            # Must not be empty
        )

        # Validate user feedback length if provided
        if data.user_feedback and len(data.user_feedback) > 500:  # Limit feedback length
            return {
                "success": False,
                "message": "User feedback is too long"
            }

        # Create dismissed feedback record
        DismissedLLMFeedback.objects.create(
            user_id=request.user_id,
            llm_feedback=comment.llm_comment,
            original_feedback=comment.feedback,
            context_text=comment.selected_text,
            dismiss_reason=data.dismiss_reason,
            user_feedback=bleach.clean(data.user_feedback or "", strip=True)
        )
        
        # Mark as dismissed
        comment.llm_comment_dismissed = True
        comment.save(update_fields=['llm_comment_dismissed'])
        
        return {
            "success": True,
            "message": "AI Suggestion dismissed successfully"
        }
        
    except PeerReviewComment.DoesNotExist:
        return {
            "success": False,
            "message": "Comment not found or already dismissed"
        }
    except ValidationError as e:
        return {
            "success": False,
            "message": str(e)
        }

@router.patch("/{assignment_id}/{submission_id}/comments/{comment_id}", response=PeerReviewCommentAction, operation_id="updatePeerReviewComment")
@require_auth()
@check_permissions(CanModifyPeerReviewComment)
def update_peer_review_comment(request, assignment_id: int, submission_id: int, comment_id: int, data: CommentCreate):
    try:
        # Check rate limit
        if not check_comment_rate_limit(request.user_id):
            return {
                "success": False,
                "message": "Too many updates. Please wait a minute before trying again."
            }

        try:
            cleaned_feedback = validate_peer_review_content(data.feedback)
        except ValidationError as e:
            return {
                "success": False,
                "message": str(e)
            }

        comment = PeerReviewComment.objects.get(
            id=comment_id,
            review_allocation__assignment_id=assignment_id,
            review_allocation__submission_id=submission_id,
            review_allocation__reviewer_id=request.user_id
        )
        
        # Only do LLM if feedback changed
        if comment.feedback != cleaned_feedback:
            if comment.llm_comment and not comment.llm_comment_dismissed:
                DismissedLLMFeedback.objects.create(
                    user_id=request.user_id,
                    llm_feedback=comment.llm_comment,
                    original_feedback=comment.feedback,
                    context_text=comment.selected_text,
                    dismiss_reason="EDIT",
                    user_feedback=""
                )
            
            PeerReviewComment.objects.filter(id=comment_id).update(
                feedback=cleaned_feedback,
                llm_comment="",
                llm_comment_dismissed=False
            )
            
            process_feedback_with_llm.apply_async(
                args=[comment.id],
                countdown=random.randint(MIN_LLM_DELAY_SECONDS, MAX_LLM_DELAY_SECONDS)
            )
            
        return {
            "success": True,
            "message": "Comment updated successfully"
        }
        
    except PeerReviewComment.DoesNotExist:
        return {
            "success": False,
            "message": "Comment not found"
        }

class MarkerCommentUpdate(Schema):
    marker_feedback: str

@router.patch("/{assignment_id}/{submission_id}/comments/{comment_id}/marker", response=PeerReviewCommentAction, operation_id="updateMarkerComment")
@require_auth()
@log_execution_time
def update_marker_comment(request, assignment_id: int, submission_id: int, comment_id: int, data: MarkerCommentUpdate):
    try:

        comment = PeerReviewComment.objects.get(
            id=comment_id,
            review_allocation__assignment_id=assignment_id,
            review_allocation__submission_id=submission_id,
        )
        
        # Get the course from the assignment
        course = comment.review_allocation.assignment.course
        
        # Check if user is a marker for this course
        is_marker = (
            Course2Marker.objects.filter(
                course=course,
                marker_id=request.user_id,
                markingPermission__gt=0
            ).exists() or
            User.objects.filter(
                id=request.user_id,
                role__in=['M', 'T', 'A']  # Is a Marker, TA, or Academic
            ).exists()
        )
        
        if not is_marker:
            return {
                "success": False,
                "message": "Not authorized to add marker feedback"
            }
        
        comment.marker_comment = data.marker_feedback
        comment.save()
        
        return {
            "success": True,
            "message": "Marker comment updated successfully"
        }
        
    except PeerReviewComment.DoesNotExist:
        return {
            "success": False,
            "message": "Comment not found"
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Error updating marker comment: {str(e)}"
        }

@router.get("/{assignment_id}/marker-allocations", response=List[PeerReviewSchemaWithStudent], operation_id="getMarkerAllocations")
@require_auth(roles=['Marker', 'Academic', 'TA'])
def get_marker_allocations(request, assignment_id: int):
    """Get peer reviews allocated to this marker"""
    print(f"Starting get_marker_allocations for assignment_id: {assignment_id}")
    try:
        # Check if user is authenticated and has an ID
        if not request.user_id:
            print("User not authenticated")
            return []

        # Get the assignment
        print(f"Fetching assignment with id: {assignment_id}")
        assignment = Assignment.objects.get(id=assignment_id)
        print(f"Found assignment: {assignment}")
        
        # Check if user is a marker for this course - modified to include role check
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

        if not is_marker:
            print(f"User {request.user_id} is not a marker for this course")
            return []

        # Get all peer review allocations for this assignment
        print("Fetching all peer review allocations")
        all_peer_reviews = PeerReviewAllocation.objects.filter(
            assignment=assignment
        ).select_related('submission', 'submission__student').order_by('submission_id')
        print(f"Found {len(all_peer_reviews)} total peer review allocations")

        # Get total number of markers for this course
        print("Getting total markers for course")
        total_markers = Course2Marker.objects.filter(
            course=assignment.course,
            markingPermission__gt=0
        ).order_by('marker_id')

        # Find this marker's index
        marker_index = list(total_markers.values_list('marker_id', flat=True)).index(request.user_id)
        total_markers_count = total_markers.count()
        print(f"Marker index: {marker_index}, Total markers: {total_markers_count}")

        # Calculate which allocations this marker should handle
        if total_markers_count > 0:
            # Group allocations by submission_id to ensure complete sets
            submissions = {}
            for review in all_peer_reviews:
                if review.submission_id not in submissions:
                    submissions[review.submission_id] = []
                submissions[review.submission_id].append(review)

            # Convert to list of submission groups
            submission_groups = list(submissions.values())
            
            # Calculate distribution
            submissions_per_marker = len(submission_groups) // total_markers_count
            start_index = marker_index * submissions_per_marker
            end_index = start_index + submissions_per_marker if marker_index < total_markers_count - 1 else None
            
            # Get this marker's allocated submission groups
            allocated_groups = submission_groups[start_index:end_index]
            
            # Flatten the groups into a single list of reviews
            allocated_reviews = [review for group in allocated_groups for review in group]
            print(f"Allocated {len(allocated_reviews)} reviews across {len(allocated_groups)} submissions to this marker")

            # Convert to response schema, using the first review from each group as the representative
            print("Converting allocated reviews to response schema")
            return [
                PeerReviewSchemaWithStudent(
                    id=group[0].id,  # Use first review's ID as representative
                    submission_id=group[0].submission.id,
                    status=group[0].status,
                    student_name=group[0].submission.student.userName,
                    student_number=group[0].submission.student.userNumber,
                )
                for group in allocated_groups
            ]
        
        print("No markers found, returning empty list")
        return []

    except Assignment.DoesNotExist:
        logger.error(f"Assignment {assignment_id} not found")
        return []
    except Exception as e:
        logger.error(f"Error in get_marker_allocations: {str(e)}", exc_info=True)
        return []
