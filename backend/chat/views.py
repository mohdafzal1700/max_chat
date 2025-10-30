from chat.serializer import UserSerializer,CustomTokenObtainPairSerializer,ChatSerializer,ChatRoomSerializer,UserListSerializer
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework.permissions import IsAuthenticated,AllowAny
from rest_framework.exceptions import AuthenticationFailed
from rest_framework import generics, status, permissions   
from rest_framework_simplejwt.tokens import RefreshToken
from django.db import DatabaseError
from django.core.exceptions import ObjectDoesNotExist
from rest_framework.response import Response  
from django.contrib.auth.models import User
from chat.models import ChatRoom,Chat
from rest_framework.views import APIView
from django.shortcuts import render
from .models import UserStatus
from rest_framework_simplejwt.views import (
    TokenObtainPairView,  
    TokenRefreshView      
)
import logging


logger = logging.getLogger(__name__)


class UserRegistration(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = UserSerializer(data=request.data)
        
        if serializer.is_valid():
            try:
                user = serializer.save()
                logger.info(f"New user created: {user.email}")
                return Response({
                    'success': True,
                    'message': 'User created successfully',
                    'user_id': user.id
                }, status=status.HTTP_201_CREATED)
            except Exception as e:
                logger.error(f"Error creating user: {str(e)}")
                return Response({
                    'success': False,
                    'message': f'Error creating user: {str(e)}'
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({
                'success': False,
                'message': 'Validation failed',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
            
            
class CustomTokenObtainPairView(TokenObtainPairView):
    permission_classes = [permissions.AllowAny]
    serializer_class = CustomTokenObtainPairSerializer
    
    def post(self, request, *args, **kwargs):
        try:
            email = request.data.get('email')
            password = request.data.get('password')
            
            logger.info(f"Login attempt for email: {email}")
            
            if not email or not password:
                return Response(
                    {"success": False, "message": "Email and password are required"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            serializer = self.get_serializer(data=request.data)
            
            try:
                serializer.is_valid(raise_exception=True)
                token_data = serializer.validated_data
                
                user = User.objects.get(email__iexact=email.strip())
                
                access_token = token_data['access']
                refresh_token = token_data['refresh']

                res = Response(status=status.HTTP_200_OK)
                res.data = {
                    "success": True,
                    "message": "Login successful",
                    "access_token": access_token,
                    "refresh_token": refresh_token,
                    "userDetails": {
                        "id": str(user.id),
                        "username": user.username,
                        "email": user.email,
                    }
                }

                # Set cookies
                res.set_cookie(
                    key="access_token",
                    value=access_token,
                    httponly=True,
                    secure=False,  # Set to True in production with HTTPS
                    samesite="Lax",
                    path='/',
                    max_age=7200  # 2 hours (2 * 60 * 60)
                )
                res.set_cookie(
                    key="refresh_token",
                    value=refresh_token,
                    httponly=True,
                    secure=False,  # Set to True in production with HTTPS
                    samesite="Lax",
                    path='/',
                    max_age=604800  # 7 days (7 * 24 * 60 * 60)
                )

                logger.info(f"Successful login for user: {email}")
                return res
                
            except AuthenticationFailed as e:
                logger.warning(f"Authentication failed: {str(e)}")
                return Response(
                    {"success": False, "message": str(e)},
                    status=status.HTTP_400_BAD_REQUEST
                )
            except serializers.ValidationError as e:
                logger.warning(f"Validation error: {str(e)}")
                return Response(
                    {"success": False, "message": "Invalid credentials"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        except Exception as e:
            logger.error(f"Unexpected error during login: {str(e)}")
            return Response(
                {"success": False, "message": "An unexpected error occurred"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
                        
        
class CustomTokenRefreshView(TokenRefreshView):
    permission_classes=[AllowAny]
    
    def post(self, request, *args, **kwargs):
        try:
            refresh_token = request.COOKIES.get('refresh_token')
            
            if not refresh_token:
                logger.warning(" No refresh token found in cookies")
                return Response(
                    {"success": False, "message": "Refresh token not found in cookies"},
                    status=status.HTTP_401_UNAUTHORIZED
                )
                
            serializer=TokenRefreshSerializer(data={'refresh': refresh_token})
            if serializer.is_valid():
                validated_data = serializer.validated_data
                access_token = str(validated_data['access'])
                new_refresh_token = validated_data.get('refresh', refresh_token)
                new_refresh_token = str(new_refresh_token)
                
                response = Response({
                        "success": True,
                        "message": "Tokens refreshed successfully"
                    }, status=status.HTTP_200_OK)
                
                response.set_cookie(
                    key="access_token",
                    value=access_token,
                    httponly=True,
                    secure=True,  
                    samesite="Lax",
                    path="/",
                    max_age=7200  # 2 hours (2 * 60 * 60)
                )
                
                response.set_cookie(
                    key="refresh_token",
                    value=new_refresh_token,
                    httponly=True,
                    secure=True, 
                    samesite="Lax",
                    path="/",
                    max_age=604800  # 7 days (7 * 24 * 60 * 60)
                )
            
                logger.info("Tokens refreshed and cookies updated")
                return response
        
            else:
                logger.warning(f"Token refresh validation failed: {serializer.errors}")
                return Response(
                    {"success": False, "message": "Invalid refresh token"}, 
                    status=status.HTTP_401_UNAUTHORIZED
                )
                    
        except Exception as e:
                logger.error(f"Token refresh error: {str(e)}")
                return Response(
                    {"success": False, "message": "Token refresh failed"}, 
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
                    
class Logout(APIView):
    '''User logout section with addition of token blacklisting'''
    def post(self,request,*args, **kwargs):
        
        try:
            refresh_tokens=request.COOKIES.get('refresh_token') or request.data.get('refresh_token')
            
            if refresh_tokens:
                try:
                    token=RefreshToken(refresh_tokens)
                    token.blacklist()
                except:
                    pass
                
            res = Response(
                {"success": True, "message": "Logout successful"},
                status=status.HTTP_200_OK
            )
            
            res.delete_cookie(
                key="access_token",
                path='/',
                samesite="Lax"  # Changed from "None" to "Lax"
            )
            
            res.delete_cookie(
                key="refresh_token", 
                path='/',
                samesite="Lax"  # Changed from "None" to "Lax"
            )
            
            return res
            
        except Exception as e:
            return Response(
                {"success": False, "message": f"An error occurred: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ConversationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        try:
            other_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=404)

        room = ChatRoom.get_or_create_room(request.user, other_user)
        messages = Chat.objects.filter(chatroom=room)\
                            .select_related('sender', 'receiver')\
                            .order_by('timestamp')

        serializer = ChatSerializer(messages, many=True)
        
        return Response({
            "chatroom_id": room.id,
            "messages": serializer.data
        }, status=200)
        
        

class ConversationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            conversations = ChatRoom.objects.filter(participants=request.user)
            serializer = ChatRoomSerializer(
                conversations, context={"request": request}, many=True
            )
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        except DatabaseError as e:
            return Response(
                {"success": False, "message": "Database error occurred.", "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        
        except Exception as e:
            return Response(
                {"success": False, "message": "An unexpected error occurred.", "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ListAllUsers(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            users = User.objects.exclude(id=request.user.id)

            # Ensure every user has a UserStatus object
            for user in users:
                try:
                    if not hasattr(user, 'status'):
                        UserStatus.objects.get_or_create(user=user)
                except Exception as e:
                    # Continue processing other users if one fails
                    continue

            serializer = UserListSerializer(users, many=True)
            return Response(
                {
                    'success': True,
                    'data': serializer.data,
                    'count': users.count()
                },
                status=status.HTTP_200_OK
            )
        
        except ObjectDoesNotExist as e:
            return Response(
                {"success": False, "message": "User or related object not found.", "error": str(e)},
                status=status.HTTP_404_NOT_FOUND,
            )

        except DatabaseError as e:
            return Response(
                {"success": False, "message": "Database error occurred.", "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        
        except Exception as e:
            return Response(
                {"success": False, "message": "An unexpected error occurred.", "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )