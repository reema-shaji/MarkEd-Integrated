from ninja import Schema
from typing import List
from datetime import datetime


class NotificationSchema(Schema):
    id: int
    subject: int
    message: str
    link: str
    is_read: bool
    date: datetime
    assignment_id: int
    assignment_title: str


class NotificationListResponse(Schema):
    unread_count: int
    notifications: List[NotificationSchema]


class UnreadCountResponse(Schema):
    unread_count: int


class NotificationActionResponse(Schema):
    success: bool
    unread_count: int
