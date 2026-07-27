import os
from datetime import datetime
import typing
from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.core.validators import MinLengthValidator
from django.forms import EmailField, URLField
from typing import Literal, Optional
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver


class User(models.Model):
    userNumber: models.CharField = models.CharField(max_length=10, unique=True)
    userName: models.CharField = models.CharField(max_length=100)
    userEmail: models.EmailField = models.EmailField()
    isValid: models.BooleanField = models.BooleanField(default=False)
    userProfile: models.ImageField = models.ImageField(upload_to='profile', blank=True)
    role_choices = Literal['A', 'M', 'T', 'S']
    role: models.CharField = models.CharField(
        max_length=1,
        choices=[
            ('A', 'Academic'),
            ('M', 'Marker'), 
            ('T', 'TA'),
            ('S', 'Student'),
        ]
    )
    password: models.CharField = models.CharField(max_length=100)
    must_change_password: models.BooleanField = models.BooleanField(default=False)
    # timezone.now, not datetime.now: the project runs with USE_TZ enabled, so
    # the inherited naive default raised a RuntimeWarning on every user create.
    last_seen: models.DateTimeField = models.DateTimeField(default=timezone.now)


class Course(models.Model):
    courseName: models.CharField = models.CharField(max_length=100)
    courseCode: models.CharField = models.CharField(max_length=20, unique=True)


class Course2Marker(models.Model):
    course: models.ForeignKey = models.ForeignKey('Course', on_delete=models.CASCADE)
    marker: models.ForeignKey = models.ForeignKey('User', on_delete=models.CASCADE)
    permission_choice: typing.Tuple[typing.Tuple[int, str], ...] = (
        (0, 'No Permission'),
        (1, 'Read'),
        (2, 'Write'),
    )
    canCreateAssignment: models.BooleanField = models.BooleanField(default=False, help_text="Whether the marker can create assignments for the course or not")
    submissionPermission: models.IntegerField = models.IntegerField(choices=permission_choice, default=0)
    markingPermission: models.IntegerField = models.IntegerField(choices=permission_choice, default=0)
    structurePermission: models.IntegerField = models.IntegerField(choices=permission_choice, default=0)
    teamPermission: models.IntegerField = models.IntegerField(choices=permission_choice, default=0)


class Course2Student(models.Model):
    course: models.ForeignKey = models.ForeignKey('Course', on_delete=models.CASCADE)
    student: models.ForeignKey = models.ForeignKey('User', on_delete=models.CASCADE)


class Job(models.Model):
    assignment: models.ForeignKey = models.ForeignKey('Assignment', on_delete=models.CASCADE)
    sender: models.ForeignKey = models.ForeignKey('User', on_delete=models.CASCADE)
    receiveinfo: typing.Tuple[typing.Tuple[int, str], ...] = (
        (1, 'Academic'),
        (2, 'Markers'),
        (3, 'All'),
    )
    receiver: models.IntegerField = models.IntegerField(choices=receiveinfo, default=1)
    type: typing.Tuple[typing.Tuple[int, str], ...] = (
        (1, 'Fininsh all tasks'),
        (2, 'Submission is moderate'),
        (3, 'Submission is help'),
        (4, 'Submission is added'),
        (5, 'Deadline left 1 days'),
        (6, 'Deadline left 2 days'),
        (7, 'Deadline left 3 days'),
    )
    task: models.IntegerField = models.IntegerField(choices=type, default=1)
    title: models.TextField = models.TextField(blank=True, null=True)
    context: models.TextField = models.TextField(blank=True, null=True)
    choice: typing.Tuple[typing.Tuple[int, str], ...] = (
        (0, 'no send'),
        (1, 'have send'),
    )
    status: models.IntegerField = models.IntegerField(choices=choice, default=0)


class Notification(models.Model):
    assignment: models.ForeignKey = models.ForeignKey('Assignment', on_delete=models.CASCADE)
    receiver: models.ForeignKey = models.ForeignKey('User', on_delete=models.CASCADE)
    type: typing.Tuple[typing.Tuple[int, str], ...] = (
        (1, 'Submission is moderate'),
        (2, 'Submission is help'), 
        (3, 'Submission is added'),
        (4, 'Deadline left 1 days'),
        (5, 'Deadline left 2 days'),
        (6, 'Marks released'),
    )
    subject: models.IntegerField = models.IntegerField(choices=type, default=1)
    date: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    choice: typing.Tuple[typing.Tuple[int, str], ...] = (
        (0, 'no checked'),
        (1, 'checked'),
    )
    status: models.IntegerField = models.IntegerField(choices=choice, default=0)


