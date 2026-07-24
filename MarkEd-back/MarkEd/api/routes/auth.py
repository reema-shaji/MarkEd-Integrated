"""Token-based auth endpoints for the SPA.

Ported from the earlier unified build. Login mints an opaque bearer token
(token_auth.create_token); the SPA stores it and sends `Authorization: Bearer`.
This is what lets the frontend and backend sit on different origins (Vercel +
Render) without cross-site session cookies.

The legacy Django template login at /login/ is left in place for the
server-rendered pages; these endpoints are the SPA's path.
"""
from django.contrib.auth.hashers import check_password, make_password
from ninja import Router
from ninja.errors import HttpError

from ..decorators import require_auth
from ..schemas.auth import ChangePasswordIn, LoginIn, MessageOut, TokenOut
from ..token_auth import (
    bearer_token_from_request,
    create_token,
    revoke_all_tokens,
    revoke_token,
)
from ...models import User

router = Router()

MIN_PASSWORD_LEN = 8
# A fixed hash to verify against when the user does not exist, so that a missing
# user and a wrong password take the same time (no user enumeration by timing).
_DUMMY_HASH = make_password('timing-equalizer')


@router.post('/login', auth=None, response=TokenOut, operation_id="apiLogin")
def login(request, data: LoginIn):
    user = User.objects.filter(userNumber=data.userNumber).first()
    if user is None:
        check_password(data.password, _DUMMY_HASH)  # equalize timing
        raise HttpError(401, 'Invalid user number or password')
    if not user.isValid:
        raise HttpError(403, 'This account is not active. Please contact your tutor.')
    if not check_password(data.password, user.password):
        raise HttpError(401, 'Invalid user number or password')

    return {
        'token': create_token(user),
        'user': user,
        'must_change_password': user.must_change_password,
    }


@router.post('/logout', response=MessageOut, operation_id="apiLogout")
@require_auth()
def logout(request):
    token = bearer_token_from_request(request)
    if token:
        revoke_token(token)
    return {'success': True, 'message': 'Logged out'}


@router.post('/change-password', response=MessageOut, operation_id="apiChangePassword")
@require_auth()
def change_password(request, data: ChangePasswordIn):
    user = User.objects.get(id=request.user_id)
    if not check_password(data.current_password, user.password):
        raise HttpError(400, 'Current password is incorrect')
    if len(data.new_password) < MIN_PASSWORD_LEN:
        raise HttpError(400, f'Password must be at least {MIN_PASSWORD_LEN} characters')

    user.password = make_password(data.new_password)
    user.must_change_password = False
    user.save(update_fields=['password', 'must_change_password'])
    # A password change invalidates every existing session.
    revoke_all_tokens(user)
    return {'success': True, 'message': 'Password updated. Please log in again.'}
