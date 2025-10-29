from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden, JsonResponse
from django.contrib.auth import authenticate, login, logout
from django.contrib import messages
from accounts.models import User
from django.core.paginator import Paginator
from django.db.models import Q
from django.urls import reverse
import json
import re
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from admin_panel.models import ContactMessage, Resource
from django.core.cache import cache

# Create your views here.
@login_required
def admin_dashboard(request):
    # Check if user has admin role or is a superuser
    if request.user.role != 'admin' and not request.user.is_superuser:
        return HttpResponseForbidden("You don't have permission to access this page.")
    
    return render(request, 'admin_dashboard/admin_dashboard.html')

@login_required
def admin_resident(request):
    # Check if user has admin role or is a superuser
    if request.user.role != 'admin' and not request.user.is_superuser:
        return HttpResponseForbidden("You don't have permission to access this page.")
    
    # Optimized queryset with better select_related and only necessary fields
    qs = (
        User.objects
        .select_related('city', 'district')
        .only('id', 'full_name', 'username', 'email', 'address', 'block', 'lot', 'role', 'date_joined', 'contact', 'city__name', 'district__name')
        .exclude(role='admin')
    )

    # Optional search (q) and role filter
    q = (request.GET.get('q') or '').strip()
    role = (request.GET.get('role') or '').strip().lower()
    
    if q:
        qs = qs.filter(
            Q(full_name__icontains=q) |
            Q(username__icontains=q) |
            Q(email__icontains=q) |
            Q(address__icontains=q) |
            Q(city__name__icontains=q) |
            Q(district__name__icontains=q)
        )
    
    if role and role in ('guest', 'resident', 'community_owner', 'security'):
        qs = qs.filter(role=role)

    # Optimized ordering and pagination
    qs = qs.order_by('id')
    
    # Server-side pagination with smaller page size for better performance
    page_number = request.GET.get('page') or 1
    try:
        page_number = int(page_number)
    except Exception:
        page_number = 1
    
    paginator = Paginator(qs, 10)  # Set to 10 per page as requested
    page_obj = paginator.get_page(page_number)
    users = page_obj.object_list
    
    # Cache cities and districts - only fetch if needed for editing
    from accounts.models import City, District
    
    # Use cache for cities and districts to avoid repeated queries
    cities = cache.get('admin_cities')
    if cities is None:
        cities = list(City.objects.only('name').order_by('name'))
        cache.set('admin_cities', cities, 300)  # Cache for 5 minutes
    
    districts = cache.get('admin_districts')
    if districts is None:
        districts = list(District.objects.select_related('city').only('name', 'city__name').order_by('name'))
        cache.set('admin_districts', districts, 300)  # Cache for 5 minutes
    
    return render(request, 'admin_residents/admin_resident.html', {
        'users': users,
        'page_obj': page_obj,
        'paginator': paginator,
        'total_count': paginator.count,
        'q': q,
        'role_filter': role,
        'cities': cities,
        'districts': districts,
    })

def admin_index(request):
    # This view is accessible to anyone
    return render(request, 'admin_dashboard/admin_index.html')

def admin_login(request):
    # This view is accessible to anyone, but only admins/superusers can successfully log in
    if request.user.is_authenticated and (request.user.role == 'admin' or request.user.is_superuser):
        return redirect('admin_panel:admin_dashboard')
    
    if request.method == 'POST':
        email_or_username = request.POST.get('email')
        password = request.POST.get('password')
        
        # Try to authenticate with username
        user = authenticate(request, username=email_or_username, password=password)
        
        # If authentication fails, try with email
        if user is None:
            try:
                from accounts.models import User
                user_obj = User.objects.get(email=email_or_username)
                user = authenticate(request, username=user_obj.username, password=password)
            except User.DoesNotExist:
                user = None
        
        if user is not None:
            # Check if user is verified
            if not user.is_verified:
                messages.error(request, 'Please verify your email address before logging in.')
                return render(request, 'admin_dashboard/admin_login.html')
            
            # Check if user is admin or superuser
            if user.role == 'admin' or user.is_superuser:
                login(request, user)
                return redirect('admin_panel:admin_dashboard')
            else:
                messages.error(request, 'You do not have permission to access the admin dashboard.')
                return render(request, 'admin_dashboard/admin_login.html')
        else:
            messages.error(request, 'Invalid username/email or password.')
            return render(request, 'admin_dashboard/admin_login.html')
    
    return render(request, 'admin_dashboard/admin_login.html')

