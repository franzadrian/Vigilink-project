from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden
from django.views.decorators.csrf import csrf_exempt
from django.contrib import messages
from django.db import transaction
from .models import CommunityProfile, CommunityMembership
from django.middleware.csrf import get_token
from django.http import JsonResponse
from django.db.models import Q


@login_required
def community_owner_dashboard(request):
    # Only allow users with the 'Community Owner' role
    if not getattr(request.user, 'role', None) == 'communityowner':
        return HttpResponseForbidden('You are not authorized to view this page.')

    profile = None
    try:
        profile = CommunityProfile.objects.filter(owner=request.user).first()
    except Exception:
        profile = None

    if request.method == 'POST':
        is_ajax = request.headers.get('x-requested-with') == 'XMLHttpRequest'
        name = (request.POST.get('community_name') or '').strip()
        address = (request.POST.get('community_address') or '').strip()
        if not name or not address:
            if is_ajax:
                return JsonResponse({'ok': False, 'error': 'Community name and address are required.'}, status=400)
            messages.error(request, 'Community name and address are required.')
        else:
            # Validate unique community name (case-insensitive) excluding self
            exists = CommunityProfile.objects.filter(community_name__iexact=name).exclude(owner=request.user).exists()
            if exists:
                if is_ajax:
                    return JsonResponse({'ok': False, 'error': 'This community name is already taken. Please choose another.'}, status=409)
                messages.error(request, 'This community name is already taken. Please choose another.')
            else:
                with transaction.atomic():
                    if not profile:
                        profile = CommunityProfile.objects.create(owner=request.user)
                    profile.community_name = name
                    profile.community_address = address
                    if not profile.secret_code:
                        # generate unique code
                        code = CommunityProfile.generate_secret_code()
                        # ensure uniqueness
                        while CommunityProfile.objects.filter(secret_code=code).exists():
                            code = CommunityProfile.generate_secret_code()
                        profile.secret_code = code
                    profile.save()
                    if is_ajax:
                        return JsonResponse({
                            'ok': True,
                            'profile': {
                                'community_name': profile.community_name,
                                'community_address': profile.community_address,
                                'secret_code': profile.secret_code,
                            }
                        })
                    messages.success(request, 'Community profile saved.')

    needs_onboarding = not (profile and profile.community_name and profile.community_address)

    # Build members data for this community owner
    members_qs = []
    if profile:
        try:
            members_qs = CommunityMembership.objects.select_related('user').filter(community=profile)
        except Exception:
            members_qs = []

    def _initials(name: str) -> str:
        parts = (name or '').strip().split()
        if not parts:
            return ''
        if len(parts) == 1:
            return parts[0][:2].upper()
        return (parts[0][:1] + parts[-1][:1]).upper()

    members_data = []
    for m in members_qs:
        u = m.user
        display_name = (getattr(u, 'full_name', '') or u.username).strip()
        members_data.append({
            'id': u.id,
            'name': display_name,
            'email': getattr(u, 'email', ''),
            'role': 'Resident',
            'initials': _initials(display_name) or (u.username[:2] if u.username else '').upper(),
        })

    context = {
        'profile': profile,
        'needs_onboarding': needs_onboarding,
        'csrf_token': get_token(request),
        'members': members_data,
    }
    return render(request, 'communityowner/community_owner.html', context)


@login_required
def check_community_name(request):
    """AJAX endpoint to check if a community name is available (case-insensitive)."""
    if request.method != 'GET':
        return JsonResponse({'available': False, 'error': 'Method not allowed'}, status=405)
    name = (request.GET.get('name') or '').strip()
    if not name:
        return JsonResponse({'available': False, 'error': 'Name required'}, status=400)
    qs = CommunityProfile.objects.filter(community_name__iexact=name)
    # Exclude the current user's own community (if editing)
    try:
        qs = qs.exclude(owner=request.user)
    except Exception:
        pass
    available = not qs.exists()
    return JsonResponse({'available': available})
