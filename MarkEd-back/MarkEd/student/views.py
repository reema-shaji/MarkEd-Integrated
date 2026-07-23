import ast
import datetime
import json

from django.core.mail import send_mail
from django.http import HttpResponseRedirect, JsonResponse
from django.shortcuts import render
from django.db.models import F
import MarkEd.utils as utils
from MarkEd.models import StudentSubmission, Submission, Course2Student, Assignment, User, AssignmentElement, SubmissionElement, Job, Course, Notification, PeerReviewAllocation

from django.contrib import messages

from django.conf import settings


class StudentSubmissionPageInfo(object):
    def __init__(self, course_code, course_name, assignment, assignment_id, date_due, date_submission, status, mark,
                 submission_id, description=None):
        self.course_code = course_code
        self.course_name = course_name
        self.assignment = assignment
        self.assignment_id = assignment_id
        self.date_due = date_due
        self.date_submission = date_submission
        self.status = status
        self.mark = mark
        self.submission_id = submission_id

# it goes through all submissions for a <given user for a given assisgnment...>>
# and tries to get the status of what's going on
def get_submission_status(submission):
    related_latest_submission_elements = SubmissionElement.objects.filter(submission=submission)

    submission_status = "Submitted"
    for related_latest_submission_element in related_latest_submission_elements:
        submission_elem_status = related_latest_submission_element.get_status_display()
        if submission_elem_status == "Marking":
            submission_status = "Marking"
        elif submission_elem_status == "Finished":
            submission_status = "Finished"
            return submission_status
    return submission_status


def home(request):
    if not request.session.get('is_login', None):
        return HttpResponseRedirect("/login")
    if request.session.get('user_role', None) != "Student":
        return HttpResponseRedirect("/")
    
    context = {}

    # Get all courses the student is enrolled in
    related_courses = Course2Student.objects.filter(student_id=request.session.get('user_id', None))
    
    # Get all assignments for these courses
    related_assignments = Assignment.objects.filter(
        course__in=[relation.course for relation in related_courses]
    )

    finished_assignments = []
    not_finished_assignments = []
    not_started_assignments = []

    for assignment in related_assignments:
        # Get the latest submission for this assignment if it exists
        latest_submission = Submission.objects.filter(
            student_id=request.session.get('user_id', None),
            assignment=assignment
        ).last()

        # Base assignment info
        assignment_info = {
            'page': StudentSubmissionPageInfo(
                course_code=assignment.course.courseCode,
                course_name=assignment.course.courseName,
                assignment=assignment.assignmentTitle,
                assignment_id=assignment.id,
                date_due=assignment.deadline,
                date_submission=latest_submission.submissionDateTime if latest_submission else "-",
                status=None,
                mark="-",
                submission_id=latest_submission.pk if latest_submission else None,
            ),
            'date': assignment.deadline,
            'is_peer_review': assignment.assignment_type == 'PEER_REVIEW'
        }

        if latest_submission:
            # Get submission elements and status
            submission_status = get_submission_status(latest_submission)
            related_submission_elements = SubmissionElement.objects.filter(submission=latest_submission)
            
            assignment_info['page'].status = submission_status

            if submission_status == "Finished":
                # Calculate total score
                current_score = sum(elem.score or 0 for elem in related_submission_elements)
                total_score = sum(elem.element.maxInput for elem in related_submission_elements)
                
                if total_score > 0:
                    percentage = int(current_score / total_score * 100)
                    assignment_info['page'].mark = f"{current_score}({percentage}%)"
                
                finished_assignments.append(assignment_info)
            else:
                not_finished_assignments.append(assignment_info)
        else:
            not_started_assignments.append(assignment_info)

        # Add peer review information if applicable
        if assignment.assignment_type == 'PEER_REVIEW':
            # Get peer reviews assigned to this student
            peer_reviews = PeerReviewAllocation.objects.filter(
                reviewer_id=request.session.get('user_id'),
                assignment=assignment
            )
            assignment_info['peer_reviews_total'] = assignment.reviews_per_student
            assignment_info['peer_reviews_completed'] = peer_reviews.filter(status='COMPLETED').count()
            assignment_info['peer_review_deadline'] = assignment.review_deadline

    # Sort assignments by deadline
    for assignment_list in [not_started_assignments, not_finished_assignments, finished_assignments]:
        assignment_list.sort(key=lambda x: x['date'])

    context['page_info'] = not_started_assignments + not_finished_assignments + finished_assignments
    return render(request, 'student/home.html', context)


