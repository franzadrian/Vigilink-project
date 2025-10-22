from django.urls import path
from . import views

app_name = 'communityowner_panel'

urlpatterns = [
    path('', views.community_owner_dashboard, name='dashboard'),
    path('check-name/', views.check_community_name, name='check_name'),
    path('members/', views.members_list, name='members_list'),
    path('members/update/', views.member_update, name='member_update'),
    path('members/add/', views.member_add, name='member_add'),
    path('members/remove/', views.member_remove, name='member_remove'),
    path('users/search/', views.user_search, name='user_search'),
]
