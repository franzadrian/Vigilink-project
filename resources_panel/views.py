from django.shortcuts import render, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db.models import Q
from django.http import HttpResponse, FileResponse, JsonResponse
from django.template.loader import render_to_string
from admin_panel.models import Resource
import os
import re
import logging
from urllib.parse import quote

logger = logging.getLogger(__name__)

@login_required
def resources(request):
    """User-facing resources page to view resources created by admins"""
    # Get user's community
    from communityowner_panel.models import CommunityProfile, CommunityMembership
    from accounts.models import LocationEmergencyContact
    user_community = None
    mem = CommunityMembership.objects.select_related('community').filter(user=request.user).first()
    if mem and mem.community:
        user_community = mem.community
    else:
        # If user is a community owner, use their community profile
        try:
            if getattr(request.user, 'role', '') == 'communityowner':
                owner_cp = CommunityProfile.objects.filter(owner=request.user).first()
                if owner_cp:
                    user_community = owner_cp
        except Exception:
            pass
    
    # Check if user is part of a community - show not_member.html if not
    if not user_community:
        # Get location emergency contacts for guest users
        location_contacts = []
        try:
            if hasattr(request.user, 'city') and request.user.city:
                location_contacts = LocationEmergencyContact.objects.filter(
                    city=request.user.city
                ).values('label', 'phone')
        except Exception:
            location_contacts = []
        
        # Check if user is a guest or community owner without a community profile
        user_role = getattr(request.user, 'role', '')
        is_guest = user_role == 'guest'
        is_community_owner = user_role == 'communityowner'
        has_community_profile = False
        has_active_trial = False
        has_ever_had_trial = False
        
        if is_community_owner:
            try:
                has_community_profile = CommunityProfile.objects.filter(owner=request.user).exists()
            except Exception:
                pass
        
        # Check if user has an active trial subscription or has ever had a trial
        try:
            if hasattr(request.user, 'subscription'):
                subscription = request.user.subscription
                subscription.check_and_update_status()
                has_active_trial = subscription.is_active() and subscription.is_trial
                # Check if they've ever had a trial (even if expired)
                has_ever_had_trial = subscription.is_trial
        except Exception:
            pass
        
        return render(request, 'resident/not_member.html', {
            'reason': 'no_membership',
            'location_contacts': location_contacts,
            'page_type': 'resources',
            'is_guest': is_guest,
            'is_community_owner': is_community_owner,
            'has_community_profile': has_community_profile,
            'has_active_trial': has_active_trial,
            'has_ever_had_trial': has_ever_had_trial,
        }, status=403)
    
    # Get search query and filter type
    search_query = request.GET.get('search', '').strip()
    filter_type = request.GET.get('type', 'all')
    
    # Get all active resources that are either:
    # 1. Public (community is None) OR
    # 2. Assigned to the user's community
    # Use select_related for optimization
    # Note: user_community is guaranteed to exist at this point due to check above
    base_queryset = Resource.objects.filter(is_active=True).filter(
        Q(community__isnull=True) | Q(community=user_community)
    ).select_related('created_by', 'community').order_by('-created_at')
    
    # Apply search filter
    if search_query:
        base_queryset = base_queryset.filter(title__icontains=search_query)
    
    # Apply resource type filter
    if filter_type != 'all' and filter_type in ['image', 'video', 'link', 'document']:
        base_queryset = base_queryset.filter(resource_type=filter_type)
    
    # Group multiple images - only show the first image of each group
    # This needs to be done before pagination to get accurate counts
    all_resources = list(base_queryset)
    resources_list = []
    processed_groups = set()
    
    for resource in all_resources:
        # Check if this is part of a group
        if (resource.resource_type == 'image' and 
            resource.description and 
            '[GROUP_ID:' in resource.description):
            
            # Extract group ID
            try:
                group_id = resource.description.split('[GROUP_ID:')[1].split(']')[0]
                
                if group_id not in processed_groups:
                    # This is the first image in a group, add it to resources
                    processed_groups.add(group_id)
                    resources_list.append(resource)
                # Skip other images in the same group
            except Exception:
                # If we can't extract group ID, add it normally
                resources_list.append(resource)
        else:
            # Not part of a group, add normally
            resources_list.append(resource)
    
    # Pagination
    page_number = request.GET.get('page') or 1
    try:
        page_number = int(page_number)
    except Exception:
        page_number = 1
    
    paginator = Paginator(resources_list, 4)  # Show 4 resources per page for users
    page_obj = paginator.get_page(page_number)
    
    # Pre-generate URLs for resources on this page only (before template rendering)
    # This batches URL generation and uses caching to avoid repeated API calls
    resource_urls = {}
    resource_group_ids = {}  # Store group IDs for grouped images
    resource_group_counts = {}  # Store group counts for grouped images
    
    # First, get all group IDs and their counts
    group_counts = {}
    for resource in all_resources:
        if (resource.resource_type == 'image' and 
            resource.description and 
            '[GROUP_ID:' in resource.description):
            try:
                group_id = resource.description.split('[GROUP_ID:')[1].split(']')[0]
                if group_id not in group_counts:
                    # Count all images in this group
                    # Note: user_community is guaranteed to exist at this point
                    count = Resource.objects.filter(
                        is_active=True,
                        resource_type='image',
                        description__contains=f'[GROUP_ID:{group_id}]'
                    ).filter(
                        Q(community__isnull=True) | Q(community=user_community)
                    ).count()
                    group_counts[group_id] = count
            except Exception:
                pass
    
    for resource in page_obj:
        if resource.file and resource.file.name:
            try:
                # Generate URL once - this will cache it for 1 hour
                url = resource.file.url
                if url:
                    resource_urls[resource.id] = url
            except Exception as e:
                logger.error(f"Error generating URL for resource {resource.id}: {e}", exc_info=True)
                resource_urls[resource.id] = ''
        else:
            resource_urls[resource.id] = ''
        
        # Extract group ID if this is a grouped image
        if (resource.resource_type == 'image' and 
            resource.description and 
            '[GROUP_ID:' in resource.description):
            try:
                group_id = resource.description.split('[GROUP_ID:')[1].split(']')[0]
                resource_group_ids[resource.id] = group_id
                # Store the count for this group
                if group_id in group_counts:
                    resource_group_counts[resource.id] = group_counts[group_id]
            except Exception:
                pass
    
    context = {
        'resources': page_obj,
        'page_obj': page_obj,
        'paginator': paginator,
        'total_count': paginator.count,
        'search_query': search_query,
        'filter_type': filter_type,
        'resource_urls': resource_urls,  # Pre-generated URLs to avoid multiple API calls
        'resource_group_ids': resource_group_ids,  # Group IDs for grouped images
        'resource_group_counts': resource_group_counts,  # Group counts for grouped images
    }
    
    # Check if this is an AJAX request
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        # Return only the resources container HTML for AJAX requests
        resources_html = render_to_string('resources/resources_partial.html', context, request=request)
        return HttpResponse(resources_html)
    
    return render(request, 'resources/resources.html', context)

