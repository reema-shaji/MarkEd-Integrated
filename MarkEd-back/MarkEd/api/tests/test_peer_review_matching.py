from django.test import TestCase
from django.utils import timezone
from unittest.mock import patch, MagicMock
from ...models import Assignment, Submission, PeerReviewAllocation, User, Course, Course2Marker
from ..routes.assignments import trigger_peer_review_matching
from datetime import datetime
from django.db import models
from ninja.errors import HttpError

class TestPeerReviewMatching(TestCase):
    def setUp(self):
        # Create a course
        self.course = Course.objects.create(
            courseName="Test Course",
            courseCode="TEST101"
        )
        
        # Create a staff user (marker)
        self.staff_user = User.objects.create(
            userNumber="staff1",
            userName="Staff User",
            userEmail="staff@test.com",
            role='M',  # M for Marker in the User model
            password='testpass123'
        )
        
        # Create Course2Marker entry with all necessary permissions
        self.course_marker = Course2Marker.objects.create(
            course=self.course,
            marker=self.staff_user,
            canCreateAssignment=True,
            submissionPermission=2,  # Write permission
            markingPermission=2,     # Write permission
            structurePermission=2,   # Write permission
            teamPermission=2         # Write permission
        )
        
        # Create an assignment
        self.assignment = Assignment.objects.create(
            course=self.course,
            assignmentTitle="Test Assignment",
            deadline=timezone.now() + timezone.timedelta(days=-7),
            status=1,
            # Unified model: peer review is a toggle on an INDIVIDUAL/GROUP
            # assignment rather than its own type (Unified PRD §6.2).
            assignment_type='INDIVIDUAL',
            peer_review_enabled=True,
            reviews_per_student=2,
            is_peer_review_matching_complete=False,
            review_deadline=timezone.now() + timezone.timedelta(days=-7),
            release_date=timezone.now() + timezone.timedelta(days=-10),
        )
        
        # Create test students
        self.students = []
        for i in range(4):
            student = User.objects.create(
                userNumber=f"u{i}",
                userName=f"Student{i}",
                userEmail=f"student{i}@test.com",
                role='S',
                password='testpass123',
                last_seen=timezone.now()
            )
            self.students.append(student)
            
        # Create submissions for each student
        self.submissions = []
        for student in self.students:
            submission = Submission.objects.create(
                assignment=self.assignment,
                student=student,
                submissionDateTime=timezone.now()
            )
            self.submissions.append(submission)

    def _create_staff_request(self):
        """Helper method to create a properly authenticated staff request"""
        request = MagicMock()
        request.user_role = 'Marker'
        request.user_roles = ['Marker']
        request.user_id = self.staff_user.id
        request.is_authenticated = True
        return request

    def test_successful_peer_matching(self):
        """Test peer matching multiple times to ensure consistent behavior"""
        NUM_TEST_ITERATIONS = 10
        
        for _ in range(NUM_TEST_ITERATIONS):
            # Reset the allocations for each iteration
            PeerReviewAllocation.objects.all().delete()
            self.assignment.is_peer_review_matching_complete = False
            self.assignment.save()
            
            request = self._create_staff_request()
            response = trigger_peer_review_matching(request, assignment_id=self.assignment.id)
            
            # Test invariants that should be true regardless of random assignments
            self.assertEqual(response['message'], "Peer matching completed successfully")
            self.assertTrue(response['success'])
            
            # For each student:
            for student in self.students:
                # 1. Should have exactly reviews_per_student assignments
                review_count = PeerReviewAllocation.objects.filter(
                    reviewer=student,
                    assignment=self.assignment
                ).count()
                self.assertEqual(review_count, self.assignment.reviews_per_student)
                
                # 2. Should not review the same submission twice
                reviewed_submissions = PeerReviewAllocation.objects.filter(
                    reviewer=student,
                    assignment=self.assignment
                ).values_list('submission_id', flat=True)
                self.assertEqual(len(reviewed_submissions), len(set(reviewed_submissions)))
                
                # 3. Should not review their own submission
                self.assertFalse(
                    PeerReviewAllocation.objects.filter(
                        reviewer=student,
                        submission__student=student
                    ).exists()
                )
            
            # 4. Each submission should receive AT LEAST reviews_per_student reviews
            for submission in self.submissions:
                review_count = PeerReviewAllocation.objects.filter(
                    submission=submission
                ).count()
                self.assertGreaterEqual(review_count, self.assignment.reviews_per_student)

    def test_already_completed_matching(self):
        self.assignment.is_peer_review_matching_complete = True
        self.assignment.save()
        
        request = self._create_staff_request()
        response = trigger_peer_review_matching(request, assignment_id=self.assignment.id)
        
        self.assertFalse(response['success'])
        self.assertEqual(response['message'], "Peer matching already completed")

    def test_not_enough_submissions(self):
        # Delete all but one submission
        Submission.objects.all().delete()
        Submission.objects.create(
            assignment=self.assignment,
            student=self.students[0],
            submissionDateTime=timezone.now()
        )
        
        request = self._create_staff_request()
        response = trigger_peer_review_matching(request, assignment_id=self.assignment.id)
        
        self.assertFalse(response['success'])
        self.assertEqual(response['message'], "Not enough submissions for peer matching")

    def test_no_self_review(self):
        """Test that students cannot be assigned to review their own submissions"""
        request = self._create_staff_request()
        
        response = trigger_peer_review_matching(request, assignment_id=self.assignment.id)
        
        self.assertTrue(response['success'])
        
        # Check that no student is reviewing their own submission
        self.assertFalse(
            PeerReviewAllocation.objects.filter(
                reviewer__id=models.F('submission__student__id')
            ).exists()
        )

    def test_insufficient_reviewers(self):
        """Test case where there aren't enough reviewers to meet reviews_per_student requirement"""
        # Set reviews_per_student higher than possible with current number of students
        self.assignment.reviews_per_student = len(self.students)  # This would require each student to review all other submissions
        self.assignment.save()
        
        request = self._create_staff_request()
        
        response = trigger_peer_review_matching(request, assignment_id=self.assignment.id)
        
        self.assertFalse(response['success'])
        self.assertEqual(response['message'], "Could not assign all reviews fairly")

    def test_trigger_peer_review_matching_for_non_peer_review_assignment(self):
        """
        Ensure that we cannot trigger peer review matching when peer review is
        not enabled on the assignment.
        """
        # Unified model: turn the peer review toggle off rather than changing type.
        self.assignment.peer_review_enabled = False
        self.assignment.save()

        request = self._create_staff_request()
        response = trigger_peer_review_matching(request, assignment_id=self.assignment.id)

        self.assertFalse(response['success'])
        self.assertEqual(response['message'], "This is not a peer review assignment")

    def test_trigger_peer_review_matching_when_assignment_does_not_exist(self):
        """
        Expect an HttpError(403 or 401) if the decorator checks fail,
        or HttpError(404) if the route tries to fetch a nonexistent assignment
        before the permission check.
        
        However, if the code tries to do "Assignment.objects.get(id=999999)",
        it might raise a 404 or a custom error. Adjust to reflect your actual code behavior.
        """
        request = self._create_staff_request()

        # This is a large ID that doesn't exist.
        invalid_assignment_id = 999999

        from ..routes.assignments import trigger_peer_review_matching

        # Possibly we get a 403 from the permission decorator or a custom 404 from your logic.
        # We'll assume the code checks for assignment existence and raises a custom 404 http error.
        with self.assertRaises(HttpError) as context:
            trigger_peer_review_matching(
                request, 
                assignment_id=invalid_assignment_id
            )
        # Now check the status code or message.
        self.assertIn(context.exception.status_code, [403, 404])
        # Adjust these checks as needed for your code / logic.
        # e.g., self.assertEqual(context.exception.status_code, 404)

    def test_matching_after_review_deadline(self):
        """
        Confirm that even if the current time is past the review deadline,
        we can still trigger matching if the assignment hasn't been matched yet.
        (Depending on your business logic, you might want to disallow or allow it.
         Adjust this test accordingly.)
        """
        # Move review_deadline to the past
        self.assignment.review_deadline = timezone.now() - timezone.timedelta(days=30)
        self.assignment.save()

        request = self._create_staff_request()
        response = trigger_peer_review_matching(request, assignment_id=self.assignment.id)

        # If your business logic allows matching to proceed even after the review deadline:
        self.assertTrue(response['success'])
        self.assertEqual(response['message'], "Peer matching completed successfully")

        # Or if you decide it should fail after the review deadline, then you might use:
        # self.assertFalse(response['success'])
        # self.assertEqual(response['message'], "Cannot match after the review deadline")

    def test_minimum_one_reviewer_per_submission(self):
        """
        Test a scenario in which each student must review at least one submission.
        This ensures no scenario is overlooked where a student might end up with zero assigned reviews.
        """
        # We already have 4 students. Each will need at least 1 review (reviews_per_student=1).
        self.assignment.reviews_per_student = 1
        self.assignment.save()

        # Clear allocations
        PeerReviewAllocation.objects.all().delete()

        self.assignment.is_peer_review_matching_complete = False
        self.assignment.save()

        request = self._create_staff_request()
        response = trigger_peer_review_matching(request, assignment_id=self.assignment.id)

        self.assertTrue(response['success'])
        self.assertEqual(response['message'], "Peer matching completed successfully")

        # Confirm each student got exactly 1 review to do
        for student in self.students:
            count = PeerReviewAllocation.objects.filter(reviewer=student, assignment=self.assignment).count()
            self.assertEqual(count, 1, f"Student {student.pk} did not get exactly 1 review assigned.")

    def test_concurrent_peer_review_trigger(self):
        """
        Test a hypothetical concurrency scenario by simulating two rapid calls
        to trigger the peer review matching. The second call should ideally detect
        that 'is_peer_review_matching_complete' is now True and abort or
        handle gracefully.
        """
        request = self._create_staff_request()

        # First call
        response1 = trigger_peer_review_matching(request, assignment_id=self.assignment.id)
        self.assertTrue(response1['success'])
        self.assertEqual(response1['message'], "Peer matching completed successfully")

        # Immediately call it again
        response2 = trigger_peer_review_matching(request, assignment_id=self.assignment.id)
        self.assertFalse(response2['success'])
        self.assertEqual(response2['message'], "Peer matching already completed") 