class Assignment(models.Model):
    course: models.ForeignKey = models.ForeignKey('Course', on_delete=models.CASCADE)
    assignmentTitle: models.CharField = models.CharField(max_length=50)
    assignmentDescription: models.TextField = models.TextField(blank=True, null=True)
    assignmentWebsite: models.URLField = models.URLField(blank=True, null=True)
    deadline: models.DateTimeField = models.DateTimeField()
    permission_choice: typing.Tuple[typing.Tuple[int, str], ...] = (
        (0, 'disabled'),
        (1, 'enabled'),
    )
    status: models.IntegerField = models.IntegerField(choices=permission_choice, default=1)

    # --- Assignment type (unified: Hao's INDIVIDUAL/GROUP wins) ---------------
    # Tomas modelled peer review as an assignment *type* (STANDARD/PEER_REVIEW).
    # The unified model treats peer review as a configuration toggle instead
    # (see peer_review_enabled below), mirroring how self-assessment works, so
    # that an INDIVIDUAL *or* GROUP assignment can independently enable it.
    # Unified PRD §6.2. Tomas's PEER_REVIEW type maps to
    # INDIVIDUAL + peer_review_enabled=True.
    ASSIGNMENT_TYPE_CHOICES: typing.Tuple[typing.Tuple[str, str], ...] = (
        ('INDIVIDUAL', 'Individual Assignment'),
        ('GROUP', 'Group Assignment'),
    )
    assignment_type: models.CharField = models.CharField(
        max_length=20,
        choices=ASSIGNMENT_TYPE_CHOICES,
        default='INDIVIDUAL'
    )

    # --- Group assignment settings (ported from Hao) --------------------------
    # Hao stored this as a plain IntegerField with no FK constraint; the unified
    # model promotes it to a real ForeignKey (Unified PRD §6.1).
    group_set: models.ForeignKey = models.ForeignKey(
        'GroupSet',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assignments',
        help_text="Group category this assignment draws its groups from (GROUP assignments only)"
    )
    max_group_size: models.IntegerField = models.IntegerField(
        null=True, blank=True, help_text="Maximum number of students per group"
    )
    min_group_size: models.IntegerField = models.IntegerField(
        null=True, blank=True, help_text="Minimum number of students per group"
    )

    # --- Peer review settings (from Tomas) ------------------------------------
    peer_review_enabled: models.BooleanField = models.BooleanField(
        default=False,
        help_text="Enable peer review for this assignment (INDIVIDUAL or GROUP)"
    )
    reviews_per_student: models.IntegerField = models.IntegerField(
        null=True, 
        blank=True, 
        help_text="Number of peer reviews each student must complete"
    )
    review_deadline: models.DateTimeField = models.DateTimeField(
        null=True, 
        blank=True,
        help_text="Deadline for completing peer reviews"
    )
    assignment_instructions: models.JSONField = models.JSONField(
        blank=True, 
        null=True, 
        help_text="JSON field for URLs of .pdf assignment instructions"
    )
    is_peer_review_matching_complete: models.BooleanField = models.BooleanField(
        default=False, 
        help_text="Whether the process of matching students to peer reviews is complete"
    )
    release_date: models.DateTimeField = models.DateTimeField(
        null=True, 
        blank=True,
        help_text="Date when the assignment is released to students and students can submit their assignments"
    )

    # --- Helpers ported from Hao ---------------------------------------------
    def is_group_assignment(self) -> bool:
        return self.assignment_type == 'GROUP'

    def is_individual_assignment(self) -> bool:
        return self.assignment_type == 'INDIVIDUAL'

    def get_groups(self):
        """Active groups available to this assignment, via its group set."""
        if self.group_set_id:
            return Group.objects.filter(group_set_id=self.group_set_id, is_active=True)
        return Group.objects.none()




class AssignmentElement(models.Model):
    assignment: models.ForeignKey = models.ForeignKey('Assignment', on_delete=models.CASCADE)
    elementName: models.CharField = models.CharField(max_length=50)
    markingGuide: models.TextField = models.TextField()
    maxInput: models.FloatField = models.FloatField()
    MARKING_SCHEME_CHOICES: typing.Tuple[typing.Tuple[str, str], ...] = (
        ('SUM', 'Sum of Subparts'),
        ('CHOICE', 'Choice between Subparts'),
    )
    marking_scheme: models.CharField = models.CharField(max_length=6, choices=MARKING_SCHEME_CHOICES, default='SUM')


class Criteria(models.Model):
    assignment: models.ForeignKey = models.ForeignKey('Assignment', on_delete=models.CASCADE, related_name='criteria')
    parent: models.ForeignKey = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')
    name: models.CharField = models.CharField(max_length=50)
    marks: models.FloatField = models.FloatField()
    MARKING_SCHEME_CHOICES: typing.Tuple[typing.Tuple[str, str], ...] = (
        ('ADD', 'Additive'),
        ('SEL', 'Selective'),
    )
    marking_scheme: models.CharField = models.CharField(max_length=3, choices=MARKING_SCHEME_CHOICES, default='ADD', blank=True, null=True)

    def is_root(self) -> bool:
        return self.parent is None

    def __str__(self) -> str:
        return f"{self.name} ({self.marks} marks)"

class Element(models.Model):
    criteria: models.ForeignKey = models.ForeignKey(Criteria, related_name='elements', on_delete=models.CASCADE, null=True)
    name: models.CharField = models.CharField(max_length=50)
    description: models.TextField = models.TextField()
    marks: models.FloatField = models.FloatField()

    def __str__(self) -> str:
        return self.description


