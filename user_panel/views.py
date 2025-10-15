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

# PayPal API Configuration (read from environment; do not hardcode secrets)
PAYPAL_CLIENT_ID = os.environ.get("PAYPAL_CLIENT_ID", "")
PAYPAL_CLIENT_SECRET = os.environ.get("PAYPAL_CLIENT_SECRET", "")
PAYPAL_BASE_URL = os.environ.get("PAYPAL_BASE_URL", "https://api-m.sandbox.paypal.com")

def about(request):
    """About page view"""
    return render(request, 'informational page/about.html')

@login_required
def communication(request):
    """Communication page view"""
    # Aggregate unread counts once to avoid N+1 queries
    unread_map = {
        row['sender_id']: row['c']
        for row in (
            Message.objects
            .filter(receiver=request.user, is_read=False)
            .values('sender_id')
            .annotate(c=models.Count('message_id'))
        )
    }

    # Get all messages for the current user (sent or received), newest first
    user_messages = (
        Message.objects
        .filter(models.Q(sender=request.user) | models.Q(receiver=request.user))
        .select_related('sender', 'receiver')
        .order_by('-sent_at')
    )

    # Build recent chat users with last message preview data (cap results)
    seen = set()
    chat_summaries = []
    MAX_USERS = 50
    for msg in user_messages:
        other = msg.sender if msg.sender != request.user else msg.receiver
        if other.id in seen:
            continue
        # Skip admin/superusers
        if other.role == 'admin' or other.is_superuser:
            continue
        seen.add(other.id)
        # Resolve profile picture URL robustly
        try:
            pic_url = other.get_profile_picture_url() if hasattr(other, 'get_profile_picture_url') else None
        except Exception:
            pic_url = None
        if not pic_url:
            try:
                pic_url = other.profile_picture.url if getattr(other, 'profile_picture', None) else None
            except Exception:
                pic_url = None

        # Derive safe first/last names (avoid strings like 'None')
        raw_full = (other.full_name or '').strip()
        if not raw_full or raw_full.lower() in ('none', 'null', 'undefined', 'n/a', 'na'):
            raw_full = ''
        raw_user = (other.username or '').strip()
        base_name = raw_full or raw_user or 'User'
        try:
            first_name = base_name.split()[0]
        except Exception:
            first_name = base_name or 'User'
        # Compute last name from full name if available
        last_name = ''
        try:
            if raw_full:
                parts = raw_full.split()
                if parts:
                    last_name = parts[-1]
        except Exception:
            last_name = ''

        # Display-friendly last message text (respect deletions and image placeholders)
        last_preview = msg.message or ''
        last_is_own = (msg.sender == request.user)
        try:
            if getattr(msg, 'is_deleted', False):
                last_preview = 'You deleted a message' if last_is_own else 'Message deleted'
                # For system labels like above, do not apply a "You: " prefix later
                last_is_own = False
            elif isinstance(last_preview, str):
                if last_preview.startswith('[img]'):
                    last_preview = 'Sent a photo'
                elif last_preview.startswith('[imgs]'):
                    last_preview = 'Sent photos'
        except Exception:
            pass

        chat_summaries.append({
            'id': other.id,
            'username': other.username,
            'full_name': other.full_name,
            'first_name': first_name,
            'last_name': last_name,
            'email': other.email,
            'profile_picture_url': pic_url,
            'last_message': last_preview,
            'last_message_time': msg.sent_at,
            'last_message_is_own': last_is_own,
            'unread_count': unread_map.get(other.id, 0),
        })
        if len(chat_summaries) >= MAX_USERS:
            break

    context = {
        'user_messages': None,
        'users': chat_summaries,
    }
    return render(request, 'communication/user_communications.html', context)

