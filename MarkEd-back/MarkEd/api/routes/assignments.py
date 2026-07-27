from ninja import Router
from typing import List, Set
from django.db import models
from django.shortcuts import get_object_or_404
from ..schemas.assignment import AssignmentSchema, AssignmentCreateRequest, MyAssignmentStatusSchema, PeerAssignmentRequest, PeerAssignmentCreationResponse, AssignmentStatistics, AssignmentUpdateRequest, AssignmentStructureSchema, StructureCriterionSchema, CriterionUpsertRequest, MarkerJobSchema, ResultsReleaseRequest
from ..schemas.feedback import CreationResponse
from ..decorators import require_auth, check_permissions
from ..permissions import IsCourseStaffFromAssignment, CanCreateAssignment
from ...models import (
    Assignment,
    Course2Marker,
    Criteria,
    Group,
    GroupMember,
    GroupSet,
    GroupSubmission,
    GroupSubmissionCriteria,
    PeerReviewAllocation,
    SelfAssessmentSetting,
    StudentSelfAssessmentSubmission,
    Submission,
    SubmissionCriteria,
    Course2Student,
)
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
def list_assignments(request, course_id: int = None):
    """Assignments visible to the current user, optionally scoped to a course.

    The course filter backs the sidebar's course switcher, which the unified
    navigation treats as a context filter rather than a navigation selector
    (Design PRD §3.1).
    """
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
    if course_id is not None:
        assignments = assignments.filter(course_id=course_id)
    # select_related avoids an extra query per assignment when the schema
    # resolves the self-assessment flags.
    return assignments.select_related('selfassessmentsetting').order_by('deadline')

@router.get("/{assignment_id}", response=AssignmentSchema, operation_id="getAssignment")
@require_auth()
# @check_permissions(IsEnrolledStudent)
def get_assignment(request, assignment_id: int):
    # 404 (not 500) for a non-existent assignment, so the frontend can show a
    # proper "not found" instead of a broken skeleton (report B13).
    return get_object_or_404(Assignment, id=assignment_id)


@router.get("/{assignment_id}/my-status", response=MyAssignmentStatusSchema, operation_id="getMyAssignmentStatus")
@require_auth(roles=['Student'])
def get_my_assignment_status(request, assignment_id: int):
    """The current student's own status for an assignment (Assignment Detail):
    their group, whether they've submitted, and whether that was late."""
    assignment = Assignment.objects.get(id=assignment_id)
    group = None
    if assignment.group_set_id:
        membership = (GroupMember.objects.filter(
            student_id=request.user_id,
            group__group_set_id=assignment.group_set_id,
            group__is_active=True, is_active=True,
        ).select_related('group').first())
        group = membership.group if membership else None

    if assignment.is_group_assignment():
        submission = (GroupSubmission.objects.filter(
            group=group, assignment=assignment, is_active=True
        ).order_by('-submission_version').first() if group else None)
    else:
        submission = (Submission.objects.filter(
            student_id=request.user_id, assignment=assignment
        ).order_by('-submissionDateTime').first())

    # Individual mark for the dashboard row (finished-only gate) — mirrors the
    # mark students saw on the original student home. Group marks are shown via
    # the group-result page, so they're intentionally left out here.
    mark_released = False
    mark_score = mark_total = mark_percentage = None
    # Shown only once marking is finished AND the course organiser has released
    # results (the "Release marks" gate).
    if submission and not assignment.is_group_assignment() and assignment.results_released:
        rows = list(
            SubmissionCriteria.objects.filter(submission=submission)
            .select_related('criteria')
        )
        if rows and all(r.status == 2 for r in rows):
            mark_score = sum((r.score or 0) for r in rows)
            mark_total = sum((r.criteria.marks if r.criteria else 0) for r in rows)
            mark_released = True
            mark_percentage = (mark_score / mark_total * 100) if mark_total > 0 else 0.0

    return {
        "assignment_id": assignment_id,
        "group_id": group.id if group else None,
        "group_name": group.name if group else None,
        "submitted": bool(submission),
        "submitted_at": submission.submissionDateTime if submission else None,
        "is_late": bool(submission and submission.submissionDateTime > assignment.deadline),
        "mark_released": mark_released,
        "mark_score": mark_score,
        "mark_total": mark_total,
        "mark_percentage": mark_percentage,
    }

