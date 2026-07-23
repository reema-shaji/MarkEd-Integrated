"""
Demo seeder for MarkEd (Tomas / peer-feedback branch, v3.0.0 SPA + API).

Run (stack must be up via docker compose):
    docker compose exec -T backend python manage.py shell -c "exec(open('seed_demo.py').read())"

Idempotent. Seeds the core data so the legacy academic home works and the SPA
has a course + peer-review assignment to show. Everyone's password: Test1234!
NOTE: the full peer-review cycle (PDF upload/annotate) additionally needs file
storage (MinIO/S3), which is not configured in a keys-free local run.
"""
from MarkEd.models import (
    User, Course, Course2Marker, Course2Student, Assignment, Module, UserModule, StudentSubmission,
)
from django.contrib.auth.hashers import make_password
from django.utils import timezone
import datetime

PW = make_password("Test1234!")
FILES_CFG = "{'file1': [{'format': 'pdf'}, {'size': '10'}, {'name': 'submission'}]}"
MODULE_CFG = (
    "{'name':'any','size':10,'format':'pdf,doc,docx,zip','number':'1','extension':'5',"
    "'maximumTime':'4','lateSubmission':1,'multipleSubmission':1,'date':'12/17/2024',"
    "'file1':[{'format':'pdf'},{'size':'10'},{'name':'submission'}],"
    "'file2':[{'format':'pdf'},{'size':'10'},{'name':'submission'}]}"
)

Module.objects.update_or_create(id=1, defaults=dict(
    name="Submission Module", introduction="submission settings", author="MarkEd Teams",
    icon_address="modules/submission_module.png", configuration=MODULE_CFG,
    basic=0, configuration_path="/submission_module.html"))


def make_user(num, name, role):
    u, _ = User.objects.get_or_create(
        userNumber=num, defaults=dict(userName=name, userEmail=num + "@test.com", role=role))
    u.password, u.isValid, u.role, u.must_change_password = PW, True, role, False
    u.save()
    return u


acad = make_user("admin1", "Admin Academic", "A")
students = [make_user("stu1", "Sam Student", "S")]
students += [make_user("stud%03d" % i, n + " Student", "S")
             for i, n in enumerate(["Alice", "Bob", "Carol", "Dan", "Eve", "Frank", "Grace", "Heidi"], 1)]

course, _ = Course.objects.get_or_create(courseCode="INF1-DEMO", defaults=dict(courseName="Demo Peer Feedback Course"))
Course2Marker.objects.get_or_create(course=course, marker=acad)
Course2Marker.objects.filter(course=course, marker=acad).update(
    canCreateAssignment=True, submissionPermission=2, markingPermission=2, structurePermission=2, teamPermission=2)
for s in students:
    Course2Student.objects.get_or_create(course=course, student=s)

now = timezone.now()
a, _ = Assignment.objects.get_or_create(
    course=course, assignmentTitle="Peer Review Essay",
    defaults=dict(assignmentWebsite="https://example.com",
                  assignmentDescription="A formative essay with peer review.",
                  deadline=now + datetime.timedelta(days=7), status=1,
                  assignment_type="PEER_REVIEW", reviews_per_student=2,
                  review_deadline=now + datetime.timedelta(days=14), release_date=now))
a.assignment_type = "PEER_REVIEW"
a.save()

UserModule.objects.update_or_create(user=acad, module_id=1, assignment=a,
                                    defaults=dict(status=0, configuration=MODULE_CFG))
for s in students:
    StudentSubmission.objects.update_or_create(
        user=s, assignment=a,
        defaults=dict(is_multisubmission_allowed=1, maximum_submissions=5,
                      is_late_submission=1, file_number=1, files=FILES_CFG))

print("Seeded OK (Tomas / peer feedback)")
print("  course:", course.courseCode, "(id %d)" % course.id, "| peer assignment id %d" % a.id)
print("  marker canCreateAssignment:", Course2Marker.objects.get(course=course, marker=acad).canCreateAssignment)
print("  students enrolled:", Course2Student.objects.filter(course=course).count())
print("  login: admin1 / Test1234!   students stu1, stud001-008 / Test1234!")
