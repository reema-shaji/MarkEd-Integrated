"""`python manage.py seed_scenarios` — load UI test-case scenarios.

Adds three clearly-labelled assignments to INF2-SEPP with realistic, populated
states so the dashboards / marking / peer-review / self-assessment views can be
tested against real data:

  TC1  Full submissions; marking complete by markers AND academics; peer review
       matched but pending (no reviews done yet).
  TC2  Like TC1 but a few students never submitted and the deadline has passed.
  TC3  Individual assignment with a few submissions, self-assessment enabled,
       and some students yet to complete their self-assessment.

The base demo (CW1–CW4, all unsubmitted) is left untouched. Idempotent: the
three TC assignments are deleted and recreated on each run.

Run:  docker compose exec -T backend python manage.py seed_scenarios
Requires seed_demo to have populated INF2-SEPP first.
"""
import datetime
import os

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from MarkEd.models import (
    Assignment, ChecklistItem, Course, Course2Student, Criteria, Element,
    PeerReviewAllocation, ReflectionPrompt, SelfAssessmentRubricSelection,
    SelfAssessmentSetting, StudentSelfAssessmentSubmission, Submission,
    SubmissionCriteria, User,
)

RUBRIC = [('Problem analysis', 30), ('Implementation', 40), ('Evaluation & writing', 30)]
LEVELS = [('Poor', 0.0), ('Fair', 0.5), ('Good', 0.75), ('Excellent', 1.0)]
PDF_KEY = 'submission/testcases/sample.pdf'


def minimal_pdf(text: str) -> bytes:
    """A valid one-page PDF with a correct xref table (so pdf.js renders it)."""
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    ]
    stream = ("BT /F1 22 Tf 72 700 Td (%s) Tj ET" % text).encode()
    objs.append(b"<< /Length %d >>\nstream\n%s\nendstream" % (len(stream), stream))
    objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, body in enumerate(objs, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + body + b"\nendobj\n"
    xref_pos = len(out)
    out += b"xref\n0 %d\n" % (len(objs) + 1)
    out += b"0000000000 65535 f \n"
    for off in offsets:
        out += b"%010d 00000 n \n" % off
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF" % (
        len(objs) + 1, xref_pos)
    return bytes(out)


