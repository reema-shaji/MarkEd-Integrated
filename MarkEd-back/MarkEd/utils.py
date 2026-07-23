from django.db import connection
from django.http import JsonResponse
from .monitoring import log_execution_time, performance_logger

# https://stackoverflow.com/questions/1074212/how-can-i-see-the-raw-sql-queries-django-is-running
@log_execution_time
def dump_queries():
    qs = connection.queries
    for q in qs:
        performance_logger.debug(f"SQL Query: {q['sql']} (took: {q['time']}s)")
    return qs

def ping(request):
    return JsonResponse({
        "status": "ok",
        "is logged in": request.session.get('is_login', None),
        "user_name": request.session.get('user_name', None),
        "user_id": request.session.get('user_id', None),
        "user_role": request.session.get('user_role', None),
    })
