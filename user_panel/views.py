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
from communityowner_panel.models import CommunityMembership, CommunityProfile
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

# Helper function to check if user has community membership or owns a community and get their community
def get_user_community(user):
    """Get the community for a user, or None if they don't have membership or ownership.
    Checks both CommunityMembership and CommunityProfile.owner"""
    # First check if user is a member of a community
    try:
        membership = CommunityMembership.objects.get(user=user)
        return membership.community
    except CommunityMembership.DoesNotExist:
        pass
    
    # If not a member, check if user owns a community
    try:
        profile = CommunityProfile.objects.get(owner=user)
        return profile
    except CommunityProfile.DoesNotExist:
        pass
    
    return None

# Helper function to check if two users are in the same community
def are_users_in_same_community(user1, user2):
    """Check if two users are in the same community.
    This includes checking if one is the owner and the other is a member, or vice versa."""
    community1 = get_user_community(user1)
    community2 = get_user_community(user2)
    
    if community1 is None or community2 is None:
        return False
    
    # Both should reference the same CommunityProfile
    return community1 == community2

# PayPal configuration helpers (read fresh from environment/.env when needed)
def _get_env(name: str, default: str = "") -> str:
    val = os.environ.get(name)
    if val:
        return val
    # Fallback: lazily load from .env on disk if not present in process env
    try:
        env_path = settings.BASE_DIR / '.env'
        if env_path.exists():
            with env_path.open('r', encoding='utf-8') as f:
                for raw in f:
                    line = raw.strip()
                    if not line or line.startswith('#') or '=' not in line:
                        continue
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip()
                    if value and value[0] == value[-1] and value[0] in ('"', "'"):
                        value = value[1:-1]
                    if key == name:
                        os.environ[name] = value
                        return value
    except Exception:
        pass
    return default

def get_paypal_config():
    return {
        'client_id': _get_env('PAYPAL_CLIENT_ID', ''),
        'client_secret': _get_env('PAYPAL_CLIENT_SECRET', ''),
        'base_url': _get_env('PAYPAL_BASE_URL', 'https://api-m.sandbox.paypal.com'),
    }

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
def get_user_by_id(request, user_id):
    """Get user details by ID for communication page"""
    try:
        user = User.objects.get(id=user_id)
        # Don't allow messaging yourself
        if user.id == request.user.id:
            return JsonResponse({'error': 'Cannot message yourself'}, status=400)
        
        # Get profile picture URL
        profile_picture_url = None
        try:
            profile_picture_url = user.get_profile_picture_url() if hasattr(user, 'get_profile_picture_url') else None
        except Exception:
            pass
        if not profile_picture_url:
            try:
                profile_picture_url = user.profile_picture.url if getattr(user, 'profile_picture', None) else None
            except Exception:
                pass
        
        return JsonResponse({
            'id': user.id,
            'username': user.username,
            'full_name': user.full_name or user.username,
            'email': user.email,
            'profile_picture_url': profile_picture_url or '/static/accounts/images/profile.png'
        })
    except User.DoesNotExist:
        return JsonResponse({'error': 'User not found'}, status=404)
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
    from admin_panel.models import ContactMessage
    has_active_contact = False
    active_count = 0
    try:
        if request.user.is_authenticated:
            qs = ContactMessage.objects.filter(user=request.user, is_read=False)
            has_active_contact = qs.exists()
            active_count = qs.count()
    except Exception:
        has_active_contact = False
        active_count = 0
    return render(request, 'informational page/contact.html', {
        'has_active_contact': has_active_contact,
        'active_contact_count': active_count,
    })

