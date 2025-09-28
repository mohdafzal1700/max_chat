# middleware.py
import jwt
from urllib.parse import parse_qs
from django.contrib.auth.models import AnonymousUser
from django.contrib.auth import get_user_model
from django.conf import settings
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async

User = get_user_model()

@database_sync_to_async
def get_user_from_jwt(token):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
        user_id = payload.get('user_id')
        if user_id:
            user = User.objects.get(id=user_id)
            return user
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, User.DoesNotExist):
        pass
    return AnonymousUser()

class JWTAuthMiddleware(BaseMiddleware):
    """
    Custom middleware that takes JWT token from query string and authenticates user
    """
    
    async def __call__(self, scope, receive, send):
        # Get token from query string
        query_string = scope.get('query_string', b'').decode()
        query_params = parse_qs(query_string)
        token = query_params.get('token', [None])[0]
        
        if token:
            # Authenticate user with JWT token
            scope['user'] = await get_user_from_jwt(token)
        else:
            scope['user'] = AnonymousUser()
            
        return await super().__call__(scope, receive, send)

# Alternative: Get token from headers
class JWTAuthHeaderMiddleware(BaseMiddleware):
    """
    Custom middleware that takes JWT token from Authorization header
    """
    
    async def __call__(self, scope, receive, send):
        headers = dict(scope['headers'])
        auth_header = headers.get(b'authorization', b'').decode()
        
        token = None
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]  # Remove 'Bearer ' prefix
            
        if token:
            scope['user'] = await get_user_from_jwt(token)
        else:
            scope['user'] = AnonymousUser()
            
        return await super().__call__(scope, receive, send)