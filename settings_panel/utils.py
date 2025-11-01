from django.utils import timezone
from .models import Subscription
from communityowner_panel.models import CommunityProfile, CommunityMembership


def has_active_subscription(user):
    """
    Check if a user has an active subscription.
    Returns True if subscription exists and is active, False otherwise.
    """
    if not user or not user.is_authenticated:
        return False
    
    try:
        if hasattr(user, 'subscription'):
            subscription = user.subscription
            # Check and update status if expired
            subscription.check_and_update_status()
            return subscription.is_active()
    except Subscription.DoesNotExist:
        pass
    
    return False


def has_community_access(user):
    """
    Check if a user (community owner or resident) has access to community features.
    For community owners: checks their subscription
    For residents: checks their community owner's subscription
    Returns tuple: (has_access: bool, reason: str)
    """
    if not user or not user.is_authenticated:
        return False, "User not authenticated"
    
    # Check if user is a community owner
    if user.role == 'communityowner':
        if not has_active_subscription(user):
            return False, "Your subscription has expired. Please renew to access community features."
        return True, "Access granted"
    
    # Check if user is a resident
    if user.role == 'resident':
        try:
            membership = CommunityMembership.objects.select_related('community', 'community__owner').get(user=user)
            community_owner = membership.community.owner
            
            if not has_active_subscription(community_owner):
                return False, "Your community owner's subscription has expired. Community features are temporarily unavailable."
            
            return True, "Access granted"
        except CommunityMembership.DoesNotExist:
            return False, "You are not a member of any community."
    
    # For other roles (guest, security, admin), allow access
    return True, "Access granted"


def get_community_owner_subscription_status(community):
    """
    Get the subscription status of a community owner.
    Returns tuple: (is_active: bool, subscription object or None)
    """
    if not community or not community.owner:
        return False, None
    
    try:
        subscription = community.owner.subscription
        subscription.check_and_update_status()
        return subscription.is_active(), subscription
    except Subscription.DoesNotExist:
        return False, None

