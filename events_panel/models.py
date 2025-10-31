from django.db import models
from django.conf import settings
from django.utils import timezone
from communityowner_panel.models import CommunityProfile


class Event(models.Model):
    EVENT_TYPE_CHOICES = [
        ('announcement', 'Announcement'),
        ('meeting', 'Meeting'),
        ('maintenance', 'Maintenance'),
        ('social', 'Social Event'),
        ('emergency', 'Emergency'),
        ('other', 'Other'),
    ]
    
    community = models.ForeignKey(
        CommunityProfile,
        on_delete=models.CASCADE,
        related_name='events'
    )
    title = models.CharField(max_length=200)
    description = models.TextField()
    event_type = models.CharField(max_length=20, choices=EVENT_TYPE_CHOICES, default='announcement')
    start_date = models.DateTimeField()
    location = models.CharField(max_length=200, blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_events'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['start_date']  # Default to start_date ordering (closest first)
        verbose_name = 'Event'
        verbose_name_plural = 'Events'
    
    def __str__(self):
        return f"{self.title} - {self.community.community_name}"
    
    @property
    def is_upcoming(self):
        return self.start_date > timezone.now()
    
    @property
    def is_ongoing(self):
        now = timezone.now()
        return self.start_date <= now


class EventAttendance(models.Model):
    STATUS_CHOICES = [
        ("attending", "Attending"),
        ("not_attending", "Not Attending"),
    ]

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="attendances")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="event_attendances")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("event", "user")

    def __str__(self):
        return f"{self.user_id} -> {self.event_id}: {self.status}"