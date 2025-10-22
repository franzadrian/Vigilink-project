from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden
from django.contrib import messages
from django.views.decorators.http import require_http_methods
from communityowner_panel.models import CommunityProfile, CommunityMembership, EmergencyContact
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

    community = None
    if is_owner:
        community = CommunityProfile.objects.filter(owner=request.user).first()
        if not community:
            return render(request, 'resident/not_member.html', {'reason': 'no_community'}, status=404)
    else:
        mem = CommunityMembership.objects.select_related('community').filter(user=request.user).first()
        if not mem or not mem.community:
            return render(request, 'resident/not_member.html', {'reason': 'no_membership'}, status=403)
        community = mem.community

    # Build members list for this community (all roles)
    User = get_user_model()
    members_qs = (
        CommunityMembership.objects
        .select_related('user')
        .filter(community=community)
        .order_by(Lower('user__full_name'), 'user__username')
    )
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
        })

    context = {
        'residents': residents_data,
        'community': community,
        'is_owner': is_owner,
        'is_resident': is_resident,
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

    # If user is a guest, promote to resident
    try:
        if getattr(request.user, 'role', 'guest') == 'guest':
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
    if community:
        try:
            members_count = CommunityMembership.objects.filter(community=community).count()
        except Exception:
            members_count = 0

    try:
        # Count all reports submitted via the resident report flow
        base_incidents_qs = ContactMessage.objects.filter(subject__istartswith='Report:')
        incidents_count = base_incidents_qs.count()
        recent_incidents_qs = base_incidents_qs.order_by('-created_at')[:10]
    except Exception:
        recent_incidents_qs = []
        incidents_count = 0

    recent_incidents = []
    for m in recent_incidents_qs:
        recent_incidents.append({
            'id': getattr(m, 'contact_id', None),
            'subject': m.subject,
            'message': m.message,
            'created_at': getattr(m, 'created_at', None),
        })

    upcoming_events = [
        { 'title': 'Community Patrol Meeting', 'date': 'Next Tue 6:00 PM', 'place': 'Clubhouse' },
        { 'title': 'Fire Safety Drill', 'date': 'Next Sat 9:00 AM', 'place': 'Block A Park' },
    ]

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

    # Emergency contacts (from owner-managed list)
    emergency_contacts = []
    try:
        if community:
            for c in EmergencyContact.objects.filter(community=community).order_by('order', 'id'):
                emergency_contacts.append({'label': c.label, 'phone': c.phone})
    except Exception:
        emergency_contacts = []

    context = {
        'members_count': members_count,
        'incidents_count': incidents_count,
        'recent_incidents': recent_incidents,
        'upcoming_events': upcoming_events,
        'events_count': len(upcoming_events),
        'safety_tip': safety_tip,
        'emergency_contacts': emergency_contacts,
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

        reported_name = ''
        # If target is resident, ensure they belong to the same community (if possible)
        if target_type == 'resident' and target_user_id and community:
            try:
                target_mem = CommunityMembership.objects.select_related('user').get(community=community, user_id=target_user_id)
                u = target_mem.user
                reported_name = (getattr(u, 'full_name', '') or getattr(u, 'username', '') or '').strip()
            except CommunityMembership.DoesNotExist:
                # If not found, still record using ID fallback
                reported_name = f"User #{target_user_id}"
        elif target_type == 'resident' and target_user_id:
            reported_name = f"User #{target_user_id}"

        # Compose subject and message
        if target_type == 'resident':
            subject = f"Report: Resident {reported_name or ('#' + str(target_user_id))}"
            target_line = f"Target: Resident {reported_name or ('#' + str(target_user_id))}"
        else:
            subject = "Report: Non-resident / Unknown person"
            target_line = f"Target: Non-resident / Unknown person{(' — ' + outsider_desc) if outsider_desc else ''}"

        reasons_line = f"Reasons: {', '.join(reasons_list)}" if reasons_list else "Reasons: (not specified)"
        details_line = f"Details: {details}" if details else "Details: (none)"

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

        message = "\n".join([
            target_line,
            reasons_line,
            details_line,
            f"Submitted by: {reporter_name} ({'hidden' if anonymous else reporter_email})",
        ])

        ContactMessage.objects.create(
            user=user_ref,
            name=reporter_name,
            email=reporter_email,
            subject=subject,
            message=message,
        )

        return JsonResponse({'ok': True, 'message': 'Report submitted. Thank you.'})
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=400)
