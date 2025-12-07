from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from .models import User, City, District, IPLoginAttempt
from django.utils import timezone
import datetime
import random
import string
from django.views.decorators.http import require_POST, require_GET
from django.views.decorators.csrf import csrf_exempt
from django.core.mail import send_mail
from django.conf import settings
import logging
import traceback

# Set up logger
logger = logging.getLogger(__name__)

def send_password_reset_email(email, reset_url):
    """Send password reset link to user's email"""
    # Check if email is properly configured
    if not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD:
        raise ValueError("Email configuration is missing. Please set EMAIL_HOST_USER and EMAIL_HOST_PASSWORD environment variables.")
    
    subject = 'VigiLink - Password Reset Request'
    message = f"""You have requested to reset your password for your VigiLink account.

Please click the link below to reset your password:

{reset_url}

This link will expire in 24 hours.

If you did not request this password reset, please ignore this email.

Best regards,
The VigiLink Team
"""
    from_email = settings.EMAIL_HOST_USER
    recipient_list = [email]
    
    try:
        send_mail(subject, message, from_email, recipient_list, fail_silently=False)
        print(f"Password reset email sent to {email}")
    except Exception as e:
        # Re-raise the exception so the caller can handle it
        print(f"Error sending password reset email: {str(e)}")
        raise

