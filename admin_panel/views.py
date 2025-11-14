from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden, JsonResponse, HttpResponse, FileResponse
from django.template.loader import render_to_string
from django.contrib.auth import authenticate, login, logout
from django.contrib import messages
from accounts.models import User
from django.core.paginator import Paginator
from django.db.models import Q, Count, Avg
from django.urls import reverse
from django.utils import timezone
from datetime import timedelta
import json
import re
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from admin_panel.models import ContactMessage, Resource
from django.core.cache import cache
import logging
import os
from urllib.parse import quote

logger = logging.getLogger(__name__)

# Create your views here.
@login_required
def admin_dashboard(request):
    # Check if user has admin role or is a superuser
    if request.user.role != 'admin' and not request.user.is_superuser:
        return HttpResponseForbidden("You don't have permission to access this page.")
    
    # Import models
    from communityowner_panel.models import CommunityProfile, CommunityMembership, EmergencyContact
    from security_panel.models import SecurityReport
    from events_panel.models import Event
    from settings_panel.models import Subscription
    
    # Calculate statistics
    now = timezone.now()
    thirty_days_ago = now - timedelta(days=30)
    seven_days_ago = now - timedelta(days=7)
    
    # Basic counts
    total_communities = CommunityProfile.objects.count()
    total_users = User.objects.exclude(role='admin').count()
    total_resources = Resource.objects.count()
    total_security_reports = SecurityReport.objects.count()
    total_events = Event.objects.count()
    total_messages = ContactMessage.objects.count()
    
    # User breakdown by role
    users_by_role = User.objects.exclude(role='admin').values('role').annotate(count=Count('id'))
    role_counts = {item['role']: item['count'] for item in users_by_role}
    
    # Subscription statistics
    total_subscriptions = Subscription.objects.count()
    active_subscriptions = Subscription.objects.filter(status='active').count()
    active_trials = Subscription.objects.filter(status='active', is_trial=True).count()
    active_paid = Subscription.objects.filter(status='active', is_trial=False).count()
    expired_subscriptions = Subscription.objects.filter(status='expired').count()
    
    # Security reports breakdown
    security_reports_by_status = SecurityReport.objects.values('status').annotate(count=Count('id'))
    status_counts = {item['status']: item['count'] for item in security_reports_by_status}
    
    # Communities without emergency contacts
    communities_without_ec = CommunityProfile.objects.annotate(
        ec_count=Count('emergency_contacts')
    ).filter(ec_count=0).count()
    
    # Recent activity
    recent_users = User.objects.exclude(role='admin').order_by('-date_joined')[:5]
    recent_communities = CommunityProfile.objects.order_by('-created_at')[:5]
    recent_security_reports = SecurityReport.objects.order_by('-created_at')[:5]
    recent_resources = Resource.objects.order_by('-created_at')[:5]
    recent_events = Event.objects.order_by('-created_at')[:5]
    
    # User growth (last 30 days)
    new_users_30d = User.objects.exclude(role='admin').filter(date_joined__gte=thirty_days_ago).count()
    new_users_7d = User.objects.exclude(role='admin').filter(date_joined__gte=seven_days_ago).count()
    
    # Community growth
    new_communities_30d = CommunityProfile.objects.filter(created_at__gte=thirty_days_ago).count()
    
    # Average community size
    avg_community_size = CommunityMembership.objects.values('community').annotate(
        member_count=Count('user')
    ).aggregate(avg=Avg('member_count'))['avg'] or 0
    
    # High priority security reports
    high_priority_reports = SecurityReport.objects.filter(
        Q(priority='level_1') | Q(status='pending')
    ).order_by('-created_at')[:5]
    
    # Expired trials
    expired_trials = Subscription.objects.filter(
        status='expired',
        is_trial=True
    ).order_by('-trial_expired_at')[:5]
    
    # Most active communities (by member count)
    most_active_communities = CommunityProfile.objects.annotate(
        member_count=Count('members')
    ).order_by('-member_count')[:5]
    
    # Events by type
    events_by_type = Event.objects.values('event_type').annotate(count=Count('id'))
    event_type_counts = {item['event_type']: item['count'] for item in events_by_type}
    
    # Most common reasons from security reports across all communities
    from collections import Counter
    all_reasons = []
    security_reports_all = SecurityReport.objects.all()
    for report in security_reports_all:
        if isinstance(report.reasons, list):
            all_reasons.extend(report.reasons)
    
    reason_counts = Counter(all_reasons)
    # Get top 6 most common reasons
    top_reasons = reason_counts.most_common(6)
    if top_reasons:
        common_reasons_data = {
            'labels': [reason[0] for reason in top_reasons],
            'counts': [reason[1] for reason in top_reasons]
        }
    else:
        # If no reasons found, provide empty data
        common_reasons_data = {
            'labels': [],
            'counts': []
        }
    
    # Prepare context
    context = {
        # Key statistics
        'total_communities': total_communities,
        'total_users': total_users,
        'total_resources': total_resources,
        'total_security_reports': total_security_reports,
        'total_events': total_events,
        'total_messages': total_messages,
        
        # User breakdown
        'role_counts': role_counts,
        'community_owners': role_counts.get('communityowner', 0),
        'residents': role_counts.get('resident', 0),
        'security': role_counts.get('security', 0),
        'guests': role_counts.get('guest', 0),
        
        # Subscription statistics
        'total_subscriptions': total_subscriptions,
        'active_subscriptions': active_subscriptions,
        'active_trials': active_trials,
        'active_paid': active_paid,
        'expired_subscriptions': expired_subscriptions,
        
        # Security reports
        'status_counts': status_counts,
        'pending_reports': status_counts.get('pending', 0),
        'resolved_reports': status_counts.get('resolved', 0),
        'investigating_reports': status_counts.get('investigating', 0),
        'false_alarm_reports': status_counts.get('false_alarm', 0),
        
        # System health
        'communities_without_ec': communities_without_ec,
        'high_priority_reports': high_priority_reports,
        'expired_trials': expired_trials,
        
        # Recent activity
        'recent_users': recent_users,
        'recent_communities': recent_communities,
        'recent_security_reports': recent_security_reports,
        'recent_resources': recent_resources,
        'recent_events': recent_events,
        
        # Growth metrics
        'new_users_30d': new_users_30d,
        'new_users_7d': new_users_7d,
        'new_communities_30d': new_communities_30d,
        'avg_community_size': round(avg_community_size, 1),
        
        # Additional metrics
        'most_active_communities': most_active_communities,
        'event_type_counts': event_type_counts,
        
        # For JavaScript charts
        'subscription_data': {
            'active_paid': active_paid,
            'active_trials': active_trials,
            'expired': expired_subscriptions,
        },
        'common_reasons_data': common_reasons_data,
    }
    
    return render(request, 'admin_dashboard/admin_dashboard.html', context)

