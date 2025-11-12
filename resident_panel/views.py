from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden
from django.contrib import messages
from django.views.decorators.http import require_http_methods
from communityowner_panel.models import CommunityProfile, CommunityMembership, EmergencyContact
from accounts.models import LocationEmergencyContact
from security_panel.models import SecurityReport
from django.contrib.auth import get_user_model
from django.middleware.csrf import get_token
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from admin_panel.models import ContactMessage
import json
from django.db.models.functions import Lower


@login_required
def residents(request):
    role = getattr(request.user, 'role', '')
    
    is_owner = role == 'communityowner'
    is_resident = role == 'resident'
    is_security = role == 'security'

    # Check subscription access
    from settings_panel.utils import has_community_access
    has_access, reason = has_community_access(request.user)
    if not has_access and (is_owner or is_resident):
        messages.error(request, reason)
        if is_owner:
            return redirect('settings_panel:settings')
        else:
            return render(request, 'resident/not_member.html', {
                'reason': 'subscription_expired',
                'message': reason,
                'page_type': 'residents'
            })

    community = None
    if is_owner:
        community = CommunityProfile.objects.filter(owner=request.user).first()
        if not community:
            return render(request, 'resident/not_member.html', {'reason': 'no_community', 'page_type': 'residents'}, status=404)
    else:
        mem = CommunityMembership.objects.select_related('community').filter(user=request.user).first()
        if not mem or not mem.community:
            # Get location-based emergency contacts for guest users
            location_contacts = []
            try:
                if request.user.city or request.user.district:
                    # Get district-specific contacts first (more specific)
                    if request.user.district:
                        district_contacts = LocationEmergencyContact.objects.filter(
                            district=request.user.district,
                            is_active=True
                        ).order_by('order', 'id')
                        for c in district_contacts:
                            location_contacts.append({
                                'label': c.label, 
                                'phone': c.phone
                            })
                    
                    # If no district contacts, get city-specific contacts
                    if not location_contacts and request.user.city:
                        city_contacts = LocationEmergencyContact.objects.filter(
                            city=request.user.city,
                            is_active=True
                        ).order_by('order', 'id')
                        for c in city_contacts:
                            location_contacts.append({
                                'label': c.label, 
                                'phone': c.phone
                            })
            except Exception:
                location_contacts = []
            
            return render(request, 'resident/not_member.html', {
                'reason': 'no_membership',
                'location_contacts': location_contacts,
                'page_type': 'residents'
            }, status=403)
        community = mem.community

    # Build members list for this community
    User = get_user_model()
    members_qs = (
        CommunityMembership.objects
        .select_related('user')
        .filter(community=community)
        .order_by(Lower('user__full_name'), 'user__username')
    )
    
    # Filter based on user role
    if is_owner:
        # Community owners can see ALL members (including security)
        pass
    else:
        # Non-owners (residents, security) exclude security users
        members_qs = members_qs.exclude(user__role='security')
    
    # Residents should not see themselves in the list
    if is_resident:
        members_qs = members_qs.exclude(user=request.user)

    def _initials(name: str) -> str:
        parts = (name or '').strip().split()
        if not parts:
            return ''
        if len(parts) == 1:
            return parts[0][:2].upper()
        return (parts[0][:1] + parts[-1][:1]).upper()

    residents_data = []
    for m in members_qs:
        u = m.user
        display_name = (getattr(u, 'full_name', '') or u.username).strip()
        initials = _initials(display_name) or (u.username[:2] if u.username else '').upper()
        avatar = ''
        try:
            if hasattr(u, 'get_profile_picture_url'):
                avatar = u.get_profile_picture_url() or ''
            elif getattr(u, 'profile_picture_url', ''):
                avatar = u.profile_picture_url
            elif getattr(u, 'profile_picture', None):
                avatar = u.profile_picture.url
        except Exception:
            avatar = ''
        residents_data.append({
            'id': u.id,
            'name': display_name,
            'initials': initials,
            'email': getattr(u, 'email', ''),
            'block': getattr(u, 'block', ''),
            'lot': getattr(u, 'lot', ''),
            'avatar': avatar,
            'role': getattr(u, 'role', ''),
        })

    context = {
        'residents': residents_data,
        'community': community,
        'is_owner': is_owner,
        'is_resident': is_resident,
        'is_security': is_security,
        'csrf_token': get_token(request),
        'toast': request.session.pop('res_toast', ''),
    }
    return render(request, 'resident/resident.html', context)

