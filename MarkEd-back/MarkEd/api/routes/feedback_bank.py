from typing import List, Optional

from django.db.models import Count, Q
from ninja import Router
from ninja.errors import HttpError

from ..schemas.feedback_bank import (
    FeedbackBankSchema,
    FeedbackBankCreateRequest,
    FeedbackBankActionResponse,
)
from ..decorators import require_auth
from ...models import (
    FeedbackBankEntry,
    FeedbackBankReaction,
    FeedbackBankFavourite,
    Assignment,
)

router = Router()

STAFF_ROLES = ['Academic', 'Marker', 'TA']


def _resolve_course_id(assignment_id: Optional[int], course_id: Optional[int]):
    """The shared bank is course-scoped; resolve the course from either an
    explicit course id or the assignment being marked."""
    if course_id:
        return course_id
    if assignment_id:
        a = Assignment.objects.filter(id=assignment_id).values_list('course_id', flat=True).first()
        return a
    return None


def _serialize(entry, user_id, is_academic):
    """Shape an entry with its derived like/dislike totals and this user's own
    reaction / favourite state."""
    return {
        "id": entry.id,
        "text": entry.text,
        "category": entry.category or '',
        "used_count": entry.used_count,
        "up_count": getattr(entry, 'like_count', None) or entry.reactions.filter(reaction_type='like').count(),
        "down_count": getattr(entry, 'dislike_count', None) or entry.reactions.filter(reaction_type='dislike').count(),
        "my_reaction": entry._my_reaction if hasattr(entry, '_my_reaction') else (
            entry.reactions.filter(user_id=user_id).values_list('reaction_type', flat=True).first()
        ),
        "is_favourite": entry._is_favourite if hasattr(entry, '_is_favourite') else (
            entry.favourites.filter(user_id=user_id).exists()
        ),
        "author_name": entry.owner.userName if entry.owner_id else '',
        "is_mine": entry.owner_id == user_id,
        "can_delete": entry.owner_id == user_id or is_academic,
        "created_at": entry.created_at,
    }


@router.get("/", response=List[FeedbackBankSchema], operation_id="listFeedbackBank")
@require_auth(roles=STAFF_ROLES)
def list_feedback_bank(
    request,
    assignment_id: Optional[int] = None,
    course_id: Optional[int] = None,
    category: Optional[str] = None,
    sort: str = 'recent',
    favourites_only: bool = False,
):
    """The course's shared Feedback Bank, crowd-rated and filterable.

    Scoped to the resolved course (plus any course-less legacy entries) so every
    marker on the course sees the same shared pool — restoring the original's
    shared corpus rather than a private per-marker list.
    """
    course = _resolve_course_id(assignment_id, course_id)
    qs = FeedbackBankEntry.objects.all()
    if course:
        qs = qs.filter(Q(course_id=course) | Q(course__isnull=True))

    if category:
        qs = qs.filter(category=category)
    if favourites_only:
        qs = qs.filter(favourites__user_id=request.user_id)

    qs = qs.annotate(
        like_count=Count('reactions', filter=Q(reactions__reaction_type='like'), distinct=True),
        dislike_count=Count('reactions', filter=Q(reactions__reaction_type='dislike'), distinct=True),
    )

    if sort == 'likes':
        qs = qs.order_by('-like_count', '-created_at')
    elif sort == 'used':
        qs = qs.order_by('-used_count', '-created_at')
    else:
        qs = qs.order_by('-created_at')

    entries = list(qs.select_related('owner'))

    # One query each for this user's reactions / favourites over the result set.
    ids = [e.id for e in entries]
    my_reactions = dict(
        FeedbackBankReaction.objects.filter(user_id=request.user_id, entry_id__in=ids)
        .values_list('entry_id', 'reaction_type')
    )
    my_favs = set(
        FeedbackBankFavourite.objects.filter(user_id=request.user_id, entry_id__in=ids)
        .values_list('entry_id', flat=True)
    )
    is_academic = request.user_role == 'Academic'
    for e in entries:
        e._my_reaction = my_reactions.get(e.id)
        e._is_favourite = e.id in my_favs

    return [_serialize(e, request.user_id, is_academic) for e in entries]


