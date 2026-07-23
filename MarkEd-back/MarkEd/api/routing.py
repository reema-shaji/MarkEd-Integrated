from django.urls import re_path
from .consumers import PeerReviewCommentConsumer

websocket_urlpatterns = [
    re_path(r'ws/peer-reviews/(?P<assignment_id>\d+)/(?P<submission_id>\d+)/$', PeerReviewCommentConsumer.as_asgi()),
] 