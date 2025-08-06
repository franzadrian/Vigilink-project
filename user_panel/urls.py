from django.urls import path
from . import views
import sys
import os

# Add the project root to the path to import test_middleware
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from test_middleware import test_middleware

urlpatterns = [
    path('dashboard/', views.dashboard, name='dashboard'),
    path('create-post/', views.create_post, name='create_post'),
    path('post/<int:post_id>/', views.view_post, name='view_post'),
    path('post/<int:post_id>/react/', views.react_to_post, name='react_to_post'),
    path('post/<int:post_id>/reply/', views.reply_to_post, name='reply_to_post'),
    path('post/<int:post_id>/share/', views.share_post, name='share_post'),
    path('post/<int:post_id>/edit/', views.edit_post, name='edit_post'),
    path('post/<int:post_id>/delete/', views.delete_post, name='delete_post'),
    path('reply/<int:reply_id>/edit/', views.edit_reply, name='edit_reply'),
    path('reply/<int:reply_id>/delete/', views.delete_reply, name='delete_reply'),
    path('api/post/<int:post_id>/replies/', views.get_post_replies, name='get_post_replies'),
    path('api/post/<int:post_id>/images/', views.get_post_images, name='get_post_images'),
    path('test-middleware/', test_middleware, name='test_middleware'),
]