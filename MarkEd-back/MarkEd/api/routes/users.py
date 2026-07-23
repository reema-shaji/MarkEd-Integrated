from datetime import timedelta
from typing import List
from ninja import Router
from django.utils import timezone
from ..schemas.user import UserSchema
from ..decorators import require_auth
from ...models import User

router = Router()

# TODO: Move to env variable
SYSTEM_ADMIN_USER_ID = 8

@router.get("/current-user", response=UserSchema, operation_id="getCurrentUser")
@require_auth()
def get_current_user(request):
    user = User.objects.get(id=request.user_id)
    user.last_seen = timezone.now()
    user.save()
    return user

@router.get("/users-online", response=List[UserSchema], operation_id="getUsersOnline")
def get_users_online(request):
    if request.user_id == SYSTEM_ADMIN_USER_ID:
        return User.objects.filter(last_seen__gte=timezone.now() - timedelta(minutes=5))
    else:
        return []
    
@router.get("/users-online-count", response=int, operation_id="getUsersOnlineCount")
def get_users_online_count(request):
    return User.objects.filter(last_seen__gte=timezone.now() - timedelta(minutes=5)).count()