class Submission(models.Model):
    id: models.AutoField = models.AutoField(primary_key=True)
    student: models.ForeignKey = models.ForeignKey('User', on_delete=models.CASCADE)
    assignment: models.ForeignKey = models.ForeignKey('Assignment', on_delete=models.CASCADE)
    submissionDateTime: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    submissionFile: models.URLField = models.URLField(blank=True, null=True, help_text="URL of the submission file")


class SubmissionElement(models.Model):
    submission: models.ForeignKey = models.ForeignKey('Submission', on_delete=models.CASCADE)
    element: models.ForeignKey = models.ForeignKey('AssignmentElement', on_delete=models.CASCADE)
    marker: models.ForeignKey = models.ForeignKey('User', on_delete=models.CASCADE, blank=True, null=True)
    score: models.FloatField = models.FloatField(blank=True, null=True)
    feedback: models.TextField = models.TextField(blank=True, null=True, default='{"start": "", "middle":"", "end": ""}')
    needModerate: models.BooleanField = models.BooleanField(default=False)
    needHelp: models.BooleanField = models.BooleanField(default=False)
    STATUS_CHOICES: typing.Tuple[typing.Tuple[int, str], ...] = (
        (0, 'Submitted'),
        (1, 'Marking'),
        (2, 'Finished'),
    )
    status: models.IntegerField = models.IntegerField(choices=STATUS_CHOICES, default=0)
    dateUpdated: models.DateTimeField = models.DateTimeField(auto_now_add=True)


class SubmissionCriteria(models.Model):
    submission: models.ForeignKey = models.ForeignKey('Submission', on_delete=models.CASCADE)
    criteria: models.ForeignKey = models.ForeignKey(Criteria, on_delete=models.CASCADE, related_name='submission_elements', null=True)
    marker: models.ForeignKey = models.ForeignKey('User', on_delete=models.CASCADE, blank=True, null=True)
    score: models.FloatField = models.FloatField(blank=True, null=True)
    feedback: models.TextField = models.TextField(blank=True, null=True, default='{"start": "", "middle":"", "end": ""}')
    needModerate: models.BooleanField = models.BooleanField(default=False)
    needHelp: models.BooleanField = models.BooleanField(default=False)
    selected_elements: models.ManyToManyField = models.ManyToManyField(Element, blank=True)
    STATUS_CHOICES: typing.Tuple[typing.Tuple[int, str], ...] = (
        (0, 'Submitted'),
        (1, 'Marking'),
        (2, 'Finished'),
    )
    status: models.IntegerField = models.IntegerField(choices=STATUS_CHOICES, default=0)

    def clean(self) -> None:
        if not self.criteria:
            raise ValidationError("SubmissionCriteria must be linked to a Criteria.")

    def __str__(self) -> str:
        element_list = ", ".join([str(element) for element in self.selected_elements.all()])
        return f"SubmissionCriteria for {self.criteria} - Elements: {element_list} - {self.submission}"

    class Meta:
        unique_together = ['submission', 'criteria']

class Markscheme(models.Model):
    assignment: models.ForeignKey = models.ForeignKey('Assignment', on_delete=models.CASCADE, default=None)
    file: models.FileField = models.FileField(upload_to='markschemes/')


class Questionpaper(models.Model):
    assignment: models.ForeignKey = models.ForeignKey('Assignment', on_delete=models.CASCADE, default=None)
    file: models.FileField = models.FileField(upload_to='questionpapers/')


class Tag(models.Model):
    name: models.CharField = models.CharField(max_length=100, unique=True, default='')


class Feedback(models.Model):
    author: models.ForeignKey = models.ForeignKey(User, on_delete=models.CASCADE, null=True)
    element: models.ForeignKey = models.ForeignKey(SubmissionElement, on_delete=models.CASCADE, null=True, default=None, related_name='feedback_entries')
    date: models.DateTimeField = models.DateTimeField(auto_now_add=True, null=True)
    start: models.TextField = models.TextField(blank=True, null=True)
    middle: models.TextField = models.TextField(blank=True, null=True)
    end: models.TextField = models.TextField(blank=True, null=True)
    marks_given: models.FloatField = models.FloatField(default=0)
    total_marks: models.FloatField = models.FloatField(default=0)
    tag: models.ForeignKey = models.ForeignKey(Tag, on_delete=models.CASCADE, default=None)


class Reaction(models.Model):
    feedback: models.ForeignKey = models.ForeignKey(Feedback, on_delete=models.CASCADE)
    user: models.ForeignKey = models.ForeignKey(User, on_delete=models.CASCADE)
    reaction_type: models.CharField = models.CharField(max_length=10, choices=(('like', 'Like'), ('dislike', 'Dislike')))
    

class SavedFeedback(models.Model):
    user: models.ForeignKey = models.ForeignKey(User, on_delete=models.CASCADE)
    feedback: models.ForeignKey = models.ForeignKey(Feedback, on_delete=models.CASCADE)

