"""
ASGI config for backend project.
"""

import os
from dotenv import load_dotenv

# Load environment variables FIRST
load_dotenv()

# Set Django settings module BEFORE any imports
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

# Import Django ASGI application FIRST
# This call initializes Django properly
from django.core.asgi import get_asgi_application
django_asgi_app = get_asgi_application()

# NOW import Channels components AFTER Django is initialized
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from chat.middleware import JWTAuthMiddleware
from chat.routing import websocket_urlpatterns

# Define the ASGI application
application = ProtocolTypeRouter({
    "http": django_asgi_app,  # Use the stored reference
    "websocket": AllowedHostsOriginValidator(
        JWTAuthMiddleware(
            URLRouter(
                websocket_urlpatterns
            )
        )
    ),
})