def admin_logout(request):
    # Custom logout view that redirects to admin login page
    logout(request)
    return redirect('admin_panel:admin_login')

@login_required
@csrf_exempt
def update_user(request):
    # Check if user has admin role or is a superuser
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Permission denied'}, status=403)
    
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            user_id = data.get('user_id')
            user = get_object_or_404(User, id=user_id)
            
            # Update user fields
            user.full_name = data.get('name', user.full_name)
            user.username = data.get('username', user.username)
            user.email = data.get('email', user.email)
            user.contact = data.get('contact', user.contact)  # Changed from phone_number to contact
            user.address = data.get('address', user.address)
            user.block = data.get('block', user.block)
            user.lot = data.get('lot', user.lot)
            
            # Handle role update
            role = data.get('role', '').lower()
            if role in ['guest', 'resident', 'community_owner', 'security']:
                user.role = role
            
            # Handle city and district (these might be foreign keys)
            # This is a simplified approach - you might need to adjust based on your model
            if 'city' in data and data['city']:
                from accounts.models import City
                try:
                    city = City.objects.get(name=data['city'])
                    user.city = city
                except City.DoesNotExist:
                    pass
                    
            if 'district' in data and data['district']:
                from accounts.models import District
                try:
                    district = District.objects.get(name=data['district'])
                    user.district = district
                except District.DoesNotExist:
                    pass
            
            user.save()
            
            # Clear cache when user is updated
            cache.delete('admin_cities')
            cache.delete('admin_districts')
            
            # Return the updated user data in the response
            return JsonResponse({
                'status': 'success',
                'user': {
                    'id': user.id,
                    'name': user.full_name,
                    'username': user.username,
                    'email': user.email,
                    'contact': user.contact,
                    'address': user.address,
                    'city': user.city.name if user.city else '',
                    'district': user.district.name if user.district else '',
                    'block': user.block,
                    'lot': user.lot,
                    'role': user.role
                }
            })
            
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)
    
    return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=405)

@login_required
def admin_communication(request):
    # Check if user has admin role or is a superuser
    if request.user.role != 'admin' and not request.user.is_superuser:
        return HttpResponseForbidden("You don't have permission to access this page.")
    
    # Get all contact messages, ordering unread messages first, then by creation date
    from .models import ContactMessage
    from django.db.models import Case, When, BooleanField
    
    # Order by is_read (False first), then by created_at (newest first)
    contact_messages = ContactMessage.objects.all().order_by('is_read', '-created_at')
    
    context = {
        'contact_messages': contact_messages
    }
    
    return render(request, 'admin_communication/admin_communication.html', context)

@login_required
def get_new_messages(request):
    """API endpoint to fetch new messages for real-time updates"""
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Permission denied'}, status=403)
    
    # Get the last timestamp from the request, if provided
    last_timestamp = request.GET.get('last_timestamp', None)
    
    # Base query for unread messages
    query = ContactMessage.objects.filter(is_read=False)
    
    # If last_timestamp is provided, only get messages newer than that timestamp
    if last_timestamp and last_timestamp != 'null' and last_timestamp != '0':
        from django.utils import timezone
        import datetime
        
        try:
            # Convert timestamp to datetime
            timestamp_float = float(last_timestamp) / 1000.0  # Convert from milliseconds to seconds
            last_datetime = datetime.datetime.fromtimestamp(timestamp_float, tz=timezone.get_current_timezone())
            
            # Only get messages created after the last timestamp
            query = query.filter(created_at__gt=last_datetime)
        except (ValueError, TypeError):
            # If timestamp conversion fails, ignore the filter
            pass
    
    # Get the filtered messages, ordered by creation date (newest first)
    unread_messages = query.order_by('-created_at')
    
    # Format messages for JSON response
    messages_data = [{
        'id': msg.contact_id,
        'name': msg.name,
        'email': msg.email,
        'subject': msg.subject,
        'message': msg.message,
        'created_at': msg.created_at.strftime('%Y-%m-%d %H:%M:%S'),
        'is_read': msg.is_read
    } for msg in unread_messages]
    
    # Get total unread count (not just filtered by timestamp)
    total_unread_count = ContactMessage.objects.filter(is_read=False).count()
    
    return JsonResponse({
        'status': 'success',
        'unread_count': total_unread_count,
        'messages': messages_data
    })


