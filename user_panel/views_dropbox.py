from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from accounts.models import User
from .models import Post, PostImage
from .dropbox_utils import upload_profile_picture, upload_post_image
import re

@login_required
def edit_profile(request):
    """Handle profile editing with Dropbox storage for profile pictures"""
    if request.method == 'POST':
        # Get form data
        username = request.POST.get('username')
        full_name = request.POST.get('full_name')
        contact = request.POST.get('contact')
        address = request.POST.get('address')
        about = request.POST.get('about')
        block = request.POST.get('block')
        lot = request.POST.get('lot')
        
        # Validate username
        if not re.match(r'^[a-zA-Z0-9]{6,15}$', username):
            return render(request, 'dashboard/edit_profile.html', {
                'username_error': 'Username must be 6-15 characters and contain only letters and numbers.'
            })
        
        # Check if username is taken by another user
        if User.objects.filter(username=username).exclude(id=request.user.id).exists():
            return render(request, 'dashboard/edit_profile.html', {
                'username_error': 'This username is already taken.'
            })
        
        # Validate full name
        if not re.match(r'^[a-zA-Z\s]{7,20}$', full_name):
            return render(request, 'dashboard/edit_profile.html', {
                'full_name_error': 'Full name must be 7-20 characters and contain only letters and spaces.'
            })
        
        # Update user data
        user = request.user
        user.username = username
        user.full_name = full_name
        user.contact = contact
        user.address = address
        user.about = about
        user.block = block
        user.lot = lot
        
        # Handle profile picture upload to Dropbox
        if 'profile_picture' in request.FILES:
            profile_pic = request.FILES['profile_picture']
            # Upload to Dropbox and get the URL
            dropbox_url = upload_profile_picture(profile_pic)
            if dropbox_url:
                user.profile_picture_url = dropbox_url  # Store the Dropbox URL instead of the file
        
        user.save()
        messages.success(request, 'Profile updated successfully!')
        return redirect('user_panel:view_profile')
    
    return render(request, 'dashboard/edit_profile.html')

@login_required
def create_post(request):
    """Handle post creation with Dropbox storage for post images"""
    if request.method == 'POST':
        message = request.POST.get('message')
        
        # Create the post
        post = Post.objects.create(
            user=request.user,
            message=message
        )
        
        # Handle image uploads to Dropbox
        if request.FILES.getlist('images'):
            for image in request.FILES.getlist('images'):
                # Upload to Dropbox and get the URL
                dropbox_url = upload_post_image(image)
                if dropbox_url:
                    # Create PostImage with Dropbox URL
                    PostImage.objects.create(
                        post=post,
                        image_url=dropbox_url  # Store the Dropbox URL instead of the file
                    )
        
        messages.success(request, 'Post created successfully!')
        return redirect('user_panel:dashboard')
    
    return render(request, 'dashboard/create_post.html')