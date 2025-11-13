from django.urls import path
from . import views

app_name = 'resources_panel'

urlpatterns = [
    path('', views.resources, name='resources'),
    path('download/<int:resource_id>/', views.download_resource, name='download_resource'),
    path('group-images/<str:group_id>/', views.get_group_images, name='get_group_images'),
]

