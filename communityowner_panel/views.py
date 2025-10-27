from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib import messages
from django.db import transaction
from django.contrib.auth import get_user_model
from .models import CommunityProfile, CommunityMembership, EmergencyContact
from django.middleware.csrf import get_token
from django.http import JsonResponse
from django.db.models import Q, Count
from django.views.decorators.http import require_GET, require_POST
from django.db.models.functions import Lower
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.core.paginator import Paginator
from django.utils import timezone
from datetime import datetime, timedelta
import csv
import io
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from security_panel.models import SecurityReport, Incident


@login_required
def community_owner_dashboard(request):
    # Only allow users with the 'Community Owner' role
    if not getattr(request.user, 'role', None) == 'communityowner':
        return HttpResponseForbidden('You are not authorized to view this page.')

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

    context = {
        'profile': profile,
        'needs_onboarding': needs_onboarding,
        'csrf_token': get_token(request),
        'members': members_data,
        'ec_count': ec_count,
        'reports_stats': reports_stats,
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


@login_required
@require_GET
def reports_list(request):
    """Get paginated list of security reports for community owner"""
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
            Q(target_description__icontains=search_query)
        )
    
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
            'created_at': report.created_at.strftime('%Y-%m-%d %H:%M'),
            'updated_at': report.updated_at.strftime('%Y-%m-%d %H:%M'),
            'resolved_at': report.resolved_at.strftime('%Y-%m-%d %H:%M') if report.resolved_at else None,
            'security_notes': report.security_notes,
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
            Q(target_description__icontains=search_query)
        )
    
    # Create PDF with beautiful styling
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=50, leftMargin=50, topMargin=50, bottomMargin=50)
    
    # Modern Enhanced Styles
    styles = getSampleStyleSheet()
    
    # Modern gradient-inspired title style
    title_style = ParagraphStyle(
        'ModernTitle',
        parent=styles['Heading1'],
        fontSize=28,
        spaceAfter=25,
        spaceBefore=20,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#0f172a'),  # Deep slate
        fontName='Helvetica-Bold',
        leading=32
    )
    
    # Modern subtitle style
    subtitle_style = ParagraphStyle(
        'ModernSubtitle',
        parent=styles['Normal'],
        fontSize=14,
        spaceAfter=30,
        spaceBefore=0,  # Remove space before to bring it closer
        alignment=TA_CENTER,
        textColor=colors.HexColor('#64748b'),  # Slate gray
        fontName='Helvetica',
        leading=18
    )
    
    # Modern section heading style
    heading_style = ParagraphStyle(
        'ModernHeading',
        parent=styles['Heading2'],
        fontSize=18,
        spaceAfter=20,
        spaceBefore=25,
        textColor=colors.HexColor('#1e293b'),  # Dark slate
        fontName='Helvetica-Bold',
        leading=22,
        borderWidth=0,
        borderPadding=0,
        backColor=colors.HexColor('#ffffff')
    )
    
    # Modern info text style
    info_style = ParagraphStyle(
        'ModernInfo',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=6,
        textColor=colors.HexColor('#475569'),  # Slate 600
        fontName='Helvetica',
        leading=14
    )
    
    # Modern card style for stats
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
    
    # Modern header with elegant design
    story.append(Paragraph("SECURITY REPORTS", title_style))
    story.append(Paragraph("Comprehensive Security Analysis & Insights", subtitle_style))
    
    # Modern report info section with better formatting
    current_time = timezone.now().strftime('%B %d, %Y at %I:%M %p')
    
    # Create a modern info box
    info_data = [
        ['Generated', current_time],
        ['Community', profile.community_name],
        ['Total Reports', str(reports.count())],
        ['Report Period', f"{year_filter if year_filter else 'All Years'} {month_filter if month_filter else ''}".strip()]
    ]
    
    info_table = Table(info_data, colWidths=[1.5*inch, 3*inch])
    info_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f1f5f9')),  # Light slate
        ('BACKGROUND', (1, 0), (1, -1), colors.HexColor('#ffffff')),  # White
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#475569')),  # Slate 600
        ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#1e293b')),  # Dark slate
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),  # Slate 200
        ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor('#e2e8f0')),
        ('LINEBELOW', (0, 1), (-1, 1), 1, colors.HexColor('#e2e8f0')),
        ('LINEBELOW', (0, 2), (-1, 2), 1, colors.HexColor('#e2e8f0')),
    ]))
    
    story.append(info_table)
    story.append(Spacer(1, 30))
    
    # Beautiful Statistics Section
    resident_reports = reports.filter(target_type='resident').count()
    non_resident_reports = reports.filter(target_type='outsider').count()
    pending_reports = reports.filter(status='pending').count()
    investigating_reports = reports.filter(status='investigating').count()
    resolved_reports = reports.filter(status='resolved').count()
    false_alarm_reports = reports.filter(status='false_alarm').count()
    
    # Create modern stats cards in a 3x2 grid
    stats_data = [
        ['RESIDENT REPORTS', 'NON-RESIDENT REPORTS', 'PENDING REPORTS'],
        [str(resident_reports), str(non_resident_reports), str(pending_reports)],
        ['INVESTIGATING', 'RESOLVED', 'FALSE ALARMS'],
        [str(investigating_reports), str(resolved_reports), str(false_alarm_reports)]
    ]
    
    stats_table = Table(stats_data, colWidths=[1.8*inch, 1.8*inch, 1.8*inch])
    stats_table.setStyle(TableStyle([
        # Header rows (labels)
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),  # Dark slate
        ('BACKGROUND', (0, 2), (-1, 2), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('TEXTCOLOR', (0, 2), (-1, 2), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 2), (-1, 2), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('FONTSIZE', (0, 2), (-1, 2), 9),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('ALIGN', (0, 2), (-1, 2), 'CENTER'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BOTTOMPADDING', (0, 2), (-1, 2), 8),
        ('TOPPADDING', (0, 2), (-1, 2), 8),
        
        # Data rows (numbers)
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#f8fafc')),  # Light slate
        ('BACKGROUND', (0, 3), (-1, 3), colors.HexColor('#f8fafc')),
        ('TEXTCOLOR', (0, 1), (-1, 1), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (0, 3), (-1, 3), colors.HexColor('#0f172a')),
        ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Bold'),
        ('FONTNAME', (0, 3), (-1, 3), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 1), (-1, 1), 16),
        ('FONTSIZE', (0, 3), (-1, 3), 16),
        ('ALIGN', (0, 1), (-1, 1), 'CENTER'),
        ('ALIGN', (0, 3), (-1, 3), 'CENTER'),
        ('BOTTOMPADDING', (0, 1), (-1, 1), 12),
        ('TOPPADDING', (0, 1), (-1, 1), 12),
        ('BOTTOMPADDING', (0, 3), (-1, 3), 12),
        ('TOPPADDING', (0, 3), (-1, 3), 12),
        
        # Borders
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
        ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor('#e2e8f0')),
        ('LINEBELOW', (0, 1), (-1, 1), 1, colors.HexColor('#e2e8f0')),
        ('LINEBELOW', (0, 2), (-1, 2), 1, colors.HexColor('#e2e8f0')),
        ('LINEABOVE', (0, 3), (-1, 3), 1, colors.HexColor('#e2e8f0')),
        ('LINEABOVE', (0, 0), (-1, 0), 1, colors.HexColor('#e2e8f0')),
    ]))
    
    story.append(stats_table)
    story.append(Spacer(1, 25))
    
    # Beautiful Common Reasons Section
    from collections import Counter
    all_reasons = []
    for report in reports:
        if isinstance(report.reasons, list):
            all_reasons.extend(report.reasons)
    reason_counts = Counter(all_reasons)
    
    # Get top 5 most common reasons, but include ties
    common_reasons = reason_counts.most_common(5)
    if len(reason_counts) > 5:
        # Check for ties at 5th place and beyond
        fifth_count = common_reasons[4][1] if len(common_reasons) >= 5 else 0
        
        # Find all reasons with the same count as 5th place
        tied_reasons = []
        for reason, count in reason_counts.most_common():
            if count == fifth_count:
                tied_reasons.append((reason, count))
            elif count < fifth_count:
                break
        
        # If we have more than 5 reasons with the same count as 5th place, include them all
        if len(tied_reasons) > 5:
            common_reasons = tied_reasons
    if common_reasons:
        reasons_data = [['TOP SECURITY CONCERNS', 'REPORTS']]
        others_details = []  # Store details for "Others" reason
        
        for reason, count in common_reasons:
            reasons_data.append([reason, str(count)])
            
            # If this is "Others" reason, collect the actual messages
            if reason.lower() in ['other (please specify)', 'others', 'other']:
                for report in reports:
                    if isinstance(report.reasons, list) and reason in report.reasons:
                        if report.message and report.message.strip():
                            others_details.append({
                                'subject': report.subject,
                                'message': report.message,
                                'date': report.created_at.strftime('%m/%d/%Y'),
                                'reporter': report.get_reporter_display()
                            })
        
        reasons_table = Table(reasons_data, colWidths=[3.5*inch, 1.5*inch])
        reasons_table.setStyle(TableStyle([
            # Header row
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#dc2626')),  # Modern red
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('TOPPADDING', (0, 0), (-1, 0), 12),
            # Data rows
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#fef2f2')),  # Light red
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 10),
            ('TOPPADDING', (0, 1), (-1, -1), 10),
            ('ALIGN', (1, 1), (1, -1), 'CENTER'),
            ('FONTNAME', (1, 1), (1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (1, 1), (1, -1), 14),
            ('TEXTCOLOR', (1, 1), (1, -1), colors.HexColor('#dc2626')),
            # Borders
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#fecaca')),
            ('LINEBELOW', (0, 0), (-1, 0), 2, colors.HexColor('#dc2626')),
        ] + [('LINEBELOW', (0, i), (-1, i), 1, colors.HexColor('#fecaca')) for i in range(1, len(reasons_data))]))
        
        story.append(reasons_table)
        story.append(Spacer(1, 25))
        
        # Add "Others" details table if "Others" is in the top reasons
        if others_details:
            story.append(Paragraph("DETAILS FOR 'OTHERS' REPORTS", heading_style))
            
            others_data = [['SUBJECT', 'MESSAGE', 'REPORTER', 'DATE']]
            for detail in others_details[:10]:  # Limit to 10 most recent "Others" reports
                # Keep full subject and message, truncate only reporter
                subject_text = detail['subject']  # Keep full subject
                # Create a Paragraph for message to enable text wrapping
                message_para = Paragraph(detail['message'], ParagraphStyle(
                    'MessageText',
                    parent=styles['Normal'],
                    fontSize=8,
                    fontName='Helvetica',
                    textColor=colors.HexColor('#1e293b'),
                    alignment=TA_LEFT,
                    spaceAfter=0,
                    spaceBefore=0
                ))
                reporter_text = detail['reporter'][:12] + '...' if len(detail['reporter']) > 12 else detail['reporter']
                
                others_data.append([
                    subject_text,
                    message_para,  # Use Paragraph object for wrapping
                    reporter_text,
                    detail['date']
                ])
            
            others_table = Table(others_data, colWidths=[2.2*inch, 2.2*inch, 1*inch, 0.8*inch])
            others_table.setStyle(TableStyle([
                # Header row
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#059669')),  # Modern green
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                ('TOPPADDING', (0, 0), (-1, 0), 8),
                # Data rows
                ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f0fdf4')),  # Light green
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
                ('TOPPADDING', (0, 1), (-1, -1), 8),
                ('ALIGN', (0, 1), (0, -1), 'LEFT'),  # Subject left-aligned
                ('ALIGN', (1, 1), (1, -1), 'LEFT'),  # Message left-aligned
                ('ALIGN', (2, 1), (-1, -1), 'CENTER'),  # Other columns centered
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),  # Top alignment for better text handling
            # Borders
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#d1fae5')),
            ('LINEBELOW', (0, 0), (-1, 0), 2, colors.HexColor('#059669')),
                # Alternating row colors
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#f0fdf4'), colors.white]),
                # Add borders between rows for better readability
                ('LINEBELOW', (0, 1), (-1, -1), 0.5, colors.HexColor('#d1fae5')),
            ]))
            
            story.append(others_table)
            if len(others_details) > 10:
                story.append(Paragraph(f"... and {len(others_details) - 10} more 'Others' reports", info_style))
        story.append(Spacer(1, 25))
    
    # Beautiful Resident Reports Section
    resident_reports = reports.filter(target_type='resident')
    if resident_reports.exists():
        # Table headers (NO ID COLUMN)
        table_data = [['RESIDENT REPORTS', 'PRIORITY', 'STATUS', 'REPORTER', 'DATE']]
        
        # Add resident report data
        for report in resident_reports:  # Show ALL reports, no limit
            # Format priority with colors
            priority_text = report.priority.title()
            if report.priority == 'urgent':
                priority_text = 'URGENT'
            elif report.priority == 'high':
                priority_text = 'HIGH'
            elif report.priority == 'medium':
                priority_text = 'MEDIUM'
            else:
                priority_text = 'LOW'
            
            # Format status
            status_text = report.status.replace('_', ' ').title()
            if report.status == 'pending':
                status_text = 'Pending'
            elif report.status == 'investigating':
                status_text = 'Investigating'
            elif report.status == 'resolved':
                status_text = 'Resolved'
            elif report.status == 'false_alarm':
                status_text = 'False Alarm'
            
            # Create Paragraph for subject to enable text wrapping
            subject_para = Paragraph(report.subject, ParagraphStyle(
                'SubjectText',
                parent=styles['Normal'],
                fontSize=9,
                fontName='Helvetica',
                textColor=colors.HexColor('#1e293b'),
                alignment=TA_LEFT,
                spaceAfter=0,
                spaceBefore=0
            ))
            
            table_data.append([
                subject_para,  # Use Paragraph object for wrapping
                priority_text,
                status_text,
                report.get_reporter_display()[:12] + '...' if len(report.get_reporter_display()) > 12 else report.get_reporter_display(),
                report.created_at.strftime('%m/%d/%Y')
            ])
        
        # Create modern resident reports table
        resident_table = Table(table_data, colWidths=[2.5*inch, 1*inch, 1.2*inch, 1.2*inch, 0.8*inch])
        resident_table.setStyle(TableStyle([
            # Header row
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563eb')),  # Modern blue
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('TOPPADDING', (0, 0), (-1, 0), 12),
            # Data rows
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#eff6ff')),  # Light blue
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
            ('TOPPADDING', (0, 1), (-1, -1), 8),
            ('ALIGN', (0, 1), (0, -1), 'LEFT'),  # Subject left-aligned
            ('ALIGN', (1, 1), (-1, -1), 'CENTER'),  # Other columns centered
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            # Borders
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#dbeafe')),
            ('LINEBELOW', (0, 0), (-1, 0), 2, colors.HexColor('#2563eb')),
            # Alternating row colors
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#eff6ff'), colors.white]),
        ]))
        
        story.append(resident_table)
        story.append(Spacer(1, 25))
    
    # Beautiful Non-Resident Reports Section
    non_resident_reports = reports.filter(target_type='outsider')
    if non_resident_reports.exists():
        # Table headers (NO ID COLUMN)
        table_data = [['NON-RESIDENT REPORTS', 'PRIORITY', 'STATUS', 'REPORTER', 'DATE']]
        
        # Add non-resident report data
        for report in non_resident_reports:  # Show ALL reports, no limit
            # Format priority with colors
            priority_text = report.priority.title()
            if report.priority == 'urgent':
                priority_text = 'URGENT'
            elif report.priority == 'high':
                priority_text = 'HIGH'
            elif report.priority == 'medium':
                priority_text = 'MEDIUM'
            else:
                priority_text = 'LOW'
            
            # Format status
            status_text = report.status.replace('_', ' ').title()
            if report.status == 'pending':
                status_text = 'Pending'
            elif report.status == 'investigating':
                status_text = 'Investigating'
            elif report.status == 'resolved':
                status_text = 'Resolved'
            elif report.status == 'false_alarm':
                status_text = 'False Alarm'
            
            # Create Paragraph for subject to enable text wrapping
            subject_para = Paragraph(report.subject, ParagraphStyle(
                'SubjectText',
                parent=styles['Normal'],
                fontSize=9,
                fontName='Helvetica',
                textColor=colors.HexColor('#1e293b'),
                alignment=TA_LEFT,
                spaceAfter=0,
                spaceBefore=0
            ))
            
            table_data.append([
                subject_para,  # Use Paragraph object for wrapping
                priority_text,
                status_text,
                report.get_reporter_display()[:12] + '...' if len(report.get_reporter_display()) > 12 else report.get_reporter_display(),
                report.created_at.strftime('%m/%d/%Y')
            ])
        
        # Create modern non-resident reports table
        non_resident_table = Table(table_data, colWidths=[2.5*inch, 1*inch, 1.2*inch, 1.2*inch, 0.8*inch])
        non_resident_table.setStyle(TableStyle([
            # Header row
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#dc2626')),  # Modern red
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('TOPPADDING', (0, 0), (-1, 0), 12),
            # Data rows
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#fef2f2')),  # Light red
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
            ('TOPPADDING', (0, 1), (-1, -1), 8),
            ('ALIGN', (0, 1), (0, -1), 'LEFT'),  # Subject left-aligned
            ('ALIGN', (1, 1), (-1, -1), 'CENTER'),  # Other columns centered
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            # Borders
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#fecaca')),
            ('LINEBELOW', (0, 0), (-1, 0), 2, colors.HexColor('#dc2626')),
            # Alternating row colors
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#fef2f2'), colors.white]),
        ]))
        
        story.append(non_resident_table)
    
    if not reports.exists():
        story.append(Paragraph("No reports found.", info_style))
    
    # Modern footer with elegant design
    story.append(Spacer(1, 40))
    
    # Add a modern divider line
    story.append(Paragraph("─" * 60, ParagraphStyle(
        'Divider',
        parent=styles['Normal'],
        fontSize=8,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#e2e8f0'),
        spaceAfter=15,
        spaceBefore=15
    )))
    
    # Modern footer content
    story.append(Paragraph("Generated by Vigilink Security Management System", ParagraphStyle(
        'FooterTitle',
        parent=styles['Normal'],
        fontSize=11,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#475569'),
        fontName='Helvetica-Bold',
        spaceAfter=5
    )))
    story.append(Paragraph(f"Report generated on {current_time}", ParagraphStyle(
        'FooterInfo',
        parent=styles['Normal'],
        fontSize=9,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#64748b'),
        fontName='Helvetica',
        spaceAfter=10
    )))
    story.append(Paragraph("Confidential Security Report - For Authorized Personnel Only", ParagraphStyle(
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
    # Format filename: DECAHOMES-1 REPORT 2025-10-27 11-30-00.pdf
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
