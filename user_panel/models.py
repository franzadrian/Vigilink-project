from django.db import models
from django.utils import timezone
from django.conf import settings
import hashlib

# Create your models here.
class Message(models.Model):
    message_id = models.AutoField(primary_key=True)
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_messages')
    receiver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='received_messages')
    message = models.TextField()
    encrypted_message = models.TextField()
    sent_at = models.DateTimeField(default=timezone.now)
    is_read = models.BooleanField(default=False)
    is_edited = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    
    def save(self, *args, **kwargs):
        # Encrypt the message before saving
        if not self.encrypted_message and self.message:
            # Simple encryption using SHA-256 (for demonstration)
            # In a real app, use proper encryption libraries
            self.encrypted_message = hashlib.sha256(self.message.encode()).hexdigest()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"Message from {self.sender.username} to {self.receiver.username}"
    
    class Meta:
        ordering = ['-sent_at']

class Post(models.Model):
    post_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='posts')
    message = models.TextField(blank=True)
    uploaded_at = models.DateTimeField(default=timezone.now)
    
    def __str__(self):
        return f"Post {self.post_id} by {self.user.username}"
    
    def get_images(self):
        """Return all images associated with this post"""
        return self.images.all()
    
    def image_count(self):
        """Return the count of images for this post"""
        return self.images.count()

class PostImage(models.Model):
    """Model to store multiple images for a post"""
    image_id = models.AutoField(primary_key=True)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='post_images/', blank=True, null=True)
    image_url = models.URLField(max_length=500, blank=True, null=True)  # For Dropbox URLs
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Image {self.image_id} for post {self.post.post_id}"
    
    def get_image_url(self):
        """Return the image URL (either from local storage or Dropbox)"""
        if self.image_url:
            return self.image_url
        elif self.image:
            return self.image.url
        return None
    
    class Meta:
        ordering = ['uploaded_at']

class PostReaction(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='reactions')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('post', 'user')
    
    def __str__(self):
        return f"{self.user.username} reacted to post {self.post.post_id}"

class PostReply(models.Model):
    reply_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='replies')
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.user.username} replied to post {self.post.post_id}"

# PostShare model removed
