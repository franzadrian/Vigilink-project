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

    community = None
    if is_owner:
        community = CommunityProfile.objects.filter(owner=request.user).first()
        if not community:
            return render(request, 'resident/not_member.html', {'reason': 'no_community'}, status=404)
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
                'location_contacts': location_contacts
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
    if not code:
        messages.error(request, 'Please enter a valid community code.')
        return redirect('resident_panel:residents')

    # Case-insensitive match on the stored code
    community = CommunityProfile.objects.filter(secret_code__iexact=code).first()
    if not community:
        messages.error(request, 'Invalid code. Please check with your Community Owner and try again.')
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
    return redirect('resident_panel:residents')

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
        return render(request, 'resident/not_member.html', {'reason': 'no_membership'}, status=403)
    if community:
        try:
            members_count = CommunityMembership.objects.filter(community=community).count()
        except Exception:
            members_count = 0

    try:
        # Get public incidents for this community
        from security_panel.models import Incident
        base_incidents_qs = Incident.objects.filter(community=community)
        incidents_count = base_incidents_qs.count()
        recent_incidents_qs = base_incidents_qs.order_by('-created_at')[:10]
    except Exception:
        recent_incidents_qs = []
        incidents_count = 0

    recent_incidents = []
    for incident in recent_incidents_qs:
        # Clean up the message by removing reporter names and formatting properly
        clean_message = incident.description
        
        # Remove reporter names and change to "Report:"
        if 'Reported by Guest' in clean_message:
            import re
            clean_message = re.sub(r'Reported by Guest \d+', 'Report:', clean_message)
        elif 'by Guest' in clean_message:
            import re
            clean_message = re.sub(r'by Guest \d+', '', clean_message)
            # If the message doesn't start with "Report:", add it
            if not clean_message.strip().startswith('Report:'):
                clean_message = 'Report: ' + clean_message.strip()
        
        # Fix double colons
        clean_message = clean_message.replace('::', ':')
        
        # Separate Location: from Report: if they're together
        if 'Report: Location:' in clean_message:
            clean_message = clean_message.replace('Report: Location:', 'Report:\nLocation:')
        elif 'Report:Location:' in clean_message:
            clean_message = clean_message.replace('Report:Location:', 'Report:\nLocation:')
        
        # Ensure Location: is always on a new line if it exists
        if 'Location:' in clean_message and not clean_message.startswith('Location:'):
            # Find where Location: appears and ensure it's on a new line
            location_index = clean_message.find('Location:')
            if location_index > 0:
                # Check if there's already a newline before Location:
                before_location = clean_message[:location_index].rstrip()
                after_location = clean_message[location_index:]
                
                # If Location: is not already on a new line, add one
                if not before_location.endswith('\n'):
                    clean_message = before_location + '\n' + after_location
        
        recent_incidents.append({
            'id': incident.id,
            'subject': incident.title,
            'message': clean_message,
            'created_at': incident.created_at,
            'incident_type': incident.get_incident_type_display_short(),
            'status': incident.get_status_display(),
        })

    # Get upcoming events for this community
    upcoming_events = []
    events_count = 0
    try:
        from events_panel.models import Event
        from django.utils import timezone
        
        # Get only ongoing or upcoming events (no completed/past events)
        now = timezone.now()
        
        # Get ongoing and upcoming events only
        upcoming_events_qs = Event.objects.filter(
            community=community,
            is_active=True,
            start_date__gte=now  # Only ongoing and upcoming events
        ).order_by('start_date')[:2]  # Get the 2 nearest upcoming events
        
        events_count = Event.objects.filter(
            community=community,
            is_active=True
        ).count()
        
        for event in upcoming_events_qs:
            # Determine event status
            now = timezone.now()
            if event.start_date > now:
                status = 'upcoming'
                status_text = 'Upcoming'
                status_icon = 'clock'
            elif event.start_date <= now:
                status = 'ongoing'
                status_text = 'Ongoing'
                status_icon = 'play-circle'
            else:
                status = 'completed'
                status_text = 'Completed'
                status_icon = 'check-circle'
            
            upcoming_events.append({
                'id': event.id,
                'title': event.title,
                'date': event.start_date.strftime('%b %d, %Y'),
                'time': event.start_date.strftime('%I:%M %p'),
                'place': event.location if event.location else 'TBA',
                'event_type': event.get_event_type_display(),
                'description': event.description[:100] + '...' if len(event.description) > 100 else event.description,
                'status': status,
                'status_text': status_text,
                'status_icon': status_icon
            })
    except Exception as e:
        upcoming_events = []
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
        'upcoming_events': upcoming_events,
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

        # Optional free-text for outsider description
        outsider_desc = (payload.get('outsider_desc') or '').strip()

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
            # No target_line for residents - they're identified in the "Who" field
            target_line = None
        else:
            subject = "Report: Non-resident"
            target_line = f"Target Details: {outsider_desc}" if outsider_desc else "Target Details: (no description provided)"

        # Only include details if there's actual content
        details_line = f"Details: {details}" if details and details.strip() else None

        # Reporter identity
        if anonymous:
            reporter_name = "Anonymous"
            reporter_email = "anonymous@vigilink.local"
            user_ref = None
        else:
            nm = (getattr(request.user, 'full_name', '') or request.user.get_username() or '').strip() or 'Resident'
            reporter_name = nm
            reporter_email = getattr(request.user, 'email', '') or 'unknown@vigilink.local'
            user_ref = request.user

        # Build message with only non-empty lines
        message_lines = []
        if target_line:
            message_lines.append(target_line)
        if details_line:
            message_lines.append(details_line)
        
        message = "\n".join(message_lines) if message_lines else ""

        # Create SecurityReport for private security access
        security_report = SecurityReport.objects.create(
            subject=subject,
            message=message,
            target_type=target_type,
            target_user=target_user if target_type == 'resident' and target_user else None,
            target_description=outsider_desc if target_type == 'outsider' else '',
            reporter=request.user,
            is_anonymous=anonymous,
            reporter_name=reporter_name,
            reporter_email=reporter_email,
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
                description=f"Reported by {reporter_name}: {details or 'Suspicious activity observed'}. Location: {outsider_desc or 'Community area'}",
                incident_type=incident_type,
                status='reported',
                location=outsider_desc or 'Community area',
                community=community,
                reporter=request.user,
                is_anonymous=anonymous,
                reporter_name=reporter_name,
                security_report=security_report,
            )

        return JsonResponse({'ok': True, 'message': 'Report submitted. Thank you.'})
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=400)
