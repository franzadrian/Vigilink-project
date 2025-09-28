from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, JsonResponse, HttpResponseForbidden, HttpResponseBadRequest
from django.views.decorators.http import require_POST, require_GET
from django.contrib import messages
from django.contrib.auth import update_session_auth_hash
from django.db import models
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from .models import Post, PostReaction, PostReply, PostImage, Message  # PostShare removed
from accounts.models import User
import logging
import json
import requests
import base64
import os
import uuid
from django.utils import timezone
from django.utils.html import escape
from django.utils.safestring import mark_safe

# Set up logging
logger = logging.getLogger(__name__)

# PayPal API Configuration
PAYPAL_CLIENT_ID = "ASK5CmbwHCxQ_LcKuW3IO3TnGeGqDRLnc00vPUMR4_iwZFfcEdnAZnRLzWu3jRxjAgx4VSToPBA4ZBQS"
PAYPAL_CLIENT_SECRET = "EIJWooCierps6iLQQSRND8Bj1aS6xDhIUByyt_hstwx8F2s0jfJo6GR0g4e05ixK2cVfL_9vcoPm-hqS"
PAYPAL_BASE_URL = "https://api-m.sandbox.paypal.com"

def about(request):
    """About page view"""
    return render(request, 'informational page/about.html')

@login_required
def communication(request):
    """Communication page view"""
    # Get all messages for the current user (sent or received)
    user_messages = Message.objects.filter(
        models.Q(sender=request.user) | models.Q(receiver=request.user)
    ).order_by('-sent_at')
    
    # Get all users for the new message form
    users = User.objects.exclude(id=request.user.id)
    
    context = {
        'user_messages': user_messages,
        'users': users
    }
    return render(request, 'communication/user_communications.html', context)

@login_required
def chat_messages(request):
    """Chat messages page view"""
    # Get user_id from query parameters
    user_id = request.GET.get('user_id')
    user_name = request.GET.get('user_name', 'User')
    
    context = {
        'receiver_id': user_id,
        'receiver_name': user_name
    }
    
    return render(request, 'communication/chat_messages.html', context)

@login_required
def global_user_search(request):
    """Search for users globally by name, username, or email"""
    search_term = request.GET.get('term', '').strip()
    
    if len(search_term) < 2:
        return JsonResponse([], safe=False)
    
    # Search for users by name, username, or email
    users = User.objects.filter(
        models.Q(full_name__icontains=search_term) | 
        models.Q(username__icontains=search_term) | 
        models.Q(email__icontains=search_term)
    ).exclude(id=request.user.id)[:10]  # Limit to 10 results
    
    # Format results for JSON response
    results = []
    for user in users:
        results.append({
            'id': user.id,
            'name': user.full_name or user.username,
            'username': user.username,
            'email': user.email,
            'avatar': user.profile_picture.url if user.profile_picture else None
        })
    
    return JsonResponse(results, safe=False)

@login_required
@require_POST
def send_message(request):
    """Handle sending a new message"""
    if request.method == 'POST':
        receiver_id = request.POST.get('receiver')
        message_text = request.POST.get('message')
        
        if not receiver_id or not message_text:
            return JsonResponse({'status': 'error', 'message': 'Receiver and message are required'}, status=400)
        
        try:
            receiver = User.objects.get(id=receiver_id)
            
            # Create and save the message
            message = Message(
                sender=request.user,
                receiver=receiver,
                message=message_text
            )
            message.save()
            
            return JsonResponse({
                'status': 'success',
                'message': 'Message sent successfully',
                'data': {
                    'message_id': message.message_id,
                    'sender': request.user.username,
                    'receiver': receiver.username,
                    'sent_at': message.sent_at.strftime('%b %d, %Y, %I:%M %p')
                }
            })
        except User.DoesNotExist:
            return JsonResponse({'status': 'error', 'message': 'Receiver not found'}, status=404)
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
    
    return JsonResponse({'status': 'error', 'message': 'Invalid request'}, status=400)

@login_required
def mark_message_read(request, message_id):
    """Mark a message as read"""
    try:
        message = Message.objects.get(message_id=message_id, receiver=request.user)
        message.is_read = True
        message.save()
        return JsonResponse({'status': 'success'})
    except Message.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Message not found'}, status=404)

