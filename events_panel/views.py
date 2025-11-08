from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, HttpResponseForbidden
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST, require_GET, require_http_methods
from django.contrib import messages
from django.core.paginator import Paginator
from django.utils import timezone
from django.db.models import Q
from .models import Event, EventAttendance
from communityowner_panel.models import CommunityProfile, CommunityMembership
from datetime import datetime, timedelta
import json


@login_required
def events_list(request):
    """View for residents and community owners to see events from their community"""
    try:
        # Check subscription access
        from settings_panel.utils import has_community_access
        has_access, reason = has_community_access(request.user)
        if not has_access and request.user.role in ['communityowner', 'resident']:
            from django.contrib import messages
            messages.error(request, reason)
            if request.user.role == 'communityowner':
                from django.shortcuts import redirect
                return redirect('settings_panel:settings')
            else:
                return render(request, 'resident/not_member.html', {
                    'reason': 'subscription_expired',
                    'message': reason,
                    'page_type': 'events'
                })
        
        # Check if user is a community owner first
        if hasattr(request.user, 'role') and request.user.role == 'communityowner':
            # Community owner - get their community profile
            community = CommunityProfile.objects.get(owner=request.user)
        else:
            # Regular user - get their community membership
            membership = CommunityMembership.objects.get(user=request.user)
            community = membership.community
        
        # Separate upcoming/ongoing events from completed events
        now = timezone.now()
        
        # Events remain "Ongoing" for 24 hours after they start
        # After 24 hours, they become "Completed"
        event_duration = timedelta(hours=24)
        
        # Get upcoming events - events that haven't started yet
        upcoming_events = Event.objects.filter(
            community=community,
            is_active=True,
            start_date__gt=now
        ).order_by('start_date')
        
        # Get ongoing events - events that have started but are within 24-hour window
        # Events starting at or before now, but not older than 24 hours
        ongoing_events = Event.objects.filter(
            community=community,
            is_active=True,
            start_date__lte=now,
            start_date__gt=now - event_duration
        ).order_by('start_date')
        
        # Combine upcoming and ongoing for display
        upcoming_ongoing_events = (upcoming_events | ongoing_events).order_by('start_date')
        
        # Get completed events - events that started more than 24 hours ago
        completed_events_qs = Event.objects.filter(
            community=community,
            is_active=True,
            start_date__lte=now - event_duration
        ).order_by('-start_date')  # Most recent first
        
        # Paginate completed events separately (4 per page)
        completed_page_number = request.GET.get('completed_page', 1)
        completed_paginator = Paginator(completed_events_qs, 4)
        completed_events_page = completed_paginator.get_page(completed_page_number)
        
        # Build current user's attendance map for quick lookup
        all_event_ids = list(upcoming_ongoing_events.values_list('id', flat=True)) + list(completed_events_qs.values_list('id', flat=True))
        attendance_qs = EventAttendance.objects.filter(user=request.user, event_id__in=all_event_ids)
        attendance_map = {a.event_id: a.status for a in attendance_qs}

        context = {
            'upcoming_ongoing_events': upcoming_ongoing_events,
            'completed_events': completed_events_page,
            'community': community,
            'event_types': Event.EVENT_TYPE_CHOICES,
            'attendance_map': attendance_map,
        }
        
        return render(request, 'events_panel/events.html', context)
        
    except (CommunityMembership.DoesNotExist, CommunityProfile.DoesNotExist):
        if hasattr(request.user, 'role') and request.user.role == 'communityowner':
            messages.error(request, 'You need to set up your community profile first.')
            return redirect('communityowner_panel:community_owner')
        else:
            # For regular users who are not members of any community, show not_member page
            return render(request, 'resident/not_member.html', {'page_type': 'events'})


@login_required
def event_detail(request, event_id):
    """View for detailed event information"""
    try:
        # Check subscription access
        from settings_panel.utils import has_community_access
        has_access, reason = has_community_access(request.user)
        if not has_access and request.user.role in ['communityowner', 'resident']:
            messages.error(request, reason)
            if request.user.role == 'communityowner':
                return redirect('settings_panel:settings')
            else:
                return render(request, 'resident/not_member.html', {
                    'reason': 'subscription_expired',
                    'message': reason,
                    'page_type': 'events'
                })
        
        # Check if user is a community owner first
        if hasattr(request.user, 'role') and request.user.role == 'communityowner':
            # Community owner - get their community profile
            community = CommunityProfile.objects.get(owner=request.user)
        else:
            # Regular user - get their community membership
            membership = CommunityMembership.objects.get(user=request.user)
            community = membership.community
        
        # Get event
        event = get_object_or_404(Event, id=event_id, community=community, is_active=True)
        
        context = {
            'event': event,
            'community': community,
        }
        
        return render(request, 'events_panel/event_detail.html', context)
        
    except (CommunityMembership.DoesNotExist, CommunityProfile.DoesNotExist):
        if hasattr(request.user, 'role') and request.user.role == 'communityowner':
            messages.error(request, 'You need to set up your community profile first.')
            return redirect('communityowner_panel:community_owner')
        else:
            # For regular users who are not members of any community, show not_member page
            return render(request, 'resident/not_member.html', {'page_type': 'events'})