def submit(request):
    if not request.session.get('is_login', None):
        return HttpResponseRedirect("/login")
    if request.session.get('user_role', None) != "Student":
        return HttpResponseRedirect("/")
    context = {}
    if request.method == "POST":
        if 'assignment' in request.GET:
            if request.FILES.get('submit_file'):

                StudentSubmission.objects.filter(user=request.session.get('user_id'), assignment=request.GET['assignment']).update(maximum_submissions=F('maximum_submissions') - 1)
                # DEBUG
                utils.dump_queries()
                # DEBUG
                current_user = User.objects.get(userNumber=request.session.get('user_number', None))
                current_assignment = Assignment.objects.get(pk=request.GET['assignment'])
                new_submission = Submission(student=current_user, assignment=current_assignment,
                                            submissionFile=request.FILES.get('submit_file'))
                new_submission.save()
                # potential error in failing to create an submissionelement??
                related_assignment_elements = AssignmentElement.objects.filter(assignment=current_assignment)
                for related_assignment_element in related_assignment_elements:
                    new_submission_element = SubmissionElement(submission=new_submission,
                                                               element=related_assignment_element)
                    new_submission_element.save()

                messages.success(request, 'Your file was uploaded successfully!')
                send_email_helper(current_user, request.FILES.get('submit_file'), current_assignment)  # send confirmation email.
                return HttpResponseRedirect("/student/home")
            else:
                # TODO: fix bug.
                context["message"] = "File cannot be empty!"
                return render(request, 'student/submit.html', context)
        else:
            return HttpResponseRedirect("/student/home")
    else:
        if 'assignment' in request.GET:

            # TODO: query whether the submission configuration has been added, if not, load it from UserModule

            current_course = Assignment.objects.get(pk=request.GET['assignment']).course
            current_relation = Course2Student.objects.get(course=current_course,
                                                          student_id=request.session.get('user_id', None))
            context['assignment_id'] = request.GET['assignment']
            current_assignment = Assignment.objects.get(pk=request.GET['assignment'])
            context['current_assignment'] = current_assignment
            context['current_course'] = current_course
            could_submit = True
            related_submissions = Submission.objects.filter(student_id=request.session.get('user_id', None),
                                                            assignment=current_assignment.id).order_by('-submissionDateTime')
            context['is_any_submission'] = False

            current_student = StudentSubmission.objects.get(user=request.session.get('user_id'),assignment=request.GET['assignment'])

            context['student_submission'] = current_student
            context['files'] = list(range(1, current_student.file_number + 1))

            if related_submissions.count() > 0:
                # need to show the submissions in reverse order
                context['is_any_submission'] = True
                # naming confusion
                context['related_submissions'] = related_submissions
                context['submissions_count'] = related_submissions.count()
                context['submission'] = related_submissions.first()
                if get_submission_status(related_submissions.last()) != "Submitted":
                    could_submit = False
            if could_submit:
                return render(request, 'student/submit.html', context)
            else:
                return HttpResponseRedirect("/student/home")
        else:
            # I think it returns 'home' if there are no current courseworks to submit. Better with a message
            # added a message.
            print("nothing to submit.")
            messages.success(request, "You currently don't have any open assignments!")
            return HttpResponseRedirect("/student/home")


