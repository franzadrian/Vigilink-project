from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.utils import timezone
from datetime import timedelta
from .models import Subscription

@login_required
def settings_page(request):
    """Main settings page showing billing, profile, and notification settings"""
    user = request.user
    
    # Get subscription for the user if it exists
    subscription = None
    if hasattr(user, 'subscription'):
        subscription = user.subscription
    
    context = {
        'user': user,
        'subscription': subscription,
    }
    
    return render(request, 'settings_panel/settings.html', context)


@login_required
@require_POST
def cancel_subscription(request):
    """Cancel user's subscription"""
    try:
        if not hasattr(request.user, 'subscription'):
            messages.error(request, 'No active subscription found.')
            return redirect('settings_panel:settings')
        
        subscription = request.user.subscription
        subscription.cancel()
        
        messages.success(request, 'Your subscription has been cancelled successfully.')
    except Exception as e:
        messages.error(request, f'Error cancelling subscription: {str(e)}')
    
    return redirect('settings_panel:settings')


@login_required
@require_POST
def update_notification_sound(request):
    """Update user's notification sound preference (Security users only)"""
    try:
        enabled = request.POST.get('enabled', 'false').lower() == 'true'
        user = request.user
        user.notification_sound_enabled = enabled
        user.save()
        
        return JsonResponse({
            'success': True,
            'message': 'Notification sound preference updated successfully.',
            'enabled': enabled
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Error updating preference: {str(e)}'
        }, status=400)


@login_required
@require_POST
def update_receive_notifications(request):
    """Update user's receive notifications preference (all users including Security)"""
    try:
        enabled = request.POST.get('enabled', 'false').lower() == 'true'
        user = request.user
        user.receive_notifications = enabled
        user.save()
        
        return JsonResponse({
            'success': True,
            'message': 'Notification preferences updated successfully.',
            'enabled': enabled
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Error updating preference: {str(e)}'
        }, status=400)


@login_required
@require_POST
def start_free_trial(request):
    """Start a free trial for guests (14 days, no card required)"""
    try:
        # Only allow guests to start free trials
        user_role = getattr(request.user, 'role', '')
        if user_role not in ['guest', 'communityowner']:
            messages.error(request, 'Free trial is only available for guests and community owners.')
            return redirect('settings_panel:settings')
        
        # Check if user already has an active subscription
        if hasattr(request.user, 'subscription'):
            subscription = request.user.subscription
            if subscription.is_active():
                messages.info(request, 'You already have an active subscription.')
                return redirect('settings_panel:settings')
            else:
                # Reactivate existing subscription as a free trial
                subscription.activate()
                subscription.expiry_date = timezone.now() + timedelta(days=14)
                subscription.plan_type = 'standard'
                billing_cycle = 'monthly'
                subscription.is_trial = True
                subscription.trial_expired_at = None
                subscription.data_deletion_date = None
                subscription.save()
                messages.success(request, 'Your free trial has been activated! You have 14 days to explore all features.')
        else:
            # Create new free trial subscription
            expiry_date = timezone.now() + timedelta(days=14)
            Subscription.objects.create(
                user=request.user,
                plan_type='standard',
                billing_cycle='monthly',
                status='active',
                expiry_date=expiry_date,
                is_trial=True
            )
            messages.success(request, 'Your free trial has been activated! You have 14 days to explore all features. No credit card required.')
        
        # If user is a guest, change their role to communityowner so they can create a community
        if user_role == 'guest':
            request.user.role = 'communityowner'
            request.user.save(update_fields=['role'])
        
        # Redirect to settings or dashboard
        return redirect('settings_panel:settings')
    except Exception as e:
        messages.error(request, f'Error starting free trial: {str(e)}')
        return redirect('settings_panel:settings')
