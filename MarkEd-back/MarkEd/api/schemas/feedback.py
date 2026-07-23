from ninja import Schema
from typing import List, Optional
from .peer_review import PeerMatch

class FeedbackAnalysisRequest(Schema):
    beforeText: str
    selectedText: str
    afterText: str
    feedback: str

class FeedbackAnalysisResponse(Schema):
    success: bool
    rating: Optional[str]
    message: str

class CreationResponse(Schema):
    success: bool
    message: str
    matches: Optional[List[PeerMatch]] 