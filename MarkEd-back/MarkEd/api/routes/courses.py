from typing import List

from ninja import Router
from django.db import models
from ..schemas.course import CourseSchema
from ..decorators import require_auth, check_permissions
from ..permissions import IsCourseStaffFromAssignment
from ...models import Course

router = Router()


@router.get("/", response=List[CourseSchema], operation_id="getMyCourses")
@require_auth()
def list_my_courses(request):
    """Courses the current user belongs to, for the sidebar course switcher.

    All three source codebases scope every view to a course; the unified
    navigation surfaces that as an explicit switcher (Design PRD §3.1).
    """
    if request.user_role == 'Student':
        courses = Course.objects.filter(course2student__student_id=request.user_id)
    else:
        courses = Course.objects.filter(course2marker__marker_id=request.user_id)
    return (
        courses.distinct()
        .annotate(numberOfEnrolledStudents=models.Count('course2student', distinct=True))
        .order_by('courseCode')
    )


@router.get("/{course_id}", response=CourseSchema, operation_id="getCourse")
@require_auth(roles=['Academic', 'Marker', 'TA'])
@check_permissions(IsCourseStaffFromAssignment)
def get_course(request, course_id: int):
    return Course.objects.annotate(
        numberOfEnrolledStudents=models.Count('course2student')
    ).get(id=course_id) 