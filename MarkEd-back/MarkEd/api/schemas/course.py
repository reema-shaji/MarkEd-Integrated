from ninja import Schema

class CourseSchema(Schema):
    id: int
    courseName: str
    courseCode: str
    numberOfEnrolledStudents: int 