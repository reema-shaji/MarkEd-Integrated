"""Unified demo seeder for the integrated MarkEd system.

Covers the seed-data requirements in Unified PRD §15.2 — every feature from all
three source branches, so the whole system can be exercised end to end.

Run (stack must be up via docker compose):
    docker compose exec -T backend python manage.py shell -c "exec(open('seed_demo.py').read())"

Idempotent: re-running updates in place rather than duplicating.
Everyone's password: Test1234!

Note: peer review and group submissions store S3 URLs. Without object storage
configured, the records exist and the whole flow is navigable, but the PDFs
themselves will not render.
"""
import datetime

from django.contrib.auth.hashers import make_password
from django.utils import timezone

from MarkEd.models import (
    Assignment, ChecklistItem, Course, Course2Marker, Course2Student, Criteria,
    Element, Group, GroupMember, GroupSet, GroupSubmission,
    GroupSubmissionCriteria, GroupSubmissionPersonalAdjustment, Module,
    ReflectionPrompt, SelfAssessmentRubricSelection, SelfAssessmentSetting,
    StudentSubmission, Submission, User, UserModule,
)

PW = make_password("Test1234!")
now = timezone.now()

MODULE_CFG = (
    "{'name':'any','size':10,'format':'pdf,doc,docx,zip','number':'1','extension':'5',"
    "'maximumTime':'4','lateSubmission':1,'multipleSubmission':1,'date':'12/17/2024',"
    "'file1':[{'format':'pdf'},{'size':'10'},{'name':'submission'}],"
    "'file2':[{'format':'pdf'},{'size':'10'},{'name':'submission'}]}"
)
FILES_CFG = "{'file1': [{'format': 'pdf'}, {'size': '10'}, {'name': 'submission'}]}"

print("Seeding unified MarkEd demo data...")

# --- Module (id=1 must be the Submission Module) -----------------------------
module, _ = Module.objects.update_or_create(id=1, defaults=dict(
    name="Submission Module", introduction="submission settings",
    author="MarkEd Teams", icon_address="modules/submission_module.png",
    configuration=MODULE_CFG, basic=0, configuration_path="/submission_module.html",
))


# --- People ------------------------------------------------------------------
def mkuser(number, name, email, role):
    u, _ = User.objects.get_or_create(
        userNumber=number, defaults=dict(userName=name, userEmail=email, role=role))
    u.userName, u.userEmail, u.role = name, email, role
    u.password, u.isValid, u.must_change_password = PW, True, False
    u.save()
    return u


academic = mkuser("acad001", "Dr Patel", "patel@ed.ac.uk", "A")
marker1 = mkuser("mark001", "Dr Roberts", "roberts@ed.ac.uk", "M")
marker2 = mkuser("mark002", "Dr Okafor", "okafor@ed.ac.uk", "M")

NAMES = [
    "James Chen", "Aisha Khan", "Marco Rossi", "Lena Fischer",
    "Priya Nair", "Tom Baker", "Sofia Alvarez", "Yuki Tanaka",
    "Omar Haddad", "Grace Lin", "Daniel Novak", "Ines Moreau",
    "Kwame Mensah", "Elif Demir", "Ravi Sharma", "Clara Bianchi",
    "Noah Svensson", "Mei Zhang",
]
students = [
    mkuser(f"stud{i:03d}", name, f"stud{i:03d}@ed.ac.uk", "S")
    for i, name in enumerate(NAMES, start=1)
]

# --- Courses -----------------------------------------------------------------
course, _ = Course.objects.update_or_create(
    courseCode="COMP0034", defaults=dict(courseName="Software Engineering"))
course2, _ = Course.objects.update_or_create(
    courseCode="COMP0035", defaults=dict(courseName="Data Analysis"))

for c in (course, course2):
    for staff in (academic, marker1, marker2):
        Course2Marker.objects.update_or_create(
            course=c, marker=staff,
            defaults=dict(canCreateAssignment=(staff == academic),
                          submissionPermission=2, markingPermission=2,
                          structurePermission=2, teamPermission=2),
        )

for s in students:
    Course2Student.objects.get_or_create(course=course, student=s)
# A subset also sit in the second course, so the course switcher has something
# meaningful to switch between.
for s in students[:10]:
    Course2Student.objects.get_or_create(course=course2, student=s)


