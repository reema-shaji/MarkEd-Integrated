"""Demo seeder for the integrated MarkEd system.

Follows the approach of the earlier unified build's core/seed.py: it seeds only
the SETUP — people, courses, groups, assignments, rubrics, self-assessment
configuration — and deliberately creates NO submissions, group submissions,
marks, self-assessments or peer allocations. The demo produces those live, so
nothing is pre-filled with placeholder files that cannot render.

Run (stack up):
    docker compose exec -T backend python manage.py seed_demo --force
Idempotent (get_or_create / update_or_create); safe to re-run.
Password for every account: SEED_DEMO_PASSWORD (default Test1234!).
"""
import datetime
import os

from django.contrib.auth.hashers import make_password
from django.utils import timezone

from MarkEd.models import (
    Assignment, ChecklistItem, Course, Course2Marker, Course2Student, Criteria,
    Element, Group, GroupMember, GroupSet, Module, ReflectionPrompt,
    SelfAssessmentRubricSelection, SelfAssessmentSetting, StudentSubmission,
    User, UserModule,
)

DEMO_PASSWORD = os.getenv("SEED_DEMO_PASSWORD", "Test1234!")
PW = make_password(DEMO_PASSWORD)
now = timezone.now()

# --- Fictional demo people ---------------------------------------------------
ACADEMICS = [('acad001', 'Dr Alan Whitfield'), ('acad002', 'Dr Naomi Sterling')]
MARKERS = [('mark001', 'Ben Carter'), ('mark002', 'Grace Miller')]
TA = ('ta001', 'Marco Reyes')
STUDENT_NAMES = [
    'Amara Okafor', 'Liam Bennett', 'Sofia Rossi', 'Noah Chen', 'Priya Nair',
    'Ethan Walsh', 'Maya Larsson', 'Omar Haddad', 'Chloe Dubois', 'Kai Nakamura',
    'Isla Fraser', 'Diego Morales', 'Zara Ahmed', 'Lucas Meyer', 'Freya Andersson',
    'Yusuf Demir', 'Hana Kim', 'Elena Petrova',
]

GIBBS_DEFAULTS = {
    'description': 'Describe what you produced for this assignment.',
    'feelings': 'How did you feel while working on it?',
    'evaluation': 'What went well and what did not?',
    'analysis': 'Why do you think it went that way?',
    'conclusion': 'What have you learned?',
    'action_plan': 'What will you do differently next time?',
}

RUBRIC = [
    ('Problem analysis', 30),
    ('Implementation', 40),
    ('Evaluation & writing', 30),
]
LEVELS = [('Poor', 0.0), ('Fair', 0.5), ('Good', 0.75), ('Excellent', 1.0)]


def _user(number, name, role):
    user, created = User.objects.get_or_create(
        userNumber=number,
        defaults=dict(userName=name, userEmail=f'{number}@marked.ed.ac.uk',
                      role=role, isValid=True, password=PW),
    )
    if not created:
        user.userName, user.userEmail, user.role = name, f'{number}@marked.ed.ac.uk', role
        user.isValid, user.password = True, PW
        user.save()
    return user


def _attach_staff(course, staff):
    for m in staff:
        Course2Marker.objects.get_or_create(
            course=course, marker=m,
            defaults=dict(canCreateAssignment=True, markingPermission=2,
                          submissionPermission=2, structurePermission=2, teamPermission=2),
        )


def _assignment(course, title, deadline, **extra):
    a, _ = Assignment.objects.get_or_create(
        course=course, assignmentTitle=title,
        defaults=dict(deadline=deadline, status=1,
                      release_date=now - datetime.timedelta(days=2), **extra),
    )
    # keep config in sync across reseeds
    a.deadline = deadline
    for k, v in extra.items():
        setattr(a, k, v)
    a.save()
    return a


def _rubric(assignment):
    for name, marks in RUBRIC:
        crit, _ = Criteria.objects.get_or_create(
            assignment=assignment, name=name, parent=None,
            defaults=dict(marks=marks, marking_scheme='SEL'))
        crit.marks = marks
        crit.save()
        for lname, frac in LEVELS:
            Element.objects.get_or_create(
                criteria=crit, name=lname,
                defaults=dict(description=f'{lname} performance on {name.lower()}.',
                              marks=round(marks * frac, 1)))


def _self_assessment(assignment):
    SelfAssessmentSetting.objects.update_or_create(
        assignment=assignment,
        defaults=dict(enabled=True, use_checklist=True, use_rubric=True,
                      use_reflection=True, needs_feedback=True, max_score=30,
                      deadline=assignment.deadline + datetime.timedelta(days=2)))
    for name in ['I have addressed every part of the brief',
                 'My referencing is complete and consistent',
                 'I have proofread the whole document']:
        ChecklistItem.objects.get_or_create(assignment=assignment, name=name)
    for stage, text in GIBBS_DEFAULTS.items():
        ReflectionPrompt.objects.get_or_create(
            assignment=assignment, stage=stage, defaults=dict(prompt_text=text))
    for crit in Criteria.objects.filter(assignment=assignment, parent=None)[:2]:
        SelfAssessmentRubricSelection.objects.get_or_create(assignment=assignment, criteria=crit)