def get_client_ip(request):
    """Get the client IP address from the request"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

def index(request):
    return render(request, 'accounts/index.html')

def register_view(request):
    try:
        # Get all cities for the dropdown
        cities = City.objects.all().order_by('name')
        if not cities.exists():
            logger.warning("No cities found in database. Registration may fail.")
            messages.warning(request, 'No cities available. Please contact support.')
    except Exception as e:
        logger.error(f"Error loading cities: {str(e)}\n{traceback.format_exc()}")
        messages.error(request, 'Unable to load registration form. Please try again later.')
        # Return empty cities list to prevent further errors
        cities = []
    
    if request.method == 'POST':
        # Get form data
        full_name = request.POST.get('fullName')
        username = request.POST.get('username')
        email = request.POST.get('email')
        password = request.POST.get('password')
        confirm_password = request.POST.get('confirmPassword')
        city_id = request.POST.get('city')
        district_id = request.POST.get('district')
        
        # Get emergency contact information (optional)
        contact = request.POST.get('emergencyContact')
        
        # Validate form data
        if not all([full_name, username, email, password, confirm_password, city_id, district_id]):
            messages.error(request, 'Please fill in all required fields')
            return render(request, 'accounts/register.html', {'cities': cities})
        
        # Validate full name length
        if len(full_name) < 4 or len(full_name) > 30:
            messages.error(request, 'Full name must be between 4 and 30 characters')
            return render(request, 'accounts/register.html', {'cities': cities})
        
        # Validate full name (only letters and spaces allowed)
        import re
        if not re.match(r'^[A-Za-z\s]+$', full_name):
            messages.error(request, 'Full name can only contain letters and spaces')
            return render(request, 'accounts/register.html', {'cities': cities})
        
        # Check if email already exists
        if User.objects.filter(email=email).exists():
            messages.error(request, 'This email is already registered. Please use a different email address.')
            return render(request, 'accounts/register.html', {'cities': cities})
        
        # Validate email domain
        valid_domains = [
            'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com',
            'icloud.com', 'protonmail.com', 'mail.com', 'zoho.com', 'yandex.com',
            'live.com', 'msn.com', 'me.com', 'gmx.com', 'mail.ru'
        ]
        
        email_domain = email.split('@')[-1].lower() if '@' in email else ''
        if email_domain not in valid_domains:
            messages.error(request, f'Please use a valid email domain. Accepted domains include: {", ".join(valid_domains)}')
            return render(request, 'accounts/register.html', {'cities': cities})

        # Validate emergency contact (optional): must be exactly 11 digits if provided
        if contact:
            if not re.match(r'^\d{11}$', contact.strip()):
                messages.error(request, 'Emergency contact must be exactly 11 digits and contain numbers only.')
                return render(request, 'accounts/register.html', {'cities': cities})

        if password != confirm_password:
            messages.error(request, 'Passwords do not match')
            return render(request, 'accounts/register.html', {'cities': cities})
        
        try:
            # Convert city_id and district_id to integers
            try:
                city_id_int = int(city_id)
                district_id_int = int(district_id)
            except (ValueError, TypeError):
                messages.error(request, 'Invalid city or district selected. Please try again.')
                return render(request, 'accounts/register.html', {'cities': cities})
            
            # Get city and district objects
            city = City.objects.get(id=city_id_int)
            district = District.objects.get(id=district_id_int)
            
            # Validate that district belongs to selected city
            if district.city.id != city.id:
                messages.error(request, 'Selected district does not belong to the selected city')
                return render(request, 'accounts/register.html', {'cities': cities})
            
            # Check if username already exists
            if User.objects.filter(username=username).exists():
                messages.error(request, 'Username already exists. Please choose a different one.')
                return render(request, 'accounts/register.html', {'cities': cities})
                
            # Store registration data in session for verification
            try:
                request.session['registration_data'] = {
                    'username': username,
                    'email': email,
                    'password': password,
                    'full_name': full_name,
                    'city_id': str(city_id_int),  # Store as string for consistency
                    'district_id': str(district_id_int),  # Store as string for consistency
                    'contact': contact
                }
                
                # Generate verification code
                verification_code = ''.join(random.choices(string.digits, k=6))
                request.session['verification_code'] = verification_code
                request.session['verification_code_created'] = timezone.now().isoformat()
            except Exception as session_error:
                logger.error(f"Error storing session data: {str(session_error)}\n{traceback.format_exc()}")
                messages.error(request, 'Unable to save registration data. Please try again.')
                return render(request, 'accounts/register.html', {'cities': cities})
            
            # Send verification email (handle errors gracefully)
            # Check if email is configured before attempting to send
            email_sent = False
            email_configured = bool(settings.EMAIL_HOST_USER and settings.EMAIL_HOST_PASSWORD)
            
            if email_configured:
                try:
                    # Log email configuration (without exposing password)
                    logger.info(f"Attempting to send verification email to {email} from {settings.EMAIL_HOST_USER}")
                    logger.debug(f"Email configured: USER={'SET' if settings.EMAIL_HOST_USER else 'NOT SET'}, PASSWORD={'SET' if settings.EMAIL_HOST_PASSWORD else 'NOT SET'}")
                    
                    # Send email - use fail_silently=False to get actual errors
                    # The custom TimeoutEmailBackend will timeout after 10 seconds
                    from django.core.mail import send_mail
                    result = send_mail(
                        'VigiLink - Email Verification Code',
                        f'Thank you for registering with VigiLink!\n\nTo complete your registration, please use the following verification code:\n\n{verification_code}\n\nThis code will expire in 10 minutes.\n\nIf you did not request this code, please ignore this email.\n\nBest regards,\nThe VigiLink Team',
                        settings.EMAIL_HOST_USER,
                        [email],
                        fail_silently=False  # Get actual errors
                    )
                    if result:
                        email_sent = True
                        logger.info(f"Verification email sent successfully to {email}")
                        # Clear any previous email failure flags
                        if 'email_send_failed' in request.session:
                            del request.session['email_send_failed']
                        if 'email_error' in request.session:
                            del request.session['email_error']
                    else:
                        # This shouldn't happen with fail_silently=False, but handle it
                        raise Exception("Email sending returned False")
                except Exception as email_error:
                    # Log the actual error for debugging
                    error_msg = str(email_error)
                    logger.error(f"Could not send verification email to {email}: {error_msg}\n{traceback.format_exc()}")
                    # Don't show code on page - just log the error
                    # User will need to use resend or contact support
                    request.session['email_send_failed'] = True
                    request.session['email_error'] = "Email service unavailable. Please try resending the code."
            else:
                # Email not configured - this is a configuration error
                logger.error("Email not configured - EMAIL_HOST_USER and EMAIL_HOST_PASSWORD must be set")
                request.session['email_send_failed'] = True
                request.session['email_error'] = "Email service not configured. Please contact support."
            
            # Redirect to verification page
            try:
                if email_sent:
                    messages.success(request, 'A verification code has been sent to your email. Please check your inbox.')
                return redirect('verify_email')
            except Exception as redirect_error:
                logger.error(f"Error redirecting to verify_email: {str(redirect_error)}\n{traceback.format_exc()}")
                messages.error(request, 'Registration successful but unable to redirect. Please try logging in.')
                return redirect('login')
            
        except City.DoesNotExist:
            logger.warning(f"City.DoesNotExist: city_id={city_id}")
            messages.error(request, 'Selected city does not exist')
            return render(request, 'accounts/register.html', {'cities': cities})
        except District.DoesNotExist:
            logger.warning(f"District.DoesNotExist: district_id={district_id}")
            messages.error(request, 'Selected district does not exist')
            return render(request, 'accounts/register.html', {'cities': cities})
        except ValueError as ve:
            # Handle invalid city_id or district_id (not integers)
            logger.error(f"ValueError in registration: {str(ve)}\n{traceback.format_exc()}")
            messages.error(request, 'Invalid city or district selected. Please try again.')
            return render(request, 'accounts/register.html', {'cities': cities})
        except Exception as e:
            # Log the full error for debugging
            logger.error(f"Unexpected error in registration: {str(e)}\n{traceback.format_exc()}")
            messages.error(request, f'An error occurred during registration. Please try again or contact support if the problem persists.')
            return render(request, 'accounts/register.html', {'cities': cities})
    
    # GET request - show registration form
    try:
        return render(request, 'accounts/register.html', {'cities': cities})
    except Exception as e:
        logger.error(f"Error rendering registration form: {str(e)}\n{traceback.format_exc()}")
        messages.error(request, 'Unable to load registration form. Please try again later.')
        return render(request, 'accounts/register.html', {'cities': []})


def send_verification_email(email, verification_code):
    """Send verification code to user's email"""
    
    # Check if email is properly configured - if not, skip sending
    if not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD:
        raise ValueError("Email configuration is missing. Please set EMAIL_HOST_USER and EMAIL_HOST_PASSWORD environment variables.")
    
    subject = 'VigiLink - Email Verification Code'
    message = f"""Thank you for registering with VigiLink!

To complete your registration, please use the following verification code:

{verification_code}

This code will expire in 10 minutes.

If you did not request this code, please ignore this email.

Best regards,
The VigiLink Team
"""
    from_email = settings.EMAIL_HOST_USER  # Use the configured email host user
    
    # Send to the actual email provided during registration
    recipient_list = [email]
    
    try:
        # Use fail_silently=True to prevent blocking on timeout/connection errors
        # The timeout is set in settings.EMAIL_TIMEOUT (default 5 seconds)
        result = send_mail(subject, message, from_email, recipient_list, fail_silently=True)
        if result:
            logger.info(f"Verification email sent to {email}")
        else:
            # If fail_silently=True returns False, it means sending failed
            raise Exception("Email sending failed silently - check email configuration")
    except Exception as e:
        # Log the error and re-raise so caller knows email failed
        logger.error(f"Error sending verification email to {email}: {str(e)}")
        raise

