import time
import logging
from functools import wraps

performance_logger = logging.getLogger('performance')

def log_execution_time(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        request = next((arg for arg in args if hasattr(arg, 'path')), None)
        request_path = getattr(request, 'path', 'No path')
        
        performance_logger.debug(f"Starting {func.__name__} for {request_path}")
        
        try:
            result = func(*args, **kwargs)
            execution_time = time.time() - start_time
            
            if execution_time > 1.0:  # Log any operation taking more than 1 second
                performance_logger.warning(
                    f"Slow operation detected: {func.__name__} "
                    f"for {request_path} took {execution_time:.2f} seconds"
                )
            return result
            
        except Exception as e:
            execution_time = time.time() - start_time
            performance_logger.error(
                f"Error in {func.__name__} for {request_path} "
                f"after {execution_time:.2f} seconds: {str(e)}"
            )
            raise
            
    return wrapper
