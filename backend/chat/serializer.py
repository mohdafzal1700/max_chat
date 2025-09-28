from django.contrib.auth.models import User
from rest_framework import serializers
from chat.models import Chat,UserStatus,ChatRoom
import re
from django.contrib.auth import authenticate
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from django.core.validators import validate_email as django_validate_email
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class UserSerializer(serializers.ModelSerializer):
    confirm_password = serializers.CharField(write_only=True)
    class Meta:
        model=User
        fields=('id','username','password','email','confirm_password')
        extra_kwargs={
            'password':{'write_only':True},
            
            # 'username':{'required':True},
            # 'password':{'required':True},
            # 'email':{'required':True}
        }
        
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        for field_name, field in self.fields.items():
            if field_name != 'id':  # id is read-only
                field.required = True
                
    
    def validate_username(self,value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("User with this username already exists, it should be unique")
            
        if not value or not value.strip():
            raise serializers.ValidationError('Username is blank')
        
        cleaned_value = value.strip()
        
        if len(cleaned_value)<3:
            raise serializers.ValidationError("password must be at least 3 characters long.")
        
        if len(cleaned_value)>30:
            raise serializers.ValidationError("Password must be 8–30 characters long, contain at least one uppercase, one lowercase, one digit, and one special character (@, $, !, %, *, ?, &)."
)
        
        name_pattern = re.compile(r"^[A-Za-z0-9_]+$")
        if not name_pattern.match(cleaned_value):
            raise serializers.ValidationError(
                "Username can only contain letters, numbers, and underscores."
            )
            
        if User.objects.filter(username__iexact=cleaned_value).exists():
            raise serializers.ValidationError("A user with this username already exists")
    
            
        return cleaned_value
    
    def validate_password(self,value):
        if not value or not value.strip():
            raise serializers.ValidationError('Password should not be blank')
        
        cleaned_value = value.strip()
        
        if len(cleaned_value)<8:
            raise serializers.ValidationError("Password must be at least 8 characters long.")
        if len(cleaned_value)>30:
            raise serializers.ValidationError('it should be followed under 30 character')
        
        password_pattern = re.compile(
            r"^(?=.*[A-Z])"        # at least one uppercase
            r"(?=.*[a-z])"         # at least one lowercase
            r"(?=.*\d)"            # at least one digit
            r"(?=.*[@$!%*?&])"     # at least one special character
            r"[A-Za-z\d@$!%*?&]{8,30}$"  # allowed chars, length 8–30
        )

        
        if not password_pattern.match(cleaned_value):
            raise serializers.ValidationError(
                "First name can only contain letters, hyphens (-), and apostrophes ('). "
                "Special characters like @, #, $, etc. are not allowed."
            )
            
        common_passwords = [
        'password', '12345678', 'qwerty123', 'admin123', 'password123'
        ]
        if cleaned_value.lower() in common_passwords:
            raise serializers.ValidationError("This password is too common. Please choose a different one")
            
        return cleaned_value
    
    def validate_email(self, value):
        """Validate email with proper format and uniqueness check"""
        if not value or not value.strip():
            raise serializers.ValidationError('Email cannot be blank')
        
        cleaned_value = value.strip().lower()
        
        try:
            django_validate_email(cleaned_value)
        except DjangoValidationError:
            raise serializers.ValidationError('Enter a valid email address')
        
        email_pattern = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
        if not email_pattern.match(cleaned_value):
            raise serializers.ValidationError('Enter a valid email address')
        
        if User.objects.filter(email__iexact=cleaned_value).exists():
            raise serializers.ValidationError("A user with this email already exists")
        
        return cleaned_value
    
    def validate(self, data):
        """Validate that password and confirm_password match"""
        password = data.get('password')
        confirm_password = data.get('confirm_password')
        
        if password != confirm_password:
            raise serializers.ValidationError({
                'confirm_password': 'Passwords do not match'
            })
        
        return data
            
        
    def create(self, validated_data):
        """Create user with hashed password"""
        # Remove confirm_password from validated_data as it's not needed for user creation
        validated_data.pop('confirm_password', None)
        
        # Create user with hashed password
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
    
        return user
    
    

import logging

logger = logging.getLogger(__name__)

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    # Override the username field to accept email
    username_field = User.USERNAME_FIELD  # This will be 'username' by default
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Replace username field with email field
        self.fields['email'] = serializers.EmailField()
        del self.fields['username']  # Remove username field
    
    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')
        
        logger.info(f"Serializer received - email: {email}")
        
        if not email or not password:
            raise AuthenticationFailed('Email and password are required')
        
        try:
            # Find the user by email
            user_obj = User.objects.get(email__iexact=email.strip())
            logger.info(f"Found user: {user_obj.username}, active: {user_obj.is_active}")
            
            # Check if user is active first
            if not user_obj.is_active:
                raise AuthenticationFailed('Your account is not active. Please verify your email.')
            
            # Authenticate using the actual username
            user = authenticate(
                request=self.context.get('request'),
                username=user_obj.username,  # Use actual username, not email
                password=password
            )
            
            if not user:
                logger.warning(f"Authentication failed for email: {email}")
                raise AuthenticationFailed('Invalid email or password')
            
            # IMPORTANT: Set username for parent class validation
            attrs['username'] = user_obj.username
            # Remove email since parent class doesn't expect it
            attrs.pop('email', None)
            
            logger.info(f"Authentication successful for: {email}")
            
        except User.DoesNotExist:
            logger.warning(f"User not found with email: {email}")
            raise AuthenticationFailed('Invalid email or password')
        except AuthenticationFailed:
            # Re-raise authentication errors
            raise
        except Exception as e:
            logger.error(f"Unexpected error in serializer: {str(e)}")
            raise AuthenticationFailed('Authentication failed')
        
        # Now call parent validate with username in attrs
        return super().validate(attrs)

                    
class ChatSerializer(serializers.ModelSerializer):
    sender_username = serializers.CharField(source='sender.username', read_only=True)
    receiver_username = serializers.CharField(source='receiver.username', read_only=True)

    class Meta:
        model = Chat
        fields = ['id', 'sender_id', 'sender_username', 'receiver_id', 'receiver_username',
                'content', 'timestamp', 'is_read']
        
    def validate_content(self, value):
        """Validate message content"""
        if not value or not value.strip():
            raise serializers.ValidationError('Message content cannot be empty')
        
        cleaned_value = value.strip()
        
        if len(cleaned_value) > 1000:
            raise serializers.ValidationError('Message cannot exceed 1000 characters')
        
        # Basic content filtering (you can expand this)
        prohibited_patterns = [
            r'<script.*?>.*?</script>',  # Block script tags
            r'javascript:',              # Block javascript URLs
            r'on\w+\s*=',               # Block event handlers
        ]
        
        for pattern in prohibited_patterns:
            if re.search(pattern, cleaned_value, re.IGNORECASE):
                raise serializers.ValidationError('Message contains prohibited content')
        
        return cleaned_value

    def validate_receiver_id(self, value):
        """Validate receiver exists and is active"""
        if not value:
            raise serializers.ValidationError('Receiver ID is required')
        
        try:
            receiver = User.objects.get(id=value, is_active=True)
        except User.DoesNotExist:
            raise serializers.ValidationError('Receiver not found or inactive')
        
        return value

    def validate(self, attrs):
        """Cross-field validation"""
        receiver_id = attrs.get('receiver_id')
        # Get sender from context (should be set in view)
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            sender = request.user
            
            # Prevent self-messaging
            if sender.id == receiver_id:
                raise serializers.ValidationError({
                    'receiver_id': 'Cannot send message to yourself'
                })
        
        return attrs
                
                
class ChatRoomSerializer(serializers.ModelSerializer):
    other_user = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    last_message_time = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatRoom
        fields = ['id', 'other_user', 'last_message', 'last_message_time', 'unread_count']

    def get_other_user(self, obj):
        request = self.context.get("request")
        if request and hasattr(request, 'user'):
            other_users = [user for user in obj.participants.all() if user != request.user]
            return UserSerializer(other_users, many=True).data
        return []

    def get_last_message(self, obj):
        last_message = Chat.objects.filter(chatroom=obj).order_by("-timestamp").first()
        if last_message:
            return {
                'id': last_message.id,
                'content': last_message.content,
                'sender_id': last_message.sender.id,
                'sender_username': last_message.sender.username,
                'timestamp': last_message.timestamp
            }
        return None

    def get_last_message_time(self, obj):
        last_message = Chat.objects.filter(chatroom=obj).order_by("-timestamp").first()
        return last_message.timestamp if last_message else None

    def get_unread_count(self, obj):
        request = self.context.get("request")
        if request and hasattr(request, 'user'):
            unread_count = Chat.objects.filter(
                chatroom=obj,
                receiver=request.user,
                is_read=False
            ).count()
            return unread_count
        return 0


class UserStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserStatus
        fields = ['is_online', 'last_seen']

class UserListSerializer(serializers.ModelSerializer):
    status = UserStatusSerializer(read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'status']