from ninja import NinjaAPI
from .middleware import AuthBackend
from .routes import (
    assignments,
    courses,
    files,
    groups,
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

# Group marking (ported from Hao). Course-scoped group-set endpoints share the
# /courses prefix; group and group-set detail endpoints get their own.
api.add_router("/courses", groups.course_router)
api.add_router("/groupsets", groups.groupsets_router)
api.add_router("/groups", groups.groups_router)