# timer
class TimeRecord(models.Model) :
    marker: models.ForeignKey = models.ForeignKey('User', on_delete=models.CASCADE)
    student: models.IntegerField = models.IntegerField()
    assignment: models.ForeignKey = models.ForeignKey('Assignment', on_delete=models.CASCADE)
    datetime: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    types: typing.Tuple[typing.Tuple[str, str], ...] = (
        ('S', 'Start'),
        ('E', 'End'),
        ('C', 'Close'),
    )
    type: models.CharField = models.CharField(max_length=1, choices=types)

class TimeDuration(models.Model):
    marker: models.ForeignKey = models.ForeignKey('User', on_delete=models.CASCADE, related_name='marker_td')
    student: models.IntegerField = models.IntegerField()
    assignment: models.ForeignKey = models.ForeignKey('Assignment', on_delete=models.CASCADE)
    # TODO: change this later for the frontend time!
    # TODO these fields might be unnecessary.
    # start_time  = models.DateTimeField()
    # end_time  = models.DateTimeField()
    # TODO: https://docs.djangoproject.com/en/5.0/ref/models/fields/ << something about this not working
    ## as expected when comparing it with datetime.
    duration: models.DurationField = models.DurationField()
    selfDefined: models.BooleanField = models.BooleanField(default=False)

class TagCustom(models.Model):
    # apparently an ID gets added automatically.
    name: models.CharField = models.CharField(
        max_length=40,
        validators=[MinLengthValidator(2, "Tag must be greater than 2 characters.")]
    )
    owner: models.ForeignKey = models.ForeignKey(User, on_delete=models.CASCADE)
    # foreign key on delete / upadate cascade
    # TODO: actually might be assignment element !
    subElement: models.ForeignKey = models.ForeignKey('SubmissionElement', on_delete=models.CASCADE)

    visibilityOption: typing.Tuple[typing.Tuple[int, str], ...] = (
        (1, 'Me only'),
        (2, 'Markers only'),
        (3, 'Academics only'),
        (4, 'Everyone'),
    )
    visibility: models.IntegerField = models.IntegerField(choices=visibilityOption, default=1)

class Module(models.Model):
    name: models.CharField = models.CharField(max_length=30,null=False)
    introduction: models.TextField = models.TextField(max_length=300, default="currently no introduction")
    author: models.CharField = models.CharField(max_length=30, default="authors don't want to show their name")
    icon_address: models.ImageField = models.ImageField(upload_to='modules', blank=False)
    configuration: models.CharField = models.CharField(max_length=3000) # default configuration
    basic: models.SmallIntegerField = models.SmallIntegerField(default=1) # 1: not a default module
    configuration_path: models.CharField = models.CharField(default="", max_length=100)


class UserModule(models.Model):

    status: models.SmallIntegerField = models.SmallIntegerField(default=1) #0: default 1: active 2:inactive
    user: models.ForeignKey = models.ForeignKey('User', on_delete=models.CASCADE)
    module: models.ForeignKey = models.ForeignKey('Module', on_delete=models.CASCADE)
    assignment: models.ForeignKey = models.ForeignKey('Assignment', on_delete=models.CASCADE)
     # the configuration belongs to specific user
    configuration: models.CharField = models.CharField(max_length=3000)

class StudentSubmission(models.Model):
    assignment: models.ForeignKey = models.ForeignKey('Assignment', on_delete=models.CASCADE)
    user: models.ForeignKey = models.ForeignKey('User', on_delete=models.CASCADE)
    is_multisubmission_allowed: models.SmallIntegerField = models.SmallIntegerField(default=0)
    maximum_submissions: models.IntegerField = models.IntegerField()

    is_late_submission: models.IntegerField = models.IntegerField(default=0)
    file_number: models.IntegerField = models.IntegerField(default=1)

    files: models.CharField = models.CharField(max_length=3000)
    

class PeerReviewAllocation(models.Model):
    id: models.AutoField = models.AutoField(primary_key=True)
    """
    Tracks which students are assigned to review which submissions
    """
    reviewer: models.ForeignKey = models.ForeignKey(
        'User',
        on_delete=models.CASCADE,
        related_name='peer_reviews_to_do'
    )
    submission: models.ForeignKey = models.ForeignKey(
        'Submission',
        on_delete=models.CASCADE,
        related_name='peer_reviewers',
        null=True,
        blank=True
    )
    # Cross-feature extension (Unified PRD §6.4, §8): when set, the reviewer is
    # reviewing a group submission rather than an individual one. Exactly one of
    # `submission` / `group_submission` is set on any allocation.
    group_submission: models.ForeignKey = models.ForeignKey(
        'GroupSubmission',
        on_delete=models.CASCADE,
        related_name='peer_reviewers',
        null=True,
        blank=True
    )
    assignment: models.ForeignKey = models.ForeignKey(
        'Assignment',
        on_delete=models.CASCADE,
        null=True
    )
    STATUS_CHOICES = [
        ('PENDING', 'Not Started'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
    ]
    status: models.CharField = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING'
    )
    assigned_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    completed_at: models.DateTimeField = models.DateTimeField(null=True, blank=True)

    def update_status(self):
        """Updates the review status based on comment existence"""
        has_comments = self.peerreviewcomment_set.exists()
        if self.status == 'COMPLETED':
            return
        self.status = 'IN_PROGRESS' if has_comments else 'PENDING'
        self.save()

    def clean(self) -> None:
        if bool(self.submission_id) == bool(self.group_submission_id):
            raise ValidationError(
                "A peer review allocation must target exactly one of "
                "`submission` or `group_submission`."
            )

    @property
    def reviewed_object(self):
        """The Submission or GroupSubmission this allocation points at."""
        return self.group_submission if self.group_submission_id else self.submission

    class Meta:
        unique_together = [
            ['reviewer', 'submission', 'assignment'],
            ['reviewer', 'group_submission', 'assignment'],
        ]

