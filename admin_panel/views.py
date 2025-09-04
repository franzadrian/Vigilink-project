from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden, JsonResponse
from django.contrib.auth import authenticate, login, logout
from django.contrib import messages
from accounts.models import User, City, District
import json
from django.views.decorators.csrf import csrf_exempt

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
    
    # Fetch all users from the database
    users = User.objects.all()
    
    return render(request, 'admin_residents/admin_resident.html', {'users': users})

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
            
            # Store user info before deletion for response
            user_info = {
                'id': user.id,
                'name': user.full_name,
                'username': user.username,
                'email': user.email
            }
            
            # Delete the user
            user.delete()
            
            # Return success response with deleted user info
            return JsonResponse({
                'status': 'success',
                'message': 'User deleted successfully',
                'user': user_info
            })
            
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)
    
    return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=405)

@login_required
def get_cities_districts(request):
    # Check if user has admin role or is a superuser
    if request.user.role != 'admin' and not request.user.is_superuser:
        return JsonResponse({'status': 'error', 'message': 'Permission denied'}, status=403)
    
    # Get all cities
    cities = City.objects.all().order_by('name')
    cities_data = [{'id': city.id, 'name': city.name} for city in cities]
    
    # Get all districts with their city information
    districts = District.objects.all().order_by('name')
    districts_data = [{
        'id': district.id, 
        'name': district.name, 
        'city_id': district.city.id,
        'city_name': district.city.name
    } for district in districts]
    
    return JsonResponse({
        'status': 'success',
        'cities': cities_data,
        'districts': districts_data
    })
