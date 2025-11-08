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
    except Exception as e:
        return None, JsonResponse({'error': f'Community access error: {str(e)}'}, status=403)

@login_required
def security_dashboard(request):
    """Security dashboard - main reports view"""
    community, error = _ensure_security_user(request)
    if error:
        return error
    
    # Get reports for this community
    all_reports = SecurityReport.objects.filter(community=community)
    reports = all_reports.order_by('-created_at')
    
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
    
    # Statistics (calculated on ALL reports, not filtered ones)
    stats = {
        'total_reports': all_reports.count(),
        'new_reports': all_reports.filter(status='pending').count(),
        'investigating': all_reports.filter(status='investigating').count(),
        'resolved': all_reports.filter(status='resolved').count(),
        'level_3': all_reports.filter(priority='level_3').count(),
    }
    
    # Get the latest report ID for initializing the notification system
    latest_report = all_reports.order_by('-id').first()
    initial_max_report_id = latest_report.id if latest_report else 0
    
    context = {
        'page_obj': page_obj,
        'stats': stats,
        'status_filter': status_filter,
        'priority_filter': priority_filter,
        'search_query': search_query,
        'community': community,
        'initial_max_report_id': initial_max_report_id,
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
        
        if status and status in [choice[0] for choice in SecurityReport.STATUS_CHOICES]:
            report.status = status
            if status == 'resolved':
                from django.utils import timezone
                report.resolved_at = timezone.now()
        
        if priority and priority in [choice[0] for choice in SecurityReport.PRIORITY_CHOICES]:
            report.priority = priority
        
        if security_notes is not None:
            report.security_notes = security_notes
        
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

@login_required
@require_http_methods(["GET"])
def check_new_reports(request):
    """Check for new reports since last_check_id - only for Security users"""
    # Only allow Security role users
    if not request.user.is_authenticated or request.user.role != 'security':
        return JsonResponse({'error': 'Security access required'}, status=403)
    
    # Check if notification sound is enabled
    notification_sound_enabled = request.user.notification_sound_enabled
    
    # Get user's community
    try:
        membership = CommunityMembership.objects.select_related('community').filter(user=request.user).first()
        if not membership or not membership.community:
            return JsonResponse({'error': 'No community access'}, status=403)
        community = membership.community
    except Exception as e:
        return JsonResponse({'error': f'Community access error: {str(e)}'}, status=403)
    
    # Get last checked report ID from request
    last_check_id = request.GET.get('last_check_id', 0)
    try:
        last_check_id = int(last_check_id)
    except (ValueError, TypeError):
        last_check_id = 0
    
    # Get new reports (reports with ID greater than last_check_id)
    new_reports = SecurityReport.objects.filter(
        community=community,
        id__gt=last_check_id
    ).order_by('-created_at')[:10]  # Limit to 10 most recent
    
    # Format new reports for response
    reports_data = []
    for report in new_reports:
        reports_data.append({
            'id': report.id,
            'priority': report.priority,
            'status': report.status,
            'subject': report.subject,
            'reporter': report.get_reporter_display(),
            'target': report.get_target_display(),
            'created_at': report.created_at.isoformat(),
        })
    
    # Get the highest report ID to send back for next check
    latest_report_id = SecurityReport.objects.filter(community=community).order_by('-id').first()
    current_max_id = latest_report_id.id if latest_report_id else 0
    
    return JsonResponse({
        'new_reports': reports_data,
        'current_max_id': current_max_id,
        'notification_sound_enabled': notification_sound_enabled,
        'has_new_reports': len(reports_data) > 0
    })