def login_view(request):
    # Clear any existing messages when loading the login page
    storage = messages.get_messages(request)
    for message in storage:
        pass  # This consumes the messages
    storage.used = True  # Mark the storage as used to clear all messages
    
    if request.method == 'POST':
        email_or_username = request.POST.get('email')
        password = request.POST.get('password')
        
        # Get client IP address
        client_ip = get_client_ip(request)
        
        # Check if IP is blocked
        ip_attempt, created = IPLoginAttempt.objects.get_or_create(ip_address=client_ip)
        
        if ip_attempt.is_blocked_now():
            time_msg = ip_attempt.get_remaining_time()
            messages.error(request, f'Too many failed login attempts from your IP address. Please try again in {time_msg}.')
            return render(request, 'accounts/login.html')
        
        # Allow any email domain on login; domain checks are enforced only on registration
        # (Do not block login attempts purely based on domain formatting.)
        
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
            # Check if user is verified
            if not user.is_verified:
                messages.error(request, 'Please verify your email address before logging in.')
                return render(request, 'accounts/login.html')
                
            # Reset login attempts for this IP on successful login
            ip_attempt.login_attempts = 0
            ip_attempt.is_blocked = False
            ip_attempt.save()
            
            login(request, user)
            return redirect('/user/dashboard/')
        else:
            # Increment login attempts for this IP
            ip_attempt.login_attempts += 1
            
            # Block IP after 5 failed attempts
            if ip_attempt.login_attempts >= 5:
                ip_attempt.is_blocked = True
                messages.error(request, 'Too many failed login attempts. Your IP has been temporarily blocked for 5 minutes.')
            else:
                remaining_attempts = 5 - ip_attempt.login_attempts
                messages.error(request, f'Invalid credentials. You have {remaining_attempts} attempt{"s" if remaining_attempts != 1 else ""} remaining before your IP is temporarily blocked.')
            
            ip_attempt.save()
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

@require_GET
def check_username(request):
    username = request.GET.get('username', '')
    if not username:
        return JsonResponse({'available': False, 'message': 'Username is required'})
    
    # Check if username exists
    exists = User.objects.filter(username=username).exists()
    
    if exists:
        return JsonResponse({'available': False, 'message': 'This username is already taken'})
    else:
        return JsonResponse({'available': True, 'message': 'Username is available'})

