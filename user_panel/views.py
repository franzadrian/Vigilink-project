from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, JsonResponse, HttpResponseForbidden
from django.views.decorators.http import require_POST
from django.contrib import messages
from .models import Post, PostReaction, PostReply, PostShare, PostImage
import logging
from django.core.serializers.json import DjangoJSONEncoder
import json
from datetime import datetime

# Set up logging
logger = logging.getLogger(__name__)

# Create your views here.
@login_required
def dashboard(request):
    logger.info(f"Dashboard view accessed by user: {request.user.username}")
    try:
        # Get all posts ordered by most recent first
        posts = Post.objects.all().order_by('-uploaded_at')
        
        # Enhance posts with reaction, reply, and share data
        for post in posts:
            # Check if user has reacted to this post
            post.user_reacted = post.reactions.filter(user=request.user).exists()
            # Count reactions, replies, and shares
            post.reaction_count = post.reactions.count()
            post.reply_count = post.replies.count()
            post.share_count = post.shares.count()
        
        return render(request, 'dashboard/dashboard.html', {'posts': posts})
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
            return redirect('dashboard')
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

@login_required
@require_POST
def share_post(request, post_id):
    post = get_object_or_404(Post, post_id=post_id)
    
    # Check if user already shared this post
    share, created = PostShare.objects.get_or_create(user=request.user, post=post)
    
    if not created:
        # User already shared, so we'll just return success
        return JsonResponse({'status': 'already_shared', 'count': post.shares.count()})
    
    return JsonResponse({'status': 'shared', 'count': post.shares.count()})

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
        'reaction_count': post.reactions.count(),
        'share_count': post.shares.count()
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
                'id': reply.reply_id,
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
    reply = get_object_or_404(PostReply, id=reply_id)
    
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
    reply = get_object_or_404(PostReply, id=reply_id)
    
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
