from ninja import Schema
from typing import Optional
from datetime import datetime


class FeedbackBankSchema(Schema):
    id: int
    text: str
    category: str = ''
    used_count: int = 0
    up_count: int = 0
    down_count: int = 0
    created_at: datetime


class FeedbackBankCreateRequest(Schema):
    text: str
    category: Optional[str] = ''
    course_id: Optional[int] = None


class FeedbackBankActionResponse(Schema):
    success: bool
    message: str = ''
