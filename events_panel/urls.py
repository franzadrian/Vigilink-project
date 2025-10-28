from django.urls import path
from . import views

app_name = 'events_panel'

urlpatterns = [
    path('', views.events_list, name='events_list'),
    path('<int:event_id>/', views.event_detail, name='event_detail'),
    path('create/', views.create_event, name='create_event'),
    path('<int:event_id>/update/', views.update_event, name='update_event'),
    path('<int:event_id>/delete/', views.delete_event, name='delete_event'),
    path('api/get-events/', views.get_events, name='get_events'),
]
