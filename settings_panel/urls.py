from django.urls import path
from . import views

app_name = 'settings_panel'

urlpatterns = [
    path('', views.settings_page, name='settings'),
    path('cancel-subscription/', views.cancel_subscription, name='cancel_subscription'),
    path('start-free-trial/', views.start_free_trial, name='start_free_trial'),
    path('update-notification-sound/', views.update_notification_sound, name='update_notification_sound'),
    path('update-receive-notifications/', views.update_receive_notifications, name='update_receive_notifications'),
]

