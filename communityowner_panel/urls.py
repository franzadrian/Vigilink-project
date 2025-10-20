from django.urls import path
from . import views

app_name = 'communityowner_panel'

urlpatterns = [
    path('', views.community_owner_dashboard, name='dashboard'),
    path('check-name/', views.check_community_name, name='check_name'),
]