@login_required
def get_message_details(request, message_id):
    """Get message details API endpoint"""
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Permission denied'}, status=403)
    try:
        message = ContactMessage.objects.get(contact_id=message_id)
        is_registered = message.user is not None
        return JsonResponse({
            'status': 'success',
            'message': message.message,
            'email': message.email,
            'is_registered': is_registered,
            'user_id': message.user_id
        })
    except ContactMessage.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Message not found'}, status=404)

@login_required
@require_POST
def mark_message_read(request, message_id):
    """Mark a message as read"""
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Permission denied'}, status=403)
    
    try:
        message = ContactMessage.objects.get(contact_id=message_id)
        message.is_read = True
        message.save()
        return JsonResponse({'status': 'success'})
    except ContactMessage.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Message not found'}, status=404)

@login_required
@require_POST
def delete_message(request, message_id):
    """Delete a message"""
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Permission denied'}, status=403)
    
    try:
        message = ContactMessage.objects.get(contact_id=message_id)
        message.delete()
        return JsonResponse({'status': 'success'})
    except ContactMessage.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Message not found'}, status=404)

@login_required
def get_unread_count(request):
    """API endpoint to fetch only the unread message count"""
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Permission denied'}, status=403)
    
    # Get total unread count
    total_unread_count = ContactMessage.objects.filter(is_read=False).count()
    
    return JsonResponse({
        'status': 'success',
        'unread_count': total_unread_count
    })

@login_required
def get_contact_type_for_user(request, user_id):
    """Return the latest contact request type for a given user."""
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Permission denied'}, status=403)
    try:
        msg = ContactMessage.objects.filter(user_id=user_id).order_by('-created_at').first()
        if not msg:
            return JsonResponse({'status': 'success', 'type': 'General Inquiry'})
        subj = (msg.subject or '').strip().lower()
        if 'feedback' in subj:
            ctype = 'Feedback'
        elif 'report' in subj:
            ctype = 'Reports'
        elif 'inquiry' in subj or 'enquiry' in subj:
            ctype = 'General Inquiry'
        else:
            ctype = 'General Inquiry'
        return JsonResponse({'status': 'success', 'type': ctype, 'subject': msg.subject, 'created_at': msg.created_at.strftime('%Y-%m-%d %H:%M:%S')})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

@login_required
def get_done_messages(request):
    """Return list of done (read) contact messages for inbox view."""
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Permission denied'}, status=403)
    try:
        qs = ContactMessage.objects.filter(is_read=True).order_by('-created_at')[:200]
        data = []
        for m in qs:
            subj = (m.subject or '').strip().lower()
            if 'feedback' in subj:
                ctype = 'Feedback'
            elif 'report' in subj:
                ctype = 'Reports'
            elif 'inquiry' in subj or 'enquiry' in subj:
                ctype = 'General Inquiry'
            else:
                ctype = 'General Inquiry'
            data.append({
                'id': m.contact_id,
                'user_id': m.user_id,
                'name': m.name,
                'subject': m.subject,
                'message': m.message,
                'type': ctype,
                'created_at': m.created_at.strftime('%Y-%m-%dT%H:%M:%S')
            })
        return JsonResponse({'status': 'success', 'items': data})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

@login_required
@require_POST
def mark_contact_done_for_user(request, user_id):
    """Mark all contact requests for a specific user as done (read)."""
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Permission denied'}, status=403)
    try:
        updated = ContactMessage.objects.filter(user_id=user_id, is_read=False).update(is_read=True)
        return JsonResponse({'status': 'success', 'updated': updated})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

