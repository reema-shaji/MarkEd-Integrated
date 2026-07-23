from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import ObjectDoesNotExist
from MarkEd.api.schemas.peer_review import PeerReviewSchema
from MarkEd.models import PeerReviewAllocation, PeerReviewComment, Assignment, Submission
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.cache import cache
from django.core.exceptions import ValidationError

User = get_user_model()

class PeerReviewCommentConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        if not self.scope['is_authenticated']:
            await self.close()
            return

        self.assignment_id = self.scope['url_route']['kwargs']['assignment_id']
        self.submission_id = self.scope['url_route']['kwargs']['submission_id']
        self.user_id = self.scope['user_id']

        # Add rate limiting for connections
        rate_key = f'ws_conn_rate_{self.user_id}'
        if not await self.check_connection_rate_limit(rate_key):
            await self.close()
            return

        # Add validation for assignment_id and submission_id
        if not await self.validate_ids():
            await self.close()
            return

        # Check permissions
        has_permission = await self.has_peer_review_access()
        if not has_permission:
            await self.close()
            return

        self.group_name = f'peer_review_{self.assignment_id}_{self.submission_id}'
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        # Add connection tracking
        await self.add_active_connection()
        
        await self.accept()

    @database_sync_to_async
    def has_peer_review_access(self):
        try:
            return PeerReviewAllocation.objects.filter(
                assignment_id=self.assignment_id,
                submission_id=self.submission_id,
                reviewer_id=self.user_id
            ).exists()
        except Exception:
            return False

    @database_sync_to_async
    def validate_ids(self):
        """Validate that assignment and submission IDs are valid"""
        try:
            # Verify assignment exists and is open for peer review
            assignment = Assignment.objects.get(id=self.assignment_id)
            now = timezone.now()
            
            if now <= assignment.deadline:
                return False  # Can't start peer review before submission deadline
                
            if now > assignment.review_deadline:
                return False  # Can't do peer review after review deadline
                
            # Verify submission exists and belongs to assignment
            submission_exists = Submission.objects.filter(
                id=self.submission_id,
                assignment_id=self.assignment_id
            ).exists()
            
            return submission_exists
            
        except (Assignment.DoesNotExist, ValidationError):
            return False

    @database_sync_to_async 
    def check_connection_rate_limit(self, key):
        """Rate limit WebSocket connections"""
        RATE_LIMIT_PERIOD = 60  # 1 minute
        MAX_CONNECTIONS = 12  # Maximum connections per minute
        
        current_count = cache.get(key, 0)
        if current_count >= MAX_CONNECTIONS:
            return False
            
        cache.set(key, current_count + 1, RATE_LIMIT_PERIOD)
        return True

    @database_sync_to_async
    def add_active_connection(self):
        """Track active connections per user"""
        key = f'ws_active_conn_{self.user_id}'
        MAX_CONCURRENT = 8  # Maximum concurrent connections
        
        active_connections = cache.get(key, 0)
        if active_connections >= MAX_CONCURRENT:
            raise ValidationError("Too many concurrent connections")
            
        cache.set(key, active_connections + 1, timeout=None)  # No timeout

    @database_sync_to_async
    def remove_active_connection(self):
        """Remove connection from tracking on disconnect"""
        key = f'ws_active_conn_{self.user_id}'
        active_connections = cache.get(key, 1)
        cache.set(key, max(0, active_connections - 1), timeout=None)

    async def disconnect(self, close_code):
        # Remove from connection tracking
        await self.remove_active_connection()
        
        # Remove from group
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )

    # Handle incoming messages if needed
    async def receive_json(self, content):
        # Add message rate limiting
        rate_key = f'ws_msg_rate_{self.user_id}'
        if not await self.check_message_rate_limit(rate_key):
            await self.close()
            return

        # Add message size limit
        if len(str(content)) > 4096:  # 4KB limit
            await self.close()
            return

        # Add message validation
        if not await self.validate_message(content):
            await self.close()
            return

    @database_sync_to_async
    def check_message_rate_limit(self, key):
        """Rate limit WebSocket messages"""
        RATE_LIMIT_PERIOD = 60  # 1 minute
        MAX_MESSAGES = 60  # Maximum messages per minute
        
        current_count = cache.get(key, 0)
        if current_count >= MAX_MESSAGES:
            return False
            
        cache.set(key, current_count + 1, RATE_LIMIT_PERIOD)
        return True

    @database_sync_to_async
    def validate_message(self, content):
        """Validate incoming message structure and content"""
        try:
            # Add required fields validation
            required_fields = ['type', 'comment_id']
            if not all(field in content for field in required_fields):
                return False

            # Validate message type
            if content['type'] not in ['llm_feedback_update']:
                return False

            # Validate comment exists and belongs to this peer review
            comment_exists = PeerReviewComment.objects.filter(
                id=content['comment_id'],
                review_allocation__assignment_id=self.assignment_id,
                review_allocation__submission_id=self.submission_id
            ).exists()
            
            return comment_exists

        except (KeyError, ValueError, TypeError):
            return False

    # Method to send LLM feedback updates
    async def send_llm_feedback_update(self, event):
        await self.send_json({
            'type': 'llm_feedback_update',
            'comment_id': event['comment_id'],
            'llm_feedback': event['llm_feedback'],
        }) 