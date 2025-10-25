from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Q
from .models import SecurityReport
from communityowner_panel.models import CommunityProfile, CommunityMembership
from accounts.models import User
import json

def _ensure_security_user(request):
    """Ensure user has security role and community access"""
    if not request.user.is_authenticated:
        return None, JsonResponse({'error': 'Authentication required'}, status=401)
    
    if request.user.role != 'security':
        return None, JsonResponse({'error': 'Security access required'}, status=403)
    
    # Get user's community
    try:
        membership = CommunityMembership.objects.select_related('community').filter(user=request.user).first()
        if not membership or not membership.community:
            return None, JsonResponse({'error': 'No community access'}, status=403)
        return membership.community, None
    except Exception:
        return None, JsonResponse({'error': 'Community access error'}, status=403)

@login_required
def security_dashboard(request):
    """Security dashboard - main reports view"""
    community, error = _ensure_security_user(request)
    if error:
        return error
    
    # Get reports for this community
    reports = SecurityReport.objects.filter(community=community).order_by('-created_at')
    
    # Filtering
    status_filter = request.GET.get('status', '')
    priority_filter = request.GET.get('priority', '')
    search_query = request.GET.get('search', '')
    
    if status_filter:
        reports = reports.filter(status=status_filter)
    if priority_filter:
        reports = reports.filter(priority=priority_filter)
    if search_query:
        reports = reports.filter(
            Q(subject__icontains=search_query) |
            Q(message__icontains=search_query) |
            Q(reporter_name__icontains=search_query)
        )
    
    # Pagination
    paginator = Paginator(reports, 20)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    
    # Statistics
    stats = {
        'total_reports': reports.count(),
        'new_reports': reports.filter(status='new').count(),
        'investigating': reports.filter(status='investigating').count(),
        'resolved': reports.filter(status='resolved').count(),
        'urgent': reports.filter(priority='urgent').count(),
    }
    
    context = {
        'page_obj': page_obj,
        'stats': stats,
        'status_filter': status_filter,
        'priority_filter': priority_filter,
        'search_query': search_query,
        'community': community,
    }
    
    return render(request, 'security_panel/security.html', context)

@login_required
@require_http_methods(["GET"])
def report_detail(request, report_id):
    """View detailed report"""
    community, error = _ensure_security_user(request)
    if error:
        return error
    
    report = get_object_or_404(SecurityReport, id=report_id, community=community)
    
    context = {
        'report': report,
        'community': community,
    }
    
    return render(request, 'security_panel/report_detail.html', context)

@login_required
@require_http_methods(["POST"])
def update_report_status(request, report_id):
    """Update report status and priority"""
    community, error = _ensure_security_user(request)
    if error:
        return error
    
    report = get_object_or_404(SecurityReport, id=report_id, community=community)
    
    try:
        data = json.loads(request.body)
        status = data.get('status')
        priority = data.get('priority')
        security_notes = data.get('security_notes', '')
        assigned_to_id = data.get('assigned_to')
        
        if status and status in [choice[0] for choice in SecurityReport.STATUS_CHOICES]:
            report.status = status
            if status == 'resolved':
                from django.utils import timezone
                report.resolved_at = timezone.now()
        
        if priority and priority in [choice[0] for choice in SecurityReport.PRIORITY_CHOICES]:
            report.priority = priority
        
        if security_notes is not None:
            report.security_notes = security_notes
        
        if assigned_to_id:
            try:
                assigned_user = User.objects.get(id=assigned_to_id, role='security')
                report.assigned_to = assigned_user
            except User.DoesNotExist:
                pass
        
        report.save()
        
        return JsonResponse({'ok': True, 'message': 'Report updated successfully'})
    
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=400)

@login_required
@require_http_methods(["GET"])
def get_security_users(request):
    """Get list of security users for assignment"""
    community, error = _ensure_security_user(request)
    if error:
        return error
    
    security_users = User.objects.filter(
        role='security',
        community_membership__community=community
    ).values('id', 'full_name', 'username')
    
    return JsonResponse({'users': list(security_users)})
