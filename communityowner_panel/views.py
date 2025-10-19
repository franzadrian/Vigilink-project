from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden
from django.views.decorators.csrf import csrf_exempt
from django.contrib import messages
from django.db import transaction
from .models import CommunityProfile
from django.middleware.csrf import get_token


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
        name = (request.POST.get('community_name') or '').strip()
        address = (request.POST.get('community_address') or '').strip()
        if not name or not address:
            messages.error(request, 'Community name and address are required.')
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
                messages.success(request, 'Community profile saved.')

    needs_onboarding = not (profile and profile.community_name and profile.community_address)

    context = {
        'profile': profile,
        'needs_onboarding': needs_onboarding,
        'csrf_token': get_token(request),
    }
    return render(request, 'communityowner/community_owner.html', context)
