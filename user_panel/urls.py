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
    path('communication/user/<int:user_id>/', views.get_user_by_id, name='get_user_by_id'),
    path('communication/messages/', views.chat_messages, name='chat_messages'),
    path('communication/send/', views.send_message, name='send_message'),
    path('communication/send-image/', views.send_image_message, name='send_image_message'),
    path('communication/edit-message/', views.edit_message, name='edit_message'),
    path('communication/delete-message/', views.delete_message, name='delete_message'),
    path('communication/recent-chats/', views.get_recent_chats, name='recent_chats'),
    path('communication/contact-threads/', views.get_contact_threads, name='contact_threads'),
    path('communication/support-admin/', views.get_support_admin, name='support_admin'),
    path('communication/bootstrap-contact-chat/', views.bootstrap_contact_chat, name='bootstrap_contact_chat'),
    path('communication/contact-unread-count/', views.get_contact_unread_count, name='contact_unread_count'),
    # Mark message as read (message_id is an integer primary key)
    path('mark-read/<int:message_id>/', views.mark_message_read, name='mark_message_read'),
    
    # Group Chat
    path('communication/group-chat/create/', views.create_group_chat, name='create_group_chat'),
    path('communication/group-chat/community-members/', views.get_community_members_for_group, name='get_community_members_for_group'),
    path('communication/group-chat/<int:group_id>/members/', views.get_group_chat_members, name='get_group_chat_members'),
    path('communication/group-chat/<int:group_id>/members/add/', views.add_group_chat_members, name='add_group_chat_members'),
    path('communication/group-chat/<int:group_id>/messages/', views.get_group_chat_messages, name='get_group_chat_messages'),
    path('communication/group-chat/<int:group_id>/send/', views.send_group_message, name='send_group_message'),
    path('communication/group-chat/<int:group_id>/send-image/', views.send_group_image_message, name='send_group_image_message'),
    path('communication/group-chat/<int:group_id>/delete/', views.delete_group_chat, name='delete_group_chat'),
    path('communication/group-chat/<int:group_id>/members/<int:user_id>/remove/', views.remove_group_member, name='remove_group_member'),
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
