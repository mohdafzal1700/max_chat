import os
import django
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Set Django settings module BEFORE importing any Django components
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

# Setup Django BEFORE importing Django models/components
django.setup()

# Now import Django components after setup
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from chat.middleware import JWTAuthMiddleware
from chat.routing import websocket_urlpatterns

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AllowedHostsOriginValidator(
        JWTAuthMiddleware(
            URLRouter(
                websocket_urlpatterns
            )
        )
    ),
})