@router.post("/create/{course_id}", response=PeerAssignmentCreationResponse, operation_id="createAssignment")
@require_auth(roles=['Academic', 'Marker', 'TA'])
@check_permissions(CanCreateAssignment)
def create_assignment(request, data: AssignmentCreateRequest, course_id: int):
    """Unified assignment creation (Design PRD §6.1).

    Creates an INDIVIDUAL or GROUP assignment; peer review and self-assessment
    are independent toggles, not separate types.
    """
    try:
        if data.assignment_type not in ('INDIVIDUAL', 'GROUP'):
            return {"success": False, "message": "Type must be INDIVIDUAL or GROUP", "assignment_id": None}

        is_group = data.assignment_type == 'GROUP'
        group_set = None
        if is_group:
            if not data.group_set_id:
                return {"success": False, "message": "A group category is required for group assignments", "assignment_id": None}
            group_set = GroupSet.objects.filter(id=data.group_set_id, course_id=course_id, is_active=True).first()
            if not group_set:
                return {"success": False, "message": "Group category not found for this course", "assignment_id": None}

        if data.peer_review_enabled:
            if not data.reviews_per_student or data.reviews_per_student < 1:
                return {"success": False, "message": "Reviews per student is required when peer review is enabled", "assignment_id": None}
            if not data.review_deadline:
                return {"success": False, "message": "A review deadline is required when peer review is enabled", "assignment_id": None}
            if data.review_deadline <= data.deadline:
                return {"success": False, "message": "The review deadline must be after the submission deadline", "assignment_id": None}

        assignment = Assignment.objects.create(
            course_id=course_id,
            assignmentTitle=data.title,
            assignmentDescription=data.description,
            assignmentWebsite=data.assignmentWebsite or None,
            deadline=data.deadline,
            status=1,
            assignment_type=data.assignment_type,
            group_set=group_set,
            min_group_size=data.min_group_size if is_group else None,
            max_group_size=data.max_group_size if is_group else None,
            peer_review_enabled=data.peer_review_enabled,
            reviews_per_student=data.reviews_per_student if data.peer_review_enabled else None,
            review_deadline=data.review_deadline if data.peer_review_enabled else None,
            is_peer_review_matching_complete=False,
            release_date=timezone.now(),
        )

        if data.self_assessment_enabled:
            SelfAssessmentSetting.objects.update_or_create(
                assignment=assignment,
                defaults=dict(enabled=True,
                              deadline=data.self_assessment_deadline or data.deadline),
            )

        return {"success": True, "message": f"Assignment '{data.title}' created", "assignment_id": assignment.id}

    except Exception as e:
        return {"success": False, "message": f"Error creating assignment: {str(e)}", "assignment_id": None}


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