@login_required
def admin_resident(request):
    # Check if user has admin role or is a superuser
    if request.user.role != 'admin' and not request.user.is_superuser:
        return HttpResponseForbidden("You don't have permission to access this page.")
    
    # Optimized queryset with better select_related and only necessary fields
    qs = (
        User.objects
        .select_related('city', 'district')
        .only('id', 'full_name', 'username', 'email', 'address', 'block', 'lot', 'role', 'date_joined', 'contact', 'city__name', 'district__name')
        .exclude(role='admin')
    )

    # Optional search (q) and role filter
    q = (request.GET.get('q') or '').strip()
    role = (request.GET.get('role') or '').strip().lower()
    
    # Map URL parameter to database role value
    role_mapping = {
        'guest': 'guest',
        'resident': 'resident',
        'community_owner': 'communityowner',  # Map URL param to DB value
        'security': 'security'
    }
    
    if q:
        qs = qs.filter(
            Q(full_name__icontains=q) |
            Q(username__icontains=q) |
            Q(email__icontains=q) |
            Q(address__icontains=q) |
            Q(city__name__icontains=q) |
            Q(district__name__icontains=q)
        )
    
    if role and role in ('guest', 'resident', 'community_owner', 'security'):
        # Use mapped role value for database query
        db_role = role_mapping.get(role, role)
        qs = qs.filter(role=db_role)

    # Optimized ordering and pagination
    qs = qs.order_by('id')
    
    # Server-side pagination with smaller page size for better performance
    page_number = request.GET.get('page') or 1
    try:
        page_number = int(page_number)
    except Exception:
        page_number = 1
    
    paginator = Paginator(qs, 10)  # Set to 10 per page as requested
    page_obj = paginator.get_page(page_number)
    users = page_obj.object_list
    
    # Cache cities and districts - only fetch if needed for editing
    from accounts.models import City, District
    
    # Use cache for cities and districts to avoid repeated queries
    cities = cache.get('admin_cities')
    if cities is None:
        cities = list(City.objects.only('name').order_by('name'))
        cache.set('admin_cities', cities, 300)  # Cache for 5 minutes
    
    districts = cache.get('admin_districts')
    if districts is None:
        districts = list(District.objects.select_related('city').only('name', 'city__name').order_by('name'))
        cache.set('admin_districts', districts, 300)  # Cache for 5 minutes
    
    return render(request, 'admin_residents/admin_resident.html', {
        'users': users,
        'page_obj': page_obj,
        'paginator': paginator,
        'total_count': paginator.count,
        'q': q,
        'role_filter': role,
        'cities': cities,
        'districts': districts,
    })

def admin_index(request):
    # This view is accessible to anyone
    return render(request, 'admin_dashboard/admin_index.html')

def admin_login(request):
    # This view is accessible to anyone, but only admins/superusers can successfully log in
    if request.user.is_authenticated and (request.user.role == 'admin' or request.user.is_superuser):
        return redirect('admin_panel:admin_dashboard')
    
    if request.method == 'POST':
        email_or_username = request.POST.get('email')
        password = request.POST.get('password')
        
        # Try to authenticate with username
        user = authenticate(request, username=email_or_username, password=password)
        
        # If authentication fails, try with email
        if user is None:
            try:
                from accounts.models import User
                user_obj = User.objects.get(email=email_or_username)
                user = authenticate(request, username=user_obj.username, password=password)
            except User.DoesNotExist:
                user = None
        
        if user is not None:
            # Check if user is verified
            if not user.is_verified:
                messages.error(request, 'Please verify your email address before logging in.')
                return render(request, 'admin_dashboard/admin_login.html')
            
            # Check if user is admin or superuser
            if user.role == 'admin' or user.is_superuser:
                login(request, user)
                return redirect('admin_panel:admin_dashboard')
            else:
                messages.error(request, 'You do not have permission to access the admin dashboard.')
                return render(request, 'admin_dashboard/admin_login.html')
        else:
            messages.error(request, 'Invalid username/email or password.')
            return render(request, 'admin_dashboard/admin_login.html')
    
    return render(request, 'admin_dashboard/admin_login.html')

def admin_logout(request):
    # Custom logout view that redirects to admin login page
    logout(request)
    return redirect('admin_panel:admin_login')

@login_required
@csrf_exempt
def update_user(request):
    # Check if user has admin role or is a superuser
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Permission denied'}, status=403)
    
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            user_id = data.get('user_id')
            user = get_object_or_404(User, id=user_id)
            
            # Update user fields
            user.full_name = data.get('name', user.full_name)
            user.username = data.get('username', user.username)
            user.email = data.get('email', user.email)
            user.contact = data.get('contact', user.contact)  # Changed from phone_number to contact
            user.address = data.get('address', user.address)
            user.block = data.get('block', user.block)
            user.lot = data.get('lot', user.lot)
            
            # Handle role update
            role = data.get('role', '').lower()
            if role in ['guest', 'resident', 'community_owner', 'security']:
                user.role = role
            
            # Handle city and district (these might be foreign keys)
            # This is a simplified approach - you might need to adjust based on your model
            if 'city' in data and data['city']:
                from accounts.models import City
                try:
                    city = City.objects.get(name=data['city'])
                    user.city = city
                except City.DoesNotExist:
                    pass
                    
            if 'district' in data and data['district']:
                from accounts.models import District
                try:
                    district = District.objects.get(name=data['district'])
                    user.district = district
                except District.DoesNotExist:
                    pass
            
            user.save()
            
            # Clear cache when user is updated
            cache.delete('admin_cities')
            cache.delete('admin_districts')
            
            # Return the updated user data in the response
            return JsonResponse({
                'status': 'success',
                'user': {
                    'id': user.id,
                    'name': user.full_name,
                    'username': user.username,
                    'email': user.email,
                    'contact': user.contact,
                    'address': user.address,
                    'city': user.city.name if user.city else '',
                    'district': user.district.name if user.district else '',
                    'block': user.block,
                    'lot': user.lot,
                    'role': user.role
                }
            })
            
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)
    
    return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=405)

@login_required
def admin_communication(request):
    # Check if user has admin role or is a superuser
    if request.user.role != 'admin' and not request.user.is_superuser:
        return HttpResponseForbidden("You don't have permission to access this page.")
    
    # Get all contact messages, ordering unread messages first, then by creation date
    from .models import ContactMessage
    from django.db.models import Case, When, BooleanField, Q
    
    # Get search and filter parameters
    search_query = request.GET.get('search', '').strip()
    filter_type = request.GET.get('type', 'all').strip().lower()
    
    # Base queryset
    contact_messages_qs = ContactMessage.objects.all()
    
    # Apply search filter (search by Full Name only)
    if search_query:
        contact_messages_qs = contact_messages_qs.filter(name__icontains=search_query)
    
    # Apply type filter
    if filter_type == 'feedback':
        contact_messages_qs = contact_messages_qs.filter(subject__icontains='feedback')
    elif filter_type == 'report':
        contact_messages_qs = contact_messages_qs.filter(subject__icontains='report')
    elif filter_type == 'inquiry':
        contact_messages_qs = contact_messages_qs.filter(
            Q(subject__icontains='inquiry') | Q(subject__icontains='enquiry')
        )
    # 'all' shows everything, no additional filter needed
    
    # Order by is_read (False first), then by created_at (newest first)
    contact_messages_qs = contact_messages_qs.order_by('is_read', '-created_at')
    
    # Check if this is an AJAX request
    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'
    
    # Pagination
    page_number = request.GET.get('page') or 1
    try:
        page_number = int(page_number)
    except Exception:
        page_number = 1
    
    paginator = Paginator(contact_messages_qs, 10)  # 10 messages per page
    page_obj = paginator.get_page(page_number)
    contact_messages = page_obj.object_list
    
    context = {
        'contact_messages': contact_messages,
        'page_obj': page_obj,
        'paginator': paginator,
        'total_count': paginator.count,
        'search_query': search_query,
        'filter_type': filter_type,
    }
    
    # If AJAX request, return partial template
    if is_ajax:
        from django.template.loader import render_to_string
        from django.http import HttpResponse
        html = render_to_string('admin_communication/communication_partial.html', context, request=request)
        return HttpResponse(html)
    
    return render(request, 'admin_communication/admin_communication.html', context)

