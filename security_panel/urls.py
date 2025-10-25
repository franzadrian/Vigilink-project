from django.urls import path
from . import views

app_name = 'security_panel'

urlpatterns = [
    path('', views.security_dashboard, name='dashboard'),
    path('report/<int:report_id>/', views.report_detail, name='report_detail'),
    path('report/<int:report_id>/update/', views.update_report_status, name='update_report_status'),
    path('api/security-users/', views.get_security_users, name='get_security_users'),
]