class Command(BaseCommand):
    help = "Load UI test-case scenarios TC1/TC2/TC3 into INF2-SEPP."

    def handle(self, *args, **options):
        now = timezone.now()
        course = Course.objects.filter(courseCode='INF2-SEPP').first()
        if not course:
            self.stderr.write('INF2-SEPP not found — run seed_demo first.')
            return

        enrolled = set(
            Course2Student.objects.filter(course=course).values_list('student_id', flat=True)
        )
        students = [s for s in User.objects.filter(role='S').order_by('userNumber') if s.id in enrolled]
        markers = list(User.objects.filter(role='M').order_by('userNumber'))
        academic = User.objects.filter(role='A').order_by('userNumber').first()
        graders = markers + ([academic] if academic else [])
        if not students or not graders:
            self.stderr.write('No students/markers found — run seed_demo first.')
            return

        # Shared placeholder PDF so the viewer works for every submission.
        path = os.path.join(settings.MEDIA_ROOT, PDF_KEY)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb') as fh:
            fh.write(minimal_pdf('MarkEd test submission'))

        def rubric(a):
            crits = []
            for name, marks in RUBRIC:
                c, _ = Criteria.objects.get_or_create(
                    assignment=a, name=name, parent=None,
                    defaults=dict(marks=marks, marking_scheme='SEL'))
                c.marks = marks
                c.save()
                for lname, frac in LEVELS:
                    Element.objects.get_or_create(
                        criteria=c, name=lname,
                        defaults=dict(description=f'{lname} on {name.lower()}.',
                                      marks=round(marks * frac, 1)))
                crits.append(c)
            return crits

        def reset(title, **extra):
            Assignment.objects.filter(course=course, assignmentTitle=title).delete()
            return Assignment.objects.create(
                course=course, assignmentTitle=title, status=1, **extra)

        def submit(a, student, when):
            s = Submission.objects.create(student=student, assignment=a, submissionFile=PDF_KEY)
            # submissionDateTime is auto_now_add; backdate it so on-time/late is realistic.
            Submission.objects.filter(id=s.id).update(submissionDateTime=when)
            return s

        def mark(a, submission, grader, quality):
            for c in Criteria.objects.filter(assignment=a, parent=None):
                els = list(Element.objects.filter(criteria=c).order_by('marks'))
                el = els[min(quality, len(els) - 1)]
                sc, _ = SubmissionCriteria.objects.update_or_create(
                    submission=submission, criteria=c,
                    defaults=dict(marker=grader, score=el.marks, status=2))
                sc.selected_elements.set([el])

        def allocate(a, subs):
            n = len(subs)
            for i, s in enumerate(subs):
                for k in (1, 2):
                    target = subs[(i + k) % n]
                    if target.student_id == s.student_id:
                        continue
                    PeerReviewAllocation.objects.get_or_create(
                        reviewer=s.student, submission=target, assignment=a,
                        defaults=dict(status='PENDING'))

        # spread of quality indices (0 Poor … 3 Excellent) for a believable histogram
        qual = [3, 2, 2, 3, 1, 2, 3, 2, 0, 2, 3, 2, 1, 2, 3, 2, 2, 1]

        # ---- TC1: full, marked, peer pending -------------------------------
        tc1 = reset(
            'TC1: Marked · Peer Review Pending',
            assignmentDescription='Every student submitted, marking is complete '
            '(by both markers and academics), and peer review is matched but pending.',
            deadline=now - datetime.timedelta(days=3),
            release_date=now - datetime.timedelta(days=10),
            assignment_type='INDIVIDUAL', peer_review_enabled=True,
            reviews_per_student=2, review_deadline=now + datetime.timedelta(days=4),
            is_peer_review_matching_complete=True)
        rubric(tc1)
        subs1 = []
        for i, st in enumerate(students):
            s = submit(tc1, st, now - datetime.timedelta(days=4, hours=i))
            mark(tc1, s, graders[i % len(graders)], qual[i % len(qual)])
            subs1.append(s)
        allocate(tc1, subs1)

        # ---- TC2: few missing, overdue -------------------------------------
        tc2 = reset(
            'TC2: Missing Submissions · Overdue',
            assignmentDescription='A few students never submitted and the deadline '
            'has passed; submitted work is marked, peer review pending.',
            deadline=now - datetime.timedelta(days=2),
            release_date=now - datetime.timedelta(days=9),
            assignment_type='INDIVIDUAL', peer_review_enabled=True,
            reviews_per_student=2, review_deadline=now + datetime.timedelta(days=3),
            is_peer_review_matching_complete=True)
        rubric(tc2)
        submitters2 = students[:-4] if len(students) > 4 else students  # 4 missing
        subs2 = []
        for i, st in enumerate(submitters2):
            # first two submitted late (after the deadline), the rest on time
            when = (now - datetime.timedelta(days=1)) if i < 2 else (now - datetime.timedelta(days=3))
            s = submit(tc2, st, when)
            mark(tc2, s, graders[i % len(graders)], qual[i % len(qual)])
            subs2.append(s)
        allocate(tc2, subs2)

        # ---- TC3: individual + self-assessment, some pending ---------------
        tc3 = reset(
            'TC3: Self-Assessment In Progress',
            assignmentDescription='A few students submitted; self-assessment is '
            'enabled and some students have not completed it yet.',
            deadline=now - datetime.timedelta(days=1),
            release_date=now - datetime.timedelta(days=7),
            assignment_type='INDIVIDUAL')
        crits3 = rubric(tc3)
        SelfAssessmentSetting.objects.update_or_create(
            assignment=tc3,
            defaults=dict(enabled=True, use_checklist=True, use_rubric=True,
                          use_reflection=True, needs_feedback=True, max_score=30,
                          deadline=now + datetime.timedelta(days=5)))
        for name in ['I addressed every part of the brief',
                     'My referencing is complete and consistent',
                     'I proofread the whole document']:
            ChecklistItem.objects.get_or_create(assignment=tc3, name=name)
        for stage, text in [('description', 'What did you produce?'),
                            ('feelings', 'How did you feel while working on it?'),
                            ('evaluation', 'What went well and what did not?'),
                            ('analysis', 'Why do you think it went that way?'),
                            ('conclusion', 'What have you learned?'),
                            ('action_plan', 'What will you do differently next time?')]:
            ReflectionPrompt.objects.get_or_create(
                assignment=tc3, stage=stage, defaults=dict(prompt_text=text))
        for c in crits3[:2]:
            SelfAssessmentRubricSelection.objects.get_or_create(assignment=tc3, criteria=c)
        submitters3 = students[:8]
        for i, st in enumerate(submitters3):
            submit(tc3, st, now - datetime.timedelta(days=2, hours=i))
        # 5 of 8 completed their self-assessment, 3 still pending
        for st in submitters3[:5]:
            StudentSelfAssessmentSubmission.objects.get_or_create(
                assignment=tc3, student=st,
                defaults=dict(checklist_answers={}, rubric_answers={},
                              guided_reflection_answers={}))

        self.stdout.write(self.style.SUCCESS(
            f"Scenarios loaded into INF2-SEPP:\n"
            f"  TC1  {len(subs1)} submissions, all marked, peer review pending\n"
            f"  TC2  {len(subs2)} submissions ({len(students) - len(submitters2)} missing), overdue, marked\n"
            f"  TC3  {len(submitters3)} submissions, self-assessment enabled, "
            f"5/{len(submitters3)} self-assessed ({len(submitters3) - 5} pending)"))
