import ast
import json
import pickle
import random
import statistics
from datetime import datetime, date, timezone, timedelta

from django.contrib import messages
from django.shortcuts import render, redirect
from django.db.models import Q, Sum
from django.db import transaction
from MarkEd.models import Course2Marker, Assignment, Course2Student, Module, StudentSubmission, Submission, AssignmentElement, SubmissionElement, \
    User, Job, Notification, Markscheme, Questionpaper, Feedback, Reaction, Tag, SavedFeedback, Course, Criteria, \
    Element, SubmissionCriteria, UserModule
from MarkEd.student.views import get_submission_status
from django.core.exceptions import ObjectDoesNotExist
from django.core.mail import send_mail
from django.http import HttpResponse, HttpResponseRedirect, JsonResponse
from django.shortcuts import render
from django.utils import timezone
from django.template import RequestContext

from MarkEd.generative_feedback.generate_feedback import Marker, Student, FeedbackGenerator, parse_pdf


from datetime import datetime, date
from django.conf import settings
from concurrent.futures import ThreadPoolExecutor, as_completed
from MarkEd.models import Course2Marker, Assignment, Course2Student, Submission, AssignmentElement, SubmissionElement, \
    User, Job, Notification, Markscheme, Questionpaper, Feedback, Reaction, Tag, SavedFeedback, Course, TimeRecord, \
    TimeDuration, TagCustom

# Module id 1 is the built-in "submission module" (the row seeded in the Module table).
SUBMISSION_MODULE_ID = 1


class MarkerHomePageInfo(object):
    def __init__(self, course):
        self.course = course
        self.assignments = []


class MarkerMarkingPageInfo(object):
    def __init__(self, tags, student_number, attempts, last_submission, elements_score, elements_feedback,
                 submission_id, status, total_score):
        self.tags = tags
        self.student_number = student_number
        self.attempts = attempts
        self.last_submission = last_submission
        self.elements_score = elements_score
        self.elements_feedback = elements_feedback
        self.submission_id = submission_id
        self.status = status
        self.total_score = total_score


class MarkerMarkPageInfo(object):
    def __init__(self, student_number, elements_score, submission_id):
        self.student_number = student_number
        self.elements_score = elements_score
        self.submission_id = submission_id


