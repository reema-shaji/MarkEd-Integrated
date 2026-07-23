from ninja import NinjaAPI
from .middleware import AuthBackend
from .routes import (
    assignments,
    courses,
    files,
    health,
    peer_reviews,
    submissions,
    users
)

api = NinjaAPI(auth=AuthBackend())

# Register all routes
api.add_router("/health", health.router)
api.add_router("/users", users.router)
api.add_router("/courses", courses.router)
api.add_router("/assignments", assignments.router)
api.add_router("/peer-reviews", peer_reviews.router)
api.add_router("/submissions", submissions.router)
api.add_router("/files", files.router)