@router.post("/", response=FeedbackBankSchema, operation_id="createFeedbackBankEntry")
@require_auth(roles=STAFF_ROLES)
def create_feedback_bank_entry(request, data: FeedbackBankCreateRequest):
    """Add a snippet to the course's shared bank."""
    course = _resolve_course_id(data.assignment_id, data.course_id)
    entry = FeedbackBankEntry.objects.create(
        owner_id=request.user_id,
        course_id=course,
        text=data.text,
        category=(data.category or '').strip(),
    )
    return _serialize(entry, request.user_id, request.user_role == 'Academic')


@router.delete("/{entry_id}", response=FeedbackBankActionResponse, operation_id="deleteFeedbackBankEntry")
@require_auth(roles=STAFF_ROLES)
def delete_feedback_bank_entry(request, entry_id: int):
    """Delete a snippet. The author can remove their own; an academic can
    curate any entry in the shared bank."""
    entry = FeedbackBankEntry.objects.filter(id=entry_id).first()
    if not entry:
        return {"success": False, "message": "Not found"}
    if entry.owner_id != request.user_id and request.user_role != 'Academic':
        raise HttpError(403, "Only the author or an academic can delete this entry")
    entry.delete()
    return {"success": True, "message": "Deleted"}


@router.post("/{entry_id}/use", response=FeedbackBankSchema, operation_id="markFeedbackBankUsed")
@require_auth(roles=STAFF_ROLES)
def mark_feedback_bank_used(request, entry_id: int):
    """Record that a snippet was applied while marking (any staff member)."""
    entry = FeedbackBankEntry.objects.filter(id=entry_id).first()
    if not entry:
        raise HttpError(404, "Not found")
    entry.used_count += 1
    entry.save(update_fields=['used_count'])
    return _serialize(entry, request.user_id, request.user_role == 'Academic')


@router.post("/{entry_id}/react", response=FeedbackBankSchema, operation_id="reactFeedbackBankEntry")
@require_auth(roles=STAFF_ROLES)
def react_feedback_bank_entry(request, entry_id: int, reaction: str):
    """Toggle this user's like/dislike on a shared entry.

    Restores the original per-user reaction (Hao's update_reaction): one row per
    user per entry, switchable like<->dislike, and clicking the active reaction
    again clears it. Totals are recomputed from the rows.
    """
    if reaction not in ('like', 'dislike'):
        raise HttpError(400, "reaction must be 'like' or 'dislike'")
    entry = FeedbackBankEntry.objects.filter(id=entry_id).first()
    if not entry:
        raise HttpError(404, "Not found")

    existing = FeedbackBankReaction.objects.filter(entry=entry, user_id=request.user_id).first()
    if existing is None:
        FeedbackBankReaction.objects.create(entry=entry, user_id=request.user_id, reaction_type=reaction)
    elif existing.reaction_type == reaction:
        existing.delete()  # clicking the active reaction clears it
    else:
        existing.reaction_type = reaction
        existing.save(update_fields=['reaction_type'])

    return _serialize(entry, request.user_id, request.user_role == 'Academic')


@router.post("/{entry_id}/favourite", response=FeedbackBankSchema, operation_id="toggleFeedbackBankFavourite")
@require_auth(roles=STAFF_ROLES)
def toggle_feedback_bank_favourite(request, entry_id: int):
    """Toggle this user's favourite (the original's save/unsave)."""
    entry = FeedbackBankEntry.objects.filter(id=entry_id).first()
    if not entry:
        raise HttpError(404, "Not found")
    fav = FeedbackBankFavourite.objects.filter(entry=entry, user_id=request.user_id).first()
    if fav:
        fav.delete()
    else:
        FeedbackBankFavourite.objects.create(entry=entry, user_id=request.user_id)
    return _serialize(entry, request.user_id, request.user_role == 'Academic')