@require_GET
def check_email(request):
    email = request.GET.get('email', '')
    if not email:
        return JsonResponse({'available': False, 'message': 'Email is required'})
    
    # Check if email exists
    exists = User.objects.filter(email=email).exists()
    
    if exists:
        return JsonResponse({'available': False, 'message': 'This email is already registered'})
    else:
        return JsonResponse({'available': True, 'message': 'Email is available'})


def resend_verification_code(request):
    """Resend verification code to user's email"""
    # Check if registration data exists in session
    if 'registration_data' not in request.session:
        messages.error(request, 'Registration session expired or invalid. Please register again.')
        return redirect('register')
    
    # Get email from session
    email = request.session.get('registration_data', {}).get('email')
    if not email:
        messages.error(request, 'Email not found in session. Please register again.')
        return redirect('register')
    
    # Generate new verification code
    verification_code = ''.join(random.choices(string.digits, k=6))
    request.session['verification_code'] = verification_code
    request.session['verification_code_created'] = timezone.now().isoformat()
    
    # Send verification email (handle errors gracefully)
    email_configured = bool(settings.EMAIL_HOST_USER and settings.EMAIL_HOST_PASSWORD)
    email_sent = False
    
    if email_configured:
        try:
            # Send email with proper error handling
            from django.core.mail import send_mail
            result = send_mail(
                'VigiLink - Email Verification Code',
                f'Thank you for registering with VigiLink!\n\nTo complete your registration, please use the following verification code:\n\n{verification_code}\n\nThis code will expire in 10 minutes.\n\nIf you did not request this code, please ignore this email.\n\nBest regards,\nThe VigiLink Team',
                settings.EMAIL_HOST_USER,
                [email],
                fail_silently=False  # Get actual errors
            )
            if result:
                email_sent = True
                messages.success(request, 'A new verification code has been sent to your email.')
                # Clear the email failure flags
                if 'email_send_failed' in request.session:
                    del request.session['email_send_failed']
                if 'email_error' in request.session:
                    del request.session['email_error']
            else:
                raise Exception("Email sending returned False")
        except Exception as email_error:
            error_msg = str(email_error)
            logger.error(f"Error resending verification email to {email}: {error_msg}\n{traceback.format_exc()}")
            request.session['email_send_failed'] = True
            request.session['email_error'] = "Email service unavailable. Please try again or contact support."
            messages.error(request, 'Failed to send verification email. Please try again.')
    else:
        # Email not configured
        logger.error("Email not configured - EMAIL_HOST_USER and EMAIL_HOST_PASSWORD must be set")
        request.session['email_send_failed'] = True
        request.session['email_error'] = "Email service not configured. Please contact support."
        messages.error(request, 'Email service is not configured. Please contact support.')
    
    return redirect('verify_email')


def forgot_password(request):
    """Handle forgot password requests"""
    context = {}
    if request.method == 'POST':
        email = request.POST.get('email')
        
        # Check if user exists with this email
        user_exists = User.objects.filter(email=email).exists()
        
        if user_exists:
            # User exists, generate token and send email
            user = User.objects.get(email=email)
            
            # Generate a token (you would typically use a more secure method)
            token = ''.join(random.choices(string.ascii_letters + string.digits, k=32))
            
            # Store token in session for demo purposes (in production, store in database with expiry)
            request.session['reset_token'] = token
            request.session['reset_email'] = email
            request.session['reset_token_created'] = timezone.now().isoformat()
            
            # Send password reset email
            reset_url = request.build_absolute_uri(f'/accounts/reset-password/{token}/')
            try:
                send_password_reset_email(email, reset_url)
            except Exception as email_error:
                # Log the error but don't reveal it to the user (security best practice)
                print(f"Error sending password reset email: {str(email_error)}")
                # Still show success message to prevent user enumeration
        
        # Always show the same message whether the email exists or not
        # This prevents user enumeration attacks
        context['success_message'] = 'If an account with that email exists, we\'ve sent you a password reset link.'
    
    return render(request, 'accounts/forgot_password.html', context)