@login_required
def search_users(request):
    """Search users by email or full name"""
    if request.method == 'GET':
        search_term = request.GET.get('term', '').strip()
        if len(search_term) < 2:
            return JsonResponse({'users': []})
        
        # Search for users by email or full name
        users = User.objects.filter(
            models.Q(email__icontains=search_term) | 
            models.Q(full_name__icontains=search_term) |
            models.Q(username__icontains=search_term)
        ).exclude(id=request.user.id)[:10]  # Limit to 10 results
        
        # Format user data for response
        user_data = [
            {
                'id': user.id,
                'full_name': user.full_name,
                'username': user.username,
                'email': user.email
            }
            for user in users
        ]
        
        return JsonResponse({'users': user_data})
    
    return JsonResponse({'status': 'error', 'message': 'Invalid request method'})

def contact(request):
    """Contact page view"""
    return render(request, 'informational page/contact.html')

from django.contrib import messages
from admin_panel.models import ContactMessage

def contact_submit(request):
    """Handle contact form submission"""
    if request.method == 'POST':
        name = request.POST.get('name')
        email = request.POST.get('email')
        subject = request.POST.get('subject')
        message = request.POST.get('message')
        
        # Validate form data
        if not all([name, email, subject, message]):
            messages.error(request, 'Please fill in all required fields')
            return redirect('user_panel:contact')
        
        # Create contact message
        contact_message = ContactMessage(
            name=name,
            email=email,
            subject=subject,
            message=message,
            user=request.user if request.user.is_authenticated else None
        )
        contact_message.save()
        
        # Custom success messages based on subject
        if subject == 'General Inquiry':
            messages.success(request, 'Thank you for your inquiry! We will provide you with all the information you need as soon as possible.')
        elif subject == 'Feedback':
            messages.success(request, 'Thank you for your feedback! Your insights are valuable and help us improve our services.')
        elif subject == 'Report an Issue':
            messages.success(request, 'Thank you for reporting this issue! We will investigate and address it promptly.')
        else:
            messages.success(request, 'Your message has been sent successfully. We will get back to you soon!')
            
        return redirect('user_panel:contact')
    
    return redirect('user_panel:contact')

def pricing(request):
    """Pricing page view"""
    return render(request, 'informational page/pricing.html')

def terms(request):
    """Terms of Service page view"""
    return render(request, 'informational page/terms.html')


def get_paypal_access_token():
    """Get PayPal OAuth 2.0 access token"""
    try:
        url = f"{PAYPAL_BASE_URL}/v1/oauth2/token"
        headers = {
            "Accept": "application/json",
            "Accept-Language": "en_US"
        }
        auth = base64.b64encode(f"{PAYPAL_CLIENT_ID}:{PAYPAL_CLIENT_SECRET}".encode()).decode()
        headers["Authorization"] = f"Basic {auth}"
        
        data = {"grant_type": "client_credentials"}
        
        response = requests.post(url, headers=headers, data=data)
        response_data = response.json()
        
        return response_data.get("access_token")
    except Exception as e:
        logger.error(f"Error getting PayPal access token: {str(e)}")
        return None


@login_required
def payment(request):
    """Payment page view"""
    # Get plan type from query parameters (standard or premium)
    plan_type = request.GET.get('plan', 'standard')
    billing_cycle = request.GET.get('cycle', 'monthly')
    
    # Set price based on plan type and billing cycle
    price = 0
    if plan_type == 'standard':
        price = 14400 if billing_cycle == 'yearly' else 1500
    elif plan_type == 'premium':
        price = 28800 if billing_cycle == 'yearly' else 3000
    
    context = {
        'plan_type': plan_type,
        'billing_cycle': billing_cycle,
        'price': price,
        'client_id': PAYPAL_CLIENT_ID
    }
    
    return render(request, 'payment/payment.html', context)


