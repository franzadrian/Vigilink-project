from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib import messages
from django.db import transaction
from django.contrib.auth import get_user_model
from .models import CommunityProfile, CommunityMembership, EmergencyContact
from accounts.models import City, District
from django.middleware.csrf import get_token
from django.http import JsonResponse
from django.db.models import Q, Count
from django.views.decorators.http import require_GET, require_POST
from django.db.models.functions import Lower
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.core.paginator import Paginator
from django.utils import timezone
from django.template.defaultfilters import slugify
from datetime import datetime, timedelta
from calendar import monthrange
import csv
import io
import re
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, Image, KeepTogether
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.graphics.shapes import Drawing, Rect, Circle, Line, String
from reportlab.graphics.charts.barcharts import VerticalBarChart, HorizontalBarChart
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics import renderPDF
import math
from security_panel.models import SecurityReport, Incident

VALID_EMAIL_DOMAINS = [
    'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com',
    'icloud.com', 'protonmail.com', 'mail.com', 'zoho.com', 'yandex.com',
    'live.com', 'msn.com', 'me.com', 'gmx.com', 'mail.ru'
]


@login_required
def community_owner_dashboard(request):
    # Only allow users with the 'Community Owner' role
    if not getattr(request.user, 'role', None) == 'communityowner':
        return HttpResponseForbidden('You are not authorized to view this page.')
    
    # Check subscription status
    from settings_panel.utils import has_community_access
    has_access, reason = has_community_access(request.user)
    if not has_access:
        messages.error(request, reason)
        return redirect('settings_panel:settings')

    profile = None
    try:
        profile = CommunityProfile.objects.filter(owner=request.user).first()
        print(f"DEBUG: Profile found: {profile}")
        if profile:
            print(f"DEBUG: Profile community name: {profile.community_name}")
    except Exception as e:
        print(f"DEBUG: Error getting profile: {e}")
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

    # Get reports statistics for dashboard
    reports_stats = {
        'total_reports': 0,
        'active_reports': 0,
        'month_reports': 0,
        'resident_reports': 0,
        'non_resident_reports': 0,
        'common_reasons': []
    }
    
    try:
        if profile:
            # Security reports
            security_reports = SecurityReport.objects.filter(community=profile)
            reports_stats['total_reports'] = security_reports.count()
            reports_stats['active_reports'] = security_reports.filter(status__in=['pending', 'investigating']).count()
            
            # Last month reports - check if reports are from previous calendar month
            from datetime import datetime, timedelta
            now = timezone.now()
            
            # Get current month and previous month
            current_month = now.month
            current_year = now.year
            
            # Calculate previous month
            if current_month == 1:
                prev_month = 12
                prev_year = current_year - 1
            else:
                prev_month = current_month - 1
                prev_year = current_year
            
            # Count reports from previous calendar month
            reports_stats['month_reports'] = security_reports.filter(
                created_at__year=prev_year,
                created_at__month=prev_month
            ).count()
            
            # Also calculate last 30 days for comparison
            month_ago = now - timedelta(days=30)
            reports_stats['last_30_days'] = security_reports.filter(created_at__gte=month_ago).count()
            
            # Debug: Check what reports are being counted
            print(f"DEBUG: Current time: {now}")
            print(f"DEBUG: Current month/year: {current_month}/{current_year}")
            print(f"DEBUG: Previous month/year: {prev_month}/{prev_year}")
            print(f"DEBUG: Total reports: {reports_stats['total_reports']}")
            print(f"DEBUG: Reports from previous calendar month: {reports_stats['month_reports']}")
            print(f"DEBUG: Reports from last 30 days: {reports_stats['last_30_days']}")
            
            # Check all reports and their dates
            all_reports_list = security_reports.values('id', 'created_at', 'status')
            print(f"DEBUG: All reports:")
            for report in all_reports_list:
                print(f"  - ID: {report['id']}, Created: {report['created_at']}, Status: {report['status']}")
            
            # Check reports from previous month specifically
            prev_month_reports = security_reports.filter(
                created_at__year=prev_year,
                created_at__month=prev_month
            )
            print(f"DEBUG: Reports from previous month ({prev_month}/{prev_year}):")
            for report in prev_month_reports:
                print(f"  - ID: {report.id}, Created: {report.created_at}")
            
            # Resident vs non-resident reports
            reports_stats['resident_reports'] = security_reports.filter(target_type='resident').count()
            reports_stats['non_resident_reports'] = security_reports.filter(target_type='outsider').count()
            
            # Status distribution for instant summary display
            status_counts = security_reports.values('status').annotate(total=Count('id'))
            status_map = {item['status']: item['total'] for item in status_counts}
            reports_stats['pending_reports'] = status_map.get('pending', 0)
            reports_stats['investigating_reports'] = status_map.get('investigating', 0)
            reports_stats['false_alarm_reports'] = status_map.get('false_alarm', 0)
            reports_stats['resolved_reports'] = status_map.get('resolved', 0)
            
            # Debug logging
            print(f"DEBUG: Community: {profile.community_name}")
            print(f"DEBUG: Total reports: {reports_stats['total_reports']}")
            print(f"DEBUG: Active reports: {reports_stats['active_reports']}")
            print(f"DEBUG: Month reports: {reports_stats['month_reports']}")
            print(f"DEBUG: All reports for community: {list(security_reports.values('id', 'status', 'created_at'))}")
            
            # Common reasons (top 5)
            from collections import Counter
            all_reasons = []
            for report in security_reports:
                if isinstance(report.reasons, list):
                    all_reasons.extend(report.reasons)
            reason_counts = Counter(all_reasons)
            
            # Get top 5 most common reasons, but include ties
            top_reasons = reason_counts.most_common(5)
            if len(reason_counts) > 5:
                # Check for ties at 5th place and beyond
                fifth_count = top_reasons[4][1] if len(top_reasons) >= 5 else 0
                
                # Find all reasons with the same count as 5th place
                tied_reasons = []
                for reason, count in reason_counts.most_common():
                    if count == fifth_count:
                        tied_reasons.append((reason, count))
                    elif count < fifth_count:
                        break
                
                # If we have more than 5 reasons with the same count as 5th place, include them all
                if len(tied_reasons) > 5:
                    top_reasons = tied_reasons
            
            reports_stats['common_reasons'] = [{'reason': reason, 'count': count} for reason, count in top_reasons]
    except Exception:
        pass

    try:
        cities_data = list(City.objects.all().order_by('name').values('id', 'name'))
    except Exception:
        cities_data = []

    context = {
        'profile': profile,
        'needs_onboarding': needs_onboarding,
        'csrf_token': get_token(request),
        'members': members_data,
        'ec_count': ec_count,
        'reports_stats': reports_stats,
        'cities_data': cities_data,
        'valid_email_domains': VALID_EMAIL_DOMAINS,
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
    
    # Check subscription status
    from settings_panel.utils import has_community_access
    has_access, reason = has_community_access(request.user)
    if not has_access:
        return None, JsonResponse({'ok': False, 'error': reason}, status=403)
    
    profile = CommunityProfile.objects.filter(owner=request.user).first()
    if not profile:
        return None, JsonResponse({'ok': False, 'error': 'No community profile found.'}, status=404)
    return profile, None


@login_required
@require_GET
def members_list(request):
    # Check if user is a community owner
    if not getattr(request.user, 'role', None) == 'communityowner':
        return JsonResponse({'ok': False, 'error': 'Unauthorized'}, status=403)
    
    # Get community profile - return empty list if it doesn't exist yet
    profile = CommunityProfile.objects.filter(owner=request.user).first()
    if not profile:
        # Return empty members list instead of error when profile doesn't exist
        return JsonResponse({'ok': True, 'members': []})
    
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
    # Exclude users who own a community (community presidents)
    community_owners = CommunityProfile.objects.values_list('owner_id', flat=True)
    # Exclude the current community owner
    qs = User.objects.exclude(
        id__in=in_any
    ).exclude(
        id__in=community_owners
    ).exclude(
        id=request.user.id
    ).filter(
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
def create_member_account(request):
    profile, err = _ensure_owner_and_profile(request)
    if err:
        return err

    data = request.POST
    full_name = (data.get('full_name') or '').strip()
    username = (data.get('username') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    confirm_password = data.get('confirm_password') or ''
    city_id = data.get('city_id')
    district_id = data.get('district_id')
    contact = (data.get('emergency_contact') or '').strip()

    if not all([full_name, username, email, password, confirm_password, city_id, district_id]):
        return JsonResponse({'ok': False, 'error': 'Please complete all required fields.'}, status=400)

    if len(full_name) < 4 or len(full_name) > 30:
        return JsonResponse({'ok': False, 'error': 'Full name must be between 4 and 30 characters.'}, status=400)

    if not re.match(r'^[A-Za-z\s]+$', full_name):
        return JsonResponse({'ok': False, 'error': 'Full name can only contain letters and spaces.'}, status=400)

    if '@' not in email:
        return JsonResponse({'ok': False, 'error': 'Please provide a valid email address.'}, status=400)

    email_domain = email.split('@')[-1]
    if email_domain not in VALID_EMAIL_DOMAINS:
        return JsonResponse({'ok': False, 'error': 'Please use a supported email domain.'}, status=400)

    if contact and not re.match(r'^\d{11}$', contact):
        return JsonResponse({'ok': False, 'error': 'Emergency contact must be exactly 11 digits.'}, status=400)

    if len(username) < 6 or len(username) > 15:
        return JsonResponse({'ok': False, 'error': 'Username must be between 6 and 15 characters.'}, status=400)

    if re.search(r'[!@#$%^&*()_+\-=\[\]{};\'":\\|,.<>\/?]+', username):
        return JsonResponse({'ok': False, 'error': 'Username cannot contain special characters.'}, status=400)

    if len(password) < 8:
        return JsonResponse({'ok': False, 'error': 'Password must be at least 8 characters.'}, status=400)

    if password != confirm_password:
        return JsonResponse({'ok': False, 'error': 'Passwords do not match.'}, status=400)

    try:
        city = City.objects.get(id=city_id)
        district = District.objects.get(id=district_id)
    except (City.DoesNotExist, District.DoesNotExist):
        return JsonResponse({'ok': False, 'error': 'Invalid city or district selection.'}, status=400)

    if district.city_id != city.id:
        return JsonResponse({'ok': False, 'error': 'Selected district does not belong to the selected city.'}, status=400)

    User = get_user_model()

    if User.objects.filter(email=email).exists():
        return JsonResponse({'ok': False, 'error': 'This email is already registered.'}, status=409)

    if User.objects.filter(username=username).exists():
        return JsonResponse({'ok': False, 'error': 'This username is already taken.'}, status=409)

    with transaction.atomic():
        new_user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            full_name=full_name,
            city=city,
            district=district,
            contact=contact,
            role='resident',
            is_verified=True,
        )

        if profile.community_address:
            new_user.address = profile.community_address
            new_user.save(update_fields=['address'])

        CommunityMembership.objects.create(user=new_user, community=profile)

    role_map = dict(getattr(User, 'ROLE_CHOICES', ()))

    avatar = ''
    try:
        if hasattr(new_user, 'get_profile_picture_url'):
            avatar = new_user.get_profile_picture_url() or ''
        elif getattr(new_user, 'profile_picture_url', ''):
            avatar = new_user.profile_picture_url
        elif getattr(new_user, 'profile_picture', None):
            avatar = new_user.profile_picture.url
    except Exception:
        avatar = ''

    return JsonResponse({
        'ok': True,
        'member': {
            'id': new_user.id,
            'name': (getattr(new_user, 'full_name', '') or new_user.username).strip(),
            'email': getattr(new_user, 'email', ''),
            'role': getattr(new_user, 'role', ''),
            'role_display': role_map.get(getattr(new_user, 'role', ''), getattr(new_user, 'role', '')),
            'block': getattr(new_user, 'block', ''),
            'lot': getattr(new_user, 'lot', ''),
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
    if not phone.isdigit():
        return JsonResponse({'ok': False, 'error': 'Phone number must contain digits only.'}, status=400)
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
    if not phone.isdigit():
        return JsonResponse({'ok': False, 'error': 'Phone number must contain digits only.'}, status=400)
    c = EmergencyContact.objects.filter(community=profile, id=cid).first()
    if not c:
        return JsonResponse({'ok': False, 'error': 'Contact not found.'}, status=404)
    c.label = label
    c.phone = phone
    c.save(update_fields=['label', 'phone'])
    return JsonResponse({'ok': True, 'contact': {'id': c.id, 'label': c.label, 'phone': c.phone}})


@login_required
@require_GET
def reports_list(request):
    """Get paginated list or summary of security reports for community owner"""
    profile, err = _ensure_owner_and_profile(request)
    if err:
        return err
    
    # Get filter parameters
    status_filter = request.GET.get('status', '')
    priority_filter = request.GET.get('priority', '')
    target_type_filter = request.GET.get('target_type', '')
    search_query = request.GET.get('search', '')
    year_filter = request.GET.get('year', '')
    month_filter = request.GET.get('month', '')
    page = int(request.GET.get('page', 1))
    per_page = int(request.GET.get('per_page', 20))
    per_page = max(1, min(per_page, 100))  # guard against unbounded queries
    summary_only = request.GET.get('summary') == '1'
    
    # Base queryset
    reports = SecurityReport.objects.filter(community=profile).order_by('-created_at')
    
    # Apply filters (only if they have values)
    if status_filter and status_filter.strip():
        reports = reports.filter(status=status_filter)
    if priority_filter and priority_filter.strip():
        reports = reports.filter(priority=priority_filter)
    if target_type_filter and target_type_filter.strip():
        reports = reports.filter(target_type=target_type_filter)
    if year_filter and year_filter.strip():
        reports = reports.filter(created_at__year=int(year_filter))
    if month_filter and month_filter.strip():
        reports = reports.filter(created_at__month=int(month_filter))
    if search_query and search_query.strip():
        reports = reports.filter(
            Q(subject__icontains=search_query) |
            Q(message__icontains=search_query) |
            Q(reporter_name__icontains=search_query) |
            Q(details__icontains=search_query)
        )
    
    if summary_only:
        total_count = SecurityReport.objects.filter(community=profile).count()
        summary_counts = reports.aggregate(
            filtered=Count('id'),
            pending=Count('id', filter=Q(status='pending')),
            investigating=Count('id', filter=Q(status='investigating')),
            false_alarm=Count('id', filter=Q(status='false_alarm')),
            resolved=Count('id', filter=Q(status='resolved')),
        )
        return JsonResponse({
            'ok': True,
            'summary': {
                'total': total_count,
                'filtered': summary_counts.get('filtered', 0) or 0,
                'pending': summary_counts.get('pending', 0) or 0,
                'investigating': summary_counts.get('investigating', 0) or 0,
                'false_alarm': summary_counts.get('false_alarm', 0) or 0,
                'resolved': summary_counts.get('resolved', 0) or 0,
            }
        })
    
    # Pagination
    paginator = Paginator(reports, per_page)
    page_obj = paginator.get_page(page)
    
    # Serialize reports
    reports_data = []
    for report in page_obj:
        reports_data.append({
            'id': report.id,
            'subject': report.subject,
            'message': report.message,
            'priority': report.priority,
            'status': report.status,
            'target_type': report.target_type,
            'target_display': report.get_target_display(),
            'reporter_display': report.get_reporter_display(),
            'reasons': report.get_reasons_display(),
            'reasons_list': report.reasons if isinstance(report.reasons, list) else [],
            'details': report.details,
            'location': report.location,
            'created_at': report.created_at.strftime('%Y-%m-%d %H:%M'),
            'updated_at': report.updated_at.strftime('%Y-%m-%d %H:%M'),
            'resolved_at': report.resolved_at.strftime('%Y-%m-%d %H:%M') if report.resolved_at else None,
            'is_anonymous': report.is_anonymous,
        })
    
    return JsonResponse({
        'ok': True,
        'reports': reports_data,
        'pagination': {
            'current_page': page_obj.number,
            'total_pages': paginator.num_pages,
            'total_count': paginator.count,
            'has_next': page_obj.has_next(),
            'has_previous': page_obj.has_previous(),
        }
    })


@login_required
@require_GET
def members_download_pdf(request):
    """Download community members as a PDF roster with signature area."""
    profile, err = _ensure_owner_and_profile(request)
    if err:
        return err

    members_qs = (
        CommunityMembership.objects
        .select_related('user')
        .filter(community=profile)
        .order_by(Lower('user__full_name'), 'user__username')
    )

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=72,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'MembersTitle',
        parent=styles['Heading1'],
        alignment=TA_CENTER,
        fontSize=28,
        leading=32,
        spaceAfter=6,
        textColor=colors.HexColor('#0f172a')
    )
    subtitle_style = ParagraphStyle(
        'MembersSubtitle',
        parent=styles['Normal'],
        alignment=TA_CENTER,
        fontSize=12,
        textColor=colors.HexColor('#475569'),
        spaceAfter=24
    )
    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        textColor=colors.HexColor('#0f172a'),
        alignment=TA_CENTER
    )
    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#1e293b'),
        leading=12
    )
    info_style = ParagraphStyle(
        'Info',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#475569'),
        leading=14
    )

    story = []
    story.append(Paragraph("COMMUNITY MEMBERS", title_style))
    story.append(Paragraph(profile.community_name or "Community", subtitle_style))

    generated = timezone.now().strftime('%B %d, %Y – %I:%M %p')
    info_data = [
        [Paragraph("<b>Generated On</b>", info_style), Paragraph(generated, info_style)],
        [Paragraph("<b>Total Members</b>", info_style), Paragraph(str(members_qs.count()), info_style)],
        [Paragraph("<b>Address</b>", info_style), Paragraph(profile.community_address or "—", info_style)],
    ]
    info_table = Table(info_data, colWidths=[110, 350])
    info_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.whitesmoke),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5f5')),
        ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#cbd5f5')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 18))

    table_data = [
        [
            Paragraph("#", table_header_style),
            Paragraph("Full Name", table_header_style),
            Paragraph("Email", table_header_style),
            Paragraph("Role", table_header_style),
            Paragraph("Block", table_header_style),
            Paragraph("Lot", table_header_style),
        ]
    ]

    for idx, membership in enumerate(members_qs, start=1):
        user = membership.user
        full_name = (getattr(user, 'full_name', '') or user.username or '').strip()
        email = getattr(user, 'email', '') or '—'
        role_display = dict(getattr(user._meta.model, 'ROLE_CHOICES', ())).get(user.role, user.role or '—')
        block = getattr(user, 'block', '') or '—'
        lot = getattr(user, 'lot', '') or '—'

        table_data.append([
            Paragraph(str(idx), table_cell_style),
            Paragraph(full_name or '—', table_cell_style),
            Paragraph(email, table_cell_style),
            Paragraph(role_display.title() if role_display else '—', table_cell_style),
            Paragraph(block, table_cell_style),
            Paragraph(lot, table_cell_style),
        ])

    column_widths = [25, 150, 150, 80, 55, 55]
    members_table = Table(table_data, colWidths=column_widths, repeatRows=1)
    members_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e2e8f0')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('ALIGN', (3, 1), (3, -1), 'CENTER'),
        ('ALIGN', (4, 1), (5, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
        ('GRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#d1d5db')),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))

    story.append(members_table)
    story.append(Spacer(1, 36))

    story.append(Spacer(1, 40))
    signature_line = Paragraph(
        "<para alignment='center'>______________________________</para>",
        ParagraphStyle('CenteredLine', parent=info_style, alignment=TA_CENTER)
    )
    centered_signature = Paragraph(
        "<para alignment='center'>Authorized Signature</para>",
        ParagraphStyle('CenteredInfo', parent=info_style, alignment=TA_CENTER)
    )
    story.append(signature_line)
    story.append(centered_signature)

    doc.build(story)
    pdf = buffer.getvalue()
    buffer.close()

    filename = f"{slugify(profile.community_name or 'community')}_members_{timezone.now().strftime('%Y%m%d_%H%M')}.pdf"
    response = HttpResponse(content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    response.write(pdf)
    return response


@login_required
@require_GET
def report_detail(request, report_id):
    """Get detailed information for a single security report"""
    profile, err = _ensure_owner_and_profile(request)
    if err:
        return err
    
    try:
        report = SecurityReport.objects.get(id=report_id, community=profile)
        
        # Get reasons - if "Other" is in the list, use details instead
        reasons_list = report.reasons if isinstance(report.reasons, list) else []
        reasons_display = report.get_reasons_display()
        
        # If "Other" is in reasons, replace it with details
        if 'Other' in reasons_list or 'other' in [r.lower() for r in reasons_list]:
            # Replace "Other" with details in the display
            reasons_display_list = reasons_display.split(', ') if reasons_display else []
            reasons_display_list = [r for r in reasons_display_list if r.lower() != 'other']
            if report.details:
                reasons_display_list.append(report.details)
            reasons_display = ', '.join(reasons_display_list)
        
        return JsonResponse({
            'ok': True,
            'report': {
                'id': report.id,
                'subject': report.subject,
                'message': report.message,
                'priority': report.priority,
                'status': report.status,
                'target_type': report.target_type,
                'target_display': report.get_target_display(),
                'reporter_display': report.get_reporter_display(),
                'reasons': reasons_display,
                'reasons_list': reasons_list,
                'details': report.details,
                'location': report.location,
                'created_at': report.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                'updated_at': report.updated_at.strftime('%Y-%m-%d %H:%M:%S'),
                'resolved_at': report.resolved_at.strftime('%Y-%m-%d %H:%M:%S') if report.resolved_at else None,
                'is_anonymous': report.is_anonymous,
            }
        })
    except SecurityReport.DoesNotExist:
        return JsonResponse({'ok': False, 'error': 'Report not found'}, status=404)
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=500)