# Create your views here.


@login_required
@require_http_methods(["POST"])
def join_by_code(request):
    code = (request.POST.get('community_code') or '').strip()
    # Check where user came from to redirect appropriately
    next_url = request.POST.get('next') or request.GET.get('next') or 'resident_panel:residents'
    
    if not code:
        messages.error(request, 'Please enter a valid community code.')
        # Try to redirect back to the page they came from
        if next_url == 'dashboard' or 'dashboard' in next_url:
            return redirect('user_panel:dashboard')
        return redirect('resident_panel:residents')

    # Case-insensitive match on the stored code
    community = CommunityProfile.objects.filter(secret_code__iexact=code).first()
    if not community:
        messages.error(request, 'Invalid code. Please check with your Community Owner and try again.')
        # Try to redirect back to the page they came from
        if next_url == 'dashboard' or 'dashboard' in next_url:
            return redirect('user_panel:dashboard')
        return redirect('resident_panel:residents')

    # Create/update membership for this user (one community per user)
    CommunityMembership.objects.update_or_create(
        user=request.user,
        defaults={'community': community},
    )

    # If user is a guest or has no role, promote to resident
    try:
        user_role = getattr(request.user, 'role', '') or ''
        if user_role.lower() in ('', 'guest'):
            request.user.role = 'resident'
            # Also ensure address is stamped below
            request.user.save(update_fields=['role'])
    except Exception:
        pass

    # Stamp user's address from community address
    try:
        if getattr(request.user, 'address', None) != community.community_address:
            request.user.address = community.community_address
            request.user.save(update_fields=['address'])
    except Exception:
        pass

    try:
        request.session['res_toast'] = f"Joined community: {community.community_name or 'Unnamed Community'}."
    except Exception:
        pass
    
    # Redirect to dashboard if that's where they came from, otherwise to residents
    if next_url == 'dashboard' or 'dashboard' in next_url:
        messages.success(request, f'Successfully joined {community.community_name or "the community"}!')
        return redirect('user_panel:dashboard')
    return redirect('resident_panel:residents')

def determine_priority_from_reasons(reasons_list):
    """
    Automatically determine report priority based on selected reasons.
    Returns the highest priority level if multiple reasons are selected.
    
    Priority levels:
    - Level 1: Minor disturbances, observations
    - Level 2: Suspicious but non-threatening behavior
    - Level 3: Property damage, harassment, violations, criminal activity, serious threats
    """
    if not reasons_list:
        return 'level_2'  # Default if no reasons
    
    # Normalize reasons to lowercase for comparison
    reasons_lower = [reason.lower().strip() for reason in reasons_list]
    
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
    for reason in reasons_lower:
        for keyword in level3_keywords:
            if keyword in reason:
                return 'level_3'
    
    # Check for level 2 reasons (suspicious)
    for reason in reasons_lower:
        for keyword in level2_keywords:
            if keyword in reason:
                return 'level_2'
    
    # Check for level 1 reasons (minor)
    for reason in reasons_lower:
        for keyword in level1_keywords:
            if keyword in reason:
                return 'level_1'
    
    # Default to level 2 if no matches
    return 'level_2'

