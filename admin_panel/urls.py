from django.urls import path
from . import views

app_name = 'admin_panel'

urlpatterns = [
    path('', views.admin_index, name='admin_index'),
    path('dashboard/', views.admin_dashboard, name='admin_dashboard'),
    path('residents/', views.admin_resident, name='admin_resident'),
    path('communication/', views.admin_communication, name='admin_communication'),
    path('communication/message/<int:message_id>/', views.get_message_details, name='get_message_details'),
    path('communication/mark-read/<int:message_id>/', views.mark_message_read, name='mark_message_read'),
    path('communication/delete/<int:message_id>/', views.delete_message, name='delete_message'),
    path('login/', views.admin_login, name='admin_login'),
    path('logout/', views.admin_logout, name='admin_logout'),
    path('update-user/', views.update_user, name='update_user'),
    path('delete-user/', views.delete_user, name='delete_user'),
]