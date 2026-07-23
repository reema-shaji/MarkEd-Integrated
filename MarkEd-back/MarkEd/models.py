from datetime import datetime
import typing
from django.db import models
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
    last_seen: models.DateTimeField = models.DateTimeField(default=datetime.now)


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
    assignmentWebsite: models.URLField = models.URLField()
    deadline: models.DateTimeField = models.DateTimeField()
    permission_choice: typing.Tuple[typing.Tuple[int, str], ...] = (
        (0, 'disabled'),
        (1, 'enabled'),
    )
    status: models.IntegerField = models.IntegerField(choices=permission_choice, default=1)
    
    ASSIGNMENT_TYPE_CHOICES: typing.Tuple[typing.Tuple[str, str], ...] = (
        ('STANDARD', 'Standard Assignment'),
        ('PEER_REVIEW', 'Peer Review Assignment'),
    )
    assignment_type: models.CharField = models.CharField(
        max_length=20,
        choices=ASSIGNMENT_TYPE_CHOICES,
        default='STANDARD'
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
        related_name='peer_reviewers'
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

    class Meta:
        unique_together = ['reviewer', 'submission', 'assignment']

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
