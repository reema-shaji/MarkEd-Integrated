from functools import wraps
from ninja.errors import HttpError
from typing import List, Optional

def require_auth(roles: Optional[List[str]] = None):
    def decorator(func):
        @wraps(func)
        def wrapper(request, *args, **kwargs):
            if not request.is_authenticated:
                raise HttpError(401, "Not authenticated")
                
            if roles and request.user_role not in roles:
                raise HttpError(403, "Insufficient permissions")
                
            return func(request, *args, **kwargs)
        return wrapper
    return decorator 

def check_permissions(*permission_classes):
    def decorator(func):
        @wraps(func)
        def wrapper(request, *args, **kwargs):
            for permission_class in permission_classes:
                permission = permission_class()
                if not permission.has_permission(request, **kwargs):
                    raise HttpError(403, "Permission denied")
            return func(request, *args, **kwargs)
        return wrapper
    return decorator 

def require_any_role(roles: List[str]):
    """Checks if user has ANY of the specified roles"""
    def decorator(func):
        @wraps(func)
        def wrapper(request, *args, **kwargs):
            if not request.is_authenticated:
                raise HttpError(401, "Not authenticated")
            
            if not any(role in request.user_roles for role in roles):
                raise HttpError(403, "Insufficient permissions - requires any of specified roles")
            
            return func(request, *args, **kwargs)
        return wrapper
    return decorator

def require_all_roles(roles: List[str]):
    """Checks if user has ALL of the specified roles"""
    def decorator(func):
        @wraps(func)
        def wrapper(request, *args, **kwargs):
            if not request.is_authenticated:
                raise HttpError(401, "Not authenticated")
            
            if not all(role in request.user_roles for role in roles):
                raise HttpError(403, "Insufficient permissions - requires all specified roles")
            
            return func(request, *args, **kwargs)
        return wrapper
    return decorator

def require_any_permission(permissions: List[str]):
    """Checks if user has ANY of the specified permissions"""
    def decorator(func):
        @wraps(func)
        def wrapper(request, *args, **kwargs):
            if not request.is_authenticated:
                raise HttpError(401, "Not authenticated")
            
            if not any(request.has_permission(perm) for perm in permissions):
                raise HttpError(403, "Insufficient permissions - requires any of specified permissions")
            
            return func(request, *args, **kwargs)
        return wrapper
    return decorator

def deny_roles(roles: List[str]):
    """Explicitly denies access to specified roles"""
    def decorator(func):
        @wraps(func)
        def wrapper(request, *args, **kwargs):
            if not request.is_authenticated:
                raise HttpError(401, "Not authenticated")
            
            if request.user_role in roles:
                raise HttpError(403, "Access denied for this role")
            
            return func(request, *args, **kwargs)
        return wrapper
    return decorator

def combine_decorators(*decorators):
    """Combines multiple decorators into one"""
    def decorator(func):
        for dec in reversed(decorators):
            func = dec(func)
        return func
    return decorator