@login_required
def get_new_messages(request):
    """API endpoint to fetch new messages for real-time updates"""
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Permission denied'}, status=403)
    
    # Get the last timestamp from the request, if provided
    last_timestamp = request.GET.get('last_timestamp', None)
    
    # Base query for unread messages
    query = ContactMessage.objects.filter(is_read=False)
    
    # If last_timestamp is provided, only get messages newer than that timestamp
    if last_timestamp and last_timestamp != 'null' and last_timestamp != '0':
        from django.utils import timezone
        import datetime
        
        try:
            # Convert timestamp to datetime
            timestamp_float = float(last_timestamp) / 1000.0  # Convert from milliseconds to seconds
            last_datetime = datetime.datetime.fromtimestamp(timestamp_float, tz=timezone.get_current_timezone())
            
            # Only get messages created after the last timestamp
            query = query.filter(created_at__gt=last_datetime)
        except (ValueError, TypeError):
            # If timestamp conversion fails, ignore the filter
            pass
    
    # Get the filtered messages, ordered by creation date (newest first)
    unread_messages = query.order_by('-created_at')
    
    # Format messages for JSON response
    messages_data = [{
        'id': msg.contact_id,
        'name': msg.name,
        'email': msg.email,
        'subject': msg.subject,
        'message': msg.message,
        'created_at': msg.created_at.strftime('%Y-%m-%d %H:%M:%S'),
        'is_read': msg.is_read
    } for msg in unread_messages]
    
    # Get total unread count (not just filtered by timestamp)
    total_unread_count = ContactMessage.objects.filter(is_read=False).count()
    
    return JsonResponse({
        'status': 'success',
        'unread_count': total_unread_count,
        'messages': messages_data
    })


@login_required
def get_message_details(request, message_id):
    """Get message details API endpoint"""
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Permission denied'}, status=403)
    try:
        message = ContactMessage.objects.get(contact_id=message_id)
        is_registered = message.user is not None
        return JsonResponse({
            'status': 'success',
            'message': message.message,
            'email': message.email,
            'is_registered': is_registered,
            'user_id': message.user_id
        })
    except ContactMessage.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Message not found'}, status=404)

@login_required
@require_POST
def mark_message_read(request, message_id):
    """Mark a message as read"""
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Permission denied'}, status=403)
    
    try:
        message = ContactMessage.objects.get(contact_id=message_id)
        message.is_read = True
        message.save()
        return JsonResponse({'status': 'success'})
    except ContactMessage.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Message not found'}, status=404)

@login_required
@require_POST
def delete_message(request, message_id):
    """Delete a message"""
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Permission denied'}, status=403)
    
    try:
        message = ContactMessage.objects.get(contact_id=message_id)
        message.delete()
        return JsonResponse({'status': 'success'})
    except ContactMessage.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Message not found'}, status=404)

@login_required
def get_unread_count(request):
    """API endpoint to fetch only the unread message count"""
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Permission denied'}, status=403)
    
    # Get total unread count
    total_unread_count = ContactMessage.objects.filter(is_read=False).count()
    
    return JsonResponse({
        'status': 'success',
        'unread_count': total_unread_count
    })

@login_required
def get_contact_type_for_user(request, user_id):
    """Return the latest contact request type for a given user."""
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Permission denied'}, status=403)
    try:
        msg = ContactMessage.objects.filter(user_id=user_id).order_by('-created_at').first()
        if not msg:
            return JsonResponse({'status': 'success', 'type': 'General Inquiry'})
        subj = (msg.subject or '').strip().lower()
        if 'feedback' in subj:
            ctype = 'Feedback'
        elif 'report' in subj:
            ctype = 'Reports'
        elif 'inquiry' in subj or 'enquiry' in subj:
            ctype = 'General Inquiry'
        else:
            ctype = 'General Inquiry'
        return JsonResponse({'status': 'success', 'type': ctype, 'subject': msg.subject, 'created_at': msg.created_at.strftime('%Y-%m-%d %H:%M:%S')})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

@login_required
def get_done_messages(request):
    """Return list of done (read) contact messages for inbox view."""
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Permission denied'}, status=403)
    try:
        qs = ContactMessage.objects.filter(is_read=True).order_by('-created_at')[:200]
        data = []
        for m in qs:
            subj = (m.subject or '').strip().lower()
            if 'feedback' in subj:
                ctype = 'Feedback'
            elif 'report' in subj:
                ctype = 'Reports'
            elif 'inquiry' in subj or 'enquiry' in subj:
                ctype = 'General Inquiry'
            else:
                ctype = 'General Inquiry'
            data.append({
                'id': m.contact_id,
                'user_id': m.user_id,
                'name': m.name,
                'subject': m.subject,
                'message': m.message,
                'type': ctype,
                'created_at': m.created_at.strftime('%Y-%m-%dT%H:%M:%S')
            })
        return JsonResponse({'status': 'success', 'items': data})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

@login_required
@require_POST
def mark_contact_done_for_user(request, user_id):
    """Mark all contact requests for a specific user as done (read)."""
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Permission denied'}, status=403)
    try:
        updated = ContactMessage.objects.filter(user_id=user_id, is_read=False).update(is_read=True)
        return JsonResponse({'status': 'success', 'updated': updated})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

@login_required
@csrf_exempt
def delete_user(request):
    # Check if user has admin role or is a superuser
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Permission denied'}, status=403)
    
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            user_id = data.get('user_id')
            user = get_object_or_404(User, id=user_id)
            
            # Delete the user
            user.delete()
            
            # Clear cache when user is deleted
            cache.delete('admin_cities')
            cache.delete('admin_districts')
            
            return JsonResponse({
                'status': 'success',
                'message': 'User deleted successfully'
            })
            
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)
    
    return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=405)