class PeerReviewComment(models.Model):
    """
    Stores individual feedback comments made during peer review
    """
    id: models.AutoField = models.AutoField(primary_key=True)
    review_allocation: models.ForeignKey = models.ForeignKey('PeerReviewAllocation', on_delete=models.CASCADE)
    selected_text: models.TextField = models.TextField()
    feedback: models.TextField = models.TextField()
    margin_text_top: models.TextField = models.TextField(blank=True)
    margin_text_bottom: models.TextField = models.TextField(blank=True)
    position_data: models.JSONField = models.JSONField(help_text="""
    Stores PDF annotation position data in format:
    {
        "pageNumber": int,
        "boundingRect": {
            "left": float,
            "top": float,
            "width": float,
            "height": float
        }
    }
    """)
    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    marker_comment: models.TextField = models.TextField(blank=True, default="", help_text="A comment by a marker to display under the feedback by the reviewer.")
    llm_comment: models.TextField = models.TextField(blank=True, default="", help_text="A comment by the LLM to display under the feedback by the reviewer.")
    llm_comment_dismissed: models.BooleanField = models.BooleanField(default=False, help_text="Whether the LLM comment has been dismissed by the reviewer.")

@receiver([post_save, post_delete], sender=PeerReviewComment)
def update_review_status(sender, instance, **kwargs):
    """Update the review status whenever a comment is created or deleted"""
    instance.review_allocation.update_status()

class DismissedLLMFeedback(models.Model):
    """Stores information about dismissed LLM feedback"""
    id: models.AutoField = models.AutoField(primary_key=True)
    user: models.ForeignKey = models.ForeignKey('User', on_delete=models.CASCADE)
    llm_feedback: models.TextField = models.TextField(help_text="The LLM feedback that was dismissed")
    original_feedback: models.TextField = models.TextField(help_text="The original feedback that triggered the LLM response")
    context_text: models.TextField = models.TextField(help_text="The surrounding text context")
    user_feedback: models.TextField = models.TextField(blank=True, help_text="Optional user feedback")
    DISMISS_REASONS = [
        ('IMPLEMENTED', 'I have implemented the suggestions'),
        ('INCORRECT', 'The suggestions are incorrect'),
        ('NOT_APPLICABLE', 'The suggestions are not applicable'),
        ('DISAGREE', 'I disagree with the suggestions'),
        ('OTHER', 'Other reason')
    ]
    dismiss_reason: models.CharField = models.CharField(
        max_length=20,
        choices=DISMISS_REASONS,
    )
    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)


# =============================================================================
# Group Marking — ported from Haoyu Wang's branch (MarkEd-Hao/MarkEd/models.py)
#
# Ported verbatim except for two integration changes required by Unified PRD
# §6.1 and the Option B (S3) architecture:
#   1. `group_set_id` plain IntegerFields promoted to real ForeignKeys.
#   2. FileFields for submissions/workspace files become URLFields holding
#      pre-signed S3 URLs, matching Tomas's Submission.submissionFile.
# =============================================================================


class GroupSet(models.Model):
    """A named collection of groups within a course.

    Surfaced in the UI as "Group Category" (Unified PRD §9, b-1: students and
    staff found the term "GroupSet" confusing). The model name is preserved.
    """
    course: models.ForeignKey = models.ForeignKey('Course', on_delete=models.CASCADE, related_name='group_sets')
    name: models.CharField = models.CharField(max_length=100, help_text="Name of the group set (e.g., 'Midterm Groups', 'Final Project Groups')")
    description: models.TextField = models.TextField(blank=True, null=True, help_text="Description of the group set")
    max_group_size: models.IntegerField = models.IntegerField(default=5, help_text="Maximum number of students per group")
    min_group_size: models.IntegerField = models.IntegerField(default=2, help_text="Minimum number of students per group")
    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    is_active: models.BooleanField = models.BooleanField(default=True)

    # Student self-assignment settings
    allow_student_self_assignment: models.BooleanField = models.BooleanField(
        default=False,
        help_text="Allow students to join groups by themselves"
    )
    self_assignment_deadline: models.DateTimeField = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Deadline for student self-assignment (leave empty for no deadline)"
    )

    class Meta:
        ordering = ['name']

    def __str__(self) -> str:
        return f"{self.course.courseName} - {self.name}"

    def get_groups_count(self) -> int:
        return Group.objects.filter(group_set_id=self.id, is_active=True).count()

    def get_students_count(self) -> int:
        return GroupMember.objects.filter(
            group__group_set_id=self.id,
            group__is_active=True,
            is_active=True
        ).values('student').distinct().count()


