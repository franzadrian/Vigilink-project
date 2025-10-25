from django.db import models
from django.contrib.auth import get_user_model
from communityowner_panel.models import CommunityProfile
import json

User = get_user_model()

class SecurityReport(models.Model):
    """Private incident reports accessible only by Security role users"""
    
    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('urgent', 'Urgent'),
    ]
    
    STATUS_CHOICES = [
        ('new', 'New'),
        ('investigating', 'Investigating'),
        ('resolved', 'Resolved'),
        ('closed', 'Closed'),
    ]
    
    TARGET_TYPE_CHOICES = [
        ('resident', 'Resident'),
        ('outsider', 'Non-Resident'),
    ]
    
    # Report details
    subject = models.CharField(max_length=200)
    message = models.TextField()
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='medium')
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='new')
    
    # Target information
    target_type = models.CharField(max_length=10, choices=TARGET_TYPE_CHOICES)
    target_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reported_incidents')
    target_description = models.TextField(blank=True, help_text="Description of non-resident target")
    
    # Reporter information
    reporter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='submitted_reports')
    is_anonymous = models.BooleanField(default=False)
    reporter_name = models.CharField(max_length=100, blank=True)
    reporter_email = models.EmailField(blank=True)
    
    # Community context
    community = models.ForeignKey(CommunityProfile, on_delete=models.CASCADE, related_name='security_reports')
    
    # Report content
    reasons = models.JSONField(default=list, help_text="List of selected reasons for the report")
    details = models.TextField(blank=True, help_text="Additional details provided by reporter")
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    
    # Security notes
    security_notes = models.TextField(blank=True, help_text="Internal notes by security personnel")
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_reports')
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Security Report'
        verbose_name_plural = 'Security Reports'
    
    def __str__(self):
        return f"Report #{self.id}: {self.subject}"
    
    def get_reasons_display(self):
        """Return formatted reasons list"""
        if isinstance(self.reasons, list):
            return ', '.join(self.reasons)
        return str(self.reasons)
    
    def get_reporter_display(self):
        """Return reporter name or 'Anonymous'"""
        if self.is_anonymous:
            return 'Anonymous'
        return self.reporter_name or self.reporter.full_name or self.reporter.username
    
    def get_target_display(self):
        """Return target description"""
        if self.target_type == 'resident' and self.target_user:
            return f"{self.target_user.full_name or self.target_user.username} (Resident)"
        elif self.target_type == 'outsider':
            return f"Non-Resident: {self.target_description}"
        return "Unknown"
