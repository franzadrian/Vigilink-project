from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('login/', views.login_view, name='login'),
    path('register/', views.register_view, name='register'),
    path('logout/', views.logout_view, name='logout'),
    path('get_districts/<int:city_id>/', views.get_districts, name='get_districts'),
    path('check-username/', views.check_username, name='check_username'),
    path('verify-email/', views.verify_email, name='verify_email'),
    path('resend-verification-code/', views.resend_verification_code, name='resend_verification_code'),
    path('forgot-password/', views.forgot_password, name='forgot_password'),
    path('reset-password/<str:token>/', views.reset_password, name='reset_password'),
]