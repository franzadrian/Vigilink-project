from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db import IntegrityError
from django.http import JsonResponse
from .models import User, City, District

def index(request):
    return render(request, 'accounts/index.html')

def register_view(request):
    # Get all cities for the dropdown
    cities = City.objects.all().order_by('name')
    
    if request.method == 'POST':
        # Get form data
        first_name = request.POST.get('firstName')
        middle_name = request.POST.get('middleName')
        # Convert middle name to initial if provided
        if middle_name:
            middle_initial = middle_name[0].upper() + '.'
        else:
            middle_initial = ''
        last_name = request.POST.get('lastName')
        username = request.POST.get('username')
        email = request.POST.get('email')
        password = request.POST.get('password')
        confirm_password = request.POST.get('confirmPassword')
        city_id = request.POST.get('city')
        district_id = request.POST.get('district')
        contact = request.POST.get('emergencyContact')
        
        # Validate form data
        if not all([first_name, last_name, username, email, password, confirm_password, city_id, district_id]):
            messages.error(request, 'Please fill in all required fields')
            return render(request, 'accounts/register.html', {'cities': cities})
        
        if password != confirm_password:
            messages.error(request, 'Passwords do not match')
            return render(request, 'accounts/register.html', {'cities': cities})
        
        try:
            # Get city and district objects
            city = City.objects.get(id=city_id)
            district = District.objects.get(id=district_id)
            
            # Validate that district belongs to selected city
            if district.city.id != city.id:
                messages.error(request, 'Selected district does not belong to the selected city')
                return render(request, 'accounts/register.html', {'cities': cities})
            
            # Create user
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=first_name,
                middle_name=middle_initial,
                last_name=last_name,
                city=city,
                district=district,
                contact=contact
            )
            messages.success(request, 'Account created successfully. Please log in.')
            return redirect('login')
        except City.DoesNotExist:
            messages.error(request, 'Selected city does not exist')
            return render(request, 'accounts/register.html', {'cities': cities})
        except District.DoesNotExist:
            messages.error(request, 'Selected district does not exist')
            return render(request, 'accounts/register.html', {'cities': cities})
        except IntegrityError:
            messages.error(request, 'Username already exists. Please choose a different one.')
            return render(request, 'accounts/register.html', {'cities': cities})
        except Exception as e:
            messages.error(request, f'An error occurred: {str(e)}')
            return render(request, 'accounts/register.html', {'cities': cities})
    
    return render(request, 'accounts/register.html', {'cities': cities})

def login_view(request):
    if request.method == 'POST':
        email_or_username = request.POST.get('email')
        password = request.POST.get('password')
        
        # Try to authenticate with username
        user = authenticate(request, username=email_or_username, password=password)
        
        # If authentication fails, try with email
        if user is None:
            try:
                user_obj = User.objects.get(email=email_or_username)
                user = authenticate(request, username=user_obj.username, password=password)
            except User.DoesNotExist:
                user = None
        
        if user is not None:
            login(request, user)
            return redirect('index')
        else:
            messages.error(request, 'Invalid credentials')
            return render(request, 'accounts/login.html')
    
    return render(request, 'accounts/login.html')

def logout_view(request):
    logout(request)
    return redirect('index')

def get_districts(request, city_id):
    """API endpoint to get districts for a selected city"""
    try:
        districts = District.objects.filter(city_id=city_id).values('id', 'name').order_by('name')
        return JsonResponse({'districts': list(districts)})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)
