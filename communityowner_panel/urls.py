from django.urls import path
from . import views

app_name = 'communityowner_panel'

urlpatterns = [
    path('', views.community_owner_dashboard, name='dashboard'),
    path('check-name/', views.check_community_name, name='check_name'),
    path('members/', views.members_list, name='members_list'),
    path('members/update/', views.member_update, name='member_update'),
    path('members/add/', views.member_add, name='member_add'),
    path('members/create-account/', views.create_member_account, name='create_member_account'),
    path('members/remove/', views.member_remove, name='member_remove'),
    path('members/download/pdf/', views.members_download_pdf, name='members_download_pdf'),
    path('users/search/', views.user_search, name='user_search'),
    # Emergency contacts API endpoints for modal management
    path('emergency/list/', views.emergency_list, name='emergency_list'),
    path('emergency/add/', views.emergency_add, name='emergency_add'),
    path('emergency/delete/', views.emergency_delete, name='emergency_delete'),
    path('emergency/update/', views.emergency_update, name='emergency_update'),
    # Reports API endpoints
    path('reports/list/', views.reports_list, name='reports_list'),
    path('reports/<int:report_id>/', views.report_detail, name='report_detail'),
    path('reports/download/pdf/', views.reports_download_pdf, name='reports_download_pdf'),
    path('reports/analytics/', views.reports_analytics, name='reports_analytics'),
]
