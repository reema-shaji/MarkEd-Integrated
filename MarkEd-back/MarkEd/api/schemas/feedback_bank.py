from ninja import Schema
from typing import Optional
from datetime import datetime


class FeedbackBankSchema(Schema):
    id: int
    text: str
    category: str = ''
    used_count: int = 0
    # Derived from the reaction rows, not stored.
    up_count: int = 0
    down_count: int = 0
    # Per-requester state (drives the highlighted 👍/👎 and the ★ favourite).
    my_reaction: Optional[str] = None  # 'like' | 'dislike' | None
    is_favourite: bool = False
    # Attribution + whether the requester owns it (owner/academic may delete).
    author_name: str = ''
    is_mine: bool = False
    can_delete: bool = False
    created_at: datetime


class FeedbackBankCreateRequest(Schema):
    text: str
    category: Optional[str] = ''
    # Either resolves the shared course the entry belongs to.
    assignment_id: Optional[int] = None
    course_id: Optional[int] = None


class FeedbackBankActionResponse(Schema):
    success: bool
    message: str = ''
