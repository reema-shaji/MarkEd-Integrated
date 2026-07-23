from .assignments import router as assignments_router
from .courses import router as courses_router
from .files import router as files_router
from .health import router as health_router
from .peer_reviews import router as peer_reviews_router
from .submissions import router as submissions_router
from .users import router as users_router

__all__ = [
    'assignments_router',
    'courses_router',
    'files_router',
    'health_router',
    'peer_reviews_router',
    'submissions_router',
    'users_router'
] 
