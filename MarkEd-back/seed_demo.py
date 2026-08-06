"""Demo seeder for the integrated MarkEd system (usability-study setup).

Seeds ONLY the setup — people, courses, groups, assignments, rubrics — and
creates NO submissions, group submissions, marks, self-assessments, peer-review
allocations or peer comments. Those are performed live by the study facilitator
and participants; nothing is pre-filled.

Every assignment shares one fixed, OPEN deadline (15 Aug 2026) so all tasks are
available throughout the study. Rubrics are attached so per-criterion marking
(M2/M4) works the moment a submission exists.

Run (stack up):
    docker compose exec -T backend python manage.py seed_demo --force
Reset a hosted DB first (wipe + reseed):  set SEED_RESET=true and redeploy.
Idempotent (get_or_create); password for every account = SEED_DEMO_PASSWORD
(default Test1234!).
"""
import datetime
import os

from django.contrib.auth.hashers import make_password
from django.utils import timezone

from MarkEd.models import (
    Assignment, Course, Course2Marker, Course2Student, Criteria, Element,
    Group, GroupMember, GroupSet, Module, StudentSubmission, User, UserModule,
)

DEMO_PASSWORD = os.getenv("SEED_DEMO_PASSWORD", "Test1234!")
PW = make_password(DEMO_PASSWORD)
now = timezone.now()

# One fixed, open deadline for every assignment (end of 15 Aug 2026, UTC).
DEADLINE = datetime.datetime(2026, 8, 15, 23, 59, tzinfo=datetime.timezone.utc)
REVIEW_DEADLINE = DEADLINE + datetime.timedelta(days=7)
RELEASED = now - datetime.timedelta(days=2)  # release_date in the past => open now

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


def _enrol(course, cohort):
    for s in cohort:
        Course2Student.objects.get_or_create(course=course, student=s)


def _assignment(course, title, description, **extra):
    a, _ = Assignment.objects.get_or_create(
        course=course, assignmentTitle=title,
        defaults=dict(assignmentDescription=description, deadline=DEADLINE,
                      status=1, release_date=RELEASED, **extra),
    )
    # keep config in sync across reseeds
    a.assignmentDescription = description
    a.deadline = DEADLINE
    a.release_date = RELEASED
    a.status = 1
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


def _register(assignment, cohort):
    """Module registration + an EMPTY submission slot so students can submit
    live. No files, no marks — not an actual submission."""
    for u in cohort:
        UserModule.objects.get_or_create(user=u, module_id=1, assignment=assignment,
                                          defaults=dict(status=1, configuration='{}'))
        StudentSubmission.objects.get_or_create(
            assignment=assignment, user=u,
            defaults=dict(is_multisubmission_allowed=1, maximum_submissions=3,
                          file_number=1, files='{}'))


def _group_set(course, cohort, sizes, name='Coursework Groups'):
    gs = GroupSet.objects.get_or_create(
        course=course, name=name,
        defaults=dict(min_group_size=2, max_group_size=4,
                      allow_student_self_assignment=True))[0]
    idx = 0
    for gi, size in enumerate(sizes):
        g = Group.objects.get_or_create(course=course, group_set=gs, name=f'Team {gi + 1}')[0]
        for member in cohort[idx:idx + size]:
            GroupMember.objects.get_or_create(group=g, student=member)
        idx += size
    return gs


print("Seeding MarkEd usability-study data (setup only — no submissions/marks/reviews)...")

# --- Submission module (id=1) ------------------------------------------------
Module.objects.get_or_create(
    id=1, defaults=dict(name='Submission Module', introduction='Handles student submissions.',
                        author='MarkEd', configuration='{}', basic=0, configuration_path=''))

# --- People ------------------------------------------------------------------
academics = [_user(n, name, 'A') for n, name in ACADEMICS]
markers = [_user(n, name, 'M') for n, name in MARKERS]
ta = _user(TA[0], TA[1], 'T')
students = [_user(f'stud{i:03d}', STUDENT_NAMES[i - 1], 'S')
            for i in range(1, len(STUDENT_NAMES) + 1)]
STAFF = academics + markers + [ta]

# =============================================================================
# Course 1 — INF2-SEPP: the primary study course. Has all three flavours so a
# marker can do M1–M5 within one course: an individual, a group and a
# peer-reviewed assignment.
# =============================================================================
sepp = Course.objects.get_or_create(
    courseCode='INF2-SEPP',
    defaults=dict(courseName='Software Engineering & Professional Practice'))[0]
