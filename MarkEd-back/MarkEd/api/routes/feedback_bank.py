from typing import List, Optional
from ninja import Router
from ..schemas.feedback_bank import (
    FeedbackBankSchema,
    FeedbackBankCreateRequest,
    FeedbackBankActionResponse,
)
from ..decorators import require_auth
from ...models import FeedbackBankEntry

router = Router()

STAFF_ROLES = ['Academic', 'Marker', 'TA']


@router.get("/", response=List[FeedbackBankSchema], operation_id="listFeedbackBank")
@require_auth(roles=STAFF_ROLES)
def list_feedback_bank(request, category: Optional[str] = None):
    """The current marker's saved feedback snippets, optionally by category."""
    qs = FeedbackBankEntry.objects.filter(owner_id=request.user_id)
    if category:
        qs = qs.filter(category=category)
    return list(qs)


@router.post("/", response=FeedbackBankSchema, operation_id="createFeedbackBankEntry")
@require_auth(roles=STAFF_ROLES)
def create_feedback_bank_entry(request, data: FeedbackBankCreateRequest):
    """Save a reusable feedback snippet."""
    entry = FeedbackBankEntry.objects.create(
        owner_id=request.user_id,
        course_id=data.course_id,
        text=data.text,
        category=(data.category or '').strip(),
    )
    return entry


@router.delete("/{entry_id}", response=FeedbackBankActionResponse, operation_id="deleteFeedbackBankEntry")
@require_auth(roles=STAFF_ROLES)
def delete_feedback_bank_entry(request, entry_id: int):
    """Delete one of the current marker's snippets."""
    deleted, _ = FeedbackBankEntry.objects.filter(id=entry_id, owner_id=request.user_id).delete()
    if not deleted:
        return {"success": False, "message": "Not found"}
    return {"success": True, "message": "Deleted"}


@router.post("/{entry_id}/use", response=FeedbackBankSchema, operation_id="useFeedbackBankEntry")
@require_auth(roles=STAFF_ROLES)
def use_feedback_bank_entry(request, entry_id: int):
    """Record that a snippet was reused (increments its usage counter)."""
    entry = FeedbackBankEntry.objects.get(id=entry_id, owner_id=request.user_id)
    entry.used_count += 1
    entry.save(update_fields=['used_count'])
    return entry


@router.post("/{entry_id}/react", response=FeedbackBankSchema, operation_id="reactFeedbackBankEntry")
@require_auth(roles=STAFF_ROLES)
def react_feedback_bank_entry(request, entry_id: int, reaction: str):
    """Thumbs up/down a snippet ('up' or 'down')."""
    entry = FeedbackBankEntry.objects.get(id=entry_id, owner_id=request.user_id)
    if reaction == 'up':
        entry.up_count += 1
        entry.save(update_fields=['up_count'])
    elif reaction == 'down':
        entry.down_count += 1
        entry.save(update_fields=['down_count'])
    return entry
