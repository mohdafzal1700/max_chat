from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User
    

class ChatRoom(models.Model):
    participants = models.ManyToManyField(User, related_name='chat_rooms')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-updated_at']
    
    def __str__(self):
        participant_names = [p.username for p in self.participants.all()]
        return f"Chat between {', '.join(participant_names)}"
    
    @classmethod
    def get_or_create_room(cls, user1, user2):
        # Ensure consistent ordering to avoid duplicate rooms
        participants = sorted([user1.id, user2.id])
        
        # Try to find existing room with these exact participants
        existing_room = cls.objects.filter(
            participants__in=[user1, user2]
        ).annotate(
            participant_count=models.Count('participants')
        ).filter(
            participant_count=2
        ).first()
        
        if existing_room:
            return existing_room
        
        # Create new room
        room = cls.objects.create()
        room.participants.add(user1, user2)
        return room


class UserStatus(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='status')
    is_online = models.BooleanField(default=False)
    last_seen = models.DateTimeField(default=timezone.now,null=True, blank=True)

    def __str__(self):
        return f"{self.user.username} - {'Online' if self.is_online else 'Offline'}"
    
    
class Chat(models.Model):
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sent_messages")
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name="received_messages")
    chatroom = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name='room', null=False, blank=False,default=0)
    content=models.CharField(max_length=1000)
    timestamp=models.DateTimeField(default=timezone.now)
    is_read=models.BooleanField(default=False)
    
    
    def __str__(self):
        return f'{self.sender}-> {self.receiver}: {self.content[:30]}'