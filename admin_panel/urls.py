from django.urls import path
from . import views

app_name = 'admin_panel'

urlpatterns = [
    path('', views.admin_index, name='admin_index'),
    path('dashboard/', views.admin_dashboard, name='admin_dashboard'),
    path('residents/', views.admin_resident, name='admin_resident'),
    path('communication/', views.admin_communication, name='admin_communication'),
    path('communication/new-messages/', views.get_new_messages, name='get_new_messages'),
    path('communication/unread-count/', views.get_unread_count, name='get_unread_count'),
    path('communication/contact-type/<int:user_id>/', views.get_contact_type_for_user, name='get_contact_type_for_user'),
    path('communication/done-messages/', views.get_done_messages, name='get_done_messages'),
    path('communication/message/<int:message_id>/', views.get_message_details, name='get_message_details'),
    path('communication/mark-read/<int:message_id>/', views.mark_message_read, name='mark_message_read'),
    path('communication/mark-done-for-user/<int:user_id>/', views.mark_contact_done_for_user, name='mark_contact_done_for_user'),
    path('communication/delete/<int:message_id>/', views.delete_message, name='delete_message'),
    path('login/', views.admin_login, name='admin_login'),
    path('logout/', views.admin_logout, name='admin_logout'),
    path('update-user/', views.update_user, name='update_user'),
    path('delete-user/', views.delete_user, name='delete_user'),
    path('alerts/', views.admin_alert, name='admin_alert'),
    path('alerts/safety-tip/', views.manage_safety_tip, name='manage_safety_tip'),
    path('alerts/location-contact/', views.manage_location_contact, name='manage_location_contact'),
    path('alerts/districts-by-city/<int:city_id>/', views.get_districts_by_city, name='get_districts_by_city'),
    path('alerts/announcement/', views.manage_announcement, name='manage_announcement'),
    path('resources/', views.admin_resources, name='admin_resources'),
    path('resources/delete/<int:resource_id>/', views.delete_resource, name='delete_resource'),
    path('resources/delete-by-title/<str:title>/', views.delete_resource_by_title, name='delete_resource_by_title'),
    path('resources/edit/<int:resource_id>/', views.edit_resource, name='edit_resource'),
    path('resources/group-count/<str:base_title>/', views.get_group_count, name='get_group_count'),
    path('resources/download/<int:resource_id>/', views.download_resource, name='download_resource'),
]
