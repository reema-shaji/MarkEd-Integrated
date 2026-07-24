"""Opaque bearer-token authentication for the unified MarkEd API.

Ported from the earlier unified build's core/auth.py. The three source branches
all authenticate with userNumber + password; on success we mint an opaque token
stored in the cache (Redis) and the SPA sends it as `Authorization: Bearer`.

This replaces the reliance on the Django session cookie for API auth, so the
frontend (Vercel) and backend (Render) can live on different origins without
running into third-party-cookie blocking — exactly why the earlier build used
tokens. Session auth is retained as a fallback for the legacy Django template
pages.
"""
import secrets

from django.conf import settings
from django.core.cache import cache

from ..models import User

_TOKEN_PREFIX = 'authtoken:'
# Per-user index of live tokens, so a password change can revoke every session.
_USER_TOKENS_PREFIX = 'authtokens:user:'

# Cache TTL for a token, in seconds. Overridable via SESSION_TOKEN_TTL setting.
TOKEN_TTL = getattr(settings, 'SESSION_TOKEN_TTL', 60 * 60 * 24 * 7)


def create_token(user: User) -> str:
    token = secrets.token_urlsafe(32)
    cache.set(_TOKEN_PREFIX + token, user.id, timeout=TOKEN_TTL)
    index_key = _USER_TOKENS_PREFIX + str(user.id)
    tokens = cache.get(index_key) or []
    tokens.append(token)
    cache.set(index_key, tokens, timeout=TOKEN_TTL)
    return token


def revoke_token(token: str) -> None:
    cache.delete(_TOKEN_PREFIX + token)


def revoke_all_tokens(user: User) -> None:
    """Invalidate every live session for a user (e.g. after a password change)."""
    index_key = _USER_TOKENS_PREFIX + str(user.id)
    for token in cache.get(index_key) or []:
        cache.delete(_TOKEN_PREFIX + token)
    cache.delete(index_key)


def resolve_token(token: str):
    user_id = cache.get(_TOKEN_PREFIX + token)
    if not user_id:
        return None
    return User.objects.filter(id=user_id).first()


def bearer_token_from_request(request):
    """Extract the token from an `Authorization: Bearer <token>` header."""
    header = request.META.get('HTTP_AUTHORIZATION', '')
    if header.startswith('Bearer '):
        return header[7:].strip() or None
    return None


def user_from_request(request):
    """Resolve the request's bearer token to a User, or None."""
    token = bearer_token_from_request(request)
    if not token:
        return None
    return resolve_token(token)