@login_required
@require_GET
def reports_download_pdf(request):
    """Download reports as PDF"""
    profile, err = _ensure_owner_and_profile(request)
    if err:
        return err
    
    # Get filter parameters (same as list view)
    status_filter = request.GET.get('status', '')
    priority_filter = request.GET.get('priority', '')
    target_type_filter = request.GET.get('target_type', '')
    search_query = request.GET.get('search', '')
    year_filter = request.GET.get('year', '')
    month_filter = request.GET.get('month', '')
    
    
    # Base queryset
    reports = SecurityReport.objects.filter(community=profile).order_by('-created_at')
    
    # Apply filters (only if they have values)
    if status_filter and status_filter.strip():
        reports = reports.filter(status=status_filter)
    if priority_filter and priority_filter.strip():
        reports = reports.filter(priority=priority_filter)
    if target_type_filter and target_type_filter.strip():
        reports = reports.filter(target_type=target_type_filter)
    if year_filter and year_filter.strip():
        reports = reports.filter(created_at__year=int(year_filter))
    if month_filter and month_filter.strip():
        reports = reports.filter(created_at__month=int(month_filter))
    if search_query and search_query.strip():
        reports = reports.filter(
            Q(subject__icontains=search_query) |
            Q(message__icontains=search_query) |
            Q(reporter_name__icontains=search_query) |
            Q(details__icontains=search_query)
        )
    
    # Create PDF with professional modern styling
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=40, leftMargin=40, topMargin=60, bottomMargin=60)
    
    # Professional Enhanced Styles
    styles = getSampleStyleSheet()
    
    # Elegant title style with better spacing
    title_style = ParagraphStyle(
        'ModernTitle',
        parent=styles['Heading1'],
        fontSize=32,
        spaceAfter=8,
        spaceBefore=0,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#0f172a'),
        fontName='Helvetica-Bold',
        leading=38
    )
    
    # Professional subtitle style
    subtitle_style = ParagraphStyle(
        'ModernSubtitle',
        parent=styles['Normal'],
        fontSize=13,
        spaceAfter=25,
        spaceBefore=0,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#64748b'),
        fontName='Helvetica',
        leading=16
    )
    
    # Section heading with accent line
    heading_style = ParagraphStyle(
        'ModernHeading',
        parent=styles['Heading2'],
        fontSize=20,
        spaceAfter=18,
        spaceBefore=30,
        textColor=colors.HexColor('#0f172a'),
        fontName='Helvetica-Bold',
        leading=24,
        borderWidth=0,
        borderPadding=0,
        backColor=colors.HexColor('#ffffff')
    )
    
    # Subsection heading
    subheading_style = ParagraphStyle(
        'SubHeading',
        parent=styles['Heading3'],
        fontSize=15,
        spaceAfter=12,
        spaceBefore=20,
        textColor=colors.HexColor('#1e293b'),
        fontName='Helvetica-Bold',
        leading=18
    )
    
    # Info text style
    info_style = ParagraphStyle(
        'ModernInfo',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=6,
        textColor=colors.HexColor('#475569'),
        fontName='Helvetica',
        leading=14
    )
    
    # Card style for stats
    card_style = ParagraphStyle(
        'ModernCard',
        parent=styles['Normal'],
        fontSize=12,
        spaceAfter=8,
        spaceBefore=8,
        textColor=colors.HexColor('#1e293b'),
        fontName='Helvetica-Bold',
        alignment=TA_CENTER,
        leading=16
    )
    
    # Build content
    story = []
    
    # Professional header with elegant design
    story.append(Spacer(1, 10))
    story.append(Paragraph("SECURITY REPORTS", title_style))
    story.append(Paragraph("Comprehensive Security Analysis & Insights", subtitle_style))
    story.append(Spacer(1, 20))
    
    # Format report period
    current_time = timezone.now().strftime('%B %d, %Y at %I:%M %p')
    report_period = 'All Time'
    if year_filter and year_filter.strip() and month_filter and month_filter.strip():
        try:
            year = int(year_filter)
            month = int(month_filter)
            month_name = datetime(year, month, 1).strftime('%B')
            report_period = f"{month_name} {year}"
        except (ValueError, TypeError):
            report_period = f"{year_filter if year_filter else 'All Years'} {month_filter if month_filter else ''}".strip()
    elif year_filter and year_filter.strip():
        report_period = f"Year {year_filter}"
    elif month_filter and month_filter.strip():
        try:
            month = int(month_filter)
            current_year = timezone.now().year
            month_name = datetime(current_year, month, 1).strftime('%B')
            report_period = f"{month_name} {current_year}"
        except (ValueError, TypeError):
            report_period = f"Month {month_filter}"
    
    # Create elegant info box with better design
    info_data = [
        [Paragraph('<b>Generated:</b>', ParagraphStyle('InfoLabel', parent=styles['Normal'], fontSize=10, textColor=colors.HexColor('#475569'), fontName='Helvetica-Bold')), current_time],
        [Paragraph('<b>Community:</b>', ParagraphStyle('InfoLabel', parent=styles['Normal'], fontSize=10, textColor=colors.HexColor('#475569'), fontName='Helvetica-Bold')), profile.community_name],
        [Paragraph('<b>Report Period:</b>', ParagraphStyle('InfoLabel', parent=styles['Normal'], fontSize=10, textColor=colors.HexColor('#475569'), fontName='Helvetica-Bold')), report_period]
    ]
    
    info_table = Table(info_data, colWidths=[1.8*inch, 3.7*inch])
    info_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#0f172a')),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (1, 0), (1, -1), 10),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 15),
        ('RIGHTPADDING', (0, 0), (-1, -1), 15),
        ('BOX', (0, 0), (-1, -1), 1.5, colors.HexColor('#3b82f6')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
    ]))
    
    story.append(info_table)
    story.append(Spacer(1, 35))
    
    # ========== ANALYTICS & CHARTS SECTION ==========
    story.append(Paragraph("ANALYTICS & TRENDS", heading_style))
    story.append(Spacer(1, 20))
    
    # Calculate analytics data
    resident_reports_count = reports.filter(target_type='resident').count()
    non_resident_reports_count = reports.filter(target_type='outsider').count()
    total_reports_count = reports.count()
    
    # Status breakdown
    status_breakdown = {}
    for status, _ in SecurityReport.STATUS_CHOICES:
        status_breakdown[status] = reports.filter(status=status).count()
    
    # Priority breakdown
    priority_breakdown = {}
    for priority, _ in SecurityReport.PRIORITY_CHOICES:
        priority_breakdown[priority] = reports.filter(priority=priority).count()
    
    # Monthly trends - adjust based on filters
    monthly_trends = []
    if year_filter and year_filter.strip() and month_filter and month_filter.strip():
        # If specific month/year is selected, show that month only
        try:
            year = int(year_filter)
            month = int(month_filter)
            days_in_month = monthrange(year, month)[1]
            month_start = timezone.make_aware(datetime(year, month, 1, 0, 0, 0))
            month_end = month_start + timedelta(days=days_in_month)
            count = reports.filter(created_at__gte=month_start, created_at__lt=month_end).count()
            monthly_trends.append({
                'month': month_start.strftime('%b %Y'),
                'count': count
            })
        except (ValueError, TypeError):
            # Fallback to last 6 months if parsing fails
            for i in range(6):
                month_start = timezone.now().replace(day=1) - timedelta(days=30*i)
                month_end = month_start + timedelta(days=30)
                count = reports.filter(created_at__gte=month_start, created_at__lt=month_end).count()
                monthly_trends.append({
                    'month': month_start.strftime('%b %Y'),
                    'count': count
                })
            monthly_trends.reverse()
    elif year_filter and year_filter.strip():
        # If only year is selected, show all months of that year
        try:
            year = int(year_filter)
            for month_num in range(1, 13):
                days_in_month = monthrange(year, month_num)[1]
                month_start = timezone.make_aware(datetime(year, month_num, 1, 0, 0, 0))
                month_end = month_start + timedelta(days=days_in_month)
                count = reports.filter(created_at__gte=month_start, created_at__lt=month_end).count()
                monthly_trends.append({
                    'month': month_start.strftime('%b %Y'),
                    'count': count
                })
        except (ValueError, TypeError):
            # Fallback to last 6 months if parsing fails
            for i in range(6):
                month_start = timezone.now().replace(day=1) - timedelta(days=30*i)
                month_end = month_start + timedelta(days=30)
                count = reports.filter(created_at__gte=month_start, created_at__lt=month_end).count()
                monthly_trends.append({
                    'month': month_start.strftime('%b %Y'),
                    'count': count
                })
            monthly_trends.reverse()
    else:
        # No year/month filter - show last 6 months
        for i in range(6):
            month_start = timezone.now().replace(day=1) - timedelta(days=30*i)
            month_end = month_start + timedelta(days=30)
            count = reports.filter(created_at__gte=month_start, created_at__lt=month_end).count()
            monthly_trends.append({
                'month': month_start.strftime('%b %Y'),
                'count': count
            })
        monthly_trends.reverse()
    
    # Common reasons
    from collections import Counter
    all_reasons = []
    for report in reports:
        if isinstance(report.reasons, list):
            all_reasons.extend(report.reasons)
    reason_counts = Counter(all_reasons)
    common_reasons = reason_counts.most_common(5)
    
    # Summary Stats Cards - Include status counts based on filtered reports
    pending_count = status_breakdown.get('pending', 0)
    investigating_count = status_breakdown.get('investigating', 0)
    false_alarm_count = status_breakdown.get('false_alarm', 0)
    resolved_count = status_breakdown.get('resolved', 0)
    
    stats_data = [
        [
            'TOTAL REPORTS',
            'RESIDENT REPORTS',
            'NON-RESIDENT REPORTS'
        ],
        [
            str(total_reports_count),
            str(resident_reports_count),
            str(non_resident_reports_count)
        ]
    ]
    
    stats_table = Table(stats_data, colWidths=[2.2*inch, 2.2*inch, 2.2*inch])
    stats_table.setStyle(TableStyle([
        # Header row - clean professional design
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        # Value row - clean white background
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#ffffff')),
        ('TEXTCOLOR', (0, 1), (-1, 1), colors.HexColor('#0f172a')),
        ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 1), (-1, 1), 18),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
        ('LINEBELOW', (0, 0), (-1, 0), 2, colors.HexColor('#1e293b')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
    ]))
    story.append(stats_table)
    story.append(Spacer(1, 25))
        
    
    # Status and Priority Breakdown - Tables Only
    status_data = [(status.replace('_', ' ').title(), count) for status, count in status_breakdown.items() if count > 0]
    priority_data = [(priority.replace('level_', 'Level ').title(), count) for priority, count in priority_breakdown.items() if count > 0]
    
    if status_data or priority_data:
        # Create a section for both breakdowns
        story.append(Paragraph("Status & Priority Breakdown", subheading_style))
        story.append(Spacer(1, 15))
        
        # Calculate totals for percentages
        status_total = sum(count for _, count in status_data)
        priority_total = sum(count for _, count in priority_data)
        
        # Create side-by-side layout using a table
        tables_row = []
        
        # Status Breakdown Table
        if status_data:
            status_table_data = [['STATUS', 'COUNT', '%']]
            for label, count in status_data:
                percentage = (count / status_total * 100) if status_total > 0 else 0
                status_table_data.append([
                    Paragraph(f"<b>{label}</b>", ParagraphStyle('TableText', parent=styles['Normal'], fontSize=9, fontName='Helvetica-Bold', leading=12)),
                    Paragraph(str(count), ParagraphStyle('TableText', parent=styles['Normal'], fontSize=9, alignment=TA_CENTER, leading=12)),
                    Paragraph(f"{percentage:.1f}%", ParagraphStyle('TableText', parent=styles['Normal'], fontSize=9, alignment=TA_CENTER, leading=12))
                ])
            
            status_table = Table(status_table_data, colWidths=[2*inch, 0.8*inch, 0.8*inch])
            status_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3b82f6')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('ALIGN', (0, 0), (0, -1), 'LEFT'),
                ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
                ('RIGHTPADDING', (0, 0), (-1, -1), 10),
                ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#3b82f6')),
                ('LINEBELOW', (0, 0), (-1, 0), 2, colors.HexColor('#1e40af')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#ffffff'), colors.HexColor('#f8fafc')]),
                ('LINEBELOW', (0, 1), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ]))
            tables_row.append(status_table)
        else:
            tables_row.append(Spacer(3.6*inch, 0.5*inch))
        
        # Priority Breakdown Table
        if priority_data:
            priority_table_data = [['PRIORITY', 'COUNT', '%']]
            for label, count in priority_data:
                percentage = (count / priority_total * 100) if priority_total > 0 else 0
                priority_table_data.append([
                    Paragraph(f"<b>{label}</b>", ParagraphStyle('TableText', parent=styles['Normal'], fontSize=9, fontName='Helvetica-Bold', leading=12)),
                    Paragraph(str(count), ParagraphStyle('TableText', parent=styles['Normal'], fontSize=9, alignment=TA_CENTER, leading=12)),
                    Paragraph(f"{percentage:.1f}%", ParagraphStyle('TableText', parent=styles['Normal'], fontSize=9, alignment=TA_CENTER, leading=12))
                ])
            
            priority_table = Table(priority_table_data, colWidths=[2*inch, 0.8*inch, 0.8*inch])
            priority_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#8b5cf6')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('ALIGN', (0, 0), (0, -1), 'LEFT'),
                ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
                ('RIGHTPADDING', (0, 0), (-1, -1), 10),
                ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#8b5cf6')),
                ('LINEBELOW', (0, 0), (-1, 0), 2, colors.HexColor('#7c3aed')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#ffffff'), colors.HexColor('#f8fafc')]),
                ('LINEBELOW', (0, 1), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ]))
            tables_row.append(priority_table)
        else:
            tables_row.append(Spacer(3.6*inch, 0.5*inch))
        
        # Create table to place breakdown tables side by side
        breakdown_table = Table([tables_row], colWidths=[3.6*inch, 3.6*inch])
        breakdown_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ]))
        story.append(breakdown_table)
        story.append(Spacer(1, 25))
    
    # Common Reasons - Professional table design (chart removed for cleaner PDF)
    if common_reasons:
        # Keep title and table together on the same page
        common_reasons_content = []
        common_reasons_content.append(Paragraph("Common Reasons", subheading_style))
        
        # Create professional table with full reason text
        reasons_list_data = [['REASON', 'COUNT']]
        for reason, count in common_reasons:
            reason_para = Paragraph(reason, ParagraphStyle(
                'ReasonText',
                parent=styles['Normal'],
                fontSize=9,
                fontName='Helvetica',
                textColor=colors.HexColor('#1e293b'),
                alignment=TA_LEFT,
                spaceAfter=0,
                spaceBefore=0,
                leading=13
            ))
            reasons_list_data.append([reason_para, str(count)])
        
        reasons_list_table = Table(reasons_list_data, colWidths=[4.8*inch, 0.7*inch])
        reasons_list_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#8b5cf6')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#ffffff')),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('LEFTPADDING', (0, 0), (-1, -1), 12),
            ('RIGHTPADDING', (0, 0), (-1, -1), 12),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#8b5cf6')),
            ('LINEBELOW', (0, 0), (-1, 0), 2, colors.HexColor('#7c3aed')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#ffffff'), colors.HexColor('#f8fafc')]),
            ('LINEBELOW', (0, 1), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ]))
        common_reasons_content.append(reasons_list_table)
        common_reasons_content.append(Spacer(1, 30))
        
        # Use KeepTogether to ensure title and table stay on the same page
        story.append(KeepTogether(common_reasons_content))
    
    # ========== REPORTS LIST SECTION ==========
    story.append(Paragraph("ALL REPORTS", heading_style))
    story.append(Spacer(1, 15))
    
    # All Reports Table (combined)
    if reports.exists():
        # Table headers
        table_data = [['COMPLAINANT', 'REASON', 'COMPLAINEE', 'STATUS', 'PRIORITY']]
        
        # Add all report data
        for report in reports:
            # Get reporter display
            reporter_display = report.get_reporter_display() or 'Anonymous'
            
            # Get reason - use details if "Other" is in reasons
            reasons_list = report.reasons if isinstance(report.reasons, list) else []
            if 'Other (please specify)' in reasons_list or 'Other' in reasons_list:
                reason_text = report.details or 'Other'
            else:
                reason_text = ', '.join(reasons_list) if reasons_list else 'N/A'
            
            # Get complainee (subject cleaned)
            complainee_text = report.subject
            # Remove "Report:" prefix, but keep "Non-Resident" intact
            import re
            complainee_text = re.sub(r'^Report:\s*', '', complainee_text, flags=re.IGNORECASE)
            # Only remove standalone "Resident" word, not "Non-Resident"  
            # Use negative lookbehind to avoid removing "Resident" from "Non-Resident"
            complainee_text = re.sub(r'(?<!Non-)\bResident\b\s*', '', complainee_text, flags=re.IGNORECASE)
            # If it's just "Non-" left, restore "Non-Resident"
            if complainee_text.strip() == 'Non-':
                complainee_text = 'Non-Resident'
            complainee_text = complainee_text.strip()
            # Don't truncate - let it wrap in the Paragraph
            
            # Format priority with color coding
            priority_text = report.priority.replace('level_', 'Level ').title()
            priority_color = colors.HexColor('#1e293b')
            if 'Level 1' in priority_text:
                priority_color = colors.HexColor('#065f46')
            elif 'Level 2' in priority_text:
                priority_color = colors.HexColor('#92400e')
            elif 'Level 3' in priority_text:
                priority_color = colors.HexColor('#c53030')
            
            priority_para = Paragraph(f'<b>{priority_text}</b>', ParagraphStyle(
                'CellText',
                parent=styles['Normal'],
                fontSize=9,
                fontName='Helvetica-Bold',
                textColor=priority_color,
                alignment=TA_CENTER,
                spaceAfter=0,
                spaceBefore=0
            ))
            
            # Format status with color coding
            status_text = report.status.replace('_', ' ').title()
            status_color = colors.HexColor('#1e293b')
            if 'Pending' in status_text:
                status_color = colors.HexColor('#1e40af')
            elif 'Investigating' in status_text:
                status_color = colors.HexColor('#92400e')
            elif 'Resolved' in status_text:
                status_color = colors.HexColor('#065f46')
            elif 'False Alarm' in status_text:
                status_color = colors.HexColor('#991b1b')
            
            status_para = Paragraph(f'<b>{status_text}</b>', ParagraphStyle(
                'CellText',
                parent=styles['Normal'],
                fontSize=9,
                fontName='Helvetica-Bold',
                textColor=status_color,
                alignment=TA_CENTER,
                spaceAfter=0,
                spaceBefore=0
            ))
            
            # Create Paragraphs for text wrapping
            reporter_para = Paragraph(reporter_display[:30] + '...' if len(reporter_display) > 30 else reporter_display, ParagraphStyle(
                'CellText',
                parent=styles['Normal'],
                fontSize=9,
                fontName='Helvetica',
                textColor=colors.HexColor('#1e293b'),
                alignment=TA_LEFT,
                spaceAfter=0,
                spaceBefore=0,
                leading=12
            ))
            
            reason_para = Paragraph(reason_text, ParagraphStyle(
                'CellText',
                parent=styles['Normal'],
                fontSize=9,
                fontName='Helvetica',
                textColor=colors.HexColor('#1e293b'),
                alignment=TA_LEFT,
                spaceAfter=0,
                spaceBefore=0,
                leading=12
            ))
            
            complainee_para = Paragraph(complainee_text, ParagraphStyle(
                'CellText',
                parent=styles['Normal'],
                fontSize=9,
                fontName='Helvetica',
                textColor=colors.HexColor('#1e293b'),
                alignment=TA_LEFT,
                spaceAfter=0,
                spaceBefore=0,
                leading=12
            ))
            
            table_data.append([
                reporter_para,
                reason_para,
                complainee_para,
                status_para,
                priority_para
            ])
        
        # Create professional reports table with better styling
        reports_table = Table(table_data, colWidths=[1.6*inch, 2.1*inch, 2.1*inch, 1.3*inch, 1.1*inch])
        reports_table.setStyle(TableStyle([
            # Header row - professional dark header
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('TOPPADDING', (0, 0), (-1, 0), 12),
            ('LEFTPADDING', (0, 0), (-1, 0), 8),
            ('RIGHTPADDING', (0, 0), (-1, 0), 8),
            # Data rows
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#ffffff')),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('ALIGN', (0, 1), (1, -1), 'LEFT'),
            ('ALIGN', (2, 1), (2, -1), 'LEFT'),
            ('ALIGN', (3, 1), (-1, -1), 'CENTER'),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
            ('TOPPADDING', (0, 1), (-1, -1), 8),
            ('LEFTPADDING', (0, 1), (-1, -1), 8),
            ('RIGHTPADDING', (0, 1), (-1, -1), 8),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            # Borders
            ('BOX', (0, 0), (-1, -1), 1.5, colors.HexColor('#3b82f6')),
            ('LINEBELOW', (0, 0), (-1, 0), 2, colors.HexColor('#1e40af')),
            # Alternating row colors for better readability
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#ffffff'), colors.HexColor('#f8fafc')]),
            ('LINEBELOW', (0, 1), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ]))
        
        story.append(reports_table)
    
    if not reports.exists():
        story.append(Paragraph("No reports found.", info_style))
    
    # Professional footer with elegant design
    story.append(Spacer(1, 35))
    
    # Add elegant divider line
    divider_table = Table([['']], colWidths=[5.5*inch])
    divider_table.setStyle(TableStyle([
        ('LINEBELOW', (0, 0), (0, 0), 2, colors.HexColor('#3b82f6')),
        ('TOPPADDING', (0, 0), (0, 0), 0),
        ('BOTTOMPADDING', (0, 0), (0, 0), 0),
    ]))
    story.append(divider_table)
    story.append(Spacer(1, 15))
    
    # Professional footer content
    story.append(Paragraph("<b>Vigilink Security Management System</b>", ParagraphStyle(
        'FooterTitle',
        parent=styles['Normal'],
        fontSize=11,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#3b82f6'),
        fontName='Helvetica-Bold',
        spaceAfter=6
    )))
    story.append(Paragraph(f"Report generated on {current_time}", ParagraphStyle(
        'FooterInfo',
        parent=styles['Normal'],
        fontSize=9,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#64748b'),
        fontName='Helvetica',
        spaceAfter=8
    )))
    story.append(Paragraph("<i>Confidential Security Report - For Authorized Personnel Only</i>", ParagraphStyle(
        'FooterConfidential',
        parent=styles['Normal'],
        fontSize=8,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#94a3b8'),
        fontName='Helvetica-Oblique',
        spaceAfter=0
    )))
    
    # Build PDF
    doc.build(story)
    buffer.seek(0)
    
    # Create response
    response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
    # Format filename: [Community Name] REPORT [Date] [Time].pdf
    # Example: Greenfield Village REPORT 2025-10-27 11-30-00.pdf
    formatted_time = current_time.replace(":", "-").replace(" ", " ")
    filename = f"{profile.community_name} REPORT {formatted_time}.pdf"
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


@login_required
@require_GET
def reports_analytics(request):
    """Get reports analytics for community owner"""
    profile, err = _ensure_owner_and_profile(request)
    if err:
        return err
    
    # Get reports for this community
    reports = SecurityReport.objects.filter(community=profile)
    
    # Apply year/month filters if provided
    year_filter = request.GET.get('year', '')
    month_filter = request.GET.get('month', '')
    
    if year_filter and year_filter.strip():
        reports = reports.filter(created_at__year=int(year_filter))
    if month_filter and month_filter.strip():
        reports = reports.filter(created_at__month=int(month_filter))
    
    # Basic statistics
    total_reports = reports.count()
    resident_reports = reports.filter(target_type='resident').count()
    non_resident_reports = reports.filter(target_type='outsider').count()
    
    # Status breakdown
    status_breakdown = {}
    for status, _ in SecurityReport.STATUS_CHOICES:
        status_breakdown[status] = reports.filter(status=status).count()
    
    # Priority breakdown
    priority_breakdown = {}
    for priority, _ in SecurityReport.PRIORITY_CHOICES:
        priority_breakdown[priority] = reports.filter(priority=priority).count()
    
    # Common reasons
    from collections import Counter
    all_reasons = []
    for report in reports:
        if isinstance(report.reasons, list):
            all_reasons.extend(report.reasons)
    reason_counts = Counter(all_reasons)
    
    # Get top 5 most common reasons, but include ties
    top_reasons = reason_counts.most_common(5)
    if len(reason_counts) > 5:
        # Check for ties at 5th place and beyond
        fifth_count = top_reasons[4][1] if len(top_reasons) >= 5 else 0
        
        # Find all reasons with the same count as 5th place
        tied_reasons = []
        for reason, count in reason_counts.most_common():
            if count == fifth_count:
                tied_reasons.append((reason, count))
            elif count < fifth_count:
                break
        
        # If we have more than 5 reasons with the same count as 5th place, include them all
        if len(tied_reasons) > 5:
            top_reasons = tied_reasons
    common_reasons = [{'reason': reason, 'count': count} for reason, count in top_reasons]
    
    # Monthly trends (last 6 months)
    monthly_trends = []
    for i in range(6):
        month_start = timezone.now().replace(day=1) - timedelta(days=30*i)
        month_end = month_start + timedelta(days=30)
        count = reports.filter(created_at__gte=month_start, created_at__lt=month_end).count()
        monthly_trends.append({
            'month': month_start.strftime('%Y-%m'),
            'count': count
        })
    monthly_trends.reverse()
    
    return JsonResponse({
        'ok': True,
        'analytics': {
            'total_reports': total_reports,
            'resident_reports': resident_reports,
            'non_resident_reports': non_resident_reports,
            'status_breakdown': status_breakdown,
            'priority_breakdown': priority_breakdown,
            'common_reasons': common_reasons,
            'monthly_trends': monthly_trends,
        }
    })


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