@login_required
def admin_alert(request):
    # Check if user has admin role or is a superuser
    if request.user.role != 'admin' and not request.user.is_superuser:
        return HttpResponseForbidden("You don't have permission to access this page.")
    
    from admin_panel.models import SafetyTip, PlatformAnnouncement
    from accounts.models import LocationEmergencyContact, City, District
    
    # Get all safety tips
    safety_tips = SafetyTip.objects.all().order_by('-created_at')
    
    # Get all communities for the dropdown
    from communityowner_panel.models import CommunityProfile
    communities = CommunityProfile.objects.all().order_by('community_name')
    
    # Get all platform announcements with pagination (admin sees all, not filtered by dates)
    from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
    announcements_queryset = PlatformAnnouncement.objects.all().order_by('-created_at')
    
    # Paginate announcements (4 per page)
    paginator = Paginator(announcements_queryset, 4)
    page = request.GET.get('announcement_page', 1)
    try:
        announcements_page = paginator.page(page)
    except PageNotAnInteger:
        announcements_page = paginator.page(1)
    except EmptyPage:
        announcements_page = paginator.page(paginator.num_pages)
    
    announcements = announcements_page
    
    # Get all location emergency contacts and group them by district
    all_contacts = LocationEmergencyContact.objects.select_related('district', 'district__city').all().order_by('id')
    
    # Group contacts by district
    grouped_contacts = {}
    for contact in all_contacts:
        location_key = f"district_{contact.district.id}"
        location_name = contact.district.name
        city_name = contact.district.city.name if contact.district.city else None
        city_id = contact.district.city.id if contact.district.city else None
        
        if location_key not in grouped_contacts:
            grouped_contacts[location_key] = {
                'location_name': location_name,
                'location_type': 'district',
                'district_id': contact.district.id,
                'city_name': city_name,
                'city_id': city_id,
                'contacts': []
            }
        
        grouped_contacts[location_key]['contacts'].append({
            'id': contact.id,
            'label': contact.label,
            'phone': contact.phone,
        })
    
    # Convert to list for template
    location_contacts_grouped = list(grouped_contacts.values())
    
    # Get districts and cities for dropdowns
    districts = District.objects.select_related('city').all().order_by('city__name', 'name')
    cities = City.objects.all().order_by('name')
    
    # Communities already fetched above
    
    context = {
        'safety_tips': safety_tips,
        'announcements': announcements,
        'location_contacts_grouped': location_contacts_grouped,
        'districts': districts,
        'cities': cities,
        'communities': communities,
    }
    
    # Check if this is an AJAX request for announcements pagination
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest' and request.GET.get('announcement_page'):
        # Return only the announcements container HTML for AJAX requests
        announcements_html = render_to_string('admin_alerts/announcements_partial.html', context, request=request)
        return HttpResponse(announcements_html)
    
    return render(request, 'admin_alerts/admin_alert.html', context)

@login_required
def manage_safety_tip(request):
    """Create, update, or delete safety tips"""
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'success': False, 'error': 'Permission denied'}, status=403)
    
    from admin_panel.models import SafetyTip
    
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            action = data.get('action')
            
            if action == 'create':
                tip = SafetyTip.objects.create(
                    content=data.get('content', ''),
                    created_by=request.user
                )
                tip.refresh_from_db()
                return JsonResponse({
                    'success': True,
                    'tip': {
                        'id': tip.id,
                        'content': tip.content,
                        'created_at': tip.created_at.isoformat(),
                    }
                })
            
            elif action == 'update':
                tip = get_object_or_404(SafetyTip, id=data.get('id'))
                tip.content = data.get('content', tip.content)
                tip.save()
                tip.refresh_from_db()
                return JsonResponse({
                    'success': True,
                    'tip': {
                        'id': tip.id,
                        'content': tip.content,
                        'created_at': tip.created_at.isoformat(),
                    }
                })
            
            elif action == 'delete':
                tip = get_object_or_404(SafetyTip, id=data.get('id'))
                tip.delete()
                return JsonResponse({'success': True})
            
            else:
                return JsonResponse({'success': False, 'error': 'Invalid action'}, status=400)
        
        except Exception as e:
            logger.error(f"Error managing safety tip: {str(e)}", exc_info=True)
            return JsonResponse({'success': False, 'error': str(e)}, status=500)
    
    elif request.method == 'GET':
        # Get single safety tip for editing
        tip_id = request.GET.get('id')
        if tip_id:
            tip = get_object_or_404(SafetyTip, id=tip_id)
            return JsonResponse({
                'success': True,
                'tip': {
                    'id': tip.id,
                    'content': tip.content,
                }
            })
    
    return JsonResponse({'success': False, 'error': 'Invalid method'}, status=405)

@login_required
def manage_location_contact(request):
    """Create, update, or delete location emergency contacts"""
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'success': False, 'error': 'Permission denied'}, status=403)
    
    from accounts.models import LocationEmergencyContact
    
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            action = data.get('action')
            
            if action == 'create':
                district_id = data.get('district_id')
                
                if not district_id:
                    return JsonResponse({'success': False, 'error': 'District must be selected'}, status=400)
                
                contact = LocationEmergencyContact.objects.create(
                    district_id=district_id,
                    label=data.get('label', ''),
                    phone=data.get('phone', '')
                )
                return JsonResponse({
                    'success': True,
                    'contact': {
                        'id': contact.id,
                        'label': contact.label,
                        'phone': contact.phone,
                        'district': contact.district.name,
                        'district_id': contact.district.id,
                    }
                })
            
            elif action == 'update':
                contact = get_object_or_404(LocationEmergencyContact, id=data.get('id'))
                district_id = data.get('district_id')
                
                if district_id:
                    contact.district_id = district_id
                
                contact.label = data.get('label', contact.label)
                contact.phone = data.get('phone', contact.phone)
                contact.save()
                return JsonResponse({
                    'success': True,
                    'contact': {
                        'id': contact.id,
                        'label': contact.label,
                        'phone': contact.phone,
                        'district': contact.district.name,
                        'district_id': contact.district.id,
                    }
                })
            
            elif action == 'delete':
                contact = get_object_or_404(LocationEmergencyContact, id=data.get('id'))
                contact.delete()
                return JsonResponse({'success': True})
            
            else:
                return JsonResponse({'success': False, 'error': 'Invalid action'}, status=400)
        
        except Exception as e:
            logger.error(f"Error managing location contact: {str(e)}", exc_info=True)
            return JsonResponse({'success': False, 'error': str(e)}, status=500)
    
    elif request.method == 'GET':
        # Get contact data for editing
        contact_id = request.GET.get('id')
        if contact_id:
            try:
                contact = get_object_or_404(LocationEmergencyContact, id=contact_id)
                return JsonResponse({
                    'success': True,
                    'contact': {
                        'id': contact.id,
                        'label': contact.label,
                        'phone': contact.phone,
                        'district_id': contact.district.id,
                        'city_id': contact.district.city.id if contact.district.city else None,
                    }
                })
            except Exception as e:
                return JsonResponse({'success': False, 'error': str(e)}, status=500)
        return JsonResponse({'success': False, 'error': 'Missing id parameter'}, status=400)
    
    return JsonResponse({'success': False, 'error': 'Invalid method'}, status=405)