print("Seeding integrated MarkEd demo (setup only — no submissions/marks)...")

# --- Module (id=1 = Submission Module) ---------------------------------------
Module.objects.get_or_create(
    id=1, defaults=dict(name='Submission Module', introduction='Handles student submissions.',
                        author='MarkEd', configuration='{}', basic=0, configuration_path=''))

# --- People ------------------------------------------------------------------
academics = [_user(n, name, 'A') for n, name in ACADEMICS]
markers = [_user(n, name, 'M') for n, name in MARKERS]
ta = _user(TA[0], TA[1], 'T')
students = [_user(f'stud{i:03d}', STUDENT_NAMES[i - 1], 'S')
            for i in range(1, len(STUDENT_NAMES) + 1)]

# --- Course A: full demo (INF2-SEPP) -----------------------------------------
course = Course.objects.get_or_create(
    courseCode='INF2-SEPP',
    defaults=dict(courseName='Software Engineering & Professional Practice'))[0]
_attach_staff(course, [academics[0]] + markers + [ta])
for s in students:
    Course2Student.objects.get_or_create(course=course, student=s)

# Group set: 4 teams, deliberately not full ([4,4,3,3]) so stud015–018 stay
# ungrouped for the add-to-group / self-enrolment flows.
group_set = GroupSet.objects.get_or_create(
    course=course, name='Coursework Groups',
    defaults=dict(min_group_size=2, max_group_size=4, allow_student_self_assignment=True))[0]
sizes, idx = [4, 4, 3, 3], 0
for gi in range(4):
    g = Group.objects.get_or_create(course=course, group_set=group_set, name=f'Team {gi + 1}')[0]
    for member in students[idx:idx + sizes[gi]]:
        GroupMember.objects.get_or_create(group=g, student=member)
    idx += sizes[gi]

# Assignments — all future deadlines, nothing submitted.
a_ind = _assignment(course, 'CW1: Design Report', now + datetime.timedelta(days=7),
                    assignment_type='INDIVIDUAL')
a_grp = _assignment(course, 'CW2: Group Project', now + datetime.timedelta(days=14),
                    assignment_type='GROUP', group_set=group_set, min_group_size=2, max_group_size=4)
a_peer = _assignment(course, 'CW3: Peer-Reviewed Essay', now + datetime.timedelta(days=5),
                     assignment_type='INDIVIDUAL', peer_review_enabled=True,
                     reviews_per_student=2, review_deadline=now + datetime.timedelta(days=12))
a_grp_peer = _assignment(course, 'CW4: Group + Peer Review', now + datetime.timedelta(days=5),
                         assignment_type='GROUP', group_set=group_set, min_group_size=2,
                         max_group_size=4, peer_review_enabled=True, reviews_per_student=2,
                         review_deadline=now + datetime.timedelta(days=12))
for a in (a_ind, a_grp, a_peer, a_grp_peer):
    _rubric(a)
    for u in students:
        UserModule.objects.get_or_create(user=u, module_id=1, assignment=a,
                                          defaults=dict(status=1, configuration='{}'))
        StudentSubmission.objects.get_or_create(
            assignment=a, user=u,
            defaults=dict(is_multisubmission_allowed=1, maximum_submissions=3, file_number=1, files='{}'))
_self_assessment(a_ind)

# --- Course B: lighter demo (INF3-ADS); first 12 students dual-enrolled -------
course_b = Course.objects.get_or_create(
    courseCode='INF3-ADS', defaults=dict(courseName='Algorithms & Data Structures'))[0]
_attach_staff(course_b, [academics[1]] + markers + [ta])
for s in students[:12]:
    Course2Student.objects.get_or_create(course=course_b, student=s)
b_ind = _assignment(course_b, 'A1: Algorithm Analysis Report', now + datetime.timedelta(days=10),
                    assignment_type='INDIVIDUAL')
b_peer = _assignment(course_b, 'A2: Peer-Reviewed Problem Set', now + datetime.timedelta(days=6),
                     assignment_type='INDIVIDUAL', peer_review_enabled=True,
                     reviews_per_student=2, review_deadline=now + datetime.timedelta(days=13))
for a in (b_ind, b_peer):
    _rubric(a)

print(f"""
Seed complete (setup only).
  Courses      : {Course.objects.count()}  (INF2-SEPP, INF3-ADS)
  Users        : {User.objects.count()}  ({len(students)} students, dual-enrolled: 12)
  Assignments  : {Assignment.objects.count()}
  Group set    : 4 teams sized 4/4/3/3 — stud015–018 ungrouped
  Submissions/marks/reviews: none (produced live in the demo)

Log in (password = SEED_DEMO_PASSWORD, default Test1234!):
  acad001  Dr Alan Whitfield   (Academic, INF2-SEPP)
  mark001  Ben Carter          (Marker)
  stud001  Amara Okafor        (Student, Team 1)
  stud015  Freya Andersson     (Student, ungrouped)
""")