_attach_staff(sepp, STAFF)
_enrol(sepp, students)
# 4 teams sized 4/4/3/3 → students 1–14 grouped, 15–18 left ungrouped.
sepp_groups = _group_set(sepp, students, [4, 4, 3, 3])

sepp_cw1 = _assignment(
    sepp, 'CW1: Software Design Report',
    'Individual coursework. Submit a design report (PDF) for a small software '
    'system: requirements, architecture, and key design decisions.',
    assignment_type='INDIVIDUAL')
sepp_cw2 = _assignment(
    sepp, 'CW2: Team Software Project',
    'Group coursework. Your team designs and implements a small application and '
    'submits the report and code from the shared workspace.',
    assignment_type='GROUP', group_set=sepp_groups, min_group_size=2, max_group_size=4)
sepp_cw3 = _assignment(
    sepp, 'CW3: Peer-Reviewed Technical Essay',
    'Individual coursework with peer review. Submit a technical essay; you will '
    'then anonymously review two of your peers\' essays.',
    assignment_type='INDIVIDUAL', peer_review_enabled=True,
    reviews_per_student=2, review_deadline=REVIEW_DEADLINE)

for a in (sepp_cw1, sepp_cw2, sepp_cw3):
    _rubric(a)
    _register(a, students)

# =============================================================================
# Course 2 — INF3-ADS: Algorithms & Data Structures (individual + peer review).
# =============================================================================
ads = Course.objects.get_or_create(
    courseCode='INF3-ADS', defaults=dict(courseName='Algorithms & Data Structures'))[0]
_attach_staff(ads, STAFF)
ads_cohort = students[:12]
_enrol(ads, ads_cohort)

ads_cw1 = _assignment(
    ads, 'CW1: Algorithm Analysis Report',
    'Individual coursework. Analyse the time and space complexity of a set of '
    'algorithms and submit your report as a PDF.',
    assignment_type='INDIVIDUAL')
ads_cw2 = _assignment(
    ads, 'CW2: Peer-Reviewed Problem Set',
    'Individual coursework with peer review. Submit your solved problem set; you '
    'will then anonymously review two of your peers\' submissions.',
    assignment_type='INDIVIDUAL', peer_review_enabled=True,
    reviews_per_student=2, review_deadline=REVIEW_DEADLINE)

for a in (ads_cw1, ads_cw2):
    _rubric(a)
    _register(a, ads_cohort)

# =============================================================================
# Course 3 — INF4-DBS: Database Systems (individual + group).
# =============================================================================
dbs = Course.objects.get_or_create(
    courseCode='INF4-DBS', defaults=dict(courseName='Database Systems'))[0]
_attach_staff(dbs, STAFF)
dbs_cohort = students[:8]
_enrol(dbs, dbs_cohort)
# 2 teams of 4.
dbs_groups = _group_set(dbs, dbs_cohort, [4, 4])

dbs_cw1 = _assignment(
    dbs, 'CW1: Relational Database Design',
    'Individual coursework. Design a normalised relational schema for a given '
    'domain and submit the design report as a PDF.',
    assignment_type='INDIVIDUAL')
dbs_cw2 = _assignment(
    dbs, 'CW2: Group Database Project',
    'Group coursework. Your team builds and documents a database application and '
    'submits it from the shared workspace.',
    assignment_type='GROUP', group_set=dbs_groups, min_group_size=2, max_group_size=4)

for a in (dbs_cw1, dbs_cw2):
    _rubric(a)
    _register(a, dbs_cohort)

print(f"""
Seed complete (setup only — NO submissions, marks, reviews or self-assessments).
  Courses      : {Course.objects.count()}  (INF2-SEPP, INF3-ADS, INF4-DBS)
  Users        : {User.objects.count()}  ({len(students)} students)
  Assignments  : {Assignment.objects.count()}  (all deadline 15 Aug 2026, open)
    INF2-SEPP : CW1 Individual · CW2 Group · CW3 Peer review
    INF3-ADS  : CW1 Individual · CW2 Peer review
    INF4-DBS  : CW1 Individual · CW2 Group
  Groups       : SEPP 4 teams (4/4/3/3; stud015–018 ungrouped), DBS 2 teams (4/4)

Log in (password = SEED_DEMO_PASSWORD, default Test1234!):
  acad001  Dr Alan Whitfield   (Academic)
  mark001  Ben Carter          (Marker — does M1–M5)
  ta001    Marco Reyes         (TA)
  stud001  Amara Okafor        (Student, SEPP Team 1)
""")