@login_required
def get_districts_by_city(request, city_id):
    """Get all districts for a specific city"""
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'success': False, 'error': 'Permission denied'}, status=403)
    
    from accounts.models import District
    districts = District.objects.filter(city_id=city_id).order_by('name')
    
    return JsonResponse({
        'success': True,
        'districts': [{'id': d.id, 'name': d.name} for d in districts]
    })

@login_required
def manage_announcement(request):
    """Create, update, or delete platform announcements"""
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'success': False, 'error': 'Permission denied'}, status=403)
    
    from admin_panel.models import PlatformAnnouncement
    
    if request.method == 'POST':
        try:
            # Handle file uploads (FormData) vs JSON
            if request.content_type and 'multipart/form-data' in request.content_type:
                action = request.POST.get('action')
                announcement_id = request.POST.get('id')
                
                if action == 'create':
                    from django.utils.dateparse import parse_datetime
                    start_date = parse_datetime(request.POST.get('start_date'))
                    end_date = parse_datetime(request.POST.get('end_date')) if request.POST.get('end_date') else None
                    community_id = request.POST.get('community_id') if request.POST.get('community_id') else None
                    
                    announcement = PlatformAnnouncement.objects.create(
                        title=request.POST.get('title', ''),
                        content=request.POST.get('content', ''),
                        start_date=start_date or timezone.now(),
                        end_date=end_date,
                        community_id=community_id,
                        created_by=request.user
                    )
                    
                    # Handle image upload
                    if 'image' in request.FILES:
                        announcement.image = request.FILES['image']
                        announcement.save()
                    
                    # Refresh from database to get updated image URL
                    announcement.refresh_from_db()
                    
                    return JsonResponse({
                        'success': True,
                        'announcement': {
                            'id': announcement.id,
                            'title': announcement.title,
                            'content': announcement.content,
                            'image_url': announcement.image.url if announcement.image else None,
                            'community_id': announcement.community.id if announcement.community else None,
                            'community_name': announcement.community.community_name if announcement.community else None,
                            'start_date': announcement.start_date.isoformat(),
                            'end_date': announcement.end_date.isoformat() if announcement.end_date else None,
                        }
                    })
                
                elif action == 'update':
                    announcement = get_object_or_404(PlatformAnnouncement, id=announcement_id)
                    from django.utils.dateparse import parse_datetime
                    
                    announcement.title = request.POST.get('title', announcement.title)
                    announcement.content = request.POST.get('content', announcement.content)
                    community_id = request.POST.get('community_id')
                    if community_id:
                        announcement.community_id = community_id if community_id != '' else None
                    else:
                        announcement.community_id = None
                    
                    if request.POST.get('start_date'):
                        announcement.start_date = parse_datetime(request.POST.get('start_date'))
                    if request.POST.get('end_date'):
                        announcement.end_date = parse_datetime(request.POST.get('end_date'))
                    
                    # Handle image upload
                    if 'image' in request.FILES:
                        announcement.image = request.FILES['image']
                    
                    announcement.save()
                    # Refresh from database to get updated image URL
                    announcement.refresh_from_db()
                    
                    return JsonResponse({
                        'success': True,
                        'announcement': {
                            'id': announcement.id,
                            'title': announcement.title,
                            'content': announcement.content,
                            'image_url': announcement.image.url if announcement.image else None,
                            'community_id': announcement.community.id if announcement.community else None,
                            'community_name': announcement.community.community_name if announcement.community else None,
                            'start_date': announcement.start_date.isoformat(),
                            'end_date': announcement.end_date.isoformat() if announcement.end_date else None,
                        }
                    })
                
                elif action == 'delete':
                    announcement = get_object_or_404(PlatformAnnouncement, id=announcement_id)
                    announcement.delete()
                    return JsonResponse({'success': True})
                
                else:
                    return JsonResponse({'success': False, 'error': 'Invalid action'}, status=400)
            else:
                # JSON request (for delete without file)
                data = json.loads(request.body)
                action = data.get('action')
                
                if action == 'delete':
                    announcement = get_object_or_404(PlatformAnnouncement, id=data.get('id'))
                    announcement.delete()
                    return JsonResponse({'success': True})
                else:
                    return JsonResponse({'success': False, 'error': 'Use FormData for create/update with images'}, status=400)
        
        except Exception as e:
            logger.error(f"Error managing announcement: {str(e)}", exc_info=True)
            return JsonResponse({'success': False, 'error': str(e)}, status=500)
    
    elif request.method == 'GET':
        # Get announcement data for editing
        announcement_id = request.GET.get('id')
        if announcement_id:
            try:
                announcement = get_object_or_404(PlatformAnnouncement, id=announcement_id)
                return JsonResponse({
                    'success': True,
                    'announcement': {
                        'id': announcement.id,
                        'title': announcement.title,
                        'content': announcement.content,
                        'image_url': announcement.image.url if announcement.image else None,
                        'community_id': announcement.community.id if announcement.community else None,
                        'start_date': announcement.start_date.isoformat(),
                        'end_date': announcement.end_date.isoformat() if announcement.end_date else None,
                    }
                })
            except Exception as e:
                return JsonResponse({'success': False, 'error': str(e)}, status=500)
        return JsonResponse({'success': False, 'error': 'Missing id parameter'}, status=400)
    
    return JsonResponse({'success': False, 'error': 'Invalid method'}, status=405)

@login_required
def get_alerts_data(request):
    """AJAX endpoint to fetch alerts data with filters and pagination"""
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'success': False, 'error': 'Permission denied'}, status=403)
    
    from security_panel.models import SecurityReport, Incident
    from django.core.paginator import Paginator
    
    # Get filter parameters
    filter_type = request.GET.get('filter', 'all')  # all, security_reports, incidents
    status_filter = request.GET.get('status', 'all')
    priority_filter = request.GET.get('priority', 'all')
    page = int(request.GET.get('page', 1))
    
    # Build queryset
    alerts_list = []
    
    # Get security reports
    if filter_type == 'all' or filter_type == 'security_reports':
        security_reports = SecurityReport.objects.select_related(
            'reporter', 'community', 'target_user'
        ).all()
        
        if status_filter != 'all':
            security_reports = security_reports.filter(status=status_filter)
        if priority_filter != 'all':
            security_reports = security_reports.filter(priority=priority_filter)
        
        for report in security_reports:
            alerts_list.append({
                'id': report.id,
                'type': 'security_report',
                'title': report.subject,
                'description': report.message,
                'status': report.status,
                'priority': report.priority,
                'community_name': report.community.community_name if report.community else 'Unknown',
                'reporter_name': report.get_reporter_display(),
                'target_type': report.get_target_display(),
                'location': report.location,
                'reasons': report.reasons if isinstance(report.reasons, list) else [],
                'created_at': report.created_at.isoformat(),
            })
    
    # Get incidents
    if filter_type == 'all' or filter_type == 'incidents':
        incidents = Incident.objects.select_related(
            'reporter', 'community', 'handled_by'
        ).all()
        
        if status_filter != 'all':
            incidents = incidents.filter(status=status_filter)
        
        for incident in incidents:
            alerts_list.append({
                'id': incident.id,
                'type': 'incident',
                'title': incident.title,
                'description': incident.description,
                'status': incident.status,
                'priority': None,  # Incidents don't have priority
                'community_name': incident.community.community_name if incident.community else 'Unknown',
                'reporter_name': incident.get_reporter_display(),
                'incident_type': incident.get_incident_type_display_short(),
                'location': incident.location,
                'created_at': incident.created_at.isoformat(),
            })
    
    # Sort by created_at (newest first)
    alerts_list.sort(key=lambda x: x['created_at'], reverse=True)
    
    # Paginate
    paginator = Paginator(alerts_list, 10)  # 10 alerts per page
    page_obj = paginator.get_page(page)
    
    return JsonResponse({
        'success': True,
        'alerts': list(page_obj.object_list),
        'pagination': {
            'current_page': page_obj.number,
            'total_pages': paginator.num_pages,
            'has_previous': page_obj.has_previous(),
            'has_next': page_obj.has_next(),
            'previous_page': page_obj.previous_page_number() if page_obj.has_previous() else None,
            'next_page': page_obj.next_page_number() if page_obj.has_next() else None,
            'has_pages': paginator.num_pages > 1,
        }
    })

