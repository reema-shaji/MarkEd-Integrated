from typing import Any
from datetime import datetime
from django.utils import timezone
from django.core.cache import cache
from MarkEd.models import Course2Marker, Course2Student, Assignment, PeerReviewAllocation, Submission, PeerReviewComment
from django.core.exceptions import ValidationError
import json
import bleach
from dataclasses import dataclass


def _pr_target_kwargs(assignment_id, target_id):
    """Peer review allocations target a Submission or a GroupSubmission (§8).

    An assignment is entirely individual or entirely group, so the single
    `submission_id` path value maps unambiguously to one FK. Mirrors the helper
    in routes/peer_reviews.py so the permission checks resolve the same object.
    """
    is_group = Assignment.objects.filter(
        id=assignment_id, assignment_type='GROUP'
    ).exists()
    key = 'group_submission_id' if is_group else 'submission_id'
    return {key: target_id}

@dataclass
class PositionData:
    pageNumber: int
    boundingRect: dict

    @classmethod
    def validate(cls, data: dict) -> bool:
        try:
            if not isinstance(data.get('pageNumber'), int):
                return False
            
            rect = data.get('boundingRect', {})
            required_fields = ['x', 'y', 'width', 'height']
            return all(isinstance(rect.get(field), (int, float)) for field in required_fields)
        except (AttributeError, TypeError):
            return False

class BasePermission:
    def has_permission(self, request: Any, **kwargs: Any) -> bool:
        return True

class IsCourseStaffFromAssignment(BasePermission):
    """Verifies user is a staff member (Academic/Marker/TA) for the specified course of the given assignment"""
    def has_permission(self, request: Any, **kwargs: Any) -> bool:
        course_id = kwargs.get('course_id')
        assignment_id = kwargs.get('assignment_id')
        
        if assignment_id and not course_id:
            try:
                assignment = Assignment.objects.get(id=assignment_id)
                course_id = getattr(assignment, 'course').id
            except Assignment.DoesNotExist:
                return False
                
        if not course_id:
            return False
            
        return Course2Marker.objects.filter(
            course_id=course_id,
            marker_id=request.user_id
        ).exists()
        

class AssignmentSubmissionDeadlineHasNotPassed(BasePermission):
    """Verifies that the assignment submission deadline has not passed"""
    def has_permission(self, request: Any, **kwargs: Any) -> bool:
        if request.method == "POST":
            if hasattr(request, 'body'):
                try:
                    data = json.loads(request.body)
                except json.JSONDecodeError:
                    return False
            else:
                data = request.POST
            
            assignment_id = data.get('assignment_id')
        try:
            assignment = Assignment.objects.get(id=assignment_id)
            return assignment.deadline > timezone.now()
        except Assignment.DoesNotExist:
            return False

class IsEnrolledStudent(BasePermission):
    """Verifies user is enrolled in the specified course"""
    def has_permission(self, request: Any, **kwargs: Any) -> bool:
        # Get assignment_id from request data for POST requests
        if request.method == "POST":
            # For JSON requests
            if hasattr(request, 'body'):
                try:
                    data = json.loads(request.body)
                except json.JSONDecodeError:
                    return False
            # For form data
            else:
                data = request.POST
            
            assignment_id = data.get('assignment_id')
            if not assignment_id:
                return False
                
            try:
                # Get the course from the assignment
                assignment = Assignment.objects.get(id=assignment_id)
                course_id = getattr(assignment, 'course').id
            except Assignment.DoesNotExist:
                return False
                
        # For GET requests, try to get course_id from kwargs
        else:
            course_id = kwargs.get('course_id')
            if not course_id:
                return False

        # Check if student is enrolled in the course
        return Course2Student.objects.filter(
            course_id=course_id,
            student_id=request.user_id
        ).exists()

class CanCreateAssignment(BasePermission):
    """Verifies user has assignment creation privileges for the course"""
    def has_permission(self, request: Any, **kwargs: Any) -> bool:
        course_id = kwargs.get('course_id')
        course_marker = Course2Marker.objects.filter(
            course_id=course_id,
            marker_id=request.user_id
        ).first()
        return bool(course_marker and course_marker.canCreateAssignment)

class CanAccessPeerReviews(BasePermission):
    """
    Checks if user can access peer reviews based on:
    1. Staff can always access
    2. Students can access if assignment allows it
    3. Must be after submission deadline
    """
    def has_permission(self, request: Any, **kwargs: Any) -> bool:
        assignment_id = kwargs.get('assignment_id')
        try:
            assignment = Assignment.objects.get(id=assignment_id)
            
            # Staff can always access
            if request.user_role in ['Academic', 'Marker', 'TA']:
                return True
                
            # For students
            if request.user_role == 'Student':
                now = timezone.now()
                # TODO: Add this back in!!!!!!
                # return (
                #     
                #     now > assignment.submission_deadline
                # )
                return True
                
            return False
            
        except Assignment.DoesNotExist:
            return False

