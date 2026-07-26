from urllib.parse import parse_qs

from django.http import JsonResponse
from ninja.errors import HttpError
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.sessions.models import Session

from .token_auth import user_from_request, resolve_token


class AuthMiddleware:
    """Populate request auth attributes from a bearer token, else the session.

    Every API route reads request.user_id / request.user_role /
    request.is_authenticated, so resolving the bearer token here is all that is
    needed to make the whole API token-authenticated — no route changes. The
    session path is kept as a fallback for the legacy Django template pages.
    request.user_role is the role's display name ('Academic', 'Marker', 'TA',
    'Student'), matching what the session stored and what the route decorators
    check against.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = user_from_request(request)
        if user is not None:
            request.user_id = user.id
            request.user_role = user.get_role_display()
            request.is_authenticated = True
        elif request.session.get('is_login'):
            request.user_id = request.session.get('user_id')
            request.user_role = request.session.get('user_role')
            request.is_authenticated = True
        else:
            request.is_authenticated = False

        return self.get_response(request)


class AuthBackend:
    """django-ninja auth backend: authenticates via bearer token or session."""

    def __init__(self):
        self.auth_middleware = AuthMiddleware(None)

    def __call__(self, request):
        user = user_from_request(request)
        if user is not None:
            return {'user_id': user.id, 'user_role': user.get_role_display()}
        if request.session.get('is_login'):
            return {
                'user_id': request.session.get('user_id'),
                'user_role': request.session.get('user_role')
            }
        return None

    def authenticate(self, request):
        return self.__call__(request)

class WebSocketAuthMiddleware(BaseMiddleware):
    """Authenticate a WebSocket via bearer token (query string) or session.

    The SPA is token-authenticated, but the browser WebSocket API cannot set an
    Authorization header, so the token is passed as `?token=<token>` on the
    handshake URL and resolved here — mirroring the HTTP AuthMiddleware. The
    session branch is kept as a fallback for the legacy Django template pages.
    """

    async def __call__(self, scope, receive, send):
        # Prefer the bearer token from the query string (the SPA path). Browsers
        # can't send an Authorization header on the WS handshake, so it rides in
        # the URL: ws://.../ws/peer-reviews/<a>/<s>/?token=<token>.
        token = self._token_from_scope(scope)
        user = await self.user_from_token(token) if token else None
        if user is not None:
            scope['user_id'] = user.id
            scope['user_role'] = user.get_role_display()
            scope['is_authenticated'] = True
            return await super().__call__(scope, receive, send)

        # Fallback: Django session (legacy template pages).
        session = scope.get('session')
        is_login = await self.get_session_value(session, 'is_login', False) if session else False
        if is_login:
            scope['user_id'] = await self.get_session_value(session, 'user_id')
            scope['user_role'] = await self.get_session_value(session, 'user_role')
            scope['is_authenticated'] = True
        else:
            scope['is_authenticated'] = False

        return await super().__call__(scope, receive, send)

    @staticmethod
    def _token_from_scope(scope):
        query = parse_qs((scope.get('query_string') or b'').decode())
        values = query.get('token')
        return values[0].strip() if values and values[0].strip() else None

    @database_sync_to_async
    def user_from_token(self, token):
        return resolve_token(token)

    @database_sync_to_async
    def get_session_value(self, session, key, default=None):
        return session.get(key, default)