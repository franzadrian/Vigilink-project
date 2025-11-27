from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Q, Case, When, IntegerField
from .models import SecurityReport, VisitorLog
from communityowner_panel.models import CommunityProfile, CommunityMembership
from accounts.models import User
from user_panel.models import Message
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
    # Order by status (pending first, then investigating), then False Alarm and Resolved by date (newest first)
    reports = all_reports.annotate(
        status_priority=Case(
            When(status='pending', then=1),
            When(status='investigating', then=2),
            When(status='false_alarm', then=3),
            When(status='resolved', then=3),  # Same priority as false_alarm so they're ordered by date
            default=5,
            output_field=IntegerField(),
        )
    ).order_by('status_priority', '-created_at')
    
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
    paginator = Paginator(reports, 10)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    
    # Statistics (calculated on ALL reports, not filtered ones)
    stats = {
        'total_reports': all_reports.count(),
        'new_reports': all_reports.filter(status='pending').count(),
        'false_alarm': all_reports.filter(status='false_alarm').count(),
        'resolved': all_reports.filter(status='resolved').count(),
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
        
        if status and status in [choice[0] for choice in SecurityReport.STATUS_CHOICES]:
            report.status = status
            if status == 'resolved':
                from django.utils import timezone
                report.resolved_at = timezone.now()
        
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

@login_required
def visitor_logs(request):
    """Visitor log management page"""
    community, error = _ensure_security_user(request)
    if error:
        return error
    
    # Get all visitor logs for this community
    # Prioritize "visiting" status first, then order by entry_time
    visitor_logs_qs = VisitorLog.objects.filter(community=community).select_related('visiting_resident', 'logged_by').annotate(
        status_priority=Case(
            When(status='visiting', then=1),
            When(status='returned', then=2),
            default=3,
            output_field=IntegerField(),
        )
    ).order_by('status_priority', '-entry_time')
    
    # Filtering
    status_filter = request.GET.get('status', '')
    search_query = request.GET.get('search', '').strip()
    
    if status_filter:
        visitor_logs_qs = visitor_logs_qs.filter(status=status_filter)
    
    if search_query:
        visitor_logs_qs = visitor_logs_qs.filter(
            Q(visitor_name__icontains=search_query) |
            Q(visiting_resident__full_name__icontains=search_query) |
            Q(visiting_resident__username__icontains=search_query)
        )
    
    # Get all residents for the form dropdown
    residents = User.objects.filter(
        community_membership__community=community
    ).exclude(role='security').order_by('full_name', 'username')
    
    # Statistics
    stats = {
        'total_visitors': VisitorLog.objects.filter(community=community).count(),
        'currently_visiting': VisitorLog.objects.filter(community=community, status='visiting').count(),
        'returned': VisitorLog.objects.filter(community=community, status='returned').count(),
    }
    
    # Get currently visiting visitors (for summary card) - latest 5
    currently_visiting_list = VisitorLog.objects.filter(
        community=community,
        status='visiting'
    ).select_related('visiting_resident').order_by('-entry_time')[:5]
    
    # Get recently returned visitors (last 5, for summary card)
    recently_returned_list = VisitorLog.objects.filter(
        community=community,
        status='returned'
    ).select_related('visiting_resident').order_by('-exit_time')[:5]
    
    # Pagination
    paginator = Paginator(visitor_logs_qs, 10)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    
    context = {
        'page_obj': page_obj,
        'stats': stats,
        'status_filter': status_filter,
        'search_query': search_query,
        'community': community,
        'residents': residents,
        'currently_visiting_list': currently_visiting_list,
        'recently_returned_list': recently_returned_list,
    }
    
    return render(request, 'security_panel/visitor_logs.html', context)

@login_required
@require_http_methods(["POST"])
def create_visitor_log(request):
    """Create a new visitor log entry"""
    community, error = _ensure_security_user(request)
    if error:
        return error
    
    try:
        visitor_name = request.POST.get('visitor_name', '').strip()
        resident_id = request.POST.get('visiting_resident', '')
        id_image = request.FILES.get('id_image')
        
        if not visitor_name:
            messages.error(request, 'Visitor name is required.')
            return redirect('security_panel:visitor_logs')
        
        if not resident_id:
            messages.error(request, 'Please select a resident being visited.')
            return redirect('security_panel:visitor_logs')
        
        try:
            resident = User.objects.get(id=resident_id, community_membership__community=community)
        except User.DoesNotExist:
            messages.error(request, 'Invalid resident selected.')
            return redirect('security_panel:visitor_logs')
        
        # Create visitor log
        visitor_log = VisitorLog.objects.create(
            visitor_name=visitor_name,
            visiting_resident=resident,
            id_image=id_image,
            community=community,
            logged_by=request.user,
            status='visiting'
        )
        
        # Send automatic message to the resident about the visitor
        try:
            message_text = f"You have a visitor: {visitor_name}"
            Message.objects.create(
                sender=request.user,
                receiver=resident,
                message=message_text
            )
        except Exception as e:
            # Log error but don't fail the visitor log creation
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to send visitor notification message: {str(e)}")
        
        messages.success(request, f'Visitor log created for {visitor_name}.')
        return redirect('security_panel:visitor_logs')
    
    except Exception as e:
        messages.error(request, f'Error creating visitor log: {str(e)}')
        return redirect('security_panel:visitor_logs')

@login_required
@require_http_methods(["POST"])
def update_visitor_status(request, log_id):
    """Update visitor status (mark as returned)"""
    community, error = _ensure_security_user(request)
    if error:
        return error
    
    visitor_log = get_object_or_404(VisitorLog, id=log_id, community=community)
    
    try:
        visitor_log.mark_as_returned()
        messages.success(request, f'{visitor_log.visitor_name} has been marked as returned.')
        return redirect('security_panel:visitor_logs')
    except Exception as e:
        messages.error(request, f'Error updating visitor status: {str(e)}')
        return redirect('security_panel:visitor_logs')