@login_required
@require_POST
@csrf_exempt
def update_alert_status(request):
    """Update the status of an alert (security report or incident)"""
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'success': False, 'error': 'Permission denied'}, status=403)
    
    from security_panel.models import SecurityReport, Incident
    
    try:
        data = json.loads(request.body)
        alert_id = data.get('alert_id')
        alert_type = data.get('alert_type')
        new_status = data.get('status')
        
        if not all([alert_id, alert_type, new_status]):
            return JsonResponse({'success': False, 'error': 'Missing required parameters'}, status=400)
        
        if alert_type == 'security_report':
            alert_obj = get_object_or_404(SecurityReport, id=alert_id)
        elif alert_type == 'incident':
            alert_obj = get_object_or_404(Incident, id=alert_id)
        else:
            return JsonResponse({'success': False, 'error': 'Invalid alert type'}, status=400)
        
        alert_obj.status = new_status
        if new_status == 'resolved':
            alert_obj.resolved_at = timezone.now()
        alert_obj.save()
        
        return JsonResponse({'success': True})
    except Exception as e:
        logger.error(f"Error updating alert status: {str(e)}", exc_info=True)
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
def admin_resources(request):
    """Admin resources page for uploading PDFs and creating text guides"""
    # Check if user has admin role or is a superuser
    if request.user.role != 'admin' and not request.user.is_superuser:
        return HttpResponseForbidden("You don't have permission to access this page.")
    
    if request.method == 'POST':
        # Check if request expects JSON response (check Accept header or if it's an AJAX request)
        accept_header = request.headers.get('Accept', '').lower()
        expects_json = (
            'application/json' in accept_header or
            request.headers.get('X-Requested-With') == 'XMLHttpRequest' or
            request.content_type == 'application/json'
        )
        
        try:
            title = request.POST.get('title', '').strip()
            description = request.POST.get('description', '').strip()
            resource_type = request.POST.get('resource_type', '')
            content = request.POST.get('content', '').strip()
            
            if not title:
                if expects_json:
                    return JsonResponse({'status': 'error', 'message': 'Title is required.'}, status=400)
                messages.error(request, 'Title is required.')
                return redirect('admin_panel:admin_resources')
            
            if resource_type not in ['image', 'video', 'link', 'document']:
                if expects_json:
                    return JsonResponse({'status': 'error', 'message': 'Invalid resource type.'}, status=400)
                messages.error(request, 'Invalid resource type.')
                return redirect('admin_panel:admin_resources')
            
            # Get additional fields
            external_urls = request.POST.getlist('external_urls[]')
            external_url = external_urls[0] if external_urls else ''
            
            # Get community selection (optional)
            community_id = request.POST.get('community', '').strip()
            community = None
            if community_id:
                try:
                    from communityowner_panel.models import CommunityProfile
                    community = CommunityProfile.objects.get(id=int(community_id))
                except (ValueError, CommunityProfile.DoesNotExist):
                    community = None
            
            # Validate external URLs for link type
            if resource_type == 'link':
                if not external_urls or not external_urls[0]:
                    if expects_json:
                        return JsonResponse({'status': 'error', 'message': 'At least one external URL is required for links.'}, status=400)
                    messages.error(request, 'At least one external URL is required for links.')
                    return redirect('admin_panel:admin_resources')
                
                # Basic URL validation
                for url in external_urls:
                    if url and not url.startswith(('http://', 'https://')):
                        if expects_json:
                            return JsonResponse({'status': 'error', 'message': f'Please enter a valid URL: {url}'}, status=400)
                        messages.error(request, f'Please enter a valid URL: {url}')
                        return redirect('admin_panel:admin_resources')

            # Handle multiple URLs for links
            if resource_type == 'link':
                # Store all URLs as JSON in external_url field
                import json
                all_urls = [url for url in external_urls if url]
                if len(all_urls) > 1:
                    # Store as JSON array
                    final_external_url = json.dumps(all_urls)
                else:
                    # Store single URL as string
                    final_external_url = all_urls[0] if all_urls else ''
                final_description = description
            else:
                final_external_url = None
                final_description = description
            
            # Handle file upload for images, videos, and documents (PDFs, TXT, CSV, Excel)
            if resource_type in ['image', 'video', 'document'] and 'file' in request.FILES:
                files = request.FILES.getlist('file')
                
                if resource_type == 'image' and len(files) > 1:
                    # For multiple images, create separate resources with group identifier
                    # Don't create the initial empty resource - create resources directly with files
                    import uuid
                    group_id = str(uuid.uuid4())
                    for i, file in enumerate(files):
                        # Create individual resource for each image directly with the file
                        image_resource = Resource.objects.create(
                            title=f"{title} (Image {i+1})" if len(files) > 1 else title,
                            description=description,
                            resource_type=resource_type,
                            file=file,
                            created_by=request.user,
                            community=community  # Add community to grouped images
                        )
                        # Add group_id to the resource's description for grouping (hidden from display)
                        image_resource.description = f"{description}\n[GROUP_ID:{group_id}]" if description else f"[GROUP_ID:{group_id}]"
                        image_resource.save()
                    # Don't create an empty resource - we've created all the image resources above
                    resource = None
                else:
                    # For single files (PDF, video, document, or single image)
                    # Create resource with the file directly
                    resource = Resource.objects.create(
                        title=title,
                        description=final_description,
                        resource_type=resource_type,
                        file=files[0],
                        external_url=final_external_url,
                        created_by=request.user,
                        community=community
                    )
                    # Don't generate URL immediately - let it happen on page load for faster upload
            else:
                # For links or resources without files, create the resource normally
                resource = Resource.objects.create(
                    title=title,
                    description=final_description,
                    resource_type=resource_type,
                    external_url=final_external_url,
                    created_by=request.user,
                    community=community
                )

            # Determine success message based on file count
            if resource_type == 'image' and 'file' in request.FILES:
                files = request.FILES.getlist('file')
                if len(files) > 1:
                    success_message = f'{len(files)} images uploaded successfully!'
                else:
                    success_message = f'Resource "{title}" created successfully!'
            else:
                success_message = f'Resource "{title}" created successfully!'
            
            if expects_json:
                return JsonResponse({
                    'status': 'success', 
                    'message': success_message,
                    'redirect_url': reverse('admin_panel:admin_resources')
                })
            else:
                messages.success(request, success_message)
                return redirect('admin_panel:admin_resources')

        except Exception as e:
            logger.error(f"Error creating resource: {e}", exc_info=True)
            if expects_json:
                return JsonResponse({'status': 'error', 'message': f'Error creating resource: {str(e)}'}, status=400)
            else:
                messages.error(request, f'Error creating resource: {str(e)}')
                return redirect('admin_panel:admin_resources')
    
    # Get filter parameters
    search_query = request.GET.get('search', '').strip()
    filter_type = request.GET.get('type', 'all')
    filter_community = request.GET.get('community', '')
    
    # Optimized: Get resources with minimal processing
    # Use select_related to avoid N+1 queries
    base_queryset = Resource.objects.filter(is_active=True).select_related(
        'created_by', 'community'
    ).order_by('-created_at')
    
    # Apply search filter
    if search_query:
        base_queryset = base_queryset.filter(title__icontains=search_query)
    
    # Apply resource type filter
    if filter_type != 'all' and filter_type in ['image', 'video', 'link', 'document']:
        base_queryset = base_queryset.filter(resource_type=filter_type)
    
    # Apply community filter
    if filter_community:
        try:
            from communityowner_panel.models import CommunityProfile
            community_obj = CommunityProfile.objects.get(id=int(filter_community))
            base_queryset = base_queryset.filter(community=community_obj)
        except (ValueError, CommunityProfile.DoesNotExist):
            pass  # Invalid community ID, ignore filter
    
    # Group multiple images - only show the first image of each group
    # This needs to be done before pagination to get accurate counts
    all_resources = list(base_queryset)
    resources_list = []
    processed_groups = set()
    
    for resource in all_resources:
        # Check if this is part of a group
        if (resource.resource_type == 'image' and 
            resource.description and 
            '[GROUP_ID:' in resource.description):
            
            # Extract group ID
            try:
                group_id = resource.description.split('[GROUP_ID:')[1].split(']')[0]
                
                if group_id not in processed_groups:
                    # This is the first image in a group, add it to resources
                    processed_groups.add(group_id)
                    resources_list.append(resource)
                # Skip other images in the same group
            except Exception:
                # If we can't extract group ID, add it normally
                resources_list.append(resource)
        else:
            # Not part of a group, add normally
            resources_list.append(resource)
    
    # Get pagination first (only loads what we need from database)
    page_number = request.GET.get('page') or 1
    try:
        page_number = int(page_number)
    except Exception:
        page_number = 1
    
    # Paginate the filtered resources list
    paginator = Paginator(resources_list, 4)
    page_obj = paginator.get_page(page_number)
    
    # Pre-generate URLs for resources on this page only (before template rendering)
    # This batches URL generation and uses caching to avoid repeated API calls
    # CRITICAL: Generate URLs once here to populate cache, template will use cached values
    resource_urls = {}
    resource_group_ids = {}  # Store group IDs for grouped images
    for resource in page_obj:
        if resource.file and resource.file.name:
            try:
                # Generate URL once - this will cache it for 1 hour
                # Template accesses will use cache, not make new API calls
                logger.info(f"Generating URL for resource {resource.id}, file: {resource.file.name}")
                url = resource.file.url
                if url:
                    resource_urls[resource.id] = url
                    logger.info(f"Successfully generated URL for resource {resource.id}: {url[:80]}...")
                else:
                    logger.warning(f"Empty URL returned for resource {resource.id}, file: {resource.file.name}")
                    resource_urls[resource.id] = ''
            except Exception as e:
                # If URL generation fails, log the error
                logger.error(f"Error generating URL for resource {resource.id}, file: {resource.file.name}: {e}", exc_info=True)
                resource_urls[resource.id] = ''
        else:
            logger.debug(f"Resource {resource.id} has no file")
            resource_urls[resource.id] = ''
        
        # Extract group ID if this is a grouped image
        if (resource.resource_type == 'image' and 
            resource.description and 
            '[GROUP_ID:' in resource.description):
            try:
                group_id = resource.description.split('[GROUP_ID:')[1].split(']')[0]
                resource_group_ids[resource.id] = group_id
            except Exception:
                pass
    
    # Get total count
    total_count = paginator.count
    
    # Get all communities for the dropdown
    from communityowner_panel.models import CommunityProfile
    communities = CommunityProfile.objects.all().order_by('community_name')
    
    context = {
        'resources': page_obj,  # Use page_obj for template compatibility
        'page_obj': page_obj,
        'paginator': paginator,
        'total_count': total_count,
        'communities': communities,
        'resource_urls': resource_urls,  # Pre-generated URLs to avoid multiple API calls
        'resource_group_ids': resource_group_ids,  # Group IDs for grouped images
        'search_query': search_query,
        'filter_type': filter_type,
        'filter_community': filter_community,
    }
    
    # Check if this is an AJAX request
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        # Return only the resources container HTML for AJAX requests
        resources_html = render_to_string('admin_resources/resources_partial.html', context, request=request)
        return HttpResponse(resources_html)
    
    return render(request, 'admin_resources/admin_resources.html', context)

