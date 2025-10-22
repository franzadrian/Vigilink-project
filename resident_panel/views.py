from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden
from django.contrib import messages
from django.views.decorators.http import require_http_methods
from communityowner_panel.models import CommunityProfile, CommunityMembership
from django.contrib.auth import get_user_model
from django.middleware.csrf import get_token
from django.http import JsonResponse
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
