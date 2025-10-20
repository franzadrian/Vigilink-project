from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden
from django.contrib import messages
from django.views.decorators.http import require_http_methods
from communityowner_panel.models import CommunityProfile, CommunityMembership


@login_required
def residents(request):
    # Block guests (not part of any community)
    if getattr(request.user, 'role', '') == 'guest':
        return render(
            request,
            'resident/not_member.html',
            {
                'reason': 'guest',
            },
            status=403,
        )
    return render(request, 'resident/resident.html')

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
            request.user.save(update_fields=['role'])
    except Exception:
        pass

    messages.success(request, f'Joined community: {community.community_name or "Unnamed Community"}.')
    return redirect('resident_panel:residents')