@login_required
@require_POST
def delete_resource(request, resource_id):
    """Delete a resource"""
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Permission denied'}, status=403)

    try:
        resource = get_object_or_404(Resource, id=resource_id)
        resource.is_active = False
        resource.save()
        return JsonResponse({'status': 'success', 'message': 'Resource deleted successfully'})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

@login_required
@require_POST
def delete_resource_by_title(request, title):
    """Delete a resource by title"""
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Permission denied'}, status=403)

    try:
        from urllib.parse import unquote
        # Decode URL-encoded title
        decoded_title = unquote(title)
        
        resource = get_object_or_404(Resource, title=decoded_title, is_active=True)
        resource.is_active = False
        resource.save()

        return JsonResponse({
            'status': 'success',
            'message': 'Resource deleted successfully!'
        })

    except Resource.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Resource not found'}, status=404)
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

@login_required
def edit_resource(request, resource_id):
    """Edit a resource - GET request shows edit form, POST updates resource"""
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Permission denied'}, status=403)

    try:
        resource = get_object_or_404(Resource, id=resource_id, is_active=True)
        
        if request.method == 'POST':
            try:
                title = request.POST.get('title', '').strip()
                description = request.POST.get('description', '').strip()
                resource_type = request.POST.get('resource_type', '')
                content = request.POST.get('content', '').strip()
                
                # Get multiple external URLs
                external_urls = request.POST.getlist('external_urls[]')
                external_url = external_urls[0] if external_urls else ''

                if not title:
                    return JsonResponse({'status': 'error', 'message': 'Title is required.'}, status=400)

                if resource_type not in ['image', 'video', 'link', 'document']:
                    return JsonResponse({'status': 'error', 'message': 'Invalid resource type.'}, status=400)
                
                # Get community selection (optional)
                community_id = request.POST.get('community', '').strip()
                community = None
                if community_id:
                    try:
                        from communityowner_panel.models import CommunityProfile
                        community = CommunityProfile.objects.get(id=int(community_id))
                    except (ValueError, CommunityProfile.DoesNotExist):
                        community = None
                
                # Validate external URLs for link type
                if resource_type == 'link':
                    if not external_urls or not external_urls[0]:
                        return JsonResponse({'status': 'error', 'message': 'At least one external URL is required for links.'}, status=400)
                    
                    # Basic URL validation
                    for url in external_urls:
                        if url and not url.startswith(('http://', 'https://')):
                            return JsonResponse({'status': 'error', 'message': f'Please enter a valid URL: {url}'}, status=400)

                # Update resource fields
                resource.title = title
                resource.resource_type = resource_type
                resource.community = community
                
                # Handle multiple URLs for links
                if resource_type == 'link':
                    # Store all URLs as JSON in external_url field
                    import json
                    all_urls = [url for url in external_urls if url]
                    if len(all_urls) > 1:
                        # Store as JSON array
                        resource.external_url = json.dumps(all_urls)
                    else:
                        # Store single URL as string
                        resource.external_url = all_urls[0] if all_urls else ''
                    resource.description = description
                else:
                    resource.external_url = None
                    resource.description = description

                # Handle file upload for images, videos, and documents (PDFs, TXT, CSV, Excel)
                if resource_type in ['image', 'video', 'document'] and 'file' in request.FILES:
                    files = request.FILES.getlist('file')

                    # If editing an image resource, ensure new images are grouped with the existing one
                    if resource_type == 'image':
                        import uuid
                        # Extract existing group id from description if present
                        existing_group_id = None
                        if resource.description and '[GROUP_ID:' in resource.description:
                            try:
                                existing_group_id = resource.description.split('[GROUP_ID:')[1].split(']')[0]
                            except Exception:
                                existing_group_id = None

                        # If no group id, create one and attach it to the current resource
                        if not existing_group_id:
                            existing_group_id = str(uuid.uuid4())
                            resource.description = f"{description}\n[GROUP_ID:{existing_group_id}]" if description else f"[GROUP_ID:{existing_group_id}]"
                            resource.save()

                        # Count existing images in the group to continue numbering
                        existing_group_images = Resource.objects.filter(
                            is_active=True,
                            resource_type='image',
                            description__contains=f"[GROUP_ID:{existing_group_id}]"
                        ).count()

                        # Create individual resources for each newly uploaded image in the same group
                        for idx, uploaded_file in enumerate(files, start=1):
                            image_index = existing_group_images + idx
                            image_resource = Resource.objects.create(
                                title=f"{title} (Image {image_index})",
                                description=f"{description}\n[GROUP_ID:{existing_group_id}]" if description else f"[GROUP_ID:{existing_group_id}]",
                                resource_type='image',
                                file=uploaded_file,
                                created_by=request.user
                            )
                            image_resource.save()
                    else:
                        # For single files (video or document), replace the existing file
                        # Only take the first file if multiple are uploaded
                        if files:
                            # Delete old file from Dropbox if it exists
                            if resource.file and resource.file.name:
                                try:
                                    resource.file.delete(save=False)
                                except Exception:
                                    pass  # Continue even if deletion fails
                            
                            # Replace with new file
                            resource.file = files[0]
                            resource.save()

                resource.save()

                return JsonResponse({
                    'status': 'success', 
                    'message': f'Resource "{title}" updated successfully!',
                    'redirect_url': reverse('admin_panel:admin_resources')
                })

            except Exception as e:
                return JsonResponse({'status': 'error', 'message': f'Error updating resource: {str(e)}'}, status=400)

        # GET request - return resource data for editing
        return JsonResponse({
            'status': 'success',
            'resource': {
                'id': resource.id,
                'title': resource.title,
                'description': resource.description,
                'resource_type': resource.resource_type,
                'external_url': resource.external_url,
                'file_url': resource.file.url if resource.file else None,
            }
        })

    except Resource.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Resource not found'}, status=404)
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