@login_required
def alerts(request):
    """Resident Alerts page: emergency calls, stats, recent incidents, events, safety tip."""
    community = None
    members_count = 0
    mem = CommunityMembership.objects.select_related('community').filter(user=request.user).first()
    if mem and mem.community:
        community = mem.community
    else:
        # If user is a community owner, use their community profile
        try:
            if getattr(request.user, 'role', '') == 'communityowner':
                owner_cp = CommunityProfile.objects.filter(owner=request.user).first()
                if owner_cp:
                    community = owner_cp
        except Exception:
            pass
    
    # Check if user is part of a community - redirect guests without community access
    if not community:
        return render(request, 'resident/not_member.html', {'reason': 'no_membership', 'page_type': 'alerts'}, status=403)
    if community:
        try:
            members_count = CommunityMembership.objects.filter(community=community).count()
        except Exception:
            members_count = 0

    try:
        # Get public incidents for this community
        from security_panel.models import Incident
        from django.utils import timezone
        from datetime import timedelta
        base_incidents_qs = Incident.objects.filter(community=community)
        incidents_count = base_incidents_qs.count()
        
        # Get latest 2 incidents
        latest_2 = list(base_incidents_qs.order_by('-created_at')[:2])
        
        if latest_2:
            # Get the date of the most recent incident
            most_recent_date = latest_2[0].created_at.date()
            today = timezone.now().date()
            
            # If the most recent incident is from today, show up to 5 incidents from today
            if most_recent_date == today:
                same_day_incidents = base_incidents_qs.filter(
                    created_at__date=today
                ).order_by('-created_at')[:5]
                recent_incidents_qs = same_day_incidents
            else:
                # If the most recent incident is from a previous day, show only latest 2
                recent_incidents_qs = latest_2
        else:
            recent_incidents_qs = []
    except Exception:
        recent_incidents_qs = []
        incidents_count = 0

    recent_incidents = []
    for incident in recent_incidents_qs:
        import re
        
        # Get location from incident model
        location = incident.location if hasattr(incident, 'location') and incident.location else ''
        
        # Clean up the description by removing reporter information
        details = incident.description
        
        # Remove reporter patterns
        details = re.sub(r'Reported by[^:]*:', '', details, flags=re.IGNORECASE)
        details = re.sub(r'by Guest \d+', '', details)
        details = re.sub(r'^Report:\s*', '', details, flags=re.IGNORECASE)
        details = details.strip()
        
        # Extract location from message if it's embedded
        if 'Location:' in details:
            parts = details.split('Location:')
            if len(parts) > 1:
                details = parts[0].strip()
                location_from_msg = parts[1].strip()
                if location_from_msg and not location:
                    location = location_from_msg
        
        # Clean up any remaining "Location:" text
        details = re.sub(r'Location:\s*', '', details, flags=re.IGNORECASE)
        details = details.strip()
        
        recent_incidents.append({
            'id': incident.id,
            'subject': incident.title,
            'details': details,
            'location': location,
            'created_at': incident.created_at,
            'incident_type': incident.get_incident_type_display_short(),
            'status': incident.get_status_display(),
        })

    # Get upcoming events for this community
    upcoming_event = None
    events_count = 0
    try:
        from events_panel.models import Event
        from django.utils import timezone
        from datetime import timedelta
        
        # Get only upcoming events (not ongoing or past events)
        now = timezone.now()
        
        # Get the next upcoming event (start_date must be after now)
        # This matches the logic used in events.html where upcoming = start_date__gt=now
        # Events that haven't started yet are considered "upcoming"
        upcoming_event_qs = Event.objects.filter(
            community=community,
            is_active=True,
            start_date__gt=now  # Events that haven't started yet
        ).order_by('start_date')[:1]  # Get only the closest upcoming event
        
        events_count = Event.objects.filter(
            community=community,
            is_active=True
        ).count()
        
        if upcoming_event_qs.exists():
            event = upcoming_event_qs[0]
            upcoming_event = {
                'id': event.id,
                'title': event.title,
                'date': event.start_date.strftime('%b %d, %Y'),
                'time': event.start_date.strftime('%I:%M %p'),
                'place': event.location if event.location else 'TBA',
                'event_type': event.get_event_type_display(),
                'description': event.description[:100] + '...' if len(event.description) > 100 else event.description,
            }
    except Exception as e:
        upcoming_event = None
        events_count = 0

    from datetime import datetime
    tips = [
        'Remember to lock doors and windows before leaving.',
        'Do not share your gate codes with unknown persons.',
        'Report suspicious behavior immediately via Report Incident.',
        'Keep porch lights on at night for visibility.',
        'Secure packages or request deliveries when you are home.',
        'Do not let strangers tailgate into the subdivision.',
        'Store valuables out of sight in vehicles.',
        'Know your neighbors and exchange contact info.',
        'Test your smoke alarms monthly.',
        'Keep emergency numbers saved in your phone.',
        'Always verify identity of service personnel.',
        'Trim hedges to improve line of sight near entrances.',
        'Use strong, unique passwords for home Wi-Fi.',
        'Teach family members how to dial emergency services.',
        'Keep a small first-aid kit handy at home and in car.',
        'Mark your house number clearly for responders.',
    ]
    # Ensure the displayed tip is at least two sentences by combining two entries.
    day_index = datetime.utcnow().timetuple().tm_yday % len(tips)
    second_index = (day_index + 7) % len(tips)
    safety_tip = f"{tips[day_index]} {tips[second_index]}"

    # Emergency contacts (from owner-managed list and location-based)
    emergency_contacts = []
    community_contacts = []
    location_contacts = []
    
    try:
        # Get community-specific emergency contacts
        if community:
            for c in EmergencyContact.objects.filter(community=community).order_by('order', 'id'):
                community_contacts.append({
                    'label': c.label, 
                    'phone': c.phone, 
                    'source': 'community',
                    'id': c.id
                })
        
        # Get location-based contacts
        if request.user.city or request.user.district:
            # Get district-specific contacts first (more specific)
            if request.user.district:
                district_contacts = LocationEmergencyContact.objects.filter(
                    district=request.user.district,
                    is_active=True
                ).order_by('order', 'id')
                for c in district_contacts:
                    location_contacts.append({
                        'label': c.label, 
                        'phone': c.phone, 
                        'source': 'location',
                        'location_type': 'district',
                        'location_name': request.user.district.name
                    })
            
            # If no district contacts, get city-specific contacts
            if not location_contacts and request.user.city:
                city_contacts = LocationEmergencyContact.objects.filter(
                    city=request.user.city,
                    is_active=True
                ).order_by('order', 'id')
                for c in city_contacts:
                    location_contacts.append({
                        'label': c.label, 
                        'phone': c.phone, 
                        'source': 'location',
                        'location_type': 'city',
                        'location_name': request.user.city.name
                    })
        
        # Determine which contacts to show based on priority
        # Community contacts override location contacts
        if community_contacts:
            emergency_contacts = community_contacts
        else:
            emergency_contacts = location_contacts
            
    except Exception:
        emergency_contacts = []
        community_contacts = []
        location_contacts = []

    context = {
        'members_count': members_count,
        'incidents_count': incidents_count,
        'recent_incidents': recent_incidents,
        'upcoming_event': upcoming_event,
        'events_count': events_count,
        'safety_tip': safety_tip,
        'emergency_contacts': emergency_contacts,
        'community_contacts': community_contacts,
        'location_contacts': location_contacts,
        'has_community_contacts': len(community_contacts) > 0,
        'has_location_contacts': len(location_contacts) > 0,
    }
    return render(request, 'alerts/alerts.html', context)
