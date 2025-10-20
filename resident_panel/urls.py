from django.urls import path
from . import views

app_name = 'resident_panel'

urlpatterns = [
    path('', views.residents, name='residents'),
    path('join/', views.join_by_code, name='join_by_code'),
]
