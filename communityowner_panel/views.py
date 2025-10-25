from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden
from django.views.decorators.csrf import csrf_exempt
from django.contrib import messages
from django.db import transaction
from django.contrib.auth import get_user_model
from .models import CommunityProfile, CommunityMembership, EmergencyContact
from django.middleware.csrf import get_token
from django.http import JsonResponse
from django.db.models import Q
from django.views.decorators.http import require_GET, require_POST
from django.db.models.functions import Lower
from django.db.models.signals import post_delete
from django.dispatch import receiver


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
                    # Auto-apply address to owner and all current members
                    try:
                        # Update owner address
                        if getattr(request.user, 'address', None) != profile.community_address:
                            request.user.address = profile.community_address
                            request.user.save(update_fields=['address'])

                        # Update all members' addresses to match community address
                        User = get_user_model()
                        member_ids = CommunityMembership.objects.filter(community=profile).values_list('user_id', flat=True)
                        if member_ids:
                            User.objects.filter(id__in=list(member_ids)).update(address=profile.community_address)
                    except Exception:
                        # Non-fatal; continue even if bulk update fails
                        pass
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
            members_qs = (
                CommunityMembership.objects
                .select_related('user')
                .filter(community=profile)
                .order_by(Lower('user__full_name'), 'user__username')
            )
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
        
        # Get avatar/profile picture URL
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
        
        members_data.append({
            'id': u.id,
            'name': display_name,
            'email': getattr(u, 'email', ''),
            'role': getattr(u, 'role', '') or '',
            'role_display': dict(getattr(get_user_model(), 'ROLE_CHOICES', ())) .get(getattr(u, 'role', ''), getattr(u, 'role', '')),
            'block': getattr(u, 'block', ''),
            'lot': getattr(u, 'lot', ''),
            'initials': _initials(display_name) or (u.username[:2] if u.username else '').upper(),
            'avatar': avatar,
        })

    # Emergency contacts count to highlight empty state
    ec_count = 0
    try:
        if profile:
            ec_count = EmergencyContact.objects.filter(community=profile).count()
    except Exception:
        ec_count = 0

    context = {
        'profile': profile,
        'needs_onboarding': needs_onboarding,
        'csrf_token': get_token(request),
        'members': members_data,
        'ec_count': ec_count,
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


def _ensure_owner_and_profile(request):
    if not getattr(request.user, 'role', None) == 'communityowner':
        return None, HttpResponseForbidden('You are not authorized to view this page.')
    profile = CommunityProfile.objects.filter(owner=request.user).first()
    if not profile:
        return None, JsonResponse({'ok': False, 'error': 'No community profile found.'}, status=404)
    return profile, None


@login_required
@require_GET
def members_list(request):
    profile, err = _ensure_owner_and_profile(request)
    if err:
        return err
    members_qs = (
        CommunityMembership.objects
        .select_related('user')
        .filter(community=profile)
        .order_by(Lower('user__full_name'), 'user__username')
    )
    User = get_user_model()
    role_map = dict(getattr(User, 'ROLE_CHOICES', ()))
    data = []
    for m in members_qs:
        u = m.user
        name = (getattr(u, 'full_name', '') or u.username).strip()
        
        # Get avatar/profile picture URL
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
        
        data.append({
            'id': u.id,
            'name': name,
            'email': getattr(u, 'email', ''),
            'role': getattr(u, 'role', '') or '',
            'role_display': role_map.get(getattr(u, 'role', ''), getattr(u, 'role', '')),
            'block': getattr(u, 'block', ''),
            'lot': getattr(u, 'lot', ''),
            'avatar': avatar,
        })
    return JsonResponse({'ok': True, 'members': data})


@login_required
@require_POST
def member_update(request):
    profile, err = _ensure_owner_and_profile(request)
    if err:
        return err
    try:
        user_id = int(request.POST.get('user_id'))
    except (TypeError, ValueError):
        return JsonResponse({'ok': False, 'error': 'Invalid user id.'}, status=400)

    # Ensure the user is a member of this community
    mem = CommunityMembership.objects.select_related('user').filter(community=profile, user_id=user_id).first()
    if not mem:
        return JsonResponse({'ok': False, 'error': 'User is not a member of your community.'}, status=404)

    u = mem.user
    # Allowed role options (restrict from elevating to admin/owner)
    allowed_roles = {'resident', 'security'}
    role = request.POST.get('role')
    block = (request.POST.get('block') or '').strip()
    lot = (request.POST.get('lot') or '').strip()

    updates = []
    if role:
        if role not in allowed_roles:
            return JsonResponse({'ok': False, 'error': 'Invalid role change.'}, status=400)
        if getattr(u, 'role', None) != role:
            u.role = role
            updates.append('role')
    if getattr(u, 'block', None) != block:
        u.block = block
        updates.append('block')
    if getattr(u, 'lot', None) != lot:
        u.lot = lot
        updates.append('lot')
    if updates:
        u.save(update_fields=updates)

    User = get_user_model()
    role_map = dict(getattr(User, 'ROLE_CHOICES', ()))
    return JsonResponse({
        'ok': True,
        'member': {
            'id': u.id,
            'name': (getattr(u, 'full_name', '') or u.username).strip(),
            'email': getattr(u, 'email', ''),
            'role': getattr(u, 'role', ''),
            'role_display': role_map.get(getattr(u, 'role', ''), getattr(u, 'role', '')),
            'block': getattr(u, 'block', ''),
            'lot': getattr(u, 'lot', ''),
        }
    })


@login_required
@require_GET
def user_search(request):
    profile, err = _ensure_owner_and_profile(request)
    if err:
        return err
    q = (request.GET.get('q') or '').strip()
    if not q:
        return JsonResponse({'ok': True, 'results': []})
    User = get_user_model()
    # Exclude users already in any community
    in_any = CommunityMembership.objects.values_list('user_id', flat=True)
    qs = User.objects.exclude(id__in=in_any).filter(
        Q(email__iexact=q) | Q(full_name__icontains=q) | Q(username__icontains=q)
    ).order_by(Lower('full_name'), 'username')[:10]
    results = []
    role_map = dict(getattr(User, 'ROLE_CHOICES', ()))
    for u in qs:
        # Derive avatar/profile picture URL when available
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
        results.append({
            'id': u.id,
            'name': (getattr(u, 'full_name', '') or u.username).strip(),
            'email': getattr(u, 'email', ''),
            'role': getattr(u, 'role', ''),
            'role_display': role_map.get(getattr(u, 'role', ''), getattr(u, 'role', '')),
            'avatar': avatar,
        })
    return JsonResponse({'ok': True, 'results': results})


@login_required
@require_POST
def member_add(request):
    profile, err = _ensure_owner_and_profile(request)
    if err:
        return err
    try:
        user_id = int(request.POST.get('user_id'))
    except (TypeError, ValueError):
        return JsonResponse({'ok': False, 'error': 'Invalid user id.'}, status=400)
    User = get_user_model()
    u = User.objects.filter(id=user_id).first()
    if not u:
        return JsonResponse({'ok': False, 'error': 'User not found.'}, status=404)
    if CommunityMembership.objects.filter(user=u).exists():
        return JsonResponse({'ok': False, 'error': 'User already belongs to a community.'}, status=409)
    with transaction.atomic():
        CommunityMembership.objects.create(user=u, community=profile)
        # Align address to community address if available
        if getattr(profile, 'community_address', ''):
            u.address = profile.community_address
            u.save(update_fields=['address'])
        # Auto-promote guests to resident when owner adds them to community
        try:
            if (getattr(u, 'role', '') or '').lower() in ('', 'guest'):
                u.role = 'resident'
                u.save(update_fields=['role'])
        except Exception:
            pass
    role_map = dict(getattr(User, 'ROLE_CHOICES', ()))
    # Derive avatar for response
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
    return JsonResponse({
        'ok': True,
        'member': {
            'id': u.id,
            'name': (getattr(u, 'full_name', '') or u.username).strip(),
            'email': getattr(u, 'email', ''),
            'role': getattr(u, 'role', ''),
            'role_display': role_map.get(getattr(u, 'role', ''), getattr(u, 'role', '')),
            'block': getattr(u, 'block', ''),
            'lot': getattr(u, 'lot', ''),
            'avatar': avatar,
        }
    })


@login_required
@require_POST
def member_remove(request):
    profile, err = _ensure_owner_and_profile(request)
    if err:
        return err
    try:
        user_id = int(request.POST.get('user_id'))
    except (TypeError, ValueError):
        return JsonResponse({'ok': False, 'error': 'Invalid user id.'}, status=400)
    mem = CommunityMembership.objects.filter(community=profile, user_id=user_id).first()
    if not mem:
        return JsonResponse({'ok': False, 'error': 'User not found in your community.'}, status=404)
    
    # Get the user before deleting membership
    user = mem.user
    
    # Delete the membership
    mem.delete()
    
    # Revert user role to 'guest' if they're not a special role
    try:
        if user.role in ['resident', 'security']:
            user.role = 'guest'
            user.save(update_fields=['role'])
    except Exception:
        pass
    
    return JsonResponse({'ok': True})


@login_required
@require_GET
def emergency_list(request):
    profile, err = _ensure_owner_and_profile(request)
    if err:
        return err
    data = []
    for c in EmergencyContact.objects.filter(community=profile).order_by('order', 'id'):
        data.append({'id': c.id, 'label': c.label, 'phone': c.phone})
    return JsonResponse({'ok': True, 'contacts': data})


@login_required
@require_POST
def emergency_add(request):
    profile, err = _ensure_owner_and_profile(request)
    if err:
        return err
    label = (request.POST.get('label') or '').strip()
    phone = (request.POST.get('phone') or '').strip()
    if not label or not phone:
        return JsonResponse({'ok': False, 'error': 'Both label and phone are required.'}, status=400)
    try:
        max_order = EmergencyContact.objects.filter(community=profile).order_by('-order').values_list('order', flat=True).first() or 0
    except Exception:
        max_order = 0
    c = EmergencyContact.objects.create(community=profile, label=label, phone=phone, order=max_order + 1)
    return JsonResponse({'ok': True, 'contact': {'id': c.id, 'label': c.label, 'phone': c.phone}})


@login_required
@require_POST
def emergency_delete(request):
    profile, err = _ensure_owner_and_profile(request)
    if err:
        return err
    try:
        cid = int(request.POST.get('contact_id'))
    except (TypeError, ValueError):
        return JsonResponse({'ok': False, 'error': 'Invalid contact id.'}, status=400)
    deleted, _ = EmergencyContact.objects.filter(community=profile, id=cid).delete()
    if not deleted:
        return JsonResponse({'ok': False, 'error': 'Contact not found.'}, status=404)
    return JsonResponse({'ok': True})


@login_required
@require_POST
def emergency_update(request):
    profile, err = _ensure_owner_and_profile(request)
    if err:
        return err
    try:
        cid = int(request.POST.get('contact_id'))
    except (TypeError, ValueError):
        return JsonResponse({'ok': False, 'error': 'Invalid contact id.'}, status=400)
    label = (request.POST.get('label') or '').strip()
    phone = (request.POST.get('phone') or '').strip()
    if not label or not phone:
        return JsonResponse({'ok': False, 'error': 'Both label and phone are required.'}, status=400)
    c = EmergencyContact.objects.filter(community=profile, id=cid).first()
    if not c:
        return JsonResponse({'ok': False, 'error': 'Contact not found.'}, status=404)
    c.label = label
    c.phone = phone
    c.save(update_fields=['label', 'phone'])
    return JsonResponse({'ok': True, 'contact': {'id': c.id, 'label': c.label, 'phone': c.phone}})


# Signal handler for automatic role reversion when users are removed from communities
@receiver(post_delete, sender=CommunityMembership)
def handle_membership_deletion(sender, instance, **kwargs):
    """
    Automatically revert user role to 'guest' when they are removed from a community
    """
    try:
        user = instance.user
        # Only revert if user is a resident or security (not community owner or admin)
        if user.role in ['resident', 'security']:
            user.role = 'guest'
            user.save(update_fields=['role'])
    except Exception:
        # Silently handle any errors to avoid breaking the deletion process
        pass
