from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.http import require_POST
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
    """Update user's receive notifications preference (non-Security users)"""
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