def rubric_for(assignment):
    """Three top-level criteria, each with four grade levels."""
    spec = [
        ("Problem analysis", 30, [
            ("Poor", "Little evidence of analysis.", 0),
            ("Fair", "Some analysis, gaps remain.", 15),
            ("Good", "Sound analysis throughout.", 23),
            ("Excellent", "Insightful, thorough analysis.", 30),
        ]),
        ("Implementation", 40, [
            ("Poor", "Does not work as specified.", 0),
            ("Fair", "Partially working.", 20),
            ("Good", "Works, reasonably structured.", 30),
            ("Excellent", "Robust and well structured.", 40),
        ]),
        ("Evaluation & writing", 30, [
            ("Poor", "Unclear, unsupported.", 0),
            ("Fair", "Basic evaluation.", 15),
            ("Good", "Clear, well evidenced.", 23),
            ("Excellent", "Critical and well argued.", 30),
        ]),
    ]
    created = []
    for name, marks, levels in spec:
        crit, _ = Criteria.objects.get_or_create(
            assignment=assignment, name=name, parent=None,
            defaults=dict(marks=marks, marking_scheme='SEL'))
        crit.marks = marks
        crit.save()
        for lname, ldesc, lmarks in levels:
            Element.objects.get_or_create(
                criteria=crit, name=lname,
                defaults=dict(description=ldesc, marks=lmarks))
        created.append(crit)
    return created


def enable_submission_module(assignment):
    for u in students:
        UserModule.objects.get_or_create(
            user=u, module=module, assignment=assignment,
            defaults=dict(status=1, configuration=MODULE_CFG))
        StudentSubmission.objects.get_or_create(
            assignment=assignment, user=u,
            defaults=dict(is_multisubmission_allowed=1, maximum_submissions=3,
                          file_number=1, files=FILES_CFG))


# =============================================================================
# 1. INDIVIDUAL assignment with submissions
# =============================================================================
a1, _ = Assignment.objects.update_or_create(
    course=course, assignmentTitle="Requirements Report",
    defaults=dict(
        assignmentDescription="Analyse the stakeholder brief and produce a requirements report.",
        deadline=now - datetime.timedelta(days=7),
        assignment_type='INDIVIDUAL', status=1,
        release_date=now - datetime.timedelta(days=21),
    ))
rubric_for(a1)
enable_submission_module(a1)
for s in students:
    Submission.objects.get_or_create(
        student=s, assignment=a1,
        defaults=dict(submissionFile="https://example.invalid/demo/requirements.pdf"))

# =============================================================================
# 2. GROUP assignment — group set, groups, submissions, adjustments (Hao)
# =============================================================================
group_set, _ = GroupSet.objects.update_or_create(
    course=course, name="Project Groups",
    defaults=dict(description="Teams for the group project",
                  min_group_size=2, max_group_size=5,
                  allow_student_self_assignment=False))

a2, _ = Assignment.objects.update_or_create(
    course=course, assignmentTitle="Group Project Report",
    defaults=dict(
        assignmentDescription="Design and build a system as a team, then report on it.",
        deadline=now - datetime.timedelta(days=3),
        assignment_type='GROUP', group_set=group_set,
        min_group_size=2, max_group_size=5, status=1,
        release_date=now - datetime.timedelta(days=28),
    ))
a2_criteria = rubric_for(a2)
enable_submission_module(a2)

# Four groups of four; the last two students stay ungrouped so the
# auto-assign and drag-and-drop flows have something to act on.
for gi in range(4):
    g, _ = Group.objects.update_or_create(
        course=course, group_set=group_set, name=f"Team {gi + 1}",
        defaults=dict(description=f"Project team {gi + 1}"))
    for s in students[gi * 4:(gi + 1) * 4]:
        GroupMember.objects.get_or_create(group=g, student=s)

for g in Group.objects.filter(group_set=group_set, is_active=True):
    members = list(GroupMember.objects.filter(group=g, is_active=True))
    if not members:
        continue
    gs, _ = GroupSubmission.objects.get_or_create(
        group=g, assignment=a2, submission_version=1,
        defaults=dict(submitted_by=members[0].student,
                      submissionFile="https://example.invalid/demo/group-report.pdf"))
    # Marked against the rubric, so the contribution-adjustment screen has a
    # base score to work from.
    for crit in a2_criteria:
        top = Element.objects.filter(criteria=crit).order_by('-marks').first()
        GroupSubmissionCriteria.objects.get_or_create(
            group_submission=gs, criteria=crit,
            defaults=dict(marker=marker1,
                          score=(top.marks * 0.75 if top else 0), status=2))
    # One group also gets per-member adjustments recorded.
    if g.name == "Team 1":
        deltas = [4.0, 0.0, -3.0, 1.5]
        reasons = ["Led integration and testing", "Contribution as expected",
                   "Limited contribution to the build", "Drove the evaluation chapter"]
        for member, delta, reason in zip(members, deltas, reasons):
            GroupSubmissionPersonalAdjustment.objects.update_or_create(
                group_submission=gs, student=member.student,
                defaults=dict(adjustment_score=delta, adjustment_reason=reason,
                              adjusted_by=marker1, status='final'))

