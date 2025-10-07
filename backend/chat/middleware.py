import jwt
from urllib.parse import parse_qs
from django.contrib.auth.models import AnonymousUser
from django.contrib.auth import get_user_model
from django.conf import settings
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
import logging

logger = logging.getLogger(__name__)
User = get_user_model()

@database_sync_to_async
def get_user_from_jwt(token):
    try:
        print(f'🔑 Attempting to decode JWT token: {token[:20]}...')
        
        # Use SimpleJWT's AccessToken to decode
        access_token = AccessToken(token)
        print(f'✓ JWT decoded successfully using SimpleJWT')
        
        user_id = access_token.get('user_id')
        if not user_id:
            print('❌ JWT payload missing user_id')
            return AnonymousUser()
        
        print(f'✓ Extracted user_id: {user_id}')
        
        try:
            user = User.objects.get(id=user_id)
            print(f'✓ User found: {user.username} (ID: {user.id})')
            return user
        except User.DoesNotExist:
            print(f'❌ User with id {user_id} does not exist in database')
            return AnonymousUser()
            
    except TokenError as e:
        print(f'❌ SimpleJWT TokenError: {e}')
        return AnonymousUser()
    except InvalidToken as e:
        print(f'❌ Invalid JWT token: {e}')
        return AnonymousUser()
    except Exception as e:
        print(f'❌ Unexpected error decoding JWT: {type(e).__name__}: {e}')
        import traceback
        print(traceback.format_exc())
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        print('='*80)
        print('🌐 NEW WEBSOCKET CONNECTION ATTEMPT')
        print('='*80)
        
        query_string = scope.get('query_string', b'').decode()
        print(f'📡 Query string: {query_string}')
        
        query_params = parse_qs(query_string)
        token = query_params.get('token', [None])[0]
        
        if token:
            print(f'🎫 Token found (length: {len(token)})')
            user = await get_user_from_jwt(token)
            scope['user'] = user
            
            if isinstance(user, AnonymousUser):
                print('❌ AUTHENTICATION FAILED - User is AnonymousUser')
            else:
                print(f'✓✓✓ AUTHENTICATION SUCCESSFUL ✓✓✓')
                print(f'✓ User: {user.username} (ID: {user.id})')
        else:
            print('❌ NO TOKEN provided in query string')
            scope['user'] = AnonymousUser()
        
        print('='*80)
        return await super().__call__(scope, receive, send)