@login_required
@csrf_exempt
def delete_user(request):
    # Check if user has admin role or is a superuser
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Permission denied'}, status=403)
    
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            user_id = data.get('user_id')
            user = get_object_or_404(User, id=user_id)
            
            # Delete the user
            user.delete()
            
            # Clear cache when user is deleted
            cache.delete('admin_cities')
            cache.delete('admin_districts')
            
            return JsonResponse({
                'status': 'success',
                'message': 'User deleted successfully'
            })
            
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)
    
    return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=405)

@login_required
def admin_resources(request):
    """Admin resources page for uploading PDFs and creating text guides"""
    # Check if user has admin role or is a superuser
    if request.user.role != 'admin' and not request.user.is_superuser:
        return HttpResponseForbidden("You don't have permission to access this page.")
    
    if request.method == 'POST':
        try:
            title = request.POST.get('title', '').strip()
            description = request.POST.get('description', '').strip()
            resource_type = request.POST.get('resource_type', '')
            content = request.POST.get('content', '').strip()
            
            if not title:
                messages.error(request, 'Title is required.')
                return redirect('admin_panel:admin_resources')
            
            if resource_type not in ['pdf', 'image', 'video', 'link']:
                messages.error(request, 'Invalid resource type.')
                return redirect('admin_panel:admin_resources')
            
            # Get additional fields
            external_urls = request.POST.getlist('external_urls[]')
            external_url = external_urls[0] if external_urls else ''
            
            # Validate external URLs for link type
            if resource_type == 'link':
                if not external_urls or not external_urls[0]:
                    messages.error(request, 'At least one external URL is required for links.')
                    return redirect('admin_panel:admin_resources')
                
                # Basic URL validation
                for url in external_urls:
                    if url and not url.startswith(('http://', 'https://')):
                        messages.error(request, f'Please enter a valid URL: {url}')
                        return redirect('admin_panel:admin_resources')

            # Handle multiple URLs for links
            if resource_type == 'link':
                # Store all URLs as JSON in external_url field
                import json
                all_urls = [url for url in external_urls if url]
                if len(all_urls) > 1:
                    # Store as JSON array
                    final_external_url = json.dumps(all_urls)
                else:
                    # Store single URL as string
                    final_external_url = all_urls[0] if all_urls else ''
                final_description = description
            else:
                final_external_url = None
                final_description = description
            
            # Create resource
            resource = Resource.objects.create(
                title=title,
                description=final_description,
                resource_type=resource_type,
                external_url=final_external_url,
                created_by=request.user
            )
            
            # Handle file upload for PDFs, images, and videos
            if resource_type in ['pdf', 'image', 'video'] and 'file' in request.FILES:
                files = request.FILES.getlist('file')
                
                if resource_type == 'image' and len(files) > 1:
                    # For multiple images, create separate resources with group identifier
                    import uuid
                    group_id = str(uuid.uuid4())
                    for i, file in enumerate(files):
                        # Create individual resource for each image
                        image_resource = Resource.objects.create(
                            title=f"{title} (Image {i+1})" if len(files) > 1 else title,
                            description=description,
                            resource_type=resource_type,
                            file=file,
                            created_by=request.user
                        )
                        # Add group_id to the resource's description for grouping (hidden from display)
                        image_resource.description = f"{description}\n[GROUP_ID:{group_id}]" if description else f"[GROUP_ID:{group_id}]"
                        image_resource.save()
                else:
                    # For single files (PDF, video, or single image)
                    resource.file = files[0]
                    resource.save()

            # Determine success message based on file count
            if resource_type == 'image' and 'file' in request.FILES:
                files = request.FILES.getlist('file')
                if len(files) > 1:
                    success_message = f'{len(files)} images uploaded successfully!'
                else:
                    success_message = f'Resource "{title}" created successfully!'
            else:
                success_message = f'Resource "{title}" created successfully!'
            
            if request.headers.get('Content-Type') == 'application/json' or request.headers.get('Accept') == 'application/json':
                return JsonResponse({
                    'status': 'success', 
                    'message': success_message,
                    'redirect_url': reverse('admin_panel:admin_resources')
                })
            else:
                messages.success(request, success_message)
                return redirect('admin_panel:admin_resources')

        except Exception as e:
            if request.headers.get('Content-Type') == 'application/json' or request.headers.get('Accept') == 'application/json':
                return JsonResponse({'status': 'error', 'message': f'Error creating resource: {str(e)}'}, status=400)
            else:
                messages.error(request, f'Error creating resource: {str(e)}')
                return redirect('admin_panel:admin_resources')
    
    # Get all resources
    all_resources = Resource.objects.filter(is_active=True).order_by('-created_at')
    
    # Group multiple images - only show the first image of each group
    resources = []
    processed_groups = set()
    
    for resource in all_resources:
        # Check if this is part of a group
        if (resource.resource_type == 'image' and 
            resource.description and 
            '[GROUP_ID:' in resource.description):
            
            # Extract group ID
            group_id = resource.description.split('[GROUP_ID:')[1].split(']')[0]
            
            if group_id not in processed_groups:
                # This is the first image in a group, add it to resources
                processed_groups.add(group_id)
                resources.append(resource)
            # Skip other images in the same group
        else:
            # Not part of a group, add normally
            resources.append(resource)
    
    # Pagination
    page_number = request.GET.get('page') or 1
    try:
        page_number = int(page_number)
    except Exception:
        page_number = 1
    
    paginator = Paginator(resources, 4)
    page_obj = paginator.get_page(page_number)
    
    return render(request, 'admin_resources/admin_resources.html', {
        'resources': page_obj,
        'page_obj': page_obj,
        'paginator': paginator,
        'total_count': paginator.count,
    })

