"""Notifications — restores the notify()/dismiss() pipeline the three source
dissertations had (a `Notification` per receiver with a `subject` code and an
unread/read `status`), wired to the unified app's real actions.

Subjects (from the shared model): 1 moderate, 2 help, 3 submission added,
4 deadline 1 day, 5 deadline 2 days, 6 marks released. The unified app wires the
triggers that map to real actions — deadline reminders (4/5, created lazily like
the original assignment view did) and marks released (6, on the Release marks
action). The display handles every subject, so 1/2/3 light up automatically if
those actions are added later.
"""
from django.utils import timezone
from ninja import Router

from ..schemas.notification import (
    NotificationListResponse,
    UnreadCountResponse,
    NotificationActionResponse,
)
from ..decorators import require_auth
from ...models import (
    Notification,
    Assignment,
    Submission,
    SubmissionCriteria,
    GroupSubmission,
    GroupMember,
)

router = Router()

STAFF_ROLES = ('Marker', 'TA', 'Academic')


def _message_and_link(n):
    """Build the human message + deep link for a notification (mirrors the
    original notify() per-subject messages, pointed at unified routes)."""
    a = n.assignment
    course = a.course.courseName if a.course_id else ''
    title = a.assignmentTitle
    s = n.subject
    if s == 4:
        return (
            f"Reminder to complete marking for {course} — {title}. 1 day left.",
            f"/assignments/{a.id}/dashboard",
        )
    if s == 5:
        return (
            f"Reminder to complete marking for {course} — {title}. 2 days left.",
            f"/assignments/{a.id}/dashboard",
        )
    if s == 6:
        seg = 'group-result' if a.is_group_assignment() else 'results'
        return (
            f"Your marks for {course} — {title} have been released.",
            f"/assignments/{a.id}/{seg}",
        )
    if s == 1:
        return (f"Reminder to moderate {title}.", f"/assignments/{a.id}/dashboard")
    if s == 2:
        return (f"Reminder to help with {title}.", f"/assignments/{a.id}/dashboard")
    if s == 3:
        return (
            f"A new submission was added to {title}.",
            f"/assignments/{a.id}/submissions",
        )
    return (f"Notification for {title}.", f"/assignments/{a.id}/dashboard")


def _ensure_deadline_reminders(user_id, role):
    """Lazily create marking-deadline reminders (subjects 4/5) for staff, as the
    original assignment view did — deduped so they aren't recreated each poll."""
    if role not in STAFF_ROLES:
        return
    now = timezone.now()
    assignment_ids = list(
        Assignment.objects.filter(course__course2marker__marker_id=user_id)
        .values_list('id', flat=True)
        .distinct()
    )
    for a in Assignment.objects.filter(id__in=assignment_ids):
        if not a.deadline:
            continue
        days = (a.deadline - now).total_seconds() / 86400.0
        if 0 <= days < 1:
            subject = 4
        elif 1 <= days < 2:
            subject = 5
        else:
            continue
        if not Notification.objects.filter(
            receiver_id=user_id, assignment=a, subject=subject
        ).exists():
            Notification.objects.create(
                receiver_id=user_id, assignment=a, subject=subject, status=0
            )


def create_marks_released_notifications(assignment):
    """Notify each student whose mark is finalised that results have been
    released (subject 6). Called from the Release marks action. Deduped so
    retract/re-release doesn't spam."""
    student_ids = set()
    if assignment.is_group_assignment():
        for gs in GroupSubmission.objects.filter(assignment=assignment, is_active=True):
            # a group is "marked" once any criterion is finalised
            from ...models import GroupSubmissionCriteria
            if GroupSubmissionCriteria.objects.filter(group_submission=gs, status=2).exists():
                for m in GroupMember.objects.filter(group=gs.group, is_active=True):
                    student_ids.add(m.student_id)
    else:
        for sub in Submission.objects.filter(assignment=assignment):
            rows = SubmissionCriteria.objects.filter(submission=sub)
            if rows.exists() and not rows.exclude(status=2).exists():
                student_ids.add(sub.student_id)

    for sid in student_ids:
        if not Notification.objects.filter(
            receiver_id=sid, assignment=assignment, subject=6
        ).exists():
            Notification.objects.create(
                receiver_id=sid, assignment=assignment, subject=6, status=0
            )


@router.get("/", response=NotificationListResponse, operation_id="listNotifications")
@require_auth()
def list_notifications(request):
    """The current user's notifications (newest first) + unread count. Creates
    any due deadline reminders first (staff only)."""
    _ensure_deadline_reminders(request.user_id, request.user_role)
    qs = (
        Notification.objects.filter(receiver_id=request.user_id)
        .select_related('assignment', 'assignment__course')
        .order_by('-date')[:50]
    )
    items = []
    for n in qs:
        msg, link = _message_and_link(n)
        items.append({
            "id": n.id,
            "subject": n.subject,
            "message": msg,
            "link": link,
            "is_read": n.status == 1,
            "date": n.date,
            "assignment_id": n.assignment_id,
            "assignment_title": n.assignment.assignmentTitle,
        })
    unread = Notification.objects.filter(receiver_id=request.user_id, status=0).count()
    return {"unread_count": unread, "notifications": items}


@router.get("/unread-count", response=UnreadCountResponse, operation_id="getUnreadNotificationCount")
@require_auth()
def unread_count(request):
    """Lightweight unread count for the navbar badge (no side effects)."""
    return {
        "unread_count": Notification.objects.filter(
            receiver_id=request.user_id, status=0
        ).count()
    }


@router.post("/read-all", response=NotificationActionResponse, operation_id="markNotificationsRead")
@require_auth()
def mark_all_read(request):
    """Dismiss: flip all of the user's unread notifications to read (the
    original dismiss())."""
    Notification.objects.filter(receiver_id=request.user_id, status=0).update(status=1)
    return {"success": True, "unread_count": 0}


@router.post("/{notification_id}/read", response=NotificationActionResponse, operation_id="markNotificationRead")
@require_auth()
def mark_one_read(request, notification_id: int):
    Notification.objects.filter(
        id=notification_id, receiver_id=request.user_id, status=0
    ).update(status=1)
    return {
        "success": True,
        "unread_count": Notification.objects.filter(
            receiver_id=request.user_id, status=0
        ).count(),
    }