class Group(models.Model):
    course: models.ForeignKey = models.ForeignKey('Course', on_delete=models.CASCADE, related_name='groups')
    # Promoted from Hao's plain IntegerField to a real FK (Unified PRD §6.1).
    group_set: models.ForeignKey = models.ForeignKey(
        'GroupSet', on_delete=models.CASCADE, null=True, blank=True, related_name='groups'
    )
    name: models.CharField = models.CharField(max_length=100)
    description: models.TextField = models.TextField(blank=True, null=True)
    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)
    is_active: models.BooleanField = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def __str__(self) -> str:
        return f"{self.course.courseName} - {self.name}"


class GroupMember(models.Model):
    group: models.ForeignKey = models.ForeignKey('Group', on_delete=models.CASCADE, related_name='members')
    student: models.ForeignKey = models.ForeignKey('User', on_delete=models.CASCADE, related_name='group_memberships')
    joined_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    is_active: models.BooleanField = models.BooleanField(default=True)

    class Meta:
        ordering = ['joined_at']

    def __str__(self) -> str:
        return f"{self.student.userName} in {self.group.name}"

    @property
    def group_set(self):
        return self.group.group_set


class GroupSubmission(models.Model):
    """Group submission for group assignments.

    Immutable: each confirmed submission is a new row, giving the version
    history Hao's evaluation praised as a "safety net". The latest active row
    is the current submission.
    """
    group: models.ForeignKey = models.ForeignKey('Group', on_delete=models.CASCADE, related_name='submissions')
    assignment: models.ForeignKey = models.ForeignKey('Assignment', on_delete=models.CASCADE, related_name='group_submissions')
    submitted_by: models.ForeignKey = models.ForeignKey('User', on_delete=models.CASCADE, related_name='group_submissions_made')
    submissionDateTime: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    # S3 URL, matching Submission.submissionFile (Option B architecture).
    submissionFile: models.URLField = models.URLField(blank=True, null=True, help_text="URL of the group submission file")
    is_active: models.BooleanField = models.BooleanField(default=True)
    submission_version: models.IntegerField = models.IntegerField(default=1, help_text="Submission version number for grouping files submitted together")

    class Meta:
        ordering = ['-submissionDateTime']

    def __str__(self) -> str:
        return f"{self.group.name} - {self.assignment.assignmentTitle}"

    @property
    def group_set(self):
        return self.group.group_set

    @property
    def filename(self) -> str:
        """Just the filename, without the S3 path/query string."""
        if self.submissionFile:
            return os.path.basename(self.submissionFile.split('?')[0])
        return "No file"