@login_required
def get_recent_chats(request):
    """Get list of users the current user has recently chatted with"""
    recent_messages = (
        Message.objects
        .filter(models.Q(sender=request.user) | models.Q(receiver=request.user))
        .select_related('sender', 'receiver')
        .order_by('-sent_at')
    )

    # Aggregate unread counts once
    unread_map = {
        row['sender_id']: row['c']
        for row in (
            Message.objects
            .filter(receiver=request.user, is_read=False)
            .values('sender_id')
            .annotate(c=models.Count('message_id'))
        )
    }

    seen_users = set()
    recent_users = []

    for m in recent_messages:
        other = m.receiver if m.sender == request.user else m.sender
        # Skip admins/superusers to keep support accounts out of the left list
        try:
            if getattr(other, 'role', None) == 'admin' or getattr(other, 'is_superuser', False):
                continue
        except Exception:
            pass
        if other.id in seen_users:
            continue
        # Determine preview text honoring deletions
        m_is_own = (m.sender == request.user)
        last_preview = m.message or ''
        try:
            if getattr(m, 'is_deleted', False):
                last_preview = 'You deleted a message' if m_is_own else 'Message deleted'
                # Ensure client won't prefix with "You: " again
                m_is_own = False
            elif isinstance(last_preview, str):
                if last_preview.startswith('[img]'):
                    last_preview = 'Sent a photo'
                elif last_preview.startswith('[imgs]'):
                    last_preview = 'Sent photos'
        except Exception:
            pass
        seen_users.add(other.id)

        # Resolve profile picture url safely
        try:
            pic_url = other.get_profile_picture_url() if hasattr(other, 'get_profile_picture_url') else None
        except Exception:
            pic_url = None
        if not pic_url:
            try:
                pic_url = other.profile_picture.url if getattr(other, 'profile_picture', None) else None
            except Exception:
                pic_url = None

        # Safe name parts
        raw_full = (other.full_name or '').strip()
        bad = ('none', 'null', 'undefined', 'n/a', 'na')
        if not raw_full or raw_full.lower() in bad:
            raw_full = ''
        raw_user = (other.username or '').strip()
        tokens = raw_full.split() if raw_full else []
        first_name = tokens[0] if tokens else (raw_user.split()[0] if raw_user else '')
        last_name = tokens[-1] if tokens else ''

        recent_users.append({
            'id': other.id,
            'username': other.username,
            'full_name': other.full_name,
            'first_name': first_name,
            'last_name': last_name,
            'profile_picture_url': pic_url,
            'last_message': last_preview,
            'last_message_time': m.sent_at.isoformat(),
            'last_message_is_own': m_is_own,
            'unread_count': unread_map.get(other.id, 0),
        })
        if len(recent_users) >= 20:
            break

    return JsonResponse({'status': 'success', 'users': recent_users})

@login_required
def chat_messages(request):
    """Get chat messages between current user and specified user"""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET requests are allowed'}, status=405)
    
    user_id = request.GET.get('user_id')
    if not user_id:
        return JsonResponse({'error': 'User ID is required'}, status=400)
        
    try:
        other_user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return JsonResponse({'error': 'User not found'}, status=404)
    
    try:
        messages = Message.objects.filter(
            (models.Q(sender=request.user) & models.Q(receiver=other_user)) |
            (models.Q(sender=other_user) & models.Q(receiver=request.user))
        ).order_by('sent_at')

        # Mark all incoming (from other_user) unread messages as read now that the thread is opened
        Message.objects.filter(sender=other_user, receiver=request.user, is_read=False).update(is_read=True)

        messages_data = []
        for msg in messages:
            # Compute a safe sender name that avoids literal 'None'
            sname = msg.sender.get_full_name()
            if not sname or str(sname).strip().lower() in ('none', 'null', 'undefined', 'n/a', 'na'):
                sname = msg.sender.username
            # Extract image placeholder if present
            image_url = None
            image_urls = None
            try:
                if isinstance(msg.message, str):
                    if msg.message.startswith('[img]'):
                        image_url = msg.message[5:]
                    elif msg.message.startswith('[imgs]'):
                        payload = msg.message[6:]
                        image_urls = [u for u in payload.split('|') if u]
            except Exception:
                image_url = None
            messages_data.append({
                'id': msg.message_id,
                'sender': msg.sender.id,
                'sender_name': sname,
                'message': msg.message,
                'image_url': image_url,
                'image_urls': image_urls,
                'sent_at': msg.sent_at.isoformat(),
                'is_own': msg.sender.id == request.user.id,
                'is_edited': msg.is_edited,
                'is_deleted': msg.is_deleted
            })
        
        return JsonResponse(messages_data, safe=False)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@login_required
