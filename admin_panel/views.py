from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden, JsonResponse
from django.contrib.auth import authenticate, login, logout
from django.contrib import messages
from accounts.models import User
from django.core.paginator import Paginator
from django.db.models import Q
import json
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from admin_panel.models import ContactMessage

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
    
    # Base queryset: non-admin users, with related city/district to avoid N+1
    qs = (
        User.objects
        .select_related('city', 'district')
        .all()
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
    if role and role in ('guest', 'resident', 'community_owner', 'security', 'admin'):
        qs = qs.filter(role=role)

    # Exclude admins from list by default (template also guards)
    qs = qs.exclude(role='admin')

    # Server-side pagination
    page_number = request.GET.get('page') or 1
    try:
        page_number = int(page_number)
    except Exception:
        page_number = 1
    paginator = Paginator(qs.order_by('id'), 25)  # 25 per page
    page_obj = paginator.get_page(page_number)
    users = page_obj.object_list
    
    # Fetch all cities and districts for dropdowns
    from accounts.models import City, District
    cities = City.objects.all()
    districts = District.objects.all()
    
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
def admin_resident(request):
    # Check if user has admin role or is a superuser
    if request.user.role != 'admin' and not request.user.is_superuser:
        return HttpResponseForbidden("You don't have permission to access this page.")
    
    # Base queryset: non-admin users, with related city/district to avoid N+1
    qs = (
        User.objects
        .select_related('city', 'district')
        .all()
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
    if role and role in ('guest', 'resident', 'community_owner', 'security', 'admin'):
        qs = qs.filter(role=role)

    # Exclude admins from list by default (template also guards)
    qs = qs.exclude(role='admin')

    # Server-side pagination
    page_number = request.GET.get('page') or 1
    try:
        page_number = int(page_number)
    except Exception:
        page_number = 1
    paginator = Paginator(qs.order_by('id'), 25)  # 25 per page
    page_obj = paginator.get_page(page_number)
    users = page_obj.object_list
    
    # Fetch all cities and districts for dropdowns
    from accounts.models import City, District
    cities = City.objects.all()
    districts = District.objects.all()
    
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
            
            return JsonResponse({
                'status': 'success',
                'message': 'User deleted successfully'
            })
            
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)
    
    return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=405)