class GroupWorkspaceFile(models.Model):
    """Files uploaded to group workspace for review before final submission."""
    group: models.ForeignKey = models.ForeignKey('Group', on_delete=models.CASCADE, related_name='workspace_files')
    assignment: models.ForeignKey = models.ForeignKey('Assignment', on_delete=models.CASCADE, related_name='group_workspace_files')
    uploaded_by: models.ForeignKey = models.ForeignKey('User', on_delete=models.CASCADE, related_name='uploaded_workspace_files')
    file: models.URLField = models.URLField(blank=True, null=True, help_text="URL of the workspace file")
    upload_time: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    file_name: models.CharField = models.CharField(max_length=255)
    file_size: models.IntegerField = models.IntegerField()
    file_type: models.CharField = models.CharField(max_length=50)

    STATUS_CHOICES: typing.Tuple[typing.Tuple[str, str], ...] = (
        ('pending', 'Pending Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('submitted', 'Submitted'),
    )
    status: models.CharField = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    comments: models.TextField = models.TextField(blank=True, null=True)
    reviewed_by: models.ForeignKey = models.ForeignKey('User', on_delete=models.CASCADE, null=True, blank=True, related_name='reviewed_files')
    review_time: models.DateTimeField = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-upload_time']

    def __str__(self) -> str:
        return f"{self.group.name} - {self.file_name}"


class GroupSubmissionConfig(models.Model):
    """Configuration for group submissions."""
    group: models.ForeignKey = models.ForeignKey('Group', on_delete=models.CASCADE, related_name='submission_configs')
    assignment: models.ForeignKey = models.ForeignKey('Assignment', on_delete=models.CASCADE, related_name='group_submission_configs')
    maximum_submissions: models.IntegerField = models.IntegerField(default=3)
    is_late_submission_allowed: models.BooleanField = models.BooleanField(default=False)
    allowed_file_formats: models.CharField = models.CharField(max_length=500, default='pdf,doc,docx')
    max_file_size_mb: models.IntegerField = models.IntegerField(default=10)
    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    updated_at: models.DateTimeField = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['group', 'assignment']

    def __str__(self) -> str:
        return f"{self.group.name} - {self.assignment.assignmentTitle}"


class GroupSubmissionComment(models.Model):
    """Comments on workspace files."""
    file: models.ForeignKey = models.ForeignKey('GroupWorkspaceFile', on_delete=models.CASCADE, related_name='file_comments')
    author: models.ForeignKey = models.ForeignKey('User', on_delete=models.CASCADE, related_name='group_file_comments')
    content: models.TextField = models.TextField()
    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    is_active: models.BooleanField = models.BooleanField(default=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self) -> str:
        return f"Comment by {self.author.userName} on {self.file.file_name}"


class GroupSubmissionElement(models.Model):
    group_submission: models.ForeignKey = models.ForeignKey('GroupSubmission', on_delete=models.CASCADE)
    element: models.ForeignKey = models.ForeignKey('Element', on_delete=models.CASCADE)
    marker: models.ForeignKey = models.ForeignKey('User', on_delete=models.CASCADE, blank=True, null=True)
    score: models.FloatField = models.FloatField(blank=True, null=True)
    needModerate: models.BooleanField = models.BooleanField(default=False)
    needHelp: models.BooleanField = models.BooleanField(default=False)
    STATUS_CHOICES: typing.Tuple[typing.Tuple[int, str], ...] = (
        (0, 'Submitted'),
        (1, 'Marking'),
        (2, 'Finished'),
    )
    status: models.IntegerField = models.IntegerField(choices=STATUS_CHOICES, default=0)
    dateUpdated: models.DateTimeField = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"Group Submission Element: {self.element.name} - Score: {self.score}"

    class Meta:
        unique_together = ['group_submission', 'element']


class GroupSubmissionCriteria(models.Model):
    group_submission: models.ForeignKey = models.ForeignKey('GroupSubmission', on_delete=models.CASCADE)
    criteria: models.ForeignKey = models.ForeignKey(Criteria, on_delete=models.CASCADE, related_name='group_submission_elements', null=True)
    marker: models.ForeignKey = models.ForeignKey('User', on_delete=models.CASCADE, blank=True, null=True)
    score: models.FloatField = models.FloatField(blank=True, null=True)
    feedback: models.TextField = models.TextField(blank=True, null=True, default='{"start": "", "middle":"", "end": ""}')
    needModerate: models.BooleanField = models.BooleanField(default=False)
    needHelp: models.BooleanField = models.BooleanField(default=False)
    selected_elements: models.ManyToManyField = models.ManyToManyField(Element, blank=True)
    STATUS_CHOICES: typing.Tuple[typing.Tuple[int, str], ...] = (
        (0, 'Submitted'),
        (1, 'Marking'),
        (2, 'Finished'),
    )
    status: models.IntegerField = models.IntegerField(choices=STATUS_CHOICES, default=0)

    def clean(self) -> None:
        if not self.criteria:
            raise ValidationError("GroupSubmissionCriteria must be linked to a Criteria.")

    def __str__(self) -> str:
        element_list = ", ".join([str(element) for element in self.selected_elements.all()])
        return f"GroupSubmissionCriteria for {self.criteria} - Elements: {element_list} - {self.group_submission}"

    class Meta:
        unique_together = ['group_submission', 'criteria']


class GroupSubmissionPersonalAdjustment(models.Model):
    """Personal contribution adjustment for group submissions.

    Additive, exactly as Hao implemented it: final = base + adjustment.
    The score breakdown was the most-praised part of his evaluation, so the
    formula and the absence of a range constraint are both preserved
    (Unified PRD §14.5).
    """
    group_submission: models.ForeignKey = models.ForeignKey('GroupSubmission', on_delete=models.CASCADE, related_name='personal_adjustments')
    student: models.ForeignKey = models.ForeignKey('User', on_delete=models.CASCADE, related_name='group_personal_adjustments')
    adjustment_score: models.FloatField = models.FloatField(help_text="Personal contribution adjustment score (can be positive or negative)")
    adjustment_reason: models.TextField = models.TextField(blank=True, null=True, help_text="Reason for the adjustment")
    adjusted_by: models.ForeignKey = models.ForeignKey('User', on_delete=models.CASCADE, related_name='adjustments_made')
    adjustment_date: models.DateTimeField = models.DateTimeField(auto_now_add=True)

    STATUS_CHOICES: typing.Tuple[typing.Tuple[str, str], ...] = (
        ('draft', 'Draft'),
        ('final', 'Final'),
    )
    status: models.CharField = models.CharField(max_length=10, choices=STATUS_CHOICES, default='draft')

    class Meta:
        unique_together = ['group_submission', 'student']
        ordering = ['-adjustment_date']

    def __str__(self) -> str:
        return f"Personal adjustment for {self.student.userName} in {self.group_submission.group.name}"


# =============================================================================
# Self-Assessment — ported from Mingyue Qin's branch
# (MarkEd Self-Assessment-Mingyue/MarkEd/models.py). Ported verbatim.
# =============================================================================


class SelfAssessmentSetting(models.Model):
    assignment: models.OneToOneField = models.OneToOneField(Assignment, on_delete=models.CASCADE, primary_key=True)
    enabled: models.BooleanField = models.BooleanField(default=False)
    use_checklist: models.BooleanField = models.BooleanField(default=False)
    use_rubric: models.BooleanField = models.BooleanField(default=False)
    use_reflection: models.BooleanField = models.BooleanField(default=False)

    deadline: models.DateTimeField = models.DateTimeField(null=False, default=timezone.now)

    needs_feedback: models.BooleanField = models.BooleanField(default=False)
    max_score: models.PositiveIntegerField = models.PositiveIntegerField(default=0)

    def __str__(self) -> str:
        return f"SA Setting for Assignment {self.assignment_id}"


class ChecklistItem(models.Model):
    assignment: models.ForeignKey = models.ForeignKey('Assignment', on_delete=models.CASCADE)
    name: models.CharField = models.CharField(max_length=255)
    description: models.TextField = models.TextField(blank=True)

    def __str__(self) -> str:
        return f"[{self.assignment_id}] {self.name}"


class StudentSelfAssessmentSubmission(models.Model):
    student: models.ForeignKey = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sa_submissions')
    assignment: models.ForeignKey = models.ForeignKey('Assignment', on_delete=models.CASCADE, related_name='sa_submissions')
    checklist_answers: models.JSONField = models.JSONField(default=dict, blank=True)
    rubric_answers: models.JSONField = models.JSONField(default=dict, blank=True)
    guided_reflection_answers: models.JSONField = models.JSONField(default=dict, blank=True)
    submitted_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)

    feedback_text: models.TextField = models.TextField(blank=True, null=True)

    # Mingyue deliberately left this un-constrained: a student may submit a
    # self-assessment more than once and the latest row is the one displayed.
    # (Original comment: "每个作业可以提交多次自评，选取最新的进行展示".)

    def __str__(self) -> str:
        return f"SelfAssessment by {self.student} on Assignment {self.assignment_id}"