def reset_password(request, token):
    """Handle password reset"""
    # Check if token is valid
    stored_token = request.session.get('reset_token')
    stored_email = request.session.get('reset_email')
    token_created = request.session.get('reset_token_created')
    
    # Validate token
    if not all([stored_token, stored_email, token_created]) or stored_token != token:
        messages.error(request, 'Invalid or expired password reset link.')
        return redirect('login')
    
    # Check if token is expired (24 hours)
    if token_created:
        token_created = timezone.datetime.fromisoformat(token_created)
        if timezone.now() > token_created + datetime.timedelta(hours=24):
            messages.error(request, 'Password reset link has expired. Please request a new one.')
            return redirect('forgot_password')
    
    if request.method == 'POST':
        password = request.POST.get('password')
        confirm_password = request.POST.get('confirm-password')
        
        # Validate passwords
        if password != confirm_password:
            messages.error(request, 'Passwords do not match.')
            return render(request, 'accounts/reset_password.html', {'token': token})
        
        # Update user password
        try:
            user = User.objects.get(email=stored_email)
            user.set_password(password)
            user.save()
            
            # Clear session data
            if 'reset_token' in request.session:
                del request.session['reset_token']
            if 'reset_email' in request.session:
                del request.session['reset_email']
            if 'reset_token_created' in request.session:
                del request.session['reset_token_created']
            
            messages.success(request, 'Your password has been reset successfully. You can now log in with your new password.')
            return redirect('login')
        except User.DoesNotExist:
            messages.error(request, 'An error occurred. Please try again.')
            return redirect('forgot_password')
    
    return render(request, 'accounts/reset_password.html', {'token': token})

def verify_email(request):
    """Handle email verification"""
    # Check if verification data exists in session
    if 'verification_code' not in request.session or 'registration_data' not in request.session:
        messages.error(request, 'Verification session expired or invalid. Please register again.')
        return redirect('register')
    
    # Get verification code and check if email failed
    email_send_failed = request.session.get('email_send_failed', False)
    email_error = request.session.get('email_error', '')
    
    # Prepare context for template
    # Only show code in DEBUG mode for development - never in production
    context = {
        'verification_code': request.session.get('verification_code') if (email_send_failed and settings.DEBUG) else None,
        'email_send_failed': email_send_failed,
        'email_error': email_error,
        'show_code': email_send_failed and settings.DEBUG,  # Only show in development
    }
    
    if request.method == 'POST':
        # Get entered verification code
        entered_code = ''
        for i in range(1, 7):
            digit = request.POST.get(f'digit{i}', '')
            entered_code += digit
        
        stored_code = request.session.get('verification_code')
        verification_time = request.session.get('verification_code_created')
        
        # Check if verification code is expired (10 minutes)
        if verification_time:
            verification_time = timezone.datetime.fromisoformat(verification_time)
            if timezone.now() > verification_time + datetime.timedelta(minutes=10):
                messages.error(request, 'Verification code has expired. Please register again.')
                return redirect('register')
        
        # Check if verification code is correct
        if entered_code != stored_code:
            messages.error(request, 'Invalid verification code. Please try again.')
            return render(request, 'accounts/verification.html', context)
        
        # Get registration data from session
        registration_data = request.session.get('registration_data')
        
        try:
            with transaction.atomic():
                # Get city and district objects (convert to int since they're stored as strings)
                try:
                    city_id = int(registration_data.get('city_id'))
                    district_id = int(registration_data.get('district_id'))
                except (ValueError, TypeError) as ve:
                    logger.error(f"Invalid city_id or district_id in session: {str(ve)}")
                    messages.error(request, 'Invalid registration data. Please register again.')
                    return redirect('register')
                
                city = City.objects.get(id=city_id)
                district = District.objects.get(id=district_id)
                
                # Create user
                user = User.objects.create_user(
                    username=registration_data.get('username'),
                    email=registration_data.get('email'),
                    password=registration_data.get('password'),
                    full_name=registration_data.get('full_name'),
                    city=city,
                    district=district,
                    contact=registration_data.get('contact'),
                    is_verified=True
                    # profile_picture will use the default value from the model
                )
                
                # Clear session data
                if 'verification_code' in request.session:
                    del request.session['verification_code']
                if 'verification_code_created' in request.session:
                    del request.session['verification_code_created']
                if 'registration_data' in request.session:
                    del request.session['registration_data']
                
                messages.success(request, 'Email verified successfully. Your account has been created. Please log in.')
                return redirect('login')
        except Exception as e:
            logger.error(f"Error in verify_email POST: {str(e)}\n{traceback.format_exc()}")
            messages.error(request, f'An error occurred during verification: {str(e)}. Please try again or contact support.')
            return render(request, 'accounts/verification.html', context)
    
    # GET request - show verification form
    try:
        return render(request, 'accounts/verification.html', context)
    except Exception as e:
        logger.error(f"Error rendering verification form: {str(e)}\n{traceback.format_exc()}")
        messages.error(request, 'Unable to load verification page. Please try again.')
        return redirect('register')