@login_required
@require_POST
def delete_resource(request, resource_id):
    """Delete a resource"""
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Permission denied'}, status=403)

    try:
        resource = get_object_or_404(Resource, id=resource_id)
        resource.is_active = False
        resource.save()
        return JsonResponse({'status': 'success', 'message': 'Resource deleted successfully'})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

@login_required
@require_POST
def delete_resource_by_title(request, title):
    """Delete a resource by title"""
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Permission denied'}, status=403)

    try:
        from urllib.parse import unquote
        # Decode URL-encoded title
        decoded_title = unquote(title)
        
        resource = get_object_or_404(Resource, title=decoded_title, is_active=True)
        resource.is_active = False
        resource.save()

        return JsonResponse({
            'status': 'success',
            'message': 'Resource deleted successfully!'
        })

    except Resource.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Resource not found'}, status=404)
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

@login_required
def edit_resource(request, resource_id):
    """Edit a resource - GET request shows edit form, POST updates resource"""
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Permission denied'}, status=403)

    try:
        resource = get_object_or_404(Resource, id=resource_id, is_active=True)
        
        if request.method == 'POST':
            try:
                title = request.POST.get('title', '').strip()
                description = request.POST.get('description', '').strip()
                resource_type = request.POST.get('resource_type', '')
                content = request.POST.get('content', '').strip()
                
                # Get multiple external URLs
                external_urls = request.POST.getlist('external_urls[]')
                external_url = external_urls[0] if external_urls else ''

                if not title:
                    return JsonResponse({'status': 'error', 'message': 'Title is required.'}, status=400)

                if resource_type not in ['pdf', 'image', 'video', 'link']:
                    return JsonResponse({'status': 'error', 'message': 'Invalid resource type.'}, status=400)
                
                # Validate external URLs for link type
                if resource_type == 'link':
                    if not external_urls or not external_urls[0]:
                        return JsonResponse({'status': 'error', 'message': 'At least one external URL is required for links.'}, status=400)
                    
                    # Basic URL validation
                    for url in external_urls:
                        if url and not url.startswith(('http://', 'https://')):
                            return JsonResponse({'status': 'error', 'message': f'Please enter a valid URL: {url}'}, status=400)

                # Update resource fields
                resource.title = title
                resource.resource_type = resource_type
                
                # Handle multiple URLs for links
                if resource_type == 'link':
                    # Store all URLs as JSON in external_url field
                    import json
                    all_urls = [url for url in external_urls if url]
                    if len(all_urls) > 1:
                        # Store as JSON array
                        resource.external_url = json.dumps(all_urls)
                    else:
                        # Store single URL as string
                        resource.external_url = all_urls[0] if all_urls else ''
                    resource.description = description
                else:
                    resource.external_url = None
                    resource.description = description

                # Handle file upload for PDFs, images, and videos
                if resource_type in ['pdf', 'image', 'video'] and 'file' in request.FILES:
                    files = request.FILES.getlist('file')

                    # If editing an image resource, ensure new images are grouped with the existing one
                    if resource_type == 'image':
                        import uuid
                        # Extract existing group id from description if present
                        existing_group_id = None
                        if resource.description and '[GROUP_ID:' in resource.description:
                            try:
                                existing_group_id = resource.description.split('[GROUP_ID:')[1].split(']')[0]
                            except Exception:
                                existing_group_id = None

                        # If no group id, create one and attach it to the current resource
                        if not existing_group_id:
                            existing_group_id = str(uuid.uuid4())
                            resource.description = f"{description}\n[GROUP_ID:{existing_group_id}]" if description else f"[GROUP_ID:{existing_group_id}]"
                            resource.save()

                        # Count existing images in the group to continue numbering
                        existing_group_images = Resource.objects.filter(
                            is_active=True,
                            resource_type='image',
                            description__contains=f"[GROUP_ID:{existing_group_id}]"
                        ).count()

                        # Create individual resources for each newly uploaded image in the same group
                        for idx, uploaded_file in enumerate(files, start=1):
                            image_index = existing_group_images + idx
                            image_resource = Resource.objects.create(
                                title=f"{title} (Image {image_index})",
                                description=f"{description}\n[GROUP_ID:{existing_group_id}]" if description else f"[GROUP_ID:{existing_group_id}]",
                                resource_type='image',
                                file=uploaded_file,
                                created_by=request.user
                            )
                            image_resource.save()
                    else:
                        # For single files (PDF or video), create a new resource alongside existing
                        for uploaded_file in files:
                            Resource.objects.create(
                                title=title,
                                description=description,
                                resource_type=resource_type,
                                file=uploaded_file,
                                created_by=request.user
                            )

                resource.save()

                return JsonResponse({
                    'status': 'success', 
                    'message': f'Resource "{title}" updated successfully!',
                    'redirect_url': reverse('admin_panel:admin_resources')
                })

            except Exception as e:
                return JsonResponse({'status': 'error', 'message': f'Error updating resource: {str(e)}'}, status=400)

        # GET request - return resource data for editing
        return JsonResponse({
            'status': 'success',
            'resource': {
                'id': resource.id,
                'title': resource.title,
                'description': resource.description,
                'resource_type': resource.resource_type,
                'external_url': resource.external_url,
                'file_url': resource.file.url if resource.file else None,
            }
        })

    except Resource.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Resource not found'}, status=404)
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