def feedback(request):
    if not request.session.get('is_login', None):
        return HttpResponseRedirect("/login")
    if request.session.get('user_role', None) != "Student":
        return HttpResponseRedirect("/")
    context = {}
    if 'submission' in request.GET:
        current_submission = Submission.objects.get(pk=request.GET['submission'])
        if current_submission.student.pk == request.session.get('user_id', None):
            if get_submission_status(current_submission) == "Finished":
                context['submission'] = current_submission
                context['related_submissions'] = Submission.objects.filter(assignment=current_submission.assignment,
                                                                           student=current_submission.student).order_by('submissionDateTime').reverse()
                related_submission_elements = SubmissionElement.objects.filter(submission=current_submission)
                current_score = 0
                current_total_score = 0
                for related_submission_element in related_submission_elements:
                    if related_submission_element.feedback:
                        try:
                            related_submission_element.feedback = json.loads(related_submission_element.feedback)
                        except:
                            related_submission_element.feedback = {"start": related_submission_element.feedback,
                                                                   "middle": "", "end": ""}
                    if related_submission_element.score:
                        # refactor this for calculating grades.
                        current_score += related_submission_element.score
                    related_submission_element.score = str(related_submission_element.score) + "(" + str(
                        related_submission_element.element.maxInput) + ")"
                    current_total_score += related_submission_element.element.maxInput
                context['mark_info'] = str(current_score) + "/" + str(current_total_score) + "(" + str(
                    int(current_score / current_total_score * 100)) + "%)"
                context['submission_elements'] = related_submission_elements
                return render(request, 'student/feedback.html', context)
    return HttpResponseRedirect("/student/home")


# send email
def addSubEmail(request):
    current_assignment = Assignment.objects.get(pk=request.GET['assignment'])
    jobs_relation = Job.objects.filter(assignment=current_assignment)
    for job in jobs_relation:
        if job.task == 4 and job.status == 0:
            title = job.title
            context = job.context
            if job.receiver == 1:
                users = User.objects.filter(role='A')
                for user in users:
                    send_mail(title, context, request.POST.get('useremail'), [user.userEmail],
                              fail_silently=False)
            elif job.receiver == 2:
                users = User.objects.filter(role='M')
                for user in users:
                    send_mail(title, context, request.POST.get('useremail'), [user.userEmail],
                              fail_silently=False)
            else:
                users = User.objects.filter(role='A')
                for user in users:
                    send_mail(title, context, request.POST.get('useremail'), [user.userEmail],
                              fail_silently=False)
                users2 = User.objects.filter(role='M')
                for user in users2:
                    send_mail(title, context, request.POST.get('useremail'), [user.userEmail],
                              fail_silently=False)


# refactor this into one.
def send_email_helper(current_user, filename, assignment):
    # confirmation email
    file_name = filename
    assignment_name = assignment.assignmentTitle
    course_name = Course.objects.get(id=assignment.course_id).courseName
    subject = f'Your file {file_name} was uploaded successfully!'
    message = f'You have made a submission for assignment "{assignment_name}" in the course "{course_name}"!'
    user_email = User.objects.get(id=current_user.id).userEmail
    send_mail(subject, message, settings.EMAIL_HOST_USER, ['s1953043@ed.ac.uk', user_email])
    # send
    print("email sent.")

def notification(request):
    if not request.session.get('is_login', None) or request.session.get('user_role', None) != "Student":
        return HttpResponseRedirect("/")

    context = {'notifications': []}
    notifs = Notification.objects.filter(receiver_id=request.session.get('user_id')).order_by('-date')
    for notif in notifs:
        message = "Marks are released for " + notif.assignment.course.courseName + " " + notif.assignment.assignmentTitle + "."
        submission = Submission.objects.filter(assignment=notif.assignment,
                                  student=notif.receiver).order_by('submissionDateTime').last()
        context['notifications'].append(NotifObj(notif.date, "System", message, submission.id))
    return render(request, 'student/notification.html', context)


def get_file(request):
    if not request.session.get('is_login', None) or request.session.get('user_role', None) != "Student":
        return HttpResponseRedirect("/")

    user_id = request.session.get('user_id')
    fileId = request.POST.get('fileId')
    assignment_id = request.POST.get('assignment')

    current_student = StudentSubmission.objects.get(user=request.session.get('user_id'),assignment=assignment_id)

    mydict = ast.literal_eval(current_student.files)
    context = {}

    context['format'] = mydict['file' + str(fileId)][0]['format']
    context['size'] = mydict['file' + str(fileId)][1]['size']
    context['name'] = mydict['file' + str(fileId)][2]['name']

    print('-------------------')
    print(context['format'])
    

    return JsonResponse(context)

class NotifObj(object):
    def __init__(self, date, sender, subject, assignment):
        self.date = date
        self.sender = sender
        self.subject = subject
        self.assignment_id = assignment