def _match_group_submissions(assignment):
    """Allocate peer reviewers to group submissions, cross-group only.

    Unified PRD §8.3. Extends Tomas's round-robin idea to groups: for each
    group submission, eligible reviewers are every student who is *not* in the
    submitting group, and we always pick the reviewers who currently carry the
    fewest reviews so the load stays even. No student ever reviews their own
    group's work.
    """
    if not assignment.group_set_id:
        return {
            "success": False,
            "message": "This group assignment has no group category assigned",
            "matches": None,
        }

    # Latest active submission per group.
    latest_by_group = {}
    for gs in (
        GroupSubmission.objects.filter(assignment=assignment, is_active=True)
        .select_related('group')
        .order_by('group_id', '-submission_version')
    ):
        latest_by_group.setdefault(gs.group_id, gs)
    submissions = list(latest_by_group.values())

    if len(submissions) < 2:
        return {
            "success": False,
            "message": "Not enough group submissions for peer matching",
            "matches": None,
        }

    # Members of every group in this group set, so we know who to exclude and
    # who is eligible to review. Students in no group are excluded entirely
    # (Unified PRD §8.5).
    members_by_group: Dict[int, List] = {}
    for m in (
        GroupMember.objects.filter(
            group__group_set_id=assignment.group_set_id,
            group__is_active=True,
            is_active=True,
        ).select_related('student', 'group')
    ):
        members_by_group.setdefault(m.group_id, []).append(m.student)

    r = assignment.reviews_per_student or 0
    if r < 1:
        return {
            "success": False,
            "message": "reviews_per_student must be at least 1",
            "matches": None,
        }

    review_load: Dict[int, int] = {}
    for students in members_by_group.values():
        for s in students:
            review_load.setdefault(s.id, 0)

    if not review_load:
        return {
            "success": False,
            "message": "No students are in groups for this assignment",
            "matches": None,
        }

    new_allocations = []
    student_by_id = {s.id: s for students in members_by_group.values() for s in students}

    for gs in submissions:
        own_member_ids = {s.id for s in members_by_group.get(gs.group_id, [])}
        eligible = [sid for sid in review_load if sid not in own_member_ids]

        if len(eligible) < r:
            return {
                "success": False,
                "message": (
                    f"Only {len(eligible)} student(s) outside {gs.group.name} are available, "
                    f"but {r} review(s) per submission are required"
                ),
                "matches": None,
            }

        # Fewest reviews first, random tiebreak.
        random.shuffle(eligible)
        eligible.sort(key=lambda sid: review_load[sid])

        for sid in eligible[:r]:
            new_allocations.append(
                PeerReviewAllocation(
                    reviewer=student_by_id[sid],
                    submission=None,
                    group_submission=gs,
                    assignment=assignment,
                    status='PENDING',
                )
            )
            review_load[sid] += 1

    PeerReviewAllocation.objects.filter(assignment=assignment).delete()
    PeerReviewAllocation.objects.bulk_create(new_allocations)

    # Safety net: assert nobody was allocated their own group's submission.
    for alloc in PeerReviewAllocation.objects.filter(
        assignment=assignment
    ).select_related('group_submission'):
        own = {s.id for s in members_by_group.get(alloc.group_submission.group_id, [])}
        if alloc.reviewer_id in own:
            PeerReviewAllocation.objects.filter(assignment=assignment).delete()
            return {
                "success": False,
                "message": "Could not assign all reviews fairly",
                "matches": None,
            }

    assignment.is_peer_review_matching_complete = True
    assignment.save()

    matches = [
        {
            "reviewer_name": getattr(alloc.reviewer, 'userName', ''),
            "reviewer_email": getattr(alloc.reviewer, 'userEmail', ''),
            "reviewer_userNumber": getattr(alloc.reviewer, 'userNumber', ''),
            "submission_owner_name": alloc.group_submission.group.name,
            "submission_owner_email": '',
            "submission_owner_userNumber": '',
            "status": alloc.status,
        }
        for alloc in PeerReviewAllocation.objects.filter(
            assignment=assignment
        ).select_related('group_submission__group', 'reviewer')
    ]

    return {
        "success": True,
        "message": "Peer matching completed successfully",
        "matches": matches,
    }


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

        # Peer review is now a configuration toggle rather than an assignment
        # type, so an INDIVIDUAL *or* a GROUP assignment can reach this point
        # (Unified PRD §6.2).
        if not assignment.peer_review_enabled:
            return {
                "success": False,
                "message": "This is not a peer review assignment",
                "matches": None
            }

        # Cross-feature extension (Unified PRD §8): when the assignment is a
        # GROUP assignment, reviewers are allocated to group submissions and
        # drawn exclusively from students in *other* groups.
        if assignment.is_group_assignment():
            return _match_group_submissions(assignment)

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
    is_group = assignment.is_group_assignment()

    # Submission totals — count group submissions for group assignments, else
    # individual submissions. (The "Submissions" tile was always 0 for groups.)
    if is_group:
        _gsubs = GroupSubmission.objects.filter(assignment_id=assignment_id, is_active=True)
        total_submissions = _gsubs.count()
        unique_submitters = _gsubs.values('group_id').distinct().count()
    else:
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

    # --- Dashboard breakdowns (prototype Academic Dashboard) ----------------
    enrolled = Course2Student.objects.filter(course=assignment.course).count()
    deadline = assignment.deadline

    # Latest submission per submitter (student, or group for group assignments),
    # and the grade band from its rubric marks.
    total_marks = sum(
        c.marks for c in Criteria.objects.filter(assignment=assignment, parent=None)
    )

    def band(pct):
        if pct >= 70: return '70+'
        if pct >= 60: return '60-69'
        if pct >= 50: return '50-59'
        if pct >= 40: return '40-49'
        return '0-39'

    grade_distribution = {'0-39': 0, '40-49': 0, '50-59': 0, '60-69': 0, '70+': 0}
    on_time = late = 0

    if is_group:
        latest = {}
        for gs in (GroupSubmission.objects.filter(assignment=assignment, is_active=True)
                   .order_by('group_id', '-submission_version')):
            latest.setdefault(gs.group_id, gs)
        expected = (Group.objects.filter(group_set=assignment.group_set, is_active=True).count()
                    if assignment.group_set_id else 0)
        for gs in latest.values():
            if gs.submissionDateTime <= deadline:
                on_time += 1
            else:
                late += 1
            if total_marks > 0:
                scored = sum(
                    r.score or 0 for r in GroupSubmissionCriteria.objects.filter(group_submission=gs)
                )
                if scored > 0:
                    grade_distribution[band(scored / total_marks * 100)] += 1
        submitted = len(latest)
    else:
        latest = {}
        for s in (Submission.objects.filter(assignment=assignment)
                  .order_by('student_id', '-submissionDateTime')):
            latest.setdefault(s.student_id, s)
        expected = enrolled
        for s in latest.values():
            if s.submissionDateTime <= deadline:
                on_time += 1
            else:
                late += 1
            if total_marks > 0:
                scored = sum(
                    r.score or 0 for r in SubmissionCriteria.objects.filter(submission=s)
                )
                if scored > 0:
                    grade_distribution[band(scored / total_marks * 100)] += 1
        submitted = len(latest)

    missing = max(0, expected - submitted)

    sa_setting = SelfAssessmentSetting.objects.filter(assignment=assignment, enabled=True).first()
    sa_submitted = (StudentSelfAssessmentSubmission.objects
                    .filter(assignment=assignment).values('student').distinct().count())

    return {
        "total_submissions": total_submissions,
        "unique_submitters": unique_submitters,
        "active_users_24h": active_users,
        "total_peer_reviews": total_peer_reviews,
        "peer_review_stats": status_counts,
        "average_reviews_per_student": round(avg_reviews, 2),
        "completion_rate": round(completion_rate, 2),
        "enrolled_students": enrolled,
        "expected_submissions": expected,
        "submission_on_time": on_time,
        "submission_late": late,
        "submission_missing": missing,
        "self_assessment_enabled": bool(sa_setting),
        "self_assessment_submitted": sa_submitted,
        "grade_distribution": grade_distribution,
    }


