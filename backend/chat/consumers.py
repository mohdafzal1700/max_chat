import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from django.utils import timezone
from chat.models import UserStatus, Chat, ChatRoom
from django.contrib.auth.models import User
import logging

logger = logging.getLogger(__name__)

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # checking the user is authenticated or not
        if isinstance(self.scope['user'], AnonymousUser):
            await self.close()
            return
        
        self.user = self.scope['user']
        self.group_name = f'user_{self.user.id}'
        
        try:
            await self.channel_layer.group_add(
                self.group_name,
                self.channel_name
            )
            await self.accept()
            await self.update_online_status(True)
            
            # Send connection confirmation
            await self.send(text_data=json.dumps({
                'type': 'connection',
                'status': 'connected',
                'user_id': self.user.id
            }))
        except Exception as e:
            logger.error(f"Error during WebSocket connect: {e}")
            await self.close()

    async def disconnect(self, close_code):
        logger.info(f'User {self.user} is trying to logout')
        if hasattr(self, "group_name"):
            await self.update_online_status(False)
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        logger.info(f'User received message from the frontend: {text_data}')
        try:
            data = json.loads(text_data)
            event_type = data.get('type')
            
            if event_type == "chat_message":
                await self.handle_chat_message(data)
            elif event_type == 'typing':
                await self.handle_typing_indicator(data)
            elif event_type == 'read_receipt':
                await self.handle_read_receipt(data)
            else:
                logger.warning(f"Unknown chat message type: {event_type}")
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'error': 'Invalid JSON format'
            }))
        except Exception as e:
            logger.error(f"Error handling chat message: {str(e)}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'error': 'Server error'
            }))

    async def handle_chat_message(self, data):
        receiver_id = data.get('receiver_id')
        content = data.get('content')
        
        if not content or not receiver_id:
            logger.error("DEBUG: Missing required fields")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'error': 'No proper content or receiver_id'
            }))
            return
        
        message = await self.create_message(data)
        if not message:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'error': 'Failed to create message'
            }))
            return
        
        # Send to receiver
        await self.channel_layer.group_send(
            f"user_{receiver_id}",
            {
                'type': 'chat_message_handler',
                'message': message,
                'sender_id': self.user.id,
                'sender_username': self.user.username
            }
        )
        
        # Send confirmation back to sender
        await self.send(text_data=json.dumps({
            'type': 'message_sent',
            'message': message
        }))

    async def handle_typing_indicator(self, data):
        try:
            receiver_id = data.get('receiver_id')
            is_typing = data.get('is_typing', False)
            
            await self.channel_layer.group_send(
                f"user_{receiver_id}",
                {
                    'type': 'typing_indicator_handler',
                    'is_typing': is_typing,
                    'sender_id': self.user.id,
                    'sender_username': self.user.username,
                }
            )
        except Exception as e:
            logger.error(f"Error handling typing indicator: {str(e)}")

    async def handle_read_receipt(self, data):
        message_id = data.get('message_id')
        if not message_id:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'error': 'message_id is required'
            }))
            return
        
        # Get message details before marking as read
        message_info = await self.get_message_info(message_id)
        if not message_info:
            logger.error(f"Message {message_id} not found")
            return
        
        # Only allow users to mark messages sent TO them as read
        if message_info['receiver_id'] != self.user.id:
            logger.error(f"User {self.user.id} cannot mark message {message_id} as read - not the receiver")
            return
        
        # Mark the message as read
        success = await self.mark_message_as_read(message_id)
        if not success:
            logger.error(f"Failed to mark message {message_id} as read")
            return
        
        logger.info(f"✓ Message {message_id} marked as read by user {self.user.id}")
        
        # Send read receipt to the original sender
        await self.channel_layer.group_send(
            f"user_{message_info['sender_id']}",
            {
                'type': 'read_receipt_handler',
                'message_id': message_id,
                'read_by_id': self.user.id,
                'read_by_username': self.user.username
            }
        )
        
        logger.info(f"✓ Read receipt sent to user {message_info['sender_id']} for message {message_id}")

    @database_sync_to_async
    def update_online_status(self, is_online):
        try:
            user_status, created = UserStatus.objects.get_or_create(user=self.user)
            user_status.is_online = is_online
            if is_online:
                user_status.last_seen = None
            else:
                user_status.last_seen = timezone.now()
            user_status.save()
            logger.info(f"Updated user status: {self.user.username} - Online: {is_online}")
        except Exception as e:
            logger.error(f"Error updating online status: {e}")
            try:
                UserStatus.objects.update_or_create(
                    user=self.user,
                    defaults={
                        'is_online': is_online,
                        'last_seen': timezone.now() if not is_online else None
                    }
                )
            except Exception as e2:
                logger.error(f"Fallback status update failed: {e2}")

    @database_sync_to_async
    def create_message(self, data):
        try:
            content = data.get('content')
            receiver_id = data.get('receiver_id')
            sender = self.user
            
            if not sender:
                logger.error("Sender is not present")
                return None
            
            try:
                receiver = User.objects.get(id=receiver_id)
            except User.DoesNotExist:
                logger.error(f"Recipient user {receiver_id} not found")
                return None
            
            chat_room = ChatRoom.get_or_create_room(sender, receiver)
            logger.info(f"DEBUG: Chat room ID: {chat_room.id}")
            
            message = Chat.objects.create(
                chatroom=chat_room,
                sender=sender,
                receiver=receiver,
                content=content,
            )
            
            result = {
                'id': message.id,
                'content': message.content,
                'timestamp': message.timestamp.isoformat(),
                'sender_id': message.sender.id,
                'sender_username': message.sender.username,
                'receiver_id': message.receiver.id,
                'is_read': message.is_read,
            }
            logger.info(f"DEBUG: Returning message data: {result}")
            return result
        except Exception as e:
            logger.error(f"Error saving chat message: {e}")
            import traceback
            traceback.print_exc()
            return None

    @database_sync_to_async
    def get_message_info(self, message_id):
        """Get complete message information"""
        try:
            message = Chat.objects.get(id=message_id)
            return {
                'sender_id': message.sender.id,
                'sender_username': message.sender.username,
                'receiver_id': message.receiver.id,
                'receiver_username': message.receiver.username,
                'is_read': message.is_read
            }
        except Chat.DoesNotExist:
            return None

    @database_sync_to_async
    def mark_message_as_read(self, message_id):
        try:
            message = Chat.objects.get(id=message_id)
            # Verify the current user is the receiver
            if message.receiver.id != self.user.id:
                logger.error(f"User {self.user.id} is not the receiver of message {message_id}")
                return False
            
            # Only mark as read if not already read
            if not message.is_read:
                message.is_read = True
                message.save()
                logger.info(f"Message {message_id} marked as read")
            else:
                logger.info(f"Message {message_id} already marked as read")
            
            return True
        except Chat.DoesNotExist:
            logger.error(f"Message {message_id} not found")
            return False
        except Exception as e:
            logger.error(f"Error marking message as read: {e}")
            return False

    # WebSocket event handlers (called by group_send)
    async def chat_message_handler(self, event):
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': event['message'],
            'sender_id': event['sender_id'],
            'sender_username': event['sender_username']
        }))

    async def typing_indicator_handler(self, event):
        await self.send(text_data=json.dumps({
            'type': 'typing_indicator',
            'sender_id': event['sender_id'],
            'sender_username': event['sender_username'],
            'is_typing': event['is_typing']
        }))

    async def read_receipt_handler(self, event):
        await self.send(text_data=json.dumps({
            'type': 'read_receipt',
            'message_id': event['message_id'],
            'read_by_id': event['read_by_id'],
            'read_by_username': event['read_by_username']
        }))