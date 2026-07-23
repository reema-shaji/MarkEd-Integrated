"""Tests for cross-group peer review allocation (Unified PRD §8, risk R6).

The critical invariant is that no student is ever allocated to review their
own group's submission. These tests cover the edge cases §8.5 calls out:
two groups, three groups, uneven group sizes, a single-member group, and
students who belong to no group at all.
"""
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from ...models import (
    Assignment,
    Course,
    Course2Marker,
    Course2Student,
    Group,
    GroupMember,
    GroupSet,
    GroupSubmission,
    PeerReviewAllocation,
    User,
)
from ..routes.assignments import _match_group_submissions


class GroupPeerReviewMatchingTests(TestCase):
    def setUp(self):
        self.course = Course.objects.create(courseName="Test Course", courseCode="TEST101")
        self.staff = User.objects.create(
            userNumber="staff1", userName="Staff", userEmail="s@t.com", role='M', password='x'
        )
        Course2Marker.objects.create(
            course=self.course, marker=self.staff, teamPermission=2, markingPermission=2
        )
        self.group_set = GroupSet.objects.create(
            course=self.course, name="Project Groups", min_group_size=1, max_group_size=6
        )
        self.assignment = Assignment.objects.create(
            course=self.course,
            assignmentTitle="Group Report",
            deadline=timezone.now() - timedelta(days=1),
            assignment_type='GROUP',
            group_set=self.group_set,
            peer_review_enabled=True,
            reviews_per_student=2,
            review_deadline=timezone.now() + timedelta(days=7),
        )
        self._student_seq = 0

    # --- helpers ---------------------------------------------------------

    def _make_group(self, name, member_count):
        group = Group.objects.create(
            course=self.course, group_set=self.group_set, name=name
        )
        students = []
        for _ in range(member_count):
            self._student_seq += 1
            s = User.objects.create(
                userNumber=f"s{self._student_seq:04d}",
                userName=f"Student {self._student_seq}",
                userEmail=f"s{self._student_seq}@t.com",
                role='S',
                password='x',
            )
            Course2Student.objects.create(course=self.course, student=s)
            GroupMember.objects.create(group=group, student=s)
            students.append(s)
        return group, students

    def _submit(self, group, students):
        return GroupSubmission.objects.create(
            group=group,
            assignment=self.assignment,
            submitted_by=students[0],
            submissionFile="https://example.com/report.pdf",
            submission_version=1,
        )

    def _assert_no_self_review(self):
        """The core invariant: nobody reviews their own group."""
        for alloc in PeerReviewAllocation.objects.filter(
            assignment=self.assignment
        ).select_related('group_submission'):
            own_group_ids = set(
                GroupMember.objects.filter(
                    student_id=alloc.reviewer_id,
                    group__group_set=self.group_set,
                    is_active=True,
                ).values_list('group_id', flat=True)
            )
            self.assertNotIn(
                alloc.group_submission.group_id,
                own_group_ids,
                f"{alloc.reviewer.userName} was allocated their own group's submission",
            )
            self.assertIsNone(alloc.submission_id, "Group allocation must not set submission")

    # --- tests -----------------------------------------------------------

    def test_two_groups_every_review_is_cross_group(self):
        g1, s1 = self._make_group("Team 1", 3)
        g2, s2 = self._make_group("Team 2", 3)
        self._submit(g1, s1)
        self._submit(g2, s2)

        result = _match_group_submissions(self.assignment)

        self.assertTrue(result['success'], result['message'])
        self._assert_no_self_review()
        # 2 submissions x 2 reviews each
        self.assertEqual(PeerReviewAllocation.objects.filter(assignment=self.assignment).count(), 4)

    def test_three_groups_uneven_sizes(self):
        g1, s1 = self._make_group("Team 1", 4)
        g2, s2 = self._make_group("Team 2", 2)
        g3, s3 = self._make_group("Team 3", 3)
        for g, s in ((g1, s1), (g2, s2), (g3, s3)):
            self._submit(g, s)

        result = _match_group_submissions(self.assignment)

        self.assertTrue(result['success'], result['message'])
        self._assert_no_self_review()
        self.assertEqual(PeerReviewAllocation.objects.filter(assignment=self.assignment).count(), 6)

    def test_review_load_is_spread_evenly(self):
        for i in range(4):
            g, s = self._make_group(f"Team {i + 1}", 3)
            self._submit(g, s)

        result = _match_group_submissions(self.assignment)
        self.assertTrue(result['success'], result['message'])
        self._assert_no_self_review()

        loads = {}
        for alloc in PeerReviewAllocation.objects.filter(assignment=self.assignment):
            loads[alloc.reviewer_id] = loads.get(alloc.reviewer_id, 0) + 1
        # 8 allocations over 12 students: nobody should carry more than one
        # more review than anybody else who is reviewing.
        self.assertLessEqual(max(loads.values()) - min(loads.values()), 1)

    def test_single_member_group_is_treated_like_any_other(self):
        g1, s1 = self._make_group("Solo", 1)
        g2, s2 = self._make_group("Team 2", 3)
        g3, s3 = self._make_group("Team 3", 3)
        for g, s in ((g1, s1), (g2, s2), (g3, s3)):
            self._submit(g, s)

        # 3 reviews per submission over 7 students means 9 allocations, so with
        # fewest-first balancing every student must receive at least one. That
        # makes the solo student's eligibility deterministic to assert.
        self.assignment.reviews_per_student = 3
        self.assignment.save()

        result = _match_group_submissions(self.assignment)

        self.assertTrue(result['success'], result['message'])
        self._assert_no_self_review()

        # The one-member group's submission is reviewed like any other.
        self.assertEqual(
            PeerReviewAllocation.objects.filter(
                assignment=self.assignment, group_submission__group=g1
            ).count(),
            3,
        )
        # And the solo student is eligible to review other groups.
        self.assertTrue(
            PeerReviewAllocation.objects.filter(
                assignment=self.assignment, reviewer=s1[0]
            ).exists()
        )

    def test_student_in_no_group_is_excluded(self):
        g1, s1 = self._make_group("Team 1", 3)
        g2, s2 = self._make_group("Team 2", 3)
        self._submit(g1, s1)
        self._submit(g2, s2)

        loner = User.objects.create(
            userNumber="loner1", userName="Loner", userEmail="l@t.com", role='S', password='x'
        )
        Course2Student.objects.create(course=self.course, student=loner)

        result = _match_group_submissions(self.assignment)

        self.assertTrue(result['success'], result['message'])
        self.assertFalse(
            PeerReviewAllocation.objects.filter(
                assignment=self.assignment, reviewer=loner
            ).exists(),
            "A student in no group must not be allocated reviews",
        )

    def test_only_latest_submission_version_is_reviewed(self):
        g1, s1 = self._make_group("Team 1", 3)
        g2, s2 = self._make_group("Team 2", 3)
        self._submit(g1, s1)
        GroupSubmission.objects.create(
            group=g1,
            assignment=self.assignment,
            submitted_by=s1[0],
            submissionFile="https://example.com/report-v2.pdf",
            submission_version=2,
        )
        self._submit(g2, s2)

        result = _match_group_submissions(self.assignment)

        self.assertTrue(result['success'], result['message'])
        reviewed_versions = set(
            PeerReviewAllocation.objects.filter(
                assignment=self.assignment, group_submission__group=g1
            ).values_list('group_submission__submission_version', flat=True)
        )
        self.assertEqual(reviewed_versions, {2})

    def test_fails_cleanly_when_not_enough_reviewers_outside_a_group(self):
        # Two groups; reviews_per_student=2 but only 1 student sits outside
        # each group, so a fair allocation is impossible.
        g1, s1 = self._make_group("Team 1", 3)
        g2, s2 = self._make_group("Team 2", 1)
        self._submit(g1, s1)
        self._submit(g2, s2)
        self.assignment.reviews_per_student = 4
        self.assignment.save()

        result = _match_group_submissions(self.assignment)

        self.assertFalse(result['success'])
        self.assertEqual(PeerReviewAllocation.objects.filter(assignment=self.assignment).count(), 0)

    def test_requires_at_least_two_group_submissions(self):
        g1, s1 = self._make_group("Team 1", 3)
        self._make_group("Team 2", 3)
        self._submit(g1, s1)

        result = _match_group_submissions(self.assignment)

        self.assertFalse(result['success'])
        self.assertIn("Not enough group submissions", result['message'])
