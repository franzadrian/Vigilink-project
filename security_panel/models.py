from django.db import models
from django.contrib.auth import get_user_model
from communityowner_panel.models import CommunityProfile
import json

User = get_user_model()

class SecurityReport(models.Model):
    """Private incident reports accessible only by Security role users"""
    
    PRIORITY_CHOICES = [
        ('level_1', 'Level 1'),
        ('level_2', 'Level 2'),
        ('level_3', 'Level 3'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('investigating', 'Under Investigation'),
        ('resolved', 'Resolved'),
        ('false_alarm', 'False Alarm'),
    ]
    
    TARGET_TYPE_CHOICES = [
        ('resident', 'Resident'),
        ('outsider', 'Non-Resident'),
    ]
    
    # Report details
    subject = models.CharField(max_length=200)
    message = models.TextField()
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='level_2')
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='pending')
    
    # Target information
    target_type = models.CharField(max_length=10, choices=TARGET_TYPE_CHOICES)
    target_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reported_incidents')
    
    # Location information
    location = models.CharField(max_length=200, blank=True, help_text="Location where the incident happened")
    
    # Reporter information
    reporter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='submitted_reports')
    is_anonymous = models.BooleanField(default=False)
    reporter_name = models.CharField(max_length=100, blank=True)
    
    # Community context
    community = models.ForeignKey(CommunityProfile, on_delete=models.CASCADE, related_name='security_reports')
    
    # Report content
    reasons = models.JSONField(default=list, help_text="List of selected reasons for the report")
    details = models.TextField(blank=True, help_text="Additional details provided by reporter")
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    
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
    
    def get_priority_reason(self):
        """Return the highest priority reason (Level 3 > Level 2 > Level 1)"""
        if not isinstance(self.reasons, list) or not self.reasons:
            return None
        
        # Normalize reasons to lowercase for comparison
        reasons_lower = [reason.lower().strip() for reason in self.reasons]
        reasons_original = {reason.lower().strip(): reason for reason in self.reasons}
        
        # Level 3 - Serious: Property damage, harassment, violations, criminal activity
        level3_keywords = [
            'possible criminal activity',
            'criminal activity',
            'vandalism',
            'property damage',
            'harassment',
            'threats',
            'reckless driving',
            'speeding',
            'trespassing',
            'impersonation',
            'identity misuse',
            'false information'
        ]
        
        # Level 2 - Suspicious or concerning behavior
        level2_keywords = [
            'suspicious behavior',
            'animal-related concern',
            'other'
        ]
        
        # Level 1 - Minor disturbances
        level1_keywords = [
            'noise disturbance',
            'observations',
            'improper garbage disposal',
            'dumping'
        ]
        
        # Check for level 3 reasons first (most serious)
        for reason_lower in reasons_lower:
            for keyword in level3_keywords:
                if keyword in reason_lower:
                    return reasons_original[reason_lower]
        
        # Check for level 2 reasons (suspicious)
        for reason_lower in reasons_lower:
            for keyword in level2_keywords:
                if keyword in reason_lower:
                    return reasons_original[reason_lower]
        
        # Check for level 1 reasons (minor)
        for reason_lower in reasons_lower:
            for keyword in level1_keywords:
                if keyword in reason_lower:
                    return reasons_original[reason_lower]
        
        # If no match, return the first reason
        return self.reasons[0] if self.reasons else None
    
    def get_reporter_display(self):
        """Return reporter name or 'Anonymous'"""
        if self.is_anonymous or (self.reporter_name and '(anonymous)' in self.reporter_name.lower()):
            return 'Anonymous'
        return self.reporter_name or self.reporter.full_name or self.reporter.username
    
    def get_target_display(self):
        """Return target description"""
        if self.target_type == 'resident' and self.target_user:
            return f"{self.target_user.full_name or self.target_user.username} (Resident)"
        elif self.target_type == 'outsider':
            return "Non-Resident"
        return "Unknown"


class Incident(models.Model):
    """Public incident reports visible to all community members in alerts"""
    
    INCIDENT_TYPE_CHOICES = [
        ('suspicious_activity', 'Suspicious Activity'),
        ('security_breach', 'Security Breach'),
        ('vandalism', 'Vandalism'),
        ('theft', 'Theft'),
        ('disturbance', 'Disturbance'),
        ('other', 'Other'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('investigating', 'Under Investigation'),
        ('resolved', 'Resolved'),
        ('false_alarm', 'False Alarm'),
    ]
    
    # Incident details
    title = models.CharField(max_length=200)
    description = models.TextField()
    incident_type = models.CharField(max_length=20, choices=INCIDENT_TYPE_CHOICES, default='suspicious_activity')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Location and context
    location = models.CharField(max_length=200, blank=True, help_text="Specific location within community")
    community = models.ForeignKey(CommunityProfile, on_delete=models.CASCADE, related_name='incidents')
    
    # Reporter information
    reporter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='incident_reports')
    is_anonymous = models.BooleanField(default=False)
    reporter_name = models.CharField(max_length=100, blank=True)
    
    # Security handling
    handled_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='handled_incidents')
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    
    # Related security report (if this incident was created from a security report)
    security_report = models.OneToOneField(SecurityReport, on_delete=models.SET_NULL, null=True, blank=True, related_name='public_incident')
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Public Incident'
        verbose_name_plural = 'Public Incidents'
    
    def __str__(self):
        return f"Incident #{self.id}: {self.title}"
    
    def get_reporter_display(self):
        """Return reporter name or 'Anonymous'"""
        if self.is_anonymous or (self.reporter_name and '(anonymous)' in self.reporter_name.lower()):
            return 'Anonymous'
        return self.reporter_name or self.reporter.full_name or self.reporter.username
    
    def get_incident_type_display_short(self):
        """Return short form of incident type"""
        type_map = {
            'suspicious_activity': 'Suspicious Activity',
            'security_breach': 'Security Breach',
            'vandalism': 'Vandalism',
            'theft': 'Theft',
            'disturbance': 'Disturbance',
            'other': 'Other',
        }
        return type_map.get(self.incident_type, self.incident_type)
