import jwt
from urllib.parse import parse_qs
from django.contrib.auth.models import AnonymousUser
from django.contrib.auth import get_user_model
from django.conf import settings
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
import logging

logger = logging.getLogger(__name__)
User = get_user_model()

@database_sync_to_async
def get_user_from_jwt(token):
    try:
        logger.info(f"🔑 Attempting to decode JWT token")
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
        user_id = payload.get('user_id')
        
        if user_id:
            logger.info(f"✓ JWT decoded successfully, user_id: {user_id}")
            user = User.objects.get(id=user_id)
            logger.info(f"✓ User found: {user.username} (ID: {user.id})")
            return user
        else:
            logger.error("❌ JWT payload missing user_id")
            return AnonymousUser()
            
    except jwt.ExpiredSignatureError as e:
        logger.error(f"❌ JWT token expired: {e}")
        return AnonymousUser()
    except jwt.InvalidTokenError as e:
        logger.error(f"❌ Invalid JWT token: {e}")
        return AnonymousUser()
    except User.DoesNotExist:
        logger.error(f"❌ User with id {user_id} does not exist")
        return AnonymousUser()
    except Exception as e:
        logger.error(f"❌ Unexpected error decoding JWT: {e}")
        return AnonymousUser()

class JWTAuthMiddleware(BaseMiddleware):
    """
    Custom middleware that takes JWT token from query string and authenticates user
    """
    
    async def __call__(self, scope, receive, send):
        # Get token from query string
        query_string = scope.get('query_string', b'').decode()
        logger.info(f"📡 WebSocket connection attempt - Query string: {query_string}")
        
        query_params = parse_qs(query_string)
        token = query_params.get('token', [None])[0]
        
        if token:
            logger.info(f"🎫 Token found in query string (length: {len(token)})")
            # Authenticate user with JWT token
            scope['user'] = await get_user_from_jwt(token)
            
            if isinstance(scope['user'], AnonymousUser):
                logger.error("❌ Authentication failed - User is AnonymousUser")
            else:
                logger.info(f"✓ Authentication successful - User: {scope['user'].username}")
        else:
            logger.error("❌ No token provided in query string")
            scope['user'] = AnonymousUser()
            
        return await super().__call__(scope, receive, send)