# --- Customization: edit an assignment's basic fields -----------------------
@router.patch("/{assignment_id}", response=AssignmentSchema, operation_id="updateAssignment")
@require_auth(roles=['Academic', 'Marker', 'TA'])
@check_permissions(IsCourseStaffFromAssignment)
def update_assignment(request, assignment_id: int, data: AssignmentUpdateRequest):
    """Update the editable fields of an assignment (prototype "Customization").

    Only title, description, website and deadline can change; the assignment
    type is fixed at creation. Fields left unset in the request are untouched.
    """
    assignment = Assignment.objects.select_related('selfassessmentsetting').get(id=assignment_id)
    if data.assignmentTitle is not None:
        assignment.assignmentTitle = data.assignmentTitle
    if data.assignmentDescription is not None:
        assignment.assignmentDescription = data.assignmentDescription
    if data.assignmentWebsite is not None:
        assignment.assignmentWebsite = data.assignmentWebsite or None
    if data.deadline is not None:
        assignment.deadline = data.deadline
    assignment.save()
    return assignment


@router.post("/{assignment_id}/release-results", response=AssignmentSchema, operation_id="setResultsReleased")
@require_auth(roles=['Academic'])
@check_permissions(IsCourseStaffFromAssignment)
def set_results_released(request, assignment_id: int, data: ResultsReleaseRequest):
    """Release finalised marks to students, or retract them.

    Course-organiser only. Making finished marking visible to students is a
    deliberate decision separate from a marker finishing their scoring — this is
    the real version of the 'Release marks' control the source dissertations
    only ever rendered as a disabled placeholder.
    """
    assignment = get_object_or_404(Assignment, id=assignment_id)
    assignment.results_released = data.released
    assignment.save(update_fields=['results_released'])
    return assignment


