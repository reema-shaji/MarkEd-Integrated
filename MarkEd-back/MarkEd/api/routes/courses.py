from ninja import Router
from django.db import models
from ..schemas.course import CourseSchema
from ..decorators import require_auth, check_permissions
from ..permissions import IsCourseStaffFromAssignment
from ...models import Course

router = Router()

@router.get("/{course_id}", response=CourseSchema, operation_id="getCourse")
@require_auth(roles=['Academic', 'Marker', 'TA'])
@check_permissions(IsCourseStaffFromAssignment)
def get_course(request, course_id: int):
    return Course.objects.annotate(
        numberOfEnrolledStudents=models.Count('course2student')
    ).get(id=course_id) 