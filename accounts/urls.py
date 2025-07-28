from django.urls import path
from . import views
from django.views.generic import TemplateView

urlpatterns = [
    path('', views.index, name='index'),
    path('login/', TemplateView.as_view(template_name='accounts/login.html'), name='login'),
    path('register/', TemplateView.as_view(template_name='accounts/register.html'), name='register'),
] 