@login_required
def create_event(request):
    """AJAX view for community owners to create events"""
    if not getattr(request.user, 'role', None) == 'communityowner':
        return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=403)
    
    # Check subscription access
    from settings_panel.utils import has_community_access
    has_access, reason = has_community_access(request.user)
    if not has_access:
        return JsonResponse({'success': False, 'error': reason}, status=403)
    
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            
            # Get community profile
            community = CommunityProfile.objects.get(owner=request.user)
            
            # Create event
            event = Event.objects.create(
                community=community,
                title=data.get('title', '').strip(),
                description=data.get('description', '').strip(),
                event_type=data.get('event_type', 'announcement'),
                start_date=datetime.fromisoformat(data.get('start_date').replace('Z', '+00:00')),
                location=data.get('location', '').strip(),
                created_by=request.user
            )
            
            return JsonResponse({
                'success': True,
                'event': {
                    'id': event.id,
                    'title': event.title,
                    'description': event.description,
                    'event_type': event.get_event_type_display(),
                    'start_date': event.start_date.isoformat(),
                    'location': event.location,
                    'created_at': event.created_at.isoformat(),
                }
            })
            
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=400)
    
    return JsonResponse({'success': False, 'error': 'Invalid request method'}, status=405)


@login_required
def update_event(request, event_id):
    """AJAX view for community owners to update events"""
    if not getattr(request.user, 'role', None) == 'communityowner':
        return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=403)
    
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            
            # Get community profile
            community = CommunityProfile.objects.get(owner=request.user)
            
            # Get event
            event = get_object_or_404(Event, id=event_id, community=community, created_by=request.user)
            
            # Update event
            event.title = data.get('title', event.title).strip()
            event.description = data.get('description', event.description).strip()
            event.event_type = data.get('event_type', event.event_type)
            event.start_date = datetime.fromisoformat(data.get('start_date').replace('Z', '+00:00'))
            event.location = data.get('location', event.location).strip()
            event.save()
            
            return JsonResponse({
                'success': True,
                'event': {
                    'id': event.id,
                    'title': event.title,
                    'description': event.description,
                    'event_type': event.get_event_type_display(),
                    'start_date': event.start_date.isoformat(),
                    'location': event.location,
                    'updated_at': event.updated_at.isoformat(),
                }
            })
            
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=400)
    
    return JsonResponse({'success': False, 'error': 'Invalid request method'}, status=405)


@login_required
def delete_event(request, event_id):
    """AJAX view for community owners to delete events"""
    if not getattr(request.user, 'role', None) == 'communityowner':
        return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=403)
    
    if request.method == 'POST':
        try:
            # Get community profile
            community = CommunityProfile.objects.get(owner=request.user)
            
            # Get event
            event = get_object_or_404(Event, id=event_id, community=community, created_by=request.user)
            
            # Soft delete (set is_active to False)
            event.is_active = False
            event.save()
            
            return JsonResponse({'success': True})
            
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=400)
    
    return JsonResponse({'success': False, 'error': 'Invalid request method'}, status=405)


@login_required
@require_POST
def rsvp_event(request):
    try:
        payload = json.loads(request.body)
        event_id = int(payload.get('event_id'))
        status = payload.get('status')
        if status not in {"attending", "not_attending"}:
            return JsonResponse({'success': False, 'error': 'Invalid status'}, status=400)

        # Ensure the user belongs to the event's community
        if hasattr(request.user, 'role') and request.user.role == 'communityowner':
            community = CommunityProfile.objects.get(owner=request.user)
        else:
            membership = CommunityMembership.objects.get(user=request.user)
            community = membership.community

        event = get_object_or_404(Event, id=event_id, community=community, is_active=True)

        attendance, _created = EventAttendance.objects.update_or_create(
            event=event,
            user=request.user,
            defaults={'status': status}
        )
        return JsonResponse({
            'success': True, 
            'status': attendance.status,
            'event_id': event.id  # Return event_id so frontend can update badge
        })
    except (CommunityMembership.DoesNotExist, CommunityProfile.DoesNotExist):
        return JsonResponse({'success': False, 'error': 'Not part of this community'}, status=403)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@login_required
