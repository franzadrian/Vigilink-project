from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, HttpResponseForbidden
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST, require_GET
from django.contrib import messages
from django.core.paginator import Paginator
from django.utils import timezone
from django.db.models import Q
from .models import Event
from communityowner_panel.models import CommunityProfile, CommunityMembership
from datetime import datetime, timedelta
import json


@login_required
def events_list(request):
    """View for residents and community owners to see events from their community"""
    try:
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
        
        # Get upcoming and ongoing events - sort by start_date (closest to start first)
        upcoming_ongoing_events = Event.objects.filter(
            community=community,
            is_active=True,
            start_date__gte=now
        ).order_by('start_date')
        
        # Get completed events
        completed_events = Event.objects.filter(
            community=community,
            is_active=True,
            start_date__lt=now
        ).order_by('-start_date')  # Most recent first
        
        # Combine for pagination (upcoming first, then completed)
        all_events = list(upcoming_ongoing_events) + list(completed_events)
        
        # Pagination
        paginator = Paginator(all_events, 10)
        page_number = request.GET.get('page')
        page_obj = paginator.get_page(page_number)
        
        context = {
            'events': page_obj,
            'upcoming_ongoing_events': upcoming_ongoing_events,
            'completed_events': completed_events,
            'community': community,
            'event_types': Event.EVENT_TYPE_CHOICES,
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
            })
        
        return JsonResponse({
            'success': True,
            'events': events_data
        })
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)
