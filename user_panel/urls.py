from django.urls import path
from . import views

app_name = 'user_panel'

urlpatterns = [
    path('dashboard/', views.dashboard, name='dashboard'),
    path('create-post/', views.create_post, name='create_post'),
    path('post/<int:post_id>/', views.view_post, name='view_post'),
    path('post/<int:post_id>/react/', views.react_to_post, name='react_to_post'),
    path('post/<int:post_id>/reply/', views.reply_to_post, name='reply_to_post'),
    # share_post URL route removed
    path('post/<int:post_id>/edit/', views.edit_post, name='edit_post'),
    path('post/<int:post_id>/delete/', views.delete_post, name='delete_post'),
    path('reply/<int:reply_id>/edit/', views.edit_reply, name='edit_reply'),
    path('reply/<int:reply_id>/delete/', views.delete_reply, name='delete_reply'),
    path('api/post/<int:post_id>/replies/', views.get_post_replies, name='get_post_replies'),
    path('api/post/<int:post_id>/images/', views.get_post_images, name='get_post_images'),
    path('profile/', views.view_profile, name='view_profile'),
    path('profile/<int:user_id>/', views.view_profile, name='view_user_profile'),
    path('global-user-search/', views.global_user_search, name='global_user_search'),
    path('profile/edit/', views.edit_profile, name='edit_profile'),
    path('profile/change-password/', views.change_password, name='change_password'),
    
    # Payment
    path('payment/', views.payment, name='payment'),
    
    # Communication
    path('communication/', views.communication, name='communication'),
    path('communication/messages/', views.chat_messages, name='chat_messages'),
    path('communication/send/', views.send_message, name='send_message'),
    path('communication/recent-chats/', views.get_recent_chats, name='recent_chats'),
    path('mark-read/<uuid:message_id>/', views.mark_message_read, name='mark_message_read'),
    path('global-user-search/', views.global_user_search, name='global_user_search'),
    path('search-users/', views.search_users, name='search_users'),
    path('payment/create/', views.create_payment, name='create_payment'),
    path('payment/capture/', views.capture_payment, name='capture_payment'),
    path('payment/success/', views.payment_success, name='payment_success'),
    path('payment/cancel/', views.payment_cancel, name='payment_cancel'),
    
    # Informational pages
    path('about/', views.about, name='about'),
    path('contact/', views.contact, name='contact'),
    path('contact/submit/', views.contact_submit, name='contact_submit'),
    path('pricing/', views.pricing, name='pricing'),
    path('terms/', views.terms, name='terms'),
    path('privacy/', views.privacy, name='privacy'),
]