def submit_report(request):
    """Accept a report from a resident about a resident or non-resident.
    Stores the report as a ContactMessage so admins/community owners can review.
    """
    try:
        # Prefer form-encoded; fall back to JSON body
        data = request.POST
        if not data or not data.items():
            try:
                payload = json.loads(request.body.decode('utf-8') or '{}')
            except Exception:
                payload = {}
        else:
            payload = {k: v for k, v in data.items()}

        target_type = (payload.get('target_type') or 'resident').strip()
        target_user_id = (payload.get('target_user_id') or '').strip()
        details = (payload.get('details') or '').strip()
        location = (payload.get('location') or '').strip()
        anonymous = str(payload.get('anonymous') or '').lower() in ('1', 'true', 'yes', 'on')
        reasons_raw = payload.get('reasons') or ''
        # reasons may come as JSON array or comma-separated
        reasons_list = []
        if reasons_raw:
            try:
                parsed = json.loads(reasons_raw)
                if isinstance(parsed, list):
                    reasons_list = [str(x) for x in parsed if x]
            except Exception:
                reasons_list = [r.strip() for r in reasons_raw.split(',') if r.strip()]

        # Resolve community for basic validation
        community = None
        mem = CommunityMembership.objects.select_related('community').filter(user=request.user).first()
        if mem and mem.community:
            community = mem.community
        
        # Ensure user is part of a community to submit reports
        if not community:
            return JsonResponse({'ok': False, 'error': 'You must be a member of a community to submit reports.'}, status=403)

        reported_name = ''
        target_user = None
        # If target is resident, ensure they belong to the same community (if possible)
        if target_type == 'resident' and target_user_id and community:
            try:
                target_mem = CommunityMembership.objects.select_related('user').get(community=community, user_id=target_user_id)
                target_user = target_mem.user
                reported_name = (getattr(target_user, 'full_name', '') or getattr(target_user, 'username', '') or '').strip()
            except CommunityMembership.DoesNotExist:
                # If not found, still record using ID fallback
                reported_name = f"User #{target_user_id}"
        elif target_type == 'resident' and target_user_id:
            reported_name = f"User #{target_user_id}"

        # Compose subject and message
        if target_type == 'resident':
            subject = f"Report: Resident {reported_name or ('#' + str(target_user_id))}"
        else:
            subject = "Report: Non-resident"

        # Only include details if there's actual content
        details_line = f"Details: {details}" if details and details.strip() else None

        # Reporter identity
        if anonymous:
            reporter_name = "Anonymous"
            user_ref = None
        else:
            nm = (getattr(request.user, 'full_name', '') or request.user.get_username() or '').strip() or 'Resident'
            reporter_name = nm
            user_ref = request.user

        # Build message with only non-empty lines
        message_lines = []
        if details_line:
            message_lines.append(details_line)
        
        message = "\n".join(message_lines) if message_lines else ""

        # Automatically determine priority based on selected reasons
        auto_priority = determine_priority_from_reasons(reasons_list)
        
        # Allow manual priority override if provided (for future use)
        manual_priority = payload.get('priority', '').strip().lower()
        if manual_priority and manual_priority in ['level_1', 'level_2', 'level_3']:
            priority = manual_priority
        else:
            priority = auto_priority

        # Create SecurityReport for private security access
        security_report = SecurityReport.objects.create(
            subject=subject,
            message=message,
            priority=priority,  # Auto-assigned based on reasons
            target_type=target_type,
            target_user=target_user if target_type == 'resident' and target_user else None,
            location=location,
            reporter=request.user,
            is_anonymous=anonymous,
            reporter_name=reporter_name,
            community=community,
            reasons=reasons_list,
            details=details,
        )

        # If this is a general incident report (outsider/unknown person), also create a public Incident
        if target_type == 'outsider' and community:
            from security_panel.models import Incident
            
            # Determine incident type based on reasons
            incident_type = 'suspicious_activity'  # default
            if any('theft' in reason.lower() for reason in reasons_list):
                incident_type = 'theft'
            elif any('vandalism' in reason.lower() for reason in reasons_list):
                incident_type = 'vandalism'
            elif any('disturbance' in reason.lower() for reason in reasons_list):
                incident_type = 'disturbance'
            elif any('breach' in reason.lower() for reason in reasons_list):
                incident_type = 'security_breach'
            
            # Create public incident
            Incident.objects.create(
                title=f"Suspicious Activity Reported",
                description=f"Reported by {reporter_name}: {details or 'Suspicious activity observed'}",
                incident_type=incident_type,
                status='reported',
                location=location or 'Community area',
                community=community,
                reporter=request.user,
                is_anonymous=anonymous,
                reporter_name=reporter_name,
                security_report=security_report,
            )

        return JsonResponse({'ok': True, 'message': 'Report submitted. Thank you.'})
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=400)

@login_required
def my_reports(request):
    """View for residents to see their previously submitted reports"""
    # Get user's community
    community = None
    mem = CommunityMembership.objects.select_related('community').filter(user=request.user).first()
    if mem and mem.community:
        community = mem.community
    else:
        # If user is a community owner, use their community profile
        try:
            if getattr(request.user, 'role', '') == 'communityowner':
                owner_cp = CommunityProfile.objects.filter(owner=request.user).first()
                if owner_cp:
                    community = owner_cp
        except Exception:
            pass
    
    if not community:
        messages.error(request, 'You must be a member of a community to view reports.')
        return redirect('resident_panel:residents')
    
    # Get all reports submitted by this user
    reports = SecurityReport.objects.filter(
        reporter=request.user,
        community=community
    ).order_by('-created_at')
    
    # Pagination
    from django.core.paginator import Paginator
    paginator = Paginator(reports, 10)
    page_number = request.GET.get('page', 1)
    page_obj = paginator.get_page(page_number)
    
    context = {
        'page_obj': page_obj,
        'community': community,
        'total_reports': reports.count(),
    }
    
    return render(request, 'resident/my_reports.html', context)