@login_required
@csrf_exempt
def create_payment(request):
    """Create a PayPal payment"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    try:
        data = json.loads(request.body)
        plan_type = data.get('plan_type', 'standard')
        billing_cycle = data.get('billing_cycle', 'monthly')
        
        # Set price based on plan type and billing cycle
        price = 0
        if plan_type == 'standard':
            price = 14400 if billing_cycle == 'yearly' else 1500
        elif plan_type == 'premium':
            price = 28800 if billing_cycle == 'yearly' else 3000
        
        # Get access token
        access_token = get_paypal_access_token()
        if not access_token:
            return JsonResponse({'error': 'Failed to authenticate with PayPal'}, status=500)
        
        # Create order
        url = f"{PAYPAL_BASE_URL}/v2/checkout/orders"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token}"
        }
        
        payload = {
            "intent": "CAPTURE",
            "purchase_units": [
                {
                    "amount": {
                        "currency_code": "PHP",
                        "value": str(price)
                    },
                    "description": f"VigiLink {plan_type.capitalize()} Plan - {billing_cycle.capitalize()}"
                }
            ],
            "application_context": {
                "return_url": request.build_absolute_uri('/user/payment/success/'),
                "cancel_url": request.build_absolute_uri('/user/payment/cancel/')
            }
        }
        
        response = requests.post(url, headers=headers, json=payload)
        response_data = response.json()
        
        if response.status_code == 201:  # Created
            # Store order ID in session for later use
            request.session['paypal_order_id'] = response_data.get('id')
            request.session['plan_type'] = plan_type
            request.session['billing_cycle'] = billing_cycle
            
            # Return the approval URL to redirect the user
            for link in response_data.get('links', []):
                if link.get('rel') == 'approve':
                    return JsonResponse({'approval_url': link.get('href')})
        
        return JsonResponse({'error': 'Failed to create PayPal order', 'details': response_data}, status=response.status_code)
    
    except Exception as e:
        logger.error(f"Error creating PayPal payment: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)


@login_required
@csrf_exempt
def capture_payment(request):
    """Capture an approved PayPal payment"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    try:
        data = json.loads(request.body)
        order_id = data.get('order_id') or request.session.get('paypal_order_id')
        
        if not order_id:
            return JsonResponse({'error': 'Order ID is required'}, status=400)
        
        # Get access token
        access_token = get_paypal_access_token()
        if not access_token:
            return JsonResponse({'error': 'Failed to authenticate with PayPal'}, status=500)
        
        # Capture order
        url = f"{PAYPAL_BASE_URL}/v2/checkout/orders/{order_id}/capture"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token}"
        }
        
        response = requests.post(url, headers=headers)
        response_data = response.json()
        
        if response.status_code in [200, 201]:  # Success
            # Here you would update the user's subscription in your database
            # For now, we'll just return success
            return JsonResponse({
                'success': True,
                'transaction_id': response_data.get('id'),
                'status': response_data.get('status')
            })
        
        return JsonResponse({'error': 'Failed to capture PayPal payment', 'details': response_data}, status=response.status_code)
    
    except Exception as e:
        logger.error(f"Error capturing PayPal payment: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)


@login_required
def payment_success(request):
    """Payment success page"""
    # Get order ID from query parameters
    order_id = request.GET.get('token') or request.session.get('paypal_order_id')
    plan_type = request.session.get('plan_type', 'standard')
    billing_cycle = request.session.get('billing_cycle', 'monthly')
    
    if not order_id:
        messages.error(request, 'Payment information not found.')
        return redirect('user_panel:dashboard')
    
    # Set price based on plan type and billing cycle
    price = 0
    if plan_type == 'standard':
        price = 14400 if billing_cycle == 'yearly' else 1500
    elif plan_type == 'premium':
        price = 28800 if billing_cycle == 'yearly' else 3000
    
    context = {
        'order_id': order_id,
        'plan_type': plan_type,
        'billing_cycle': billing_cycle,
        'price': price
    }
    
    # Clear session data
    if 'paypal_order_id' in request.session:
        del request.session['paypal_order_id']
    if 'plan_type' in request.session:
        del request.session['plan_type']
    if 'billing_cycle' in request.session:
        del request.session['billing_cycle']
    
    return render(request, 'payment/success.html', context)


@login_required
def payment_cancel(request):
    """Payment cancelled page"""
    # Clear session data
    if 'paypal_order_id' in request.session:
        del request.session['paypal_order_id']
    if 'plan_type' in request.session:
        del request.session['plan_type']
    if 'billing_cycle' in request.session:
        del request.session['billing_cycle']
    
    # Removed the 'Payment was cancelled.' message
    return redirect('user_panel:pricing')

def privacy(request):
    """Privacy Policy page view"""
    return render(request, 'informational page/privacy.html')

# Create your views here.
@login_required
def dashboard(request):
    logger.info(f"Dashboard view accessed by user: {request.user.username}")
    try:
        # Get search parameters
        search_query = request.GET.get('search', '')
        location_filter = request.GET.get('location', 'everyone')
        
        # Start with all posts
        posts_query = Post.objects.all()
        
        # Apply search filter if provided
        if search_query:
            # Search by username or full_name (partial match)
            posts_query = posts_query.filter(
                models.Q(user__username__icontains=search_query) |
                models.Q(user__full_name__icontains=search_query)
            )
        
        # Apply location filter if set to 'local'
        if location_filter == 'local' and request.user.city and request.user.district:
            # Filter posts by users from the same city and district
            posts_query = posts_query.filter(
                user__city=request.user.city,
                user__district=request.user.district
            )
        
        # Order by most recent first
        posts = posts_query.order_by('-uploaded_at')
        
        # Enhance posts with reaction and reply data
        for post in posts:
            # Check if user has reacted to this post
            post.user_reacted = post.reactions.filter(user=request.user).exists()
            # Count reactions and replies
            post.reaction_count = post.reactions.count()
            post.reply_count = post.replies.count()
            # share_count removed
        
        # Check if search returned no results
        no_results = False
        if search_query and not posts.exists():
            no_results = True
            no_results_message = f"No posts found from users matching '{search_query}'."
        
        context = {
            'posts': posts,
            'search_query': search_query,
            'location_filter': location_filter,
            'no_results': no_results,
            'no_results_message': no_results_message if 'no_results_message' in locals() else ''
        }
        
        # Check if this is an AJAX request
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            # For AJAX requests, only render the posts container partial template
            response = render(request, 'dashboard/posts_container.html', context)
            # Add debugging header
            response['Content-Type'] = 'text/html; charset=utf-8'
            return response
        else:
            # For regular requests, render the full page
            return render(request, 'dashboard/dashboard.html', context)
    except Exception as e:
        logger.error(f"Error rendering dashboard: {str(e)}")
        return HttpResponse(f"Error loading dashboard: {str(e)}")

@login_required
def create_post(request):
    if request.method == 'POST':
        try:
            message = request.POST.get('message', '')
            
            # Create the post
            post = Post.objects.create(
                user=request.user,
                message=message
            )
            
            logger.info(f"Post created: {post.post_id}")
            
            # Handle multiple image uploads
            images = request.FILES.getlist('images')
            image_count = 0
            
            if images:
                for image in images:
                    # Limit to 20 images per post
                    if image_count >= 20:
                        break
                        
                    try:
                        post_image = PostImage.objects.create(
                            post=post,
                            image=image
                        )
                        image_count += 1
                        logger.info(f"Image uploaded for post {post.post_id}: {image.name}, ID: {post_image.image_id}")
                    except Exception as img_error:
                        logger.error(f"Error uploading image {image.name}: {str(img_error)}")
                
                logger.info(f"Total {image_count} images uploaded for post {post.post_id}")
            
            messages.success(request, 'Post created successfully!')
            return redirect('user_panel:dashboard')
        except Exception as e:
            logger.error(f"Error creating post: {str(e)}")
            messages.error(request, f"Error creating post: {str(e)}")
    
    return render(request, 'dashboard/create_post.html')

@login_required
@require_POST
def react_to_post(request, post_id):
    post = get_object_or_404(Post, post_id=post_id)
    
    # Check if user already reacted to this post
    reaction, created = PostReaction.objects.get_or_create(user=request.user, post=post)
    
    if not created:
        # User already reacted, so remove the reaction
        reaction.delete()
        return JsonResponse({'status': 'removed', 'count': post.reactions.count()})
    
    return JsonResponse({'status': 'added', 'count': post.reactions.count()})

@login_required
@require_POST
def reply_to_post(request, post_id):
    post = get_object_or_404(Post, post_id=post_id)
    
    # Check if the request has JSON content
    if request.content_type == 'application/json':
        try:
            data = json.loads(request.body)
            message = data.get('message', '')
        except json.JSONDecodeError:
            return JsonResponse({'status': 'error', 'message': 'Invalid JSON data'}, status=400)
    else:
        # Handle form data
        message = request.POST.get('message', '')
    
    if not message or not message.strip():
        return JsonResponse({'status': 'error', 'message': 'Reply cannot be empty'}, status=400)
    
    # Create reply
    reply = PostReply.objects.create(
        user=request.user,
        post=post,
        message=message
    )
    
    # Get user profile picture URL if available
    profile_picture_url = None
    if request.user.profile_picture and hasattr(request.user.profile_picture, 'url'):
        profile_picture_url = request.user.profile_picture.url
    
    # Get updated reply count
    reply_count = post.replies.count()
    
    return JsonResponse({
        'status': 'success',
        'reply_id': reply.reply_id,
        'username': request.user.username,
        'full_name': request.user.full_name or request.user.username,
        'user_profile_picture': profile_picture_url,
        'message': reply.message,
        'created_at': reply.created_at.isoformat(),
        'reply_count': reply_count,
        'is_author': True
    })

# share_post view function removed

@login_required
def view_post(request, post_id):
    post = get_object_or_404(Post, post_id=post_id)
    replies = post.replies.all().order_by('created_at')
    
    # Check if user has reacted to this post
    user_reacted = post.reactions.filter(user=request.user).exists()
    
    context = {
        'post': post,
        'replies': replies,
        'user_reacted': user_reacted,
        'reaction_count': post.reactions.count()
        # share_count removed
    }
    
    return render(request, 'dashboard/view_post.html', context)

@login_required
def get_post_replies(request, post_id):
    """API endpoint to get replies for a post"""
    try:
        post = get_object_or_404(Post, post_id=post_id)
        replies = post.replies.all().order_by('created_at')
        
        # Format replies for JSON response
        replies_data = []
        for reply in replies:
            # Ensure profile picture has a default value
            profile_picture_url = '/static/accounts/images/profile.png'  # Default image
            if reply.user.profile_picture and hasattr(reply.user.profile_picture, 'url'):
                profile_picture_url = reply.user.profile_picture.url
            
            # Check if the current user is the author of this reply
            is_author = reply.user == request.user
                
            replies_data.append({
                'reply_id': reply.reply_id,
                'username': reply.user.username,
                'full_name': reply.user.full_name,
                'user_profile_picture': profile_picture_url,
                'message': reply.message,
                'created_at': reply.created_at.strftime('%Y-%m-%d %H:%M'),
                'is_author': is_author
            })
        
        return JsonResponse({'status': 'success', 'replies': replies_data})
    except Exception as e:
        logger.error(f"Error fetching replies for post {post_id}: {str(e)}")
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

@login_required
def view_profile(request, user_id=None):
    """View user profile"""
    try:
        # If user_id is provided, show that user's profile, otherwise show the current user's profile
        if user_id:
            profile_user = get_object_or_404(User, id=user_id)
        else:
            profile_user = request.user
            
        # Check if the current user is viewing their own profile
        is_own_profile = profile_user.id == request.user.id
        
        context = {
            'user': profile_user,
            'is_own_profile': is_own_profile
        }
        return render(request, 'dashboard/view_profile.html', context)
    except Exception as e:
        logger.error(f"Error rendering profile view: {str(e)}")
        return HttpResponse(f"Error loading profile: {str(e)}")

@login_required
def edit_profile(request):
    """Edit user profile"""
    context = {
        'user': request.user
    }
    
    try:
        if request.method == 'POST':
            # Get form data
            username = request.POST.get('username', '').strip()
            full_name = request.POST.get('full_name', '').strip()
            contact = request.POST.get('contact', '').strip()
            address = request.POST.get('address', '').strip()
            block = request.POST.get('block', '').strip()
            lot = request.POST.get('lot', '').strip()
            about = request.POST.get('about', '').strip()
            
            # Validate full name
            if not full_name:
                context['full_name_error'] = 'Full name cannot be empty.'
                return render(request, 'dashboard/edit_profile.html', context)
            
            # Check if full name is between 7-20 characters
            if len(full_name) < 7 or len(full_name) > 20:
                context['full_name_error'] = 'Full name must be between 7-20 characters long.'
                return render(request, 'dashboard/edit_profile.html', context)
            
            # Check if full name contains numbers
            if any(char.isdigit() for char in full_name):
                context['full_name_error'] = 'Full name cannot contain numbers.'
                return render(request, 'dashboard/edit_profile.html', context)
            
            # Check if full name contains special characters
            if not all(char.isalpha() or char.isspace() for char in full_name):
                context['full_name_error'] = 'Full name cannot contain special characters.'
                return render(request, 'dashboard/edit_profile.html', context)
            
            # Check if username is changed and validate it
            if username != request.user.username:
                # Check if username is empty
                if not username:
                    context['username_error'] = 'Username cannot be empty.'
                    return render(request, 'dashboard/edit_profile.html', context)
                
                # Check if username contains spaces
                if ' ' in username:
                    context['username_error'] = 'Username cannot contain spaces.'
                    return render(request, 'dashboard/edit_profile.html', context)
                
                # Check if username length is between 6 and 15 characters
                if len(username) < 6 or len(username) > 15:
                    context['username_error'] = 'Username must be between 6 and 15 characters long.'
                    return render(request, 'dashboard/edit_profile.html', context)
                
                # Check if username contains only letters and numbers
                if not username.isalnum():
                    context['username_error'] = 'Username can only contain letters and numbers.'
                    return render(request, 'dashboard/edit_profile.html', context)
                
                # Check if username already exists
                if User.objects.filter(username=username).exists():
                    context['username_error'] = 'This username is already taken. Please choose another one.'
                    return render(request, 'dashboard/edit_profile.html', context)
            
            # Update user profile
            user = request.user
            user.username = username
            user.full_name = full_name
            user.contact = contact
            user.address = address
            user.block = block
            user.lot = lot
            user.about = about
            
            # Handle profile picture upload
            if 'profile_picture' in request.FILES:
                user.profile_picture = request.FILES['profile_picture']
                
            user.save()
            
            messages.success(request, 'Profile updated successfully!')
            return redirect('user_panel:view_profile')
        
        # For GET requests, render the edit profile form
        return render(request, 'dashboard/edit_profile.html', context)
    except Exception as e:
        logger.error(f"Error editing profile: {str(e)}")
        messages.error(request, f"Error updating profile: {str(e)}")
        return redirect('user_panel:view_profile')

@login_required
def change_password(request):
    """Change user password"""
    context = {}
    try:
        if request.method == 'POST':
            # Get form data
            current_password = request.POST.get('current_password')
            new_password = request.POST.get('new_password')
            confirm_password = request.POST.get('confirm_password')
            
            # Validate current password
            user = request.user
            if not user.check_password(current_password):
                context['current_password_error'] = 'Current password is incorrect.'
                return render(request, 'dashboard/change_password.html', context)
            
            # Validate new password
            if new_password != confirm_password:
                context['confirm_password_error'] = 'Passwords do not match.'
                return render(request, 'dashboard/change_password.html', context)
            
            # Validate password complexity
            if len(new_password) < 8:
                context['new_password_error'] = 'Password must be at least 8 characters long.'
                return render(request, 'dashboard/change_password.html', context)
            
            if not any(char.isupper() for char in new_password):
                context['new_password_error'] = 'Password must contain at least one uppercase letter.'
                return render(request, 'dashboard/change_password.html', context)
            
            if not any(char.islower() for char in new_password):
                context['new_password_error'] = 'Password must contain at least one lowercase letter.'
                return render(request, 'dashboard/change_password.html', context)
            
            if not any(char.isdigit() for char in new_password):
                context['new_password_error'] = 'Password must contain at least one number.'
                return render(request, 'dashboard/change_password.html', context)
            
            if not any(not char.isalnum() for char in new_password):
                context['new_password_error'] = 'Password must contain at least one special character.'
                return render(request, 'dashboard/change_password.html', context)
            
            # Change password
            user.set_password(new_password)
            user.save()
            
            # Update session to prevent logout
            update_session_auth_hash(request, user)
            
            messages.success(request, 'Password changed successfully!')
            return redirect('user_panel:view_profile')
        
        # For GET requests, render the change password form
        return render(request, 'dashboard/change_password.html', context)
    except Exception as e:
        logger.error(f"Error changing password: {str(e)}")
        messages.error(request, f"Error changing password: {str(e)}")
        return redirect('user_panel:view_profile')

@login_required
@require_POST
def edit_post(request, post_id):
    """Edit a post"""
    post = get_object_or_404(Post, post_id=post_id)
    
    # Check if the user is the author of the post
    if post.user != request.user:
        return HttpResponseForbidden("You don't have permission to edit this post")
    
    try:
        data = json.loads(request.body)
        message = data.get('message', '').strip()
        
        if not message:
            return JsonResponse({'status': 'error', 'message': 'Post content cannot be empty'})
        
        # Update the post
        post.message = message
        post.save()
        
        return JsonResponse({
            'status': 'success',
            'message': 'Post updated successfully'
        })
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Invalid JSON data'})
    except Exception as e:
        logger.error(f"Error editing post {post_id}: {str(e)}")
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

@login_required
@require_POST
def delete_post(request, post_id):
    """Delete a post"""
    post = get_object_or_404(Post, post_id=post_id)
    
    # Check if the user is the author of the post
    if post.user != request.user:
        return HttpResponseForbidden("You don't have permission to delete this post")
    
    try:
        # Delete the post
        post.delete()
        
        return JsonResponse({
            'status': 'success',
            'message': 'Post deleted successfully'
        })
    except Exception as e:
        logger.error(f"Error deleting post {post_id}: {str(e)}")
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

@login_required
@require_POST
def edit_reply(request, reply_id):
    """Edit a reply"""
    reply = get_object_or_404(PostReply, reply_id=reply_id)
    
    # Check if the user is the author of the reply
    if reply.user != request.user:
        return HttpResponseForbidden("You don't have permission to edit this reply")
    
    try:
        data = json.loads(request.body)
        message = data.get('message', '').strip()
        
        if not message:
            return JsonResponse({'status': 'error', 'message': 'Reply cannot be empty'})
        
        # Update the reply
        reply.message = message
        reply.save()
        
        return JsonResponse({
            'status': 'success',
            'message': 'Reply updated successfully'
        })
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Invalid JSON data'})
    except Exception as e:
        logger.error(f"Error editing reply {reply_id}: {str(e)}")
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

@login_required
@require_POST
def delete_reply(request, reply_id):
    """Delete a reply"""
    reply = get_object_or_404(PostReply, reply_id=reply_id)
    
    # Check if the user is the author of the reply
    if reply.user != request.user:
        return HttpResponseForbidden("You don't have permission to delete this reply")
    
    try:
        # Get the post before deleting the reply to update reply count
        post = reply.post
        
        # Delete the reply
        reply.delete()
        
        # Get updated reply count
        reply_count = post.replies.count()
        
        return JsonResponse({
            'status': 'success',
            'message': 'Reply deleted successfully',
            'reply_count': reply_count
        })
    except Exception as e:
        logger.error(f"Error deleting reply {reply_id}: {str(e)}")
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

@login_required
def search_users(request):
    """
    API endpoint to search users by name or username
    """
    search_term = request.GET.get('term', '').strip()
    
    if not search_term:
        users = User.objects.exclude(id=request.user.id)
    else:
        users = User.objects.filter(
            models.Q(full_name__icontains=search_term) | 
            models.Q(username__icontains=search_term)
        ).exclude(id=request.user.id)
    
    user_data = [{
        'id': user.id,
        'username': user.username,
        'full_name': user.full_name,
        'profile_picture': user.profile_picture.url if user.profile_picture else '/static/accounts/images/profile.png'
    } for user in users]
    
    return JsonResponse({
        'status': 'success',
        'users': user_data
    })

@login_required
def get_post_images(request, post_id):
    """
    API endpoint to get all images for a post
    """
    logger.info(f"Fetching images for post {post_id}")
    
    try:
        post = get_object_or_404(Post, post_id=post_id)
        images = post.get_images()
        
        # Format the response
        image_data = [{
            'id': image.image_id,
            'url': image.image.url,
            'created_at': image.uploaded_at.isoformat()
        } for image in images]
        
        return JsonResponse({
            'status': 'success',
            'post_id': post_id,
            'images': image_data
        })
    except Exception as e:
        logger.error(f"Error fetching images for post {post_id}: {str(e)}")
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
