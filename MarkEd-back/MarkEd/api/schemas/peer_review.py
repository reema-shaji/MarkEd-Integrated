from ninja import Schema
from typing import List, Optional
from datetime import datetime
from .user import UserSchema

class PeerMatch(Schema):
    reviewer_name: str
    reviewer_userNumber: str
    reviewer_email: str
    submission_owner_name: str
    submission_owner_userNumber: str
    submission_owner_email: str
    status: str

class PeerReviewSchema(Schema):
    id: int
    submission_id: int
    status: str
    student_name: str 
    
class PeerReviewSchemaWithStudent(Schema):
    id: int
    submission_id: int
    status: str
    student_name: str
    student_number: str

class PeerReviewCommentSchema(Schema):
    id: int
    selected_text: str
    feedback: str
    margin_text_top: str
    margin_text_bottom: str
    position_data: dict
    created_at: datetime
    author: UserSchema
    marker_feedback: str
    llm_feedback: str
    llm_feedback_dismissed: bool

class PeerReviewCommentAction(Schema):
    success: bool
    message: str

class PeerReviewCompletion(Schema):
    success: bool
    message: str
    is_completed: bool

class DismissLLMFeedbackRequest(Schema):
    dismiss_reason: str
    user_feedback: str = None

class DismissedLLMFeedbackResponse(Schema):
    success: bool
    message: str