def get_events(request):
    """AJAX view to get events for community owner dashboard"""
    if not getattr(request.user, 'role', None) == 'communityowner':
        return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=403)
    
    try:
        # Get community profile
        community = CommunityProfile.objects.get(owner=request.user)
        
        # Get events - sort by start_date (closest to start first)
        events = Event.objects.filter(community=community, is_active=True).order_by('start_date')
        
        events_data = []
        for event in events:
            # Count attendees
            attending_count = EventAttendance.objects.filter(event=event, status='attending').count()
            events_data.append({
                'id': event.id,
                'title': event.title,
                'description': event.description,
                'event_type': event.get_event_type_display(),
                'start_date': event.start_date.isoformat(),
                'location': event.location,
                'created_at': event.created_at.isoformat(),
                'is_upcoming': event.is_upcoming,
                'is_ongoing': event.is_ongoing,
                'attending_count': attending_count,
            })
        
        return JsonResponse({
            'success': True,
            'events': events_data
        })
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@login_required
@require_http_methods(["GET"])
def get_event_attendees(request, event_id):
    """Get list of attendees for a specific event - for community owners"""
    if not getattr(request.user, 'role', None) == 'communityowner':
        return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=403)
    
    try:
        # Get community profile
        community = CommunityProfile.objects.get(owner=request.user)
        
        # Get event and verify it belongs to the community
        event = get_object_or_404(Event, id=event_id, community=community, is_active=True)
        
        # Get all attendees (status='attending')
        # Order by username if full_name field doesn't exist in DB, otherwise by full_name
        try:
            attendees = EventAttendance.objects.filter(
                event=event,
                status='attending'
            ).select_related('user').order_by('user__username')
        except:
            # Fallback to username only if full_name causes issues
            attendees = EventAttendance.objects.filter(
                event=event,
                status='attending'
            ).select_related('user').order_by('user__username')
        
        attendees_data = []
        for attendance in attendees:
            user = attendance.user
            # Use full_name field if available, otherwise fallback to username
            full_name = getattr(user, 'full_name', None) or user.username
            attendees_data.append({
                'id': user.id,
                'full_name': full_name,
                'email': user.email,
                'username': user.username,
            })
        
        return JsonResponse({
            'success': True,
            'event_title': event.title,
            'attendees': attendees_data,
            'total_count': len(attendees_data)
        })
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@login_required
@require_http_methods(["GET"])
def check_new_events(request):
    """Check for new events since last_check_id - for all users"""
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Authentication required'}, status=401)
    
    # Get user's community
    try:
        if request.user.role == 'communityowner':
            community = CommunityProfile.objects.filter(owner=request.user).first()
        else:
            membership = CommunityMembership.objects.select_related('community').filter(user=request.user).first()
            if not membership or not membership.community:
                return JsonResponse({'error': 'No community access'}, status=403)
            community = membership.community
        
        if not community:
            return JsonResponse({'error': 'No community access'}, status=403)
    except Exception as e:
        return JsonResponse({'error': f'Community access error: {str(e)}'}, status=403)
    
    # Get last checked event ID from request
    last_check_id = request.GET.get('last_check_id', 0)
    try:
        last_check_id = int(last_check_id)
    except (ValueError, TypeError):
        last_check_id = 0
    
    # Get new events (events with ID greater than last_check_id)
    # Only get upcoming/ongoing events (not completed ones)
    now = timezone.now()
    event_duration = timedelta(hours=24)
    
    new_events = Event.objects.filter(
        community=community,
        is_active=True,
        id__gt=last_check_id,
        start_date__gt=now - event_duration  # Only upcoming or recently started events
    ).order_by('-created_at')[:10]  # Limit to 10 most recent
    
    # Format new events for response
    events_data = []
    for event in new_events:
        events_data.append({
            'id': event.id,
            'title': event.title,
            'event_type': event.event_type,
            'start_date': event.start_date.isoformat(),
            'created_at': event.created_at.isoformat(),
        })
    
    # Get the highest event ID to send back for next check
    latest_event = Event.objects.filter(community=community, is_active=True).order_by('-id').first()
    current_max_id = latest_event.id if latest_event else 0
    
    # Count only unseen upcoming/ongoing events (not completed ones) for badge display
    # Events are considered completed if they started more than 24 hours ago
    # Only show badge for upcoming and ongoing events
    # Also exclude events the user has RSVP'd to (attending or not_attending)
    unseen_events_qs = Event.objects.filter(
        community=community,
        is_active=True,
        id__gt=last_check_id,
        start_date__gt=now - event_duration  # Only upcoming or ongoing events (within 24 hours)
    )
    
    # Get event IDs the user has already RSVP'd to (they've "seen" these events)
    # Get all RSVP'd event IDs first, then exclude them
    rsvp_event_ids = list(EventAttendance.objects.filter(
        user=request.user,
        event__community=community,
        event__is_active=True,
        event__start_date__gt=now - event_duration
    ).values_list('event_id', flat=True))
    
    # Exclude RSVP'd events from the unseen count
    if rsvp_event_ids:
        unseen_events_count = unseen_events_qs.exclude(id__in=rsvp_event_ids).count()
    else:
        unseen_events_count = unseen_events_qs.count()
    
    return JsonResponse({
        'new_events': events_data,
        'current_max_id': current_max_id,
        'has_new_events': len(events_data) > 0,
        'unseen_events_count': unseen_events_count  # Count of unseen upcoming/ongoing events only
    })
