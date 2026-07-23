from channels.routing import ProtocolTypeRouter, URLRouter
from channels.sessions import SessionMiddlewareStack
from .api.middleware import WebSocketAuthMiddleware
from .api.routing import websocket_urlpatterns

application = ProtocolTypeRouter({
    'websocket': SessionMiddlewareStack(
        WebSocketAuthMiddleware(
            URLRouter(websocket_urlpatterns)
        )
    ),
}) 