from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta

class Subscription(models.Model):
    """Model to track user subscription/billing information"""
    PLAN_CHOICES = (
        ('standard', 'Standard'),
        ('premium', 'Premium'),
    )
    
    BILLING_CYCLE_CHOICES = (
        ('monthly', 'Monthly'),
        ('yearly', 'Yearly'),
    )
    
    STATUS_CHOICES = (
        ('active', 'Active'),
        ('cancelled', 'Cancelled'),
        ('expired', 'Expired'),
    )
    
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='subscription')
    plan_type = models.CharField(max_length=20, choices=PLAN_CHOICES, default='standard')
    billing_cycle = models.CharField(max_length=20, choices=BILLING_CYCLE_CHOICES, default='monthly')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    start_date = models.DateTimeField(auto_now_add=True)
    expiry_date = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    # Store original roles before expiry for restoration
    original_roles = models.JSONField(default=dict, blank=True, help_text="Stores original roles before expiry")
    # Track trial expiry and data deletion date
    is_trial = models.BooleanField(default=False, help_text="Whether this is a free trial subscription")
    trial_expired_at = models.DateTimeField(null=True, blank=True, help_text="When the trial expired")
    data_deletion_date = models.DateTimeField(null=True, blank=True, help_text="When data should be deleted (1 month after trial expiry)")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Subscription'
        verbose_name_plural = 'Subscriptions'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.plan_type} ({self.billing_cycle})"
    
    def check_and_update_status(self):
        """Check if subscription has expired and update status if needed"""
        if self.status == 'active' and self.expiry_date and self.expiry_date < timezone.now():
            self.status = 'expired'
            # If this is a trial, mark when it expired and set data deletion date (1 month later)
            if self.is_trial and not self.trial_expired_at:
                self.trial_expired_at = timezone.now()
                self.data_deletion_date = timezone.now() + timedelta(days=30)  # 1 month grace period
            self.save()
            # Disable community access by changing roles to guest
            self._disable_community_access()
        return self.status
    
    def _disable_community_access(self):
        """Disable access for community owner and all community members"""
        from communityowner_panel.models import CommunityProfile, CommunityMembership
        
        try:
            community = CommunityProfile.objects.filter(owner=self.user).first()
            if not community:
                return
            
            # Store original roles if not already stored
            if not self.original_roles:
                self.original_roles = {}
            
            # Store and change community owner to guest
            if self.user.role != 'guest':
                if 'owner' not in self.original_roles:
                    self.original_roles['owner'] = self.user.role
                self.user.role = 'guest'
                self.user.save(update_fields=['role'])
            
            # Get all community members (residents and security)
            memberships = CommunityMembership.objects.filter(community=community).select_related('user')
            member_roles = {}
            for membership in memberships:
                user = membership.user
                # Store original role before changing to guest
                if user.role in ['resident', 'security'] and user.role != 'guest':
                    user_id = str(user.id)
                    if user_id not in self.original_roles.get('members', {}):
                        if 'members' not in self.original_roles:
                            self.original_roles['members'] = {}
                        self.original_roles['members'][user_id] = user.role
                    user.role = 'guest'
                    user.save(update_fields=['role'])
            
            # Save the original roles
            self.save(update_fields=['original_roles'])
        except Exception as e:
            # Log error but don't fail
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error disabling community access: {str(e)}")
    
    def _restore_community_access(self):
        """Restore access for community owner and all community members"""
        from communityowner_panel.models import CommunityProfile, CommunityMembership
        
        try:
            community = CommunityProfile.objects.filter(owner=self.user).first()
            if not community:
                return
            
            # Restore community owner role
            owner_role = self.original_roles.get('owner', 'communityowner')
            if self.user.role == 'guest':
                self.user.role = owner_role
                self.user.save(update_fields=['role'])
            
            # Restore member roles
            # If we have stored original roles, use them
            # Otherwise, restore based on membership (residents) or check if they had security reports (security)
            member_roles = self.original_roles.get('members', {})
            memberships = CommunityMembership.objects.filter(community=community).select_related('user')
            
            for membership in memberships:
                user = membership.user
                if user.role == 'guest':
                    user_id = str(user.id)
                    # Check if we have stored original role
                    if user_id in member_roles:
                        original_role = member_roles[user_id]
                        user.role = original_role
                    else:
                        # Try to determine role - check if user has security reports
                        # If they have security reports, they were likely security
                        # Otherwise, they're a resident
                        from security_panel.models import SecurityReport
                        has_security_reports = SecurityReport.objects.filter(reporter=user, community=community).exists()
                        if has_security_reports:
                            user.role = 'security'
                        else:
                            user.role = 'resident'
                    user.save(update_fields=['role'])
        except Exception as e:
            # Log error but don't fail
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error restoring community access: {str(e)}")
    
    def is_active(self):
        """Check if subscription is currently active"""
        # First check and update status if expired
        self.check_and_update_status()
        if self.status != 'active':
            return False
        if self.expiry_date and self.expiry_date < timezone.now():
            return False
        return True
    
    def days_until_expiry(self):
        """Calculate days until subscription expires"""
        if not self.expiry_date:
            return None
        delta = self.expiry_date - timezone.now()
        return max(0, delta.days)
    
    def cancel(self):
        """Cancel the subscription"""
        self.status = 'cancelled'
        self.cancelled_at = timezone.now()
        self.save()
    
    def activate(self):
        """Activate or reactivate the subscription"""
        # Restore access before activating
        if self.status in ['expired', 'cancelled']:
            self._restore_community_access()
        self.status = 'active'
        self.cancelled_at = None
        self.save()
    
    def delete_trial_data(self):
        """Delete all data associated with this trial subscription"""
        from communityowner_panel.models import CommunityProfile, CommunityMembership, EmergencyContact
        from admin_panel.models import Resource, ContactMessage
        from security_panel.models import SecurityReport, Incident
        from user_panel.models import Post, PostReply, PostImage, PostReaction, Message
        import logging
        
        logger = logging.getLogger(__name__)
        
        try:
            # Get the community profile if it exists
            community = CommunityProfile.objects.filter(owner=self.user).first()
            
            if community:
                # Get all community members before deleting memberships
                memberships = CommunityMembership.objects.filter(community=community).select_related('user')
                member_users = [m.user for m in memberships]
                all_users = [self.user] + member_users
                
                # Delete all resources created by this user or for this community
                Resource.objects.filter(
                    Q(created_by=self.user) | Q(community=community)
                ).delete()
                
                # Delete all security reports for this community
                SecurityReport.objects.filter(community=community).delete()
                
                # Delete all incidents for this community
                Incident.objects.filter(community=community).delete()
                
                # Delete all emergency contacts for this community
                EmergencyContact.objects.filter(community=community).delete()
                
                # Delete all posts by community members (this will cascade delete PostImages, PostReactions, PostReplies)
                Post.objects.filter(user__in=all_users).delete()
                
                # Delete all messages sent/received by community members
                Message.objects.filter(
                    Q(sender__in=all_users) | Q(receiver__in=all_users)
                ).delete()
                
                # Delete contact messages related to this community
                ContactMessage.objects.filter(
                    Q(user__in=all_users)
                ).delete()
                
                # Delete all community memberships
                CommunityMembership.objects.filter(community=community).delete()
                
                # Delete the community profile itself
                community.delete()
                
                logger.info(f"Deleted all trial data for user {self.user.username} (subscription {self.id})")
            
            # Mark subscription as deleted/cancelled
            self.status = 'cancelled'
            self.cancelled_at = timezone.now()
            self.save()
            
        except Exception as e:
            logger.error(f"Error deleting trial data for subscription {self.id}: {str(e)}", exc_info=True)
            raise