@require_POST
def send_message(request):
    """Send a new message"""
    try:
        data = json.loads(request.body)
        receiver_id = data.get('receiver')
        message_content = data.get('message')
        
        if not receiver_id or not message_content:
            return JsonResponse({'error': 'Receiver and message are required'}, status=400)
            
        try:
            receiver = User.objects.get(id=receiver_id)
        except User.DoesNotExist:
            return JsonResponse({'error': 'Receiver not found'}, status=404)
            
        message = Message.objects.create(
            sender=request.user,
            receiver=receiver,
            message=message_content
        )
        
        return JsonResponse({
            'id': message.message_id,
            'sender': request.user.id,
            'sender_name': request.user.get_full_name() or request.user.username,
            'message': message.message,
            'sent_at': message.sent_at.isoformat(),
            'is_own': True
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@login_required
@require_POST
def send_image_message(request):
    """Handle sending one or more images in chat via multipart form-data.
    Expects: receiver (int), images (list of files) OR image (single file).
    Creates a single Message with placeholder '[img]URL' for single, or '[imgs]URL|URL|...' for multiple.
    """
    try:
        receiver_id = request.POST.get('receiver')
        files = request.FILES.getlist('images')
        if not files:
            single = request.FILES.get('image')
            if single:
                files = [single]
        if not receiver_id or not files:
            return JsonResponse({'error': 'Receiver and at least one image are required'}, status=400)

        try:
            receiver = User.objects.get(id=receiver_id)
        except User.DoesNotExist:
            return JsonResponse({'error': 'Receiver not found'}, status=404)

        # Upload to Dropbox chat images folder (Dropbox only; no local fallback)
        from .dropbox_utils import upload_chat_image, get_dropbox_client
        import uuid, os

        # Enforce Dropbox availability; error out if not available
        try:
            if not get_dropbox_client():
                return JsonResponse({'error': 'Dropbox authentication failed. Please configure a valid DROPBOX_REFRESH_TOKEN (or ACCESS_TOKEN).'}, status=500)
        except Exception:
            return JsonResponse({'error': 'Dropbox client initialization failed.'}, status=500)

        # Enforce max 10 images
        files = files[:10]
        urls = []
        for f in files:
            url = upload_chat_image(f)
            if not url:
                return JsonResponse({'error': 'Image upload failed. Please check Dropbox app token/scopes and try again.'}, status=500)
            urls.append(url)

        if len(urls) == 1:
            placeholder = '[img]' + urls[0]
            m = Message.objects.create(sender=request.user, receiver=receiver, message=placeholder)
            return JsonResponse({
                'id': m.message_id,
                'sender': request.user.id,
                'sender_name': request.user.get_full_name() or request.user.username,
                'message': m.message,
                'image_url': urls[0],
                'image_urls': urls,
                'sent_at': m.sent_at.isoformat(),
                'is_own': True
            })
        else:
            placeholder = '[imgs]' + '|'.join(urls)
            m = Message.objects.create(sender=request.user, receiver=receiver, message=placeholder)
            return JsonResponse({
                'id': m.message_id,
                'sender': request.user.id,
                'sender_name': request.user.get_full_name() or request.user.username,
                'message': m.message,
                'image_urls': urls,
                'sent_at': m.sent_at.isoformat(),
                'is_own': True
            })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@login_required
def get_chat_messages(request):
    """Get chat messages between current user and specified user"""
    if request.method != 'GET':
        return JsonResponse({'error': 'Only GET requests are allowed'}, status=405)
    
    user_id = request.GET.get('user_id')
    if not user_id:
        return JsonResponse({'error': 'User ID is required'}, status=400)
        
    try:
        other_user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return JsonResponse({'error': 'User not found'}, status=404)
    
    messages = Message.objects.filter(
        (models.Q(sender=request.user) & models.Q(receiver=other_user)) |
        (models.Q(sender=other_user) & models.Q(receiver=request.user))
    ).order_by('sent_at')
    
    messages_data = [{
        'id': msg.id,
        'sender': msg.sender.id,
        'sender_name': msg.sender.get_full_name() or msg.sender.username,
        'message': msg.content,  # Use content field from the model
        'sent_at': msg.sent_at.isoformat(),
        'is_own': msg.sender.id == request.user.id
    } for msg in messages]
    
    return JsonResponse(messages_data, safe=False)

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
    results = [{
        'id': user.id,
        'name': user.full_name or user.username,
        'username': user.username,
        'email': user.email,
        'avatar': user.profile_picture.url if user.profile_picture else None
    } for user in users]
    
    return JsonResponse(results, safe=False)

@login_required
@require_POST
def send_message(request):
    """Handle sending a new message"""
    try:
        data = json.loads(request.body)
        receiver_id = data.get('receiver')
        message_text = data.get('message')
        
        if not receiver_id or not message_text:
            return JsonResponse({'error': 'Receiver and message are required'}, status=400)
        
        try:
            receiver = User.objects.get(id=receiver_id)
            
            # Create and save the message
            message = Message.objects.create(
                sender=request.user,
                receiver=receiver,
                message=message_text
            )
            
            return JsonResponse({
                'id': message.message_id,
                'sender': request.user.id,
                'sender_name': request.user.get_full_name() or request.user.username,
                'message': message.message,
                'sent_at': message.sent_at.isoformat(),
                'is_own': True
            })
        except User.DoesNotExist:
            return JsonResponse({'error': 'Receiver not found'}, status=404)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON data'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@login_required
@require_POST
def edit_message(request):
    """Handle editing a message"""
    try:
        data = json.loads(request.body)
        message_id = data.get('message_id')
        new_content = data.get('new_content')
        
        if not message_id or not new_content:
            return JsonResponse({'error': 'Message ID and new content are required'}, status=400)
        
        try:
            # Get the message and verify ownership
            message = Message.objects.get(message_id=message_id)
            
            if message.sender != request.user:
                return JsonResponse({'error': 'You can only edit your own messages'}, status=403)
            
            # Update the message
            message.message = new_content
            message.is_edited = True
            message.save()
            
            return JsonResponse({
                'success': True,
                'id': message.message_id,
                'message': message.message,
                'is_edited': message.is_edited
            })
        except Message.DoesNotExist:
            return JsonResponse({'error': 'Message not found'}, status=404)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

@login_required
@require_POST
def delete_message(request):
    """Handle deleting a message"""
    try:
        data = json.loads(request.body)
        message_id = data.get('message_id')
        
        if not message_id:
            return JsonResponse({'error': 'Message ID is required'}, status=400)
        
        try:
            # Get the message and verify ownership
            message = Message.objects.get(message_id=message_id)
            
            if message.sender != request.user:
                return JsonResponse({'error': 'You can only delete your own messages'}, status=403)
            
            # Mark the message as deleted
            message.is_deleted = True
            message.save()
            
            return JsonResponse({
                'success': True,
                'id': message.message_id
            })
        except Message.DoesNotExist:
            return JsonResponse({'error': 'Message not found'}, status=404)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON data'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

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
                'email': user.email,
                'profile_picture_url': user.get_profile_picture_url()
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
    """Handle contact form submission (HTML form and AJAX/JSON)."""
    if request.method != 'POST':
        return redirect('user_panel:contact')

    # Detect JSON/AJAX
    wants_json = (
        request.headers.get('X-Requested-With') == 'XMLHttpRequest'
        or 'application/json' in (request.headers.get('Accept') or '')
        or (request.content_type or '').startswith('application/json')
    )

    try:
        if (request.content_type or '').startswith('application/json'):
            data = json.loads(request.body or '{}')
            name = data.get('name') or (request.user.get_full_name() if request.user.is_authenticated else '')
            email = data.get('email') or (request.user.email if request.user.is_authenticated else '')
            subject = (data.get('subject') or '').strip()
            message = (data.get('message') or '').strip()
        else:
            name = request.POST.get('name') or (request.user.get_full_name() if request.user.is_authenticated else '')
            email = request.POST.get('email') or (request.user.email if request.user.is_authenticated else '')
            subject = (request.POST.get('subject') or '').strip()
            message = (request.POST.get('message') or '').strip()

        if not all([name, email, subject, message]):
            if wants_json:
                return JsonResponse({'status': 'error', 'message': 'Please fill in all required fields'}, status=400)
            messages.error(request, 'Please fill in all required fields')
            return redirect('user_panel:contact')

        contact_message = ContactMessage(
            name=name,
            email=email,
            subject=subject,
            message=message,
            user=request.user if request.user.is_authenticated else None
        )
        contact_message.save()

        # Tailored success text
        if subject == 'General Inquiry':
            success_text = 'Thank you for your inquiry! We will provide you with all the information you need as soon as possible.'
        elif subject == 'Feedback':
            success_text = 'Thank you for your feedback! Your insights are valuable and help us improve our services.'
        elif subject == 'Report an Issue':
            success_text = 'Thank you for reporting this issue! We will investigate and address it promptly.'
        else:
            success_text = 'Your message has been sent successfully. We will get back to you soon!'

        if wants_json:
            return JsonResponse({'status': 'success', 'message': success_text})

        messages.success(request, success_text)
        return redirect('user_panel:contact')
    except Exception as e:
        if wants_json:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
        messages.error(request, f"An error occurred: {str(e)}")
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
        
        # Start with all posts and join user to avoid extra queries
        user_reacted_subq = models.Exists(
            PostReaction.objects.filter(post=models.OuterRef('pk'), user=request.user)
        )
        posts_query = (
            Post.objects
            .select_related('user')
            .annotate(
                reaction_count=models.Count('reactions', distinct=True),
                reply_count=models.Count('replies', distinct=True),
                user_reacted=user_reacted_subq,
            )
        )
        
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
        
        # Order by most recent first and cap initial results for faster render
        posts = posts_query.order_by('-uploaded_at')[:50]
        
        # Counts and user_reacted are already annotated above
        
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
                from .dropbox_utils import upload_post_image
                
                for image in images:
                    # Limit to 20 images per post
                    if image_count >= 20:
                        break
                        
                    try:
                        # Upload to Dropbox and get the URL
                        dropbox_url = upload_post_image(image)
                        
                        if dropbox_url:
                            # Create PostImage with Dropbox URL
                            post_image = PostImage.objects.create(
                                post=post,
                                image_url=dropbox_url
                            )
                        else:
                            # Skip this image if Dropbox upload fails (no local fallback)
                            logger.error(f"Dropbox upload failed for image {image.name} in post {post.post_id}")
                            continue
                            
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
            if reply.user.profile_picture_url:
                profile_picture_url = reply.user.profile_picture_url
            elif reply.user.profile_picture and hasattr(reply.user.profile_picture, 'url'):
                profile_picture_url = reply.user.profile_picture.url
            
            # Check if the current user is the author of this reply
            is_author = reply.user == request.user
                
            replies_data.append({
                'reply_id': reply.reply_id,
                'user_id': reply.user.id,
                'username': reply.user.username,
                'full_name': reply.user.full_name,
                'profile_picture_url': profile_picture_url,
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
                
                # Check if username already exists (excluding current user)
                if User.objects.filter(username=username).exclude(id=request.user.id).exists():
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
            
            # Handle profile picture upload to Dropbox
            if 'profile_picture' in request.FILES:
                from .dropbox_utils import upload_profile_picture
                profile_pic = request.FILES['profile_picture']
                
                # Upload to Dropbox and get the URL
                dropbox_url = upload_profile_picture(profile_pic)
                if dropbox_url:
                    user.profile_picture_url = dropbox_url  # Store the Dropbox URL
                else:
                    # Fallback to local storage if Dropbox upload fails
                    user.profile_picture = profile_pic
                
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
        return JsonResponse({
            'status': 'success',
            'users': []
        })
    
    # Search for users excluding current user, admins, and superusers
    users = User.objects.filter(
        models.Q(full_name__icontains=search_term) | 
        models.Q(username__icontains=search_term) |
        models.Q(email__icontains=search_term)
    ).exclude(
        models.Q(id=request.user.id) | 
        models.Q(role='admin') | 
        models.Q(is_superuser=True)
    )[:20]  # Limit to 20 results
    
    user_data = [{
        'id': user.id,
        'username': user.username,
        'full_name': user.full_name,
        'email': user.email,
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

# ===== Support/Admin Communications =====
@login_required
def get_contact_threads(request):
    """Return the current user's Contact Us submissions as threads (JSON)."""
    try:
        threads = ContactMessage.objects.filter(user=request.user).order_by('-created_at')
        data = [{
            'id': t.contact_id,
            'subject': t.subject,
            'message': t.message,
            'created_at': t.created_at.isoformat(),
            'is_read': t.is_read,
        } for t in threads]
        return JsonResponse({'status': 'success', 'threads': data})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)


@login_required
def get_support_admin(request):
    """Return a support admin user to chat with (JSON).

    Strategy:
    1) Prefer any user with role 'admin' or superuser or staff, excluding the requester.
    2) If none remain, allow self (useful on dev/staging where only one admin exists).
    3) If still none, return 404 with a clear message.
    """
    try:
        base_qs = User.objects.filter(
            models.Q(role='admin') | models.Q(is_superuser=True) | models.Q(is_staff=True)
        ).order_by('-is_superuser', '-is_staff', 'id')

        admin = base_qs.exclude(id=request.user.id).first()
        if not admin:
            admin = base_qs.first()
        if not admin:
            return JsonResponse({'status': 'error', 'message': 'No support admin account exists yet.'}, status=404)
        # Resolve profile picture URL if possible
        pic_url = None
        try:
            pic_url = admin.get_profile_picture_url() if hasattr(admin, 'get_profile_picture_url') else None
        except Exception:
            pic_url = None
        if not pic_url:
            try:
                pic_url = admin.profile_picture.url if getattr(admin, 'profile_picture', None) else None
            except Exception:
                pic_url = None
        name = (admin.get_full_name() or admin.full_name or admin.username or 'Support').strip()
        return JsonResponse({
            'status': 'success',
            'admin': {
                'id': admin.id,
                'username': admin.username,
                'full_name': name,
                'profile_picture_url': pic_url,
                'is_admin': True,
            }
        })
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)


@login_required
@require_POST
def bootstrap_contact_chat(request):
    """Ensure a ContactMessage is mirrored as the first message in chat with an admin.

    Body JSON: { "contact_id": <int> }
    Creates a Message(sender=request.user, receiver=admin, message=contact.message) if not present.
    Returns {status, admin_id, created}.
    """
    try:
        data = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Invalid JSON'}, status=400)

    contact_id = data.get('contact_id')
    if not contact_id:
        return JsonResponse({'status': 'error', 'message': 'contact_id is required'}, status=400)
    try:
        cm = ContactMessage.objects.get(contact_id=contact_id, user=request.user)
    except ContactMessage.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Contact message not found'}, status=404)

    # Find or choose admin as in get_support_admin
    base_qs = User.objects.filter(
        models.Q(role='admin') | models.Q(is_superuser=True) | models.Q(is_staff=True)
    ).order_by('-is_superuser', '-is_staff', 'id')
    admin = base_qs.exclude(id=request.user.id).first() or base_qs.first()
    if not admin:
        return JsonResponse({'status': 'error', 'message': 'No support admin account exists yet.'}, status=404)

    # Check if a matching message already exists (avoid duplicates)
    exists = Message.objects.filter(
        sender=request.user,
        receiver=admin,
        message=cm.message
    ).exists()
    created = False
    if not exists:
        try:
            m = Message(
                sender=request.user,
                receiver=admin,
                message=cm.message,
                sent_at=cm.created_at
            )
            m.save()
            created = True
        except Exception as e:
            # If creation fails for any reason, return error
            return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

    return JsonResponse({'status': 'success', 'admin_id': admin.id, 'created': created})