# --- Assignment Structure: marking criteria ---------------------------------
@router.get("/{assignment_id}/structure", response=AssignmentStructureSchema, operation_id="getAssignmentStructure")
@require_auth(roles=['Academic', 'Marker', 'TA'])
@check_permissions(IsCourseStaffFromAssignment)
def get_assignment_structure(request, assignment_id: int):
    """The assignment's top-level marking criteria plus whether self-assessment
    is enabled (prototype "Assignment Structure")."""
    roots = Criteria.objects.filter(assignment_id=assignment_id, parent__isnull=True).order_by('id')
    sa = SelfAssessmentSetting.objects.filter(assignment_id=assignment_id).first()
    return {
        "criteria": [{"id": c.id, "name": c.name, "marks": c.marks} for c in roots],
        "self_assessment_enabled": bool(sa and sa.enabled),
    }


@router.post("/{assignment_id}/criteria", response=StructureCriterionSchema, operation_id="createAssignmentCriterion")
@require_auth(roles=['Academic', 'Marker', 'TA'])
@check_permissions(IsCourseStaffFromAssignment)
def create_assignment_criterion(request, assignment_id: int, data: CriterionUpsertRequest):
    """Add a top-level marking criterion to an assignment."""
    criterion = Criteria.objects.create(
        assignment_id=assignment_id,
        name=data.name or 'New criterion',
        marks=data.marks if data.marks is not None else 0,
    )
    return {"id": criterion.id, "name": criterion.name, "marks": criterion.marks}


@router.patch("/{assignment_id}/criteria/{criteria_id}", response=StructureCriterionSchema, operation_id="updateAssignmentCriterion")
@require_auth(roles=['Academic', 'Marker', 'TA'])
@check_permissions(IsCourseStaffFromAssignment)
def update_assignment_criterion(request, assignment_id: int, criteria_id: int, data: CriterionUpsertRequest):
    """Rename or re-weight a marking criterion."""
    criterion = Criteria.objects.get(id=criteria_id, assignment_id=assignment_id)
    if data.name is not None:
        criterion.name = data.name
    if data.marks is not None:
        criterion.marks = data.marks
    criterion.save()
    return {"id": criterion.id, "name": criterion.name, "marks": criterion.marks}


# --- Jobs: per-marker marking allocation summary ----------------------------
@router.get("/{assignment_id}/marker-jobs", response=List[MarkerJobSchema], operation_id="getMarkerJobs")
@require_auth(roles=['Academic', 'TA'])
@check_permissions(IsCourseStaffFromAssignment)
def get_marker_jobs(request, assignment_id: int):
    """Per-marker marking progress for an assignment (prototype "Marking Jobs").

    `allocated` is the shared pool size (all submissions for the assignment);
    `completed` is how many distinct submissions each marker has marked. This
    reflects the codebase's open-pool marking model rather than a per-marker
    hard allocation.
    """
    assignment = Assignment.objects.get(id=assignment_id)
    is_group = assignment.assignment_type == 'GROUP'

    if is_group:
        allocated = GroupSubmission.objects.filter(
            assignment_id=assignment_id, is_active=True
        ).values('group_id').distinct().count()
    else:
        allocated = Submission.objects.filter(
            assignment_id=assignment_id
        ).values('student_id').distinct().count()

    # Only people who actually mark — markers and TAs, not course organisers.
    markers = (
        Course2Marker.objects
        .filter(course=assignment.course, marker__role__in=['M', 'T'])
        .select_related('marker')
    )

    rows = []
    for c2m in markers:
        marker = c2m.marker
        if is_group:
            completed = (
                GroupSubmissionCriteria.objects
                .filter(group_submission__assignment_id=assignment_id, marker=marker)
                .values('group_submission_id').distinct().count()
            )
        else:
            completed = (
                SubmissionCriteria.objects
                .filter(submission__assignment_id=assignment_id, marker=marker)
                .values('submission_id').distinct().count()
            )
        if allocated and completed >= allocated:
            status = 'Complete'
        elif completed > 0:
            status = 'In Progress'
        else:
            status = 'Not Started'
        rows.append({
            "marker_id": marker.id,
            "marker_name": marker.userName,
            "allocated": allocated,
            "completed": completed,
            "status": status,
        })
    return rows