class CanPerformPeerReview(BasePermission):
    """
    Checks if:
    1. User is assigned to review this submission
    2. Review deadline hasn't passed
    3. Original submission exists
    """
    def has_permission(self, request: Any, **kwargs: Any) -> bool:
        assignment_id = kwargs.get('assignment_id')
        submission_id = kwargs.get('submission_id')
        try:
            assignment = Assignment.objects.get(id=assignment_id)
            
            # Check if user is assigned to review this submission
            is_reviewer = PeerReviewAllocation.objects.filter(
                assignment_id=assignment_id,
                reviewer_id=request.user_id,
                **_pr_target_kwargs(assignment_id, submission_id)
            ).exists()
            
            if not is_reviewer:
                return False
                
            # Check deadline
            now = timezone.now()
            if now > assignment.review_deadline:
                return False
                
            return True
            
        except Assignment.DoesNotExist:
            return False

class CanCreatePeerReviewComment(BasePermission):
    """Verifies user can create a peer review comment based on multiple criteria"""
    def has_permission(self, request: Any, **kwargs: Any) -> bool:
        assignment_id = kwargs.get('assignment_id')
        submission_id = kwargs.get('submission_id')

        try:
            assignment = Assignment.objects.get(id=assignment_id)
            
            # Staff (Markers, TAs, Academics) can always create comments
            if request.user_role in ['Marker', 'TA', 'Academic']:
                return True

            # For students, check the normal peer review requirements
            if request.user_role == 'Student':
                if timezone.now() <= assignment.deadline:
                    return False

                if timezone.now() > assignment.review_deadline:
                    return False

                return PeerReviewAllocation.objects.filter(
                    assignment_id=assignment_id,
                    reviewer_id=request.user_id,
                    **_pr_target_kwargs(assignment_id, submission_id)
                ).exists()

            return False

        except Assignment.DoesNotExist:
            return False

class CanModifyPeerReviewComment(BasePermission):
    """Verifies user can modify a specific peer review comment"""
    def has_permission(self, request: Any, **kwargs: Any) -> bool:
        assignment_id = kwargs.get('assignment_id')
        submission_id = kwargs.get('submission_id')
        comment_id = kwargs.get('comment_id')

        try:
            # Check if comment exists and belongs to user
            comment = PeerReviewComment.objects.select_related(
                'review_allocation__assignment'
            ).get(
                id=comment_id,
                review_allocation__assignment_id=assignment_id,
                **{f'review_allocation__{k}': v
                   for k, v in _pr_target_kwargs(assignment_id, submission_id).items()},
            )

            # Staff can modify their own comments
            if request.user_role in ['Marker', 'TA', 'Academic']:
                return comment.review_allocation.reviewer_id == request.user_id

            # Students can only modify their own comments
            if request.user_role == 'Student':
                if comment.review_allocation.reviewer_id != request.user_id:
                    return False

                # Check if review deadline hasn't passed
                if timezone.now() > comment.review_allocation.assignment.review_deadline:
                    return False

                return True

            return False

        except PeerReviewComment.DoesNotExist:
            return False

def validate_peer_review_content(content: str) -> str:
    """
    Validates and sanitizes peer review content
    Raises ValidationError if content is invalid
    """
    # Define allowed HTML tags and attributes
    ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li']

    # Check content length
    if not content or len(content) > 2000:  # Adjust max length as needed
        raise ValidationError("Content must be between 1 and 2000 characters")

    # Sanitize HTML content
    cleaned_content = bleach.clean(
        content,
        tags=ALLOWED_TAGS,
        attributes={},
        strip=True
    )

    return cleaned_content

def check_comment_rate_limit(user_id: int) -> bool:
    """
    Implements rate limiting for comment creation
    Returns True if user can create comment, False otherwise
    """
    RATE_LIMIT_PERIOD = 60  # 1 minute
    MAX_COMMENTS = 10  # Maximum comments per minute

    cache_key = f'peer_review_comment_rate_{user_id}'
    current_count = cache.get(cache_key, 0)

    if current_count >= MAX_COMMENTS:
        return False

    # Increment counter
    cache.set(cache_key, current_count + 1, RATE_LIMIT_PERIOD)
    return True 