@login_required
def get_contact_unread_count(request):
    """Return count of unread admin replies for the current user without marking them read."""
    try:
        admin_qs = User.objects.filter(
            models.Q(role='admin') | models.Q(is_superuser=True) | models.Q(is_staff=True)
        )
        cnt = Message.objects.filter(sender__in=admin_qs, receiver=request.user, is_read=False).count()
        return JsonResponse({'status': 'success', 'unread_count': cnt})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

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

        # Prevent new contact if there is an active (not done) request
        try:
            if request.user.is_authenticated:
                has_active = ContactMessage.objects.filter(user=request.user, is_read=False).exists()
                if has_active:
                    msg = 'You already have an active request. Please wait until it is marked as Done before sending a new one.'
                    if wants_json:
                        return JsonResponse({'status': 'error', 'message': msg}, status=400)
                    messages.error(request, msg)
                    return redirect('user_panel:contact')
        except Exception:
            # Fail open if check fails (do not block)
            pass

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
        cfg = get_paypal_config()
        url = f"{cfg['base_url']}/v1/oauth2/token"
        headers = {
            "Accept": "application/json",
            "Accept-Language": "en_US"
        }
        auth = base64.b64encode(f"{cfg['client_id']}:{cfg['client_secret']}".encode()).decode()
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
    
    cfg = get_paypal_config()
    paypal_enabled = bool(cfg['client_id'])
    context = {
        'plan_type': plan_type,
        'billing_cycle': billing_cycle,
        'price': price,
        'client_id': cfg['client_id'],
        'paypal_enabled': paypal_enabled,
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
        cfg = get_paypal_config()
        url = f"{cfg['base_url']}/v2/checkout/orders"
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
        cfg = get_paypal_config()
        url = f"{cfg['base_url']}/v2/checkout/orders/{order_id}/capture"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token}"
        }
        
        response = requests.post(url, headers=headers)
        response_data = response.json()
        
        if response.status_code in [200, 201]:  # Success
            # Upgrade the current user's role to Community Owner upon successful capture
            try:
                if hasattr(request.user, 'role') and request.user.role != 'communityowner':
                    request.user.role = 'communityowner'
                    request.user.save(update_fields=['role'])
            except Exception as _e:
                logger.error(f"Failed to set user role to communityowner: {_e}")
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
    
    # Ensure user role is upgraded (in case capture step was skipped client-side)
    try:
        if hasattr(request.user, 'role') and request.user.role != 'communityowner':
            request.user.role = 'communityowner'
            request.user.save(update_fields=['role'])
    except Exception as _e:
        logger.error(f"Post-success role ensure failed: {_e}")
    
    # Create or update subscription
    try:
        from settings_panel.models import Subscription
        from django.utils import timezone
        from datetime import timedelta
        
        # Calculate expiry date based on billing cycle
        if billing_cycle == 'yearly':
            expiry_date = timezone.now() + timedelta(days=365)
        else:
            expiry_date = timezone.now() + timedelta(days=30)
        
        # Get or create subscription for the user
        subscription, created = Subscription.objects.get_or_create(
            user=request.user,
            defaults={
                'plan_type': plan_type,
                'billing_cycle': billing_cycle,
                'status': 'active',
                'expiry_date': expiry_date
            }
        )
        
        # If subscription already exists, update it (restore access)
        if not created:
            subscription.plan_type = plan_type
            subscription.billing_cycle = billing_cycle
            subscription.expiry_date = expiry_date
            subscription.cancelled_at = None  # Reset cancellation if resubscribing
            # Activate subscription (this will restore roles)
            subscription.activate()
        else:
            # For new subscriptions, ensure user role is set to communityowner
            if subscription.is_active() and request.user.role != 'communityowner':
                request.user.role = 'communityowner'
                request.user.save(update_fields=['role'])
            
    except Exception as _e:
        logger.error(f"Error creating/updating subscription: {_e}")

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
        # Check if user has a community membership
        user_community = get_user_community(request.user)
        if not user_community:
            # User is not part of any community - show not_member page
            from accounts.models import LocationEmergencyContact
            
            # Get location-based emergency contacts if available
            location_contacts = []
            try:
                # Get district-specific contacts first (more specific)
                if hasattr(request.user, 'district') and request.user.district:
                    district_contacts = LocationEmergencyContact.objects.filter(
                        district=request.user.district,
                        is_active=True
                    ).order_by('order', 'id')
                    for c in district_contacts:
                        location_contacts.append({
                            'label': c.label, 
                            'phone': c.phone
                        })
                
                # If no district contacts, get city-specific contacts
                if not location_contacts and hasattr(request.user, 'city') and request.user.city:
                    city_contacts = LocationEmergencyContact.objects.filter(
                        city=request.user.city,
                        is_active=True
                    ).order_by('order', 'id')
                    for c in city_contacts:
                        location_contacts.append({
                            'label': c.label, 
                            'phone': c.phone
                        })
            except Exception:
                location_contacts = []
            
            return render(request, 'resident/not_member.html', {
                'page_type': 'dashboard',
                'location_contacts': location_contacts
            })
        
        # Get search parameters
        search_query = request.GET.get('search', '')
        
        # Get all users in the same community (members + owner)
        community_member_ids = list(CommunityMembership.objects.filter(
            community=user_community
        ).values_list('user_id', flat=True))
        
        # Also include the community owner if they're not already in the members list
        if user_community.owner_id not in community_member_ids:
            community_member_ids.append(user_community.owner_id)
        
        # Start with posts from users in the same community only (members + owner)
        user_reacted_subq = models.Exists(
            PostReaction.objects.filter(post=models.OuterRef('pk'), user=request.user)
        )
        posts_query = (
            Post.objects
            .filter(user_id__in=community_member_ids)  # Only posts from community members and owner
            .select_related('user')
            .annotate(
                reaction_count=models.Count('reactions', distinct=True),
                reply_count=models.Count('replies', distinct=True),
                user_reacted=user_reacted_subq,
            )
        )
        
        # Apply search filter if provided
        if search_query:
            # Search by username or full_name (partial match) within community members
            posts_query = posts_query.filter(
                models.Q(user__username__icontains=search_query) |
                models.Q(user__full_name__icontains=search_query)
            )
        
        # Order by most recent first and cap initial results for faster render
        posts = posts_query.order_by('-uploaded_at')[:50]
        
        # Counts and user_reacted are already annotated above
        
        # Check if search returned no results
        no_results = False
        if search_query and not posts.exists():
            no_results = True
            no_results_message = f"No posts found from users matching '{search_query}' in your community."
        
        # Get community information for sidebar
        community_members = CommunityMembership.objects.filter(
            community=user_community
        ).select_related('user').order_by('-joined_at')[:10]  # Recent 10 members
        
        total_members = CommunityMembership.objects.filter(community=user_community).count()
        total_posts = Post.objects.filter(user_id__in=community_member_ids).count()
        
        # Check if current user is the owner
        is_owner = user_community.owner == request.user
        
        context = {
            'posts': posts,
            'search_query': search_query,
            'no_results': no_results,
            'no_results_message': no_results_message if 'no_results_message' in locals() else '',
            'user_community': user_community,
            'community_members': community_members,
            'total_members': total_members,
            'total_posts': total_posts,
            'is_owner': is_owner,
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
    # Check if user has a community membership
    user_community = get_user_community(request.user)
    if not user_community:
        messages.error(request, 'You must be a member of a community to create posts.')
        return redirect('user_panel:view_profile')
    
    if request.method == 'POST':
        try:
            message = request.POST.get('message', '')
            
            # Create the post
            post = Post.objects.create(
                user=request.user,
                message=message
            )
            
            logger.info(f"Post created: {post.post_id}")
            
            # Handle multiple image uploads - optimized with parallel uploads
            images = request.FILES.getlist('images')
            
            if images:
                from .dropbox_utils import upload_post_image, get_dropbox_client
                from concurrent.futures import ThreadPoolExecutor, as_completed
                from io import BytesIO
                import uuid
                import os
                
                # Limit to 20 images
                images = images[:20]
                
                # Pre-verify Dropbox client once before threading
                dbx = get_dropbox_client()
                if not dbx:
                    messages.error(request, 'Dropbox service unavailable. Please try again later.')
                    return redirect('user_panel:dashboard')
                
                # Pre-create folder once (avoid doing this in each thread)
                from .dropbox_utils import POST_IMAGES_PATH
                try:
                    folder_path = POST_IMAGES_PATH.rstrip('/')
                    if folder_path:
                        try:
                            dbx.files_create_folder_v2(folder_path)
                        except Exception:
                            pass  # Folder likely exists
                except Exception:
                    pass
                
                # Read all file contents into memory for threading
                image_data_list = []
                for image in images:
                    image_data = image.read()
                    image_name = image.name
                    image_data_list.append((image_data, image_name))
                
                def upload_image(image_data_bytes, image_name, index):
                    """Upload a single image in a thread"""
                    try:
                        from .dropbox_utils import get_dropbox_client_fast
                        from dropbox.files import WriteMode
                        from dropbox.exceptions import ApiError
                        
                        # Each thread gets its own client without account verification (faster)
                        thread_dbx = get_dropbox_client_fast()
                        if not thread_dbx:
                            return (index, None, "Dropbox client unavailable")
                        
                        # Generate filename
                        ext = os.path.splitext(image_name)[1] if image_name else '.jpg'
                        filename = f"{uuid.uuid4()}{ext}"
                        file_path = f"{POST_IMAGES_PATH}{filename}"
                        
                        # Upload directly using bytes and shared client
                        mode = WriteMode.add
                        result = thread_dbx.files_upload(image_data_bytes, file_path, mode=mode, autorename=True)
                        
                        # Create or retrieve shared link
                        try:
                            shared_link = thread_dbx.sharing_create_shared_link_with_settings(result.path_lower)
                            link_url = shared_link.url
                        except ApiError:
                            try:
                                links = thread_dbx.sharing_list_shared_links(path=result.path_lower, direct_only=True)
                                link_url = links.links[0].url if links.links else None
                            except Exception:
                                link_url = None
                        
                        if link_url:
                            # Convert to direct download link
                            dl_url = link_url.replace('www.dropbox.com', 'dl.dropboxusercontent.com')
                            dl_url = dl_url.replace('?dl=0', '')
                            return (index, dl_url, None)
                        else:
                            # Fallback to temporary link
                            try:
                                temp = thread_dbx.files_get_temporary_link(result.path_lower)
                                return (index, temp.link, None)
                            except Exception:
                                return (index, None, "Failed to get download link")
                    except Exception as e:
                        return (index, None, str(e))
                
                # Use ThreadPoolExecutor for better thread management
                results = {}
                with ThreadPoolExecutor(max_workers=min(6, len(image_data_list))) as executor:
                    # Submit all upload tasks
                    future_to_index = {
                        executor.submit(upload_image, image_data_bytes, image_name, idx): idx
                        for idx, (image_data_bytes, image_name) in enumerate(image_data_list)
                    }
                    
                    # Collect results as they complete
                    for future in as_completed(future_to_index):
                        try:
                            idx, url, error = future.result()
                            results[idx] = (url, error)
                        except Exception as e:
                            idx = future_to_index[future]
                            results[idx] = (None, str(e))
                
                # Create PostImage objects in order using bulk_create for better performance
                post_images = []
                for idx in sorted(results.keys()):
                    url, error = results[idx]
                    if url:
                        post_images.append(PostImage(
                            post=post,
                            image_url=url
                        ))
                    else:
                        logger.error(f"Dropbox upload failed for image {idx} in post {post.post_id}: {error}")
                
                # Bulk create all images at once
                if post_images:
                    PostImage.objects.bulk_create(post_images)
                    logger.info(f"Total {len(post_images)} images uploaded for post {post.post_id}")
            
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
    
    # Check if user and post author are in the same community
    if not are_users_in_same_community(request.user, post.user):
        return JsonResponse({'status': 'error', 'message': 'You can only react to posts from your community.'}, status=403)
    
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
    
    # Check if user and post author are in the same community
    if not are_users_in_same_community(request.user, post.user):
        return JsonResponse({'status': 'error', 'message': 'You can only reply to posts from your community.'}, status=403)
    
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
    
    # Check if user and post author are in the same community
    if not are_users_in_same_community(request.user, post.user):
        messages.error(request, 'You can only view posts from your community.')
        return redirect('user_panel:dashboard')
    
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
        
        # Check if user and post author are in the same community
        if not are_users_in_same_community(request.user, post.user):
            return JsonResponse({'status': 'error', 'message': 'You can only view replies to posts from your community.'}, status=403)
        
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
            
            # Check if full name is between 4-30 characters
            if len(full_name) < 4 or len(full_name) > 30:
                context['full_name_error'] = 'Full name must be between 4-30 characters long.'
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
    
    # Check if user and post author are in the same community
    if not are_users_in_same_community(request.user, post.user):
        return JsonResponse({'status': 'error', 'message': 'You can only edit posts from your community.'}, status=403)
    
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
    
    # Check if user and post author are in the same community
    if not are_users_in_same_community(request.user, post.user):
        return JsonResponse({'status': 'error', 'message': 'You can only delete posts from your community.'}, status=403)
    
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
    
    # Check if user and post author are in the same community
    if not are_users_in_same_community(request.user, reply.post.user):
        return JsonResponse({'status': 'error', 'message': 'You can only edit replies to posts from your community.'}, status=403)
    
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
    
    # Check if user and post author are in the same community
    if not are_users_in_same_community(request.user, reply.post.user):
        return JsonResponse({'status': 'error', 'message': 'You can only delete replies to posts from your community.'}, status=403)
    
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
        
        # Check if user and post author are in the same community
        if not are_users_in_same_community(request.user, post.user):
            return JsonResponse({'status': 'error', 'message': 'You can only view images from posts in your community.'}, status=403)
        
        images = post.get_images()
        
        # Format the response
        image_data = [{
            'id': image.image_id,
            'url': image.get_image_url(),
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
    # Use the original contact created_at as a stable key (content may change if edited later)
    exists = Message.objects.filter(
        sender=request.user,
        receiver=admin
    ).filter(models.Q(sent_at=cm.created_at) | models.Q(message=cm.message)).exists()
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
