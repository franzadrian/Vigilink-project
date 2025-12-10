from django.db import models
from django.conf import settings
from .storage import DropboxStorage

# Create your models here.
class ContactMessage(models.Model):
    contact_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True)
    name = models.CharField(max_length=100)
    email = models.EmailField()
    subject = models.CharField(max_length=100)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)
    
    def __str__(self):
        return f"{self.name} - {self.subject}"
    
    class Meta:
        ordering = ['-created_at']

class SafetyTip(models.Model):
    """Platform-wide safety tips managed by admins"""
    content = models.TextField(help_text="Safety tip content")
    community = models.ForeignKey(
        'communityowner_panel.CommunityProfile',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='safety_tips',
        help_text="If selected, only members of this community can see this tip. Leave empty for all communities."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_safety_tips'
    )
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Safety Tip'
        verbose_name_plural = 'Safety Tips'
    
    def __str__(self):
        return self.content[:50] + ('...' if len(self.content) > 50 else '')

class PlatformAnnouncement(models.Model):
    """Platform-wide safety announcements"""
    title = models.CharField(max_length=200)
    content = models.TextField()
    image = models.ImageField(
        storage=DropboxStorage(),
        upload_to='announcements/',
        blank=True,
        null=True,
        help_text="Optional image for the announcement (stored in Dropbox)"
    )
    community = models.ForeignKey(
        'communityowner_panel.CommunityProfile',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='announcements',
        help_text="If selected, only members of this community can see this announcement. Leave empty for all communities."
    )
    start_date = models.DateTimeField(help_text="When to start showing this announcement")
    end_date = models.DateTimeField(null=True, blank=True, help_text="When to stop showing (leave blank for no end date)")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_announcements'
    )
    
    def get_image_url(self):
        """Return the image URL, handling Dropbox storage errors gracefully"""
        if not self.image:
            return None
        try:
            url = self.image.url
            # If URL is empty (Dropbox token expired or error), return None
            if not url or url.strip() == '':
                return None
            return url
        except Exception:
            # If any error occurs (token expired, network issue, etc.), return None
            return None
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Platform Announcement'
        verbose_name_plural = 'Platform Announcements'
    
    def __str__(self):
        return self.title

class Resource(models.Model):
    RESOURCE_TYPE_CHOICES = [
        ('image', 'Image'),
        ('video', 'Video'),
        ('link', 'External Link'),
        ('document', 'Document'),
    ]
    
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    resource_type = models.CharField(max_length=10, choices=RESOURCE_TYPE_CHOICES)
    file = models.FileField(
        storage=DropboxStorage(),
        upload_to='resources/',
        blank=True,
        null=True,
        help_text="For PDFs, images, videos, and documents (stored in Dropbox)"
    )
    external_url = models.URLField(blank=True, null=True, help_text="For external links (Google Drive, YouTube, etc.)")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    community = models.ForeignKey('communityowner_panel.CommunityProfile', on_delete=models.SET_NULL, null=True, blank=True, related_name='resources', help_text="If selected, only members of this community can see this resource. Leave empty for all communities.")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return self.title
    
    class Meta:
        ordering = ['-created_at']