@login_required
def download_resource(request, resource_id):
    """Download a resource file with custom filename (title + date)"""
    resource = get_object_or_404(Resource, id=resource_id, is_active=True)
    
    # Check if user has access to this resource
    from communityowner_panel.models import CommunityProfile, CommunityMembership
    user_community = None
    mem = CommunityMembership.objects.select_related('community').filter(user=request.user).first()
    if mem and mem.community:
        user_community = mem.community
    else:
        # If user is a community owner, use their community profile
        try:
            if getattr(request.user, 'role', '') == 'communityowner':
                owner_cp = CommunityProfile.objects.filter(owner=request.user).first()
                if owner_cp:
                    user_community = owner_cp
        except Exception:
            pass
    
    # Check if resource is accessible (public or user's community)
    if resource.community and resource.community != user_community:
        return HttpResponse("You don't have permission to access this resource", status=403)
    
    if not resource.file:
        return HttpResponse("File not found", status=404)
    
    try:
        # Open the file from Dropbox storage
        file_obj = resource.file.open('rb')
        
        # Get original file extension
        original_filename = resource.file.name
        file_ext = os.path.splitext(original_filename)[1] or ''
        
        # Clean title for filename (remove special characters, replace spaces with underscores)
        clean_title = re.sub(r'[^\w\s-]', '', resource.title)
        clean_title = re.sub(r'[-\s]+', '_', clean_title)
        clean_title = clean_title.strip('_')
        
        # Format date as YYYY-MM-DD
        date_str = resource.created_at.strftime('%Y-%m-%d')
        
        # Create custom filename: title_date.extension
        custom_filename = f"{clean_title}_{date_str}{file_ext}"
        
        # Create response with file
        response = FileResponse(file_obj, content_type='application/octet-stream')
        response['Content-Disposition'] = f'attachment; filename="{custom_filename}"; filename*=UTF-8\'\'{quote(custom_filename)}'
        
        return response
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error downloading resource {resource_id}: {e}", exc_info=True)
        return HttpResponse(f"Error downloading file: {str(e)}", status=500)

@login_required
def get_group_images(request, group_id):
    """Get all images in a group for the image modal"""
    # Get user's community
    from communityowner_panel.models import CommunityProfile, CommunityMembership
    user_community = None
    mem = CommunityMembership.objects.select_related('community').filter(user=request.user).first()
    if mem and mem.community:
        user_community = mem.community
    else:
        try:
            if getattr(request.user, 'role', '') == 'communityowner':
                owner_cp = CommunityProfile.objects.filter(owner=request.user).first()
                if owner_cp:
                    user_community = owner_cp
        except Exception:
            pass
    
    # Check if user is part of a community
    if not user_community:
        return JsonResponse({
            'status': 'error',
            'message': 'You must be a member of a community to access resources.'
        }, status=403)
    
    # Get all images in this group that the user can access
    group_resources = Resource.objects.filter(
        is_active=True,
        resource_type='image',
        description__contains=f'[GROUP_ID:{group_id}]'
    ).filter(
        Q(community__isnull=True) | Q(community=user_community)
    ).order_by('id')
    
    images = []
    for resource in group_resources:
        try:
            url = resource.file.url if resource.file else None
            if url:
                images.append({
                    'url': url,
                    'title': resource.title.replace(' (Image ', ' (').replace(')', '') if ' (Image ' in resource.title else resource.title
                })
        except Exception as e:
            logger.error(f"Error getting URL for resource {resource.id}: {e}")
    
    return JsonResponse({
        'status': 'success',
        'images': images
    })