@login_required
def get_group_count(request, base_title):
    """Get the count of images in a group"""
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'error': 'Permission denied'}, status=403)
    
    try:
        from urllib.parse import unquote
        # Decode URL-encoded title
        base_title = unquote(base_title)
        
        # First try to find by GROUP_ID if the base_title contains it
        group_id = None
        if '[GROUP_ID:' in base_title:
            try:
                group_id = base_title.split('[GROUP_ID:')[1].split(']')[0]
            except:
                pass
        
        if group_id:
            # Find all images with the same GROUP_ID
            images = Resource.objects.filter(
                resource_type='image',
                description__contains=f'[GROUP_ID:{group_id}]',
                is_active=True
            ).order_by('created_at')
        else:
            # Fallback to old method - find all images with the same base title pattern
            images = Resource.objects.filter(
                resource_type='image',
                title__startswith=base_title,
                title__contains='(Image',
                is_active=True
            ).order_by('title')
        
        image_data = []
        for img in images:
            # Extract image number from title
            match = re.match(r'^.*\(Image\s+(\d+)\)$', img.title)
            if match:
                index = int(match.group(1)) - 1
            else:
                # If no match, use the order in the queryset
                index = len(image_data)
            
            image_data.append({
                'url': img.file.url if img.file else '',
                'title': img.title,
                'index': index
            })
        
        return JsonResponse({
            'count': len(image_data),
            'images': image_data
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@login_required
def download_resource(request, resource_id):
    """Download a resource file with custom filename (title + date)"""
    # Check if user has admin role or is a superuser
    if request.user.role != 'admin' and not request.user.is_superuser:
        return HttpResponseForbidden("You don't have permission to access this page.")
    
    resource = get_object_or_404(Resource, id=resource_id, is_active=True)
    
    if not resource.file:
        return HttpResponse("File not found", status=404)
    
    try:
        # Open the file from Dropbox storage
        file_obj = resource.file.open('rb')
        
        # Get original file extension
        original_filename = resource.file.name
        file_ext = os.path.splitext(original_filename)[1] or ''
        
        # Clean title for filename (remove special characters, replace spaces with underscores)
        clean_title = re.sub(r'[^\w\s-]', '', resource.title)
        clean_title = re.sub(r'[-\s]+', '_', clean_title)
        clean_title = clean_title.strip('_')
        
        # Format date as YYYY-MM-DD
        date_str = resource.created_at.strftime('%Y-%m-%d')
        
        # Create custom filename: title_date.extension
        custom_filename = f"{clean_title}_{date_str}{file_ext}"
        
        # Create response with file
        response = FileResponse(file_obj, content_type='application/octet-stream')
        response['Content-Disposition'] = f'attachment; filename="{custom_filename}"; filename*=UTF-8\'\'{quote(custom_filename)}'
        
        return response
    except Exception as e:
        logger.error(f"Error downloading resource {resource_id}: {e}", exc_info=True)
        return HttpResponse(f"Error downloading file: {str(e)}", status=500)