# =============================================================================
# 3. INDIVIDUAL assignment with peer review enabled (Tomas)
# =============================================================================
a3, _ = Assignment.objects.update_or_create(
    course=course, assignmentTitle="Design Critique (Peer Reviewed)",
    defaults=dict(
        assignmentDescription="Submit your design, then review three of your peers'.",
        deadline=now - datetime.timedelta(days=2),
        assignment_type='INDIVIDUAL', status=1,
        peer_review_enabled=True, reviews_per_student=3,
        review_deadline=now + datetime.timedelta(days=7),
        release_date=now - datetime.timedelta(days=14),
        assignment_instructions=["instruction/design-brief.pdf"],
    ))
rubric_for(a3)
enable_submission_module(a3)
for s in students:
    Submission.objects.get_or_create(
        student=s, assignment=a3,
        defaults=dict(submissionFile="https://example.invalid/demo/design.pdf"))

# =============================================================================
# 4. GROUP assignment with peer review enabled (the §8 cross-feature case)
# =============================================================================
a4, _ = Assignment.objects.update_or_create(
    course=course, assignmentTitle="Group Prototype (Peer Reviewed)",
    defaults=dict(
        assignmentDescription="Teams submit a prototype; every team reviews others' work.",
        deadline=now - datetime.timedelta(days=1),
        assignment_type='GROUP', group_set=group_set,
        min_group_size=2, max_group_size=5, status=1,
        peer_review_enabled=True, reviews_per_student=2,
        review_deadline=now + datetime.timedelta(days=10),
        release_date=now - datetime.timedelta(days=20),
    ))
rubric_for(a4)
enable_submission_module(a4)
for g in Group.objects.filter(group_set=group_set, is_active=True):
    members = list(GroupMember.objects.filter(group=g, is_active=True))
    if members:
        GroupSubmission.objects.get_or_create(
            group=g, assignment=a4, submission_version=1,
            defaults=dict(submitted_by=members[0].student,
                          submissionFile="https://example.invalid/demo/prototype.pdf"))
# Allocation is left untriggered so cross-group matching can be demonstrated
# from the UI.

# =============================================================================
# 5. Assignment with self-assessment enabled (Mingyue)
# =============================================================================
a5, _ = Assignment.objects.update_or_create(
    course=course, assignmentTitle="Reflective Portfolio",
    defaults=dict(
        assignmentDescription="Submit your portfolio and complete a self-assessment.",
        deadline=now + datetime.timedelta(days=5),
        assignment_type='INDIVIDUAL', status=1,
        release_date=now - datetime.timedelta(days=10),
    ))
a5_criteria = rubric_for(a5)
enable_submission_module(a5)

SelfAssessmentSetting.objects.update_or_create(
    assignment=a5,
    defaults=dict(enabled=True, use_checklist=True, use_rubric=True,
                  use_reflection=True, needs_feedback=True, max_score=30,
                  deadline=now + datetime.timedelta(days=7)))

for name, desc in [
    ("I have addressed every part of the brief",
     "Check each requirement in the brief against your submission."),
    ("My referencing is complete and consistent",
     "Every source cited appears in the bibliography."),
    ("I have proofread the whole document", "Read it once more, ideally aloud."),
    ("My diagrams are labelled and referred to in the text", ""),
]:
    ChecklistItem.objects.get_or_create(
        assignment=a5, name=name, defaults=dict(description=desc))

# Gibbs prompts stay at Mingyue's defaults except one customisation, to show
# that per-assignment editing works.
ReflectionPrompt.objects.update_or_create(
    assignment=a5, stage='action_plan',
    defaults=dict(prompt_text="For the next portfolio, what will you do differently, and when?"))

for crit in a5_criteria[:2]:
    SelfAssessmentRubricSelection.objects.get_or_create(assignment=a5, criteria=crit)

# A second-course assignment so switching courses shows different content.
a6, _ = Assignment.objects.update_or_create(
    course=course2, assignmentTitle="Data Analysis Coursework",
    defaults=dict(assignmentDescription="Analyse the provided dataset.",
                  deadline=now + datetime.timedelta(days=14),
                  assignment_type='INDIVIDUAL', status=1,
                  release_date=now - datetime.timedelta(days=7)))
rubric_for(a6)

print(f"""
Seed complete.
  Courses      : {Course.objects.count()}
  Users        : {User.objects.count()} ({len(students)} students)
  Assignments  : {Assignment.objects.count()}
  Group sets   : {GroupSet.objects.count()}   Groups: {Group.objects.count()}
  Group subs   : {GroupSubmission.objects.count()}
  Submissions  : {Submission.objects.count()}
  Checklist    : {ChecklistItem.objects.count()} items

Log in with any of:
  acad001 / Test1234!   (Academic)
  mark001 / Test1234!   (Marker)
  stud001 / Test1234!   (Student, in Team 1)
  stud017 / Test1234!   (Student, ungrouped)
""")