@login_required
def get_group_count(request, base_title):
    """Get the count of images in a group"""
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'error': 'Permission denied'}, status=403)
    
    try:
        from urllib.parse import unquote
        # Decode URL-encoded title
        base_title = unquote(base_title)
        
        # First try to find by GROUP_ID if the base_title contains it
        group_id = None
        if '[GROUP_ID:' in base_title:
            try:
                group_id = base_title.split('[GROUP_ID:')[1].split(']')[0]
            except:
                pass
        
        if group_id:
            # Find all images with the same GROUP_ID
            images = Resource.objects.filter(
                resource_type='image',
                description__contains=f'[GROUP_ID:{group_id}]',
                is_active=True
            ).order_by('created_at')
        else:
            # Fallback to old method - find all images with the same base title pattern
            images = Resource.objects.filter(
                resource_type='image',
                title__startswith=base_title,
                title__contains='(Image',
                is_active=True
            ).order_by('title')
        
        image_data = []
        for img in images:
            # Extract image number from title
            match = re.match(r'^.*\(Image\s+(\d+)\)$', img.title)
            if match:
                index = int(match.group(1)) - 1
            else:
                # If no match, use the order in the queryset
                index = len(image_data)
            
            image_data.append({
                'url': img.file.url if img.file else '',
                'title': img.title,
                'index': index
            })
        
        return JsonResponse({
            'count': len(image_data),
            'images': image_data
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