class TimeDeltaBreakdown(object):
    def __init__(self, avg_timedelta):
        self.hours = (avg_timedelta.seconds // 60) // 60
        self.minutes = (avg_timedelta.seconds // 60) % 60
        self.seconds = avg_timedelta.seconds % 60

    def print_s(self):
        print("self.seconds", self.seconds)


def is_number(s):
    try:
        float(s)
        return True
    except ValueError:
        pass
    try:
        import unicodedata
        unicodedata.numeric(s)
        return True
    except (TypeError, ValueError):
        pass
    return False


def home(request):
    if not request.session.get('is_login', None):
        return HttpResponseRedirect("/login")
    context = {}
    context['page_info'] = []
    if request.session.get('user_role', None) == "Student":
        return HttpResponseRedirect("/student/home")
    else:
        course_marker_relations = Course2Marker.objects.filter(marker_id=request.session.get('user_id', None))
        for course_marker_relation in course_marker_relations:
            current_course = course_marker_relation.course
            info = MarkerHomePageInfo(current_course)
            related_assignments = Assignment.objects.filter(course=current_course)
            for related_assignment in related_assignments:
                info.assignments.append(related_assignment)
            context['page_info'].append(info)
        context['can_create_assignment'] = course_marker_relation.canCreateAssignment
        return render(request, 'teacher/home.html', context)


class notification(object):
    def __init__(self, date, sender, subject, desc):
        self.date = date
        self.sender = sender
        self.subject = subject
        self.desc = desc


def notify(request, context):
    currentCourses = Course2Marker.objects.filter(marker_id=request.session.get('user_id', None))

    context['new'] = []
    context['old'] = []
    notifies = Notification.objects.filter(receiver_id=request.session.get('user_id'))
    for notify in notifies:
        if notify.status == 0:
            if notify.subject == 4:
                message = "Reminder to complete marking for" + " " + notify.assignment.course.courseName + " " + notify.assignment.assignmentTitle + ". " + "Time left 1 day."
                link = "/teacher/assignment?page=marking&assignment=" + str(notify.assignment.pk)
                info = notification(notify.date, "System", message, link)
                context['new'].append(info)
            elif notify.subject == 5:
                message = "Reminder to complete marking for" + " " + notify.assignment.course.courseName + " " + notify.assignment.assignmentTitle + ". " + "Time left 2 days."
                link = "/teacher/assignment?page=marking&assignment=" + str(notify.assignment.pk)
                info = notification(notify.date, "System", message, link)
                context['new'].append(info)
            elif notify.subject == 1:
                message = "Reminder to moderate" + " " + notify.assignment.course.courseName + " " + notify.assignment.assignmentTitle + ". "

                link = "/teacher/assignment?page=marking&assignment=" + str(notify.assignment.pk)
                info = notification(notify.date, "System", message, link)
                context['new'].append(info)
            elif notify.subject == 2:
                message = "Reminder to help" + " " + notify.assignment.course.courseName + " " + notify.assignment.assignmentTitle + ". "
                link = "/teacher/assignment?page=marking&assignment=" + str(notify.assignment.pk)
                info = notification(notify.date, "System", message, link)
                context['new'].append(info)
        context['new_number'] = len(context['new'])

        if notify.subject == 4:
            message = "Reminder to complete marking for" + " " + notify.assignment.course.courseName + " " + notify.assignment.assignmentTitle + ". " + "Time left 1 day."
            link = "/teacher/assignment?page=marking&assignment=" + str(notify.assignment.pk)
            info = notification(notify.date, "System", message, link)
            context['old'].append(info)
        elif notify.subject == 5:
            message = "Reminder to complete marking for" + " " + notify.assignment.course.courseName + " " + notify.assignment.assignmentTitle + ". " + "Time left 2 days."
            link = "/teacher/assignment?page=marking&assignment=" + str(notify.assignment.pk)
            info = notification(notify.date, "System", message, link)
            context['old'].append(info)
        elif notify.subject == 1:
            message = "Reminder to moderate" + " " + notify.assignment.course.courseName + " " + notify.assignment.assignmentTitle + ". "

            link = "/teacher/assignment?page=marking&assignment=" + str(notify.assignment.pk)
            info = notification(notify.date, "System", message, link)
            context['old'].append(info)
        elif notify.subject == 2:
            message = "Reminder to help" + " " + notify.assignment.course.courseName + " " + notify.assignment.assignmentTitle + ". "
            link = "/teacher/assignment?page=marking&assignment=" + str(notify.assignment.pk)
            info = notification(notify.date, "System", message, link)
            context['old'].append(info)


def dismiss(request, context):
    currentCourses = Course2Marker.objects.filter(marker_id=request.session.get('user_id', None))

    notifies = Notification.objects.filter(receiver_id=request.session.get('user_id'))
    for notify in notifies:
        if notify.status == 0:
            notify.status = 1
            notify.save()


def assignment(request):
    if not request.session.get('is_login', None):
        return HttpResponseRedirect("/login")
    if request.session.get('user_role', None) == "Student":
        return HttpResponseRedirect("/student/home")
    context = {}

    if 'assignment' in request.GET and request.method == "POST" and request.GET.get('action') == 'uploadMarkscheme':
        return uploadMarkscheme(request)

    if 'assignment' in request.GET and request.method == "POST" and request.GET.get('action') == 'uploadQuestionpaper':
        return uploadQuestionpaper(request)

    if 'page' in request.GET and 'assignment' in request.GET:

        current_assignment = Assignment.objects.get(pk=request.GET['assignment'])
        current_relation = Course2Marker.objects.get(course=current_assignment.course,
                                                     marker_id=request.session.get('user_id', None))
        context['assignment'] = current_assignment
        context['mark_permission'] = current_relation.markingPermission
        related_assignments = Assignment.objects.filter(course=current_assignment.course)
        context['other_related_assignments'] = []


        total_students = Course2Student.objects.filter(course=current_assignment.course).count()
        submitted_students = Submission.objects.filter(assignment=request.GET['assignment']).values('student_id').distinct().count()

        context['submitted'] = submitted_students
        context['total'] = total_students

        modules = Module.objects.all()

        temp_res = UserModule.objects.filter(user = request.session.get('user_id', None), assignment=request.GET['assignment'])
        
        active_modules = []
        inactive_modules = []
        default_modules = []

        for module in modules:
            flag = True
            if module.basic == 0 and len(temp_res) == 0:
                UserModule.objects.create(status=0, configuration=module.configuration, module_id=module.id, user_id=request.session.get('user_id'), assignment_id=request.GET['assignment'])
                temp = UserModule.objects.get(user = request.session.get('user_id', None), module=module.id, assignment=request.GET['assignment'])
                default_modules.append({"user": temp, "module": module})
                continue
            for temp in temp_res:
                if module.id == temp.module_id:
                    if temp.status == 0:
                        default_modules.append({"user": temp, "module": module})
                    elif temp.status == 1:
                        active_modules.append({"user": temp, "module": module})
                    else:
                        inactive_modules.append(module)
                    
                    flag = not flag
                    break
            
            if flag:
                inactive_modules.append(module)

        context['active_modules'] = active_modules

        context['inactive_modules'] = inactive_modules

        context['default_modules'] = default_modules

        email_deadline(request, context)
        notify(request, context)

        configuration = UserModule.objects.get(user=request.session.get('user_id'), module=SUBMISSION_MODULE_ID, assignment=request.GET['assignment'])
        mydict = ast.literal_eval(configuration.configuration)
        context['configuration'] = mydict
        context['number'] = mydict.get('number', None)
        context['file'] = mydict.get('file1', None)

        for related_assignment in related_assignments:
            if related_assignment != current_assignment:
                context['other_related_assignments'].append(related_assignment)
        if request.GET['page'] == "dashboard":
            set_dashboard_page_info(request, context)
            return render(request, 'teacher/dashboard.html', context)
        elif request.GET['page'] == "notification":
            notify(request, context)
            return render(request, 'teacher/notification.html', context)
        elif request.GET['page'] == "dismiss":
            dismiss(request, context)
            notify(request, context)
            page = request.GET['page2']
            if page == "dashboard":
                set_dashboard_page_info(request, context)
                return render(request, 'teacher/dashboard.html', context)
            elif page == "submission":
                set_submissions_page_info(request, context)
                return render(request, 'teacher/submissions.html', context)
            elif page == "jobs":
                set_jobs_page_info(request, context)
                return render(request, 'teacher/jobs.html', context)
            elif page == "setup":
                set_setup_page_info(request, context)
                return render(request, 'teacher/setup.html', context)
            elif page == "modules":
                set_modules_page_info(context)
                return render(request, 'teacher/modules.html', context)
            elif page == "marking":
                if current_relation.markingPermission != 0:
                    set_marking_page_info(context, request.GET['assignment'])
                    context['user_role'] = User.objects.get(pk=request.session.get('user_id')).role
                    bulk_assign_marks(request, context)
                    set_marking_page_info(context, request.GET['assignment'])
                    return render(request, 'teacher/marking.html', context)
                else:
                    return HttpResponseRedirect("/")
        elif request.GET['page'] == "viewAll":
            dismiss(request, context)
            notify(request, context)
            return render(request, 'teacher/notification.html', context)
        elif request.GET['page'] == "submissions":
            set_submissions_page_info(request, context)
            return render(request, 'teacher/submissions.html', context)
        elif request.GET['page'] == "able":
            set_submissions_able(context)
            set_submissions_page_info(request, context)
            return render(request, 'teacher/submissions.html', context)
        elif request.GET['page'] == "child":
            set_child_page_info(context)
            return render(request, 'teacher/sub_child.html', context)
        elif request.GET['page'] == "assignTask":
            assignTask(request, context)
            set_submissions_page_info(request, context)
            return render(request, 'teacher/submissions.html', context)
        elif request.GET['page'] == "jobs":
            set_jobs_page_info(request, context)
            return render(request, 'teacher/jobs.html', context)
        elif request.GET['page'] == "deleteJob":
            deleteJob(request, context)
            set_jobs_page_info(request, context)
            return render(request, 'teacher/jobs.html', context)
        elif request.GET['page'] == "send":
            print("titit")
            sendEmail(request, context)
            set_jobs_page_info(request, context)
            return render(request, 'teacher/jobs.html', context)
        elif request.GET['page'] == "setup":
            set_setup_page_info(request, context)
            return render(request, 'teacher/setup.html', context)
        elif request.GET['page'] == "permission":
            team = User.objects.get(pk=request.GET['user'])
            context["team"] = team
            set_setup_page_info(request, context)
            permission_page(request, context)
            return render(request, 'teacher/permission.html', context)
        elif request.GET['page'] == "modules":
            set_modules_page_info(context)
            return render(request, 'teacher/modules.html', context)
        elif request.GET['page'] == "marking":
            if current_relation.markingPermission != 0:
                set_marking_page_info(context, request.GET['assignment'])
                context['user_role'] = User.objects.get(pk=request.session.get('user_id')).role
                bulk_assign_marks(request, context)
                set_marking_page_info(context, request.GET['assignment'])
                return render(request, 'teacher/marking.html', context)
            else:
                return HttpResponseRedirect("/")
        elif request.GET['page'] == "assignment":
            if request.GET.get('action') == 'uploadMarkscheme':
                return uploadMarkscheme(request, context)

    return HttpResponseRedirect("/")


def deleteJob(request, context):
    Job.objects.get(pk=request.GET['item']).delete()


class UserInfo(object):
    def __init__(self, user):
        self.user = user


class SubmissionInfo(object):
    def __init__(self, total_number, complete_number, assign_number, help_number, your_complete):
        self.total_submissions = total_number
        self.complete_number = complete_number
        self.assign_number = assign_number
        self.help_number = help_number
        self.your_complete = your_complete


def set_dashboard_page_info(request, context):
    context['teams_info'] = []
    context['current_page'] = "dashboard"

    current_assignment = context['assignment']
    course_marker_relations = Course2Marker.objects.filter(course=current_assignment.course)
    for course_marker_relation in course_marker_relations:
        marker = course_marker_relation.marker
        info = UserInfo(marker)
        context['teams_info'].append(info)

    context['student_info'] = []
    course_student_relations = Course2Student.objects.filter(course=current_assignment.course)
    for course_student_relation in course_student_relations:
        student = course_student_relation.student
        info = UserInfo(student)
        context['student_info'].append(info)
    context['student_number'] = course_student_relations.count()

    context['submission_info'] = []
    submission_relations = Submission.objects.filter(assignment=current_assignment)
    course_students = Course2Student.objects.filter(course=current_assignment.course)

    total_submissions = submission_relations.values('student').distinct().count()
    complete_number = 0
    assign_number = 0
    # get use all submission ids from before and for those ones, count the number of need_help in submission element
    help_number = 0
    your_complete = 0

    context['box'] = []
    for course_student in course_students:
        jihe = submission_relations.filter(student=course_student.student)
        jihe = jihe.order_by("submissionDateTime")
        info = jihe.last()
        if get_submission_status(info) == "Finished":
            complete_number = complete_number + 1
            element_relations = SubmissionElement.objects.filter(submission=info)
            if len(element_relations) != 0:
                sign = 0
                for element_relation in element_relations:
                    if element_relation.marker_id == request.session['user_id']:
                        sign = 1
                    else:
                        sign = 0
                if sign == 1:
                    assign_number = assign_number + 1
                    your_complete = your_complete + 1

        else:
            element_rels = SubmissionElement.objects.filter(submission=info)
            if len(element_rels) != 0:
                sign1 = 0
                sign2 = 0
                for element_rel in element_rels:
                    if element_rel.marker_id == request.session['user_id']:
                        sign1 = 1
                    else:
                        sign1 = 0
                    if element_rel.needHelp == 1:
                        sign2 = 1
                    else:
                        sign2 = 0
                if sign1 == 1:
                    assign_number = assign_number + 1

    submission_ids_for_assignment = submission_relations.values('id')

    help_number = SubmissionElement.objects.filter(submission_id__in=submission_ids_for_assignment,
                                                   needHelp=1).distinct().count()

    subinfo = SubmissionInfo(total_submissions, complete_number, assign_number, help_number, your_complete)
    context['submission_info'] = subinfo

    if total_submissions == 0:
        context['total_progress'] = 0
    else:
        context['total_progress'] = round(complete_number / total_submissions * 100, 2)

    if assign_number == 0:
        context['your_progress'] = 0
    else:
        context['your_progress'] = round(your_complete / assign_number * 100, 2)
    if course_student_relations.count() == 0:
        context['percent_student_submitted'] = 0
    else:
        context['percent_student_submitted'] = round(total_submissions / course_student_relations.count() * 100, 2)

    # DONE: grade stats
    set_grade_statistics(context, submission_ids_for_assignment)

    # marker breakdown
    set_marker_stats(context, course_marker_relations, subinfo.total_submissions - subinfo.complete_number,
                     submission_ids_for_assignment)


def set_marker_stats(context, course_marker_relations, remaining, submitted_to_assignment):
    # set context pie labels
    markers_on_course = list(course_marker_relations.values_list('marker_id', flat=True))
    names_on_course = ['remaining'] + [User.objects.get(id=marker).userName for marker in markers_on_course]
    context['ids_on_course'] = markers_on_course
    context['names_on_course'] = names_on_course

    data = []
    remaining = remaining
    data.insert(0, remaining)
    for marker_id in markers_on_course:
        # set context pie data
        marker_count = SubmissionElement.objects.filter(marker_id=marker_id, submission_id__in=submitted_to_assignment,
                                                        score__isnull=False).values('submission_id').distinct().count()
        data.append(marker_count)

    context['data'] = data

    # have to set the remaining at index 0.

    # set context pie colour


def set_grade_statistics(context, submission_ids_for_assignment):
    hist_data = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    grade_values = []
    percent_grades = []
    # get the students on course
    current_assignment = context['assignment']
    students_course = Course2Marker.objects.filter(course=current_assignment.course)
    all_assignment_scores = SubmissionElement.objects.filter(submission_id__in=submission_ids_for_assignment,
                                                             score__isnull=False)

    for submission_id in submission_ids_for_assignment:
        ## check if there's feedback.
        found_feedback = all_assignment_scores.filter(submission_id=submission_id['id'])
        if len(found_feedback) == 0:
            continue
        ### get their grade if grade.
        # get markscheme
        markscheme = AssignmentElement.objects.filter(assignment_id=current_assignment.pk)
        max_points = (list(markscheme.values("maxInput").aggregate(Sum("maxInput")).values()))[0]
        scored_points = 0
        for criterion in markscheme:
            # only if not finished marking, break, don't count stats.
            try:
                scored_element = found_feedback.get(element_id=criterion.pk)
            except ObjectDoesNotExist:
                break
            scored_points += scored_element.score

        # student final points
        percent_scored = (scored_points / max_points) * 100
        percent_grades.append(percent_scored)

        ### get the floor of the grade and divided by 10? <- increase that position in hist_data
        score_bracket = int(percent_scored // 10) if percent_scored < 100 else 9
        ### append to grade_values
        grade_values.append(scored_points)
        ### add to hist data
        hist_data[score_bracket] += 1

    # add hist_data to context
    context['hist_data'] = hist_data
    # compute and add the remaining to context.
    # get stats from grade_values <- mean
    if len(percent_grades) < 1:
        context['mean'] = 'n/a'
        context['median'] = 'n/a'
    else:
        context['mean'] = round(statistics.mean(percent_grades), 1)
        # median
        context['median'] = round(statistics.median(percent_grades), 1)
        # std dev

    if len(percent_grades) < 2:
        context['std_dev'] = 'n/a'
    else:
        context['std_dev'] = round(statistics.stdev(percent_grades), 2)

    # context passed by reference and so no need to return.


class SubmissionBox(object):
    def __init__(self, id, studentId, student, sub_time, days_late, attempts, marker):
        self.id = id
        self.studentId = studentId
        self.student = student
        self.sub_time = sub_time
        self.days_late = days_late
        self.attempts = attempts
        self.marker = marker


def calc_days_late(submissions):
    if submissions is None:
        return "NS"
    last_submission = submissions.order_by('submissionDateTime').last()
    last_submitted_date = last_submission.submissionDateTime
    deadline = Assignment.objects.filter(id=last_submission.assignment.id).last().deadline
    if last_submitted_date < deadline:
        return 0
    days_late = (last_submitted_date - deadline).days
    return days_late


def set_submissions_page_info(request, context):
    context['current_page'] = "submissions"

    current_assignment = context['assignment']

    # TODO: refactor this into submission control and submission table or something.
    if current_assignment.status == 1:
        context['able'] = "Enabled"
        context['sub_button'] = "Disable"
    else:
        context['able'] = "Disabled"
        context['sub_button'] = "Enable"

    info = Course2Marker.objects.filter(marker_id=request.session['user_id'])
    markers = info.filter(course=current_assignment.course)
    for marker in markers:
        context['sub_data'] = marker.submissionPermission

    course_student_relations = Course2Student.objects.filter(course=current_assignment.course)
    context['student_number'] = len(course_student_relations)

    course_students = Course2Student.objects.filter(course=current_assignment.course)

    total_number = 0
    submission_relations = Submission.objects.filter(assignment=current_assignment)
    for course_student in course_students:
        jihe = submission_relations.filter(student=course_student.student)
        if jihe.count() != 0:
            jihe = jihe.order_by("submissionDateTime")
            info = jihe.last()
            total_number = total_number + 1

    context['submission_number'] = total_number

    context['submission_deadline'] = current_assignment.deadline

    submission_relations = Submission.objects.filter(assignment=current_assignment)
    course_students = Course2Student.objects.filter(course=current_assignment.course)

    context['box'] = []
    context['unsubmitted'] = []
    for course_student in course_students:
        s = " "
        jihe = submission_relations.filter(student=course_student.student)
        jihe = jihe.order_by("submissionDateTime")
        info = jihe.last()
        eles = SubmissionElement.objects.filter(submission=info)
        list1 = []
        for ele in eles:
            if ele.marker:
                s = " "
                if len(list1) == 0:
                    list1.append(ele.marker.userName)
                else:
                    for i in list1:
                        print(i)
                        if ele.marker.userName != i:
                            list1.append(ele.marker.userName)
                for j in list1:
                    s = s + " " + j
            else:
                s = " "

        if len(jihe) != 0:
            box = SubmissionBox(course_student.student.id, course_student.student.userNumber,
                                course_student.student.userName,
                                info.submissionDateTime,
                                calc_days_late(submission_relations.filter(student=course_student.student)),
                                len(jihe),
                                s)
            context['box'].append(box)
        else:
            box = SubmissionBox(course_student.student.id, course_student.student.userNumber,
                                course_student.student.userName,
                                '-',
                                'NS',
                                len(jihe),
                                s)
            context['unsubmitted'].append(box)


def set_submissions_able(context):
    current_assignment = context['assignment']

    if current_assignment.status == 1:
        current_assignment.status = 0
        current_assignment.save()
    else:
        current_assignment.status = 1
        current_assignment.save()


class childTable(object):
    def __init__(self, id, studentId, sub_time):
        self.id = id
        self.studentId = studentId
        self.sub_time = sub_time


def set_child_page_info(context):
    context['current_page'] = "child"
    context['teams_info'] = []
    current_assignment = context['assignment']

    course_marker_relations = Course2Marker.objects.filter(course=current_assignment.course)
    for course_marker_relation in course_marker_relations:
        marker = course_marker_relation.marker
        info = UserInfo(marker)
        context['teams_info'].append(info)

    context['element_info'] = []
    assignment_elements = AssignmentElement.objects.filter(assignment=current_assignment)
    for element in assignment_elements:
        context['element_info'].append(element)

    context['student_info'] = []
    course_student_relations = Course2Student.objects.filter(course=current_assignment.course)
    number = 0
    for course_student_relation in course_student_relations:
        student = course_student_relation.student
        number = number + 1
        info = UserInfo(student)
        context['student_info'].append(info)

    submission_relations = Submission.objects.filter(assignment=current_assignment)
    course_students = Course2Student.objects.filter(course=current_assignment.course)
    context['child_table'] = []
    for course_student in course_students:
        jihe = submission_relations.filter(student=course_student.student)
        jihe = jihe.order_by("submissionDateTime")
        info = jihe.last()

        if len(jihe) != 0:
            box = childTable(info.id, course_student.student.userNumber, info.submissionDateTime)
            context['child_table'].append(box)


def assignTask(request, context):
    current_assignment = context['assignment']
    context['element_info'] = []
    assignment_elements = AssignmentElement.objects.filter(assignment=current_assignment)
    for element in assignment_elements:
        context['element_info'].append(element)

    markerId = request.POST.get('team')
    submissionId = request.POST.getlist('student')
    if request.POST.get('element') is None:
        for subId in submissionId:
            submission = Submission.objects.get(id=subId)
            marker = User.objects.get(id=markerId)
            submissionElements = SubmissionElement.objects.filter(submission=submission)
            for subElement in submissionElements:
                subElement.marker = marker
                subElement.save()

    else:
        for subId in submissionId:
            submission = Submission.objects.get(pk=subId)
            marker = User.objects.get(pk=markerId)
            element = AssignmentElement.objects.get(pk=request.POST.get('element'))
            submissionElements = SubmissionElement.objects.filter(submission=submission)
            subElement = submissionElements.get(element=element)
            subElement.marker = marker
            subElement.save()

class jobs(object):
    def __init__(self, job, task, receiver, status):
        self.job = job
        self.task = task
        self.receiver = receiver
        self.status = status


# Lea testing new branch.
def set_jobs_page_info(request, context):
    context['current_page'] = "jobs"

    context['jobs'] = []
    current_assignment = context['assignment']
    jobs_relation = Job.objects.filter(assignment=current_assignment)
    for job in jobs_relation:
        task = ""
        if job.task == 1:
            task = "Finish all tasks"
        elif job.task == 2:
            task = "Submission is tagged as moderate"
        elif job.task == 3:
            task = "Submission is tagged as help"
        elif job.task == 4:
            task = "Submission is made"
        elif job.task == 5:
            task = "Deadline in 1 day"
        elif job.task == 6:
            task = "Deadline in 2 days"

        if job.receiver == 1:
            receiver = "Academics"
        elif job.receiver == 2:
            receiver = "Markers"
        else:
            receiver = "Academics and Markers"

        status = job.status
        if "jobon" in request.GET:
            status = 1
        elif "joboff" in request.GET:
            status = 0

        info = jobs(job, task, receiver, status)
        context['jobs'].append(info)


def sendEmail(request, context):
    if request.method == "POST":
        when = request.POST.get('when')
        when2 = request.POST.get('when2')
        when3 = request.POST.get('when3')
        when4 = request.POST.get('when4')
        when5 = request.POST.get('when5')
        step = request.POST.get('step')

        current_assignment = context['assignment']

        # finfish all tasks
        if request.POST.get('when') == "1" and request.POST.get('when2') == "1":
            if request.POST.get('step') == "1":
                peoples = request.POST.getlist('people')
                if len(peoples) == 2:
                    title = request.POST.get('title')
                    context2 = request.POST.get('context')
                    relation_jobs = Job.objects.filter(assignment=current_assignment)
                    relation_jobs = relation_jobs.filter(task=1)
                    if len(relation_jobs) >= 1:
                        context['message'] = "wrong"
                    else:
                        context['message'] = "right"
                        job = Job(assignment=current_assignment, title=title, context=context2,
                                  sender_id=request.session['user_id'], receiver=3, task=1,
                                  status=0)
                        job.save()
                else:
                    print("hahahah")
                    print(peoples)
                    if peoples[0] == '1':
                        print("hjinlai")
                        title = request.POST.get('title')
                        context2 = request.POST.get('context')
                        relation_jobs = Job.objects.filter(assignment=current_assignment)
                        relation_jobs = relation_jobs.filter(task=1)
                        if len(relation_jobs) >= 1:
                            context['message'] = "wrong"
                        else:
                            context['message'] = "right"
                            job = Job(assignment=current_assignment, title=title, context=context2,
                                      sender_id=request.session['user_id'], receiver=1,
                                      task=1,
                                      status=0)
                            job.save()
                    else:
                        title = request.POST.get('title')
                        context2 = request.POST.get('context')
                        relation_jobs = Job.objects.filter(assignment=current_assignment)
                        relation_jobs = relation_jobs.filter(task=1)
                        if len(relation_jobs) >= 1:
                            context['message'] = "wrong"
                        else:
                            context['message'] = "right"
                            job = Job(assignment=current_assignment, title=title, context=context2,
                                      sender_id=request.session['user_id'], receiver=2,
                                      task=1,
                                      status=0)
                            job.save()
        #  sub is tagged as moderate
        elif request.POST.get('when') == "2" and request.POST.get('when3') == "1" and request.POST.get('when4') == "1":
            if request.POST.get('step') == "1":
                peoples = request.POST.getlist('people')
                if len(peoples) == 2:
                    title = request.POST.get('title')
                    context2 = request.POST.get('context')
                    relation_jobs = Job.objects.filter(assignment=current_assignment)
                    relation_jobs = relation_jobs.filter(task=2)
                    if len(relation_jobs) >= 1:
                        context['message'] = "wrong"
                    else:
                        context['message'] = "right"
                        job = Job(assignment=current_assignment, title=title, context=context2,
                                  sender_id=request.session['user_id'], receiver=3,
                                  task=2,
                                  status=0)
                        job.save()
                else:
                    if peoples[0] == '1':
                        title = request.POST.get('title')
                        context2 = request.POST.get('context')
                        relation_jobs = Job.objects.filter(assignment=current_assignment)
                        relation_jobs = relation_jobs.filter(task=2)
                        if len(relation_jobs) >= 1:
                            context['message'] = "wrong"
                        else:
                            context['message'] = "right"
                            job = Job(assignment=current_assignment, title=title, context=context2,
                                      sender_id=request.session['user_id'], receiver=1,
                                      task=2,
                                      status=0)
                            job.save()
                    else:
                        title = request.POST.get('title')
                        context2 = request.POST.get('context')
                        relation_jobs = Job.objects.filter(assignment=current_assignment)
                        relation_jobs = relation_jobs.filter(task=2)
                        if len(relation_jobs) >= 1:
                            context['message'] = "wrong"
                        else:
                            context['message'] = "right"
                            job = Job(assignment=current_assignment, title=title, context=context2,
                                      sender_id=request.session['user_id'], receiver=2,
                                      task=2,
                                      status=0)
                            job.save()
        #  sub is tagged as help
        elif request.POST.get('when') == "2" and request.POST.get('when3') == "1" and request.POST.get('when4') == "2":
            if request.POST.get('step') == "1":
                peoples = request.POST.getlist('people')
                if len(peoples) == 2:
                    title = request.POST.get('title')
                    context2 = request.POST.get('context')
                    relation_jobs = Job.objects.filter(assignment=current_assignment)
                    relation_jobs = relation_jobs.filter(task=3)
                    if len(relation_jobs) >= 1:
                        context['message'] = "wrong"
                    else:
                        context['message'] = "right"
                        job = Job(assignment=current_assignment, title=title, context=context2,
                                  sender_id=request.session['user_id'], receiver=3,
                                  task=3,
                                  status=0)
                        job.save()
                else:
                    if peoples[0] == '1':
                        title = request.POST.get('title')
                        context2 = request.POST.get('context')
                        relation_jobs = Job.objects.filter(assignment=current_assignment)
                        relation_jobs = relation_jobs.filter(task=3)
                        if len(relation_jobs) >= 1:
                            context['message'] = "wrong"
                        else:
                            context['message'] = "right"
                            job = Job(assignment=current_assignment, title=title, context=context2,
                                      sender_id=request.session['user_id'], receiver=1,
                                      task=3,
                                      status=0)
                            job.save()
                    else:
                        title = request.POST.get('title')
                        context2 = request.POST.get('context')
                        relation_jobs = Job.objects.filter(assignment=current_assignment)
                        relation_jobs = relation_jobs.filter(task=1)
                        if len(relation_jobs) >= 1:
                            context['message'] = "wrong"
                        else:
                            context['message'] = "right"
                            job = Job(assignment=current_assignment, title=title, context=context2,
                                      sender_id=request.session['user_id'], receiver=2,
                                      task=3,
                                      status=0)
                            job.save()
        #   sub is added
        elif request.POST.get('when') == "2" and request.POST.get('when3') == "2":
            if request.POST.get('step') == "1":
                peoples = request.POST.getlist('people')
                if len(peoples) == 2:
                    title = request.POST.get('title')
                    context2 = request.POST.get('context')
                    relation_jobs = Job.objects.filter(assignment=current_assignment)
                    relation_jobs = relation_jobs.filter(task=4)
                    if len(relation_jobs) >= 1:
                        context['message'] = "wrong"
                    else:
                        context['message'] = "right"
                        job = Job(assignment=current_assignment, title=title, context=context2,
                                  sender_id=request.session['user_id'], receiver=3,
                                  task=4,
                                  status=0)
                        job.save()
                else:
                    if peoples[0] == '1':
                        title = request.POST.get('title')
                        context2 = request.POST.get('context')
                        relation_jobs = Job.objects.filter(assignment=current_assignment)
                        relation_jobs = relation_jobs.filter(task=4)
                        if len(relation_jobs) >= 1:
                            context['message'] = "wrong"
                        else:
                            context['message'] = "right"
                            job = Job(assignment=current_assignment, title=title, context=context2,
                                      sender_id=request.session['user_id'], receiver=1,
                                      task=4,
                                      status=0)
                            job.save()
                    else:
                        title = request.POST.get('title')
                        context2 = request.POST.get('context')
                        relation_jobs = Job.objects.filter(assignment=current_assignment)
                        relation_jobs = relation_jobs.filter(task=4)
                        if len(relation_jobs) >= 1:
                            context['message'] = "wrong"
                        else:
                            context['message'] = "right"
                            job = Job(assignment=current_assignment, title=title, context=context2,
                                      sender_id=request.session['user_id'], receiver=2,
                                      task=4,
                                      status=0)
                            job.save()
        #   deadline left 1 day
        elif request.POST.get('when') == "3" and request.POST.get('when5') == "1":
            if request.POST.get('step') == "1":
                peoples = request.POST.getlist('people')
                if len(peoples) == 2:
                    title = request.POST.get('title')
                    context2 = request.POST.get('context')
                    relation_jobs = Job.objects.filter(assignment=current_assignment)
                    relation_jobs = relation_jobs.filter(task=5)
                    if len(relation_jobs) >= 1:
                        context['message'] = "wrong"
                    else:
                        context['message'] = "right"
                        job = Job(assignment=current_assignment, title=title, context=context2,
                                  sender_id=request.session['user_id'], receiver=3,
                                  task=5,
                                  status=0)
                        job.save()
                else:
                    if peoples[0] == '1':
                        title = request.POST.get('title')
                        context2 = request.POST.get('context')
                        relation_jobs = Job.objects.filter(assignment=current_assignment)
                        relation_jobs = relation_jobs.filter(task=5)
                        if len(relation_jobs) >= 1:
                            context['message'] = "wrong"
                        else:
                            context['message'] = "right"
                            job = Job(assignment=current_assignment, title=title, context=context2,
                                      sender_id=request.session['user_id'], receiver=1,
                                      task=5,
                                      status=0)
                            job.save()
                    else:
                        title = request.POST.get('title')
                        context2 = request.POST.get('context')
                        relation_jobs = Job.objects.filter(assignment=current_assignment)
                        relation_jobs = relation_jobs.filter(task=5)
                        if len(relation_jobs) >= 1:
                            context['message'] = "wrong"
                        else:
                            context['message'] = "right"
                            job = Job(assignment=current_assignment, title=title, context=context2,
                                      sender_id=request.session['user_id'], receiver=2,
                                      task=5,
                                      status=0)
                            job.save()
        #   deadline left 2 day
        elif request.POST.get('when') == "3" and request.POST.get('when5') == "2":
            if request.POST.get('step') == "1":
                peoples = request.POST.getlist('people')
                if len(peoples) == 2:
                    title = request.POST.get('title')
                    context2 = request.POST.get('context')
                    relation_jobs = Job.objects.filter(assignment=current_assignment)
                    relation_jobs = relation_jobs.filter(task=6)
                    if len(relation_jobs) >= 1:
                        context['message'] = "wrong"
                    else:
                        context['message'] = "right"
                        job = Job(assignment=current_assignment, title=title, context=context2,
                                  sender_id=request.session['user_id'], receiver=3,
                                  task=6,
                                  status=0)
                        job.save()
                else:
                    if peoples[0] == '1':
                        title = request.POST.get('title')
                        context2 = request.POST.get('context')
                        relation_jobs = Job.objects.filter(assignment=current_assignment)
                        relation_jobs = relation_jobs.filter(task=6)
                        if len(relation_jobs) >= 1:
                            context['message'] = "wrong"
                        else:
                            context['message'] = "right"
                            job = Job(assignment=current_assignment, title=title, context=context2,
                                      sender_id=request.session['user_id'], receiver=1,
                                      task=6,
                                      status=0)
                            job.save()
                    else:
                        title = request.POST.get('title')
                        context2 = request.POST.get('context')
                        relation_jobs = Job.objects.filter(assignment=current_assignment)
                        relation_jobs = relation_jobs.filter(task=6)
                        if len(relation_jobs) >= 1:
                            context['message'] = "wrong"
                        else:
                            context['message'] = "right"
                            job = Job(assignment=current_assignment, title=title, context=context2,
                                      sender_id=request.session['user_id'], receiver=2,
                                      task=6,
                                      status=0)
                            job.save()


def editEmail(request):
    if not request.session.get('is_login', None):
        return HttpResponseRedirect("/login")
    context = {}
    current_assignment = Assignment.objects.get(pk=request.GET['assignment'])
    context['assignment'] = current_assignment
    related_assignments = Assignment.objects.filter(course=current_assignment.course)
    context['other_related_assignments'] = []
    for related_assignment in related_assignments:
        if related_assignment != current_assignment:
            context['other_related_assignments'].append(related_assignment)

    job = Job.objects.get(pk=request.GET['job'])

    if request.method == "POST":
        when = request.POST.get('when')
        when2 = request.POST.get('when2')
        when3 = request.POST.get('when3')
        when4 = request.POST.get('when4')
        when5 = request.POST.get('when5')
        step = request.POST.get('step')

        current_assignment = context['assignment']

        # finfish all tasks
        if request.POST.get('when') == "1" and request.POST.get('when2') == "1":
            if request.POST.get('step') == "1":
                peoples = request.POST.getlist('people')
                if len(peoples) == 2:
                    title = request.POST.get('title')
                    context2 = request.POST.get('context')
                    relation_jobs = Job.objects.filter(assignment=current_assignment)
                    relation_jobs = relation_jobs.filter(task=1)
                    if len(relation_jobs) > 1:
                        context['message'] = "wrong"
                    else:
                        context['message'] = "right"
                        job.assignment = current_assignment
                        job.title = title
                        job.context = context2
                        job.sender_id = request.session['user_id']
                        job.receiver = 3
                        job.task = 1
                        job.status = 0
                        job.save()
                else:
                    if peoples[0] == '1':
                        title = request.POST.get('title')
                        context2 = request.POST.get('context')
                        relation_jobs = Job.objects.filter(assignment=current_assignment)
                        relation_jobs = relation_jobs.filter(task=1)
                        if len(relation_jobs) > 1:
                            context['message'] = "wrong"
                        else:
                            context['message'] = "right"
                            job.assignment = current_assignment
                            job.title = title
                            job.context = context2
                            job.sender_id = request.session['user_id']
                            job.receiver = 1
                            job.task = 1
                            job.status = 0
                            job.save()
                    else:
                        title = request.POST.get('title')
                        context2 = request.POST.get('context')
                        relation_jobs = Job.objects.filter(assignment=current_assignment)
                        relation_jobs = relation_jobs.filter(task=1)
                        if len(relation_jobs) > 1:
                            context['message'] = "wrong"
                        else:
                            context['message'] = "right"
                            job.assignment = current_assignment
                            job.title = title
                            job.context = context2
                            job.sender_id = request.session['user_id']
                            job.receiver = 2
                            job.task = 1
                            job.status = 0
                            job.save()
        #  sub is tagged as moderate
        elif request.POST.get('when') == "2" and request.POST.get('when3') == "1" and request.POST.get('when4') == "1":
            if request.POST.get('step') == "1":
                peoples = request.POST.getlist('people')
                if len(peoples) == 2:
                    title = request.POST.get('title')
                    context2 = request.POST.get('context')
                    relation_jobs = Job.objects.filter(assignment=current_assignment)
                    relation_jobs = relation_jobs.filter(task=2)
                    if len(relation_jobs) > 1:
                        context['message'] = "wrong"
                    else:
                        context['message'] = "right"
                        job.assignment = current_assignment
                        job.title = title
                        job.context = context2
                        job.sender_id = request.session['user_id']
                        job.receiver = 3
                        job.task = 2
                        job.status = 0
                        job.save()
                else:
                    if peoples[0] == '1':
                        title = request.POST.get('title')
                        context2 = request.POST.get('context')
                        relation_jobs = Job.objects.filter(assignment=current_assignment)
                        relation_jobs = relation_jobs.filter(task=2)
                        if len(relation_jobs) > 1:
                            context['message'] = "wrong"
                        else:
                            context['message'] = "right"
                            job.assignment = current_assignment
                            job.title = title
                            job.context = context2
                            job.sender_id = request.session['user_id']
                            job.receiver = 1
                            job.task = 2
                            job.status = 0
                            job.save()
                    else:
                        title = request.POST.get('title')
                        context2 = request.POST.get('context')
                        relation_jobs = Job.objects.filter(assignment=current_assignment)
                        relation_jobs = relation_jobs.filter(task=2)
                        if len(relation_jobs) > 1:
                            context['message'] = "wrong"
                        else:
                            context['message'] = "right"
                            job.assignment = current_assignment
                            job.title = title
                            job.context = context2
                            job.sender_id = request.session['user_id']
                            job.receiver = 2
                            job.task = 2
                            job.status = 0
                            job.save()
        #  sub is tagged as help
        elif request.POST.get('when') == "2" and request.POST.get('when3') == "1" and request.POST.get('when4') == "2":
            if request.POST.get('step') == "1":
                peoples = request.POST.getlist('people')
                if len(peoples) == 2:
                    title = request.POST.get('title')
                    context2 = request.POST.get('context')
                    relation_jobs = Job.objects.filter(assignment=current_assignment)
                    relation_jobs = relation_jobs.filter(task=3)
                    if len(relation_jobs) > 1:
                        context['message'] = "wrong"
                    else:
                        context['message'] = "right"
                        job.assignment = current_assignment
                        job.title = title
                        job.context = context2
                        job.sender_id = request.session['user_id']
                        job.receiver = 3
                        job.task = 3
                        job.status = 0
                        job.save()
                else:
                    if peoples[0] == '1':
                        title = request.POST.get('title')
                        context2 = request.POST.get('context')
                        relation_jobs = Job.objects.filter(assignment=current_assignment)
                        relation_jobs = relation_jobs.filter(task=3)
                        if len(relation_jobs) > 1:
                            context['message'] = "wrong"
                        else:
                            context['message'] = "right"
                            job.assignment = current_assignment
                            job.title = title
                            job.context = context2
                            job.sender_id = request.session['user_id']
                            job.receiver = 1
                            job.task = 3
                            job.status = 0
                            job.save()
                    else:
                        title = request.POST.get('title')
                        context2 = request.POST.get('context')
                        relation_jobs = Job.objects.filter(assignment=current_assignment)
                        relation_jobs = relation_jobs.filter(task=3)
                        if len(relation_jobs) > 1:
                            context['message'] = "wrong"
                        else:
                            context['message'] = "right"
                            job.assignment = current_assignment
                            job.title = title
                            job.context = context2
                            job.sender_id = request.session['user_id']
                            job.receiver = 2
                            job.task = 3
                            job.status = 0
                            job.save()
        #   sub is added
        elif request.POST.get('when') == "2" and request.POST.get('when3') == "2":
            if request.POST.get('step') == "1":
                peoples = request.POST.getlist('people')
                if len(peoples) == 2:
                    title = request.POST.get('title')
                    context2 = request.POST.get('context')
                    relation_jobs = Job.objects.filter(assignment=current_assignment)
                    relation_jobs = relation_jobs.filter(task=4)
                    if len(relation_jobs) > 1:
                        context['message'] = "wrong"
                    else:
                        context['message'] = "right"
                        job.assignment = current_assignment
                        job.title = title
                        job.context = context2
                        job.sender_id = request.session['user_id']
                        job.receiver = 3
                        job.task = 4
                        job.status = 0
                        job.save()
                else:
                    if peoples[0] == '1':
                        title = request.POST.get('title')
                        context2 = request.POST.get('context')
                        relation_jobs = Job.objects.filter(assignment=current_assignment)
                        relation_jobs = relation_jobs.filter(task=4)
                        if len(relation_jobs) > 1:
                            context['message'] = "wrong"
                        else:
                            context['message'] = "right"
                            job.assignment = current_assignment
                            job.title = title
                            job.context = context2
                            job.sender_id = request.session['user_id']
                            job.receiver = 1
                            job.task = 4
                            job.status = 0
                            job.save()
                    else:
                        title = request.POST.get('title')
                        context2 = request.POST.get('context')
                        relation_jobs = Job.objects.filter(assignment=current_assignment)
                        relation_jobs = relation_jobs.filter(task=4)
                        if len(relation_jobs) > 1:
                            context['message'] = "wrong"
                        else:
                            context['message'] = "right"
                            job.assignment = current_assignment
                            job.title = title
                            job.context = context2
                            job.sender_id = request.session['user_id']
                            job.receiver = 2
                            job.task = 4
                            job.status = 0
                            job.save()
        #   deadline left 1 day
        elif request.POST.get('when') == "3" and request.POST.get('when5') == "1":
            if request.POST.get('step') == "1":
                peoples = request.POST.getlist('people')
                if len(peoples) == 2:
                    title = request.POST.get('title')
                    context2 = request.POST.get('context')
                    relation_jobs = Job.objects.filter(assignment=current_assignment)
                    relation_jobs = relation_jobs.filter(task=5)
                    if len(relation_jobs) > 1:
                        context['message'] = "wrong"
                    else:
                        context['message'] = "right"
                        job.assignment = current_assignment
                        job.title = title
                        job.context = context2
                        job.sender_id = request.session['user_id']
                        job.receiver = 3
                        job.task = 5
                        job.status = 0
                        job.save()
                else:
                    if peoples[0] == '1':
                        title = request.POST.get('title')
                        context2 = request.POST.get('context')
                        relation_jobs = Job.objects.filter(assignment=current_assignment)
                        relation_jobs = relation_jobs.filter(task=5)
                        if len(relation_jobs) > 1:
                            context['message'] = "wrong"
                        else:
                            context['message'] = "right"
                            job.assignment = current_assignment
                            job.title = title
                            job.context = context2
                            job.sender_id = request.session['user_id']
                            job.receiver = 1
                            job.task = 5
                            job.status = 0
                            job.save()
                    else:
                        title = request.POST.get('title')
                        context2 = request.POST.get('context')
                        relation_jobs = Job.objects.filter(assignment=current_assignment)
                        relation_jobs = relation_jobs.filter(task=5)
                        if len(relation_jobs) > 1:
                            context['message'] = "wrong"
                        else:
                            context['message'] = "right"
                            job.assignment = current_assignment
                            job.title = title
                            job.context = context2
                            job.sender_id = request.session['user_id']
                            job.receiver = 2
                            job.task = 5
                            job.status = 0
                            job.save()
        #   deadline left 2 day
        elif request.POST.get('when') == "3" and request.POST.get('when5') == "2":
            if request.POST.get('step') == "1":
                peoples = request.POST.getlist('people')
                if len(peoples) == 2:
                    title = request.POST.get('title')
                    context2 = request.POST.get('context')
                    relation_jobs = Job.objects.filter(assignment=current_assignment)
                    relation_jobs = relation_jobs.filter(task=6)
                    if len(relation_jobs) > 1:
                        context['message'] = "wrong"
                    else:
                        context['message'] = "right"
                        job.assignment = current_assignment
                        job.title = title
                        job.context = context2
                        job.sender_id = request.session['user_id']
                        job.receiver = 3
                        job.task = 6
                        job.status = 0
                        job.save()
                else:
                    if peoples[0] == '1':
                        title = request.POST.get('title')
                        context2 = request.POST.get('context')
                        relation_jobs = Job.objects.filter(assignment=current_assignment)
                        relation_jobs = relation_jobs.filter(task=6)
                        if len(relation_jobs) > 1:
                            context['message'] = "wrong"
                        else:
                            context['message'] = "right"
                            job.assignment = current_assignment
                            job.title = title
                            job.context = context2
                            job.sender_id = request.session['user_id']
                            job.receiver = 1
                            job.task = 6
                            job.status = 0
                            job.save()
                    else:
                        title = request.POST.get('title')
                        context2 = request.POST.get('context')
                        relation_jobs = Job.objects.filter(assignment=current_assignment)
                        relation_jobs = relation_jobs.filter(task=6)
                        if len(relation_jobs) > 1:
                            context['message'] = "wrong"
                        else:
                            context['message'] = "right"
                            job.assignment = current_assignment
                            job.title = title
                            job.context = context2
                            job.sender_id = request.session['user_id']
                            job.receiver = 2
                            job.task = 6
                            job.status = 0
                            job.save()

        set_jobs_page_info(request, context)
        return render(request, 'teacher/jobs.html', context)


def checkTaskSendEmail(request, context):
    current_assignment = context['assignment']
    submission_relations = Submission.objects.filter(assignment=current_assignment)
    total_number = 0
    complete_number = 0
    assign_number = 0
    help_number = 0
    your_complete = 0

    course_students = Course2Student.objects.filter(course=current_assignment.course)

    context['box'] = []
    for course_student in course_students:
        jihe = submission_relations.filter(student=course_student.student)
        jihe = jihe.order_by("submissionDateTime")
        info = jihe.last()
        total_number = total_number + 1
        if get_submission_status(info) == "Finished":
            complete_number = complete_number + 1
            element_relations = SubmissionElement.objects.filter(submission=info)
            if len(element_relations) != 0:
                sign = 0
                for element_relation in element_relations:
                    if element_relation.marker_id == request.session['user_id']:
                        sign = 1
                    else:
                        sign = 0
                if sign == 1:
                    assign_number = assign_number + 1
                    your_complete = your_complete + 1

        else:
            element_rels = SubmissionElement.objects.filter(submission=info)
            if len(element_rels) != 0:
                sign1 = 0
                sign2 = 0
                for element_rel in element_rels:
                    if element_rel.marker_id == request.session['user_id']:
                        sign1 = 1
                    else:
                        sign1 = 0
                    if element_rel.needHelp == 1:
                        sign2 = 1
                    else:
                        sign2 = 0
                if sign1 == 1:
                    assign_number = assign_number + 1

                if sign2 == 1:
                    help_number = help_number + 1

    if assign_number != 0:
        if assign_number == your_complete:
            jobs_relation = Job.objects.filter(assignment=current_assignment)
            for job in jobs_relation:
                if job.task == 1 and job.status == 0:
                    title = job.title
                    context = job.context
                    if job.receiver == 1:
                        users = User.objects.filter(role='A')
                        for user in users:
                            send_mail(title, context, request.POST.get('useremail'), [user.userEmail],
                                      fail_silently=False)
                        job.status = 1
                        job.save()
                    elif job.receiver == 2:
                        users = User.objects.filter(role='M')
                        for user in users:
                            send_mail(title, context, request.POST.get('useremail'), [user.userEmail],
                                      fail_silently=False)
                        job.status = 1
                        job.save()
                    else:
                        users = User.objects.filter(role='A')
                        for user in users:
                            send_mail(title, context, request.POST.get('useremail'), [user.userEmail],
                                      fail_silently=False)
                        users2 = User.objects.filter(role='M')
                        for user in users2:
                            send_mail(title, context, request.POST.get('useremail'), [user.userEmail],
                                      fail_silently=False)
                        job.status = 1
                        job.save()


def email_moderate(request, context):
    current_assignment = context['assignment']

    jobs_relation = Job.objects.filter(assignment=current_assignment)
    for job in jobs_relation:
        if job.task == 2:
            title = job.title
            context = job.context
            if job.receiver == 1:
                courses = Course2Marker.objects.filter(course=current_assignment.course)
                for course_marker in courses:
                    if course_marker.marker.role == 'A':
                        send_mail(title, context, request.POST.get('useremail'), [course_marker.marker.userEmail],
                                  fail_silently=False)
                job.status = 1
                job.save()
            elif job.receiver == 2:
                courses = Course2Marker.objects.filter(course=current_assignment.course)
                for course_marker in courses:
                    if course_marker.marker.role == 'M':
                        send_mail(title, context, request.POST.get('useremail'), [course_marker.marker.userEmail],
                                  fail_silently=False)
                job.status = 1
                job.save()
            else:
                courses = Course2Marker.objects.filter(course=current_assignment.course)
                for course_marker in courses:
                    send_mail(title, context, request.POST.get('useremail'), [course_marker.marker.userEmail],
                              fail_silently=False)
                job.status = 1
                job.save()
            courses = Course2Marker.objects.filter(course=current_assignment.course)
            user = User.objects.get(pk=request.session.get('user_id'))
            for course in courses:
                if course.marker != user:
                    notify = Notification(assignment=current_assignment, receiver=course.marker, subject=1, status=0)
                    notify.save()


def email_help(request, context):
    current_assignment = context['assignment']

    jobs_relation = Job.objects.filter(assignment=current_assignment)
    for job in jobs_relation:
        if job.task == 3:
            title = job.title
            context = job.context
            if job.receiver == 1:
                courses = Course2Marker.objects.filter(course=current_assignment.course)
                for course_marker in courses:
                    if course_marker.marker.role == 'A':
                        send_mail(title, context, request.POST.get('useremail'), [course_marker.marker.userEmail],
                                  fail_silently=False)
                job.status = 1
                job.save()
            elif job.receiver == 2:
                courses = Course2Marker.objects.filter(course=current_assignment.course)
                for course_marker in courses:
                    if course_marker.marker.role == 'M':
                        send_mail(title, context, request.POST.get('useremail'), [course_marker.marker.userEmail],
                                  fail_silently=False)
                job.status = 1
                job.save()
            else:
                courses = Course2Marker.objects.filter(course=current_assignment.course)
                for course_marker in courses:
                    send_mail(title, context, request.POST.get('useremail'), [course_marker.marker.userEmail],
                              fail_silently=False)
                job.status = 1
                job.save()
            courses = Course2Marker.objects.filter(course=current_assignment.course)
            user = User.objects.get(pk=request.session.get('user_id'))
            for course in courses:
                if course.marker != user:
                    notify = Notification(assignment=current_assignment, receiver=course.marker, subject=2, status=0)
                    notify.save()


def email_deadline(request, context):
    create_time = date.today()
    a = datetime.combine(create_time, datetime.min.time())

    current_assignment = context['assignment']

    b = current_assignment.deadline
    naive = b.replace(tzinfo=None)
    c = (naive - a).days

    jobs_relation = Job.objects.filter(assignment=current_assignment)
    if c < 1:
        for job in jobs_relation:
            if job.task == 5:
                context['remind'] = 1
                if job.status == 0:
                    title = job.title
                    context2 = job.context
                    if job.receiver == 1:
                        courses = Course2Marker.objects.filter(course=current_assignment.course)
                        for course_marker in courses:
                            if course_marker.marker.role == 'A':
                                send_mail(title, context2, request.POST.get('useremail'),
                                          [course_marker.marker.userEmail],
                                          fail_silently=False)
                        job.status = 1
                        job.save()
                    elif job.receiver == 2:
                        courses = Course2Marker.objects.filter(course=current_assignment.course)
                        for course_marker in courses:
                            if course_marker.marker.role == 'M':
                                send_mail(title, context2, request.POST.get('useremail'),
                                          [course_marker.marker.userEmail],
                                          fail_silently=False)
                        job.status = 1
                        job.save()
                    else:
                        courses = Course2Marker.objects.filter(course=current_assignment.course)
                        print("dayin")
                        print(courses)
                        for course_marker in courses:
                            send_mail(title, context2, request.POST.get('useremail'),
                                      [course_marker.marker.userEmail],
                                      fail_silently=False)

                        job.status = 1
                        job.save()
                    courses = Course2Marker.objects.filter(course=current_assignment.course)

                    for course in courses:
                        notify = Notification(assignment=current_assignment, receiver=course.marker, subject=4,
                                              status=0)
                        notify.save()

    elif c >= 1 and c < 2:
        for job in jobs_relation:
            if job.task == 6:
                context['remind'] = 2
                if job.status == 0:
                    title = job.title
                    context2 = job.context
                    if job.receiver == 1:
                        print("ccccccc")
                        courses = Course2Marker.objects.filter(course=current_assignment.course)
                        print(len(courses))
                        for course_marker in courses:
                            print("klllllll")
                            if course_marker.marker.role == 'A':
                                print("kpl")
                                print(course_marker.marker.role)
                                send_mail(title, context2, request.POST.get('useremail'),
                                          [course_marker.marker.userEmail],
                                          fail_silently=False)
                        job.status = 1
                        job.save()
                    elif job.receiver == 2:
                        courses = Course2Marker.objects.filter(course=current_assignment.course)
                        for course_marker in courses:
                            if course_marker.marker.role == 'M':
                                send_mail(title, context2, request.POST.get('useremail'),
                                          [course_marker.marker.userEmail],
                                          fail_silently=False)
                        job.status = 1
                        job.save()
                    else:
                        courses = Course2Marker.objects.filter(course=current_assignment.course)
                        print("dayin")
                        print(courses)
                        for course_marker in courses:
                            send_mail(title, context2, request.POST.get('useremail'),
                                      [course_marker.marker.userEmail],
                                      fail_silently=False)
                        job.status = 1
                        job.save()

                    courses = Course2Marker.objects.filter(course=current_assignment.course)
                    for course in courses:
                        notify = Notification(assignment=current_assignment, receiver=course.marker, subject=5,
                                              status=0)
                        notify.save()


class setInfo(object):
    def __init__(self, user, permission):
        self.user = user
        self.permission = permission

# Function to recursively build the criteria structure
def build_criteria_structure(criteria_qs):
    criteria_tree = []
    for criteria in criteria_qs:
        # Construct the dictionary for the current criteria
        criteria_dict = {
            'id': criteria.id,
            'name': criteria.name,
            'marks': criteria.marks,
            'marking_scheme': criteria.marking_scheme,
            'children': build_criteria_structure(criteria.children.all()),
            'elements': [
                {'id': elem.id, 'description': elem.description, 'marks': elem.marks}
                for elem in criteria.elements.all()
            ]
        }
        criteria_tree.append(criteria_dict)
    return criteria_tree


def get_criteria_data(request, criteria_id):
    criteria = Criteria.objects.get(pk=criteria_id)
    elements_data = [
        {'id': elem.id, 'name': elem.name, 'description': elem.description, 'marks': elem.marks}
        for elem in criteria.elements.all()
    ]
    data = {
        'name': criteria.name,
        'marks': criteria.marks,
        'marking_scheme': criteria.marking_scheme,
        'elements': elements_data,
        'parentId' : criteria.parent.id if criteria.parent else None
    }
    return JsonResponse(data)


def get_element_data(request, element_id):
    element = Element.objects.get(pk=element_id)
    data = {
        'name': element.name,
        'description': element.description,
        'marks': element.marks,
    }
    return JsonResponse(data)


def add_criteria(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            # Fetch the parent Criteria if specified
            parent_criteria = Criteria.objects.get(pk=data['parent']) if 'parent' in data and data['parent'] else None

            # Include marking_scheme in the Criteria creation
            new_criteria = Criteria(
                assignment=Assignment.objects.get(pk=data['assignment']),
                name=data['name'],
                marks=data['marks'],
                parent=parent_criteria,
                marking_scheme=data.get('marking_scheme', 'ADD')  # Default to 'ADD' if not specified
            )
            new_criteria.save()

            # Inside add_criteria function, after new_criteria.save()
            submissions = Submission.objects.filter(assignment_id=data['assignment'])
            with transaction.atomic():
                for submission in submissions:
                    SubmissionCriteria.objects.create(
                        submission=submission,
                        criteria=new_criteria
                    )

            return JsonResponse({
                'status': 'success',
                'message': 'Criteria added successfully',
                'criteria_id': new_criteria.id,
                'name': new_criteria.name,
                'marks': new_criteria.marks,
                'parent': new_criteria.parent.id if new_criteria.parent else None,
                'marking_scheme': new_criteria.marking_scheme
            })
        except KeyError as e:
            return JsonResponse({'status': 'error', 'message': f'Missing field {e}'}, status=400)
        except Criteria.DoesNotExist:
            return JsonResponse({'status': 'error', 'message': 'Parent criteria not found'}, status=404)
        except Assignment.DoesNotExist:
            return JsonResponse({'status': 'error', 'message': 'Assignment not found'}, status=404)
    else:
        return JsonResponse({'status': 'error', 'message': 'Invalid request'}, status=400)


def update_criteria(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            criteria = Criteria.objects.get(pk=data['id'])
            criteria.name = data['name']
            criteria.marks = data['marks']
            criteria.marking_scheme = data.get('marking_scheme', criteria.marking_scheme)  # Update if provided
            criteria.save()

            return JsonResponse({
                'status': 'success',
                'message': 'Criteria updated successfully',
                'criteria_id': criteria.id,
                'name': criteria.name,
                'marks': criteria.marks,
                'marking_scheme': criteria.marking_scheme
            })
        except Criteria.DoesNotExist:
            return JsonResponse({'status': 'error', 'message': 'Criteria not found'}, status=404)
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
    else:
        return JsonResponse({'status': 'error', 'message': 'Invalid request'}, status=400)


def delete_criteria(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            criteria = Criteria.objects.get(pk=data['id'])
            criteria.delete()
            SubmissionCriteria.objects.filter(criteria=criteria).delete()

            return JsonResponse({
                'status': 'success',
                'message': 'Criteria deleted successfully',
            })
        except Criteria.DoesNotExist:
            return JsonResponse({'status': 'error', 'message': 'Criteria not found'}, status=404)
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
    else:
        return JsonResponse({'status': 'error', 'message': 'Invalid request'}, status=400)


def add_element(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            criteria = Criteria.objects.get(pk=data['criteria'])
            new_element = Element(
                criteria=criteria,
                name=data['name'],
                description=data['description'],
                marks=data['marks']
            )
            new_element.save()

            return JsonResponse({
                'status': 'success',
                'message': 'Element added successfully',
                'element_id': new_element.id,
                'description': new_element.description,
                'marks': new_element.marks
            })
        except KeyError as e:
            return JsonResponse({'status': 'error', 'message': f'Missing field {e}'}, status=400)
        except Criteria.DoesNotExist:
            return JsonResponse({'status': 'error', 'message': 'Criteria not found'}, status=404)
    else:
        return JsonResponse({'status': 'error', 'message': 'Invalid request'}, status=400)


def update_element(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            element = Element.objects.get(pk=data['id'])
            element.name = data.get('name', element.name)  # Update if provided
            element.description = data.get('description', element.description)  # Update if provided
            element.marks = data.get('marks', element.marks)  # Update if provided
            element.save()

            return JsonResponse({
                'status': 'success',
                'message': 'Element updated successfully',
                'element_id': element.id,
                'name': element.name,
                'description': element.description,
                'marks': element.marks
            })
        except Element.DoesNotExist:
            return JsonResponse({'status': 'error', 'message': 'Element not found'}, status=404)
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
    else:
        return JsonResponse({'status': 'error', 'message': 'Invalid request'}, status=400)


def delete_element(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            element = Element.objects.get(pk=data['id'])
            element.delete()

            return JsonResponse({
                'status': 'success',
                'message': 'Element deleted successfully',
            })
        except Element.DoesNotExist:
            return JsonResponse({'status': 'error', 'message': 'Element not found'}, status=404)
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
    else:
        return JsonResponse({'status': 'error', 'message': 'Invalid request'}, status=400)


def update_marking_scheme(request, criteria_id):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            criteria = Criteria.objects.get(pk=criteria_id)
            criteria.marking_scheme = data['marking_scheme']
            criteria.save()

            return JsonResponse({
                'status': 'success',
                'message': 'Marking scheme updated successfully',
                'criteria_id': criteria.id,
                'marking_scheme': criteria.marking_scheme
            })
        except Criteria.DoesNotExist:
            return JsonResponse({'status': 'error', 'message': 'Criteria not found'}, status=404)
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
    else:
        return JsonResponse({'status': 'error', 'message': 'Invalid request'}, status=400)


def set_setup_page_info(request, context):
    context['current_page'] = "setup"
    context['teams_info'] = []
    current_assignment = context['assignment']
    course_marker_relations = Course2Marker.objects.filter(course=current_assignment.course)

    for course_marker_relation in course_marker_relations:
        marker = course_marker_relation.marker
        info = setInfo(marker, course_marker_relation)
        context['teams_info'].append(info)

    info = Course2Marker.objects.filter(marker_id=request.session['user_id'])
    markers = info.filter(course=current_assignment.course)
    for marker in markers:
        context['teams_data'] = marker.teamPermission
        context['structure_data'] = marker.structurePermission

    context['element_info'] = []
    assignment_elements = AssignmentElement.objects.filter(assignment=current_assignment)
    for element in assignment_elements:
        context['element_info'].append(element)
    
    # Get all top-level criteria for the current assignment
    top_level_criteria_qs = Criteria.objects.filter(assignment=current_assignment, parent=None)
    
    # Build the criteria structure
    context['criteria_info'] = build_criteria_structure(top_level_criteria_qs)

    context['allMarker'] = []
    allMarker = User.objects.filter(Q(role='A') | Q(role='M') | Q(role='T'))
    for marker in allMarker:
        sign = 0
        for course_marker_relation in course_marker_relations:
            team = course_marker_relation.marker
            if marker.id == team.id:
                sign = 1
        if sign == 0:
            context['allMarker'].append(marker)
    context['user_role'] = request.session['user_role']

    marker_submission = []
    marker_structure = []
    marker_team = []
    marker_marking = []
    ta_submission = []
    ta_structure = []
    ta_team = []
    ta_marking = []
    for course_marker_relation in course_marker_relations:
        marker = course_marker_relation.marker
        if marker.role == 'M' or marker.role == 'A':
            marker_submission.append(course_marker_relation.submissionPermission)
            marker_structure.append(course_marker_relation.structurePermission)
            marker_team.append(course_marker_relation.teamPermission)
            marker_marking.append(course_marker_relation.markingPermission)
        elif marker.role == 'T':
            ta_submission.append(course_marker_relation.submissionPermission)
            ta_structure.append(course_marker_relation.structurePermission)
            ta_team.append(course_marker_relation.teamPermission)
            ta_marking.append(course_marker_relation.markingPermission)

    if len(marker_submission) != 0:
        context["marker_submission"] = min(marker_submission)
    else:
        context["marker_submission"] = 0

    if len(marker_structure) != 0:
        context["marker_structure"] = min(marker_structure)
    else:
        context["marker_structure"] = 0

    if len(marker_team) != 0:
        context["marker_team"] = min(marker_team)
    else:
        context["marker_team"] = 0

    if len(marker_marking) != 0:
        context["marker_marking"] = min(marker_marking)
    else:
        context["marker_marking"] = 0

    if len(ta_submission) != 0:
        context["ta_submission"] = min(ta_submission)
    else:
        context["ta_submission"] = 0

    if len(ta_structure) != 0:
        context["ta_structure"] = min(ta_structure)
    else:
        context["ta_structure"] = 0

    if len(ta_team) != 0:
        context["ta_team"] = min(ta_team)
    else:
        context["ta_team"] = 0

    if len(ta_marking) != 0:
        context["ta_marking"] = min(ta_marking)
    else:
        context["ta_marking"] = 0


def addElement(request):
    if not request.session.get('is_login', None):
        return HttpResponseRedirect("/login")
    context = {}
    current_assignment = Assignment.objects.get(pk=request.GET['assignment'])
    context['assignment'] = current_assignment
    related_assignments = Assignment.objects.filter(course=current_assignment.course)
    context['other_related_assignments'] = []
    for related_assignment in related_assignments:
        if related_assignment != current_assignment:
            context['other_related_assignments'].append(related_assignment)
    if request.method == "POST":
        if request.GET['assignment']:
            current_assignment = Assignment.objects.get(pk=request.GET['assignment'])
            max = float(request.POST.get('max'))
            new_element = AssignmentElement(assignment=current_assignment, elementName=request.POST.get('name'),
                                            markingGuide=request.POST.get('guide'), maxInput=max)
            new_element.save()

            # Also add new submission elements for all students for this assignment element if they have submitted
            students = Course2Student.objects.filter(course=current_assignment.course)
            for student in students:
                submissions = Submission.objects.filter(assignment=current_assignment, student=student.student)
                if len(submissions) != 0:
                    submission = submissions.last()
                    new_submission_element = SubmissionElement(submission=submission, element=new_element,
                                                              marker_id=request.session['user_id'], score=0)
                    new_submission_element.save()

            set_setup_page_info(request, context)
            return render(request, 'teacher/setup.html', context)


def deleteElement(request, pk):
    if not request.session.get('is_login', None):
        return HttpResponseRedirect("/login")
    context = {}
    current_assignment = Assignment.objects.get(pk=request.POST.get('assignment'))
    context['assignment'] = current_assignment
    related_assignments = Assignment.objects.filter(course=current_assignment.course)
    context['other_related_assignments'] = []
    for related_assignment in related_assignments:
        if related_assignment != current_assignment:
            context['other_related_assignments'].append(related_assignment)

    AssignmentElement.objects.get(pk=pk).delete()

    set_setup_page_info(request, context)
    return render(request, 'teacher/setup.html', context)


def addTeam(request):
    if not request.session.get('is_login', None):
        return HttpResponseRedirect("/login")
    context = {}
    current_assignment = Assignment.objects.get(pk=request.GET['assignment'])
    context['assignment'] = current_assignment
    related_assignments = Assignment.objects.filter(course=current_assignment.course)
    context['other_related_assignments'] = []
    for related_assignment in related_assignments:
        if related_assignment != current_assignment:
            context['other_related_assignments'].append(related_assignment)
    if request.method == "POST":
        if request.GET['assignment']:
            current_assignment = Assignment.objects.get(pk=request.GET['assignment'])
            teamId = request.POST.getlist('team')
            for id in teamId:
                marker = User.objects.get(id=id)
                courseMarker = Course2Marker(course=current_assignment.course, marker=marker, submissionPermission=0,
                                             markingPermission=0, structurePermission=0, teamPermission=0)
                courseMarker.save()

            set_setup_page_info(request, context)
            return render(request, 'teacher/setup.html', context)


def setupForm(request):
    if not request.session.get('is_login', None):
        return HttpResponseRedirect("/login")
    context = {}
    current_assignment = Assignment.objects.get(pk=request.GET['assignment'])
    context['assignment'] = current_assignment
    related_assignments = Assignment.objects.filter(course=current_assignment.course)
    context['other_related_assignments'] = []
    for related_assignment in related_assignments:
        if related_assignment != current_assignment:
            context['other_related_assignments'].append(related_assignment)

    course_markers = Course2Marker.objects.filter(course=current_assignment.course)
    print("kkkk")
    print(request.GET['team'])
    item = course_markers.get(marker_id=request.GET['team'])
    if request.GET['function'] and request.GET['assignment']:
        if request.GET['function'] == "permission":
            if request.POST.get('sub2') == "on":
                sub_marker = 2
            elif request.POST.get('sub1') == "on" and request.POST.get('sub2') is None:
                sub_marker = 1
            elif request.POST.get('sub1') is None and request.POST.get('sub2') is None:
                sub_marker = 0
            else:
                sub_marker = 0

            if request.POST.get('sd2') == "on":
                sd_marker = 2
            elif request.POST.get('sd1') == "on" and request.POST.get('sd2') is None:
                sd_marker = 1
            elif request.POST.get('sd1') is None and request.POST.get('sd2') is None:
                sd_marker = 0
            else:
                sd_marker = 0

            if request.POST.get('td2') == "on":
                td_marker = 2
            elif request.POST.get('td1') == "on" and request.POST.get('td2') is None:
                td_marker = 1
            elif request.POST.get('td1') is None and request.POST.get('td2') is None:
                td_marker = 0
            else:
                td_marker = 0

            if request.POST.get('md2') == "on":
                md_marker = 2
            elif request.POST.get('md1') == "on" and request.POST.get('md2') is None:
                md_marker = 1
            elif request.POST.get('md1') is None and request.POST.get('md2') is None:
                md_marker = 0
            else:
                md_marker = 0

            item.submissionPermission = sub_marker
            item.structurePermission = sd_marker
            item.teamPermission = td_marker
            item.markingPermission = md_marker
            item.save()

            set_setup_page_info(request, context)
            return render(request, 'teacher/setup.html', context)


def setupForm2(request):
    if not request.session.get('is_login', None):
        return HttpResponseRedirect("/login")
    context = {}
    context['current_user'] = User.objects.get(userName=request.session['user_name'])
    current_assignment = Assignment.objects.get(pk=request.GET['assignment'])
    context['assignment'] = current_assignment
    related_assignments = Assignment.objects.filter(course=current_assignment.course)
    context['other_related_assignments'] = []
    for related_assignment in related_assignments:
        if related_assignment != current_assignment:
            context['other_related_assignments'].append(related_assignment)

    course_markers = Course2Marker.objects.filter(course=current_assignment.course)
    if request.GET['function'] and request.GET['assignment']:
        if request.GET['function'] == "permission":
            if request.POST.get('2sub2') == "on":
                sub_marker = 2
            elif request.POST.get('2sub1') == "on" and request.POST.get('2sub2') is None:
                sub_marker = 1
            elif request.POST.get('2sub1') is None and request.POST.get('2sub2') is None:
                sub_marker = 0
            else:
                sub_marker = 0
            print(sub_marker)
            if request.POST.get('2sub4') == "on":
                sub_ta = 2
            elif request.POST.get('2sub3') == "on" and request.POST.get('2sub4') is None:
                sub_ta = 1
            elif request.POST.get('2sub3') is None and request.POST.get('2sub4') is None:
                sub_ta = 0
            else:
                sub_ta = 0
            print(sub_ta)
            if request.POST.get('2sd2') == "on":
                sd_marker = 2
            elif request.POST.get('2sd1') == "on" and request.POST.get('2sd2') is None:
                sd_marker = 1
            elif request.POST.get('2sd1') is None and request.POST.get('2sd2') is None:
                sd_marker = 0
            else:
                sd_marker = 0
            print(sd_marker)
            if request.POST.get('2sd4') == "on":
                sd_ta = 2
            elif request.POST.get('2sd3') == "on" and request.POST.get('2sd4') is None:
                sd_ta = 1
            elif request.POST.get('2sd3') is None and request.POST.get('2sd4') is None:
                sd_ta = 0
            else:
                sd_ta = 0

            if request.POST.get('2td2') == "on":
                td_marker = 2
            elif request.POST.get('2td1') == "on" and request.POST.get('2td2') is None:
                td_marker = 1
            elif request.POST.get('2td1') is None and request.POST.get('2td2') is None:
                td_marker = 0
            else:
                td_marker = 0

            if request.POST.get('2td4') == "on":
                td_ta = 2
            elif request.POST.get('2td3') == "on" and request.POST.get('2td4') is None:
                td_ta = 1
            elif request.POST.get('2td3') is None and request.POST.get('2td4') is None:
                td_ta = 0
            else:
                td_ta = 0

            if request.POST.get('2md2') == "on":
                md_marker = 2
            elif request.POST.get('2md1') == "on" and request.POST.get('2md2') is None:
                md_marker = 1
            elif request.POST.get('2md1') is None and request.POST.get('2md2') is None:
                md_marker = 0
            else:
                md_marker = 0

            if request.POST.get('2md4') == "on":
                md_ta = 2
            elif request.POST.get('2md3') == "on" and request.POST.get('2md4') is None:
                md_ta = 1
            elif request.POST.get('2md3') is None and request.POST.get('2md4') is None:
                md_ta = 0
            else:
                md_ta = 0

            for course_marker in course_markers:
                if course_marker.marker.role == 'M' or course_marker.marker.role == 'A':
                    course_marker.submissionPermission = sub_marker
                    course_marker.structurePermission = sd_marker
                    course_marker.teamPermission = td_marker
                    course_marker.markingPermission = md_marker
                    course_marker.save()
                elif course_marker.marker.role == 'T':
                    course_marker.submissionPermission = sub_ta
                    course_marker.structurePermission = sd_ta
                    course_marker.teamPermission = td_ta
                    course_marker.markingPermission = md_ta
                    course_marker.save()
            set_setup_page_info(request, context)
            return render(request, 'teacher/setup.html', context)


def permission_page(request, context):
    current_team = context["team"]
    current_assignment = context['assignment']
    course_markers = Course2Marker.objects.filter(course=current_assignment.course)
    item = course_markers.get(marker=current_team)
    context["item"] = item


def set_modules_page_info(context):
    context['current_page'] = "modules"


def set_marking_page_info(context, assignment_id):
    context['current_page'] = "marking"
    current_assignment = Assignment.objects.get(pk=assignment_id)
    context['are_subs_enabled'] = current_assignment.status
    related_course2students = Course2Student.objects.filter(course=current_assignment.course)
    related_assignment_elements = AssignmentElement.objects.filter(assignment=current_assignment)
    context['page_elements'] = related_assignment_elements
    context['page_info'] = []
    context['unsubmitted_page_info'] = []
    for related_course2student in related_course2students:
        related_latest_submissions = Submission.objects.filter(student=related_course2student.student,
                                                               assignment=current_assignment)
        attempts_number = related_latest_submissions.count()
        if related_latest_submissions.count() > 0:
            related_latest_submission = related_latest_submissions.last()
            related_elements_needs = [False, False]
            related_elements_scores = []
            related_elements_feedbacks = []
            total_score = 0
            related_submission_elements = SubmissionElement.objects.filter(submission=related_latest_submission)
            for related_submission_element in related_submission_elements:
                element_need_list = [False, False]
                if related_submission_element.needHelp:
                    element_need_list[0] = True
                    related_elements_needs[0] = True
                if related_submission_element.needModerate:
                    element_need_list[1] = True
                    related_elements_needs[1] = True
                if related_submission_element.score:
                    related_elements_scores.append([element_need_list, related_submission_element.score])
                    total_score += related_submission_element.score
                else:
                    related_elements_scores.append([element_need_list, "-"])
                if related_submission_element.feedback:
                    try:
                        current_feedback = json.loads(related_submission_element.feedback)
                    except:
                        current_feedback = {"start": related_submission_element.feedback, "middle": "", "end": ""}
                    related_elements_feedbacks.append([element_need_list,
                                                       current_feedback["start"] + " " + current_feedback[
                                                           "middle"] + " " + current_feedback["end"]])
                else:
                    related_elements_scores.append([element_need_list, "-"])
            info = MarkerMarkingPageInfo(related_elements_needs, related_latest_submission.student.userNumber,
                                         attempts_number, related_latest_submission.submissionDateTime,
                                         related_elements_scores, related_elements_feedbacks,
                                         related_latest_submission.pk, get_submission_status(related_latest_submission),
                                         total_score)
            context['page_info'].append(info)
        else:
            info = MarkerMarkingPageInfo([False, False], related_course2student.student.userNumber,
                                         0, '-',
                                         [[[False, False], "-"] for x in range(len(related_assignment_elements))],
                                         [[[False, False], "NS"] for x in range(len(related_assignment_elements))],
                                         "-", "NS",
                                         0)
            context['unsubmitted_page_info'].append(info)

    context['criteria_count'] = related_assignment_elements.count()


def mark(request):
    if not request.session.get('is_login', None):
        return HttpResponseRedirect("/login")
    if request.session.get('user_role', None) == "Student":
        return HttpResponseRedirect("/student/home")
    context = {}
    context['current_page'] = "marking"
    if request.method == "POST":

        if 'submission' in request.GET:
            print("submission")
            if 'compare' in request.POST:
                if "inputSelectedSubmission" in request.POST:
                    return HttpResponseRedirect(
                        "/teacher/compare?left=" + str(request.GET['submission']) + "&right=" + str(
                            request.POST.get("inputSelectedSubmission")) + "&question=" + str(
                            request.POST.get("questionID")))
                else:
                    return HttpResponseRedirect("/teacher/mark?submission=" + str(request.GET['submission']))

            else:
                current_submission = Submission.objects.get(pk=request.GET['submission'])
                if request.session.get('user_role', None) == "Academic":
                    related_submission_elements = SubmissionElement.objects.filter(submission=current_submission)
                else:
                    related_submission_elements = SubmissionElement.objects.filter(submission=current_submission,
                                                                                   marker_id=request.session.get(
                                                                                       'user_id', None))

                # Xiaofei
                current_assignment = current_submission.assignment
                context['assignment'] = current_assignment
                # Xiaofei

                if 'btnStop' in request.POST or 'btnStart' in request.POST:

                    hours_so_far, minutes_so_far, seconds_so_far = 0, 0, 0

                    last_start_rec = TimeRecord.objects.filter(marker_id=request.session.get('user_id', None),
                                                               student=current_submission.student_id,
                                                               assignment_id=current_assignment.pk,
                                                               type__in=['S']).order_by(
                        'datetime').last()

                    if 'btnStart' in request.POST:
                        time_record = TimeRecord(
                            marker_id=request.session.get('user_id', None),
                            student=current_submission.student_id,
                            assignment_id=current_assignment.pk,
                            type='S'
                        )
                        time_record.save()
                        timediff = time_diff_helper(last_start_rec.datetime, time_record.datetime)

                        # check if no timeDuration object yet for this marker-student-assignment combo
                        existing_time_dur_query = TimeDuration.objects.filter(
                            marker_id=request.session.get('user_id', None),
                            student=current_submission.student_id,
                            assignment_id=current_assignment.pk)

                        if (len(existing_time_dur_query) == 0):
                            new_duration = TimeDuration(
                                marker_id=request.session.get('user_id', None),
                                student=current_submission.student_id,
                                assignment_id=current_assignment.pk,
                                duration=timediff,
                                selfDefined=False
                            )
                            new_duration.save()

                        scalar = timediff.seconds // 6
                        new_curr_duration = existing_time_dur_query.last().duration + timediff - timedelta(
                            seconds=1 * scalar) if timediff > timedelta(
                            seconds=6) else existing_time_dur_query.last().duration + timediff
                        update_duration(existing_time_dur_query.last(), new_curr_duration)

                    elif 'btnStop' in request.POST:
                        time_record = TimeRecord(
                            marker_id=request.session.get('user_id', None),
                            student=current_submission.student_id,
                            assignment_id=current_assignment.pk,
                            type='E'
                        )
                        time_record.save()
                        timediff = time_diff_helper(last_start_rec.datetime, time_record.datetime)

                        # check if no timeDuration object yet for this marker-student-assignment combo
                        existing_time_dur_query = TimeDuration.objects.filter(
                            marker_id=request.session.get('user_id', None),
                            student=current_submission.student_id,
                            assignment_id=current_assignment.pk)

                        if (len(existing_time_dur_query) == 0):
                            new_duration = TimeDuration(
                                marker_id=request.session.get('user_id', None),
                                student=current_submission.student_id,
                                assignment_id=current_assignment.pk,
                                duration=timediff,
                                selfDefined=False
                            )
                            new_duration.save()

                        last_time_recs_query = TimeRecord.objects.filter(marker_id=request.session.get('user_id', None),
                                                                         student=current_submission.student_id,
                                                                         assignment_id=current_assignment.pk).order_by(
                            'datetime').reverse()[1:1000]
                        record_S = find_last_rec_type_S(last_time_recs_query)
                        if record_S is not None:
                            scalar = timediff.seconds // 6
                            new_curr_duration = existing_time_dur_query.last().duration + timediff - timedelta(
                                seconds=1 * scalar) if timediff > timedelta(
                                seconds=6) else existing_time_dur_query.last().duration + timediff
                            update_duration(existing_time_dur_query.last(), new_curr_duration)

                    context['hours'] = hours_so_far
                    context['minutes'] = minutes_so_far
                    context['seconds'] = seconds_so_far

                    # timer POST END
                    return HttpResponseRedirect("/teacher/mark?submission=" + str(request.GET['submission']))

                elif 'btnradio' in request.POST:
                    # custom tag  (start)

                    # save tag
                    sub_element = int(request.POST['btnradio'].split("-")[-1])
                    visibility = request.POST['btnradio'].split("-")[0][-1:]

                    post_tags = request.POST.getlist('tagname')

                    for t in range(len(post_tags)):
                        tags_list = post_tags[t].split(';')
                        sub_element = related_submission_elements[t].pk
                        for tag in tags_list:
                            # create a tag
                            if not tag or tag.isspace():
                                continue
                            create_tag_helper(request.session, tag, visibility, sub_element)

                    # custom tag (end)

                    return HttpResponseRedirect("/teacher/mark?submission=" + str(request.GET['submission']))

                else:
                    for related_submission_element in related_submission_elements:
                        if related_submission_element.get_status_display() != "Finished" or request.session.get(
                                'user_role',
                                None) == "Academic":
                            score = request.POST.get(str(related_submission_element.pk) + '_score')
                            if is_number(score):
                                if float(score) <= related_submission_element.element.maxInput:
                                    if request.POST.get(str(related_submission_element.pk) + '_needHelp'):
                                        # if not related_submission_element.needHelp:
                                        # Xiaofei send email
                                        # email_help(request, context)
                                        #
                                        # current_user = User.objects.get(
                                        #     userNumber=request.session.get('user_number', None))
                                        # user_email = User.objects.get(id=current_user.id).userEmail
                                        # send_mail("You need to help!!!", "message", settings.EMAIL_HOST_USER,
                                        #           ['s1953043@ed.ac.uk', user_email])
                                        related_submission_element.needHelp = True
                                    else:
                                        related_submission_element.needHelp = False
                                    if request.POST.get(str(related_submission_element.pk) + '_needModerate'):

                                        related_submission_element.needModerate = True
                                    else:
                                        related_submission_element.needModerate = False
                                    related_submission_element.score = float(score)
                                    related_submission_element.marker_id = request.session.get('user_id', None)
                                    related_submission_element.dateUpdated = datetime.now(timezone.utc)
                                    related_submission_element.feedback = json.dumps(
                                        {"start": request.POST.get(
                                            str(related_submission_element.pk) + '_feedback_start'),
                                            "middle": request.POST.get(
                                                str(related_submission_element.pk) + '_feedback_middle'),
                                            "end": request.POST.get(
                                                str(related_submission_element.pk) + '_feedback_end')})
                                    related_submission_element.save()
                                else:
                                    return HttpResponseRedirect("/teacher/mark?submission=" + str(
                                        request.GET['submission']) + "&error_element=" + str(
                                        related_submission_element.pk))
                            else:
                                return HttpResponseRedirect(
                                    "/teacher/mark?submission=" + str(
                                        request.GET['submission']) + "&error_element=" + str(
                                        related_submission_element.pk))

                    if 'complete' in request.POST:  # marking "complete"
                        # notifs for mark release
                        # send_mail("Marks released", "Marks are released for", settings.EMAIL_HOST_USER, ["s1953043@ed.ac.uk", User.objects.get(id=current_submission.student_id).userEmail])
                        notif = Notification(assignment=current_assignment,
                                             receiver=User.objects.get(id=current_submission.student_id), subject=6,
                                             status=0)
                        notif.save()
                        #

                        for related_submission_element in related_submission_elements:
                            related_submission_element.status = 2
                            related_submission_element.save()

                        course_related_submission = Submission.objects.filter(assignment=current_submission.assignment)
                        course_marker_related_submission_element = []

                        for submission in course_related_submission:
                            course_marker_submission_related_submission_element = SubmissionElement.objects.filter(
                                submission=submission, marker_id=request.session.get('user_id', None))
                            for element in course_marker_submission_related_submission_element:
                                course_marker_related_submission_element.append(element)
                                # Create or find the Tag
                                tag_name = f"{element.element.elementName} - {element.submission.assignment.assignmentTitle}"
                                tag, created = Tag.objects.get_or_create(name=tag_name)

                                # Parse the JSON string to a Python dictionary
                                try:
                                    feedback_data = json.loads(element.feedback)
                                except json.JSONDecodeError:
                                    # Handle the error appropriately, perhaps skip this element
                                    continue

                            print(f"feedback saving for element {element.id})")

                            # Create or Update Feedback
                            feedback, created = Feedback.objects.update_or_create(
                                author=element.marker,
                                element=element,
                                defaults={
                                    'date': datetime.now(),
                                    'start': feedback_data["start"],
                                    'middle': feedback_data["middle"],
                                    'end': feedback_data["end"],
                                    'marks_given': element.score,
                                    'total_marks': element.element.maxInput,
                                    'tag': tag
                                }
                            )
                    all_marked = True
                    for element in course_marker_related_submission_element:
                        if element.get_status_display() != "Finished":
                            all_marked = False
                        if request.session.get('user_role', None) == "Academic":
                            all_marked = False
                        if all_marked:  # this should have more weight
                            related_course2marker = Course2Marker.objects.filter(
                                course=current_submission.assignment.course)
                            # for course2marker in related_course2marker:
                            #     if course2marker.marker.get_role_display() == "Academic":
                            #         html_message = "<p>Dear " + course2marker.marker.userName + ": </p><p>" + request.session.get(
                            #             'user_role', None) + ": " + request.session.get('user_name',
                            #                                                             None) + "(" + request.session.get(
                            #             'user_number', None) + "), has finished all the marking.</p>"
                            #         send_mail('Marker finished marking', "",
                            #                   's2075864@ed.ac.uk', [course2marker.marker.userEmail], fail_silently=False,
                            #                   html_message=html_message)

                    return HttpResponseRedirect("/teacher/mark?submission=" + str(request.GET['submission']))
    else:  # request.method == GET
        if 'submission' in request.GET:
            try:
                current_submission = Submission.objects.get(pk=request.GET['submission'])
                current_assignment = current_submission.assignment

                current_relation = Course2Marker.objects.get(course=current_assignment.course,
                                                             marker_id=request.session.get('user_id', None))
                context['mark_permission'] = current_relation.markingPermission

                if current_relation.markingPermission == 2:
                    context['assignment'] = current_assignment
                    related_assignments = Assignment.objects.filter(course=current_assignment.course)
                    context['other_related_assignments'] = []
                    for related_assignment in related_assignments:
                        if related_assignment != current_assignment:
                            context['other_related_assignments'].append(related_assignment)

                    user_id = request.session.get('user_id', None)
                    saved_feedback_ids = []
                    if user_id:
                        saved_feedback_ids = list(
                            SavedFeedback.objects.filter(user_id=user_id).values_list('feedback_id', flat=True))

                    feedback_items = Feedback.objects.all()

                    for feedback in feedback_items:
                        feedback.is_saved = feedback.id in saved_feedback_ids
                        feedback.likes = Reaction.objects.filter(feedback=feedback, reaction_type='like').count()
                        feedback.dislikes = Reaction.objects.filter(feedback=feedback, reaction_type='dislike').count()

                        feedback.full_text = f"{feedback.start}\\n\\n{feedback.middle}\\n\\n{feedback.end}"
                        feedback.truncated_text = f"{feedback.start[:150]}..."  # Truncate the 'start' text to 150 characters

                    context['feedback_items'] = feedback_items
                    context['saved_feedback_ids'] = saved_feedback_ids
                    context['submission'] = current_submission
                    context['courses'] = Course.objects.all()

                    submission_id = request.GET.get('submission')
                    current_submission = Submission.objects.get(pk=submission_id)
                    submission_criterias_ordered = get_submission_criteria_ordered(current_submission)
                    context['submission_criterias'] = submission_criterias_ordered

                    context['related_submissions'] = Submission.objects.filter(assignment=current_assignment,
                                                                               student=current_submission.student)
                    # added : shuffling
                    if 'question' in request.GET:
                        context['question'] = int(request.GET['question'])
                        related_submission_elements = SubmissionElement.objects.filter(submission=current_submission,
                                                                                       element_id=int(
                                                                                           request.GET['question']))
                    else:
                        related_submission_elements = SubmissionElement.objects.filter(submission=current_submission)

                    for related_submission_element in related_submission_elements:
                        if related_submission_element.feedback:
                            try:
                                related_submission_element.feedback = json.loads(related_submission_element.feedback)
                            except:
                                related_submission_element.feedback = {"start": related_submission_element.feedback,
                                                                       "middle": "", "end": ""}
                        if related_submission_element.get_status_display() == "Submitted":
                            related_submission_element.status = 1
                            related_submission_element.save()

                    # tags view GET s

                    tag_list = TagCustom.objects.all()

                    if 'tag_delete' in request.GET:
                        pk = request.GET['tag_delete']

                        # find the tag in db and then
                        tag_to_delete = TagCustom.objects.get(pk=pk)

                        # delete
                        tag_to_delete.delete()

                    context['tag_list'] = tag_list
                    context['user_role'] = User.objects.get(pk=request.session.get('user_id')).role
                    context['user_id'] = request.session.get('user_id', None)

                    # tags view GET f

                    context['submission_elements'] = related_submission_elements
                    context['is_shuffle'] = False

                    if 'new_shuffle' in request.GET:

                        shuffled_students = get_shuffle_order(current_assignment, current_submission)
                        # save the random order to file.
                        with open("MarkEd/data/random", "wb") as fp:  # Pickling
                            pickle.dump(shuffled_students, fp)

                        context['shuffled_order'] = shuffled_students
                        context['is_shuffle'] = True

                        # fixed bug of wrong submissions being shown

                    if "shuffle" in request.GET or context['is_shuffle'] == True:
                        with open("MarkEd/data/random", "rb") as fp:  # Unpickling
                            shuffled_students = pickle.load(fp)

                        context['shuffled_order'] = shuffled_students
                        context['is_shuffle'] = True

                        prev_sub = get_previous_assignment(context, current_assignment,
                                                           current_submission, shuffle=True)
                        if prev_sub is not None:
                            context['previous_submission'] = prev_sub

                        next_sub = get_next_assignment(context, current_assignment, current_submission, shuffle=True)
                        if next_sub is not None:
                            context['next_submission'] = next_sub

                    # turn off shuffling...
                    else:
                        students_on_course = get_db_order(current_assignment, current_submission)
                        prev_sub = get_previous_assignment(context, current_assignment,
                                                           current_submission, db_order=students_on_course)
                        if prev_sub is not None:
                            context['previous_submission'] = prev_sub

                        context['next_submission'] = get_next_assignment(context, current_assignment,
                                                                         current_submission,
                                                                         db_order=students_on_course)
                        context['is_shuffle'] = False

                    if 'error_element' in request.GET:
                        context['error_element'] = int(request.GET['error_element'])

                    context['submission_status'] = get_submission_status(current_submission)
                    # checkTaskSendEmail(request, context)

                    related_assignment_elements = AssignmentElement.objects.filter(assignment=current_assignment)
                    context['page_elements'] = related_assignment_elements

                    context['page_info'] = []
                    related_course2students = Course2Student.objects.filter(course=current_assignment.course)
                    for related_course2student in related_course2students:
                        related_latest_submissions = Submission.objects.filter(student=related_course2student.student,
                                                                               assignment=current_assignment)
                        if related_latest_submissions.count() > 0:
                            related_latest_submission = related_latest_submissions.last()
                            related_elements_scores = []
                            related_submission_elements = SubmissionElement.objects.filter(
                                submission=related_latest_submission)
                            for related_submission_element in related_submission_elements:
                                if related_submission_element.score:
                                    related_elements_scores.append(related_submission_element.score)
                                else:
                                    related_elements_scores.append("-")
                            info = MarkerMarkPageInfo(related_latest_submission.student.userNumber,
                                                      related_elements_scores,
                                                      related_latest_submission.pk)
                            context['page_info'].append(info)

                    last_time_rec = TimeRecord.objects.filter(marker_id=request.session.get('user_id', None),
                                                              student=current_submission.student_id,
                                                              assignment_id=current_assignment.pk).order_by(
                        'datetime').last()
                    existing_time_dur = TimeDuration.objects.filter(marker_id=request.session.get('user_id', None),
                                                                    student=current_submission.student_id,
                                                                    assignment_id=current_assignment.pk).last()

                    hours_so_far, minutes_so_far, seconds_so_far = 0, 0, 0

                    # is the last entry in the database a 'E' or 'S' or 'nothing'
                    if last_time_rec is None:
                        time_record = TimeRecord(
                            marker_id=request.session.get('user_id', None),
                            student=current_submission.student_id,
                            assignment_id=current_assignment.pk,
                            type='S'
                        )
                        time_record.save()

                        context['btn_pressed'] = 'start'

                    if existing_time_dur is None:
                        new_duration = TimeDuration(
                            marker_id=request.session.get('user_id', None),
                            student=current_submission.student_id,
                            assignment_id=current_assignment.pk,
                            duration=timedelta(0),
                            selfDefined=False
                        )
                        new_duration.save()

                        context['btn_pressed'] = 'start'
                    elif last_time_rec.type == 'E':

                        hours_so_far, minutes_so_far, seconds_so_far = set_context_time(existing_time_dur)

                        context['btn_pressed'] = 'stop'
                    elif last_time_rec.type == 'S':

                        hours_so_far, minutes_so_far, seconds_so_far = set_context_time(existing_time_dur)

                        context['btn_pressed'] = 'start'

                    elif last_time_rec.type == 'C':
                        # add the all the time between S and last C if no E.

                        # find if before C was E or S

                        last_time_recs_query = TimeRecord.objects.filter(marker_id=request.session.get('user_id', None),
                                                                         student=current_submission.student_id,
                                                                         assignment_id=current_assignment.pk).order_by(
                            'datetime').reverse()[:1000]

                        record_S = find_last_rec_type_S(last_time_recs_query)
                        if record_S is not None:
                            # need to add a new timeDuration
                            timediff = time_diff_helper(record_S.datetime, last_time_rec.datetime)
                            update_duration(existing_time_dur, existing_time_dur.duration + timediff)

                        time_record = TimeRecord(
                            marker_id=request.session.get('user_id', None),
                            student=current_submission.student_id,
                            assignment_id=current_assignment.pk,
                            type='S'
                        )
                        time_record.save()

                        hours_so_far, minutes_so_far, seconds_so_far = set_context_time(existing_time_dur)

                        context['btn_pressed'] = 'start'

                    context['hours'] = hours_so_far
                    context['minutes'] = minutes_so_far
                    context['seconds'] = seconds_so_far

                    ## compute stats
                    avg_per_sub = compute_avg_time_stats(request.session.get('user_id', None), current_assignment.pk)
                    context['avg_per_sub'] = TimeDeltaBreakdown(avg_per_sub)

                    total_subs_marker = calc_total_subs_marker(request.session.get('user_id', None))
                    context['total_subs_marker'] = total_subs_marker
                    course_id = Assignment.objects.filter(id=current_assignment.pk).last().course_id
                    all_courseworks = Assignment.objects.filter(course_id=course_id).values_list("pk")
                    context['students_submitted_total'] = len(
                        Submission.objects.filter(assignment_id__in=all_courseworks))

                    total_duration_assignment = calc_total_time(request.session.get('user_id', None),
                                                                current_assignment.pk)
                    context['total_time'] = TimeDeltaBreakdown(total_duration_assignment)

                    total_marked_today = calc_total_subs_today(request.session.get('user_id', None))
                    context['total_marked_today'] = total_marked_today

                    # timer GET END

                    return render(request, 'teacher/mark.html', context)
                else:
                    return HttpResponseRedirect("/")
            except:
                return HttpResponseRedirect("/")
    return HttpResponseRedirect("/")


def get_submission_criteria_ordered(submission):
    root_criteria_qs = Criteria.objects.filter(assignment=submission.assignment, parent__isnull=True)
    ordered_submission_criteria = []

    def append_submission_criteria(criteria_qs, parent_submission_criteria_list, hierarchy_path=[]):
        for criteria in criteria_qs:
            # Build the new hierarchy path for this criteria
            new_hierarchy_path = hierarchy_path + [criteria.name]

            # Check if the criteria has children
            child_criteria_qs = criteria.children.all()
            if not child_criteria_qs.exists():
                # This criteria is at the lowest level (has no children), process it
                submission_criteria_qs = SubmissionCriteria.objects.filter(submission=submission, criteria=criteria)

                for submission_criteria in submission_criteria_qs:
                    # Annotate and add the submission criteria
                    annotate_submission_criteria(submission_criteria, new_hierarchy_path, criteria.marks, criteria.marking_scheme)
                    parent_submission_criteria_list.append(submission_criteria)
            else:
                # Criteria has children, recursively process them
                append_submission_criteria(child_criteria_qs, parent_submission_criteria_list, new_hierarchy_path)

    def annotate_submission_criteria(submission_criteria, hierarchy_path, maxInput, marking_scheme):
        # Annotate submission criteria with hierarchical name and max input marks
        submission_criteria.name = ' - '.join(hierarchy_path)
        submission_criteria.maxInput = maxInput
        submission_criteria.marking_scheme = marking_scheme

        try:
            submission_criteria.feedback = json.loads(submission_criteria.feedback)
        except (TypeError, json.JSONDecodeError):
            submission_criteria.feedback = {"start": "", "middle": "", "end": ""}

        # Since we're only adding lowest level criteria, we attach elements here
        submission_criteria.elements = list(submission_criteria.criteria.elements.all()) if submission_criteria.criteria else []

    append_submission_criteria(root_criteria_qs, ordered_submission_criteria)
    return ordered_submission_criteria


def get_criteria_marks_summary(request, criteria_id):
    try:
        editing_criterion_id = request.GET.get('editingCriterionId')
        parent_criteria = Criteria.objects.get(pk=criteria_id)
        child_criteria = parent_criteria.children

        # Calculate the sum of marks for all child criteria
        children_total_marks = child_criteria.exclude(pk=editing_criterion_id).aggregate(Sum('marks'))['marks__sum'] or 0

        return JsonResponse({
            'status': 'success',
            'parentMarks': parent_criteria.marks,
            'childrenTotalMarks': children_total_marks,
        })
    except Criteria.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Parent criteria not found'}, status=404)
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
def get_shuffle_order(current_assignment, current_submission):
    current_student_id = current_submission.student.pk
    students_on_course = [x['student'] for x in
                          list(Course2Student.objects.filter(course_id=current_assignment.course).values('student'))]
    students_submitted = [x['student'] for x in list(
        Submission.objects.filter(student_id__in=students_on_course, assignment_id=current_assignment.pk).values(
            'student').distinct())]
    idx = students_submitted.index(current_student_id)
    list_so_far = students_submitted[:idx + 1]
    to_shuffle = students_submitted[idx + 1:]
    random.shuffle(to_shuffle)
    students_on_course = list_so_far + to_shuffle
    return students_on_course


def get_db_order(current_assignment, current_submission):
    current_student_id = current_submission.student.pk
    students_course_db = Course2Student.objects.filter(course_id=current_assignment.course)
    students_on_course = [x['student'] for x in
                          list(students_course_db.values('student'))]
    students_submitted = [x['student'] for x in list(
        Submission.objects.filter(student_id__in=students_on_course, assignment_id=current_assignment.pk).values(
            'student').distinct())]
    return students_submitted


def get_previous_assignment(context, current_assignment, current_submission, db_order=None, shuffle=False):
    current_student_id = current_submission.student.pk
    if shuffle:
        shuffled_order = context['shuffled_order']
        idx = shuffled_order.index(current_student_id)
        if (idx == 0):
            return None
        prev_student = shuffled_order[idx - 1]
        prev_submission = Submission.objects.filter(student_id=prev_student, assignment_id=current_assignment).last()
        assert prev_submission.student.pk == shuffled_order[idx - 1]
        return prev_submission
    else:
        students_on_course = db_order
        idx = students_on_course.index(current_submission.student.pk)
        if (idx == 0):
            return None
        prev_student = students_on_course[idx - 1]
        prev_submission = Submission.objects.filter(student_id=prev_student, assignment_id=current_assignment).last()
        assert prev_submission.student.pk == students_on_course[idx - 1]
        return prev_submission


def get_next_assignment(context, current_assignment, current_submission, db_order=None, shuffle=False):
    if shuffle:
        shuffled_order = context['shuffled_order']
        current_student_id = current_submission.student.pk
        idx = shuffled_order.index(current_student_id)
        if (idx == len(shuffled_order) - 1):
            return None
        next_student = shuffled_order[idx + 1]
        next_submission = Submission.objects.filter(student_id=next_student, assignment_id=current_assignment).last()
        assert next_submission.student.pk == shuffled_order[idx + 1]
        return next_submission

    else:
        students_on_course = db_order
        idx = students_on_course.index(current_submission.student.pk)
        if (idx == len(students_on_course) - 1):
            return None
        next_student = students_on_course[idx + 1]
        prev_submission = Submission.objects.filter(student_id=next_student, assignment_id=current_assignment).last()
        assert prev_submission.student.pk == students_on_course[idx + 1]
        return prev_submission


def compare(request):
    if not request.session.get('is_login', None):
        return HttpResponseRedirect("/login")
    if request.session.get('user_role', None) == "Student":
        return HttpResponseRedirect("/student/home")
    context = {}
    context['current_page'] = "marking"
    if request.method == "GET":
        if 'left' in request.GET and 'right' in request.GET and 'question' in request.GET:
            if 'error_element' in request.GET:
                context['error_element'] = int(request.GET['error_element'])

            left_submission = Submission.objects.get(pk=request.GET['left'])
            right_submission = Submission.objects.get(pk=request.GET['right'])

            current_relation = Course2Marker.objects.get(course=left_submission.assignment.course,
                                                         marker_id=request.session.get('user_id', None))
            context['mark_permission'] = current_relation.markingPermission

            context['left_submission'] = left_submission
            context['right_submission'] = right_submission

            current_assignment = left_submission.assignment
            context['assignment'] = current_assignment
            related_assignments = Assignment.objects.filter(course=current_assignment.course)
            context['other_related_assignments'] = []
            for related_assignment in related_assignments:
                if related_assignment != current_assignment:
                    context['other_related_assignments'].append(related_assignment)

            left_element = SubmissionElement.objects.get(submission=left_submission, element_id=request.GET['question'])
            right_element = SubmissionElement.objects.get(submission=right_submission,
                                                          element_id=request.GET['question'])
            if left_element.feedback:
                try:
                    left_element.feedback = json.loads(left_element.feedback)
                except:
                    left_element.feedback = {"start": left_element.feedback, "middle": "", "end": ""}
            if left_element.get_status_display() == "Submitted":
                left_element.status = 1
                left_element.save()
            if right_element.feedback:
                try:
                    right_element.feedback = json.loads(right_element.feedback)
                except:
                    right_element.feedback = {"start": right_element.feedback, "middle": "", "end": ""}
            if right_element.get_status_display() == "Submitted":
                right_element.status = 1
                right_element.save()
            context['left_element'] = left_element
            context['right_element'] = right_element

            context['left_related_submissions'] = Submission.objects.filter(assignment=left_submission.assignment,
                                                                            student=left_submission.student)
            context['right_related_submissions'] = Submission.objects.filter(assignment=right_submission.assignment,
                                                                             student=right_submission.student)

            context['left_submission_status'] = get_submission_status(left_submission)
            context['right_submission_status'] = get_submission_status(right_submission)
            return render(request, 'teacher/compare.html', context)
    elif request.method == "POST":
        if 'element' in request.GET:
            current_element = SubmissionElement.objects.get(pk=request.GET['element'])
            current_submission = current_element.submission
            if current_element.get_status_display() != "Finished" or request.session.get('user_role',
                                                                                         None) == "Academic":
                score = request.POST.get('score')
                left_submission = SubmissionElement.objects.get(pk=request.POST.get('left_element')).submission
                right_submission = SubmissionElement.objects.get(pk=request.POST.get('right_element')).submission
                if is_number(score):
                    if float(score) <= current_element.element.maxInput:
                        if request.POST.get('needHelp'):
                            if not current_element.needHelp:
                                # Xiaofei send email
                                email_help(request, context)
                                #
                            current_element.needHelp = True
                        else:
                            current_element.needHelp = False
                        if request.POST.get('needModerate'):
                            if not current_element.needModerate:
                                # Xiaofei send email
                                email_moderate(request, context)
                                #
                            current_element.needModerate = True
                        else:
                            current_element.needModerate = False
                        current_element.score = float(score)
                        current_element.feedback = json.dumps(
                            {"start": request.POST.get('feedback_start'),
                             "middle": request.POST.get('feedback_middle'),
                             "end": request.POST.get('feedback_end')})
                        current_element.marker_id = request.session.get('user_id', None)
                        current_element.save()

                        if 'complete' in request.POST:
                            current_element.marker_id = request.session.get('user_id', None)
                            current_element.status = 2
                            current_element.save()

                            course_related_submission = Submission.objects.filter(
                                assignment=current_submission.assignment)
                            course_marker_related_submission_element = []
                            for submission in course_related_submission:
                                course_marker_submission_related_submission_element = SubmissionElement.objects.filter(
                                    submission=submission, marker_id=request.session.get('user_id', None))
                                for element in course_marker_submission_related_submission_element:
                                    course_marker_related_submission_element.append(element)
                            all_marked = True
                            for element in course_marker_related_submission_element:
                                if element.get_status_display() != "Finished":
                                    all_marked = False
                            if len(course_marker_related_submission_element) == 0:
                                all_marked = False
                            if request.session.get('user_role', None) == "Academic":
                                all_marked = False
                            if all_marked:
                                related_course2marker = Course2Marker.objects.filter(
                                    course=current_submission.assignment.course)
                                for course2marker in related_course2marker:
                                    if course2marker.marker.get_role_display() == "Academic":
                                        html_message = "<p>Dear " + course2marker.marker.userName + ": </p><p>" + request.session.get(
                                            'user_role', None) + ": " + request.session.get('user_name',
                                                                                            None) + "(" + request.session.get(
                                            'user_number', None) + "), has finished all the marking.</p>"
                                        send_mail('Marker finished marking', "",
                                                  's2075864@ed.ac.uk', [course2marker.marker.userEmail],
                                                  fail_silently=False,
                                                  html_message=html_message)

                        return HttpResponseRedirect(
                            "/teacher/compare?left=" + str(left_submission.pk) + "&right=" + str(
                                right_submission.pk) + "&question=" + str(current_element.element.pk))
                    else:
                        return HttpResponseRedirect(
                            "/teacher/compare?left=" + str(left_submission.pk) + "&right=" + str(
                                right_submission.pk) + "&question=" + str(
                                current_element.element.pk) + "&error_element=" + str(current_element.pk))
                else:
                    return HttpResponseRedirect("/teacher/compare?left=" + str(left_submission.pk) + "&right=" + str(
                        right_submission.pk) + "&question=" + str(current_element.element.pk) + "&error_element=" + str(
                        current_element.pk))
    return HttpResponseRedirect("/")

def uploadMarkscheme(request):
    # Check if user is logged in and is a teacher
    if not request.session.get('is_login', None) or request.session.get('user_role', None) != "Academic":
        return HttpResponseRedirect("/login")

    if request.method == "POST":
        assignment_id = request.GET.get('assignment')
        if assignment_id and request.FILES.get('markscheme'):
            # Fetch the assignment
            try:
                assignment = Assignment.objects.get(pk=assignment_id)
            except Assignment.DoesNotExist:
                return JsonResponse({'status': 'error', 'message': 'Assignment not found.'}, status=404)

            # Check if a markscheme already exists for this assignment
            existing_mark_scheme = Markscheme.objects.filter(assignment=assignment).first()
            if existing_mark_scheme:
                # Update the existing markscheme
                existing_mark_scheme.file.delete(save=False)  # Delete the old file
                existing_mark_scheme.file = request.FILES['markscheme']
                existing_mark_scheme.save()
            else:
                # Create a new markscheme record for this assignment
                new_mark_scheme = Markscheme(assignment=assignment, file=request.FILES['markscheme'])
                new_mark_scheme.save()

            return JsonResponse({'status': 'success', 'message': 'Mark-scheme uploaded successfully!'})

        else:
            return JsonResponse({'status': 'error', 'message': 'You must select a file to upload.'}, status=400)

    else:
        return JsonResponse({'status': 'error', 'message': 'Invalid request method.'}, status=400)


def uploadQuestionpaper(request):
    # Check if user is logged in and is a teacher
    if not request.session.get('is_login', None) or request.session.get('user_role', None) != "Academic":
        return HttpResponseRedirect("/login")

    if request.method == "POST":
        assignment_id = request.GET.get('assignment')
        if assignment_id and request.FILES.get('questionpaper'):
            # Fetch the assignment
            try:
                assignment = Assignment.objects.get(pk=assignment_id)
            except Assignment.DoesNotExist:
                return JsonResponse({'status': 'error', 'message': 'Assignment not found.'}, status=404)

            # Check if a markscheme already exists for this assignment
            existing_question_paper = Questionpaper.objects.filter(assignment=assignment).first()
            if existing_question_paper:
                # Update the existing markscheme
                existing_question_paper.file.delete(save=False)  # Delete the old file
                existing_question_paper.file = request.FILES['questionpaper']
                existing_question_paper.save()
            else:
                # Create a new markscheme record for this assignment
                new_question_paper = Questionpaper(assignment=assignment, file=request.FILES['questionpaper'])
                new_question_paper.save()

            return JsonResponse({'status': 'success', 'message': 'Question-paper uploaded successfully!'})

        else:
            return JsonResponse({'status': 'error', 'message': 'You must select a file to upload.'}, status=400)

    else:
        return JsonResponse({'status': 'error', 'message': 'Invalid request method.'}, status=400)

def generateFeedback(request):
    if not request.session.get('is_login', None) or request.session.get('user_role', None) != "Academic":
        return HttpResponseRedirect("/login")

    print("Entering generateFeedback()...")

    if request.method == "GET":
        try:

            element_id = int(request.GET.get('element'))
            assignment_id = int(request.GET.get('assignment'))
            submission_id = int(request.GET.get('submission'))

            assignment_element = AssignmentElement.objects.get(pk=element_id)
            current_submission = Submission.objects.get(pk=submission_id)

            mark_scheme = Markscheme.objects.filter(assignment=assignment_id).first()
            question_paper = Questionpaper.objects.filter(assignment=assignment_id).first()

            if not mark_scheme or not question_paper:
                return JsonResponse({'status': 'error', 'message': 'Required documents not found.'}, status=404)
            
            qp_content = parse_pdf(question_paper.file.path)
            ms_content = parse_pdf(mark_scheme.file.path)
            submission_content = parse_pdf(current_submission.submissionFile.path)

            # Reset and instantiate Marker and Student if assignment_id or submission_id has changed
            if Marker.last_assignment_id != assignment_id or Marker.last_submission_id != submission_id:
                Marker.reset()
                Marker.last_assignment_id = assignment_id
                Marker.last_submission_id = submission_id
            marker = Marker(assignment_id)

            if Student.last_assignment_id != assignment_id or Student.last_submission_id != submission_id:
                Student.reset()
                Student.last_assignment_id = assignment_id
                Student.last_submission_id = submission_id
            student = Student(assignment_id)

            print("Initialising marker and student objects...")
            marker.initialise(qp_content, ms_content)
            student.initialise(submission_content)

            print("Generating feedback...")
            feedback_generator = FeedbackGenerator(marker, student)
            feedback_generator.initialise()
            feedback = feedback_generator.generate_feedback_for_question(assignment_element.elementName)
            print("Finished generating feedback.")

            return JsonResponse({'status': 'success', 'message': 'Feedback generated successfully!', 'feedback': feedback})

        except ValueError:
            return JsonResponse({'status': 'error', 'message': 'Invalid ID format.'}, status=400)
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

    else:
        return JsonResponse({'status': 'error', 'message': 'Invalid request method.'}, status=400)


def update_reaction(request):
    if not request.session.get('is_login', None) or request.session.get('user_role', None) != "Academic":
        return HttpResponseRedirect("/login")

    if request.method == 'POST' and request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        try:
            feedback_id = request.POST.get('feedback_id')
            reaction_type = request.POST.get('reaction_type')

            if not feedback_id or not reaction_type:
                return JsonResponse({'success': False, 'error': 'Missing data'}, status=400)

            user_id = request.session.get('user_id', None)
            if not user_id:
                return JsonResponse({'success': False, 'error': 'User not logged in'}, status=401)

            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return JsonResponse({'success': False, 'error': 'User not found'}, status=404)

            # Check if feedback exists
            try:
                feedback = Feedback.objects.get(id=feedback_id)
            except Feedback.DoesNotExist:
                return JsonResponse({'success': False, 'error': 'Feedback not found'}, status=404)

            # Get or create the reaction
            reaction, created = Reaction.objects.get_or_create(
                feedback=feedback,
                user=user,
                defaults={'reaction_type': reaction_type}
            )

            # Update reaction type if it's an existing reaction but with a different type
            if not created and reaction.reaction_type != reaction_type:
                reaction.reaction_type = reaction_type
                reaction.save()

            # Calculate the count of likes and dislikes
            likes = Reaction.objects.filter(feedback=feedback, reaction_type='like').count()
            dislikes = Reaction.objects.filter(feedback=feedback, reaction_type='dislike').count()

            return JsonResponse({'success': True, 'likes': likes, 'dislikes': dislikes})

        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=500)

    else:
        return JsonResponse({'success': False, 'error': 'Invalid request method'}, status=400)


def save_feedback(request):
    if request.method == 'POST':
        user_id = request.session.get('user_id', None)
        feedback_id = request.POST.get('feedback_id')

        if not user_id or not feedback_id:
            return JsonResponse({'success': False, 'error': 'Missing user or feedback ID'}, status=400)

        try:
            user = User.objects.get(id=user_id)
            feedback = Feedback.objects.get(id=feedback_id)

            saved_feedback, created = SavedFeedback.objects.get_or_create(user=user, feedback=feedback)

            if not created:
                saved_feedback.delete()
                message = 'Feedback unsaved successfully'
            else:
                message = 'Feedback saved successfully'

            return JsonResponse({'success': True, 'message': message})

        except User.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'User not found'}, status=404)
        except Feedback.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Feedback not found'}, status=404)
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=500)

    else:
        return JsonResponse({'success': False, 'error': 'Invalid request method'}, status=400)


def get_saved_feedback(request):
    user_id = request.session.get('user_id', None)
    if not user_id:
        return JsonResponse({'success': False, 'error': 'User not logged in'}, status=401)

    try:
        user = User.objects.get(id=user_id)
        saved_feedback = SavedFeedback.objects.filter(user=user).select_related('feedback').all()
        feedback_data = [{
            'id': sf.feedback.id,
            'author': sf.feedback.author.userName,
            'marks_given': sf.feedback.marks_given,
            'total_marks': sf.feedback.total_marks,
            'full_text': sf.feedback.full_text,
            'truncated_text': sf.feedback.truncated_text,
            # Add other necessary fields
        } for sf in saved_feedback]

        return JsonResponse({'success': True, 'feedback_items': feedback_data})

    except User.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'User not found'}, status=404)


def get_suggestions(request):
    text = request.GET.get('text', '')
    feedback_type = request.GET.get('feedback_type', 'start')  # Default to 'start' if not specified
    # Logic to query Feedback table and find relevant suggestions
    if feedback_type == 'start':
        suggestions = Feedback.objects.filter(start__icontains=text).values_list('start', flat=True)[:5]
    elif feedback_type == 'middle':
        suggestions = Feedback.objects.filter(middle__icontains=text).values_list('middle', flat=True)[:5]
    elif feedback_type == 'end':
        suggestions = Feedback.objects.filter(end__icontains=text).values_list('end', flat=True)[:5]
    else:
        suggestions = []
    return JsonResponse({'suggestions': list(suggestions)})


def get_search_results(request):
    query = request.GET.get('term', '')  # 'term' is used by jQuery UI Autocomplete
    suggestions = Feedback.objects.filter(
        Q(start__icontains=query) |
        Q(middle__icontains=query) |
        Q(end__icontains=query)
    ).distinct().values_list('start', flat=True)[:10]

    return JsonResponse({'suggestions': list(suggestions)})


# timer helpers
def time_diff_helper(start, end):
    time_delta = end - start

    return time_delta


def set_context_time(curr_duration_obj):
    seconds_so_far = curr_duration_obj.duration.seconds % 60
    minutes_so_far = (curr_duration_obj.duration.seconds // 60) % 60
    hours_so_far = (curr_duration_obj.duration.seconds // 60) // 60

    return hours_so_far, minutes_so_far, seconds_so_far


def update_duration(time_dur_obj, new_duration):
    time_dur_obj.duration = new_duration
    time_dur_obj.save(update_fields=["duration"])


def get_duration_obj(marker_id, student_id, assignment_id):
    return TimeDuration.objects.filter(marker_id=marker_id, student=student_id, assignment_id=assignment_id).last()


def find_last_rec_type_S(last_time_recs_query):
    for record in last_time_recs_query:
        if record.type == 'S':
            return record
        elif record.type == 'E':
            return None
    return None


def compute_avg_time_stats(marker_id, assignment_id):
    mark_assign_query = TimeDuration.objects.filter(marker_id=marker_id, assignment_id=assignment_id)
    if len(mark_assign_query) == 0:
        return timedelta(0)

    timedelta_list = [td[0] for td in list(mark_assign_query.values_list("duration"))]
    return sum(timedelta_list, timedelta()) / len(mark_assign_query)


def calc_total_subs_marker(marker_id):
    query_submission_elements = SubmissionElement.objects.filter(marker_id=marker_id, status=2)
    distinct_subs_marked = query_submission_elements.values('submission_id').distinct()
    return len(distinct_subs_marked)


def calc_total_time(marker_id, assignment_id):
    mark_assign_query = TimeDuration.objects.filter(marker_id=marker_id, assignment_id=assignment_id)
    if len(mark_assign_query) == 0:
        return timedelta(0)

    timedelta_list = [td[0] for td in list(mark_assign_query.values_list("duration"))]
    return sum(timedelta_list, timedelta())


def calc_total_subs_today(marker_id):
    today = datetime.now(timezone.utc).date()
    query_submission_elements = SubmissionElement.objects.filter(dateUpdated__year=today.year,
                                                                 dateUpdated__month=today.month,
                                                                 dateUpdated__day=today.day)
    distinct_subs_marked = query_submission_elements.values('submission_id').distinct()
    return len(distinct_subs_marked)


""" "Stop" pressed """


def last_update(request):

    current_student_id = request.POST['student']
    current_assignment_id = request.POST['assignment']

    time_record = TimeRecord(
        marker_id=request.session.get('user_id', None),
        student=current_student_id,
        assignment_id=current_assignment_id,
        type='C'
    )
    time_record.save()

    return HttpResponseRedirect('/')


def bulk_assign_marks(request, context):
    # check if no student eiether mistake or not bulk assign anyway.
    if 'bulkStudentSub' not in request.POST:
        return

    student_sub_list = request.POST.getlist('bulkStudentSub')
    adj_type = request.POST['bulkRadios']
    adj_val = float(request.POST['bulkAssignValue'])
    # --- if only one criterion to mark out of ---
    criteria = context['page_elements']
    # if more, then leave
    if criteria.count() > 1:
        return
    # need to get max input
    max_mark = criteria.last().maxInput
    min_mark = 0

    submission_elements = SubmissionElement.objects.filter(submission_id__in=student_sub_list)
    if submission_elements.count() != len(student_sub_list):
        print("ERROR, investigate.")
    ## iterate through these (should be one per student)
    for submission_element in submission_elements:
        ## adjust mark
        adjusted_mark = submission_element.score
        if adj_type == 'option1':
            current_score = submission_element.score if submission_element.score is not None else 0
            adjusted_mark = current_score * adj_val
        elif adj_type == 'option2':
            adjusted_mark = adj_val
        elif adj_type == 'option3':
            adjusted_mark = round(((max_mark / 100) * adj_val), 1)

        ## check that calc does not go over max or under 0
        adjusted_mark = max_mark if adjusted_mark > max_mark else adjusted_mark
        adjusted_mark = 0 if adjusted_mark < min_mark else adjusted_mark

        ## update mark
        submission_element.score = adjusted_mark
        submission_element.save()
    # can we add a success message
    messages.success(request, 'Marks have been updated!')


def create_tag_helper(user, name, visibility, sub_element):
    tag_custom = TagCustom(
        name=name,
        owner_id=user.get('user_id', None),
        subElement_id=sub_element,
        # in frontend template, the markers should not be able to click the "academics only" option.
        visibility=visibility
    )
    tag_custom.save()

def module_switch(request):
    if not request.session.get('is_login', None):
        return HttpResponseRedirect("/login")
    
    module_id = request.GET['moduleId']
    checked = request.GET['checked']
    assignment_id = request.GET['assignment']
    user_id = request.session.get('user_id')


    user_module = UserModule.objects.filter(user=user_id, module=module_id, assignment=assignment_id)
    if len(user_module) == 0 and checked == 'false':
        # there is no such module installed in user interface
        module = Module.objects.get(id=module_id)
        UserModule.objects.create(status=1, configuration=module.configuration, module_id=module_id, user_id=user_id, assignment=assignment_id)
    elif len(user_module) != 0 and checked == 'false':
        UserModule.objects.filter(user=user_id, module=module_id, assignment=assignment_id).update(status=1)
    else:
        UserModule.objects.filter(user=user_id, module=module_id, assignment=assignment_id).update(status=2)

        
    
    return HttpResponseRedirect("/")

def module_configuration(request):
    if not request.session.get('is_login', None):
        return HttpResponseRedirect("/login")

    user_id = request.session.get('user_id')
    module_id = request.GET['moduleId']
    assignment_id = request.GET['assignment']
    
    context = {}
    context['submission_set'] = 0
    

    current_assignment = Assignment.objects.get(pk=request.GET['assignment'])
    current_relation = Course2Marker.objects.get(course=current_assignment.course,
                                                 marker_id=request.session.get('user_id', None))
    context['assignment'] = current_assignment
    context['mark_permission'] = current_relation.markingPermission
    related_assignments = Assignment.objects.filter(course=current_assignment.course)
    context['other_related_assignments'] = []

    user_module = UserModule.objects.filter(user=user_id, module=module_id, assignment=assignment_id)
    if len(user_module) == 0:
        # there is no such module installed in user interface
        module = Module.objects.get(id=module_id)
        UserModule.objects.create(status=2, configuration=module.configuration, module_id=module_id, user_id=user_id, assignment_id=assignment_id)
        configuration_path = module.configuration_path
        configuration = ast.literal_eval(module.configuration)
        context['configuration'] = configuration
        if module_id == 1:
            context['number'] = configuration.number
        context['name'] = module.name
    elif len(user_module) != 0:
        module = Module.objects.get(id=module_id)
        configuration_path = module.configuration_path
        context['configuration'] = ast.literal_eval(user_module.first().configuration)
        if module_id == 1:
            context['number'] = configuration.number
        context['name'] = module.name

    context['moduleId'] = module_id
    context['assignment_id'] = request.GET['assignment']
    return render(request, 'modules' + configuration_path, context)

def submission_module_configuration(request):
    if not request.session.get('is_login', None):
        return HttpResponseRedirect("/login")

    user_id = request.session.get('user_id')

    module_id = request.POST.get('moduleId')
    

    submission_set = request.POST.get('submission_set')
    assignment_id = request.POST.get('assignment')
    jump = request.POST.get('jump')

    if jump == '1':
        context = {}
        submission_set = int(submission_set)
        context['submission_set'] = submission_set + 1
        context['previousUrl'] = request.POST.get('previousUrl')
        context['assignment_id'] = assignment_id
        context['moduleId'] = module_id

        module = Module.objects.get(id=module_id)
        configuration_path = module.configuration_path
        user_module = UserModule.objects.filter(user=user_id, module=module_id, assignment=assignment_id)
        context['configuration'] = ast.literal_eval(user_module.first().configuration)
        context['name'] = module.name
        if submission_set == 0:
            date = request.POST.get('datepicker', '12/12/2025')
            number = request.POST.get('number', -1)
            number = int(number)
            multipleAllowed = request.POST.get('multipleAllowed', '')
            submissionTimes = request.POST.get('submissionTimes', -1)
            extensionAllowed = request.POST.get('extensionAllowed', '')

            current_module = UserModule.objects.get(user=user_id, module=module_id, assignment=assignment_id)
            configuration = current_module.configuration
            mydict = ast.literal_eval(configuration)

            

            mydict['date'] = date

            mydict['number'] = number
            context['number'] = number

            if multipleAllowed == '':
                mydict['multipleSubmission'] = 0
            else:
                mydict['multipleSubmission'] = 1
            
            if submissionTimes != -1:
                mydict['maximumTime'] = submissionTimes
            

            if extensionAllowed == '':
                mydict['lateSubmission'] = 0
            else:
                mydict['lateSubmission'] = 1

            json_config = json.dumps(mydict)
            context['file'] = mydict['file1']

            UserModule.objects.filter(user=user_id, module=module_id, assignment=assignment_id).update(configuration=json_config)
            set_student_submission(json_config, assignment_id)
            return render(request, 'modules' + configuration_path, context)
        
        else:
            current_module = UserModule.objects.get(user=user_id, module=module_id, assignment=assignment_id)
            configuration = current_module.configuration
            mydict = ast.literal_eval(configuration)

            key = "file" + str(submission_set)
            format = request.POST.get('format', '')
            size = request.POST.get('size', -1)
            name = request.POST.get('name', '')
        
            format_dict = {}
            format_dict['format'] = format

            size_dict = {}
            size_dict['size'] = size

            name_dict = {}
            name_dict['name'] = name

            mydict[key] = [format_dict, size_dict, name_dict]
            json_config = json.dumps(mydict)

            UserModule.objects.filter(user=user_id, module=module_id, assignment=assignment_id).update(configuration=json_config)
            context['number'] = int(mydict['number'])
            next_file = 'file' + str(submission_set + 1)
            
            if submission_set < int(mydict['number']):
                exists = mydict.get(next_file, None)
                if exists is None:
                    context['file'] = [{'format':'pdf'}, {'size':1}, {'name':'any'}]
                else:
                    context['file'] = mydict[next_file]
                set_student_submission(json_config, assignment_id)
                return render(request, 'modules' + configuration_path, context)
            else:
                context['file'] = []
                # mydict.pop("file0", None)
                
                for i in range(submission_set + 1, 9):
                    mydict.pop("file" + str(i), None)
                
                json_config = json.dumps(mydict)
                UserModule.objects.filter(user=user_id, module=module_id, assignment=assignment_id).update(configuration=json_config)
                set_student_submission(json_config, assignment_id)
                return HttpResponseRedirect(request.POST.get('previousUrl'))
    else:
        context = {}
        submission_set = int(submission_set)
        context['submission_set'] = submission_set - 1
        context['previousUrl'] = request.POST.get('previousUrl')
        context['assignment_id'] = assignment_id
        context['moduleId'] = module_id

        module = Module.objects.get(id=module_id)
        configuration_path = module.configuration_path
        user_module = UserModule.objects.filter(user=user_id, module=module_id, assignment=assignment_id)
        context['configuration'] = ast.literal_eval(user_module.first().configuration)
        context['name'] = module.name


        current_module = UserModule.objects.get(user=user_id, module=module_id, assignment=assignment_id)
        configuration = current_module.configuration
        mydict = ast.literal_eval(configuration)
        key = "file" + str(submission_set)
        format = request.POST.get('format', '')
        size = request.POST.get('size', -1)
        name = request.POST.get('name', '')
    
        format_dict = {}
        format_dict['format'] = format
        size_dict = {}
        size_dict['size'] = size
        name_dict = {}
        name_dict['name'] = name
        mydict[key] = [format_dict, size_dict, name_dict]
        json_config = json.dumps(mydict)
        
        UserModule.objects.filter(user=user_id, module=module_id, assignment=assignment_id).update(configuration=json_config)

        if submission_set == 1:
            set_student_submission(json_config, assignment_id)
            return render(request, 'modules' + configuration_path, context)
        else:
            current_module = UserModule.objects.get(user=user_id, module=module_id, assignment=assignment_id)
            configuration = current_module.configuration
            mydict = ast.literal_eval(configuration)

            context['number'] = int(mydict['number'])
            next_file = 'file' + str(submission_set - 1)

            exists = mydict.get(next_file, None)
            if exists is None:
                context['file'] = [{'format':'pdf'}, {'size':1}, {'name':'any'}]
            else:
                context['file'] = mydict[next_file]
            set_student_submission(json_config, assignment_id)
            return render(request, 'modules' + configuration_path, context)


def save_formats(request):
    if not request.session.get('is_login', None):
        return HttpResponseRedirect("/login")

    user_id = request.session.get('user_id')

    module_id = 1 # submission_module

    
    format = request.POST.get('format')
    key = request.POST.get('key')
    assignment_id = request.POST.get('assignment')
    

    current_module = UserModule.objects.get(user=user_id, module=module_id, assignment=assignment_id)
    configuration = current_module.configuration


    mydict = ast.literal_eval(configuration)

    if format is not None:
        mydict[key][0]['format'] = format

    json_config = json.dumps(mydict)

    UserModule.objects.filter(user=user_id, module=module_id, assignment=assignment_id).update(configuration=json_config)

    set_student_submission(json_config, assignment_id)
    return JsonResponse({"success":format})

def get_submission_files(request):
    if not request.session.get('is_login', None):
        return HttpResponseRedirect("/login")

    user_id = request.session.get('user_id')

    module_id = 1 # submission_module
    assignment_id = request.POST.get('assignment')  
    
    file = request.POST.get('file')
    

    current_module = UserModule.objects.get(user=user_id, module=module_id, assignment=assignment_id)
    configuration = current_module.configuration

    mydict = ast.literal_eval(configuration)
    
    return JsonResponse({"result": mydict.get(file, None)})

def save_size(request):
    if not request.session.get('is_login', None):
        return HttpResponseRedirect("/login")

    user_id = request.session.get('user_id')
    assignment_id = request.POST.get('assignment')

    module_id = 1 # submission_module

    
    size = request.POST.get('size')
    key = request.POST.get('file')
    

    current_module = UserModule.objects.get(user=user_id, module=module_id, assignment=assignment_id)
    configuration = current_module.configuration


    mydict = ast.literal_eval(configuration)

    if size is not None:
        mydict[key][1]['size'] = size

    json_config = json.dumps(mydict)

    UserModule.objects.filter(user=user_id, module=module_id, assignment=assignment_id).update(configuration=json_config)
    set_student_submission(json_config, assignment_id)
    
    return JsonResponse({"success":size})


def save_name(request):
    if not request.session.get('is_login', None):
        return HttpResponseRedirect("/login")

    user_id = request.session.get('user_id')
    assignment_id = request.POST.get('assignment')

    module_id = 1 # submission_module

    
    name = request.POST.get('name')
    key = request.POST.get('file')
    

    current_module = UserModule.objects.get(user=user_id, module=module_id, assignment=assignment_id)
    configuration = current_module.configuration


    mydict = ast.literal_eval(configuration)

    if name is not None:
        mydict[key][2]['name'] = name

    json_config = json.dumps(mydict)

    UserModule.objects.filter(user=user_id, module=module_id, assignment=assignment_id).update(configuration=json_config)

    set_student_submission(json_config, assignment_id)
    return JsonResponse({"success":name})

def set_student_submission(configuration, assignment_id):
    # TODO: select all students that belongs to this assignment
    files = {}
    mydict = ast.literal_eval(configuration)
    for i in range(1, mydict['number'] + 1):
        files['file' + str(i)] = mydict['file' + str(i)]
    
    json_config = json.dumps(files)

    StudentSubmission.objects.filter(assignment=assignment_id).update(is_multisubmission_allowed=mydict['multipleSubmission'], maximum_submissions=mydict['maximumTime'], is_late_submission=mydict['lateSubmission'], file_number=mydict['number'], files=json_config)
    
    # 查询之前所有学生的configuration，如果存在，计算当前允许的最大次数-已经提交的次数
