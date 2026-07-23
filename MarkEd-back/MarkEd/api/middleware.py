from django.http import JsonResponse
from ninja.errors import HttpError
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.sessions.models import Session

class AuthMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Add user info to request object if logged in
        if request.session.get('is_login'):
            request.user_id = request.session.get('user_id')
            request.user_role = request.session.get('user_role')
            request.is_authenticated = True
        else:
            request.is_authenticated = False

        return self.get_response(request)

class AuthBackend:
    def __init__(self):
        self.auth_middleware = AuthMiddleware(None)

    def __call__(self, request):
        if request.session.get('is_login'):
            return {
                'user_id': request.session.get('user_id'),
                'user_role': request.session.get('user_role')
            }
        return None

    def authenticate(self, request):
        return self.__call__(request)

class WebSocketAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        # Get session from scope
        session = scope['session']
        
        # Use database_sync_to_async to access session data
        is_login = await self.get_session_value(session, 'is_login', False)
        if is_login:
            scope['user_id'] = await self.get_session_value(session, 'user_id')
            scope['user_role'] = await self.get_session_value(session, 'user_role')
            scope['is_authenticated'] = True
        else:
            scope['is_authenticated'] = False
        
        return await super().__call__(scope, receive, send)

    @database_sync_to_async
    def get_session_value(self, session, key, default=None):
        return session.get(key, default) 