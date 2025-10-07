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
        logger.info(f"🔑 Attempting to decode JWT token: {token[:20]}...")
        logger.info(f"🔑 Using SECRET_KEY: {settings.SECRET_KEY[:10]}...")
        
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
        logger.info(f"✓ JWT decoded successfully, payload: {payload}")
        
        user_id = payload.get('user_id')
        if not user_id:
            logger.error("❌ JWT payload missing user_id")
            logger.error(f"❌ Full payload: {payload}")
            return AnonymousUser()
        
        logger.info(f"✓ Extracted user_id: {user_id}")
        
        try:
            user = User.objects.get(id=user_id)
            logger.info(f"✓ User found: {user.username} (ID: {user.id})")
            return user
        except User.DoesNotExist:
            logger.error(f"❌ User with id {user_id} does not exist in database")
            return AnonymousUser()
            
    except jwt.ExpiredSignatureError as e:
        logger.error(f"❌ JWT token expired: {e}")
        return AnonymousUser()
    except jwt.InvalidTokenError as e:
        logger.error(f"❌ Invalid JWT token: {e}")
        logger.error(f"❌ Token was: {token[:50]}...")
        return AnonymousUser()
    except Exception as e:
        logger.error(f"❌ Unexpected error decoding JWT: {type(e).__name__}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    """
    Custom middleware that takes JWT token from query string and authenticates user
    """
    async def __call__(self, scope, receive, send):
        logger.info("="*80)
        logger.info("🌐 NEW WEBSOCKET CONNECTION ATTEMPT")
        logger.info("="*80)
        
        # Log connection details
        logger.info(f"📋 Scope type: {scope.get('type')}")
        logger.info(f"📋 Scope path: {scope.get('path')}")
        logger.info(f"📋 Scope method: {scope.get('method', 'N/A')}")
        
        # Get token from query string
        query_string = scope.get('query_string', b'').decode()
        logger.info(f"📡 Query string: {query_string}")
        
        query_params = parse_qs(query_string)
        logger.info(f"📡 Parsed query params: {query_params}")
        
        token = query_params.get('token', [None])[0]
        
        if token:
            logger.info(f"🎫 Token found (length: {len(token)})")
            logger.info(f"🎫 Token preview: {token[:30]}...{token[-10:]}")
            
            # Authenticate user with JWT token
            user = await get_user_from_jwt(token)
            scope['user'] = user
            
            if isinstance(user, AnonymousUser):
                logger.error("❌ AUTHENTICATION FAILED - User is AnonymousUser")
                logger.error("❌ Connection will be rejected by ChatConsumer")
            else:
                logger.info(f"✓✓✓ AUTHENTICATION SUCCESSFUL ✓✓✓")
                logger.info(f"✓ User: {user.username} (ID: {user.id})")
                logger.info(f"✓ User type: {type(user)}")
        else:
            logger.error("❌ NO TOKEN provided in query string")
            logger.error(f"❌ Available query params: {list(query_params.keys())}")
            scope['user'] = AnonymousUser()
        
        logger.info("="*80)
        return await super().__call__(scope, receive, send)