class ReflectionPrompt(models.Model):
    """One prompt per Gibbs reflective-cycle stage, customisable per assignment."""
    STAGE_CHOICES = [
        ('description', 'Description'),
        ('feelings', 'Feelings'),
        ('evaluation', 'Evaluation'),
        ('analysis', 'Analysis'),
        ('conclusion', 'Conclusion'),
        ('action_plan', 'Action Plan'),
    ]
    assignment: models.ForeignKey = models.ForeignKey(Assignment, on_delete=models.CASCADE)
    stage: models.CharField = models.CharField(choices=STAGE_CHOICES, max_length=20)
    prompt_text: models.TextField = models.TextField()

    class Meta:
        unique_together = ('assignment', 'stage')

    def __str__(self) -> str:
        return f"{self.assignment_id} - {self.stage}"


class SelfAssessmentRubricSelection(models.Model):
    """Which rubric criteria students self-grade against for this assignment."""
    assignment: models.ForeignKey = models.ForeignKey(Assignment, on_delete=models.CASCADE)
    criteria: models.ForeignKey = models.ForeignKey(Criteria, on_delete=models.CASCADE)

    class Meta:
        unique_together = ('assignment', 'criteria')


class FeedbackBankEntry(models.Model):
    """A reusable feedback snippet in a course's shared Feedback Bank.

    Restores the original bank (Hao's `Feedback` + `SavedFeedback` + `Reaction`)
    adapted to the unified schema: entries are shared across the markers of a
    course, crowd-rated via per-user reactions (`FeedbackBankReaction`) and
    bookmarked via per-user favourites (`FeedbackBankFavourite`). `used_count`
    tallies how often the snippet has been applied while marking; the like/
    dislike totals are derived from the reaction rows, never stored (so they
    can't drift the way the old up/down columns did).
    """
    owner: models.ForeignKey = models.ForeignKey('User', on_delete=models.CASCADE, related_name='feedback_bank_entries')
    course: models.ForeignKey = models.ForeignKey('Course', on_delete=models.CASCADE, null=True, blank=True, related_name='feedback_bank_entries')
    text: models.TextField = models.TextField()
    category: models.CharField = models.CharField(max_length=60, blank=True, default='')
    used_count: models.IntegerField = models.IntegerField(default=0)
    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f"{self.category or 'General'}: {self.text[:40]}"


class FeedbackBankReaction(models.Model):
    """A marker's like/dislike on a bank entry (one per user per entry).

    Mirrors the original `Reaction` model so the 👍/👎 totals are real,
    per-user, and switchable — the same crowd-rating the source used.
    """
    entry: models.ForeignKey = models.ForeignKey('FeedbackBankEntry', on_delete=models.CASCADE, related_name='reactions')
    user: models.ForeignKey = models.ForeignKey('User', on_delete=models.CASCADE)
    REACTION_CHOICES = (('like', 'Like'), ('dislike', 'Dislike'))
    reaction_type: models.CharField = models.CharField(max_length=10, choices=REACTION_CHOICES)

    class Meta:
        unique_together = ('entry', 'user')


class FeedbackBankFavourite(models.Model):
    """A marker's bookmark of a bank entry (the original's `SavedFeedback`)."""
    entry: models.ForeignKey = models.ForeignKey('FeedbackBankEntry', on_delete=models.CASCADE, related_name='favourites')
    user: models.ForeignKey = models.ForeignKey('User', on_delete=models.CASCADE)

    class Meta:
        unique_together = ('entry', 'user')
